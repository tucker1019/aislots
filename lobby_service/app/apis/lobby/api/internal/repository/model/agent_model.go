package model

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"apps/app/apis/lobby/api/internal/config"

	"gorm.io/gorm"
)

type AgentModel struct {
	DB       *gorm.DB
	Config   config.AgentConfig
	Games    map[string]config.GameEntry
	Location *time.Location
}
type agentRules struct {
	Config config.AgentConfig          `json:"config"`
	Games  map[string]config.GameEntry `json:"games"`
}

// Tick processes a bounded durable queue. The day lock serializes workers and finalization.
// No ancestor traversal or aggregation runs in the bet transaction or a browser query.
func (m *AgentModel) Tick(ctx context.Context, now time.Time) error {
	today := activityDate(now, m.Location)
	if err := m.DB.WithContext(ctx).Exec(`INSERT INTO lobby_agent_queue(business_date,event_id) SELECT business_date,'close:'||business_date FROM lobby_agent_days WHERE status='preview' AND business_date<? ON CONFLICT DO NOTHING`, today).Error; err != nil {
		return err
	}
	var dates []string
	if err := m.DB.WithContext(ctx).Raw(`SELECT DISTINCT business_date FROM lobby_agent_queue ORDER BY business_date LIMIT 8`).Scan(&dates).Error; err != nil {
		return err
	}
	var failures []error
	for _, day := range dates {
		if day > today {
			continue
		}
		if err := m.processDay(ctx, day, now); err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}

func (m *AgentModel) processDay(ctx context.Context, day string, now time.Time) error {
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if e := tx.Exec(`SELECT pg_advisory_xact_lock(20261104)`).Error; e != nil {
			return e
		}
		// Snapshot queue identities without locking inserts. New events enqueue independent rows.
		var jobs []int64
		if e := tx.Raw(`SELECT q.id FROM lobby_agent_queue q LEFT JOIN lobby_activity_events e ON e.event_id=q.event_id WHERE q.business_date=? AND (e.event_id IS NULL OR e.occurred_at<=?)`, day, now).Scan(&jobs).Error; e != nil {
			return e
		}
		if len(jobs) == 0 {
			return nil
		}
		raw, e := json.Marshal(agentRules{m.Config, m.Games})
		if e != nil {
			return e
		}
		if e = tx.Exec(`INSERT INTO lobby_agent_days(business_date,rules) VALUES(?,?::jsonb) ON CONFLICT DO NOTHING`, day, string(raw)).Error; e != nil {
			return e
		}
		var saved struct {
			Rules      string
			Status     string
			Aggregated bool
		}
		if e = tx.Raw(`SELECT rules::text,status,aggregated FROM lobby_agent_days WHERE business_date=?`, day).Scan(&saved).Error; e != nil {
			return e
		}
		var rules agentRules
		if e = json.Unmarshal([]byte(saved.Rules), &rules); e != nil {
			return e
		}
		// Already paid days are immutable: unexpected historical corrections remain queued for audit.
		if saved.Status == "settled" {
			var n int64
			if e = tx.Raw(`SELECT COUNT(*) FROM lobby_agent_daily WHERE business_date=? AND claim_id IS NOT NULL`, day).Scan(&n).Error; e != nil {
				return e
			}
			if n > 0 {
				return fmt.Errorf("agent historical event after payout: %s", day)
			}
		}
		tables := []string{"lobby_agent_daily"}
		if !saved.Aggregated {
			tables = append(tables, "lobby_agent_contributions", "lobby_agent_personal")
		}
		for _, table := range tables {
			if e = tx.Exec("DELETE FROM "+table+" WHERE business_date=?", day).Error; e != nil {
				return e
			}
		}
		for provider, tiers := range rules.Config.Providers {
			ids := []string{}
			for id, g := range rules.Games {
				if g.Provider == provider {
					ids = append(ids, id)
				}
			}
			if len(ids) == 0 {
				continue
			}
			filter := ""
			args := []any{day, provider, day, ids, now}
			if saved.Aggregated {
				filter = " AND event_id IN (SELECT event_id FROM lobby_agent_queue WHERE id IN ?)"
				args = append(args, jobs)
			}
			personalSQL := `INSERT INTO lobby_agent_personal SELECT ?,uid,?,COALESCE(SUM(CASE WHEN event_type='game_bet' THEN COALESCE(valid_bet_amount,amount) ELSE 0 END),0),COALESCE(SUM(CASE WHEN event_type='game_bet' THEN amount ELSE 0 END),0),COALESCE(SUM(CASE WHEN event_type='game_win' THEN amount ELSE 0 END),0),COUNT(*) FILTER(WHERE event_type='game_bet') FROM lobby_activity_events WHERE business_date=? AND game_id IN ? AND occurred_at<=?` + filter + ` GROUP BY uid ON CONFLICT(business_date,uid,provider) DO UPDATE SET valid_bet=lobby_agent_personal.valid_bet+EXCLUDED.valid_bet,bet_amount=lobby_agent_personal.bet_amount+EXCLUDED.bet_amount,win_amount=lobby_agent_personal.win_amount+EXCLUDED.win_amount,bet_count=lobby_agent_personal.bet_count+EXCLUDED.bet_count`
			if e = tx.Exec(personalSQL, args...).Error; e != nil {
				return e
			}
			contributionSQL := `INSERT INTO lobby_agent_contributions SELECT ?,p.ancestor_uid,e.uid,?,p.depth,SUM(COALESCE(e.valid_bet_amount,e.amount)),0 FROM lobby_activity_events e JOIN lobby_agent_paths p ON p.descendant_uid=e.uid AND e.occurred_at>=p.effective_at WHERE e.business_date=? AND e.game_id IN ? AND e.event_type='game_bet' AND e.occurred_at<=?` + filter + ` GROUP BY p.ancestor_uid,e.uid,p.depth ON CONFLICT(business_date,uid,member_uid,provider) DO UPDATE SET valid_bet=lobby_agent_contributions.valid_bet+EXCLUDED.valid_bet`
			if e = tx.Exec(contributionSQL, args...).Error; e != nil {
				return e
			}
			if e = tx.Exec(`INSERT INTO lobby_agent_daily(business_date,uid,provider,team_bet,rate,direct_commission,other_commission) SELECT ?,uid,?,SUM(valid_bet),0,0,0 FROM lobby_agent_contributions WHERE business_date=? AND provider=? GROUP BY uid`, day, provider, day, provider).Error; e != nil {
				return e
			}
			for _, tier := range tiers {
				if e = tx.Exec(`UPDATE lobby_agent_daily SET rate=? WHERE business_date=? AND provider=? AND team_bet>=?`, tier.Rate, day, provider, tier.Threshold).Error; e != nil {
					return e
				}
			}
			// Allocate fractional cents by cumulative floors: member details add up exactly to the daily provider total.
			if e = tx.Exec(`WITH raw AS (
    SELECT c.uid,c.member_uid,c.valid_bet::numeric*(a.rate-CASE WHEN p.depth=1 THEN 0 ELSE COALESCE(b.rate,0) END) AS numerator
    FROM lobby_agent_contributions c JOIN lobby_agent_paths p ON p.ancestor_uid=c.uid AND p.descendant_uid=c.member_uid
    JOIN lobby_agent_daily a ON a.business_date=c.business_date AND a.uid=c.uid AND a.provider=c.provider
    LEFT JOIN lobby_agent_daily b ON b.business_date=c.business_date AND b.uid=p.branch_uid AND b.provider=c.provider
    WHERE c.business_date=? AND c.provider=?
   ), rounded AS (SELECT uid,member_uid,FLOOR(SUM(numerator) OVER(PARTITION BY uid ORDER BY member_uid)/10000)-FLOOR((SUM(numerator) OVER(PARTITION BY uid ORDER BY member_uid)-numerator)/10000) AS amount FROM raw)
   UPDATE lobby_agent_contributions c SET commission=r.amount FROM rounded r WHERE c.business_date=? AND c.provider=? AND c.uid=r.uid AND c.member_uid=r.member_uid`, day, provider, day, provider).Error; e != nil {
				return e
			}
			if e = tx.Exec(`UPDATE lobby_agent_daily d SET direct_commission=s.direct,other_commission=s.other FROM (SELECT uid,COALESCE(SUM(commission) FILTER(WHERE depth=1),0) AS direct,COALESCE(SUM(commission) FILTER(WHERE depth>1),0) AS other FROM lobby_agent_contributions WHERE business_date=? AND provider=? GROUP BY uid) s WHERE d.business_date=? AND d.provider=? AND d.uid=s.uid`, day, provider, day, provider).Error; e != nil {
				return e
			}
		}
		status := "preview"
		if day < activityDate(now, m.Location) {
			status = "settled"
		}
		if e = tx.Exec(`UPDATE lobby_agent_days SET aggregated=true,status=?,updated_at=? WHERE business_date=?`, status, now, day).Error; e != nil {
			return e
		}
		return tx.Exec(`DELETE FROM lobby_agent_queue WHERE id IN ?`, jobs).Error
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead})
}
