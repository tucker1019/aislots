// Package ag4 implements Fortune Tiger, independently of the Ways engine.
package ag4

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"

	"aislots/slots_service/internal/rules/paylines"
)

const ID = "AG4"
const ModuleVersion = "fortune-tiger-v1"
const StateSchema = 1

type Feature struct {
	Type            string      `json:"type"`
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
	return d.Decode(out)
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
		Version    int        `json:"version"`
		RuleType   string     `json:"ruleType"`
		Parameters Parameters `json:"parameters"`
	}
	// The analysis config contains Ways compatibility/UI fields; this module
	// deliberately reads only its independent probabilities and line count.
	if err := json.Unmarshal(c.Files["config.json"], &document); err != nil {
		return c, err
	}
	if document.Version != 1 || document.RuleType != paylines.RuleType {
		return c, fmt.Errorf("invalid AG4 game config")
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
	if c.Rules.Size() != 9 || len(c.Rules.ColumnHeights) != 3 || c.Parameters.LineCount != 5 || len(c.Rules.Lines) != 5 || c.Feature.Type != "fortune_tiger_v1" {
		return fmt.Errorf("AG4 requires 3x3/five-line Fortune Tiger rules")
	}
	for _, h := range c.Rules.ColumnHeights {
		if h != 3 {
			return fmt.Errorf("AG4 requires three rows")
		}
	}
	// The one-pass proof depends on these five lines, not merely their count.
	allowed := map[[3]int]bool{{1, 4, 7}: true, {2, 5, 8}: true, {3, 6, 9}: true, {1, 5, 9}: true, {3, 5, 7}: true}
	degree := make([]int, 9)
	for _, line := range c.Rules.Lines {
		if len(line) != 3 {
			return fmt.Errorf("AG4 requires three-cell lines")
		}
		cells := append([]int(nil), line...)
		sort.Ints(cells)
		if !allowed[[3]int{cells[0], cells[1], cells[2]}] {
			return fmt.Errorf("AG4 requires its five horizontal/diagonal lines")
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
		return fmt.Errorf("AG4 single-pass fill requires more than %d positive-weight ordinary symbols", maxDegree)
	}
	for _, s := range []json.Number{c.Parameters.BaseWin, c.Parameters.RespinWin, c.Parameters.Trigger, c.Feature.FillProbability} {
		p, err := paylines.Rat(string(s))
		if err != nil || p.Cmp(big.NewRat(1, 1)) > 0 {
			return fmt.Errorf("invalid AG4 probability")
		}
	}
	if len(c.Feature.TargetWeights) == 0 || len(c.Feature.BaseSpreadWeights) != 3 {
		return fmt.Errorf("missing AG4 generation weights")
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
			return fmt.Errorf("empty AG4 payout table")
		}
		positive = false
		for _, row := range rows {
			if len(row) != 2 {
				return fmt.Errorf("invalid payout row")
			}
			m, err := paylines.Rat(string(row[0]))
			if err != nil {
				return err
			}
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
