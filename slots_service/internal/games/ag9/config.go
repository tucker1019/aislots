// Package ag4 implements Fortune Leopard, independently of the Ways engine.
package ag9

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"sort"

	"aislots/slots_service/internal/rules/paylines"
)

const ID = "AG9"
const RuleType = "fortune_leopard_v1"
const ModuleVersion = "fortune-leopard-v1"
const StateSchema = 1

type Feature struct {
	Type            string      `json:"type"`
	WildProbability json.Number `json:"wildProbability"`
	FillProbability json.Number `json:"fillProbability"`
	TargetWeights   []struct {
		SymbolID int         `json:"symbolId"`
		Weight   json.Number `json:"weight"`
	} `json:"targetWeights"`
	BaseSpreadWeights []json.Number `json:"baseSpreadWeights"`
}
type Parameters struct {
	LineCount int         `json:"lineCount"`
	BaseWin   json.Number `json:"baseSpinWinProbability"`
	RespinWin json.Number `json:"freeSpinWinProbability"`
	Trigger   json.Number `json:"freeSpinTriggerProbability"`
}
type WeightRow []json.Number
type Config struct {
	Rules        paylines.Config
	Feature      Feature
	Parameters   Parameters
	Base, Respin []WeightRow
	Files        map[string][]byte
}

func strict(raw []byte, out any) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		return err
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		return fmt.Errorf("trailing JSON")
	}
	return nil
}

func LoadConfig(dir string) (Config, error) {
	c := Config{Files: map[string][]byte{}}
	for _, name := range []string{"config.json", "base.json", "free.json", "paylines.json"} {
		raw, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return c, err
		}
		c.Files[name] = raw
	}
	var document struct {
		Version           int        `json:"version"`
		RuleType          string     `json:"ruleType"`
		Parameters        Parameters `json:"parameters"`
		SimulationOptions struct {
			PaidSpins int64  `json:"paidSpins"`
			Seed      *int64 `json:"seed"`
		} `json:"simulationOptions"`
	}
	// AG9 owns four numerical parameters. Simulation settings are validated
	// separately and never influence live outcome probabilities.
	if err := strict(c.Files["config.json"], &document); err != nil {
		return c, err
	}
	if document.Version != 1 || document.RuleType != RuleType {
		return c, fmt.Errorf("invalid AG9 game config")
	}
	if document.SimulationOptions.PaidSpins < 1 || document.SimulationOptions.PaidSpins > 1000000000 || (document.SimulationOptions.Seed != nil && (*document.SimulationOptions.Seed < 0 || *document.SimulationOptions.Seed > 4294967295)) {
		return c, fmt.Errorf("invalid AG9 simulation options")
	}
	c.Parameters = document.Parameters
	if err := strict(c.Files["paylines.json"], &c.Rules); err != nil {
		return c, err
	}
	if err := strict(c.Rules.Feature, &c.Feature); err != nil {
		return c, err
	}
	if err := json.Unmarshal(c.Files["base.json"], &c.Base); err != nil {
		return c, err
	}
	if err := json.Unmarshal(c.Files["free.json"], &c.Respin); err != nil {
		return c, err
	}
	return c, c.Validate()
}
func (c Config) Validate() error {
	if err := c.Rules.Validate(); err != nil {
		return err
	}
	expectedPay := map[int]string{1: "3", 2: "5", 3: "8", 4: "10", 5: "25", 6: "100", 7: "250"}
	if len(c.Rules.Symbols) != 7 {
		return fmt.Errorf("AG9 requires seven symbols")
	}
	for _, symbol := range c.Rules.Symbols {
		expected, ok := expectedPay[symbol.ID]
		role := "normal"
		if symbol.ID == 7 {
			role = "wild"
		}
		actual, err := paylines.Rat(string(symbol.Payout))
		if !ok || err != nil || actual.RatString() != expected || symbol.Role != role {
			return fmt.Errorf("AG9 screenshot payout mismatch")
		}
	}
	if c.Rules.Size() != 9 || len(c.Rules.ColumnHeights) != 3 || c.Parameters.LineCount != 5 || len(c.Rules.Lines) != 5 || c.Feature.Type != "fortune_leopard_v1" {
		return fmt.Errorf("AG9 requires 3x3/five-line Fortune Leopard rules")
	}
	for _, h := range c.Rules.ColumnHeights {
		if h != 3 {
			return fmt.Errorf("AG9 requires three rows")
		}
	}
	// The one-pass proof depends on these five lines, not merely their count.
	allowed := map[[3]int]bool{{1, 4, 7}: true, {2, 5, 8}: true, {3, 6, 9}: true, {1, 5, 9}: true, {3, 5, 7}: true}
	degree := make([]int, 9)
	for _, line := range c.Rules.Lines {
		if len(line) != 3 {
			return fmt.Errorf("AG9 requires three-cell lines")
		}
		cells := append([]int(nil), line...)
		sort.Ints(cells)
		if !allowed[[3]int{cells[0], cells[1], cells[2]}] {
			return fmt.Errorf("AG9 requires its five horizontal/diagonal lines")
		}
		for _, cell := range line {
			degree[cell-1]++
		}
	}
	positiveNormals, maxDegree := 0, 0
	for _, s := range c.Rules.Symbols {
		weight, _ := paylines.Rat(string(s.Weight))
		if s.Role == "normal" && weight.Sign() > 0 {
			positiveNormals++
		}
	}
	for _, d := range degree {
		if d > maxDegree {
			maxDegree = d
		}
	}
	// Each incident line can forbid at most one ordinary symbol. Keep at
	// least one positive-weight candidate after all line exclusions.
	if positiveNormals <= maxDegree {
		return fmt.Errorf("AG9 single-pass fill requires more than %d positive-weight ordinary symbols", maxDegree)
	}
	for _, s := range []json.Number{c.Parameters.BaseWin, c.Parameters.RespinWin, c.Parameters.Trigger, c.Feature.FillProbability, c.Feature.WildProbability} {
		p, err := paylines.Rat(string(s))
		if err != nil || p.Cmp(big.NewRat(1, 1)) > 0 {
			return fmt.Errorf("invalid AG9 probability")
		}
	}
	if len(c.Feature.TargetWeights) == 0 || len(c.Feature.BaseSpreadWeights) != 3 {
		return fmt.Errorf("missing AG9 generation weights")
	}
	positive := false
	targets := map[int]bool{}
	for _, w := range c.Feature.TargetWeights {
		if targets[w.SymbolID] {
			return fmt.Errorf("duplicate target")
		}
		targets[w.SymbolID] = true
		found := false
		for _, s := range c.Rules.Symbols {
			if s.ID == w.SymbolID && s.Role == "normal" {
				found = true
			}
		}
		r, err := paylines.Rat(string(w.Weight))
		if !found || err != nil {
			return fmt.Errorf("invalid target")
		}
		positive = positive || r.Sign() > 0
	}
	if !positive {
		return fmt.Errorf("no positive target weight")
	}
	for _, rows := range [][]WeightRow{c.Base, c.Respin} {
		if len(rows) == 0 {
			return fmt.Errorf("empty AG9 payout table")
		}
		positive = false
		seen := map[string]bool{}
		for _, row := range rows {
			if len(row) != 2 {
				return fmt.Errorf("invalid payout row")
			}
			m, err := paylines.Rat(string(row[0]))
			if err != nil {
				return err
			}
			if !m.IsInt() || m.Sign() <= 0 || m.Cmp(big.NewRat(12500, 1)) > 0 || seen[m.RatString()] {
				return fmt.Errorf("invalid/duplicate AG9 raw multiplier")
			}
			seen[m.RatString()] = true
			w, err := paylines.Rat(string(row[1]))
			if err != nil {
				return err
			}
			positive = positive || (m.Sign() > 0 && w.Sign() > 0)
		}
		if !positive {
			return fmt.Errorf("no positive payout weight")
		}
	}
	spread := false
	for _, w := range c.Feature.BaseSpreadWeights {
		r, err := paylines.Rat(string(w))
		if err != nil {
			return err
		}
		spread = spread || r.Sign() > 0
	}
	if !spread {
		return fmt.Errorf("empty spread weights")
	}
	return nil
}
