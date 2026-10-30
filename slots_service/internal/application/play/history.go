package play

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"time"
)

// BetRecord 一次付费下注及其全部免费链共用一个记录；金额只统计已结算部分。
type BetRecord struct {
	WinningRoundCount int       `json:"winningRoundCount"`
	TotalRoundCount   int       `json:"totalRoundCount"`
	ProfitAmount      string    `json:"profitAmount"`
	BetID             string    `json:"betId"`
	GameID            string    `json:"gameId"`
	BetAmount         string    `json:"betAmount"`
	TotalWinAmount    string    `json:"totalWinAmount"`
	Status            string    `json:"status"`
	Country           string    `json:"country"`
	Currency          string    `json:"currency"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

type HistoryFilter struct{ From, To time.Time }
type BetSummary struct {
	RecordCount    int64  `json:"recordCount"`
	BetAmount      string `json:"betAmount"`
	TotalWinAmount string `json:"totalWinAmount"`
	ProfitAmount   string `json:"profitAmount"`
}
type BetRecordPage struct {
	Summary     BetSummary  `json:"summary"`
	AmountScale int         `json:"amountScale"`
	Items       []BetRecord `json:"items"`
	NextCursor  string      `json:"nextCursor,omitempty"`
}

type HistoryWin struct {
	SymbolID     int    `json:"symbolId"`
	Columns      int    `json:"columns"`
	Ways         int64  `json:"ways"`
	Amount       string `json:"amount"`
	RawPayout    string `json:"rawPayout"`
	SymbolPayout string `json:"symbolPayout,omitempty"`
	Multiplier   string `json:"multiplier,omitempty"`
}
type ReplayFrame struct {
	ChargeAmount   string       `json:"chargeAmount"`
	ProfitAmount   string       `json:"profitAmount"`
	PayoutUnit     string       `json:"payoutUnit,omitempty"`
	LineCount      int          `json:"lineCount,omitempty"`
	Payouts        []HistoryWin `json:"payouts"`
	PriorRawPayout string       `json:"-"`
	Frame
	SettledAt time.Time `json:"settledAt"`
}

type BetReplay struct {
	AmountScale int           `json:"amountScale"`
	Bet         BetRecord     `json:"bet"`
	Frames      []ReplayFrame `json:"frames"`
	NextCursor  string        `json:"nextCursor,omitempty"`
}

// 数据库查询端口使用已验证的边界，HTTP游标不直接参与SQL。
type RecordQuery struct {
	Filter     HistoryFilter
	Limit      int
	BeforeTime time.Time
	BeforeID   string
}
type ReplayQuery struct {
	Limit     int
	AfterSpin int
	AfterStep int
}

type historyCursor struct {
	Kind string    `json:"kind"`
	Time time.Time `json:"time,omitempty"`
	ID   string    `json:"id,omitempty"`
	Spin int       `json:"spin,omitempty"`
	Step int       `json:"step,omitempty"`
}

func decodeHistoryCursor(raw string) (historyCursor, error) {
	var cursor historyCursor
	if len(raw) > 1024 {
		return cursor, ErrInvalid
	}
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return cursor, ErrInvalid
	}
	if err = json.Unmarshal(data, &cursor); err != nil {
		return cursor, ErrInvalid
	}
	return cursor, nil
}
func encodeHistoryCursor(cursor historyCursor) string {
	raw, _ := json.Marshal(cursor)
	return base64.RawURLEncoding.EncodeToString(raw)
}

func (s *Service) BetRecords(ctx context.Context, session Session, gameID string, limit int, rawCursor string) (BetRecordPage, error) {
	return s.FilteredBetRecords(ctx, session, gameID, limit, rawCursor, HistoryFilter{})
}

func (s *Service) FilteredBetRecords(ctx context.Context, session Session, gameID string, limit int, rawCursor string, filter HistoryFilter) (BetRecordPage, error) {
	if gameID != session.GameID {
		return BetRecordPage{}, ErrUnauthorized
	}
	if limit == 0 {
		limit = 20
	}
	if limit < 1 || limit > 100 {
		return BetRecordPage{}, ErrInvalid
	}
	if filter.From.IsZero() != filter.To.IsZero() || (!filter.From.IsZero() && (!filter.To.After(filter.From) || filter.To.Sub(filter.From) > 7*24*time.Hour)) {
		return BetRecordPage{}, ErrInvalid
	}
	query := RecordQuery{Limit: limit + 1, Filter: filter}
	if rawCursor != "" {
		cursor, err := decodeHistoryCursor(rawCursor)
		if err != nil || cursor.Kind != "records" || cursor.Time.IsZero() || cursor.ID == "" || len(cursor.ID) > 128 {
			return BetRecordPage{}, ErrInvalid
		}
		query.BeforeTime = cursor.Time
		query.BeforeID = cursor.ID
	}
	items, summary, err := s.store.ReadBetRecords(ctx, session.Player, gameID, query)
	if err != nil {
		return BetRecordPage{}, err
	}
	if items == nil {
		items = []BetRecord{}
	}
	out := BetRecordPage{Items: items, Summary: summary}
	if policy, e := s.bets.List(ctx, session.Player, gameID); e == nil {
		out.AmountScale = policy.AmountScale
	}
	if len(items) > limit {
		out.Items = items[:limit]
		last := out.Items[limit-1]
		out.NextCursor = encodeHistoryCursor(historyCursor{Kind: "records", Time: last.CreatedAt, ID: last.BetID})
	}
	return out, nil
}

func (s *Service) BetReplay(ctx context.Context, session Session, gameID, betID string, limit int, rawCursor string) (BetReplay, error) {
	if gameID != session.GameID {
		return BetReplay{}, ErrUnauthorized
	}
	if betID == "" || len(betID) > 128 {
		return BetReplay{}, ErrInvalid
	}
	if limit == 0 {
		limit = 100
	}
	if limit < 1 || limit > 200 {
		return BetReplay{}, ErrInvalid
	}
	query := ReplayQuery{Limit: limit + 1, AfterSpin: -1}
	if rawCursor != "" {
		cursor, err := decodeHistoryCursor(rawCursor)
		if err != nil || cursor.Kind != "replay" || cursor.ID != betID || cursor.Spin < 0 || cursor.Step < 1 {
			return BetReplay{}, ErrInvalid
		}
		query.AfterSpin = cursor.Spin
		query.AfterStep = cursor.Step
	}
	record, frames, err := s.store.ReadBetReplay(ctx, session.Player, gameID, betID, query)
	if err != nil {
		return BetReplay{}, err
	}
	if frames == nil {
		frames = []ReplayFrame{}
	}
	out := BetReplay{Bet: record, Frames: frames}
	if policy, e := s.bets.List(ctx, session.Player, gameID); e == nil {
		out.AmountScale = policy.AmountScale
	}
	if len(frames) > limit {
		out.Frames = frames[:limit]
		last := out.Frames[limit-1]
		out.NextCursor = encodeHistoryCursor(historyCursor{Kind: "replay", ID: betID, Spin: last.SpinIndex, Step: last.StepIndex})
	}
	// 历史仅用于展示，不返回能继续下注的token或内部结算游标。
	for i := range out.Frames {
		out.Frames[i].RequestID = ""
		out.Frames[i].NextRequestID = ""
		out.Frames[i].Next = nil
		decorateHistoryFrame(&out.Frames[i])
	}
	return out, nil
}

// 从历史精确单位与本轮之前的raw累计值分配逐项金额，保留逐轮累计取整口径。
func decorateHistoryFrame(frame *ReplayFrame) {
	frame.ChargeAmount = "0"
	if frame.SpinIndex == 0 && frame.StepIndex == 1 {
		frame.ChargeAmount = frame.BetAmount
	}
	win, _ := new(big.Int).SetString(frame.WinAmount, 10)
	charge, _ := new(big.Int).SetString(frame.ChargeAmount, 10)
	if win != nil && charge != nil {
		frame.ProfitAmount = new(big.Int).Sub(win, charge).String()
	}
	frame.Payouts = []HistoryWin{}
	unit, ok := new(big.Rat).SetString(frame.PayoutUnit)
	if !ok {
		return
	}
	prefix, ok := new(big.Rat).SetString(frame.PriorRawPayout)
	if !ok {
		prefix = new(big.Rat)
	}
	floor := func(v *big.Rat) *big.Int { return new(big.Int).Quo(v.Num(), v.Denom()) }
	previous := floor(new(big.Rat).Mul(prefix, unit))
	factor := ""
	if frame.CascadeIndex >= 0 && frame.CascadeIndex < len(frame.CascadeFactors) {
		factor = frame.CascadeFactors[frame.CascadeIndex]
	}
	for _, w := range frame.Wins {
		raw, ok := new(big.Rat).SetString(w.RawPayout)
		if !ok {
			continue
		}
		prefix.Add(prefix, raw)
		amount := floor(new(big.Rat).Mul(prefix, unit))
		row := HistoryWin{SymbolID: w.Symbol, Columns: w.Columns, Ways: w.Ways, RawPayout: w.RawPayout, Amount: new(big.Int).Sub(amount, previous).String(), Multiplier: factor}
		previous = amount
		if f, ok := new(big.Rat).SetString(factor); ok && f.Sign() > 0 && w.Ways > 0 {
			row.SymbolPayout = new(big.Rat).Quo(raw, new(big.Rat).Mul(f, big.NewRat(w.Ways, 1))).RatString()
		}
		frame.Payouts = append(frame.Payouts, row)
	}
	if frame.LineCount == 0 && unit.Sign() > 0 {
		if bet, ok := new(big.Rat).SetString(frame.BetAmount); ok {
			lines := new(big.Rat).Quo(bet, unit)
			if lines.IsInt() && lines.Num().IsInt64() {
				frame.LineCount = int(lines.Num().Int64())
			}
		}
	}
}
