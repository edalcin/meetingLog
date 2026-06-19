package model

// Meeting represents a reuniao row with its associated data.
type Meeting struct {
	ID            int64    `json:"id"`
	DataHora      string   `json:"data_hora"`
	Tipo          string   `json:"tipo"`
	Notas         *string  `json:"notas"`
	CriadoEm     string   `json:"criado_em"`
	AtualizadoEm string   `json:"atualizado_em"`
	HasNotas      bool     `json:"has_notas,omitempty"`
	ArquivoCount  int      `json:"arquivo_count,omitempty"`

	// Populated in list responses
	ParticipantesNomes string  `json:"participantes_nomes,omitempty"`
	ParticipanteIDs    []int64 `json:"participante_ids,omitempty"`
	ProjetoNomes       string  `json:"projeto_nomes,omitempty"`
	ProjetoIDs         []int64 `json:"projeto_ids,omitempty"`

	// Populated in detail responses
	Participantes []Participant `json:"participantes,omitempty"`
	Projetos      []Project     `json:"projetos,omitempty"`
	Pautas        []Pauta       `json:"pautas,omitempty"`
	Links         []Link        `json:"links,omitempty"`

	// Only in create/update responses
	RejectedURLs []string `json:"rejected_urls,omitempty"`
}

// MeetingListResponse is the paginated list response.
type MeetingListResponse struct {
	Data  []Meeting `json:"data"`
	Total int       `json:"total"`
	Page  int       `json:"page"`
	Limit int       `json:"limit"`
	Pages int       `json:"pages"`
}

// Participant represents a participante row.
type Participant struct {
	ID          int64   `json:"id"`
	Nome        string  `json:"nome"`
	Instituicao *string `json:"instituicao"`
	Lotacao     *string `json:"lotacao,omitempty"`
	Cargo       *string `json:"cargo,omitempty"`
	Email       *string `json:"email,omitempty"`
	Ativo       bool    `json:"ativo"`
	AtivoManual *bool   `json:"ativo_manual,omitempty"`
	Notas       *string `json:"notas,omitempty"`
	CriadoEm   string  `json:"criado_em,omitempty"`
	ReuniaoCount int   `json:"reuniao_count,omitempty"`

	// Detail response
	Projetos []ProjectSummary `json:"projetos,omitempty"`
	Reunioes []MeetingSummary `json:"reunioes,omitempty"`
}

// ParticipantListResponse is the list response for participants.
type ParticipantListResponse struct {
	Data  []Participant `json:"data"`
	Total int           `json:"total"`
}

// Project represents a projeto row.
type Project struct {
	ID             int64    `json:"id"`
	Nome           string   `json:"nome"`
	Ativo          bool     `json:"ativo"`
	Notas          *string  `json:"notas,omitempty"`
	CriadoEm      string   `json:"criado_em,omitempty"`
	InstituicaoNomes string `json:"instituicao_nomes,omitempty"`
	InstituicaoIDs []int64  `json:"instituicao_ids,omitempty"`
	HasNotas       bool     `json:"has_notas,omitempty"`
	LinkCount      int      `json:"link_count,omitempty"`
	ReuniaoCount   int      `json:"reuniao_count,omitempty"`

	// Detail response
	Links    []ProjectLink    `json:"links,omitempty"`
	Reunioes []MeetingSummary `json:"reunioes,omitempty"`

	// Mutations
	DeactivatedParticipants []ParticipantSummary `json:"deactivated_participants,omitempty"`
	RejectedURLs            []string             `json:"rejected_urls,omitempty"`
}

// ProjectListResponse is the list response for projects.
type ProjectListResponse struct {
	Data  []Project `json:"data"`
	Total int       `json:"total"`
}

// Institution represents an instituicao row.
type Institution struct {
	ID               int64  `json:"id"`
	Sigla            string `json:"sigla"`
	Nome             *string `json:"nome"`
	CriadoEm        string  `json:"criado_em,omitempty"`
	ParticipanteCount int    `json:"participante_count,omitempty"`
	ProjetoCount     int     `json:"projeto_count,omitempty"`

	// Detail response
	Participantes []Participant    `json:"participantes,omitempty"`
	Projetos      []ProjectSummary `json:"projetos,omitempty"`

	// Mutations
	OldSigla string `json:"oldSigla,omitempty"`
}

// InstitutionListResponse is the list response for institutions.
type InstitutionListResponse struct {
	Data  []Institution `json:"data"`
	Total int           `json:"total"`
}

// Pauta represents a meeting agenda item.
type Pauta struct {
	ID       int64  `json:"id"`
	Texto    string `json:"texto"`
	Ordem    int    `json:"ordem"`
}

// Link represents a meeting link.
type Link struct {
	ID    int64   `json:"id"`
	Nome  *string `json:"nome"`
	URL   string  `json:"url"`
	Ordem int     `json:"ordem"`
}

// ProjectLink represents a project link.
type ProjectLink struct {
	ID    int64   `json:"id"`
	Nome  *string `json:"nome"`
	URL   string  `json:"url"`
	Ordem int     `json:"ordem"`
}

// File represents an arquivo row.
type File struct {
	ID               int64  `json:"id"`
	ReuniaoID        int64  `json:"reuniao_id"`
	FilenameOriginal string `json:"filename_original"`
	FilenameStored   string `json:"filename_stored"`
	Letter           string `json:"letter"`
	MimeType         string `json:"mime_type"`
	FileSize         int64  `json:"file_size"`
	CriadoEm        string `json:"criado_em"`
}

// ShareLink represents a link_publico row.
type ShareLink struct {
	ID          int64  `json:"id"`
	Token       string `json:"token"`
	FilterType  string `json:"filter_type"`
	FilterValue string `json:"filter_value"`
	Descricao   string `json:"descricao"`
	CriadoEm   string `json:"criado_em"`
	Revogado   bool   `json:"revogado"`
	URL         string `json:"url,omitempty"`
}

// Summary types for nested responses.

// ProjectSummary is a lightweight project used in nested lists.
type ProjectSummary struct {
	ID   int64  `json:"id"`
	Nome string `json:"nome"`
	Ativo bool  `json:"ativo"`
}

// ParticipantSummary is a lightweight participant used in nested lists.
type ParticipantSummary struct {
	ID   int64  `json:"id"`
	Nome string `json:"nome"`
	Ativo bool  `json:"ativo,omitempty"`
}

// MeetingSummary is a lightweight meeting used in nested lists.
type MeetingSummary struct {
	ID          int64  `json:"id"`
	DataHora    string `json:"data_hora"`
	Tipo        string `json:"tipo,omitempty"`
	ProjetoNomes string `json:"projeto_nomes,omitempty"`
}

// DashboardOptions is returned by GET /api/dashboard/options.
type DashboardOptions struct {
	Anos         []string            `json:"anos"`
	Projetos     []ParticipantSummary `json:"projetos"`
	Participantes []ParticipantSummary `json:"participantes"`
}

// DashboardData is returned by GET /api/dashboard.
type DashboardData struct {
	FilterDescription    string              `json:"filterDescription"`
	TotalReunioes        int                 `json:"totalReunioes"`
	TopProjetos          []TopEntry          `json:"topProjetos"`
	TopParticipantes     []TopEntry          `json:"topParticipantes"`
	UltimaReuniaoData    *UltimaReuniao      `json:"ultimaReuniaoData"`
	PorMes               PorMesData          `json:"porMes"`
	HorasFreq            []int               `json:"horasFreq"`
	DiasFreq             []int               `json:"diasFreq"`
	ProjetosStack        ProjetosStackData   `json:"projetosStack"`
	TopProjetosPizza     PizzaData           `json:"topProjetosPizza"`
	TopParticipantesPizza PizzaData          `json:"topParticipantesPizza"`
}

// TopEntry represents a ranked item with count and percentage.
type TopEntry struct {
	Nome    string  `json:"nome"`
	Count   int     `json:"count"`
	Percent float64 `json:"percent"`
}

// UltimaReuniao holds data about the most recent meeting.
type UltimaReuniao struct {
	Data          string   `json:"data"`
	Hora          string   `json:"hora"`
	Projetos      []string `json:"projetos"`
	Participantes []string `json:"participantes"`
	Pautas        []string `json:"pautas"`
}

// PorMesData holds monthly meeting count and trend line.
type PorMesData struct {
	Labels   []string  `json:"labels"`
	Data     []int     `json:"data"`
	Tendencia []float64 `json:"tendencia"`
}

// ProjetosStackData holds stacked-bar chart data for projects by year.
type ProjetosStackData struct {
	Labels   []string        `json:"labels"`
	Datasets []StackDataset  `json:"datasets"`
}

// StackDataset is one dataset in the stacked bar chart.
type StackDataset struct {
	Label           string `json:"label"`
	Data            []int  `json:"data"`
	BackgroundColor string `json:"backgroundColor"`
}

// PizzaData holds pie-chart labels and values.
type PizzaData struct {
	Labels []string `json:"labels"`
	Data   []int    `json:"data"`
}

// MaintenanceAffected is returned by replace-project dry-run.
type MaintenanceAffected struct {
	Affected []MaintenanceMeeting `json:"affected"`
	Count    int                  `json:"count"`
}

// MaintenanceMeeting is one row in the dry-run response.
type MaintenanceMeeting struct {
	ID                int64  `json:"id"`
	DataFmt           string `json:"data_fmt"`
	ParticipantesNomes string `json:"participantes_nomes"`
}
