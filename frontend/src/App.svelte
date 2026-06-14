<script>
  import { onMount } from 'svelte'
  import { authenticated, checkAuth, logout } from './lib/stores/auth.js'
  import LoginPage from './lib/components/LoginPage.svelte'
  import MeetingsTab from './lib/components/MeetingsTab.svelte'
  import ParticipantsTab from './lib/components/ParticipantsTab.svelte'
  import ProjectsTab from './lib/components/ProjectsTab.svelte'
  import InstitutionsTab from './lib/components/InstitutionsTab.svelte'
  import DashboardTab from './lib/components/DashboardTab.svelte'
  import MaintenanceTab from './lib/components/MaintenanceTab.svelte'
  import SharedView from './lib/components/SharedView.svelte'
  import MeetingView from './lib/components/MeetingView.svelte'

  let activeTab = $state('meetings')
  let authChecking = $state(true)
  let path = window.location.pathname

  let shareToken = $derived(path.match(/^\/p\/([^/]+)/)?.[1] ?? null)
  let meetingViewId = $derived(path.match(/^\/meeting\/(\d+)/)?.[1] ?? null)

  onMount(async () => {
    await checkAuth()
    authChecking = false
  })
</script>

{#if authChecking}
  <div class="min-h-screen flex items-center justify-center">
    <div class="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
  </div>
{:else if shareToken}
  <SharedView token={shareToken} />
{:else if meetingViewId}
  <MeetingView id={Number(meetingViewId)} />
{:else if !$authenticated}
  <LoginPage />
{:else}
  <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <span class="font-semibold text-gray-900 text-lg">Registro de Reuniões</span>
        </div>
        <nav class="flex items-center gap-1 overflow-x-auto">
          {#each [['meetings','Reuniões'],['participants','Participantes'],['projects','Projetos'],['institutions','Instituições'],['dashboard','Dashboard'],['maintenance','Manutenção']] as [tab, label]}
            <button
              onclick={() => activeTab = tab}
              class="px-3 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap {activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
              {label}
            </button>
          {/each}
        </nav>
        <button onclick={() => logout()} class="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ml-2 whitespace-nowrap">
          Sair
        </button>
      </div>
    </div>
  </header>
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {#if activeTab === 'meetings'}
      <MeetingsTab />
    {:else if activeTab === 'participants'}
      <ParticipantsTab />
    {:else if activeTab === 'projects'}
      <ProjectsTab />
    {:else if activeTab === 'institutions'}
      <InstitutionsTab />
    {:else if activeTab === 'dashboard'}
      <DashboardTab />
    {:else if activeTab === 'maintenance'}
      <MaintenanceTab />
    {/if}
  </main>
{/if}
