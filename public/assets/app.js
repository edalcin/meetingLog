function app() {
  return {
    // Auth state
    authenticated: false,
    pinInput: '',
    pinError: false,
    pinLoading: false,

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

    // Form
    showForm: false,
    editingId: null,
    formLoading: false,
    formData: { data: '', hora: '', tipo: '', projeto: '' },
    formErrors: {},

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
      this.formData = { data: '', hora: '', tipo: '', projeto: '' }
      this.formErrors = {}
      this.selectedParticipantIds = new Set()
      this.participantSearch = ''
      this.showParticipantDropdown = false
      this.showForm = true
      await this.loadParticipants()
    },

    async editMeeting(m) {
      this.editingId = m.id
      const dt = new Date(m.data_hora)
      const pad = n => String(n).padStart(2, '0')
      this.formData = {
        data: `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`,
        hora: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
        tipo: m.tipo,
        projeto: m.projeto
      }
      this.formErrors = {}
      this.participantSearch = ''
      this.showParticipantDropdown = false
      this.showForm = true
      await this.loadParticipants()
      this.selectedParticipantIds = new Set(m.participante_ids || [])
    },

    cancelForm() {
      this.showForm = false
      this.editingId = null
      this.formErrors = {}
      this.selectedParticipantIds = new Set()
      this.participantSearch = ''
      this.showParticipantDropdown = false
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
        projeto: this.formData.projeto
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

    showToast(message, error = false) {
      this.toast = { show: true, message, error }
      setTimeout(() => { this.toast.show = false }, 3000)
    }
  }
}
