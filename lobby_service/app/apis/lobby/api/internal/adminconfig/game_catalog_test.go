package adminconfig

import (
	"encoding/json"
	"testing"
)

func TestMergeGameCatalogPreservesOperationsAndIdentity(t *testing.T) {
	old := json.RawMessage(`{"appname":"live","appkey":"web","country":"ID","currency":"IDR","games":{"AG1":{"enabled":false,"visible":false,"sort":99,"url":"https://custom.example/","name":"custom"}}}`)
	seed := json.RawMessage(`{"appname":"defaults","games":{"AG1":{"enabled":true,"visible":true,"sort":10,"url":"http://default.example/","name":"default","nameEn":"One","cover":"/assets/one.png","provider":"AG","apiUrl":""},"AG2":{"enabled":false,"visible":true,"sort":20,"url":"","name":"Two","nameEn":"Two","cover":"/assets/two.png","provider":"AG","apiUrl":""}}}`)
	out, err := MergeGameCatalog(old, seed)
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		AppName string `json:"appname"`
		Games   map[string]struct {
			Enabled, Visible bool
			Sort             int
			URL, Name, Cover string
		}
	}
	if err = json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	if got.AppName != "live" || got.Games["AG1"].Enabled || got.Games["AG1"].Visible || got.Games["AG1"].Sort != 99 || got.Games["AG1"].URL != "https://custom.example/" || got.Games["AG1"].Name != "custom" || got.Games["AG1"].Cover != "/assets/one.png" || len(got.Games) != 2 {
		t.Fatal(string(out))
	}
	again, err := MergeGameCatalog(out, seed)
	if err != nil || string(again) != string(out) {
		t.Fatal("merge not idempotent", err)
	}
}
