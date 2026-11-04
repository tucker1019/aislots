package config

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"apps/pkg/coinsource"
)

// Explicit credit registry: adding a new credit source requires a configured multiplier.
var TurnoverSources = []coinsource.Source{coinsource.SourceExperienceFunding, coinsource.SourceRechargeCredit, coinsource.SourceRechargeBonus, coinsource.SourceCheckinReward, coinsource.SourceRebateDaily, coinsource.SourceRebateWeekly, coinsource.SourceRebateMonthly, coinsource.SourceLoserReturn, coinsource.SourceVIPUpgrade, coinsource.SourceVIPWeekly, coinsource.SourceVIPMonthly, coinsource.SourceNewbieRecharge, coinsource.SourceInviteReward, coinsource.SourceAgentCommission, coinsource.SourceWithdrawalBonus, coinsource.SourceGameWin, coinsource.SourceWithdrawalRefund}

type TurnoverConfig struct {
	Version     string           `json:"version"`
	Multipliers map[string]int64 `json:"multipliers"`
}

func (c TurnoverConfig) Validate() error {
	if len(c.Version) < 1 || len(c.Version) > 64 || strings.TrimSpace(c.Version) != c.Version {
		return fmt.Errorf("invalid turnover version")
	}
	if len(c.Multipliers) != len(TurnoverSources) {
		return fmt.Errorf("all credit sources must have turnover multipliers")
	}
	for _, source := range TurnoverSources {
		n, ok := c.Multipliers[string(source)]
		if !ok || n < 0 || n > 1000000 {
			return fmt.Errorf("invalid turnover multiplier for %s", source)
		}
	}
	if c.Multipliers[string(coinsource.SourceExperienceFunding)] != 0 {
		return fmt.Errorf("experience funding must be exempt from turnover")
	}
	if c.Multipliers[string(coinsource.SourceGameWin)] != 0 || c.Multipliers[string(coinsource.SourceWithdrawalRefund)] != 0 {
		return fmt.Errorf("game payouts and withdrawal refunds must be exempt from turnover")
	}
	return nil
}

func LoadTurnover(path string) (TurnoverConfig, error) {
	var c TurnoverConfig
	if path == "" {
		path = "etc/turnover.json"
	}
	f, e := os.Open(path)
	if e != nil {
		return c, e
	}
	defer func() { _ = f.Close() }()
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	if e = d.Decode(&c); e != nil {
		return c, e
	}
	var extra any
	if e = d.Decode(&extra); e != io.EOF {
		return c, fmt.Errorf("invalid trailing turnover data")
	}
	return c, c.Validate()
}
