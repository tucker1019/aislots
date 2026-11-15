package play

import (
	"aislots/slots_service/internal/engine"
	"encoding/json"
	"testing"
)

func TestPersistedPaidReplayDetailsRespectCap(t *testing.T) {
	f := ReplayFrame{PayoutUnit: "10", LineCount: 10, Frame: Frame{BetAmount: 100, WinAmount: 30000, SpinIndex: 0, StepIndex: 4, Wins: []engine.Win{{Symbol: 19, Columns: 1, Ways: 1, RawPayout: "2000"}, {Symbol: 19, Columns: 1, Ways: 1, RawPayout: "2000"}}}}
	f.GameData = json.RawMessage(`{"replay":{"payouts":[{"symbolId":19,"columns":1,"ways":1,"rawPayout":"2000","amount":"20000"},{"symbolId":19,"columns":1,"ways":1,"rawPayout":"2000","amount":"10000"}]}}`)
	if err := decorateHistoryFrame(&f); err != nil || len(f.Payouts) != 2 || f.Payouts[1].Amount != "10000" {
		t.Fatal(f, err)
	}
	f.WinAmount++
	if decorateHistoryFrame(&f) == nil {
		t.Fatal("replay credit mismatch accepted")
	}
	f.WinAmount--
	f.Wins[1].Symbol = 18
	if decorateHistoryFrame(&f) == nil {
		t.Fatal("payout identity mismatch accepted")
	}
}
