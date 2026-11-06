package server

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

func TestLiveHandlerPreservesInFlightSnapshot(t *testing.T) {
	var h LiveHandler
	entered := make(chan struct{})
	release := make(chan struct{})
	done := make(chan string)
	h.Store(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { close(entered); <-release; w.Write([]byte("old")) }))
	go func() {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
		done <- w.Body.String()
	}()
	<-entered
	h.Store(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("new")) }))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
	if w.Body.String() != "new" {
		t.Fatal(w.Body.String())
	}
	close(release)
	if v := <-done; v != "old" {
		t.Fatal(v)
	}
}
func TestLiveHandlerConcurrentSwitch(t *testing.T) {
	var h LiveHandler
	var group sync.WaitGroup
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })
	h.Store(handler)
	for i := 0; i < 20; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			for j := 0; j < 30; j++ {
				h.Store(handler)
				w := httptest.NewRecorder()
				h.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
				if w.Code != 204 {
					t.Errorf("code %d", w.Code)
				}
			}
		}()
	}
	group.Wait()
}
