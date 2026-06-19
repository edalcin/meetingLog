package store

import (
	"database/sql"
	"fmt"
	"math"
	"sort"
	"strconv"
	"time"

	"github.com/edalcin/meetinglog/internal/model"
)

// COLORS is the palette used for chart datasets, cycling when there are more
// series than colors.
var dashColors = []string{
	"#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ef4444",
	"#78716c", "#64748b", "#ec4899", "#8b5cf6", "#6366f1",
}

// GetDashboardOptions returns distinct years (descending), all projects, and
// all participants — the data needed to populate the filter dropdowns.
func GetDashboardOptions(db *sql.DB) (*model.DashboardOptions, error) {
	anosRows, err := db.Query(
		`SELECT DISTINCT strftime('%Y', data_hora) AS ano FROM reuniao ORDER BY ano DESC`)
	if err != nil {
		return nil, fmt.Errorf("GetDashboardOptions anos: %w", err)
	}
	defer anosRows.Close()
	var anos []string
	for anosRows.Next() {
		var a string
		if err := anosRows.Scan(&a); err != nil {
			return nil, fmt.Errorf("GetDashboardOptions ano scan: %w", err)
		}
		anos = append(anos, a)
	}
	anosRows.Close()

	projetoRows, err := db.Query(`SELECT id, nome, ativo FROM projeto ORDER BY nome ASC`)
	if err != nil {
		return nil, fmt.Errorf("GetDashboardOptions projetos: %w", err)
	}
	defer projetoRows.Close()
	var projetos []model.ParticipantSummary
	for projetoRows.Next() {
		var ps model.ParticipantSummary
		if err := projetoRows.Scan(&ps.ID, &ps.Nome, &ps.Ativo); err != nil {
			return nil, fmt.Errorf("GetDashboardOptions projeto scan: %w", err)
		}
		projetos = append(projetos, ps)
	}
	projetoRows.Close()

	partRows, err := db.Query(`SELECT id, nome, ativo FROM participante ORDER BY nome ASC`)
	if err != nil {
		return nil, fmt.Errorf("GetDashboardOptions participantes: %w", err)
	}
	defer partRows.Close()
	var participantes []model.ParticipantSummary
	for partRows.Next() {
		var ps model.ParticipantSummary
		if err := partRows.Scan(&ps.ID, &ps.Nome, &ps.Ativo); err != nil {
			return nil, fmt.Errorf("GetDashboardOptions participante scan: %w", err)
		}
		participantes = append(participantes, ps)
	}
	partRows.Close()

	return &model.DashboardOptions{
		Anos:          anos,
		Projetos:      projetos,
		Participantes: participantes,
	}, nil
}

// dashWhere returns the SQL WHERE fragment and bound arguments for the given
// filter type and value. Mirrors the JS buildWhere function exactly.
func dashWhere(filter, value string) (string, []any) {
	switch filter {
	case "year":
		return `WHERE strftime('%Y', r.data_hora) = ?`, []any{value}
	case "project":
		id, _ := strconv.ParseInt(value, 10, 64)
		return `WHERE EXISTS (SELECT 1 FROM reuniao_projeto rp0 WHERE rp0.reuniao_id = r.id AND rp0.projeto_id = ?)`, []any{id}
	case "participant":
		id, _ := strconv.ParseInt(value, 10, 64)
		return `WHERE EXISTS (SELECT 1 FROM reuniao_participante rpa0 WHERE rpa0.reuniao_id = r.id AND rpa0.participante_id = ?)`, []any{id}
	default:
		return "", nil
	}
}

// topN returns up to n entries from countMap sorted by count descending.
// Returns pairs of (id int64, count int).
type idCount struct {
	id    int64
	count int
}

func topN(countMap map[int64]int, n int) []idCount {
	pairs := make([]idCount, 0, len(countMap))
	for id, c := range countMap {
		pairs = append(pairs, idCount{id, c})
	}
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].count != pairs[j].count {
			return pairs[i].count > pairs[j].count
		}
		return pairs[i].id < pairs[j].id
	})
	if n < len(pairs) {
		pairs = pairs[:n]
	}
	return pairs
}

// linearTrend computes the least-squares regression line over yValues and
// returns the fitted y values rounded to one decimal place. Matches the JS
// implementation exactly.
func linearTrend(yValues []int) []float64 {
	n := len(yValues)
	if n == 0 {
		return nil
	}
	xSum := 0.0
	ySum := 0.0
	xySum := 0.0
	x2Sum := 0.0
	for i, y := range yValues {
		x := float64(i)
		xSum += x
		ySum += float64(y)
		xySum += x * float64(y)
		x2Sum += x * x
	}
	fn := float64(n)
	denom := fn*x2Sum - xSum*xSum
	result := make([]float64, n)
	if denom == 0 {
		avg := ySum / fn
		for i := range result {
			result[i] = math.Round(avg*10) / 10
		}
		return result
	}
	m := (fn*xySum - xSum*ySum) / denom
	b := (ySum - m*xSum) / fn
	for i := range result {
		result[i] = math.Round((m*float64(i)+b)*10) / 10
	}
	return result
}

// parseDataHora extracts parts from a SQLite datetime string "2006-01-02 15:04:05".
// Returns year, month, day, hour as integers plus "YYYY-MM" month key.
func parseDataHora(dh string) (year int, month time.Month, day, hour int, mesKey string) {
	if len(dh) < 13 {
		return
	}
	year, _ = strconv.Atoi(dh[0:4])
	monthInt, _ := strconv.Atoi(dh[5:7])
	month = time.Month(monthInt)
	day, _ = strconv.Atoi(dh[8:10])
	hour, _ = strconv.Atoi(dh[11:13])
	mesKey = dh[0:7]
	return
}

// GetDashboardData computes all aggregated statistics for the dashboard.
// filter is one of "all", "year", "project", "participant"; value is the
// corresponding filter value (empty string for "all").
func GetDashboardData(db *sql.DB, filter, value string) (*model.DashboardData, error) {
	where, whereArgs := dashWhere(filter, value)

	// -- Meeting rows -----------------------------------------------------------
	meetingRows, err := func() ([]struct{ id int64; dataHora string }, error) {
		rows, err := db.Query(
			fmt.Sprintf(`SELECT r.id, r.data_hora FROM reuniao r %s ORDER BY r.data_hora DESC`, where),
			whereArgs...,
		)
		if err != nil {
			return nil, fmt.Errorf("dashboard meetings: %w", err)
		}
		defer rows.Close()
		var out []struct{ id int64; dataHora string }
		for rows.Next() {
			var r struct{ id int64; dataHora string }
			if err := rows.Scan(&r.id, &r.dataHora); err != nil {
				return nil, fmt.Errorf("dashboard meeting scan: %w", err)
			}
			out = append(out, r)
		}
		return out, rows.Err()
	}()
	if err != nil {
		return nil, err
	}

	// -- Empty result -----------------------------------------------------------
	if len(meetingRows) == 0 {
		desc, err := filterDescription(db, filter, value)
		if err != nil {
			return nil, err
		}
		return &model.DashboardData{
			FilterDescription:     desc,
			TotalReunioes:         0,
			TopProjetos:           []model.TopEntry{},
			TopParticipantes:      []model.TopEntry{},
			UltimaReuniaoData:     nil,
			PorMes:                model.PorMesData{Labels: []string{}, Data: []int{}, Tendencia: []float64{}},
			HorasFreq:             make([]int, 24),
			DiasFreq:              make([]int, 7),
			ProjetosStack:         model.ProjetosStackData{Labels: []string{}, Datasets: []model.StackDataset{}},
			TopProjetosPizza:      model.PizzaData{Labels: []string{}, Data: []int{}},
			TopParticipantesPizza: model.PizzaData{Labels: []string{}, Data: []int{}},
		}, nil
	}

	// -- Project rows -----------------------------------------------------------
	type projetoRow struct {
		reuniaoID  int64
		projetoID  int64
		projetoNome string
	}
	projetoRows, err := func() ([]projetoRow, error) {
		rows, err := db.Query(fmt.Sprintf(`
			SELECT rp.reuniao_id, pr.id AS projeto_id, pr.nome AS projeto_nome
			FROM reuniao r
			JOIN reuniao_projeto rp ON rp.reuniao_id = r.id
			JOIN projeto pr ON pr.id = rp.projeto_id
			%s`, where), whereArgs...)
		if err != nil {
			return nil, fmt.Errorf("dashboard projetos: %w", err)
		}
		defer rows.Close()
		var out []projetoRow
		for rows.Next() {
			var r projetoRow
			if err := rows.Scan(&r.reuniaoID, &r.projetoID, &r.projetoNome); err != nil {
				return nil, fmt.Errorf("dashboard projeto scan: %w", err)
			}
			out = append(out, r)
		}
		return out, rows.Err()
	}()
	if err != nil {
		return nil, err
	}

	// -- Participant rows -------------------------------------------------------
	type participanteRow struct {
		reuniaoID       int64
		participanteID  int64
		participanteNome string
	}
	participanteRows, err := func() ([]participanteRow, error) {
		rows, err := db.Query(fmt.Sprintf(`
			SELECT rpa.reuniao_id, pa.id AS participante_id, pa.nome AS participante_nome
			FROM reuniao r
			JOIN reuniao_participante rpa ON rpa.reuniao_id = r.id
			JOIN participante pa ON pa.id = rpa.participante_id
			%s`, where), whereArgs...)
		if err != nil {
			return nil, fmt.Errorf("dashboard participantes: %w", err)
		}
		defer rows.Close()
		var out []participanteRow
		for rows.Next() {
			var r participanteRow
			if err := rows.Scan(&r.reuniaoID, &r.participanteID, &r.participanteNome); err != nil {
				return nil, fmt.Errorf("dashboard participante scan: %w", err)
			}
			out = append(out, r)
		}
		return out, rows.Err()
	}()
	if err != nil {
		return nil, err
	}

	// -- Build lookup maps ------------------------------------------------------
	type projetoInfo struct{ id int64; nome string }
	type partInfo struct{ id int64; nome string }

	projetosByMeeting := make(map[int64][]projetoInfo)
	for _, row := range projetoRows {
		projetosByMeeting[row.reuniaoID] = append(projetosByMeeting[row.reuniaoID], projetoInfo{row.projetoID, row.projetoNome})
	}

	participantesByMeeting := make(map[int64][]partInfo)
	for _, row := range participanteRows {
		participantesByMeeting[row.reuniaoID] = append(participantesByMeeting[row.reuniaoID], partInfo{row.participanteID, row.participanteNome})
	}

	// -- Aggregate --------------------------------------------------------------
	projetoCount := make(map[int64]int)
	projetoNames := make(map[int64]string)
	participanteCount := make(map[int64]int)
	participanteNames := make(map[int64]string)
	mesCount := make(map[string]int)
	horasFreq := make([]int, 24)
	diasFreq := make([]int, 7)
	// projetoByYear[projetoID][year] = count
	projetoByYear := make(map[int64]map[string]int)

	for _, m := range meetingRows {
		year, month, day, hour, mesKey := parseDataHora(m.dataHora)

		mesCount[mesKey]++
		if hour >= 0 && hour < 24 {
			horasFreq[hour]++
		}

		// Day of week: Go's Weekday() returns Sunday=0, same as JS getDay().
		dow := time.Date(year, month, day, 12, 0, 0, 0, time.UTC).Weekday()
		diasFreq[int(dow)]++

		ano := m.dataHora[0:4]

		for _, p := range projetosByMeeting[m.id] {
			projetoCount[p.id]++
			projetoNames[p.id] = p.nome

			if projetoByYear[p.id] == nil {
				projetoByYear[p.id] = make(map[string]int)
			}
			projetoByYear[p.id][ano]++
		}

		for _, pa := range participantesByMeeting[m.id] {
			participanteCount[pa.id]++
			participanteNames[pa.id] = pa.nome
		}
	}

	total := len(meetingRows)

	// -- Top 10 lists ----------------------------------------------------------
	top10ProjetosPairs := topN(projetoCount, 10)
	topProjetos := make([]model.TopEntry, len(top10ProjetosPairs))
	for i, p := range top10ProjetosPairs {
		topProjetos[i] = model.TopEntry{
			Nome:    projetoNames[p.id],
			Count:   p.count,
			Percent: math.Round(float64(p.count)/float64(total)*1000) / 10,
		}
	}

	top10PartPairs := topN(participanteCount, 10)
	topParticipantes := make([]model.TopEntry, len(top10PartPairs))
	for i, p := range top10PartPairs {
		topParticipantes[i] = model.TopEntry{
			Nome:    participanteNames[p.id],
			Count:   p.count,
			Percent: math.Round(float64(p.count)/float64(total)*1000) / 10,
		}
	}

	// -- Last meeting ----------------------------------------------------------
	ultima := meetingRows[0]
	dh := ultima.dataHora
	ultimaData := dh[8:10] + "/" + dh[5:7] + "/" + dh[0:4]
	ultimaHora := dh[11:16]

	var ultimaProjetos []string
	for _, p := range projetosByMeeting[ultima.id] {
		ultimaProjetos = append(ultimaProjetos, p.nome)
	}
	var ultimaParticipantes []string
	for _, pa := range participantesByMeeting[ultima.id] {
		ultimaParticipantes = append(ultimaParticipantes, pa.nome)
	}

	pautaRows, err := db.Query(
		`SELECT texto FROM pauta WHERE reuniao_id = ? ORDER BY ordem`, ultima.id)
	if err != nil {
		return nil, fmt.Errorf("dashboard pautas: %w", err)
	}
	defer pautaRows.Close()
	var ultimaPautas []string
	for pautaRows.Next() {
		var t string
		if err := pautaRows.Scan(&t); err != nil {
			return nil, fmt.Errorf("dashboard pauta scan: %w", err)
		}
		ultimaPautas = append(ultimaPautas, t)
	}
	pautaRows.Close()

	// -- Por mês ---------------------------------------------------------------
	sortedMeses := make([]string, 0, len(mesCount))
	for k := range mesCount {
		sortedMeses = append(sortedMeses, k)
	}
	sort.Strings(sortedMeses)
	porMesValues := make([]int, len(sortedMeses))
	for i, k := range sortedMeses {
		porMesValues[i] = mesCount[k]
	}

	// -- Projetos stack chart --------------------------------------------------
	allYearsSet := make(map[string]bool)
	for _, m := range meetingRows {
		allYearsSet[m.dataHora[0:4]] = true
	}
	allYears := make([]string, 0, len(allYearsSet))
	for y := range allYearsSet {
		allYears = append(allYears, y)
	}
	sort.Strings(allYears)

	top10ProjetoIDs := make([]int64, len(top10ProjetosPairs))
	top10ProjetoLabels := make([]string, len(top10ProjetosPairs))
	for i, p := range top10ProjetosPairs {
		top10ProjetoIDs[i] = p.id
		top10ProjetoLabels[i] = projetoNames[p.id]
	}

	stackDatasets := make([]model.StackDataset, len(allYears))
	for yi, year := range allYears {
		data := make([]int, len(top10ProjetoIDs))
		for i, pid := range top10ProjetoIDs {
			if byYear, ok := projetoByYear[pid]; ok {
				data[i] = byYear[year]
			}
		}
		stackDatasets[yi] = model.StackDataset{
			Label:           year,
			Data:            data,
			BackgroundColor: dashColors[yi%len(dashColors)],
		}
	}

	// -- Filter description ----------------------------------------------------
	desc, err := filterDescription(db, filter, value)
	if err != nil {
		return nil, err
	}

	// -- Pizza data ------------------------------------------------------------
	topProjetosPizzaLabels := make([]string, len(topProjetos))
	topProjetosPizzaData := make([]int, len(topProjetos))
	for i, p := range topProjetos {
		topProjetosPizzaLabels[i] = p.Nome
		topProjetosPizzaData[i] = p.Count
	}

	topPartPizzaLabels := make([]string, len(topParticipantes))
	topPartPizzaData := make([]int, len(topParticipantes))
	for i, p := range topParticipantes {
		topPartPizzaLabels[i] = p.Nome
		topPartPizzaData[i] = p.Count
	}

	return &model.DashboardData{
		FilterDescription: desc,
		TotalReunioes:     total,
		TopProjetos:       topProjetos,
		TopParticipantes:  topParticipantes,
		UltimaReuniaoData: &model.UltimaReuniao{
			Data:          ultimaData,
			Hora:          ultimaHora,
			Projetos:      coalesceStrSlice(ultimaProjetos),
			Participantes: coalesceStrSlice(ultimaParticipantes),
			Pautas:        coalesceStrSlice(ultimaPautas),
		},
		PorMes: model.PorMesData{
			Labels:    sortedMeses,
			Data:      porMesValues,
			Tendencia: linearTrend(porMesValues),
		},
		HorasFreq: horasFreq,
		DiasFreq:  diasFreq,
		ProjetosStack: model.ProjetosStackData{
			Labels:   top10ProjetoLabels,
			Datasets: stackDatasets,
		},
		TopProjetosPizza: model.PizzaData{
			Labels: topProjetosPizzaLabels,
			Data:   topProjetosPizzaData,
		},
		TopParticipantesPizza: model.PizzaData{
			Labels: topPartPizzaLabels,
			Data:   topPartPizzaData,
		},
	}, nil
}

// filterDescription builds the human-readable description for the applied filter.
// For project/participant filters, the name is looked up from the DB.
func filterDescription(db *sql.DB, filter, value string) (string, error) {
	switch filter {
	case "year":
		return "Ano: " + value, nil
	case "project":
		id, _ := strconv.ParseInt(value, 10, 64)
		var nome string
		err := db.QueryRow(`SELECT nome FROM projeto WHERE id = ?`, id).Scan(&nome)
		if err == sql.ErrNoRows {
			return "Projeto: " + value, nil
		}
		if err != nil {
			return "", fmt.Errorf("filterDescription projeto: %w", err)
		}
		return "Projeto: " + nome, nil
	case "participant":
		id, _ := strconv.ParseInt(value, 10, 64)
		var nome string
		err := db.QueryRow(`SELECT nome FROM participante WHERE id = ?`, id).Scan(&nome)
		if err == sql.ErrNoRows {
			return "Participante: " + value, nil
		}
		if err != nil {
			return "", fmt.Errorf("filterDescription participante: %w", err)
		}
		return "Participante: " + nome, nil
	default:
		return "Todos os dados", nil
	}
}

// coalesceStrSlice returns an empty non-nil slice when s is nil, so JSON
// serializes as [] rather than null.
func coalesceStrSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
