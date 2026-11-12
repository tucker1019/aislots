package engine

import (
	"context"
	"encoding/json"
	"errors"
)

type Mode string

const (
	Base Mode = "base"
	Free Mode = "free"
)

var (
	ErrMissingSkeleton = errors.New("missing multiplier skeleton")
	ErrVersion         = errors.New("state/config version mismatch")
	ErrFill            = errors.New("no legal filler assignment")
)

type Symbol struct {
	ID      string              `json:"id"`
	Name    string              `json:"name"`
	Role    string              `json:"role"`
	Weight  float64             `json:"weight"`
	Color   string              `json:"color"`
	Payouts map[int]json.Number `json:"payouts"`
}
type Gold struct {
	Columns         []int   `json:"columns"`
	BaseProbability float64 `json:"baseProbability"`
	FreeProbability float64 `json:"freeProbability"`
	WildSymbolID    *string `json:"wildSymbolId"`
}
type BoardConfig struct {
	Version                int           `json:"version"`
	ColumnHeights          []int         `json:"columnHeights"`
	Symbols                []Symbol      `json:"symbols"`
	CascadeFactors         []json.Number `json:"cascadeFactors"`
	FreeCascadeFactors     []json.Number `json:"freeCascadeFactors"`
	FillWeightIncrement    *float64      `json:"fillWeightIncrement"`
	ScatterWeightIncrement *float64      `json:"scatterWeightIncrement"`
	Gold                   Gold          `json:"gold"`
	FreeGoldColumns        []int         `json:"freeGoldColumns"`
	Seed                   *uint32       `json:"seed"`
}
type Rule struct {
	Enabled     bool    `json:"enabled"`
	Start       int     `json:"start"`
	Probability float64 `json:"probability"`
	Interval    int     `json:"interval"`
	Step        float64 `json:"step"`
	Cap         int     `json:"cap"`
}
type Parameters struct {
	LineCount        int          `json:"lineCount"`
	BaseWin          float64      `json:"baseSpinWinProbability"`
	FreeWin          float64      `json:"freeSpinWinProbability"`
	FreeTrigger      float64      `json:"freeSpinTriggerProbability"`
	Guaranteed       bool         `json:"freeSpinGuaranteedWin"`
	LossCompensation bool         `json:"lossStreakRtpCompensation"`
	FreeCompensation bool         `json:"freeTriggerRtpCompensation"`
	Awards           [][2]float64 `json:"freeSpinAwardWeights"`
	RetriggerLimit   *int         `json:"freeRetriggerLimit"`
	LossRule         *Rule        `json:"lossStreakRule"`
	WinRule          *Rule        `json:"winStreakRule"`
	TriggerRule      *Rule        `json:"freeTriggerRule"`
}
type WeightRow [2]json.Number
type Game struct {
	ID         string      `json:"id"`
	Parameters Parameters  `json:"parameters"`
	Board      BoardConfig `json:"board"`
	BaseRows   []WeightRow `json:"baseRows"`
	FreeRows   []WeightRow `json:"freeRows"`
}

// SkeletonStore is immutable during engine use. Implementations must be safe for concurrent reads.
type SkeletonStore interface {
	Count(Mode, string) int
	Read(context.Context, Mode, string, int) ([]int, error)
}
type Options struct {
	// Legacy presentation count for configurations without an award mapping.
	TriggerSymbolCount int
	// Awarded free spins -> scatter count, after the existing weighted draw.
	FreeAwardSymbolCounts map[int]int
	MaxFillAttempts       int
	// Test/replay injection only. Nil uses crypto/rand; injected callbacks must be concurrency-safe.
	Random func() (float64, error)
}
type FreeSession struct {
	Remaining      int     `json:"remaining"`
	Played         int     `json:"played"`
	Wins           int     `json:"wins"`
	Retriggers     int     `json:"retriggers"`
	BetMinorUnits  int64   `json:"betMinorUnits"`
	WinProbability float64 `json:"winProbability"`
	GuaranteeAt    int     `json:"guaranteeAt"`
}
type State struct {
	Version          string       `json:"version"`
	Sequence         uint64       `json:"sequence"`
	Streak           int64        `json:"streak"`
	FreeMisses       int          `json:"freeMisses"`
	HasTriggeredFree bool         `json:"hasTriggeredFree"`
	Free             *FreeSession `json:"free,omitempty"`
}
type SpinRequest struct {
	BetMinorUnits int64 `json:"betMinorUnits"`
	State         State `json:"state"`
}
type Cell struct {
	ID     int `json:"id"`
	Symbol int `json:"symbolId"`
}
type Board [][]Cell
type Win struct {
	Symbol    int    `json:"symbolId"`
	Columns   int    `json:"columns"`
	Counts    []int  `json:"counts"`
	Ways      int64  `json:"ways"`
	CellIDs   []int  `json:"cellIds"`
	RawPayout string `json:"rawPayout"`
}
type Step struct {
	Index       int    `json:"index"`
	Before      Board  `json:"before"`
	After       Board  `json:"after"`
	Wins        []Win  `json:"wins"`
	Removed     []int  `json:"removedIds"`
	Transformed []int  `json:"transformedIds"`
	Refill      []int  `json:"refillIds"`
	RawPayout   string `json:"rawPayout"`
}
type Round struct {
	CascadeFactors []string `json:"cascadeFactors,omitempty"`
	Previews       [][]Cell `json:"previews,omitempty"`
	Initial        Board    `json:"initial"`
	Steps          []Step   `json:"steps"`
	Final          Board    `json:"final"`
	RawMultiplier  string   `json:"rawMultiplier"`
	FreeSymbols    int      `json:"freeSymbols"`
	FillAttempts   int      `json:"fillAttempts"`
}
type SpinResult struct {
	LineCount          int    `json:"lineCount,omitempty"`
	GameID             string `json:"gameId"`
	Version            string `json:"version"`
	Mode               Mode   `json:"mode"`
	BetMinorUnits      int64  `json:"betMinorUnits"`
	ChargeMinorUnits   int64  `json:"chargeMinorUnits"`
	WinMinorUnits      int64  `json:"winMinorUnits"`
	ExactWinMinorUnits string `json:"exactWinMinorUnits"`
	TriggeredFree      bool   `json:"triggeredFree"`
	AwardedFreeSpins   int    `json:"awardedFreeSpins"`
	Round              Round  `json:"round"`
	NextState          State  `json:"nextState"`
}

// UnmarshalJSON rejects malformed weight rows instead of silently truncating fixed arrays.
func (r *WeightRow) UnmarshalJSON(data []byte) error {
	var values []json.Number
	if err := json.Unmarshal(data, &values); err != nil {
		return err
	}
	if len(values) != 2 {
		return errors.New("weight row must contain multiplier and weight")
	}
	r[0], r[1] = values[0], values[1]
	return nil
}
