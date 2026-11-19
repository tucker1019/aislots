package postgres

import (
	"aislots/slots_service/internal/application/play"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// Keep the Frame locator and next token in the existing JSON paths so both
// receipt indexes remain usable without rebuilding large tables at startup.
const receiptSelect = `SELECT r.data,f.response FROM spin_request_receipts r
LEFT JOIN spin_steps f ON r.data->>'StorageVersion'='1'
 AND f.bet_id=r.data->'Frame'->>'betId'
 AND f.spin_index=(r.data->'Frame'->>'spinIndex')::integer
 AND f.step_index=(r.data->'Frame'->>'stepIndex')::integer`

type receiptFrameRef struct {
	BetID         string       `json:"betId"`
	SpinIndex     int          `json:"spinIndex"`
	StepIndex     int          `json:"stepIndex"`
	RequestID     string       `json:"requestId,omitempty"`
	NextRequestID string       `json:"nextRequestId,omitempty"`
	Next          *play.Cursor `json:"next,omitempty"`
	Balance       int64        `json:"balance"`
}

type storedReceipt struct {
	StorageVersion int
	BuyMode        int `json:",omitempty"`
	Amount         int64
	Frame          receiptFrameRef
}

func encodeSpinReceipt(r play.SpinReceipt) ([]byte, error) {
	f := r.Frame
	if r.ReplayOmitted {
		// This is a terminal no-award receipt, not a replay frame. Keep the old
		// envelope readable across upgrades and preserve only idempotency/money.
		return json.Marshal(map[string]any{
			"ReplayOmitted": true, "Amount": r.Amount, "BuyMode": r.BuyMode,
			"Frame": map[string]any{"betId": f.BetID, "spinIndex": f.SpinIndex, "stepIndex": f.StepIndex,
				"mode": f.Mode, "status": f.Status, "nextAction": f.NextAction, "betAmount": f.BetAmount,
				"balance": f.Balance, "requestId": f.RequestID, "nextRequestId": f.NextRequestID},
		})
	}
	return json.Marshal(storedReceipt{1, r.BuyMode, r.Amount, receiptFrameRef{
		BetID: f.BetID, SpinIndex: f.SpinIndex, StepIndex: f.StepIndex,
		RequestID: f.RequestID, NextRequestID: f.NextRequestID, Next: f.Next, Balance: f.Balance,
	}})
}

func readSpinReceipt(row pgx.Row) (play.SpinReceipt, bool, error) {
	var raw, frame []byte
	if err := row.Scan(&raw, &frame); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return play.SpinReceipt{}, false, nil
		}
		return play.SpinReceipt{}, false, err
	}
	r, err := decodeSpinReceipt(raw, frame)
	return r, true, err
}

func decodeSpinReceipt(raw, frame []byte) (play.SpinReceipt, error) {
	var header struct{ StorageVersion int }
	if err := json.Unmarshal(raw, &header); err != nil {
		return play.SpinReceipt{}, err
	}
	if header.StorageVersion == 0 {
		// Existing receipts and durable settlement journals remain readable.
		var r play.SpinReceipt
		err := json.Unmarshal(raw, &r)
		return r, err
	}
	if header.StorageVersion != 1 {
		return play.SpinReceipt{}, fmt.Errorf("unsupported receipt storage version %d", header.StorageVersion)
	}
	var saved storedReceipt
	if err := json.Unmarshal(raw, &saved); err != nil {
		return play.SpinReceipt{}, err
	}
	if len(frame) == 0 {
		return play.SpinReceipt{}, fmt.Errorf("compact receipt references a missing frame")
	}
	var f play.Frame
	if err := json.Unmarshal(frame, &f); err != nil {
		return play.SpinReceipt{}, err
	}
	ref := saved.Frame
	if f.BetID != ref.BetID || f.SpinIndex != ref.SpinIndex || f.StepIndex != ref.StepIndex {
		return play.SpinReceipt{}, fmt.Errorf("compact receipt frame identity mismatch")
	}
	// Frame is immutable. Only request presentation and the original balance
	// differ from spin_steps; never reconstruct an old retry with today's wallet.
	f.RequestID, f.NextRequestID, f.Next, f.Balance = ref.RequestID, ref.NextRequestID, ref.Next, ref.Balance
	return play.SpinReceipt{BuyMode: saved.BuyMode, Amount: saved.Amount, Frame: f}, nil
}

// Preserve the storage version and unknown JSON fields when replaying either
// legacy or compact settlement journals after the lobby returns its balance.
func receiptWithBalance(raw []byte, balance int64) ([]byte, error) {
	var r map[string]json.RawMessage
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, err
	}
	var f map[string]json.RawMessage
	if err := json.Unmarshal(r["Frame"], &f); err != nil {
		return nil, err
	}
	if f == nil {
		return nil, fmt.Errorf("settlement receipt has no frame")
	}
	f["balance"], _ = json.Marshal(balance)
	encoded, err := json.Marshal(f)
	if err != nil {
		return nil, err
	}
	r["Frame"] = encoded
	return json.Marshal(r)
}
