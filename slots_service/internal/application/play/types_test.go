package play

import (
	"encoding/json"
	"testing"
)

func TestFrameUnmarshalLegacyStringAmounts(t *testing.T) {
	var frame Frame
	if err := json.Unmarshal([]byte(`{"balance":"1398435","betAmount":"7000","winAmount":"0","totalWinAmount":"2100","spinWinAmount":"2100"}`), &frame); err != nil {
		t.Fatal(err)
	}
	if frame.Balance != 1398435 || frame.BetAmount != 7000 || frame.WinAmount != 0 || frame.TotalWinAmount != 2100 || frame.SpinWinAmount != 2100 {
		t.Fatalf("unexpected decoded amounts: %+v", frame)
	}
	encoded, err := json.Marshal(frame)
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]json.RawMessage
	if err = json.Unmarshal(encoded, &got); err != nil {
		t.Fatal(err)
	}
	if string(got["balance"]) != "1398435" {
		t.Fatalf("balance should be emitted as JSON number: %s", got["balance"])
	}
}
