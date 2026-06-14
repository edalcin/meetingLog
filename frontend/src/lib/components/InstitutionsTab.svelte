<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'

  // ── State ────────────────────────────────────────────────────────────
  let allInstitutions = $state([])
  let loading = $state(true)
  let error = $state('')

  // Filters
  let search = $state('')

  // Sort
  let sortCol = $state('sigla')
  let sortOrder = $state('asc')

  // Modals
  let showFormModal = $state(false)
  let editingInstitution = $state(null)
  let showInfoModal = $state(false)
  let infoInstitutionId = $state(null)

  // ── Form modal state ─────────────────────────────────────────────────
  let fSigla = $state('')
  let fNome = $state('')
  let fSaving = $state(false)
  let fError = $state('')

  // ── Info modal state ─────────────────────────────────────────────────
  let infoData = $state(null)
  let infoLoading = $state(false)

  // ── Derived list ─────────────────────────────────────────────────────
  let displayList = $derived((() => {
    let list = allInstitutions
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.sigla.toLowerCase().includes(q) ||
        (i.nome ?? '').toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      const col = sortCol
      if (col === 'participante_count') {
        const diff = (a.participante_count ?? 0) - (b.participante_count ?? 0)
        return sortOrder === 'asc' ? diff : -diff
      }
      if (col === 'projeto_count') {
        const diff = (a.projeto_count ?? 0) - (b.projeto_count ?? 0)
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
      const data = await api.get('/api/institutions?limit=500')
      allInstitutions = data.items ?? data
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  }

  onMount(() => load())

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
  async function deleteInstitution(inst) {
    if (!window.confirm(`Remover instituição "${inst.sigla}"?`)) return
    try {
      await api.del(`/api/institutions/${inst.id}`)
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  // ── Open modals ──────────────────────────────────────────────────────
  function openNew() {
    editingInstitution = null
    fSigla = ''
    fNome = ''
    fError = ''
    showFormModal = true
  }

  function openEdit(inst) {
    editingInstitution = inst
    fSigla = inst.sigla ?? ''
    fNome = inst.nome ?? ''
    fError = ''
    showFormModal = true
  }

  async function openInfo(id) {
    infoInstitutionId = id
    infoData = null
    infoLoading = true
    showInfoModal = true
    try {
      infoData = await api.get(`/api/institutions/${id}`)
    } catch (e) {
      infoData = null
    } finally {
      infoLoading = false
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────
  async function saveInstitution() {
    if (!fSigla.trim()) { fError = 'Sigla é obrigatória.'; return }
    fSaving = true
    fError = ''
    try {
      const body = {
        sigla: fSigla.trim().toUpperCase(),
        nome: fNome.trim() || null,
      }
      if (editingInstitution) {
        await api.put(`/api/institutions/${editingInstitution.id}`, body)
      } else {
        await api.post('/api/institutions', body)
      }
      showFormModal = false
      await load()
    } catch (e) {
      if (e.status === 409) {
        fError = 'Já existe uma instituição com essa sigla.'
      } else {
        fError = e.message
      }
    } finally {
      fSaving = false
    }
  }
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-semibold text-gray-900">Instituições</h2>
    <button onclick={openNew} class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      Nova Instituição
    </button>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
    <div class="flex-1 min-w-48">
      <label class="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
      <input
        type="text"
        placeholder="Sigla ou nome..."
        bind:value={search}
        class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
    <p class="text-xs text-gray-500 self-end pb-1.5">{displayList.length} instituição(ões)</p>
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
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
        Nenhuma instituição encontrada
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('sigla')}>
                Sigla {sortIcon('sigla')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('nome')}>
                Nome {sortIcon('nome')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('participante_count')}>
                Participantes {sortIcon('participante_count')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('projeto_count')}>
                Projetos {sortIcon('projeto_count')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600">Info</th>
              <th class="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each displayList as inst}
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 font-semibold text-gray-900">{inst.sigla}</td>
                <td class="px-4 py-3 text-gray-700">{inst.nome ?? '—'}</td>
                <td class="px-4 py-3">
                  {#if (inst.participante_count ?? 0) > 0}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{inst.participante_count}</span>
                  {:else}
                    <span class="text-gray-400">0</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  {#if (inst.projeto_count ?? 0) > 0}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{inst.projeto_count}</span>
                  {:else}
                    <span class="text-gray-400">0</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <button onclick={() => openInfo(inst.id)} title="Ver detalhes" class="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </button>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <button onclick={() => openEdit(inst)} title="Editar" class="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button onclick={() => deleteInstitution(inst)} title="Excluir" class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">
          {editingInstitution ? 'Editar Instituição' : 'Nova Instituição'}
        </h3>
        <button onclick={() => showFormModal = false} class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-4 space-y-4">
        {#if fError}
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{fError}</div>
        {/if}

        <!-- Sigla -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Sigla <span class="text-red-500">*</span>
            <span class="text-xs text-gray-400 font-normal ml-1">(use letras maiúsculas)</span>
          </label>
          <input
            type="text"
            bind:value={fSigla}
            oninput={(e) => fSigla = e.target.value.toUpperCase()}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            placeholder="Ex: MAPA, IBAMA, ICMBio"
          />
        </div>

        <!-- Nome -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nome completo <span class="text-gray-400 font-normal">(opcional)</span></label>
          <input
            type="text"
            bind:value={fNome}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ministério da Agricultura..."
          />
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
        <button onclick={() => showFormModal = false} class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button
          onclick={saveInstitution}
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
        <h3 class="text-lg font-semibold text-gray-900">Detalhes da Instituição</h3>
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
            <!-- Sigla + Nome -->
            <div>
              <h4 class="text-2xl font-bold text-gray-900">{infoData.sigla}</h4>
              {#if infoData.nome}
                <p class="text-gray-600 mt-0.5">{infoData.nome}</p>
              {/if}
            </div>

            <!-- Participantes -->
            {#if infoData.participantes && infoData.participantes.length > 0}
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Participantes ({infoData.participantes.length})
                </p>
                <ul class="space-y-1">
                  {#each infoData.participantes as p}
                    <li class="flex items-center justify-between text-sm">
                      <span class="text-gray-800">{p.nome}</span>
                      {#if p.cargo}
                        <span class="text-xs text-gray-400 truncate max-w-[180px]">{p.cargo}</span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              </div>
            {:else}
              <p class="text-sm text-gray-400">Nenhum participante vinculado.</p>
            {/if}

            <!-- Projetos -->
            {#if infoData.projetos && infoData.projetos.length > 0}
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Projetos ({infoData.projetos.length})
                </p>
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
