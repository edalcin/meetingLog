package server

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/edalcin/meetinglog/internal/store"
)

const (
	geminiBaseURL    = "https://generativelanguage.googleapis.com/v1beta"
	chatMaxMessages  = 10 // last 5 exchanges (pergunta + resposta)
	chatMaxChars     = 4000
	chatStreamWindow = 5 * time.Minute
)

// chatRules is the fixed part of the system prompt (ADR-002 §5). The acervo
// follows it; both stay identical between questions so Gemini's implicit
// cache can reuse the prefix. Today's date goes in the last user turn.
const chatRules = `Você é o Chat do meetingLog: responde perguntas sobre os registros de Reuniões, Participantes, Projetos e Instituições abaixo (o "acervo").
Regras:
- Responda em português, em Markdown.
- Use só os dados do acervo. Se a informação não estiver lá, diga "Não encontrei essa informação nos registros." Não invente.
- Sempre cite as Reuniões usadas no formato [Reunião #id], por exemplo [Reunião #42].
- Participantes e Projetos marcados "(inativo)" contam normalmente; não os exclua, a não ser que o usuário peça.
- Resolva datas relativas ("mês passado", "última reunião") a partir da data de hoje informada na pergunta.
- Você só consulta; não altera dados.

ACERVO:
`

type chatMessage struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

func (s *Server) handleChat() http.HandlerFunc {
	type request struct {
		Pergunta  string        `json:"pergunta"`
		Historico []chatMessage `json:"historico"`
	}
	client := &http.Client{Timeout: chatStreamWindow}
	return func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.GeminiAPIKey == "" {
			writeError(w, http.StatusServiceUnavailable, "Chat desabilitado: defina GEMINI_API_KEY")
			return
		}
		var req request
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "body inválido")
			return
		}
		req.Pergunta = strings.TrimSpace(req.Pergunta)
		if req.Pergunta == "" || utf8.RuneCountInString(req.Pergunta) > chatMaxChars {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("pergunta vazia ou acima de %d caracteres", chatMaxChars))
			return
		}
		contents, ok := chatHistory(req.Historico)
		if !ok {
			writeError(w, http.StatusBadRequest, "histórico inválido")
			return
		}
		contents = append(contents, geminiContent{Role: "user", Parts: []geminiPart{{
			Text: "Hoje é " + time.Now().Format("2006-01-02 (Monday)") + ".\n\nPergunta: " + req.Pergunta,
		}}})

		acervo, err := store.BuildAcervo(s.db)
		if err != nil {
			slog.Error("chat: acervo", "err", err)
			writeError(w, http.StatusInternalServerError, "erro ao ler os registros")
			return
		}
		model, err := store.GetChatModel(s.db)
		if err != nil {
			slog.Error("chat: model setting", "err", err)
		}

		body, _ := json.Marshal(map[string]any{
			"systemInstruction": geminiContent{Parts: []geminiPart{{Text: chatRules + acervo}}},
			"contents":          contents,
		})
		greq, _ := http.NewRequestWithContext(r.Context(), http.MethodPost,
			s.geminiBase+"/models/"+model+":streamGenerateContent?alt=sse", bytes.NewReader(body))
		greq.Header.Set("Content-Type", "application/json")
		greq.Header.Set("x-goog-api-key", s.cfg.GeminiAPIKey)
		resp, err := client.Do(greq)
		if err != nil {
			slog.Error("chat: gemini request", "err", err)
			writeError(w, http.StatusBadGateway, "falha ao contatar o Gemini")
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			msg, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
			slog.Error("chat: gemini status", "status", resp.StatusCode, "body", string(msg))
			writeError(w, http.StatusBadGateway, fmt.Sprintf("o Gemini respondeu com erro (%d)", resp.StatusCode))
			return
		}

		// Server WriteTimeout (60 s) is too short for a long answer.
		rc := http.NewResponseController(w)
		_ = rc.SetWriteDeadline(time.Now().Add(chatStreamWindow))
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Accel-Buffering", "no")
		w.WriteHeader(http.StatusOK)

		send := func(event string, v any) {
			data, _ := json.Marshal(v)
			if event != "" {
				fmt.Fprintf(w, "event: %s\n", event)
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			_ = rc.Flush()
		}

		sc := bufio.NewScanner(resp.Body)
		sc.Buffer(make([]byte, 64*1024), 1<<20)
		for sc.Scan() {
			line, found := strings.CutPrefix(sc.Text(), "data: ")
			if !found {
				continue
			}
			var chunk struct {
				Candidates []struct {
					Content geminiContent `json:"content"`
				} `json:"candidates"`
			}
			if err := json.Unmarshal([]byte(line), &chunk); err != nil {
				continue
			}
			for _, c := range chunk.Candidates {
				for _, p := range c.Content.Parts {
					if p.Text != "" {
						send("", map[string]string{"text": p.Text})
					}
				}
			}
		}
		if err := sc.Err(); err != nil {
			slog.Error("chat: gemini stream", "err", err)
			send("error", map[string]string{"error": "a resposta do Gemini foi interrompida"})
			return
		}
		send("done", struct{}{})
	}
}

// chatHistory validates client-sent history (untrusted): roles user/model
// only, last chatMaxMessages kept, each text cut to chatMaxChars runes.
func chatHistory(h []chatMessage) ([]geminiContent, bool) {
	if len(h) > chatMaxMessages {
		h = h[len(h)-chatMaxMessages:]
	}
	out := make([]geminiContent, 0, len(h)+1)
	for _, m := range h {
		if m.Role != "user" && m.Role != "model" {
			return nil, false
		}
		text := m.Text
		if utf8.RuneCountInString(text) > chatMaxChars {
			text = string([]rune(text)[:chatMaxChars])
		}
		out = append(out, geminiContent{Role: m.Role, Parts: []geminiPart{{Text: text}}})
	}
	return out, true
}
