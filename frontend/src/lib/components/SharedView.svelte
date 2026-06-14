<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'

  let { token } = $props()

  let loading = $state(true)
  let error = $state('')
  let revoked = $state(false)
  let metadata = $state(null)
  let meetings = $state([])

  const tipoColors = {
    'Ordinária':     'bg-blue-100 text-blue-800',
    'Extraordinária':'bg-purple-100 text-purple-800',
    'Emergencial':   'bg-red-100 text-red-800',
  }

  function tipoColor(tipo) {
    return tipoColors[tipo] ?? 'bg-gray-100 text-gray-800'
  }

  function formatDate(dt) {
    return new Date(dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  onMount(async () => {
    try {
      metadata = await api.get(`/api/p/${token}`)

      if (metadata.revogado === true) {
        revoked = true
        return
      }

      const md = await api.get(`/api/p/${token}/meetings`)
      meetings = md.data ?? md ?? []
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  })
</script>

<div class="min-h-screen bg-gray-50">

  <!-- Header -->
  <header class="bg-white border-b border-gray-200 px-6 py-4">
    <div class="max-w-5xl mx-auto flex items-center gap-3">
      <!-- Calendar icon -->
      <svg class="w-7 h-7 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      <h1 class="text-lg font-semibold text-gray-900">Registro de Reuniões</h1>
    </div>
  </header>

  <!-- Body -->
  <main class="max-w-5xl mx-auto px-6 py-8">

    {#if loading}
      <div class="flex items-center justify-center py-24">
        <div class="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>

    {:else if error}
      <div class="flex items-center justify-center py-24">
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm max-w-md w-full">
          {error}
        </div>
      </div>

    {:else if revoked}
      <div class="flex items-center justify-center py-24">
        <div class="bg-white rounded-xl border border-gray-200 p-8 max-w-sm w-full text-center">
          <div class="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
            <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
            </svg>
          </div>
          <h2 class="text-base font-semibold text-gray-900 mb-1">Link expirado ou inválido</h2>
          <p class="text-sm text-gray-500">Este link compartilhado não está mais disponível.</p>
        </div>
      </div>

    {:else}
      <!-- Description card -->
      {#if metadata}
        <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <p class="font-semibold text-gray-900">{metadata.descricao}</p>
          {#if metadata.filterDescription}
            <p class="text-sm text-gray-500 mt-1">{metadata.filterDescription}</p>
          {/if}
        </div>
      {/if}

      <!-- Table card -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {#if meetings.length === 0}
          <div class="py-16 text-center text-gray-400 text-sm">
            Nenhuma reunião encontrada.
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Data/Hora</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Participantes</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Projetos</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each meetings as m}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3 whitespace-nowrap text-gray-800 font-medium">{formatDate(m.data_hora)}</td>
                    <td class="px-4 py-3 whitespace-nowrap">
                      {#if m.tipo}
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {tipoColor(m.tipo)}">
                          {m.tipo}
                        </span>
                      {/if}
                    </td>
                    <td class="px-4 py-3 text-gray-600">{m.participantes_nomes ?? '—'}</td>
                    <td class="px-4 py-3 text-gray-600">{m.projetos_nomes ?? '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}

  </main>

  <!-- Footer -->
  <footer class="text-center text-xs text-gray-400 py-6">
    Vista somente leitura — link compartilhado
  </footer>

</div>
