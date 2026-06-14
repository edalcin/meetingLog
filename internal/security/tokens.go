package security

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
)

// NewToken returns n cryptographically random bytes encoded as base64url
// (unpadded). Panics if crypto/rand fails (OS-level error).
func NewToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic("security.NewToken: crypto/rand failed: " + err.Error())
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// NewHexToken returns n cryptographically random bytes encoded as hex.
// Used for share link tokens (short, URL-safe, 20 bytes = 40 hex chars).
func NewHexToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic("security.NewHexToken: crypto/rand failed: " + err.Error())
	}
	return hex.EncodeToString(b)
}
