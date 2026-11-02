package config

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
)

type RechargeTier struct {
	ID     string `json:"id"`
	Amount int64  `json:"amount"`
	Bonus  int64  `json:"bonus"`
	Fee    int64  `json:"fee"`
}

func (t RechargeTier) CreditAmount() int64 { return t.Amount + t.Bonus - t.Fee }
func LoadRechargeTiers(path string) ([]RechargeTier, error) {
	if path == "" {
		path = "etc/recharge.json"
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	decoder := json.NewDecoder(f)
	decoder.DisallowUnknownFields()
	var tiers []RechargeTier
	if err = decoder.Decode(&tiers); err != nil {
		return nil, err
	}
	if err = decoder.Decode(new(any)); err != io.EOF {
		return nil, fmt.Errorf("trailing recharge config")
	}
	seen := map[string]bool{}
	for _, t := range tiers {
		if t.ID == "" || len(t.ID) > 64 || seen[t.ID] || t.Amount <= 0 || t.Bonus < 0 || t.Fee < 0 || (t.Bonus > 0 && t.Fee > 0) || t.Fee >= t.Amount || t.Bonus > math.MaxInt64-t.Amount {
			return nil, fmt.Errorf("invalid recharge tier: %s", t.ID)
		}
		seen[t.ID] = true
	}
	return tiers, nil
}
