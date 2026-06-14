<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'
  import MeetingFormModal from './MeetingFormModal.svelte'
  import MeetingInfoModal from './MeetingInfoModal.svelte'

  let meetings = $state([])
  let totalCount = $state(0)
  let loading = $state(true)
  let error = $state('')

  // Filters
  let allParticipants = $state([])
  let allProjects = $state([])
  let selectedParticipantIds = $state([])
  let selectedProjectIds = $state([])
  let participantSearch = $state('')
  let projectSearch = $state('')
  let showPartDropdown = $state(false)
  let showProjDropdown = $state(false)

  // Sort/Pagination
  let sortCol = $state('data_hora')
  let sortOrder = $state('desc')
  let page = $state(1)
  const limit = 25

  // Modals
  let showFormModal = $state(false)
  let editingMeeting = $state(null)
  let showInfoModal = $state(false)
  let infoMeetingId = $state(null)

  let totalPages = $derived(Math.ceil(totalCount / limit))

  let filteredParticipants = $derived(
    allParticipants.filter(p =>
      !selectedParticipantIds.includes(p.id) &&
      p.nome.toLowerCase().includes(participantSearch.toLowerCase())
    ).slice(0, 10)
  )

  let filteredProjects = $derived(
    allProjects.filter(p =>
      !selectedProjectIds.includes(p.id) &&
      p.nome.toLowerCase().includes(projectSearch.toLowerCase())
    ).slice(0, 10)
  )

  async function load() {
    loading = true
    error = ''
    try {
      const params = new URLSearchParams({
        sort: sortCol,
        order: sortOrder,
        page: String(page),
        limit: String(limit),
      })
      if (selectedParticipantIds.length) params.set('part_ids', selectedParticipantIds.join(','))
      if (selectedProjectIds.length) params.set('proj_ids', selectedProjectIds.join(','))
      const data = await api.get(`/api/meetings?${params}`)
      meetings = data.items ?? data
      totalCount = data.total ?? data.length
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  }

  onMount(async () => {
    const [parts, projs] = await Promise.all([
      api.get('/api/participants?limit=1000').catch(() => []),
      api.get('/api/projects?limit=1000').catch(() => []),
    ])
    allParticipants = parts.items ?? parts
    allProjects = projs.items ?? projs
    await load()
  })

  function toggleSort(col) {
    if (sortCol === col) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'
    } else {
      sortCol = col
      sortOrder = 'asc'
    }
    page = 1
    load()
  }

  function addParticipant(p) {
    selectedParticipantIds = [...selectedParticipantIds, p.id]
    participantSearch = ''
    showPartDropdown = false
    page = 1
    load()
  }

  function removeParticipant(id) {
    selectedParticipantIds = selectedParticipantIds.filter(x => x !== id)
    page = 1
    load()
  }

  function addProject(p) {
    selectedProjectIds = [...selectedProjectIds, p.id]
    projectSearch = ''
    showProjDropdown = false
    page = 1
    load()
  }

  function removeProject(id) {
    selectedProjectIds = selectedProjectIds.filter(x => x !== id)
    page = 1
    load()
  }

  function formatDate(dt) {
    return new Date(dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  function tipoBadge(tipo) {
    const map = {
      'Presencial': 'bg-green-100 text-green-800',
      'Remota': 'bg-blue-100 text-blue-800',
      'Hibrida': 'bg-purple-100 text-purple-800',
      'Híbrida': 'bg-purple-100 text-purple-800',
      'Telefone': 'bg-orange-100 text-orange-800',
    }
    return map[tipo] ?? 'bg-gray-100 text-gray-800'
  }

  async function deleteMeeting(id) {
    if (!window.confirm('Excluir esta reunião?')) return
    try {
      await api.del(`/api/meetings/${id}`)
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  function openEdit(meeting) {
    editingMeeting = meeting
    showFormModal = true
  }

  function openNew() {
    editingMeeting = null
    showFormModal = true
  }

  function openInfo(id) {
    infoMeetingId = id
    showInfoModal = true
  }

  function sortIcon(col) {
    if (sortCol !== col) return '↕'
    return sortOrder === 'asc' ? '↑' : '↓'
  }
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-semibold text-gray-900">Reuniões</h2>
    <button onclick={openNew} class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      Nova Reunião
    </button>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
    <div class="flex flex-wrap gap-3">
      <!-- Participant filter -->
      <div class="relative flex-1 min-w-48">
        <label class="block text-xs font-medium text-gray-600 mb-1">Filtrar por participante</label>
        <div class="flex flex-wrap gap-1 mb-1">
          {#each selectedParticipantIds as pid}
            {@const p = allParticipants.find(x => x.id === pid)}
            {#if p}
              <span class="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                {p.nome}
                <button onclick={() => removeParticipant(pid)} class="hover:text-blue-600">×</button>
              </span>
            {/if}
          {/each}
        </div>
        <input
          type="text"
          placeholder="Buscar participante..."
          bind:value={participantSearch}
          onfocus={() => showPartDropdown = true}
          onblur={() => setTimeout(() => showPartDropdown = false, 150)}
          class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {#if showPartDropdown && filteredParticipants.length > 0}
          <div class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {#each filteredParticipants as p}
              <button
                type="button"
                onmousedown={() => addParticipant(p)}
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                {p.nome}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Project filter -->
      <div class="relative flex-1 min-w-48">
        <label class="block text-xs font-medium text-gray-600 mb-1">Filtrar por projeto</label>
        <div class="flex flex-wrap gap-1 mb-1">
          {#each selectedProjectIds as pid}
            {@const p = allProjects.find(x => x.id === pid)}
            {#if p}
              <span class="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">
                {p.nome}
                <button onclick={() => removeProject(pid)} class="hover:text-purple-600">×</button>
              </span>
            {/if}
          {/each}
        </div>
        <input
          type="text"
          placeholder="Buscar projeto..."
          bind:value={projectSearch}
          onfocus={() => showProjDropdown = true}
          onblur={() => setTimeout(() => showProjDropdown = false, 150)}
          class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {#if showProjDropdown && filteredProjects.length > 0}
          <div class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {#each filteredProjects as p}
              <button
                type="button"
                onmousedown={() => addProject(p)}
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                {p.nome}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    <p class="text-xs text-gray-500">{totalCount} reunião(ões) encontrada(s)</p>
  </div>

  <!-- Error -->
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
  {/if}

  <!-- Table -->
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    {:else if meetings.length === 0}
      <div class="text-center py-12 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        Nenhuma reunião encontrada
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('data_hora')}>
                Data/Hora {sortIcon('data_hora')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('tipo')}>
                Tipo {sortIcon('tipo')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('participantes_nomes')}>
                Participantes {sortIcon('participantes_nomes')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('projeto_nomes')}>
                Projetos {sortIcon('projeto_nomes')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600">Info</th>
              <th class="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each meetings as m}
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 text-gray-900 whitespace-nowrap">{formatDate(m.data_hora)}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {tipoBadge(m.tipo)}">
                    {m.tipo}
                  </span>
                </td>
                <td class="px-4 py-3 text-gray-700 max-w-xs truncate">
                  {m.participantes_nomes ?? '—'}
                </td>
                <td class="px-4 py-3 text-gray-700 max-w-xs truncate">
                  {m.projeto_nomes ?? '—'}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1">
                    {#if m.has_notas}
                      <span title="Possui notas" class="text-gray-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </span>
                    {/if}
                    {#if m.arquivo_count > 0}
                      <span title="{m.arquivo_count} arquivo(s)" class="text-gray-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                        </svg>
                      </span>
                    {/if}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <button onclick={() => openInfo(m.id)} title="Ver detalhes" class="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </button>
                    <button onclick={() => openEdit(m)} title="Editar" class="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button onclick={() => deleteMeeting(m.id)} title="Excluir" class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <p class="text-sm text-gray-600">Página {page} de {totalPages}</p>
          <div class="flex gap-2">
            <button
              onclick={() => { page--; load() }}
              disabled={page <= 1}
              class="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">
              Anterior
            </button>
            <button
              onclick={() => { page++; load() }}
              disabled={page >= totalPages}
              class="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">
              Próxima
            </button>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if showFormModal}
  <MeetingFormModal
    meeting={editingMeeting}
    onClose={() => showFormModal = false}
    onSaved={() => { showFormModal = false; load() }}
  />
{/if}

{#if showInfoModal}
  <MeetingInfoModal
    meetingId={infoMeetingId}
    onClose={() => showInfoModal = false}
    onEdit={(m) => { showInfoModal = false; openEdit(m) }}
  />
{/if}
