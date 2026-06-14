<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'
  import RichEditor from './RichEditor.svelte'

  // ── State ────────────────────────────────────────────────────────────
  let allParticipants = $state([])
  let allInstitutions = $state([])
  let loading = $state(true)
  let error = $state('')

  // Filters
  let search = $state('')
  let statusFilter = $state('')

  // Sort
  let sortCol = $state('nome')
  let sortOrder = $state('asc')

  // Modals
  let showFormModal = $state(false)
  let editingParticipant = $state(null)
  let showInfoModal = $state(false)
  let infoParticipantId = $state(null)

  // ── Form modal state ─────────────────────────────────────────────────
  let fNome = $state('')
  let fInstituicao = $state('')
  let fLotacao = $state('')
  let fCargo = $state('')
  let fEmail = $state('')
  let fAtivo = $state(true)
  let fNotas = $state('')
  let fSaving = $state(false)
  let fError = $state('')
  let fInstSearch = $state('')
  let fShowInstDrop = $state(false)
  let fInstDropFiltered = $derived(
    allInstitutions
      .filter(i => i.sigla.toLowerCase().includes(fInstSearch.toLowerCase()) || (i.nome ?? '').toLowerCase().includes(fInstSearch.toLowerCase()))
      .slice(0, 10)
  )

  // ── Info modal state ─────────────────────────────────────────────────
  let infoData = $state(null)
  let infoLoading = $state(false)

  // ── Derived list ─────────────────────────────────────────────────────
  let displayList = $derived((() => {
    let list = allParticipants
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        (p.instituicao ?? '').toLowerCase().includes(q) ||
        (p.lotacao ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter === 'ativo') list = list.filter(p => p.ativo)
    if (statusFilter === 'inativo') list = list.filter(p => !p.ativo)
    return [...list].sort((a, b) => {
      const col = sortCol
      if (col === 'reuniao_count') {
        const diff = (a.reuniao_count ?? 0) - (b.reuniao_count ?? 0)
        return sortOrder === 'asc' ? diff : -diff
      }
      const av = (a[col] ?? '').toLowerCase()
      const bv = (b[col] ?? '').toLowerCase()
      return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  })())

  // ── Load ─────────────────────────────────────────────────────────────
  async function load() {
    loading = true
    error = ''
    try {
      const data = await api.get('/api/participants?limit=500')
      allParticipants = data.items ?? data
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  }

  async function loadInstitutions() {
    const insts = await api.get('/api/institutions?limit=500').catch(() => [])
    allInstitutions = insts.items ?? insts
  }

  onMount(async () => {
    const [parts, insts] = await Promise.all([
      api.get('/api/participants?limit=500').catch(() => []),
      api.get('/api/institutions?limit=500').catch(() => []),
    ])
    allParticipants = parts.items ?? parts
    allInstitutions = insts.items ?? insts
    loading = false
  })

  // ── Sort ─────────────────────────────────────────────────────────────
  function toggleSort(col) {
    if (sortCol === col) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'
    } else {
      sortCol = col
      sortOrder = 'asc'
    }
  }

  function sortIcon(col) {
    if (sortCol !== col) return '↕'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  // ── Delete ───────────────────────────────────────────────────────────
  async function deleteParticipant(p) {
    if (!window.confirm(`Remover participante ${p.nome}?`)) return
    try {
      await api.del(`/api/participants/${p.id}`)
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  // ── Open modals ──────────────────────────────────────────────────────
  function openNew() {
    editingParticipant = null
    fNome = ''
    fInstituicao = ''
    fLotacao = ''
    fCargo = ''
    fEmail = ''
    fAtivo = true
    fNotas = ''
    fInstSearch = ''
    fError = ''
    showFormModal = true
  }

  function openEdit(p) {
    editingParticipant = p
    fNome = p.nome ?? ''
    fInstituicao = p.instituicao ?? ''
    fLotacao = p.lotacao ?? ''
    fCargo = p.cargo ?? ''
    fEmail = p.email ?? ''
    fAtivo = p.ativo ?? true
    fNotas = p.notas ?? ''
    fInstSearch = p.instituicao ?? ''
    fError = ''
    showFormModal = true
  }

  async function openInfo(id) {
    infoParticipantId = id
    infoData = null
    infoLoading = true
    showInfoModal = true
    try {
      infoData = await api.get(`/api/participants/${id}`)
    } catch (e) {
      infoData = null
    } finally {
      infoLoading = false
    }
  }

  // ── Form save ────────────────────────────────────────────────────────
  async function saveParticipant() {
    if (!fNome.trim()) { fError = 'Nome é obrigatório.'; return }
    fSaving = true
    fError = ''
    try {
      const body = {
        nome: fNome.trim(),
        instituicao: fInstituicao.trim() || null,
        lotacao: fLotacao.trim() || null,
        cargo: fCargo.trim() || null,
        email: fEmail.trim() || null,
        ativo: fAtivo,
        notas: fNotas || null,
      }
      if (editingParticipant) {
        await api.put(`/api/participants/${editingParticipant.id}`, body)
      } else {
        await api.post('/api/participants', body)
      }
      showFormModal = false
      await load()
    } catch (e) {
      if (e.status === 409) {
        fError = 'Já existe um participante com esse nome.'
      } else {
        fError = e.message
      }
    } finally {
      fSaving = false
    }
  }

  async function createInstitution(sigla) {
    try {
      await api.post('/api/institutions', { sigla: sigla.trim() })
      await loadInstitutions()
      fInstituicao = sigla.trim()
      fInstSearch = sigla.trim()
      fShowInstDrop = false
    } catch (e) {
      // institution may already exist, just set the value
      fInstituicao = sigla.trim()
      fShowInstDrop = false
    }
  }

  function formatDate(dt) {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-semibold text-gray-900">Participantes</h2>
    <button onclick={openNew} class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      Novo Participante
    </button>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
    <div class="flex-1 min-w-48">
      <label class="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
      <input
        type="text"
        placeholder="Nome, instituição, lotação..."
        bind:value={search}
        class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-1">Status</label>
      <select bind:value={statusFilter} class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">Todos</option>
        <option value="ativo">Ativo</option>
        <option value="inativo">Inativo</option>
      </select>
    </div>
    <p class="text-xs text-gray-500 self-end pb-1.5">{displayList.length} participante(s)</p>
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
    {:else if displayList.length === 0}
      <div class="text-center py-12 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        Nenhum participante encontrado
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('nome')}>
                Nome {sortIcon('nome')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('instituicao')}>
                Instituição / Lotação {sortIcon('instituicao')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('cargo')}>
                Cargo {sortIcon('cargo')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('reuniao_count')}>
                Reuniões {sortIcon('reuniao_count')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600">Info</th>
              <th class="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each displayList as p}
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                <td class="px-4 py-3 text-gray-700">
                  <div>{p.instituicao ?? '—'}</div>
                  {#if p.lotacao}
                    <div class="text-xs text-gray-400">{p.lotacao}</div>
                  {/if}
                </td>
                <td class="px-4 py-3 text-gray-700">{p.cargo ?? '—'}</td>
                <td class="px-4 py-3">
                  {#if p.ativo}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Ativo</span>
                  {:else}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Inativo</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  {#if (p.reuniao_count ?? 0) > 0}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{p.reuniao_count}</span>
                  {:else}
                    <span class="text-gray-400">0</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <button onclick={() => openInfo(p.id)} title="Ver detalhes" class="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </button>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <button onclick={() => openEdit(p)} title="Editar" class="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button onclick={() => deleteParticipant(p)} title="Excluir" class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
    {/if}
  </div>
</div>

<!-- ==================== FORM MODAL ==================== -->
{#if showFormModal}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">
          {editingParticipant ? 'Editar Participante' : 'Novo Participante'}
        </h3>
        <button onclick={() => showFormModal = false} class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="overflow-y-auto flex-1 px-6 py-4 space-y-4">
        {#if fError}
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{fError}</div>
        {/if}

        <!-- Nome -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nome <span class="text-red-500">*</span></label>
          <input
            type="text"
            bind:value={fNome}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nome completo"
          />
        </div>

        <!-- Instituição (typeahead) -->
        <div class="relative">
          <label class="block text-sm font-medium text-gray-700 mb-1">Instituição</label>
          <input
            type="text"
            bind:value={fInstSearch}
            oninput={() => { fInstituicao = fInstSearch }}
            onfocus={() => fShowInstDrop = true}
            onblur={() => setTimeout(() => fShowInstDrop = false, 150)}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Sigla da instituição"
          />
          {#if fShowInstDrop && (fInstDropFiltered.length > 0 || fInstSearch.trim())}
            <div class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {#each fInstDropFiltered as inst}
                <button
                  type="button"
                  onmousedown={() => { fInstituicao = inst.sigla; fInstSearch = inst.sigla; fShowInstDrop = false }}
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                  <span class="font-medium">{inst.sigla}</span>{#if inst.nome} — {inst.nome}{/if}
                </button>
              {/each}
              {#if fInstSearch.trim() && !fInstDropFiltered.find(i => i.sigla.toLowerCase() === fInstSearch.trim().toLowerCase())}
                <button
                  type="button"
                  onmousedown={() => createInstitution(fInstSearch.trim())}
                  class="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-blue-700 border-t border-gray-100">
                  + Criar "{fInstSearch.trim()}"
                </button>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Lotação -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Lotação</label>
          <input
            type="text"
            bind:value={fLotacao}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Setor / departamento"
          />
        </div>

        <!-- Cargo -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
          <input
            type="text"
            bind:value={fCargo}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Cargo ou função"
          />
        </div>

        <!-- Email -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
          <input
            type="email"
            bind:value={fEmail}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="email@exemplo.gov.br"
          />
        </div>

        <!-- Ativo -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            onclick={() => fAtivo = !fAtivo}
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {fAtivo ? 'bg-blue-600' : 'bg-gray-200'}">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform {fAtivo ? 'translate-x-6' : 'translate-x-1'}"></span>
          </button>
          <span class="text-sm text-gray-700">Participante ativo</span>
        </div>

        <!-- Notas -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <RichEditor bind:content={fNotas} editable={true} placeholder="Observações sobre o participante..." />
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
        <button onclick={() => showFormModal = false} class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button
          onclick={saveParticipant}
          disabled={fSaving}
          class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
          {fSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ==================== INFO MODAL ==================== -->
{#if showInfoModal}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">Detalhes do Participante</h3>
        <button onclick={() => showInfoModal = false} class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="overflow-y-auto flex-1 px-6 py-4">
        {#if infoLoading}
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        {:else if !infoData}
          <p class="text-gray-500 text-sm">Não foi possível carregar os dados.</p>
        {:else}
          <div class="space-y-4">
            <!-- Nome + Status -->
            <div class="flex items-start justify-between gap-3">
              <h4 class="text-xl font-semibold text-gray-900">{infoData.nome}</h4>
              {#if infoData.ativo}
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 shrink-0">Ativo</span>
              {:else}
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 shrink-0">Inativo</span>
              {/if}
            </div>

            <!-- Dados -->
            <dl class="space-y-2 text-sm">
              {#if infoData.instituicao}
                <div class="flex gap-2">
                  <dt class="text-gray-500 w-24 shrink-0">Instituição</dt>
                  <dd class="text-gray-900">{infoData.instituicao}</dd>
                </div>
              {/if}
              {#if infoData.lotacao}
                <div class="flex gap-2">
                  <dt class="text-gray-500 w-24 shrink-0">Lotação</dt>
                  <dd class="text-gray-900">{infoData.lotacao}</dd>
                </div>
              {/if}
              {#if infoData.cargo}
                <div class="flex gap-2">
                  <dt class="text-gray-500 w-24 shrink-0">Cargo</dt>
                  <dd class="text-gray-900">{infoData.cargo}</dd>
                </div>
              {/if}
              {#if infoData.email}
                <div class="flex gap-2">
                  <dt class="text-gray-500 w-24 shrink-0">E-mail</dt>
                  <dd class="text-gray-900"><a href="mailto:{infoData.email}" class="text-blue-600 hover:underline">{infoData.email}</a></dd>
                </div>
              {/if}
            </dl>

            <!-- Notas -->
            {#if infoData.notas}
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Notas</p>
                <RichEditor content={infoData.notas} editable={false} />
              </div>
            {/if}

            <!-- Projetos -->
            {#if infoData.projetos && infoData.projetos.length > 0}
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Projetos</p>
                <ul class="space-y-1">
                  {#each infoData.projetos as proj}
                    <li class="flex items-center justify-between text-sm">
                      <span class="text-gray-800">{proj.nome}</span>
                      {#if proj.ativo}
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Ativo</span>
                      {:else}
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inativo</span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Reuniões recentes -->
            {#if infoData.reunioes && infoData.reunioes.length > 0}
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Reuniões recentes</p>
                <ul class="space-y-1">
                  {#each infoData.reunioes as r}
                    <li class="flex items-center justify-between text-sm">
                      <span class="text-gray-800">{formatDate(r.data_hora)}</span>
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{r.tipo}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
        {#if infoData}
          <button onclick={() => { showInfoModal = false; openEdit(infoData) }} class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Editar
          </button>
        {/if}
        <button onclick={() => showInfoModal = false} class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          Fechar
        </button>
      </div>
    </div>
  </div>
{/if}
