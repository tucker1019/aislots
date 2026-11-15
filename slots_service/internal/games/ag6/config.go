// Package ag6 owns Fortune Mouse rules, sampling, fill and presentation.
package ag6

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

const ID = "AG6"
const RuleType = "fortune_mouse_v1"
const ModuleVersion = "fortune-mouse-v1"
const StateSchema = 1

var fixedLines = [][]int{{2, 5, 8}, {1, 4, 7}, {3, 6, 9}, {1, 5, 9}, {3, 5, 7}}
var fixedPayouts = []int64{3, 5, 15, 30, 50, 100, 300}

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
	JackpotRaw    int64    `json:"jackpotRaw"`
}
type Parameters struct {
	LineCount int         `json:"lineCount"`
	BaseWin   json.Number `json:"baseSpinWinProbability"`
	FreeWin   json.Number `json:"freeSpinWinProbability"`
	Trigger   json.Number `json:"freeSpinTriggerProbability"`
}
type WeightRow []json.Number
type Config struct {
	Rules      Rules
	Parameters Parameters
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
		return fmt.Errorf("AG6 JSON has trailing content")
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
		SimulationOptions struct {
			PaidSpins json.Number  `json:"paidSpins"`
			Seed      *json.Number `json:"seed"`
		} `json:"simulationOptions"`
	}
	if err := strict(c.Files["config.json"], &doc); err != nil {
		return c, err
	}
	if doc.Version != 1 || doc.RuleType != RuleType {
		return c, fmt.Errorf("invalid AG6 configuration")
	}
	c.Parameters = doc.Parameters
	for name, out := range map[string]any{"paylines.json": &c.Rules, "base.json": &c.Base, "free.json": &c.Free} {
		if err := strict(c.Files[name], out); err != nil {
			return c, err
		}
	}
	return c, c.Validate()
}
func bounded(value json.Number, max int64) bool {
	r, err := paylines.Rat(string(value))
	return err == nil && r.Cmp(big.NewRat(max, 1)) <= 0
}
func (c Rules) Validate() error {
	if c.Version != 1 || c.RuleType != RuleType || c.JackpotRaw != 5000 || !reflect.DeepEqual(c.ColumnHeights, []int{3, 3, 3}) || !reflect.DeepEqual(c.Lines, fixedLines) || len(c.Symbols) != 7 {
		return fmt.Errorf("AG6 requires fixed nine cells, five lines and 5000 raw jackpot")
	}
	for i, s := range c.Symbols {
		role := "normal"
		if i == 6 {
			role = "wild"
		}
		if s.ID != i+1 || s.Role != role || s.Payout != fixedPayouts[i] || strings.TrimSpace(s.Name) == "" || utf8.RuneCountInString(s.Name) > 40 || !bounded(s.Weight, 1000000000) {
			return fmt.Errorf("invalid AG6 symbol")
		}
		w, _ := paylines.Rat(string(s.Weight))
		if w.Sign() <= 0 {
			return fmt.Errorf("AG6 requires six positive-weight normals and one Wild")
		}
	}
	return nil
}
func (c Config) Validate() error {
	if err := c.Rules.Validate(); err != nil {
		return err
	}
	if c.Parameters.LineCount != 5 || !bounded(c.Parameters.BaseWin, 1) || !bounded(c.Parameters.Trigger, 1) || !bounded(c.Parameters.FreeWin, 1) {
		return fmt.Errorf("invalid AG6 probabilities or line count")
	}
	free, _ := paylines.Rat(string(c.Parameters.FreeWin))
	if free.Cmp(big.NewRat(1, 1)) != 0 {
		return fmt.Errorf("AG6 whole feature must win exactly once")
	}
	for _, rows := range [][]WeightRow{c.Base, c.Free} {
		if len(rows) == 0 || len(rows) > 5000 {
			return fmt.Errorf("invalid AG6 table length")
		}
		seen := map[string]bool{}
		positive := false
		for _, row := range rows {
			if len(row) != 2 || !bounded(row[0], 5000) || !bounded(row[1], 1000000000000) {
				return fmt.Errorf("invalid AG6 payout row")
			}
			m, _ := paylines.Rat(string(row[0]))
			w, _ := paylines.Rat(string(row[1]))
			if !m.IsInt() || m.Sign() <= 0 || seen[m.RatString()] {
				return fmt.Errorf("AG6 multipliers must be unique positive integers")
			}
			seen[m.RatString()] = true
			positive = positive || w.Sign() > 0
		}
		if !positive {
			return fmt.Errorf("AG6 table has no positive weight")
		}
	}
	return nil
}
