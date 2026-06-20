<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'

  let { title, description, fromLabel, toLabel, listUrl, replaceUrl, createUrl, entityNoun } = $props()

  let allEntities = $state([])
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
    allEntities.filter(e => e.nome.toLowerCase().includes(fromSearch.toLowerCase()))
  )

  let toFiltered = $derived(
    allEntities.filter(e => e.nome.toLowerCase().includes(toSearch.toLowerCase()))
  )

  let canSimulate = $derived(
    replaceFrom && replaceTo && replaceFrom.id !== replaceTo.id
  )

  let showCreateOption = $derived(
    toSearch.trim() !== '' &&
    !allEntities.some(e => e.nome.toLowerCase() === toSearch.trim().toLowerCase())
  )

  onMount(async () => {
    try {
      const data = await api.get(listUrl)
      allEntities = data.data ?? []
    } catch (e) {
      replaceError = e.message
    }
  })

  function selectFrom(entity) {
    replaceFrom = entity
    fromSearch = ''
    showFromDropdown = false
    dryRunResult = null
    replaceSuccess = ''
  }

  function selectTo(entity) {
    replaceTo = entity
    toSearch = ''
    showToDropdown = false
    dryRunResult = null
    replaceSuccess = ''
  }

  async function createAndSelectEntity() {
    const nome = toSearch.trim()
    if (!nome) return
    try {
      const created = await api.post(createUrl, { nome, ativo: true })
      allEntities = [...allEntities, created]
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
      const result = await api.post(replaceUrl, {
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
      await api.post(replaceUrl, {
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
</script>

<div class="bg-white rounded-xl border border-gray-200 p-6">
  <h2 class="text-lg font-semibold text-gray-800 mb-1 pl-3 border-l-4 border-blue-500">
    {title}
  </h2>
  <p class="text-sm text-gray-500 mb-6 pl-3">
    {description}
  </p>

  <!-- DE / PARA columns -->
  <div class="grid grid-cols-2 gap-6">

    <!-- DE column -->
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-2">{fromLabel}</label>

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
          placeholder="Buscar {entityNoun}..."
          bind:value={fromSearch}
          onfocus={() => showFromDropdown = true}
          oninput={() => { showFromDropdown = true; dryRunResult = null; replaceSuccess = '' }}
          onblur={() => setTimeout(() => showFromDropdown = false, 150)}
          class="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {#if showFromDropdown && fromFiltered.length > 0}
          <ul class="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {#each fromFiltered.slice(0, 20) as entity}
              <li>
                <button
                  type="button"
                  onmousedown={() => selectFrom(entity)}
                  class="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {entity.nome}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>

    <!-- PARA column -->
    <div>
      <label class="block text-xs font-medium text-gray-600 mb-2">{toLabel}</label>

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
          placeholder="Buscar {entityNoun}..."
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
                  onmousedown={createAndSelectEntity}
                  class="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 font-medium transition-colors border-b border-gray-100"
                >
                  ＋ Criar {entityNoun} "{toSearch.trim()}"
                </button>
              </li>
            {/if}
            {#each toFiltered.slice(0, 20) as entity}
              <li>
                <button
                  type="button"
                  onmousedown={() => selectTo(entity)}
                  class="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {entity.nome}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>

  <!-- Same-entity warning -->
  {#if replaceFrom && replaceTo && replaceFrom.id === replaceTo.id}
    <div class="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700 text-sm">
      Origem e destino são o mesmo {entityNoun}. Selecione {entityNoun}s diferentes.
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
