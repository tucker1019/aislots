package ag8

import (
	"encoding/json"
	"os"
	"testing"
)

func TestClientExamples(t *testing.T) {
	type exampleFrame struct {
		Step    int     `json:"stepIndex"`
		Charge  int64   `json:"chargeAmount"`
		Win     int64   `json:"winAmount"`
		Balance int64   `json:"balance"`
		Next    string  `json:"nextAction"`
		Display Display `json:"display"`
	}
	type example struct {
		BuyMode int            `json:"buyMode"`
		Bet     int64          `json:"betAmount"`
		Win     int64          `json:"totalWinAmount"`
		Frames  []exampleFrame `json:"frames"`
	}
	examples := map[string]example{}
	for _, tc := range []struct {
		name, raw    string
		feature, hit bool
		mode         int
		stake        int64
	}{
		{"normal_loss", "2", false, false, 1, 50},
		{"normal_coin", "2", false, true, 1, 50},
		{"boost_coin", "2", false, true, 2, 250},
		{"eight_free_coin", "2", true, true, 1, 50},
		{"eight_free_losses", "2", true, false, 1, 50},
		{"normal_free_cap", "500", true, true, 1, 50},
		{"boost_free_cap", "500", true, true, 2, 250},
	} {
		r, reader := fixed(t, tc.feature, tc.hit, tc.raw)
		reader.source = zeroReader{}
		out := draw(t, r, tc.stake, tc.mode)
		balance := int64(500000)
		sample := example{BuyMode: tc.mode, Bet: tc.stake, Win: out.WinMinorUnits, Frames: []exampleFrame{}}
		for i, f := range out.Frames {
			charge := int64(0)
			if i == 0 {
				charge = tc.stake
			}
			balance += f.WinMinorUnits - charge
			sample.Frames = append(sample.Frames, exampleFrame{i + 1, charge, f.WinMinorUnits, balance, f.NextAction, display(t, f)})
		}
		examples[tc.name] = sample
	}
	raw, err := json.MarshalIndent(examples, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	raw = append(raw, '\n')
	file := "../../../testdata/ag8-client-examples.json"
	if os.Getenv("AG8_WRITE_EXAMPLES") == "1" {
		if err = os.WriteFile(file, raw, 0644); err != nil {
			t.Fatal(err)
		}
	}
	expected, err := os.ReadFile(file)
	if err != nil {
		t.Fatal("generate with AG8_WRITE_EXAMPLES=1", err)
	}
	if string(expected) != string(raw) {
		t.Fatal("AG8 client examples are stale")
	}
}
