// Package ag5 implements Fortune Rabbit independently of other games.
package ag5

import (
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

	"aislots/slots_service/internal/rules/paylines"
)

const ID = "AG5"
const RuleType = "fortune_rabbit_v1"
const ModuleVersion = "fortune-rabbit-v1"
const StateSchema = 1

var fixedLines = [][]int{{1, 4, 8}, {1, 5, 8}, {1, 5, 9}, {2, 5, 8}, {2, 5, 9}, {2, 6, 9}, {2, 6, 10}, {3, 6, 9}, {3, 6, 10}, {3, 7, 10}}

type Symbol struct {
	ID     int         `json:"id"`
	Name   string      `json:"name"`
	Role   string      `json:"role"`
	Payout int64       `json:"payout"`
	Weight json.Number `json:"weight"`
}
type Reward struct {
	ID     int         `json:"id"`
	Name   string      `json:"name"`
	Payout int64       `json:"payout"`
	Weight json.Number `json:"weight"`
}
type Rules struct {
	Version       int      `json:"version"`
	RuleType      string   `json:"ruleType"`
	ColumnHeights []int    `json:"columnHeights"`
	Lines         [][]int  `json:"lines"`
	Symbols       []Symbol `json:"symbols"`
	Rewards       []Reward `json:"rewards"`
	Generation    struct {
		RewardProbability json.Number `json:"rewardProbability"`
	} `json:"generation"`
}
type Parameters struct {
	LineCount    int         `json:"lineCount"`
	BaseWin      json.Number `json:"baseSpinWinProbability"`
	FreeWin      json.Number `json:"freeSpinWinProbability"`
	Trigger      json.Number `json:"freeSpinTriggerProbability"`
	FeatureSpins int         `json:"featureSpins"`
	MaxWin       int64       `json:"maxWinMultiplier"`
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
		return fmt.Errorf("AG5 JSON has trailing content")
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
		return c, fmt.Errorf("invalid AG5 configuration")
	}
	c.Parameters = doc.Parameters
	if err := strict(c.Files["paylines.json"], &c.Rules); err != nil {
		return c, err
	}
	if err := strict(c.Files["base.json"], &c.Base); err != nil {
		return c, err
	}
	if err := strict(c.Files["free.json"], &c.Free); err != nil {
		return c, err
	}
	return c, c.Validate()
}
func bounded(value json.Number, maximum int64) bool {
	r, err := paylines.Rat(string(value))
	return err == nil && r.Cmp(big.NewRat(maximum, 1)) <= 0
}
func (c Rules) Validate() error {
	if c.Version != 1 || c.RuleType != RuleType || !reflect.DeepEqual(c.ColumnHeights, []int{3, 4, 3}) || !reflect.DeepEqual(c.Lines, fixedLines) {
		return fmt.Errorf("AG5 requires its fixed 3/4/3 ten-line board")
	}
	if len(c.Symbols) < 1 || len(c.Symbols) > 32 || len(c.Rewards) < 1 || len(c.Rewards) > 32 {
		return fmt.Errorf("invalid AG5 symbol list")
	}
	ids := map[int]bool{}
	valid := func(id int, name string, payout int64, weight json.Number) bool {
		if id < 1 || id > 1000000 || ids[id] || strings.TrimSpace(name) == "" || utf8.RuneCountInString(name) > 80 || payout < 1 || payout > 1000000 || !bounded(weight, 1000000000000) {
			return false
		}
		ids[id] = true
		return true
	}
	normals, wilds := 0, 0
	for _, s := range c.Symbols {
		if !valid(s.ID, s.Name, s.Payout, s.Weight) || (s.Role != "normal" && s.Role != "wild") {
			return fmt.Errorf("invalid AG5 ordinary symbol")
		}
		w, _ := paylines.Rat(string(s.Weight))
		if s.Role == "wild" {
			wilds++
		} else if w.Sign() > 0 {
			normals++
		}
	}
	degree := make([]int, 10)
	maxDegree := 0
	for _, line := range c.Lines {
		for _, p := range line {
			degree[p-1]++
			if degree[p-1] > maxDegree {
				maxDegree = degree[p-1]
			}
		}
	}
	if wilds != 1 || normals <= maxDegree {
		return fmt.Errorf("AG5 single-pass fill requires one Wild and more than %d positive-weight normals", maxDegree)
	}
	positive := false
	for _, s := range c.Rewards {
		if !valid(s.ID, s.Name, s.Payout, s.Weight) {
			return fmt.Errorf("invalid AG5 reward")
		}
		w, _ := paylines.Rat(string(s.Weight))
		positive = positive || w.Sign() > 0
	}
	if !positive || !bounded(c.Generation.RewardProbability, 1) {
		return fmt.Errorf("invalid AG5 reward generation settings")
	}
	return nil
}
func (c Config) Validate() error {
	if err := c.Rules.Validate(); err != nil {
		return err
	}
	p := c.Parameters
	if p.LineCount != 10 || p.FeatureSpins != 8 || p.MaxWin != 5000 {
		return fmt.Errorf("AG5 requires ten lines, eight special spins and a 5000x cap")
	}
	for _, v := range []json.Number{p.BaseWin, p.FreeWin, p.Trigger} {
		if !bounded(v, 1) {
			return fmt.Errorf("invalid AG5 probability")
		}
	}
	for _, rows := range [][]WeightRow{c.Base, c.Free} {
		if len(rows) == 0 {
			return fmt.Errorf("empty AG5 payout table")
		}
		positive := false
		seen := map[string]bool{}
		for _, row := range rows {
			if len(row) != 2 || !bounded(row[0], 10000000) || !bounded(row[1], 1000000000000) {
				return fmt.Errorf("invalid AG5 payout row")
			}
			m, _ := paylines.Rat(string(row[0]))
			w, _ := paylines.Rat(string(row[1]))
			if !m.IsInt() || m.Sign() <= 0 || seen[m.RatString()] {
				return fmt.Errorf("AG5 payout multipliers must be unique positive integers")
			}
			seen[m.RatString()] = true
			positive = positive || w.Sign() > 0
		}
		if !positive {
			return fmt.Errorf("AG5 table has no positive weight")
		}
	}
	return nil
}
