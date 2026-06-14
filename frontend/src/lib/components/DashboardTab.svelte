<script>
  import { onMount, onDestroy } from 'svelte'
  import { api } from '../api.js'
  import {
    Chart,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
  } from 'chart.js'

  Chart.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
  )

  let loading = $state(false)
  let error = $state('')
  let filterType = $state('todos')
  let filterValue = $state('')

  let options = $state({ anos: [], projetos: [], participantes: [] })
  let dashData = $state(null)

  // Canvas refs
  let canvasPorMes
  let canvasTopParticipantes
  let canvasTopProjetos
  let canvasHorasFreq
  let canvasDiasFreq
  let canvasProjetosStack
  let canvasTopProjetosPizza
  let canvasTopParticipantesPizza

  // Chart instances
  let chartPorMes
  let chartTopParticipantes
  let chartTopProjetos
  let chartHorasFreq
  let chartDiasFreq
  let chartProjetosStack
  let chartTopProjetosPizza
  let chartTopParticipantesPizza

  const PIZZA_COLORS = [
    '#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899',
    '#14b8a6', '#f59e0b', '#ef4444', '#6366f1', '#84cc16'
  ]

  async function loadOptions() {
    try {
      const data = await api.get('/api/dashboard/options')
      options = data
    } catch (e) {
      error = 'Erro ao carregar opções de filtro: ' + e.message
    }
  }

  async function loadDashboard() {
    loading = true
    error = ''
    try {
      const params = new URLSearchParams({ filter: filterType, value: filterValue })
      dashData = await api.get('/api/dashboard?' + params.toString())
    } catch (e) {
      error = 'Erro ao carregar dados do dashboard: ' + e.message
    } finally {
      loading = false
    }
  }

  function createCharts() {
    chartPorMes = new Chart(canvasPorMes, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Reuniões por Mês' }, legend: { display: true } }
      }
    })

    chartTopParticipantes = new Chart(canvasTopParticipantes, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { title: { display: true, text: 'Top Participantes' }, legend: { display: false } }
      }
    })

    chartTopProjetos = new Chart(canvasTopProjetos, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { title: { display: true, text: 'Top Projetos' }, legend: { display: false } }
      }
    })

    chartHorasFreq = new Chart(canvasHorasFreq, {
      type: 'bar',
      data: { labels: Array.from({ length: 24 }, (_, i) => i + 'h'), datasets: [] },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Horários' }, legend: { display: false } }
      }
    })

    chartDiasFreq = new Chart(canvasDiasFreq, {
      type: 'bar',
      data: { labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], datasets: [] },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Dias da Semana' }, legend: { display: false } }
      }
    })

    chartProjetosStack = new Chart(canvasProjetosStack, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Projetos por Período' }, legend: { display: true } },
        scales: { x: { stacked: true }, y: { stacked: true } }
      }
    })

    chartTopProjetosPizza = new Chart(canvasTopProjetosPizza, {
      type: 'doughnut',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Top Projetos' }, legend: { display: true } }
      }
    })

    chartTopParticipantesPizza = new Chart(canvasTopParticipantesPizza, {
      type: 'doughnut',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'Top Participantes' }, legend: { display: true } }
      }
    })
  }

  function destroyCharts() {
    chartPorMes?.destroy()
    chartTopParticipantes?.destroy()
    chartTopProjetos?.destroy()
    chartHorasFreq?.destroy()
    chartDiasFreq?.destroy()
    chartProjetosStack?.destroy()
    chartTopProjetosPizza?.destroy()
    chartTopParticipantesPizza?.destroy()
  }

  // Reset filterValue whenever filterType changes
  $effect(() => {
    filterType
    filterValue = ''
  })

  // Reload dashboard data when filters change
  $effect(() => {
    const ft = filterType
    const fv = filterValue
    loadDashboard()
  })

  // Update charts when dashData changes
  $effect(() => {
    if (!dashData) return
    if (!chartPorMes) return

    chartPorMes.data.labels = dashData.porMes.labels
    chartPorMes.data.datasets = [
      {
        label: 'Reuniões',
        data: dashData.porMes.data,
        borderColor: '#3b82f6',
        fill: true,
        backgroundColor: 'rgba(59,130,246,0.1)',
        tension: 0.3
      },
      {
        label: 'Tendência',
        data: dashData.porMes.tendencia,
        borderColor: '#f97316',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        tension: 0
      }
    ]
    chartPorMes.update()

    chartTopParticipantes.data.labels = dashData.topParticipantes.map(t => t.nome)
    chartTopParticipantes.data.datasets = [
      { label: 'Reuniões', data: dashData.topParticipantes.map(t => t.count), backgroundColor: '#3b82f6' }
    ]
    chartTopParticipantes.update()

    chartTopProjetos.data.labels = dashData.topProjetos.map(t => t.nome)
    chartTopProjetos.data.datasets = [
      { label: 'Reuniões', data: dashData.topProjetos.map(t => t.count), backgroundColor: '#22c55e' }
    ]
    chartTopProjetos.update()

    chartHorasFreq.data.datasets = [
      { label: 'Reuniões', data: dashData.horasFreq, backgroundColor: '#a855f7' }
    ]
    chartHorasFreq.update()

    chartDiasFreq.data.datasets = [
      { label: 'Reuniões', data: dashData.diasFreq, backgroundColor: '#f97316' }
    ]
    chartDiasFreq.update()

    chartProjetosStack.data.labels = dashData.projetosStack.labels
    chartProjetosStack.data.datasets = dashData.projetosStack.datasets
    chartProjetosStack.update()

    chartTopProjetosPizza.data.labels = dashData.topProjetosPizza.labels
    chartTopProjetosPizza.data.datasets = [
      { data: dashData.topProjetosPizza.data, backgroundColor: PIZZA_COLORS }
    ]
    chartTopProjetosPizza.update()

    chartTopParticipantesPizza.data.labels = dashData.topParticipantesPizza.labels
    chartTopParticipantesPizza.data.datasets = [
      { data: dashData.topParticipantesPizza.data, backgroundColor: PIZZA_COLORS }
    ]
    chartTopParticipantesPizza.update()
  })

  onMount(async () => {
    await loadOptions()
    createCharts()
  })

  onDestroy(() => {
    destroyCharts()
  })
</script>

<div class="space-y-6">

  <!-- Filter bar -->
  <div class="flex flex-wrap items-center gap-3">
    <select
      class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      bind:value={filterType}
    >
      <option value="todos">Todos os dados</option>
      <option value="ano">Por Ano</option>
      <option value="projeto">Por Projeto</option>
      <option value="participante">Por Participante</option>
    </select>

    {#if filterType !== 'todos'}
      <select
        class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        bind:value={filterValue}
      >
        <option value="">Selecione...</option>
        {#if filterType === 'ano'}
          {#each options.anos as ano}
            <option value={ano}>{ano}</option>
          {/each}
        {:else if filterType === 'projeto'}
          {#each options.projetos as p}
            <option value={String(p.id)}>{p.nome}</option>
          {/each}
        {:else if filterType === 'participante'}
          {#each options.participantes as p}
            <option value={String(p.id)}>{p.nome}</option>
          {/each}
        {/if}
      </select>
    {/if}

    {#if loading}
      <div class="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
    {/if}
  </div>

  <!-- Error -->
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
      {error}
    </div>
  {/if}

  {#if dashData}
    <!-- Stats cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

      <!-- Total reuniões -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
        <span class="text-sm text-gray-500 font-medium">Total de Reuniões</span>
        <span class="text-4xl font-bold text-blue-600">{dashData.totalReunioes}</span>
        {#if dashData.filterDescription}
          <span class="text-xs text-gray-400">{dashData.filterDescription}</span>
        {/if}
      </div>

      <!-- Filter description placeholder card -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
        <span class="text-sm text-gray-500 font-medium">Filtro Ativo</span>
        <span class="text-base font-semibold text-gray-700">
          {dashData.filterDescription || 'Todos os dados'}
        </span>
      </div>

      <!-- Última reunião -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
        <span class="text-sm text-gray-500 font-medium">Última Reunião</span>
        {#if dashData.ultimaReuniaoData}
          <span class="text-base font-semibold text-gray-700">
            {dashData.ultimaReuniaoData.data}
            {#if dashData.ultimaReuniaoData.hora}
              às {dashData.ultimaReuniaoData.hora}
            {/if}
          </span>
          {#if dashData.ultimaReuniaoData.projetos?.length}
            <span class="text-xs text-gray-500">
              Projetos: {dashData.ultimaReuniaoData.projetos.join(', ')}
            </span>
          {/if}
          {#if dashData.ultimaReuniaoData.participantes?.length}
            <span class="text-xs text-gray-500">
              Participantes: {dashData.ultimaReuniaoData.participantes.join(', ')}
            </span>
          {/if}
        {:else}
          <span class="text-sm text-gray-400 italic">Nenhuma reunião registrada</span>
        {/if}
      </div>

    </div>

    <!-- Charts grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- 1. Reuniões por Mês — full width -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 md:col-span-2">
        <canvas bind:this={canvasPorMes}></canvas>
      </div>

      <!-- 2. Top Participantes -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <canvas bind:this={canvasTopParticipantes}></canvas>
      </div>

      <!-- 3. Top Projetos -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <canvas bind:this={canvasTopProjetos}></canvas>
      </div>

      <!-- 4. Horários -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <canvas bind:this={canvasHorasFreq}></canvas>
      </div>

      <!-- 5. Dias da Semana -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <canvas bind:this={canvasDiasFreq}></canvas>
      </div>

      <!-- 6. Projetos por Período — full width -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 md:col-span-2">
        <canvas bind:this={canvasProjetosStack}></canvas>
      </div>

      <!-- 7. Top Projetos Pizza -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <canvas bind:this={canvasTopProjetosPizza}></canvas>
      </div>

      <!-- 8. Top Participantes Pizza -->
      <div class="bg-white rounded-xl border border-gray-200 p-4">
        <canvas bind:this={canvasTopParticipantesPizza}></canvas>
      </div>

    </div>
  {/if}

</div>
