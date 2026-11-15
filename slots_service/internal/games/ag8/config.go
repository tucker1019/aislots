// Package ag8 owns Fortune Dragon rules and immutable numerical snapshots.
package ag8

import (
	"aislots/slots_service/internal/rules/paylines"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"unicode/utf8"
)

const ID = "AG8"
const RuleType = "fortune_dragon_v1"
const ModuleVersion = "fortune-dragon-v1"
const StateSchema = 1

var fixedLines = [][]int{{2, 5, 8}, {1, 4, 7}, {3, 6, 9}, {1, 5, 9}, {3, 5, 7}}
var fixedPayouts = []int64{2, 3, 5, 10, 25, 50, 100}

type Symbol struct {
	ID     int         `json:"id"`
	Name   string      `json:"name"`
	Role   string      `json:"role"`
	Payout int64       `json:"payout"`
	Weight json.Number `json:"weight"`
}
type Rules struct {
	Version       int      `json:"version"`
	RuleType      string   `json:"ruleType"`
	ColumnHeights []int    `json:"columnHeights"`
	Lines         [][]int  `json:"lines"`
	Symbols       []Symbol `json:"symbols"`
}
type Parameters struct {
	LineCount        int         `json:"lineCount"`
	BaseWin          json.Number `json:"baseSpinWinProbability"`
	FreeWin          json.Number `json:"freeSpinWinProbability"`
	Trigger          json.Number `json:"freeSpinTriggerProbability"`
	FeatureSpins     int         `json:"featureSpins"`
	MaxWinMultiplier int64       `json:"maxWinMultiplier"`
}
type WeightRow []json.Number
type Boost struct {
	Base    []WeightRow `json:"base"`
	Free    []WeightRow `json:"free"`
	BaseWin json.Number `json:"baseWinProbability"`
	FreeWin json.Number `json:"freeWinProbability"`
}
type Numerical struct {
	NormalMultipliers    []WeightRow `json:"normalMultipliers"`
	FreeMultiplierCounts []WeightRow `json:"freeMultiplierCounts"`
	FreeMultipliers      []WeightRow `json:"freeMultipliers"`
	Boost                Boost       `json:"boost"`
}
type Config struct {
	Rules      Rules
	Parameters Parameters
	Dragon     Numerical
	Base, Free []WeightRow
	Files      map[string][]byte
}

func strict(raw []byte, out any) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		return err
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		return fmt.Errorf("AG8 JSON has trailing content")
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
	var doc struct {
		Version           int        `json:"version"`
		RuleType          string     `json:"ruleType"`
		Parameters        Parameters `json:"parameters"`
		Dragon            Numerical  `json:"dragon"`
		SimulationOptions struct {
			PaidSpins json.Number  `json:"paidSpins"`
			Seed      *json.Number `json:"seed"`
		} `json:"simulationOptions"`
	}
	if err := strict(c.Files["config.json"], &doc); err != nil {
		return c, err
	}
	if doc.Version != 1 || doc.RuleType != RuleType {
		return c, fmt.Errorf("invalid AG8 config")
	}
	spins, err := paylines.Rat(string(doc.SimulationOptions.PaidSpins))
	if err != nil || !spins.IsInt() || spins.Sign() <= 0 || spins.Cmp(big.NewRat(1000000000, 1)) > 0 {
		return c, fmt.Errorf("invalid AG8 simulation count")
	}
	if doc.SimulationOptions.Seed != nil {
		seed, err := paylines.Rat(string(*doc.SimulationOptions.Seed))
		if err != nil || !seed.IsInt() || seed.Sign() < 0 || seed.Cmp(big.NewRat(4294967295, 1)) > 0 {
			return c, fmt.Errorf("invalid AG8 simulation seed")
		}
	}
	c.Parameters, c.Dragon = doc.Parameters, doc.Dragon
	for name, out := range map[string]any{"paylines.json": &c.Rules, "base.json": &c.Base, "free.json": &c.Free} {
		if err := strict(c.Files[name], out); err != nil {
			return c, err
		}
	}
	return c, c.Validate()
}
func bounded(v json.Number, max int64) bool {
	r, e := paylines.Rat(string(v))
	return e == nil && r.Sign() >= 0 && r.Cmp(big.NewRat(max, 1)) <= 0
}
func (c Rules) Validate() error {
	if c.Version != 1 || c.RuleType != RuleType || !reflect.DeepEqual(c.ColumnHeights, []int{3, 3, 3}) || !reflect.DeepEqual(c.Lines, fixedLines) || len(c.Symbols) != 7 {
		return fmt.Errorf("AG8 requires three rows, three columns and five fixed lines")
	}
	for i, s := range c.Symbols {
		role := "normal"
		if i == 6 {
			role = "wild"
		}
		if s.ID != i+1 || s.Role != role || s.Payout != fixedPayouts[i] || strings.TrimSpace(s.Name) == "" || utf8.RuneCountInString(s.Name) > 40 || !bounded(s.Weight, 1000000000) {
			return fmt.Errorf("invalid AG8 symbol")
		}
		w, _ := paylines.Rat(string(s.Weight))
		if w.Sign() <= 0 {
			return fmt.Errorf("AG8 requires positive shape weights")
		}
	}
	return nil
}
func validateRows(rows []WeightRow, allowed []int64) error {
	if len(rows) == 0 || len(rows) > 500 {
		return fmt.Errorf("invalid AG8 table length")
	}
	seen := map[string]bool{}
	positive := false
	for _, row := range rows {
		if len(row) != 2 || !bounded(row[0], 500) || !bounded(row[1], 1000000000000) {
			return fmt.Errorf("invalid AG8 table row")
		}
		m, _ := paylines.Rat(string(row[0]))
		w, _ := paylines.Rat(string(row[1]))
		if !m.IsInt() || m.Sign() <= 0 || seen[m.RatString()] {
			return fmt.Errorf("AG8 requires unique positive integer multipliers")
		}
		seen[m.RatString()] = true
		positive = positive || w.Sign() > 0
		if allowed != nil {
			found := false
			for _, a := range allowed {
				found = found || m.Cmp(big.NewRat(a, 1)) == 0
			}
			if !found {
				return fmt.Errorf("invalid AG8 multiplier value")
			}
		}
	}
	if !positive {
		return fmt.Errorf("AG8 has no positive weight")
	}
	return nil
}
func (c Config) Validate() error {
	if err := c.Rules.Validate(); err != nil {
		return err
	}
	p := c.Parameters
	if p.LineCount != 5 || p.FeatureSpins != 8 || p.MaxWinMultiplier != 2500 {
		return fmt.Errorf("AG8 requires five lines, eight free spins and x2500 cap")
	}
	for _, n := range []json.Number{p.BaseWin, p.FreeWin, p.Trigger, c.Dragon.Boost.BaseWin, c.Dragon.Boost.FreeWin} {
		if !bounded(n, 1) {
			return fmt.Errorf("invalid AG8 probability")
		}
	}
	for _, rows := range [][]WeightRow{c.Base, c.Free, c.Dragon.Boost.Base, c.Dragon.Boost.Free} {
		if err := validateRows(rows, nil); err != nil {
			return err
		}
	}
	for _, t := range []struct {
		rows    []WeightRow
		allowed []int64
	}{{c.Dragon.NormalMultipliers, []int64{1, 2, 5, 10}}, {c.Dragon.FreeMultiplierCounts, []int64{2, 3}}, {c.Dragon.FreeMultipliers, []int64{2, 5, 10}}} {
		if err := validateRows(t.rows, t.allowed); err != nil {
			return err
		}
	}
	return nil
}
