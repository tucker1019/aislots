package postgres

import (
	"aislots/slots_service/internal/application/play"
	"encoding/json"
	"reflect"
	"testing"
)

func TestReceiptReferencePreservesResponseOverridesAndRejectsMissingFrame(t *testing.T) {
	f := play.Frame{BetID: "bet", SpinIndex: 0, StepIndex: 1, Balance: 90,
		BottomSymbols: []int{1, 2, 3, 4, 5}, GameData: json.RawMessage(`{"feature":3}`),
		Next: &play.Cursor{SpinIndex: 0, StepIndex: 2}}
	source, err := json.Marshal(f)
	if err != nil {
		t.Fatal(err)
	}
	f.Next, f.RequestID, f.NextRequestID, f.Balance = nil, "request", "next", 125
	want := play.SpinReceipt{BuyMode: 2, Amount: 100, Frame: f}
	raw, err := encodeSpinReceipt(want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := decodeSpinReceipt(raw, source)
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatal("response changed", got, err)
	}
	if _, err = decodeSpinReceipt(raw, nil); err == nil {
		t.Fatal("missing source silently accepted")
	}
	if _, err = decodeSpinReceipt(raw, []byte(`{"betId":"other","stepIndex":1}`)); err == nil {
		t.Fatal("different source accepted")
	}
	for _, legacy := range []bool{false, true} {
		stored := raw
		if legacy {
			stored, _ = json.Marshal(want)
		}
		updated, err := receiptWithBalance(stored, 777)
		if err != nil {
			t.Fatal(err)
		}
		got, err = decodeSpinReceipt(updated, source)
		want.Frame.Balance = 777
		if err != nil || !reflect.DeepEqual(got, want) {
			t.Fatal("settlement balance patch lost data", legacy, got, err)
		}
	}
}

func TestReceiptLegacyStringMoneyStillReadable(t *testing.T) {
	r, err := decodeSpinReceipt([]byte(`{"Amount":100,"Frame":{"betId":"old","balance":"125","winAmount":"25"}}`), nil)
	if err != nil || r.Frame.Balance != 125 || r.Frame.WinAmount != 25 {
		t.Fatal(r, err)
	}
}
