<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'
  import RichEditor from './RichEditor.svelte'

  // ── State ────────────────────────────────────────────────────────────
  let allProjects = $state([])
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
  let editingProject = $state(null)
  let showInfoModal = $state(false)
  let infoProjectId = $state(null)

  // ── Form modal state ─────────────────────────────────────────────────
  let fNome = $state('')
  let fAtivo = $state(true)
  let fNotas = $state('')
  let fInstIds = $state([])        // selected institution ids
  let fLinks = $state([])          // [{nome:'', url:''}]
  let fInstSearch = $state('')
  let fShowInstDrop = $state(false)
  let fSaving = $state(false)
  let fError = $state('')
  let fDeactivated = $state([])    // from response
  let fRejectedUrls = $state([])   // from response

  let fInstDropFiltered = $derived(
    allInstitutions
      .filter(i =>
        !fInstIds.includes(i.id) &&
        (i.sigla.toLowerCase().includes(fInstSearch.toLowerCase()) ||
         (i.nome ?? '').toLowerCase().includes(fInstSearch.toLowerCase()))
      )
      .slice(0, 10)
  )

  // ── Info modal state ─────────────────────────────────────────────────
  let infoData = $state(null)
  let infoLoading = $state(false)

  // ── Derived list ─────────────────────────────────────────────────────
  let displayList = $derived((() => {
    let list = allProjects
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        (p.instituicao_nomes ?? '').toLowerCase().includes(q)
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
      if (col === 'ativo') {
        const diff = (a.ativo ? 1 : 0) - (b.ativo ? 1 : 0)
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
      const data = await api.get('/api/projects?limit=500')
      allProjects = data.data ?? []
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  }

  async function loadInstitutions() {
    const insts = await api.get('/api/institutions?limit=500').catch(() => [])
    allInstitutions = insts.data ?? []
  }

  onMount(async () => {
    const [projs, insts] = await Promise.all([
      api.get('/api/projects?limit=500').catch(() => []),
      api.get('/api/institutions?limit=500').catch(() => []),
    ])
    allProjects = projs.data ?? []
    allInstitutions = insts.data ?? []
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
  async function deleteProject(p) {
    if (!window.confirm(`Remover projeto "${p.nome}"?`)) return
    try {
      await api.del(`/api/projects/${p.id}`)
      await load()
    } catch (e) {
      alert(e.message)
    }
  }

  // ── Open modals ──────────────────────────────────────────────────────
  function openNew() {
    editingProject = null
    fNome = ''
    fAtivo = true
    fNotas = ''
    fInstIds = []
    fLinks = []
    fInstSearch = ''
    fError = ''
    fDeactivated = []
    fRejectedUrls = []
    showFormModal = true
  }

  function openEdit(p) {
    editingProject = p
    fNome = p.nome ?? ''
    fAtivo = p.ativo ?? true
    fNotas = p.notas ?? ''
    fInstIds = p.instituicao_ids ? [...p.instituicao_ids] : []
    fLinks = p.links ? p.links.map(l => ({ nome: l.nome ?? '', url: l.url ?? '' })) : []
    fInstSearch = ''
    fError = ''
    fDeactivated = []
    fRejectedUrls = []
    showFormModal = true
  }

  async function openInfo(id) {
    infoProjectId = id
    infoData = null
    infoLoading = true
    showInfoModal = true
    try {
      infoData = await api.get(`/api/projects/${id}/detail`)
    } catch (e) {
      infoData = null
    } finally {
      infoLoading = false
    }
  }

  // ── Form helpers ─────────────────────────────────────────────────────
  function addInstitution(inst) {
    if (!fInstIds.includes(inst.id)) fInstIds = [...fInstIds, inst.id]
    fInstSearch = ''
    fShowInstDrop = false
  }

  function removeInstitution(id) {
    fInstIds = fInstIds.filter(x => x !== id)
  }

  function addLink() {
    fLinks = [...fLinks, { nome: '', url: '' }]
  }

  function removeLink(idx) {
    fLinks = fLinks.filter((_, i) => i !== idx)
  }

  function updateLink(idx, field, value) {
    fLinks = fLinks.map((l, i) => i === idx ? { ...l, [field]: value } : l)
  }

  async function createInstitution(sigla) {
    try {
      const created = await api.post('/api/institutions', { sigla: sigla.trim() })
      await loadInstitutions()
      const newId = created.id ?? created.lastInsertRowid
      if (newId) fInstIds = [...fInstIds, newId]
      fInstSearch = ''
      fShowInstDrop = false
    } catch (e) {
      // May already exist — find it and add
      const existing = allInstitutions.find(i => i.sigla.toLowerCase() === sigla.trim().toLowerCase())
      if (existing) addInstitution(existing)
      else fInstSearch = ''
      fShowInstDrop = false
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────
  async function saveProject() {
    if (!fNome.trim()) { fError = 'Nome é obrigatório.'; return }
    fSaving = true
    fError = ''
    fDeactivated = []
    fRejectedUrls = []
    try {
      const body = {
        nome: fNome.trim(),
        ativo: fAtivo,
        notas: fNotas || null,
        instituicao_ids: fInstIds,
        links: fLinks.filter(l => l.url.trim()),
      }
      let res
      if (editingProject) {
        res = await api.put(`/api/projects/${editingProject.id}`, body)
      } else {
        res = await api.post('/api/projects', body)
      }
      if (res?.deactivated_participants?.length) fDeactivated = res.deactivated_participants
      if (res?.rejected_urls?.length) fRejectedUrls = res.rejected_urls

      if (!fDeactivated.length && !fRejectedUrls.length) {
        showFormModal = false
      }
      await load()
    } catch (e) {
      fError = e.message
    } finally {
      fSaving = false
    }
  }

  function formatDate(dt) {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  function instName(id) {
    const inst = allInstitutions.find(i => i.id === id)
    return inst ? inst.sigla : String(id)
  }
</script>

<div class="space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-semibold text-gray-900">Projetos</h2>
    <button onclick={openNew} class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      Novo Projeto
    </button>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
    <div class="flex-1 min-w-48">
      <label class="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
      <input
        type="text"
        placeholder="Nome ou instituição..."
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
    <p class="text-xs text-gray-500 self-end pb-1.5">{displayList.length} projeto(s)</p>
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
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        Nenhum projeto encontrado
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('nome')}>
                Nome {sortIcon('nome')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('ativo')}>
                Status {sortIcon('ativo')}
              </th>
              <th class="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none" onclick={() => toggleSort('instituicao_nomes')}>
                Instituição {sortIcon('instituicao_nomes')}
              </th>
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
                <td class="px-4 py-3">
                  {#if p.ativo}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Ativo</span>
                  {:else}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Inativo</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-gray-700 max-w-xs truncate">{p.instituicao_nomes ?? '—'}</td>
                <td class="px-4 py-3">
                  {#if (p.reuniao_count ?? 0) > 0}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{p.reuniao_count}</span>
                  {:else}
                    <span class="text-gray-400">0</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1">
                    <button onclick={() => openInfo(p.id)} title="Ver detalhes" class="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </button>
                    {#if p.has_notas}
                      <span title="Possui notas" class="text-gray-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                      </span>
                    {/if}
                    {#if (p.link_count ?? 0) > 0}
                      <span title="{p.link_count} link(s)" class="text-gray-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                        </svg>
                      </span>
                    {/if}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <button onclick={() => openEdit(p)} title="Editar" class="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button onclick={() => deleteProject(p)} title="Excluir" class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
    <div class="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">
          {editingProject ? 'Editar Projeto' : 'Novo Projeto'}
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

        {#if fDeactivated.length > 0}
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
            <p class="font-medium mb-1">Participantes desativados automaticamente:</p>
            <ul class="list-disc list-inside space-y-0.5">
              {#each fDeactivated as d}
                <li>{d.nome}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if fRejectedUrls.length > 0}
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
            <p class="font-medium mb-1">URLs rejeitadas:</p>
            <ul class="list-disc list-inside space-y-0.5">
              {#each fRejectedUrls as u}
                <li class="break-all">{u}</li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- Nome -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nome <span class="text-red-500">*</span></label>
          <input
            type="text"
            bind:value={fNome}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nome do projeto"
          />
        </div>

        <!-- Ativo toggle -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            onclick={() => fAtivo = !fAtivo}
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {fAtivo ? 'bg-blue-600' : 'bg-gray-200'}">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform {fAtivo ? 'translate-x-6' : 'translate-x-1'}"></span>
          </button>
          <span class="text-sm text-gray-700">Projeto ativo</span>
        </div>

        <!-- Instituições (multi-select) -->
        <div class="relative">
          <label class="block text-sm font-medium text-gray-700 mb-1">Instituições</label>
          <!-- Selected chips -->
          {#if fInstIds.length > 0}
            <div class="flex flex-wrap gap-1 mb-2">
              {#each fInstIds as id}
                <span class="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">
                  {instName(id)}
                  <button type="button" onclick={() => removeInstitution(id)} class="hover:text-purple-600">×</button>
                </span>
              {/each}
            </div>
          {/if}
          <input
            type="text"
            bind:value={fInstSearch}
            onfocus={() => fShowInstDrop = true}
            onblur={() => setTimeout(() => fShowInstDrop = false, 150)}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar instituição..."
          />
          {#if fShowInstDrop && (fInstDropFiltered.length > 0 || fInstSearch.trim())}
            <div class="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {#each fInstDropFiltered as inst}
                <button
                  type="button"
                  onmousedown={() => addInstitution(inst)}
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

        <!-- Links -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-sm font-medium text-gray-700">Links</label>
            <button type="button" onclick={addLink} class="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Adicionar link</button>
          </div>
          {#if fLinks.length === 0}
            <p class="text-xs text-gray-400">Nenhum link adicionado.</p>
          {:else}
            <div class="space-y-2">
              {#each fLinks as link, idx}
                <div class="flex gap-2 items-center">
                  <input
                    type="text"
                    value={link.nome}
                    oninput={(e) => updateLink(idx, 'nome', e.target.value)}
                    placeholder="Descrição (opcional)"
                    class="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="url"
                    value={link.url}
                    oninput={(e) => updateLink(idx, 'url', e.target.value)}
                    placeholder="https://..."
                    class="flex-[2] min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onclick={() => removeLink(idx)} class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Notas -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <RichEditor bind:content={fNotas} editable={true} placeholder="Observações sobre o projeto..." />
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
        <button onclick={() => showFormModal = false} class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          {(fDeactivated.length > 0 || fRejectedUrls.length > 0) ? 'Fechar' : 'Cancelar'}
        </button>
        {#if !fDeactivated.length && !fRejectedUrls.length}
          <button
            onclick={saveProject}
            disabled={fSaving}
            class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
            {fSaving ? 'Salvando...' : 'Salvar'}
          </button>
        {/if}
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
        <h3 class="text-lg font-semibold text-gray-900">Detalhes do Projeto</h3>
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

            <!-- Instituições -->
            {#if infoData.instituicoes && infoData.instituicoes.length > 0}
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Instituições</p>
                <div class="flex flex-wrap gap-1">
                  {#each infoData.instituicoes as inst}
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{inst.sigla}</span>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Links -->
            {#if infoData.links && infoData.links.length > 0}
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Links</p>
                <ul class="space-y-1">
                  {#each infoData.links as link}
                    <li>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:underline break-all">
                        {link.nome || link.url}
                      </a>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Notas -->
            {#if infoData.notas}
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Notas</p>
                <RichEditor content={infoData.notas} editable={false} />
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
