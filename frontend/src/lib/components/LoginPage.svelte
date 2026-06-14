<script>
  import { login } from '../stores/auth.js'

  let pin = $state('')
  let error = $state('')
  let loading = $state(false)

  async function handleSubmit(e) {
    e.preventDefault()
    error = ''
    loading = true
    try {
      await login(pin)
    } catch (err) {
      error = err.status === 401 ? 'PIN incorreto' : (err.message || 'Erro ao fazer login')
      pin = ''
    } finally {
      loading = false
    }
  }
</script>

<div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="flex flex-col items-center mb-8">
      <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-gray-900">Registro de Reuniões</h1>
      <p class="text-gray-500 mt-1 text-sm">Digite o PIN de acesso</p>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <form onsubmit={handleSubmit} class="space-y-4">
        <div>
          <label for="pin" class="block text-sm font-medium text-gray-700 mb-1">PIN</label>
          <input
            id="pin"
            type="password"
            inputmode="numeric"
            autocomplete="current-password"
            bind:value={pin}
            placeholder="••••••"
            disabled={loading}
            class="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
        </div>

        {#if error}
          <p class="text-red-600 text-sm text-center">{error}</p>
        {/if}

        <button
          type="submit"
          disabled={loading || !pin}
          class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
          {#if loading}
            <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
          {/if}
          Entrar
        </button>
      </form>
    </div>
  </div>
</div>
