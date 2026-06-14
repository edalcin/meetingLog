<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'

  // ── Section 1: Substituição de Projetos ──────────────────────────────────

  let allProjects = $state([])
  let replaceFrom = $state(null)
  let replaceTo = $state(null)
  let fromSearch = $state('')
  let toSearch = $state('')
  let showFromDropdown = $state(false)
  let showToDropdown = $state(false)
  let dryRunResult = $state(null)
  let replaceLoading = $state(false)
  let replaceError = $state('')
  let replaceSuccess = $state('')

  let fromFiltered = $derived(
    allProjects.filter(p => p.nome.toLowerCase().includes(fromSearch.toLowerCase()))
  )

  let toFiltered = $derived(
    allProjects.filter(p => p.nome.toLowerCase().includes(toSearch.toLowerCase()))
  )

  let canSimulate = $derived(
    replaceFrom && replaceTo && replaceFrom.id !== replaceTo.id
  )

  let showCreateOption = $derived(
    toSearch.trim() !== '' &&
    !allProjects.some(p => p.nome.toLowerCase() === toSearch.trim().toLowerCase())
  )

  onMount(async () => {
    try {
      const data = await api.get('/api/projects?limit=500')
      allProjects = data.data ?? []
    } catch (e) {
      replaceError = e.message
    }
  })

  function selectFrom(project) {
    replaceFrom = project
    fromSearch = ''
    showFromDropdown = false
    dryRunResult = null
    replaceSuccess = ''
  }

  function selectTo(project) {
    replaceTo = project
    toSearch = ''
    showToDropdown = false
    dryRunResult = null
    replaceSuccess = ''
  }

  async function createAndSelectProject() {
    const nome = toSearch.trim()
    if (!nome) return
    try {
      const created = await api.post('/api/projects', { nome, ativo: true })
      allProjects = [...allProjects, created]
      selectTo(created)
    } catch (e) {
      replaceError = e.message
    }
  }

  async function simulate() {
    if (!canSimulate) return
    replaceLoading = true
    replaceError = ''
    replaceSuccess = ''
    try {
      const result = await api.post('/api/maintenance/replace-project', {
        from_id: replaceFrom.id,
        to_id: replaceTo.id,
        dry_run: true,
      })
      dryRunResult = result
    } catch (e) {
      replaceError = e.message
    } finally {
      replaceLoading = false
    }
  }

  async function confirmReplace() {
    if (!canSimulate) return
    replaceLoading = true
    replaceError = ''
    try {
      await api.post('/api/maintenance/replace-project', {
        from_id: replaceFrom.id,
        to_id: replaceTo.id,
        dry_run: false,
      })
      replaceSuccess = `Substituição concluída: "${replaceFrom.nome}" foi substituído por "${replaceTo.nome}" em ${dryRunResult?.count ?? 0} reunião(ões).`
      replaceFrom = null
      replaceTo = null
      dryRunResult = null
    } catch (e) {
      replaceError = e.message
    } finally {
      replaceLoading = false
    }
  }

  // ── Section 2: Backup & Restore ──────────────────────────────────────────

  let backupLoading = $state(false)
  let backupError = $state('')
  let restoreFile = $state(null)
  let restoreLoading = $state(false)
  let restoreError = $state('')

  async function downloadBackup() {
    backupLoading = true
    backupError = ''
    try {
      const csrfToken = document.cookie.match(/meetinglog_csrf=([^;]+)/)?.[1] ?? ''
      const res = await fetch('/api/maintenance/backup', {
        headers: { 'X-CSRF-Token': csrfToken },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('Backup falhou: ' + res.status)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `meetinglog-backup-${new Date().toISOString().slice(0, 10)}.sqlite`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      backupError = e.message
    } finally {
      backupLoading = false
    }
  }

  async function doRestore() {
    if (!restoreFile) return
    if (!window.confirm('Atenção: isso substituirá todos os dados atuais. Esta ação não pode ser desfeita. Continuar?')) return
    restoreLoading = true
    restoreError = ''
    try {
      const formData = new FormData()
      formData.append('file', restoreFile)
      await api.upload('/api/maintenance/restore', formData)
      window.location.reload()
    } catch (e) {
      restoreError = e.message
    } finally {
      restoreLoading = false
    }
  }
</script>

<div class="space-y-8">

  <!-- ════════════════════════════════════════════════════════════════════════
       SECTION 1 · Substituição de Projetos
  ═════════════════════════════════════════════════════════════════════════ -->
  <div class="bg-white rounded-xl border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-800 mb-1 pl-3 border-l-4 border-blue-500">
      Substituição de Projetos
    </h2>
    <p class="text-sm text-gray-500 mb-6 pl-3">
      Substitui um projeto em todas as reuniões em que ele aparece, sem remover o projeto original.
    </p>

    <!-- DE / PARA columns -->
    <div class="grid grid-cols-2 gap-6">

      <!-- DE column -->
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-2">Projeto de Origem</label>

        {#if replaceFrom}
          <div class="flex items-center gap-2 mb-2">
            <span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium truncate max-w-full">
              {replaceFrom.nome}
            </span>
            <button
              onclick={() => { replaceFrom = null; dryRunResult = null; replaceSuccess = '' }}
              class="shrink-0 text-red-500 hover:text-red-700 text-lg leading-none"
              aria-label="Remover seleção"
            >×</button>
          </div>
        {/if}

        <div class="relative">
          <input
            type="text"
            placeholder="Buscar projeto..."
            bind:value={fromSearch}
            onfocus={() => showFromDropdown = true}
            oninput={() => { showFromDropdown = true; dryRunResult = null; replaceSuccess = '' }}
            onblur={() => setTimeout(() => showFromDropdown = false, 150)}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {#if showFromDropdown && fromFiltered.length > 0}
            <ul class="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {#each fromFiltered.slice(0, 20) as project}
                <li>
                  <button
                    type="button"
                    onmousedown={() => selectFrom(project)}
                    class="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {project.nome}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>

      <!-- PARA column -->
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-2">Projeto de Destino</label>

        {#if replaceTo}
          <div class="flex items-center gap-2 mb-2">
            <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium truncate max-w-full">
              {replaceTo.nome}
            </span>
            <button
              onclick={() => { replaceTo = null; dryRunResult = null; replaceSuccess = '' }}
              class="shrink-0 text-green-600 hover:text-green-800 text-lg leading-none"
              aria-label="Remover seleção"
            >×</button>
          </div>
        {/if}

        <div class="relative">
          <input
            type="text"
            placeholder="Buscar projeto..."
            bind:value={toSearch}
            onfocus={() => showToDropdown = true}
            oninput={() => { showToDropdown = true; dryRunResult = null; replaceSuccess = '' }}
            onblur={() => setTimeout(() => showToDropdown = false, 150)}
            class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {#if showToDropdown && (toFiltered.length > 0 || showCreateOption)}
            <ul class="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {#if showCreateOption}
                <li>
                  <button
                    type="button"
                    onmousedown={createAndSelectProject}
                    class="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 font-medium transition-colors border-b border-gray-100"
                  >
                    ＋ Criar projeto "{toSearch.trim()}"
                  </button>
                </li>
              {/if}
              {#each toFiltered.slice(0, 20) as project}
                <li>
                  <button
                    type="button"
                    onmousedown={() => selectTo(project)}
                    class="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {project.nome}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </div>

    <!-- Same-project warning -->
    {#if replaceFrom && replaceTo && replaceFrom.id === replaceTo.id}
      <div class="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700 text-sm">
        Origem e destino são o mesmo projeto. Selecione projetos diferentes.
      </div>
    {/if}

    <!-- Simulate button -->
    <div class="mt-6 flex items-center gap-3">
      <button
        onclick={simulate}
        disabled={!canSimulate || replaceLoading}
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
      >
        {#if replaceLoading}
          <span class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block"></span>
        {/if}
        Simular (Dry Run)
      </button>
    </div>

    <!-- Dry run results -->
    {#if dryRunResult}
      <div class="mt-5 space-y-4">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
            {dryRunResult.count} reunião(ões) afetada(s)
          </span>
        </div>

        {#if dryRunResult.affected && dryRunResult.affected.length > 0}
          <ul class="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden text-sm">
            {#each dryRunResult.affected as m}
              <li class="px-4 py-2.5 text-gray-700 bg-white hover:bg-gray-50">
                <span class="font-medium">{m.data_fmt ?? m.data_hora ?? ''}</span>
                {#if m.participantes_nomes}
                  <span class="text-gray-400 mx-1">—</span>
                  <span class="text-gray-600">{m.participantes_nomes}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}

        {#if dryRunResult.count > 0}
          <button
            onclick={confirmReplace}
            disabled={replaceLoading}
            class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {#if replaceLoading}
              <span class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block"></span>
            {/if}
            Confirmar substituição
          </button>
        {/if}
      </div>
    {/if}

    <!-- Feedback messages -->
    {#if replaceError}
      <div class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{replaceError}</div>
    {/if}
    {#if replaceSuccess}
      <div class="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{replaceSuccess}</div>
    {/if}
  </div>

  <!-- Divider -->
  <hr class="border-gray-200" />

  <!-- ════════════════════════════════════════════════════════════════════════
       SECTION 2 · Backup & Restore
  ═════════════════════════════════════════════════════════════════════════ -->
  <div class="bg-white rounded-xl border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-800 mb-1 pl-3 border-l-4 border-green-500">
      Backup & Restauração
    </h2>
    <p class="text-sm text-gray-500 mb-6 pl-3">
      Faça o download do banco de dados ou restaure a partir de um arquivo de backup.
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- Backup subsection -->
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-700">Download do Banco de Dados</h3>
        <p class="text-sm text-gray-500">
          Gera um snapshot consistente do banco SQLite e inicia o download imediatamente.
        </p>
        <button
          onclick={downloadBackup}
          disabled={backupLoading}
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {#if backupLoading}
            <span class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block"></span>
            Gerando backup...
          {:else}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Baixar Backup
          {/if}
        </button>
        {#if backupError}
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{backupError}</div>
        {/if}
      </div>

      <!-- Restore subsection -->
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-700">Restaurar Backup</h3>
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700 text-sm">
          Atenção: a restauração substitui permanentemente todos os dados atuais. Esta ação não pode ser desfeita.
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Arquivo de backup</label>
          <input
            type="file"
            accept=".sqlite,.db"
            onchange={e => restoreFile = e.target.files[0]}
            class="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
          />
        </div>
        <button
          onclick={doRestore}
          disabled={!restoreFile || restoreLoading}
          class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {#if restoreLoading}
            <span class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block"></span>
            Restaurando...
          {:else}
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"/>
            </svg>
            Restaurar Backup
          {/if}
        </button>
        {#if restoreError}
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{restoreError}</div>
        {/if}
      </div>

    </div>
  </div>

</div>
