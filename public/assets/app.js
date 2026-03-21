function app() {
  // Quill instances stored OUTSIDE Alpine's reactive data to avoid Proxy wrapping.
  // Alpine wraps all data properties in Proxy, which breaks Quill's internal
  // instanceof checks and slot access, causing setContents() to throw silently.
  let _quillEditor = null
  let _quillViewer = null

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
    sortCol: 'data_hora',
    sortOrder: 'desc',

    // Meetings list filter multi-select
    filterPartIds: new Set(),
    filterPartSearch: '',
    showFilterPartDropdown: false,
    filterProjIds: new Set(),
    filterProjSearch: '',
    showFilterProjDropdown: false,

    // Form
    showForm: false,
    editingId: null,
    formLoading: false,
    formData: { data: '', hora: '', tipo: '', notas: '' },
    formErrors: {},
    pautas: [],
    novaPauta: '',

    // Participants list (tab)
    participantListLoading: false,
    participantListAll: [],

    // Participants tab filter & sort
    filterInstituicao: '',
    showInstituicaoDropdown: false,
    participantSortCol: 'nome',
    participantSortOrder: 'asc',

    // Participant edit modal
    editingParticipant: null,
    participantForm: { nome: '', instituicao: '', cargo: '', email: '' },
    participantFormErrors: {},
    participantFormLoading: false,
    showParticipantForm: false,
    participantInstSearch: '',
    showParticipantInstDropdown: false,

    get filteredParticipantList() {
      const q = this.filterInstituicao.toLowerCase()
      let list = q
        ? this.participantListAll.filter(p => p.instituicao && p.instituicao.toLowerCase().includes(q))
        : this.participantListAll
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

    get filteredParticipantsForFilter() {
      const q = this.filterPartSearch.toLowerCase()
      return this.allParticipants.filter(p => {
        if (this.filterPartIds.has(p.id)) return false
        if (!q) return true
        return p.nome.toLowerCase().includes(q) || (p.instituicao && p.instituicao.toLowerCase().includes(q))
      })
    },

    get filteredProjectsForFilter() {
      const q = this.filterProjSearch.toLowerCase()
      return this.allProjects.filter(pr => {
        if (this.filterProjIds.has(pr.id)) return false
        if (!q) return true
        return pr.nome.toLowerCase().includes(q) || (pr.instituicao && pr.instituicao.toLowerCase().includes(q))
      })
    },

    get instituicaoOptions() {
      const q = this.filterInstituicao.toLowerCase()
      const unique = [...new Set(this.participantListAll.map(p => p.instituicao).filter(Boolean))].sort()
      return q ? unique.filter(i => i.toLowerCase().includes(q)) : unique
    },

    get projInstituicaoOptions() {
      const q = this.filterProjInstituicao.toLowerCase()
      const unique = [...new Set(this.allProjects.map(p => p.instituicao).filter(Boolean))].sort()
      return q ? unique.filter(i => i.toLowerCase().includes(q)) : unique
    },

    // Projects list (for the projects tab)
    allProjects: [],

    // Projects tab filter & sort
    projectStatusFilter: '',
    filterProjInstituicao: '',
    showProjInstituicaoDropdown: false,
    projectSortCol: 'nome',
    projectSortOrder: 'asc',

    // Project edit modal
    editingProject: null,
    projectForm: { nome: '', ativo: true, instituicao: '' },
    projectFormErrors: {},
    projectFormLoading: false,
    showProjectForm: false,
    projectInstSearch: '',
    showProjectInstDropdown: false,

    // Institutions list (tab)
    institutionListLoading: false,
    institutionListAll: [],
    filterInstituicaoList: '',
    showInstituicaoListDropdown: false,
    institutionSortCol: 'sigla',
    institutionSortOrder: 'asc',

    // Institution edit modal
    editingInstitution: null,
    institutionForm: { sigla: '', nome: '' },
    institutionFormErrors: {},
    institutionFormLoading: false,
    showInstitutionForm: false,

    get filteredInstitutionList() {
      const q = this.filterInstituicaoList.toLowerCase()
      let list = q
        ? this.institutionListAll.filter(i =>
            i.sigla.toLowerCase().includes(q) ||
            (i.nome && i.nome.toLowerCase().includes(q)))
        : this.institutionListAll
      return [...list].sort((a, b) => {
        const av = (a[this.institutionSortCol] ?? '').toString().toLowerCase()
        const bv = (b[this.institutionSortCol] ?? '').toString().toLowerCase()
        return this.institutionSortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    },

    get instituicaoListOptions() {
      const q = this.filterInstituicaoList.toLowerCase()
      return this.institutionListAll.filter(i => {
        if (!q) return true
        return i.sigla.toLowerCase().includes(q) || (i.nome && i.nome.toLowerCase().includes(q))
      })
    },

    get filteredParticipantInstOptions() {
      const q = this.participantInstSearch.toLowerCase().trim()
      if (!q) return this.institutionListAll.slice(0, 50)
      return this.institutionListAll.filter(i =>
        i.sigla.toLowerCase().includes(q) || (i.nome && i.nome.toLowerCase().includes(q))
      )
    },

    get showParticipantInstCreateOption() {
      const q = this.participantInstSearch.trim()
      return q.length > 0 && !this.institutionListAll.some(
        i => i.sigla.toLowerCase() === q.toLowerCase()
      )
    },

    get filteredProjectInstOptions() {
      const q = this.projectInstSearch.toLowerCase().trim()
      if (!q) return this.institutionListAll.slice(0, 50)
      return this.institutionListAll.filter(i =>
        i.sigla.toLowerCase().includes(q) || (i.nome && i.nome.toLowerCase().includes(q))
      )
    },

    get showProjectInstCreateOption() {
      const q = this.projectInstSearch.trim()
      return q.length > 0 && !this.institutionListAll.some(
        i => i.sigla.toLowerCase() === q.toLowerCase()
      )
    },

    get filteredProjectList() {
      const status = this.projectStatusFilter
      const q = this.filterProjInstituicao.toLowerCase()
      let list = q
        ? this.allProjects.filter(p => p.instituicao && p.instituicao.toLowerCase().includes(q))
        : this.allProjects
      if (status) {
        list = list.filter(p => {
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

    // Meeting info modal (read-only "Ficha da Reunião")
    showMeetingInfo: false,
    meetingInfo: null,
    meetingInfoLoading: false,

    // Toast
    toast: { show: false, message: '', error: false },

    autoSaveStatus: '',   // '', 'saving', 'saved', 'error'
    autoSaveTimer: null,

    init() {
      if (sessionStorage.getItem('pin_ok') === '1') {
        this.authenticated = true
        this.loadMeetings()
        this.loadParticipants()
        this.loadProjects()
        this.loadInstitutionList()
      }
      this.$watch('activeTab', (tab) => {
        if (tab === 'projects') this.loadProjects()
        if (tab === 'participants') this.loadParticipantList()
        if (tab === 'institutions') this.loadInstitutionList()
      })
      requestAnimationFrame(() => {
        if (!_quillEditor) {
          _quillEditor = new Quill('#quill-editor', {
            theme: 'snow',
            placeholder: 'Digite as notas da reunião...',
            modules: {
              toolbar: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['clean']
              ],
              clipboard: { matchVisual: false }
            }
          })
          _quillEditor.on('text-change', (delta, old, source) => {
            if (source !== 'user' || !this.editingId) return
            clearTimeout(this.autoSaveTimer)
            this.autoSaveStatus = 'saving'
            this.autoSaveTimer = setTimeout(() => this.autoSaveNotas(), 2000)
          })

          // Quill v2's clipboard module can silently fail in certain environments.
          // This capture-phase handler takes over paste completely and inserts
          // content directly via the stable insertText / updateContents API.
          _quillEditor.root.addEventListener('paste', (e) => {
            e.preventDefault()
            e.stopImmediatePropagation()
            const clipboard = e.clipboardData || window.clipboardData
            if (!clipboard) return
            const html = clipboard.getData('text/html')
            const text = clipboard.getData('text/plain') || ''
            const range = _quillEditor.getSelection(true)
                       || { index: _quillEditor.getLength() - 1, length: 0 }
            if (range.length) {
              _quillEditor.deleteText(range.index, range.length, 'user')
            }
            if (html) {
              try {
                const delta = _quillEditor.clipboard.convert({ html, text })
                _quillEditor.updateContents(
                  { ops: [{ retain: range.index }, ...delta.ops] }, 'user'
                )
                _quillEditor.setSelection(range.index + delta.length() - 1, 0, 'user')
                return
              } catch (e) { console.error('Paste HTML failed:', e) }
            }
            // Plain-text fallback
            if (text) {
              _quillEditor.insertText(range.index, text, 'user')
              _quillEditor.setSelection(range.index + text.length, 0, 'user')
            }
          }, true)
        }
        if (!_quillViewer) {
          _quillViewer = new Quill('#quill-viewer', {
            theme: 'bubble',
            readOnly: true,
            modules: { toolbar: false }
          })
        }
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
          this.loadParticipants()
          this.loadProjects()
          this.loadInstitutionList()
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
          part_ids: Array.from(this.filterPartIds).join(','),
          proj_ids: Array.from(this.filterProjIds).join(','),
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

    // --- Meetings list filter methods ---
    toggleFilterPart(id) {
      const s = new Set(this.filterPartIds)
      s.has(id) ? s.delete(id) : s.add(id)
      this.filterPartIds = s
      this.filterPartSearch = ''
      this.showFilterPartDropdown = false
      this.currentPage = 1
      this.loadMeetings()
    },

    removeFilterPart(id) {
      const s = new Set(this.filterPartIds)
      s.delete(id)
      this.filterPartIds = s
      this.currentPage = 1
      this.loadMeetings()
    },

    getSelectedFilterParts() {
      return this.allParticipants.filter(p => this.filterPartIds.has(p.id))
    },

    toggleFilterProj(id) {
      const s = new Set(this.filterProjIds)
      s.has(id) ? s.delete(id) : s.add(id)
      this.filterProjIds = s
      this.filterProjSearch = ''
      this.showFilterProjDropdown = false
      this.currentPage = 1
      this.loadMeetings()
    },

    removeFilterProj(id) {
      const s = new Set(this.filterProjIds)
      s.delete(id)
      this.filterProjIds = s
      this.currentPage = 1
      this.loadMeetings()
    },

    getSelectedFilterProjs() {
      return this.allProjects.filter(pr => this.filterProjIds.has(pr.id))
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

    async loadMeetingPautas(id) {
      try {
        const res = await fetch(`/api/meetings/${id}`)
        if (!res.ok) return
        const data = await res.json()
        this.pautas = (data.pautas || []).map(p => ({ ...p, editando: false }))
      } catch {
        this.pautas = []
      }
    },

    addPauta() {
      const texto = this.novaPauta.trim()
      if (!texto) return
      this.pautas.push({ texto, ordem: this.pautas.length, editando: false })
      this.novaPauta = ''
    },

    removePauta(index) {
      this.pautas.splice(index, 1)
      this.pautas.forEach((p, i) => { p.ordem = i })
    },

    toggleEditPauta(index) {
      this.pautas[index].editando = !this.pautas[index].editando
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
      this.pautas = []
      this.novaPauta = ''
      this.showForm = true
      requestAnimationFrame(() => {
        if (_quillEditor) _quillEditor.setContents([{ insert: '\n' }])
      })
      await this.loadParticipants()
      await this.loadProjects()
    },

    async editMeeting(m) {
      this.editingId = m.id
      const res = await fetch(`/api/meetings/${m.id}`)
      const full = res.ok ? await res.json() : m
      const dt = new Date(full.data_hora)
      const pad = n => String(n).padStart(2, '0')
      this.formData = {
        data: `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`,
        hora: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
        tipo: full.tipo
      }
      this.formErrors = {}
      this.participantSearch = ''
      this.showParticipantDropdown = false
      this.projectSearchQuery = ''
      this.showProjectDropdown = false
      this.pautas = []
      this.novaPauta = ''
      this.showForm = true
      requestAnimationFrame(() => {
        if (_quillEditor) this.loadNotasIntoQuill(_quillEditor, full.notas)
      })
      await this.loadParticipants()
      await this.loadProjects()
      this.selectedParticipantIds = new Set(full.participante_ids || [])
      this.selectedProjectIds = new Set(full.projeto_ids || [])
      this.pautas = (full.pautas || []).map(p => ({ ...p, editando: false }))
    },

    cancelForm() {
      clearTimeout(this.autoSaveTimer)
      this.autoSaveStatus = ''
      this.showForm = false
      this.editingId = null
      this.formErrors = {}
      this.selectedParticipantIds = new Set()
      this.participantSearch = ''
      this.showParticipantDropdown = false
      this.selectedProjectIds = new Set()
      this.projectSearchQuery = ''
      this.showProjectDropdown = false
      this.pautas = []
      this.novaPauta = ''
    },

    cleanDelta(delta) {
      if (!delta || !Array.isArray(delta.ops)) return delta
      return {
        ops: delta.ops.map(op =>
          typeof op.insert === 'string'
            ? { ...op, insert: op.insert.replace(/\u001f/g, '') }
            : op
        )
      }
    },

    loadNotasIntoQuill(quill, notas) {
      if (!notas) {
        quill.setContents([{ insert: '\n' }])
        return
      }
      try {
        const parsed = JSON.parse(notas)
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.ops)) {
          quill.setContents(this.cleanDelta(parsed))
          return
        }
      } catch (e) { console.error('loadNotasIntoQuill parse error:', e) }
      // Fallback: show as plain text (should not occur after DB migration)
      quill.setText(typeof notas === 'string' ? notas : '')
    },

    async autoSaveNotas() {
      if (!this.editingId || !_quillEditor) return
      const delta = this.cleanDelta(_quillEditor.getContents())
      const text = delta.ops.map(op => typeof op.insert === 'string' ? op.insert : '').join('').trim()
      const notas = text ? JSON.stringify(delta) : null
      try {
        const res = await fetch(`/api/meetings/${this.editingId}/notas`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notas })
        })
        this.autoSaveStatus = res.ok ? 'saved' : 'error'
      } catch {
        this.autoSaveStatus = 'error'
      }
    },

    async saveMeeting() {
      this.formErrors = {}
      const data_hora = this.formData.data && this.formData.hora
        ? `${this.formData.data}T${this.formData.hora}:00`
        : null
      const notasPayload = (() => {
        if (!_quillEditor) return null
        const delta = this.cleanDelta(_quillEditor.getContents())
        const text = delta.ops.map(op => typeof op.insert === 'string' ? op.insert : '').join('').trim()
        if (!text) return null
        return JSON.stringify(delta)
      })()
      const payload = {
        data_hora,
        tipo: this.formData.tipo,
        notas: notasPayload,
        participante_ids: Array.from(this.selectedParticipantIds),
        projeto_ids: Array.from(this.selectedProjectIds),
        pautas: this.pautas.map(p => p.texto)
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

    async openMeetingInfo(id) {
      this.meetingInfoLoading = true
      this.showMeetingInfo = true
      try {
        const res = await fetch(`/api/meetings/${id}`)
        if (!res.ok) throw new Error()
        this.meetingInfo = await res.json()
        requestAnimationFrame(() => {
          if (_quillViewer) this.loadNotasIntoQuill(_quillViewer, this.meetingInfo.notas)
        })
      } catch {
        this.showToast('Erro ao carregar reunião.', true)
        this.showMeetingInfo = false
      } finally {
        this.meetingInfoLoading = false
      }
    },

    closeMeetingInfo() {
      this.showMeetingInfo = false
      this.meetingInfo = null
    },

    printMeetingInfo() {
      window.print()
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
      this.participantInstSearch = p.instituicao ?? ''
      this.showParticipantForm = true
    },

    cancelParticipantForm() {
      this.showParticipantForm = false
      this.editingParticipant = null
      this.participantFormErrors = {}
      this.participantInstSearch = ''
      this.showParticipantInstDropdown = false
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
      this.projectInstSearch = p.instituicao ?? ''
      this.showProjectForm = true
    },

    cancelProjectForm() {
      this.showProjectForm = false
      this.editingProject = null
      this.projectFormErrors = {}
      this.projectInstSearch = ''
      this.showProjectInstDropdown = false
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

    // --- Institutions list methods ---
    async loadInstitutionList() {
      if (this.institutionListLoading) return
      this.institutionListLoading = true
      try {
        const res = await fetch('/api/institutions?limit=500')
        const { data } = await res.json()
        this.institutionListAll = data
      } catch {
        this.showToast('Erro ao carregar instituições.', true)
      } finally {
        this.institutionListLoading = false
      }
    },

    setSortInstitution(col) {
      if (this.institutionSortCol === col) {
        this.institutionSortOrder = this.institutionSortOrder === 'asc' ? 'desc' : 'asc'
      } else {
        this.institutionSortCol = col
        this.institutionSortOrder = 'asc'
      }
    },

    openEditInstitution(inst) {
      this.editingInstitution = inst.id
      this.institutionForm = { sigla: inst.sigla, nome: inst.nome ?? '' }
      this.institutionFormErrors = {}
      this.showInstitutionForm = true
    },

    cancelInstitutionForm() {
      this.showInstitutionForm = false
      this.editingInstitution = null
      this.institutionFormErrors = {}
    },

    async saveInstitution() {
      this.institutionFormErrors = {}
      if (!this.institutionForm.sigla.trim()) {
        this.institutionFormErrors.sigla = 'Obrigatório'
        return
      }
      this.institutionFormLoading = true
      try {
        const url = this.editingInstitution
          ? `/api/institutions/${this.editingInstitution}`
          : '/api/institutions'
        const method = this.editingInstitution ? 'PUT' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.institutionForm)
        })
        const body = await res.json()
        if (!res.ok) { this.showToast(body.error || 'Erro ao salvar', true); return }
        if (this.editingInstitution) {
          const idx = this.institutionListAll.findIndex(i => i.id === this.editingInstitution)
          if (idx >= 0) this.institutionListAll[idx] = body
        } else {
          this.institutionListAll.push(body)
        }
        this.cancelInstitutionForm()
        this.showToast(this.editingInstitution ? 'Instituição atualizada!' : 'Instituição criada!')
      } catch {
        this.showToast('Erro de conexão.', true)
      } finally {
        this.institutionFormLoading = false
      }
    },

    async deleteInstitution(id, sigla) {
      if (!confirm(`Confirma a exclusão da instituição "${sigla}"?`)) return
      try {
        const res = await fetch(`/api/institutions/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error()
        this.institutionListAll = this.institutionListAll.filter(i => i.id !== id)
        this.showToast('Instituição excluída.')
      } catch {
        this.showToast('Erro ao excluir instituição.', true)
      }
    },

    openNewInstitution() {
      this.editingInstitution = null
      this.institutionForm = { sigla: '', nome: '' }
      this.institutionFormErrors = {}
      this.showInstitutionForm = true
    },

    selectParticipantInst(sigla) {
      this.participantForm.instituicao = sigla
      this.participantInstSearch = sigla
      this.showParticipantInstDropdown = false
    },

    clearParticipantInst() {
      this.participantForm.instituicao = ''
      this.participantInstSearch = ''
      this.showParticipantInstDropdown = false
    },

    async createAndSelectParticipantInst(sigla) {
      try {
        const res = await fetch('/api/institutions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sigla })
        })
        const body = await res.json()
        if (!res.ok) { this.showToast(body.error || 'Erro ao criar instituição', true); return }
        this.institutionListAll.push(body)
        this.selectParticipantInst(body.sigla)
        this.showToast('Instituição criada!')
      } catch {
        this.showToast('Erro de conexão.', true)
      }
    },

    selectProjectInst(sigla) {
      this.projectForm.instituicao = sigla
      this.projectInstSearch = sigla
      this.showProjectInstDropdown = false
    },

    clearProjectInst() {
      this.projectForm.instituicao = ''
      this.projectInstSearch = ''
      this.showProjectInstDropdown = false
    },

    async createAndSelectProjectInst(sigla) {
      try {
        const res = await fetch('/api/institutions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sigla })
        })
        const body = await res.json()
        if (!res.ok) { this.showToast(body.error || 'Erro ao criar instituição', true); return }
        this.institutionListAll.push(body)
        this.selectProjectInst(body.sigla)
        this.showToast('Instituição criada!')
      } catch {
        this.showToast('Erro de conexão.', true)
      }
    },

    showToast(message, error = false) {
      this.toast = { show: true, message, error }
      setTimeout(() => { this.toast.show = false }, 3000)
    }
  }
}
