<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'
  import RichEditor from './RichEditor.svelte'

  let { meetingId, onClose, onEdit } = $props()

  let meeting = $state(null)
  let files = $state([])
  let loading = $state(true)
  let loadingFiles = $state(false)
  let error = $state('')
  let uploading = $state(false)
  let uploadError = $state('')
  let fileInput = $state(null)

  const TIPO_BADGE = {
    'Presencial': 'bg-green-100 text-green-800',
    'Remota':     'bg-blue-100 text-blue-800',
    'Hibrida':    'bg-purple-100 text-purple-800',
    'Híbrida':    'bg-purple-100 text-purple-800',
    'Telefone':   'bg-orange-100 text-orange-800',
  }

  function tipoBadge(tipo) {
    return TIPO_BADGE[tipo] ?? 'bg-gray-100 text-gray-800'
  }

  function formatDate(dt) {
    if (!dt) return '—'
    return new Date(dt).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })
  }

  function fileLetterBadge(name) {
    const ext = name?.split('.').pop()?.toUpperCase() ?? '?'
    const colors = {
      PDF: 'bg-red-100 text-red-700',
      PNG: 'bg-green-100 text-green-700',
      JPG: 'bg-yellow-100 text-yellow-700',
      JPEG: 'bg-yellow-100 text-yellow-700',
    }
    return { ext, color: colors[ext] ?? 'bg-gray-100 text-gray-700' }
  }

  async function loadMeeting() {
    loading = true
    error = ''
    try {
      meeting = await api.get(`/api/meetings/${meetingId}`)
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  }

  async function loadFiles() {
    loadingFiles = true
    try {
      const data = await api.get(`/api/meetings/${meetingId}/files`)
      files = data.items ?? data ?? []
    } catch {
      files = []
    } finally {
      loadingFiles = false
    }
  }

  async function deleteFile(fileId) {
    if (!window.confirm('Excluir este arquivo?')) return
    try {
      await api.del(`/api/files/${fileId}`)
      await loadFiles()
    } catch (e) {
      uploadError = e.message
    }
  }

  async function handleUpload() {
    if (!fileInput?.files?.length) return
    uploadError = ''
    uploading = true
    try {
      const fd = new FormData()
      for (const f of fileInput.files) {
        fd.append('file', f)
      }
      await api.upload(`/api/meetings/${meetingId}/files`, fd)
      fileInput.value = ''
      await loadFiles()
    } catch (e) {
      uploadError = e.message
    } finally {
      uploading = false
    }
  }

  onMount(async () => {
    await Promise.all([loadMeeting(), loadFiles()])
  })

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
  <div class="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden">

    {#if loading}
      <!-- Loading state -->
      <div class="flex items-center justify-center py-20">
        <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>

    {:else if error}
      <!-- Error state -->
      <div class="p-6">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
        <div class="mt-4 flex justify-end">
          <button onclick={onClose} class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            Fechar
          </button>
        </div>
      </div>

    {:else if meeting}
      <!-- Header -->
      <div class="flex items-start justify-between px-6 py-4 border-b border-gray-200 shrink-0">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Ficha da Reunião</h2>
          <p class="text-sm text-gray-500 mt-0.5">{formatDate(meeting.data_hora)}</p>
        </div>
        <div class="flex items-center gap-2 ml-4">
          <!-- Print button -->
          <button
            type="button"
            onclick={() => window.open('/meeting/' + meetingId, '_blank')}
            title="Abrir para impressão"
            class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
          </button>
          <!-- Edit button -->
          {#if onEdit}
            <button
              type="button"
              onclick={() => onEdit(meeting)}
              title="Editar reunião"
              class="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
          {/if}
          <!-- Close button -->
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
      </div>

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        <!-- Tipo -->
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-600">Tipo:</span>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {tipoBadge(meeting.tipo)}">
            {meeting.tipo}
          </span>
        </div>

        <!-- Participantes -->
        {#if meeting.participantes?.length}
          <div>
            <h3 class="text-sm font-semibold text-gray-700 mb-2">Participantes</h3>
            <p class="text-sm text-gray-800 leading-relaxed">
              {#each meeting.participantes as p, i}
                <span>{p.nome}{#if p.instituicao}<span class="text-gray-400"> ({p.instituicao})</span>{/if}{#if i < meeting.participantes.length - 1}, {/if}</span>
              {/each}
            </p>
          </div>
        {/if}

        <!-- Projetos -->
        {#if meeting.projetos?.length}
          <div>
            <h3 class="text-sm font-semibold text-gray-700 mb-2">Projetos</h3>
            <ul class="space-y-0.5">
              {#each meeting.projetos as p}
                <li class="text-sm text-gray-800">• {p.nome}</li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- Pautas -->
        {#if meeting.pautas?.length}
          <div>
            <h3 class="text-sm font-semibold text-gray-700 mb-2">Pautas</h3>
            <ol class="space-y-1 list-decimal list-inside">
              {#each meeting.pautas as pauta}
                <li class="text-sm text-gray-800">{pauta.texto}</li>
              {/each}
            </ol>
          </div>
        {/if}

        <!-- Links -->
        {#if meeting.links?.length}
          <div>
            <h3 class="text-sm font-semibold text-gray-700 mb-2">Links</h3>
            <ul class="space-y-1">
              {#each meeting.links as link}
                <li>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                  >
                    {link.nome || link.url}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- Notas -->
        {#if meeting.notas}
          <div>
            <h3 class="text-sm font-semibold text-gray-700 mb-2">Notas</h3>
            <div class="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <RichEditor
                content={meeting.notas}
                editable={false}
              />
            </div>
          </div>
        {/if}

        <!-- Anexos -->
        <div>
          <h3 class="text-sm font-semibold text-gray-700 mb-3">Anexos</h3>

          {#if uploadError}
            <div class="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{uploadError}</div>
          {/if}

          <!-- File list -->
          {#if loadingFiles}
            <div class="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <div class="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              Carregando arquivos...
            </div>
          {:else if files.length === 0}
            <p class="text-sm text-gray-400 mb-3">Nenhum arquivo anexado.</p>
          {:else}
            <div class="space-y-2 mb-4">
              {#each files as file}
                {@const badge = fileLetterBadge(file.nome_original ?? file.filename)}
                <div class="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <!-- Thumbnail or letter badge -->
                  <div class="w-12 h-12 shrink-0 rounded border border-gray-200 overflow-hidden bg-white flex items-center justify-center">
                    {#if file.has_thumbnail}
                      <img
                        src="/api/files/{file.id}/thumbnail"
                        alt="miniatura"
                        class="w-full h-full object-cover"
                      />
                    {:else}
                      <span class="text-xs font-bold px-1 py-0.5 rounded {badge.color}">{badge.ext}</span>
                    {/if}
                  </div>

                  <!-- Filename -->
                  <span class="flex-1 text-sm text-gray-800 truncate" title={file.nome_original ?? file.filename}>
                    {file.nome_original ?? file.filename}
                  </span>

                  <!-- Actions -->
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onclick={() => window.open(`/api/files/${file.id}/content`, '_blank')}
                      title="Visualizar"
                      class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onclick={() => deleteFile(file.id)}
                      title="Excluir arquivo"
                      class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Upload -->
          <div class="flex items-center gap-2">
            <input
              type="file"
              bind:this={fileInput}
              accept="image/png,image/jpeg,application/pdf"
              multiple
              class="flex-1 text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
            />
            <button
              type="button"
              onclick={handleUpload}
              disabled={uploading}
              class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shrink-0"
            >
              {#if uploading}
                <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              {/if}
              Enviar
            </button>
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
          Fechar
        </button>
      </div>
    {/if}

  </div>
</div>
