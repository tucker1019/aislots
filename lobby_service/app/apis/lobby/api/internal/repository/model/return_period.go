package model

import (
	"time"

	"apps/pkg/coinsource"
)

const (
	ReturnDaily   = "daily"
	ReturnWeekly  = "weekly"
	ReturnMonthly = "monthly"
	ReturnLoser   = "loser_return"
	GroupRebate   = "rebate"
	GroupLoser    = "loser_return"
)

func returnKinds(group string) []string {
	if group == GroupLoser {
		return []string{ReturnLoser}
	}
	return []string{ReturnDaily, ReturnWeekly, ReturnMonthly}
}

// Bounds are calendar dates, end exclusive. All release windows last one local day.
func returnBounds(now time.Time, loc *time.Location, kind string) (previous, current, end time.Time) {
	local := now.In(loc)
	current = time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
	switch kind {
	case ReturnWeekly:
		current = current.AddDate(0, 0, -(int(local.Weekday())+6)%7)
		previous = current.AddDate(0, 0, -7)
		end = current.AddDate(0, 0, 7)
	case ReturnMonthly:
		current = time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, loc)
		previous = current.AddDate(0, -1, 0)
		end = current.AddDate(0, 1, 0)
	default:
		previous = current.AddDate(0, 0, -1)
		end = current.AddDate(0, 0, 1)
	}
	return previous, current, end
}

func returnAmount(base int64, rate int32) int64 {
	// Split before multiplication: rate<=10000 means the result cannot exceed base.
	return base/10000*int64(rate) + base%10000*int64(rate)/10000
}

func returnSource(kind string) coinsource.Source {
	switch kind {
	case ReturnDaily:
		return coinsource.SourceRebateDaily
	case ReturnWeekly:
		return coinsource.SourceRebateWeekly
	case ReturnMonthly:
		return coinsource.SourceRebateMonthly
	default:
		return coinsource.SourceLoserReturn
	}
}
