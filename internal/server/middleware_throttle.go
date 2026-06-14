package server

import (
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	throttleMaxFailures = 5
	throttleLockoutDur  = 30 * time.Minute
)

type ipState struct {
	failures int
	lockedAt time.Time
}

// Throttle tracks failed-login attempts per IP and enforces a 30-minute
// lockout after 5 consecutive failures. Attached to the login route only.
type Throttle struct {
	mu         sync.Mutex
	states     map[string]*ipState
	trustProxy bool
}

// NewThrottle creates a Throttle. trustProxy should be cfg.TrustProxyHeaders.
func NewThrottle(trustProxy bool) *Throttle {
	t := &Throttle{
		states:     make(map[string]*ipState),
		trustProxy: trustProxy,
	}
	go t.sweepLoop()
	return t
}

// Allow returns true if the IP is not currently locked out.
func (t *Throttle) Allow(r *http.Request) bool {
	ip := t.realIP(r)
	t.mu.Lock()
	defer t.mu.Unlock()
	state, ok := t.states[ip]
	if !ok || state.failures < throttleMaxFailures {
		return true
	}
	return time.Since(state.lockedAt) >= throttleLockoutDur
}

// RecordFailure increments the failure counter for the request's IP.
func (t *Throttle) RecordFailure(r *http.Request) {
	ip := t.realIP(r)
	t.mu.Lock()
	defer t.mu.Unlock()
	state, ok := t.states[ip]
	if !ok {
		state = &ipState{}
		t.states[ip] = state
	}
	state.failures++
	if state.failures == throttleMaxFailures {
		state.lockedAt = time.Now()
	}
}

// RecordSuccess resets the failure counter.
func (t *Throttle) RecordSuccess(r *http.Request) {
	ip := t.realIP(r)
	t.mu.Lock()
	delete(t.states, ip)
	t.mu.Unlock()
}

// RetryAfter returns seconds until lockout expires.
func (t *Throttle) RetryAfter(r *http.Request) int {
	ip := t.realIP(r)
	t.mu.Lock()
	defer t.mu.Unlock()
	state, ok := t.states[ip]
	if !ok || state.failures < throttleMaxFailures {
		return 0
	}
	remaining := throttleLockoutDur - time.Since(state.lockedAt)
	if remaining < 0 {
		return 0
	}
	return int(remaining.Seconds()) + 1
}

func (t *Throttle) realIP(r *http.Request) string {
	if t.trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			last := xff
			if i := len(xff) - 1; i >= 0 {
				for i >= 0 && xff[i] != ',' {
					i--
				}
				last = xff[i+1:]
			}
			if ip := net.ParseIP(strings.TrimSpace(last)); ip != nil {
				return ip.String()
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (t *Throttle) sweepLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-throttleLockoutDur)
		t.mu.Lock()
		for ip, state := range t.states {
			if state.failures >= throttleMaxFailures && state.lockedAt.Before(cutoff) {
				delete(t.states, ip)
			}
		}
		t.mu.Unlock()
	}
}

// ThrottleHeader writes Retry-After header and returns 429.
func ThrottleHeader(w http.ResponseWriter, retryAfter int) {
	w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
	http.Error(w, "too many failed login attempts; tente novamente mais tarde", http.StatusTooManyRequests)
}
