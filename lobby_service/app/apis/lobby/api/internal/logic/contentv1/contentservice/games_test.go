package contentservice

import (
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/svc"
	"context"
	"google.golang.org/protobuf/encoding/protojson"
	"strings"
	"testing"
)

func TestGamesFiltersHiddenKeepsComingSoonAndSorts(t *testing.T) {
	hidden := false
	c := config.Config{Game: config.GameConfig{ServiceToken: "private-token", Games: map[string]config.GameEntry{
		"AG1": {Enabled: true, Name: "one", Sort: 2, URL: "http://private-entry/", APIURL: "http://private-api/"},
		"AG2": {Enabled: false, Name: "two", Sort: 1},
		"AG3": {Enabled: true, Name: "hidden", Visible: &hidden, Sort: 0},
		"AG4": {Name: "four", Sort: 1},
	}}}
	out, err := New(&svc.ServiceContext{Config: c}).Games(context.Background(), nil)
	if err != nil || len(out.Games) != 3 || out.Games[0].Id != "AG2" || out.Games[1].Id != "AG4" || out.Games[2].Id != "AG1" || out.Games[0].Enabled {
		t.Fatal(out, err)
	}
	b, err := protojson.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range []string{"private-token", "private-entry", "private-api", "hidden"} {
		if strings.Contains(string(b), s) {
			t.Fatal("private field exposed", s)
		}
	}
}
