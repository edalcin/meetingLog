<script>
  import { onMount, onDestroy } from 'svelte'
  import { api } from '../api.js'
  import RichEditor from './RichEditor.svelte'

  let { meeting = null, onClose, onSaved } = $props()

  // ── Derived ──────────────────────────────────────────────────────────────
  // $state (not $derived) so handleSubmit can flip to edit-mode after create.
  let editingId = $state(meeting?.id ?? null)

  // ── Form fields ──────────────────────────────────────────────────────────
  let dataHora = $state('')
  let tipo = $state('Presencial')
  let notasHtml = $state('')

  // Pautas: [{texto}]
  let pautas = $state([])
  let novaPauta = $state('')

  // Links: [{nome, url}]
  let links = $state([])

  // Participants
  let allParticipants = $state([])
  let selectedParticipantIds = $state([])
  let partSearch = $state('')
  let showPartDropdown = $state(false)

  // Projects
  let allProjects = $state([])
  let selectedProjectIds = $state([])
  let projSearch = $state('')
  let showProjDropdown = $state(false)

  // UI state
  let saving = $state(false)
  let error = $state('')
  let rejectedUrls = $state([])

  // Files — pending upload
  let pendingFiles = $state([])
  let fileInputRef = $state(null)
  let fileError = $state('')

  // RichEditor ref
  let editorRef = $state(null)

  // Autosave
  let autosaveTimer
  let autosaveDelayMs = $state(5000)
  let settingsLoaded = $state(false)
  let autoStatus = $state('') // '' | 'saving' | 'saved' | 'error'
  let lastSavedSig = $state('')

  const TIPOS = ['Presencial', 'Remota', 'Hibrida', 'Híbrida', 'Telefone']

  // ── Derived filtered lists ────────────────────────────────────────────────
  let filteredParticipants = $derived(
    allParticipants.filter(p =>
      p.ativo !== false &&
      !selectedParticipantIds.includes(p.id) &&
      (p.nome.toLowerCase().includes(partSearch.toLowerCase()) ||
       (p.instituicao ?? '').toLowerCase().includes(partSearch.toLowerCase()))
    ).slice(0, 10)
  )

  let filteredProjects = $derived(
    allProjects.filter(p =>
      !selectedProjectIds.includes(p.id) &&
      p.nome.toLowerCase().includes(projSearch.toLowerCase())
    ).slice(0, 10)
  )

  let showCreateParticipant = $derived(
    partSearch.trim().length >= 2 &&
    !allParticipants.some(p => p.nome.toLowerCase() === partSearch.trim().toLowerCase())
  )

  let showCreateProject = $derived(
    projSearch.trim().length >= 2 &&
    !allProjects.some(p => p.nome.toLowerCase() === projSearch.trim().toLowerCase())
  )

  // ── Init ─────────────────────────────────────────────────────────────────
  onMount(async () => {
    // Fetch catalogs + (if editing) full meeting detail in parallel.
    // List rows don't carry notas/pautas/links — must fetch the detail endpoint.
    const fetches = [
      api.get('/api/participants?limit=500').catch(() => ({ data: [] })),
      api.get('/api/projects?limit=500').catch(() => ({ data: [] })),
      meeting?.id ? api.get(`/api/meetings/${meeting.id}`) : Promise.resolve(null),
      api.get('/api/settings').catch(() => ({ autosave_interval_seconds: 5 })),
    ]
    const [parts, projs, detail, settings] = await Promise.all(fetches)
    autosaveDelayMs = (settings?.autosave_interval_seconds ?? 5) * 1000
    allParticipants = parts.data ?? []
    allProjects = projs.data ?? []

    const src = detail ?? meeting
    if (src) {
      dataHora = src.data_hora ? toDatetimeLocal(src.data_hora) : ''
      tipo = src.tipo ?? 'Presencial'
      notasHtml = src.notas ?? ''

      if (Array.isArray(src.participantes)) {
        selectedParticipantIds = src.participantes.map(p => p.id)
      } else if (Array.isArray(src.participante_ids)) {
        selectedParticipantIds = [...src.participante_ids]
      }

      if (Array.isArray(src.projetos)) {
        selectedProjectIds = src.projetos.map(p => p.id)
      } else if (Array.isArray(src.projeto_ids)) {
        selectedProjectIds = [...src.projeto_ids]
      }

      if (Array.isArray(src.pautas)) {
        pautas = src.pautas.map(p => ({ texto: p.texto ?? p }))
      }

      if (Array.isArray(src.links)) {
        links = src.links.map(l => ({ nome: l.nome ?? '', url: l.url ?? '' }))
      }

      // TipTap initializes with content at mount time (empty string).
      // Call setContent explicitly to load the fetched HTML into the editor.
      editorRef?.setContent(notasHtml)
      lastSavedSig = currentSig()
      settingsLoaded = true
    }
  })

  onDestroy(() => {
    clearTimeout(autosaveTimer)
  })

  // ── Autosave ──────────────────────────────────────────────────────────────
  // Strategy: for EXISTING meetings, only PATCH the notes field — never touch
  // participants/projects/pautas/links via autosave (prevents silent data loss
  // if state is incomplete at fire time). For NEW meetings, POST once to create
  // a draft when the form first becomes valid, then PATCH notes thereafter.
  function currentSig() {
    return JSON.stringify({ notasHtml })
  }

  // Separate sig for "form has changed enough to create a draft" (new meetings).
  function draftSig() {
    return JSON.stringify({ dataHora, tipo, pi: selectedParticipantIds, pj: selectedProjectIds })
  }

  let lastDraftSig = $state('')

  $effect(() => {
    const sig = currentSig()
    if (!settingsLoaded || sig === lastSavedSig) return
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(autosave, autosaveDelayMs)
  })

  async function autosave() {
    if (validate()) return
    const notas = editorRef?.getHTML() ?? notasHtml
    autoStatus = 'saving'
    try {
      if (!editingId) {
        // New meeting: create draft with full payload (only once when valid)
        const ds = draftSig()
        if (ds === lastDraftSig) {
          // Form structure unchanged since last draft — only PATCH notes if we have an id
          autoStatus = ''
          return
        }
        const payload = {
          data_hora: dataHora,
          tipo,
          notas,
          participante_ids: selectedParticipantIds,
          projeto_ids: selectedProjectIds,
          pautas: pautas.map(p => p.texto),
          links: links.filter(l => l.url.trim())
            .map((l, i) => ({ nome: l.nome.trim() || null, url: l.url.trim(), ordem: i + 1 })),
        }
        const result = await api.post('/api/meetings', payload)
        editingId = result?.id ?? null
        if (result?.rejected_urls?.length) rejectedUrls = result.rejected_urls
        lastDraftSig = ds
      } else {
        // Existing meeting: PATCH notes only — never touch participants/projects/etc.
        await api.patch(`/api/meetings/${editingId}/notas`, { notas })
      }
      lastSavedSig = currentSig()
      autoStatus = 'saved'
    } catch {
      autoStatus = 'error'
    }
  }

  async function handleClose() {
    clearTimeout(autosaveTimer)
    if (settingsLoaded && currentSig() !== lastSavedSig) await autosave()
    onClose?.()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function toDatetimeLocal(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d)) return iso.slice(0, 16)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // ── Participants ──────────────────────────────────────────────────────────
  function addParticipant(p) {
    selectedParticipantIds = [...selectedParticipantIds, p.id]
    partSearch = ''
    showPartDropdown = false
  }

  function removeParticipant(id) {
    selectedParticipantIds = selectedParticipantIds.filter(x => x !== id)
  }

  async function createParticipant() {
    const nome = partSearch.trim()
    if (!nome) return
    try {
      const created = await api.post('/api/participants', { nome, ativo: true })
      allParticipants = [...allParticipants, created]
      selectedParticipantIds = [...selectedParticipantIds, created.id]
      partSearch = ''
      showPartDropdown = false
    } catch (e) {
      error = `Erro ao criar participante: ${e.message}`
    }
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  function addProject(p) {
    selectedProjectIds = [...selectedProjectIds, p.id]
    projSearch = ''
    showProjDropdown = false
  }

  async function createProject() {
    const nome = projSearch.trim()
    if (!nome) return
    try {
      const created = await api.post('/api/projects', { nome, ativo: true })
      allProjects = [...allProjects, created]
      selectedProjectIds = [...selectedProjectIds, created.id]
      projSearch = ''
      showProjDropdown = false
    } catch (e) {
      error = `Erro ao criar projeto: ${e.message}`
    }
  }

  function removeProject(id) {
    selectedProjectIds = selectedProjectIds.filter(x => x !== id)
  }

  // ── Pautas ────────────────────────────────────────────────────────────────
  function addPauta() {
    const texto = novaPauta.trim()
    if (!texto) return
    pautas = [...pautas, { texto }]
    novaPauta = ''
  }

  function removePauta(i) {
    pautas = pautas.filter((_, idx) => idx !== i)
  }

  function movePauta(i, dir) {
    const j = i + dir
    if (j < 0 || j >= pautas.length) return
    const arr = [...pautas]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    pautas = arr
  }

  // ── Links ─────────────────────────────────────────────────────────────────
  function addLink() {
    links = [...links, { nome: '', url: '' }]
  }

  function removeLink(i) {
    links = links.filter((_, idx) => idx !== i)
  }

  // ── Files ─────────────────────────────────────────────────────────────────
  function handleFileSelect() {
    if (!fileInputRef?.files?.length) return
    pendingFiles = [...pendingFiles, ...Array.from(fileInputRef.files)]
    fileInputRef.value = ''
  }

  function removePendingFile(i) {
    pendingFiles = pendingFiles.filter((_, idx) => idx !== i)
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate() {
    if (!dataHora) return 'Data/Hora é obrigatória.'
    if (!tipo || !TIPOS.includes(tipo)) return 'Tipo de reunião inválido.'
    if (selectedParticipantIds.length === 0) return 'Selecione ao menos um participante.'
    for (const l of links) {
      if (l.url && !l.url.startsWith('http')) return `URL inválida: "${l.url}". Use http:// ou https://.`
    }
    return null
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    error = ''
    fileError = ''
    rejectedUrls = []

    const validationError = validate()
    if (validationError) { error = validationError; return }

    saving = true
    try {
      const notas = editorRef?.getHTML() ?? notasHtml

      const payload = {
        data_hora: dataHora,
        tipo,
        notas,
        participante_ids: selectedParticipantIds,
        projeto_ids: selectedProjectIds,
        pautas: pautas.map(p => p.texto),
        links: links
          .filter(l => l.url.trim())
          .map((l, i) => ({ nome: l.nome.trim() || null, url: l.url.trim(), ordem: i + 1 })),
      }

      let result
      if (editingId) {
        result = await api.put(`/api/meetings/${editingId}`, payload)
      } else {
        result = await api.post('/api/meetings', payload)
        // Pin the new ID so a retry uploads files without duplicating the meeting.
        editingId = result?.id ?? null
      }

      if (result?.rejected_urls?.length) {
        rejectedUrls = result.rejected_urls
      }

      // Upload pending files one-by-one (backend accepts one per request).
      if (pendingFiles.length > 0 && editingId) {
        const failed = []
        for (const f of pendingFiles) {
          const fd = new FormData()
          fd.append('file', f)
          try {
            await api.upload(`/api/meetings/${editingId}/files`, fd)
          } catch {
            failed.push(f)
          }
        }
        pendingFiles = failed
        if (failed.length > 0) {
          fileError = `${failed.length} arquivo(s) não enviado(s). Verifique e tente novamente.`
          saving = false
          return  // Keep dialog open for retry (meeting already saved).
        }
      }

      onSaved?.()
    } catch (e) {
      error = e.message
    } finally {
      saving = false
    }
  }

  function handleKeydownPauta(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPauta()
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) handleClose()
  }
</script>

<!-- Overlay -->
<div
  class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
  onclick={handleOverlayClick}
  role="dialog"
  aria-modal="true"
>
  <!-- Modal card -->
  <div class="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-[96vw] h-[92vh]">

    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
      <h2 class="text-lg font-semibold text-gray-900">
        {editingId ? 'Editar Reunião' : 'Nova Reunião'}
      </h2>
      <button
        type="button"
        onclick={handleClose}
        class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Body -->
    <form onsubmit={handleSubmit} class="flex flex-col flex-1 overflow-hidden">
      <div class="flex flex-col flex-1 overflow-hidden px-6 py-5">

        <!-- Rejected URLs warning -->
        {#if rejectedUrls.length > 0}
          <div class="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
            Alguns links foram rejeitados (URLs inválidas): {rejectedUrls.join(', ')}
          </div>
        {/if}

        <!-- Error -->
        {#if error}
          <div class="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
        {/if}

        <!-- Two-column grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">

          <!-- LEFT COLUMN -->
          <div class="flex flex-col gap-5 overflow-y-auto pr-1">

            <!-- Data/Hora -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Data e Hora <span class="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                bind:value={dataHora}
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <!-- Tipo -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span class="text-red-500">*</span>
              </label>
              <select
                bind:value={tipo}
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {#each TIPOS as t}
                  <option value={t}>{t}</option>
                {/each}
              </select>
            </div>

            <!-- Pautas -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Pautas</label>
              <div class="space-y-1 mb-2">
                {#each pautas as pauta, i}
                  <div class="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                    <span class="text-xs text-gray-400 font-mono w-5 text-center">{i + 1}</span>
                    <span class="flex-1 text-sm text-gray-800">{pauta.texto}</span>
                    <button
                      type="button"
                      onclick={() => movePauta(i, -1)}
                      disabled={i === 0}
                      title="Mover para cima"
                      class="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded"
                    >↑</button>
                    <button
                      type="button"
                      onclick={() => movePauta(i, 1)}
                      disabled={i === pautas.length - 1}
                      title="Mover para baixo"
                      class="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded"
                    >↓</button>
                    <button
                      type="button"
                      onclick={() => removePauta(i)}
                      title="Remover"
                      class="p-0.5 text-gray-400 hover:text-red-600 rounded ml-1"
                    >×</button>
                  </div>
                {/each}
              </div>
              <div class="flex gap-2">
                <input
                  type="text"
                  bind:value={novaPauta}
                  onkeydown={handleKeydownPauta}
                  placeholder="Nova pauta..."
                  class="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onclick={addPauta}
                  class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <!-- Links -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Links</label>
              <div class="space-y-2 mb-2">
                {#each links as link, i}
                  <div class="flex gap-2 items-center">
                    <input
                      type="text"
                      bind:value={link.nome}
                      placeholder="Nome (opcional)"
                      class="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="url"
                      bind:value={link.url}
                      placeholder="https://..."
                      class="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onclick={() => removeLink(i)}
                      class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >×</button>
                  </div>
                {/each}
              </div>
              <button
                type="button"
                onclick={addLink}
                class="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Adicionar link
              </button>
            </div>

            <!-- Arquivos -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Arquivos</label>

              <!-- Pending files list -->
              {#if pendingFiles.length > 0}
                <div class="space-y-1 mb-2">
                  {#each pendingFiles as file, i}
                    <div class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                      <span class="text-xs font-medium text-gray-500 uppercase w-10 shrink-0">
                        {file.name.split('.').pop()}
                      </span>
                      <span class="flex-1 text-sm text-gray-800 truncate" title={file.name}>{file.name}</span>
                      <button
                        type="button"
                        onclick={() => removePendingFile(i)}
                        title="Remover"
                        class="p-0.5 text-gray-400 hover:text-red-600 rounded shrink-0"
                      >×</button>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Hidden file input -->
              <input
                type="file"
                bind:this={fileInputRef}
                accept="image/png,image/jpeg,application/pdf"
                multiple
                class="hidden"
                onchange={handleFileSelect}
              />

              <button
                type="button"
                onclick={() => fileInputRef?.click()}
                class="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Adicionar arquivo(s)
              </button>

              {#if fileError}
                <p class="mt-1 text-xs text-red-600">{fileError}</p>
              {/if}
            </div>

          </div>

          <!-- RIGHT COLUMN -->
          <div class="flex flex-col gap-5 min-h-0">

            <!-- Participantes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Participantes <span class="text-red-500">*</span>
              </label>

              <!-- Selected chips -->
              {#if selectedParticipantIds.length > 0}
                <div class="flex flex-wrap gap-1 mb-2">
                  {#each selectedParticipantIds as pid}
                    {@const p = allParticipants.find(x => x.id === pid)}
                    {#if p}
                      <span class="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        {p.nome}
                        {#if p.instituicao}
                          <span class="text-blue-500">· {p.instituicao}</span>
                        {/if}
                        <button
                          type="button"
                          onclick={() => removeParticipant(pid)}
                          class="ml-0.5 hover:text-blue-600 font-bold"
                        >×</button>
                      </span>
                    {/if}
                  {/each}
                </div>
              {/if}

              <!-- Search input + dropdown -->
              <div class="relative">
                <input
                  type="text"
                  bind:value={partSearch}
                  onfocus={() => showPartDropdown = true}
                  onblur={() => setTimeout(() => showPartDropdown = false, 180)}
                  placeholder="Buscar participante..."
                  class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {#if showPartDropdown && (filteredParticipants.length > 0 || showCreateParticipant)}
                  <div class="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {#each filteredParticipants as p}
                      <button
                        type="button"
                        onmousedown={() => addParticipant(p)}
                        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span>{p.nome}</span>
                        {#if p.instituicao}
                          <span class="text-xs text-gray-400">{p.instituicao}</span>
                        {/if}
                      </button>
                    {/each}
                    {#if showCreateParticipant}
                      <button
                        type="button"
                        onmousedown={createParticipant}
                        class="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium"
                      >
                        + Criar participante "{partSearch.trim()}"
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <!-- Projetos -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Projetos</label>

              {#if selectedProjectIds.length > 0}
                <div class="flex flex-wrap gap-1 mb-2">
                  {#each selectedProjectIds as pid}
                    {@const p = allProjects.find(x => x.id === pid)}
                    {#if p}
                      <span class="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                        {p.nome}
                        <button
                          type="button"
                          onclick={() => removeProject(pid)}
                          class="ml-0.5 hover:text-purple-600 font-bold"
                        >×</button>
                      </span>
                    {/if}
                  {/each}
                </div>
              {/if}

              <div class="relative">
                <input
                  type="text"
                  bind:value={projSearch}
                  onfocus={() => showProjDropdown = true}
                  onblur={() => setTimeout(() => showProjDropdown = false, 180)}
                  placeholder="Buscar projeto..."
                  class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {#if showProjDropdown && (filteredProjects.length > 0 || showCreateProject)}
                  <div class="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {#each filteredProjects as p}
                      <button
                        type="button"
                        onmousedown={() => addProject(p)}
                        class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        {p.nome}
                      </button>
                    {/each}
                    {#if showCreateProject}
                      <button
                        type="button"
                        onmousedown={createProject}
                        class="w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 border-t border-gray-100 font-medium"
                      >
                        + Criar projeto "{projSearch.trim()}"
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <!-- Notas -->
            <div class="flex flex-col flex-1 min-h-0">
              <label class="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <RichEditor
                bind:this={editorRef}
                bind:content={notasHtml}
                editable={true}
                fill={true}
                placeholder="Anotações da reunião..."
              />
              {#if autoStatus === 'saving'}
                <p class="text-xs text-gray-400 mt-1">Salvando...</p>
              {:else if autoStatus === 'saved'}
                <p class="text-xs text-gray-400 mt-1">Salvo automaticamente</p>
              {:else if autoStatus === 'error'}
                <p class="text-xs text-red-400 mt-1">Falha ao salvar — tentando novamente</p>
              {/if}
            </div>

          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-2xl">
        <button
          type="button"
          onclick={handleClose}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          class="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2"
        >
          {#if saving}
            <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
          {/if}
          {editingId ? 'Salvar alterações' : 'Criar reunião'}
        </button>
      </div>
    </form>
  </div>
</div>
