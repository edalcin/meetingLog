<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'
  import RichEditor from './RichEditor.svelte'

  let { id } = $props()

  let loading = $state(true)
  let notFound = $state(false)
  let meeting = $state(null)
  let files = $state([])
  let error = $state('')

  function formatDateFull(dt) {
    return new Date(dt).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })
  }

  function formatBytes(bytes) {
    return (bytes / 1024).toFixed(1) + ' KB'
  }

  const tipoColors = {
    'Ordinária':     'bg-blue-100 text-blue-800',
    'Extraordinária':'bg-purple-100 text-purple-800',
    'Emergencial':   'bg-red-100 text-red-800',
  }

  function tipoColor(tipo) {
    return tipoColors[tipo] ?? 'bg-gray-100 text-gray-800'
  }

  onMount(async () => {
    try {
      meeting = await api.get(`/api/meetings/${id}`)
    } catch (e) {
      if (e.status === 401) {
        window.location.href = '/'
        return
      }
      notFound = true
      loading = false
      return
    }

    try {
      const data = await api.get(`/api/meetings/${id}/files`)
      files = data.items ?? data ?? []
    } catch {
      files = []
    }

    loading = false
  })
</script>

<div class="min-h-screen bg-white p-6 max-w-4xl mx-auto">

  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <!-- Logo / title -->
    <div class="flex items-center gap-3">
      <svg class="w-7 h-7 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      <span class="text-lg font-semibold text-gray-900">Registro de Reuniões</span>
    </div>

    <!-- Action buttons (hidden on print) -->
    <div class="no-print flex items-center gap-2">
      <button
        type="button"
        onclick={() => window.print()}
        class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
        </svg>
        Imprimir
      </button>
      <button
        type="button"
        onclick={() => window.close()}
        class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
        Fechar
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-24">
      <div class="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
    </div>

  {:else if notFound}
    <div class="flex items-center justify-center py-24">
      <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm max-w-md w-full">
        Reunião não encontrada.
      </div>
    </div>

  {:else if meeting}

    <!-- Data e Hora -->
    <section>
      <h2 class="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4 mt-8">Data e Hora</h2>
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-gray-800">{formatDateFull(meeting.data_hora)}</span>
        {#if meeting.tipo}
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {tipoColor(meeting.tipo)}">
            {meeting.tipo}
          </span>
        {/if}
        {#if meeting.local}
          <span class="text-sm text-gray-500">— {meeting.local}</span>
        {/if}
      </div>
    </section>

    <!-- Participantes -->
    {#if meeting.participantes?.length}
      <section>
        <h2 class="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4 mt-8">Participantes</h2>
        <ul class="space-y-1">
          {#each meeting.participantes as p}
            <li class="text-sm text-gray-800">
              {p.nome}{#if p.instituicao}{' '}<span class="text-gray-500">({p.instituicao})</span>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- Projetos -->
    {#if meeting.projetos?.length}
      <section>
        <h2 class="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4 mt-8">Projetos</h2>
        <ul class="space-y-1">
          {#each meeting.projetos as p}
            <li class="text-sm text-gray-800">• {p.nome}</li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- Pautas -->
    {#if meeting.pautas?.length}
      <section>
        <h2 class="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4 mt-8">Pautas</h2>
        <ol class="space-y-1">
          {#each meeting.pautas as pauta, i}
            <li class="text-sm text-gray-800">{i + 1}. {typeof pauta === 'string' ? pauta : pauta.texto}</li>
          {/each}
        </ol>
      </section>
    {/if}

    <!-- Links -->
    {#if meeting.links?.length}
      <section>
        <h2 class="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4 mt-8">Links</h2>
        <ul class="space-y-1">
          {#each meeting.links as link}
            <li>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-blue-600 hover:underline break-all"
              >
                {link.descricao || link.url}
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- Notas -->
    {#if meeting.notas}
      <section>
        <h2 class="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4 mt-8">Notas</h2>
          <RichEditor content={meeting.notas} editable={false} />
      </section>
    {/if}

    <!-- Anexos -->
    {#if files.length > 0}
      <section>
        <h2 class="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4 mt-8">Anexos</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {#each files as f}
            <div class="bg-white rounded-xl border border-gray-200 p-3 flex flex-col gap-2">
              <!-- Thumbnail or placeholder -->
              <div class="w-full h-32 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center">
                {#if f.thumbnail_url}
                  <img src={f.thumbnail_url} alt={f.nome} class="w-full h-full object-cover" />
                {:else}
                  <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                {/if}
              </div>

              <!-- File name -->
              <p class="text-xs text-gray-700 font-medium truncate" title={f.nome}>{f.nome}</p>

              <!-- Size + download -->
              <div class="flex items-center justify-between gap-1">
                <span class="text-xs text-gray-400">{formatBytes(f.tamanho)}</span>
                <a
                  href="/api/files/{f.id}/content"
                  download={f.nome}
                  class="text-xs text-blue-600 hover:underline no-print"
                >
                  Baixar
                </a>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

  {/if}

</div>

<style>
  @media print {
    .no-print {
      display: none !important;
    }
  }
</style>
