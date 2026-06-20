package store

import (
	"database/sql"
	"path/filepath"
	"testing"
)

// seedParticipant creates a participant and returns its id.
func seedParticipant(t *testing.T, db *sql.DB, nome string) int64 {
	t.Helper()
	p, err := CreateParticipant(db, nome, nil, nil, nil, nil, nil, true)
	if err != nil {
		t.Fatalf("CreateParticipant %q: %v", nome, err)
	}
	return p.ID
}

// seedMeeting creates a meeting with given participant IDs and returns the meeting ID.
func seedMeeting(t *testing.T, db *sql.DB, dataHora string, partIDs []int64) int64 {
	t.Helper()
	m, _, err := CreateMeeting(db, dataHora, "Presencial", nil, partIDs, nil, nil, nil)
	if err != nil {
		t.Fatalf("CreateMeeting: %v", err)
	}
	return m.ID
}

func TestReplaceParticipant_DryRun(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "t.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	fromID := seedParticipant(t, db, "Alice")
	toID := seedParticipant(t, db, "Bob")

	// Two meetings: one with both participants, one with only fromID.
	seedMeeting(t, db, "2024-01-01 10:00", []int64{fromID, toID})
	seedMeeting(t, db, "2024-01-02 10:00", []int64{fromID})

	result, err := ReplaceParticipant(db, fromID, toID, true)
	if err != nil {
		t.Fatalf("ReplaceParticipant dry_run: %v", err)
	}
	if result.Count != 2 {
		t.Errorf("dry_run count = %d, want 2", result.Count)
	}

	// Dry run must NOT mutate: fromID still has rows.
	var cnt int
	if err := db.QueryRow(`SELECT COUNT(*) FROM reuniao_participante WHERE participante_id = ?`, fromID).Scan(&cnt); err != nil {
		t.Fatalf("count query: %v", err)
	}
	if cnt == 0 {
		t.Error("dry_run mutated the table: fromID rows gone")
	}
}

func TestReplaceParticipant_Execute(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "t.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	fromID := seedParticipant(t, db, "Alice")
	toID := seedParticipant(t, db, "Bob")

	// Meeting 1: both participants (toID already present — tests conflict avoidance)
	m1 := seedMeeting(t, db, "2024-01-01 10:00", []int64{fromID, toID})
	// Meeting 2: only fromID
	m2 := seedMeeting(t, db, "2024-01-02 10:00", []int64{fromID})

	_, err = ReplaceParticipant(db, fromID, toID, false)
	if err != nil {
		t.Fatalf("ReplaceParticipant execute: %v", err)
	}

	// fromID must have no rows at all.
	var fromCnt int
	if err := db.QueryRow(`SELECT COUNT(*) FROM reuniao_participante WHERE participante_id = ?`, fromID).Scan(&fromCnt); err != nil {
		t.Fatalf("fromID count query: %v", err)
	}
	if fromCnt != 0 {
		t.Errorf("fromID still has %d row(s), want 0", fromCnt)
	}

	// toID must appear in both meetings — no duplicate PK.
	for _, meetingID := range []int64{m1, m2} {
		var present int
		if err := db.QueryRow(
			`SELECT COUNT(*) FROM reuniao_participante WHERE reuniao_id = ? AND participante_id = ?`,
			meetingID, toID,
		).Scan(&present); err != nil {
			t.Fatalf("toID presence query: %v", err)
		}
		if present != 1 {
			t.Errorf("meeting %d: toID present=%d, want 1", meetingID, present)
		}
	}
}
