package bet

import (
	"encoding/json"
	"testing"

	game "aislots/slots_service/internal/domain/game"
)

func TestPlatformResponseKeepsModuleWirePayload(t *testing.T) {
	response := Response{RoundID: "round", Status: Settled, Result: &game.Result{SchemaVersion: 1, Payload: json.RawMessage(`{"gameId":"AG1","mode":"free","round":{"steps":[]}}`)}}
	raw, err := json.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	var wire struct{ Result map[string]json.RawMessage }
	if err = json.Unmarshal(raw, &wire); err != nil {
		t.Fatal(err)
	}
	if string(wire.Result["mode"]) != `"free"` || wire.Result["round"] == nil || wire.Result["schemaVersion"] != nil || wire.Result["payload"] != nil {
		t.Fatal("internal envelope leaked into platform API", string(raw))
	}
}
