package store

import (
	"path/filepath"
	"testing"
)

func TestGetAutosaveIntervalSeconds_Defaults(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "t.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	got, err := GetAutosaveIntervalSeconds(db)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != DefaultAutosaveIntervalSeconds {
		t.Errorf("got %d, want default %d", got, DefaultAutosaveIntervalSeconds)
	}
}

func TestSetAndGetAutosaveIntervalSeconds(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "t.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	if err := SetSetting(db, SettingAutosaveIntervalSeconds, "30"); err != nil {
		t.Fatalf("SetSetting: %v", err)
	}

	got, err := GetAutosaveIntervalSeconds(db)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != 30 {
		t.Errorf("got %d, want 30", got)
	}
}

func TestGetAutosaveIntervalSeconds_OutOfRange(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "t.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	if err := SetSetting(db, SettingAutosaveIntervalSeconds, "9999"); err != nil {
		t.Fatalf("SetSetting: %v", err)
	}

	got, err := GetAutosaveIntervalSeconds(db)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != DefaultAutosaveIntervalSeconds {
		t.Errorf("got %d, want default %d", got, DefaultAutosaveIntervalSeconds)
	}
}

func TestGetAutosaveIntervalSeconds_NonNumeric(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "t.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	if err := SetSetting(db, SettingAutosaveIntervalSeconds, "bogus"); err != nil {
		t.Fatalf("SetSetting: %v", err)
	}

	got, err := GetAutosaveIntervalSeconds(db)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != DefaultAutosaveIntervalSeconds {
		t.Errorf("got %d, want default %d", got, DefaultAutosaveIntervalSeconds)
	}
}

func TestSetSetting_Upsert(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "t.sqlite"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer db.Close()

	if err := SetSetting(db, "mykey", "first"); err != nil {
		t.Fatalf("SetSetting first: %v", err)
	}
	if err := SetSetting(db, "mykey", "second"); err != nil {
		t.Fatalf("SetSetting second: %v", err)
	}

	got, ok, err := GetSetting(db, "mykey")
	if err != nil {
		t.Fatalf("GetSetting: %v", err)
	}
	if !ok {
		t.Fatal("expected ok=true")
	}
	if got != "second" {
		t.Errorf("got %q, want %q", got, "second")
	}
}
