function app() {
  return {
    // Auth state
    authenticated: false,
    pinInput: '',
    pinError: false,
    pinLoading: false,

    // Navigation
    activeTab: 'meetings',

    // Meetings list
    meetings: [],
    total: 0,
    currentPage: 1,
    totalPages: 1,
    loading: false,
    filter: '',
    sortCol: 'data_hora',
    sortOrder: 'desc',
    filterTimer: null,

    // Meetings separate filters
    meetingPartFilter: '',
    meetingProjFilter: '',
    meetingFilterTimer: null,

    // Form
    showForm: false,
    editingId: null,
    formLoading: false,
    formData: { data: '', hora: '', tipo: '' },
    formErrors: {},

    // Participants list (tab)
    participantListLoading: false,
    participantListFilter: '',
    participantListAll: [],

    // Participants tab filters & sort
    participantInstFilter: '',
    participantSortCol: 'nome',
    participantSortOrder: 'asc',

    // Participant edit modal
    editingParticipant: null,
    participantForm: { nome: '', instituicao: '', cargo: '', email: '' },
    participantFormErrors: {},
    participantFormLoading: false,
    showParticipantForm: false,

    get filteredParticipantList() {
      const q = this.participantListFilter.toLowerCase()
      const inst = this.participantInstFilter.toLowerCase()
      let list = this.participantListAll
      if (q || inst) {
        list = list.filter(p => {
          if (q && !(p.nome.toLowerCase().includes(q) || (p.instituicao && p.instituicao.toLowerCase().includes(q)))) return false
          if (inst && !(p.instituicao && p.instituicao.toLowerCase().includes(inst))) return false
          return true
        })
      }
      return [...list].sort((a, b) => {
        const av = (a[this.participantSortCol] ?? '').toString().toLowerCase()
        const bv = (b[this.participantSortCol] ?? '').toString().toLowerCase()
        return this.participantSortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    },

    // Participants multi-select
    allParticipants: [],
    selectedParticipantIds: new Set(),
    participantSearch: '',
    showParticipantDropdown: false,

    get filteredParticipants() {
      const q = this.participantSearch.toLowerCase()
      return this.allParticipants.filter(p => {
        if (this.selectedParticipantIds.has(p.id)) return false
        if (!q) return true
        return p.nome.toLowerCase().includes(q) ||
          (p.instituicao && p.instituicao.toLowerCase().includes(q))
      })
    },

    get showCreateOption() {
      const q = this.participantSearch.trim()
      if (!q) return false
      return !this.allParticipants.some(p => p.nome.toLowerCase() === q.toLowerCase())
    },

    // Projects list (for the projects tab)
    allProjects: [],

    // Projects tab filters & sort
    projectStatusFilter: '',
    projectInstFilter: '',
    projectSortCol: 'nome',
    projectSortOrder: 'asc',

    // Project edit modal
    editingProject: null,
    projectForm: { nome: '', ativo: true, instituicao: '' },
    projectFormErrors: {},
    projectFormLoading: false,
    showProjectForm: false,

    get filteredProjectList() {
      const inst = this.projectInstFilter.toLowerCase()
      const status = this.projectStatusFilter
      let list = this.allProjects
      if (inst || status) {
        list = list.filter(p => {
          if (inst && !(p.instituicao && p.instituicao.toLowerCase().includes(inst))) return false
          if (status === 'ativo' && !p.ativo) return false
          if (status === 'inativo' && p.ativo) return false
          return true
        })
      }
      return [...list].sort((a, b) => {
        const col = this.projectSortCol
        if (col === 'ativo') {
          const av = a.ativo ? 1 : 0
          const bv = b.ativo ? 1 : 0
          return this.projectSortOrder === 'asc' ? av - bv : bv - av
        }
        const av = (a[col] ?? '').toString().toLowerCase()
        const bv = (b[col] ?? '').toString().toLowerCase()
        return this.projectSortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    },

    // Projects multi-select (for meeting form)
    selectedProjectIds: new Set(),
    projectSearchQuery: '',
    showProjectDropdown: false,

    get filteredProjects() {
      const q = this.projectSearchQuery.toLowerCase()
      return this.allProjects.filter(pr => {
        // Always exclude already-selected active projects (they appear as tags)
        // Include inactive projects only if they are already selected (pre-populated)
        if (this.selectedProjectIds.has(pr.id)) return false
        if (!pr.ativo) return false
        if (!q) return true
        return pr.nome.toLowerCase().includes(q) ||
          (pr.instituicao && pr.instituicao.toLowerCase().includes(q))
      })
    },

    // Toast
    toast: { show: false, message: '', error: false },

    init() {
      if (sessionStorage.getItem('pin_ok') === '1') {
        this.authenticated = true
        this.loadMeetings()
      }
      this.$watch('filter', () => {
        clearTimeout(this.filterTimer)
        this.filterTimer = setTimeout(() => {
          this.currentPage = 1
          this.loadMeetings()
        }, 300)
      })
      this.$watch('meetingPartFilter', () => {
        clearTimeout(this.meetingFilterTimer)
        this.meetingFilterTimer = setTimeout(() => { this.currentPage = 1; this.loadMeetings() }, 300)
      })
      this.$watch('meetingProjFilter', () => {
        clearTimeout(this.meetingFilterTimer)
        this.meetingFilterTimer = setTimeout(() => { this.currentPage = 1; this.loadMeetings() }, 300)
      })
      this.$watch('activeTab', (tab) => {
        if (tab === 'projects') this.loadProjects()
        if (tab === 'participants') this.loadParticipantList()
      })
    },

    async verifyPin() {
      if (!this.pinInput) return
      this.pinLoading = true
      this.pinError = false
      try {
        const res = await fetch('/api/auth/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: this.pinInput })
        })
        const data = await res.json()
        if (data.ok) {
          sessionStorage.setItem('pin_ok', '1')
          this.authenticated = true
          this.loadMeetings()
        } else {
          this.pinError = true
          this.pinInput = ''
        }
      } catch {
        this.pinError = true
      } finally {
        this.pinLoading = false
      }
    },

    async loadMeetings() {
      this.loading = true
      try {
        const params = new URLSearchParams({
          q: this.filter,
          q_part: this.meetingPartFilter,
          q_proj: this.meetingProjFilter,
          sort: this.sortCol,
          order: this.sortOrder,
          page: this.currentPage,
          limit: 50
        })
        const res = await fetch(`/api/meetings?${params}`)
        if (!res.ok) throw new Error('Erro ao carregar reuniões')
        const data = await res.json()
        this.meetings = data.data
        this.total = data.total
        this.totalPages = data.pages
      } catch (e) {
        this.showToast('Erro ao carregar reuniões', true)
      } finally {
        this.loading = false
      }
    },

    async loadParticipantList() {
      if (this.participantListAll.length > 0) return
      this.participantListLoading = true
      try {
        const res = await fetch('/api/participants?limit=500')
        if (!res.ok) throw new Error()
        const data = await res.json()
        this.participantListAll = data.data
      } catch {
        this.showToast('Erro ao carregar participantes', true)
      } finally {
        this.participantListLoading = false
      }
    },

    filterParticipantList() {
      // computed via getter — no-op trigger for Alpine reactivity
    },

    async loadParticipants() {
      if (this.allParticipants.length > 0) return
      try {
        const res = await fetch('/api/participants?limit=500')
        if (!res.ok) throw new Error()
        const data = await res.json()
        this.allParticipants = data.data
      } catch {
        this.showToast('Erro ao carregar participantes', true)
      }
    },

    async loadProjects() {
      if (this.allProjects.length > 0) return
      try {
        const res = await fetch('/api/projects?limit=500')
        if (!res.ok) throw new Error()
        const data = await res.json()
        this.allProjects = data.data
      } catch {
        this.showToast('Erro ao carregar projetos', true)
      }
    },

    async handleParticipantEnter() {
      const q = this.participantSearch.trim()
      if (!q) return
      const exact = this.allParticipants.find(p => p.nome.toLowerCase() === q.toLowerCase())
      if (exact) {
        this.toggleParticipant(exact.id)
        this.participantSearch = ''
        this.showParticipantDropdown = false
      } else {
        await this.createAndSelectParticipant(q)
      }
    },

    selectFromDropdown(id) {
      this.toggleParticipant(id)
      this.participantSearch = ''
      this.showParticipantDropdown = false
    },

    async createAndSelectParticipant(nome) {
      try {
        const res = await fetch('/api/participants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome })
        })
        if (!res.ok) throw new Error()
        const p = await res.json()
        this.allParticipants.push(p)
        this.allParticipants.sort((a, b) => a.nome.localeCompare(b.nome))
        this.toggleParticipant(p.id)
        this.participantSearch = ''
        this.showParticipantDropdown = false
      } catch {
        this.showToast('Erro ao criar participante', true)
      }
    },

    toggleParticipant(id) {
      const newSet = new Set(this.selectedParticipantIds)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      this.selectedParticipantIds = newSet
    },

    isSelected(id) {
      return this.selectedParticipantIds.has(id)
    },

    getSelectedParticipants() {
      return this.allParticipants.filter(p => this.selectedParticipantIds.has(p.id))
    },

    selectProjectFromDropdown(id) {
      const newSet = new Set(this.selectedProjectIds)
      newSet.add(id)
      this.selectedProjectIds = newSet
      this.projectSearchQuery = ''
      this.showProjectDropdown = false
    },

    removeProject(id) {
      const newSet = new Set(this.selectedProjectIds)
      newSet.delete(id)
      this.selectedProjectIds = newSet
    },

    getSelectedProjects() {
      return this.allProjects.filter(pr => this.selectedProjectIds.has(pr.id))
    },

    setSort(col) {
      if (this.sortCol === col) {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortCol = col
        this.sortOrder = 'asc'
      }
      this.currentPage = 1
      this.loadMeetings()
    },

    setSortParticipant(col) {
      if (this.participantSortCol === col) {
        this.participantSortOrder = this.participantSortOrder === 'asc' ? 'desc' : 'asc'
      } else {
        this.participantSortCol = col
        this.participantSortOrder = 'asc'
      }
    },

    setSortProject(col) {
      if (this.projectSortCol === col) {
        this.projectSortOrder = this.projectSortOrder === 'asc' ? 'desc' : 'asc'
      } else {
        this.projectSortCol = col
        this.projectSortOrder = 'asc'
      }
    },

    goPage(p) {
      if (p < 1 || p > this.totalPages) return
      this.currentPage = p
      this.loadMeetings()
    },

    formatDate(dt) {
      if (!dt) return ''
      const d = new Date(dt)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    },

    async openForm() {
      this.editingId = null
      this.formData = { data: '', hora: '', tipo: '' }
      this.formErrors = {}
      this.selectedParticipantIds = new Set()
      this.participantSearch = ''
      this.showParticipantDropdown = false
      this.selectedProjectIds = new Set()
      this.projectSearchQuery = ''
      this.showProjectDropdown = false
      this.showForm = true
      await this.loadParticipants()
      await this.loadProjects()
    },

    async editMeeting(m) {
      this.editingId = m.id
      const dt = new Date(m.data_hora)
      const pad = n => String(n).padStart(2, '0')
      this.formData = {
        data: `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`,
        hora: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
        tipo: m.tipo
      }
      this.formErrors = {}
      this.participantSearch = ''
      this.showParticipantDropdown = false
      this.projectSearchQuery = ''
      this.showProjectDropdown = false
      this.showForm = true
      await this.loadParticipants()
      await this.loadProjects()
      this.selectedParticipantIds = new Set(m.participante_ids || [])
      this.selectedProjectIds = new Set(m.projeto_ids || [])
    },

    cancelForm() {
      this.showForm = false
      this.editingId = null
      this.formErrors = {}
      this.selectedParticipantIds = new Set()
      this.participantSearch = ''
      this.showParticipantDropdown = false
      this.selectedProjectIds = new Set()
      this.projectSearchQuery = ''
      this.showProjectDropdown = false
    },

    async saveMeeting() {
      this.formErrors = {}
      const data_hora = this.formData.data && this.formData.hora
        ? `${this.formData.data}T${this.formData.hora}:00`
        : null
      const payload = {
        data_hora,
        tipo: this.formData.tipo,
        participante_ids: Array.from(this.selectedParticipantIds),
        projeto_ids: Array.from(this.selectedProjectIds)
      }

      this.formLoading = true
      try {
        const url = this.editingId ? `/api/meetings/${this.editingId}` : '/api/meetings'
        const method = this.editingId ? 'PUT' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const body = await res.json()
        if (!res.ok) {
          if (body.fields) {
            this.formErrors = body.fields
          } else {
            this.showToast(body.error || 'Erro ao salvar', true)
          }
          return
        }
        this.cancelForm()
        this.showToast(this.editingId ? 'Reunião atualizada!' : 'Reunião registrada!')
        this.currentPage = 1
        await this.loadMeetings()
      } catch {
        this.showToast('Erro de conexão. Tente novamente.', true)
      } finally {
        this.formLoading = false
      }
    },

    async deleteMeeting(id) {
      if (!confirm('Confirma a exclusão desta reunião?')) return
      try {
        const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error()
        this.showToast('Reunião excluída.')
        await this.loadMeetings()
      } catch {
        this.showToast('Erro ao excluir reunião.', true)
      }
    },

    async deleteParticipant(id, nome) {
      if (!confirm(`Confirma a exclusão de "${nome}"?`)) return
      try {
        const res = await fetch(`/api/participants/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error()
        this.participantListAll = this.participantListAll.filter(p => p.id !== id)
        this.allParticipants = this.allParticipants.filter(p => p.id !== id)
        this.showToast('Participante excluído.')
      } catch {
        this.showToast('Erro ao excluir participante.', true)
      }
    },

    openEditParticipant(p) {
      this.editingParticipant = p.id
      this.participantForm = { nome: p.nome, instituicao: p.instituicao ?? '', cargo: p.cargo ?? '', email: p.email ?? '' }
      this.participantFormErrors = {}
      this.showParticipantForm = true
    },

    cancelParticipantForm() {
      this.showParticipantForm = false
      this.editingParticipant = null
      this.participantFormErrors = {}
    },

    async saveParticipant() {
      this.participantFormErrors = {}
      if (!this.participantForm.nome.trim()) {
        this.participantFormErrors.nome = 'Obrigatório'
        return
      }
      this.participantFormLoading = true
      try {
        const res = await fetch(`/api/participants/${this.editingParticipant}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.participantForm)
        })
        const body = await res.json()
        if (!res.ok) { this.showToast(body.error || 'Erro ao salvar', true); return }
        const idx = this.participantListAll.findIndex(p => p.id === this.editingParticipant)
        if (idx >= 0) this.participantListAll[idx] = body
        const idx2 = this.allParticipants.findIndex(p => p.id === this.editingParticipant)
        if (idx2 >= 0) this.allParticipants[idx2] = body
        this.cancelParticipantForm()
        this.showToast('Participante atualizado!')
      } catch {
        this.showToast('Erro de conexão.', true)
      } finally {
        this.participantFormLoading = false
      }
    },

    async deleteProject(id, nome) {
      if (!confirm(`Confirma a exclusão do projeto "${nome}"?`)) return
      try {
        const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error()
        this.allProjects = this.allProjects.filter(p => p.id !== id)
        this.showToast('Projeto excluído.')
      } catch {
        this.showToast('Erro ao excluir projeto.', true)
      }
    },

    openEditProject(p) {
      this.editingProject = p.id
      this.projectForm = { nome: p.nome, ativo: p.ativo, instituicao: p.instituicao ?? '' }
      this.projectFormErrors = {}
      this.showProjectForm = true
    },

    cancelProjectForm() {
      this.showProjectForm = false
      this.editingProject = null
      this.projectFormErrors = {}
    },

    async saveProject() {
      this.projectFormErrors = {}
      if (!this.projectForm.nome.trim()) {
        this.projectFormErrors.nome = 'Obrigatório'
        return
      }
      this.projectFormLoading = true
      try {
        const res = await fetch(`/api/projects/${this.editingProject}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.projectForm)
        })
        const body = await res.json()
        if (!res.ok) { this.showToast(body.error || 'Erro ao salvar', true); return }
        const idx = this.allProjects.findIndex(p => p.id === this.editingProject)
        if (idx >= 0) this.allProjects[idx] = body
        this.cancelProjectForm()
        this.showToast('Projeto atualizado!')
      } catch {
        this.showToast('Erro de conexão.', true)
      } finally {
        this.projectFormLoading = false
      }
    },

    showToast(message, error = false) {
      this.toast = { show: true, message, error }
      setTimeout(() => { this.toast.show = false }, 3000)
    }
  }
}
