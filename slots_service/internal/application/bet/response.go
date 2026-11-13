package bet

import "encoding/json"

// Preserve the historical platform endpoint DTO. The persistence envelope is
// internal; each game owns its client result payload.
func (r Response) MarshalJSON() ([]byte, error) {
	var payload json.RawMessage
	if r.Result != nil {
		payload = r.Result.Payload
	}
	return json.Marshal(struct {
		RoundID   string          `json:"roundId"`
		RequestID string          `json:"requestId"`
		Status    Status          `json:"status"`
		Balance   *int64          `json:"platformBalanceMinorUnits,omitempty"`
		Result    json.RawMessage `json:"result,omitempty"`
	}{r.RoundID, r.RequestID, r.Status, r.PlatformBalanceMinorUnits, payload})
}
