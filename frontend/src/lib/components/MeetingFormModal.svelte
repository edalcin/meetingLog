<script>
  import { onMount, onDestroy } from 'svelte'
  import { api } from '../api.js'
  import RichEditor from './RichEditor.svelte'

  let { meeting = null, onClose, onSaved } = $props()

  // ── Derived ──────────────────────────────────────────────────────────────
  let editingId = $derived(meeting?.id ?? null)

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

  // RichEditor ref
  let editorRef = $state(null)

  // Autosave
  let autosaveTimer

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

  // ── Init ─────────────────────────────────────────────────────────────────
  onMount(async () => {
    const [parts, projs] = await Promise.all([
      api.get('/api/participants?limit=500').catch(() => []),
      api.get('/api/projects?limit=500').catch(() => []),
    ])
    allParticipants = parts.data ?? []
    allProjects = projs.data ?? []

    if (meeting) {
      // Edit mode: pre-populate fields
      dataHora = meeting.data_hora
        ? toDatetimeLocal(meeting.data_hora)
        : ''
      tipo = meeting.tipo ?? 'Presencial'
      notasHtml = meeting.notas ?? ''

      // Participants: meeting may have participantes array or participante_ids
      if (Array.isArray(meeting.participantes)) {
        selectedParticipantIds = meeting.participantes.map(p => p.id)
      } else if (Array.isArray(meeting.participante_ids)) {
        selectedParticipantIds = [...meeting.participante_ids]
      }

      // Projects
      if (Array.isArray(meeting.projetos)) {
        selectedProjectIds = meeting.projetos.map(p => p.id)
      } else if (Array.isArray(meeting.projeto_ids)) {
        selectedProjectIds = [...meeting.projeto_ids]
      }

      // Pautas
      if (Array.isArray(meeting.pautas)) {
        pautas = meeting.pautas.map(p => ({ texto: p.texto ?? p }))
      }

      // Links
      if (Array.isArray(meeting.links)) {
        links = meeting.links.map(l => ({ nome: l.nome ?? '', url: l.url ?? '' }))
      }
    }
  })

  onDestroy(() => {
    clearTimeout(autosaveTimer)
  })

  // ── Autosave notes (edit mode) ────────────────────────────────────────────
  function scheduleAutosave(html) {
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(async () => {
      if (editingId) {
        try { await api.patch(`/api/meetings/${editingId}/notas`, { notas: html }) } catch {}
      }
    }, 1500)
  }

  $effect(() => {
    if (editingId && notasHtml !== undefined) {
      scheduleAutosave(notasHtml)
    }
  })

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
        pautas: pautas.map((p, i) => ({ texto: p.texto, ordem: i + 1 })),
        links: links
          .filter(l => l.url.trim())
          .map((l, i) => ({ nome: l.nome.trim() || null, url: l.url.trim(), ordem: i + 1 })),
      }

      let result
      if (editingId) {
        result = await api.put(`/api/meetings/${editingId}`, payload)
      } else {
        result = await api.post('/api/meetings', payload)
      }

      if (result?.rejected_urls?.length) {
        rejectedUrls = result.rejected_urls
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
    if (e.target === e.currentTarget) onClose?.()
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
        onclick={onClose}
        class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Body -->
    <form onsubmit={handleSubmit} class="flex flex-col flex-1 overflow-hidden">
      <div class="flex-1 overflow-y-auto px-6 py-5">

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
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <!-- LEFT COLUMN -->
          <div class="space-y-5">

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

          </div>

          <!-- RIGHT COLUMN -->
          <div class="space-y-5">

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
                {#if showProjDropdown && filteredProjects.length > 0}
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
                  </div>
                {/if}
              </div>
            </div>

            <!-- Notas -->
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <RichEditor
                bind:this={editorRef}
                bind:content={notasHtml}
                editable={true}
                placeholder="Anotações da reunião..."
              />
              {#if editingId}
                <p class="text-xs text-gray-400 mt-1">Salvo automaticamente</p>
              {/if}
            </div>

          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-2xl">
        <button
          type="button"
          onclick={onClose}
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
