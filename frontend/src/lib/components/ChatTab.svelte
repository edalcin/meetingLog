<script>
  import { onMount, onDestroy, tick } from 'svelte'
  import { Marked } from 'marked'
  import { api, chatStream } from '../api.js'
  import MeetingInfoModal from './MeetingInfoModal.svelte'

  const STORAGE_KEY = 'meetinglog_chat'
  const MAX_HISTORY_MESSAGES = 10 // 5 trocas (pergunta + resposta)
  const MAX_TEXT = 4000

  // ── Markdown (saída do modelo é não confiável) ─────────────────────────────
  // HTML cru é escapado, imagens viram texto, só http(s)/mailto em links.
  // `[Reunião #123]` vira botão com data-meeting-id (somente dígitos).
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const md = new Marked({
    gfm: true,
    renderer: {
      html: (token) => esc(token.text),
      image: (token) => esc(token.text || token.href),
      link(token) {
        const inner = this.parser.parseInline(token.tokens)
        if (!/^(https?:|mailto:)/i.test(token.href)) return inner
        return `<a href="${esc(token.href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
      },
    },
    extensions: [{
      name: 'citacao',
      level: 'inline',
      start: (src) => src.indexOf('[Reunião'),
      tokenizer(src) {
        const m = /^\[Reunião #(\d+)\]/.exec(src)
        if (m) return { type: 'citacao', raw: m[0], id: m[1] }
      },
      renderer: (t) => `<button type="button" class="chat-cite" data-meeting-id="${t.id}">Reunião #${t.id}</button>`,
    }],
  })

  const render = (text) => md.parse(text)

  // ── Estado ────────────────────────────────────────────────────────────────
  function loadHistory() {
    try {
      const h = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
      return Array.isArray(h) ? h.filter(m => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string') : []
    } catch { return [] }
  }

  let messages = $state(loadHistory())
  let input = $state('')
  let streaming = $state(false)
  let partial = $state('')
  let errorMsg = $state('')
  let chatEnabled = $state(null) // null = ainda carregando
  let copiedIdx = $state(-1)
  let infoMeetingId = $state(null)
  let endEl = $state(null)
  let abort = null
  let copyTimer = null

  onMount(async () => {
    try {
      chatEnabled = (await api.get('/api/settings')).chat_enabled === true
    } catch {
      chatEnabled = false
    }
  })

  onDestroy(() => {
    abort?.abort()
    clearTimeout(copyTimer)
  })

  function persist() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)) } catch {}
  }

  async function scrollEnd() {
    await tick()
    endEl?.scrollIntoView({ block: 'end' })
  }

  async function send() {
    const pergunta = input.trim()
    if (!pergunta || streaming || chatEnabled !== true) return

    const historico = messages.slice(-MAX_HISTORY_MESSAGES).map(m => ({ role: m.role, text: m.text.slice(0, MAX_TEXT) }))
    messages.push({ role: 'user', text: pergunta })
    input = ''
    errorMsg = ''
    partial = ''
    streaming = true
    abort = new AbortController()
    scrollEnd()

    try {
      await chatStream(pergunta, historico, (chunk) => { partial += chunk; scrollEnd() }, abort.signal)
      if (!partial.trim()) throw new Error('O Chat não retornou resposta.')
      messages.push({ role: 'model', text: partial })
      persist()
    } catch (e) {
      if (e.name === 'AbortError') return
      // Troca falha não entra no histórico: remove a pergunta e devolve ao campo para reenvio.
      messages.pop()
      input = pergunta
      errorMsg = e.message
    } finally {
      streaming = false
      partial = ''
      scrollEnd()
    }
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      send()
    }
  }

  function newConversation() {
    if (streaming) return
    messages = []
    errorMsg = ''
    sessionStorage.removeItem(STORAGE_KEY)
  }

  async function copy(i) {
    try {
      await navigator.clipboard.writeText(messages[i].text)
      copiedIdx = i
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => copiedIdx = -1, 1500)
    } catch {}
  }

  function onMessagesClick(e) {
    const id = e.target.closest?.('[data-meeting-id]')?.dataset.meetingId
    if (id) infoMeetingId = Number(id)
  }
</script>

<div class="flex flex-col h-[calc(100vh-8.5rem)] min-h-[24rem] bg-white rounded-xl border border-gray-200">
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
    <h2 class="text-lg font-semibold text-gray-800 pl-3 border-l-4 border-blue-500">Chat</h2>
    <button
      onclick={newConversation}
      disabled={streaming || messages.length === 0}
      class="text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      Nova conversa
    </button>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4" onclick={onMessagesClick}>
    {#if chatEnabled === false}
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700 text-sm">
        O Chat está desativado: o servidor não tem a chave do provedor configurada (<code>GEMINI_API_KEY</code>).
      </div>
    {:else if messages.length === 0 && !streaming}
      <p class="text-sm text-gray-500 text-center mt-8">
        Pergunte algo sobre as reuniões, participantes ou projetos registrados.
      </p>
    {/if}

    {#each messages as m, i}
      {#if m.role === 'user'}
        <div class="flex justify-end">
          <div class="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm whitespace-pre-wrap break-words">{m.text}</div>
        </div>
      {:else}
        <div class="flex justify-start">
          <div class="max-w-[95%] sm:max-w-[85%] min-w-0 bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2 text-sm">
            <div class="chat-md break-words">{@html render(m.text)}</div>
            <div class="mt-1 text-right">
              <button onclick={() => copy(i)} class="text-xs text-gray-500 hover:text-gray-800">
                {copiedIdx === i ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      {/if}
    {/each}

    {#if streaming}
      <div class="flex justify-start">
        <div class="max-w-[95%] sm:max-w-[85%] bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2 text-sm whitespace-pre-wrap break-words">
          {#if partial}{partial}{:else}<span class="text-gray-400">Pensando…</span>{/if}
        </div>
      </div>
    {/if}

    {#if errorMsg}
      <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{errorMsg}</div>
    {/if}

    <div bind:this={endEl}></div>
  </div>

  <div class="border-t border-gray-200 p-3 flex items-end gap-2">
    <textarea
      bind:value={input}
      onkeydown={onKeydown}
      rows="2"
      disabled={chatEnabled !== true}
      placeholder={chatEnabled === false ? 'Chat desativado' : 'Escreva sua pergunta (Enter envia, Shift+Enter quebra linha)'}
      class="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
    ></textarea>
    <button
      onclick={send}
      disabled={streaming || chatEnabled !== true || !input.trim()}
      class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
    >
      {streaming ? 'Enviando…' : 'Enviar'}
    </button>
  </div>
</div>

{#if infoMeetingId !== null}
  <MeetingInfoModal meetingId={infoMeetingId} onClose={() => infoMeetingId = null} />
{/if}

<style>
  .chat-md :global(> :first-child) { margin-top: 0; }
  .chat-md :global(> :last-child) { margin-bottom: 0; }
  .chat-md :global(p) { margin: 0.5rem 0; }
  .chat-md :global(ul) { list-style: disc; padding-left: 1.25rem; margin: 0.5rem 0; }
  .chat-md :global(ol) { list-style: decimal; padding-left: 1.25rem; margin: 0.5rem 0; }
  .chat-md :global(h1), .chat-md :global(h2), .chat-md :global(h3), .chat-md :global(h4) { font-weight: 600; margin: 0.75rem 0 0.25rem; }
  .chat-md :global(h1) { font-size: 1.125rem; }
  .chat-md :global(h2) { font-size: 1.05rem; }
  .chat-md :global(a) { color: #2563eb; text-decoration: underline; }
  .chat-md :global(code) { background: #e5e7eb; border-radius: 0.25rem; padding: 0.05rem 0.3rem; font-size: 0.85em; }
  .chat-md :global(pre) { background: #1f2937; color: #f3f4f6; border-radius: 0.5rem; padding: 0.75rem; overflow-x: auto; margin: 0.5rem 0; }
  .chat-md :global(pre code) { background: none; padding: 0; color: inherit; }
  .chat-md :global(blockquote) { border-left: 3px solid #d1d5db; padding-left: 0.75rem; color: #4b5563; margin: 0.5rem 0; }
  .chat-md :global(table) { display: block; overflow-x: auto; border-collapse: collapse; margin: 0.5rem 0; }
  .chat-md :global(th), .chat-md :global(td) { border: 1px solid #d1d5db; padding: 0.25rem 0.5rem; text-align: left; }
  .chat-md :global(th) { background: #e5e7eb; }
  .chat-md :global(.chat-cite) { color: #2563eb; text-decoration: underline; font-weight: 500; cursor: pointer; }
</style>
