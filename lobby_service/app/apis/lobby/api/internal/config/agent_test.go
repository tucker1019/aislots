package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAgentConfig(t *testing.T) {
	c, e := LoadAgent("../../../../../../etc/agent.json")
	if e != nil || c.Version == "" {
		t.Fatal(c, e)
	}
	for _, b := range []string{`{}`, `{"version":"v1","providers":{"AG":[]}}`, `{"version":"v1","providers":{"AG":[{"threshold":1,"rate":10001}]}}`, `{"version":"v1","providers":{"AG":[{"threshold":2,"rate":30},{"threshold":1,"rate":20}]}}`} {
		p := filepath.Join(t.TempDir(), "agent.json")
		if e = os.WriteFile(p, []byte(b), 0o600); e != nil {
			t.Fatal(e)
		}
		if _, e = LoadAgent(p); e == nil {
			t.Fatal(b)
		}
	}
}
