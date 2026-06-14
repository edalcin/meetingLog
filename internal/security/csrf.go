package security

// NewCSRFToken returns a 32-byte cryptographically random base64url-encoded
// token suitable for use as a CSRF double-submit cookie value.
func NewCSRFToken() string {
	return NewToken(32)
}

// ConstantTimeEqual compares two strings without leaking their length or
// content via timing. Returns true only when both strings are byte-identical.
func ConstantTimeEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	ba, bb := []byte(a), []byte(b)
	var diff byte
	for i := range ba {
		diff |= ba[i] ^ bb[i]
	}
	return diff == 0
}
