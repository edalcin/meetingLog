<script>
  import { onMount } from 'svelte'
  import { api } from '../api.js'
  import ReplaceEntitySection from './ReplaceEntitySection.svelte'

  // ── Section: Backup & Restore ───────────────────────────────────────────

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

  // ── Section: Configurações ────────────────────────────────────────────────

  let autosaveSeconds = $state(5)
  let settingsSaving = $state(false)
  let settingsError = $state('')
  let settingsSuccess = $state('')

  onMount(async () => {
    try {
      const s = await api.get('/api/settings')
      autosaveSeconds = s.autosave_interval_seconds ?? 5
    } catch {}
  })

  async function saveSettings() {
    settingsSaving = true
    settingsError = ''
    settingsSuccess = ''
    try {
      await api.put('/api/settings', { autosave_interval_seconds: autosaveSeconds })
      settingsSuccess = 'Configurações salvas.'
    } catch (e) {
      settingsError = e.message
    } finally {
      settingsSaving = false
    }
  }
</script>

<div class="space-y-8">

  <!-- Substituição de Projetos -->
  <ReplaceEntitySection
    title="Substituição de Projetos"
    description="Substitui um projeto em todas as reuniões em que ele aparece, sem remover o projeto original."
    fromLabel="Projeto de Origem"
    toLabel="Projeto de Destino"
    listUrl="/api/projects?limit=500"
    replaceUrl="/api/maintenance/replace-project"
    createUrl="/api/projects"
    entityNoun="projeto"
  />

  <!-- Substituição de Participantes -->
  <ReplaceEntitySection
    title="Substituição de Participantes"
    description="Substitui um participante em todas as reuniões em que ele aparece, sem remover o participante original."
    fromLabel="Participante de Origem"
    toLabel="Participante de Destino"
    listUrl="/api/participants?limit=500"
    replaceUrl="/api/maintenance/replace-participant"
    createUrl="/api/participants"
    entityNoun="participante"
  />

  <!-- Configurações -->
  <div class="bg-white rounded-xl border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-800 mb-1 pl-3 border-l-4 border-purple-500">
      Configurações
    </h2>
    <p class="text-sm text-gray-500 mb-6 pl-3">
      Parâmetros de comportamento da aplicação.
    </p>

    <div class="max-w-sm space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Intervalo de auto-save (segundos)
        </label>
        <input
          type="number"
          min="2"
          max="300"
          step="1"
          bind:value={autosaveSeconds}
          class="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="text-xs text-gray-500 mt-1">
          Após este tempo sem alterações, a reunião e as notas são salvas automaticamente.
        </p>
      </div>

      <button
        onclick={saveSettings}
        disabled={settingsSaving}
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
      >
        {settingsSaving ? 'Salvando...' : 'Salvar configurações'}
      </button>

      {#if settingsError}
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{settingsError}</div>
      {/if}
      {#if settingsSuccess}
        <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">{settingsSuccess}</div>
      {/if}
    </div>
  </div>

  <!-- Divider -->
  <hr class="border-gray-200" />

  <!-- Backup & Restauração -->
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
