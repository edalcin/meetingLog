<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'
  import RichEditor from './RichEditor.svelte'

  let { participantId, onClose, onEdit = null } = $props()

  let infoData = $state(null)
  let infoLoading = $state(false)

  function formatDate(dt) {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }

  onMount(async () => {
    infoLoading = true
    try {
      infoData = await api.get(`/api/participants/${participantId}`)
    } catch {
      infoData = null
    } finally {
      infoLoading = false
    }
  })
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
  <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
      <h3 class="text-lg font-semibold text-gray-900">Detalhes do Participante</h3>
      <button onclick={onClose} class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
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
      {#if infoData && onEdit}
        <button onclick={() => { onClose(); onEdit(infoData) }} class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Editar
        </button>
      {/if}
      <button onclick={onClose} class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
        Fechar
      </button>
    </div>
  </div>
</div>
