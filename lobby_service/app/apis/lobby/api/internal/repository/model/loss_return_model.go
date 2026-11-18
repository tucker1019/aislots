package model

import (
	"math/big"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/pkg/coinsource"
	"apps/pkg/xerr"

	"gorm.io/gorm"
)

func effectiveLossPolicy(_ *gorm.DB, c config.ReturnConfig, _ time.Time) (config.LossReturnConfig, error) {
	policy := c.LossConfig()
	return policy, policy.Validate()
}

var lossRewardSources = map[string][]coinsource.Source{
	"rebate":  {coinsource.SourceRebateDaily, coinsource.SourceRebateWeekly, coinsource.SourceRebateMonthly},
	"checkin": {coinsource.SourceCheckinReward}, "vipUpgrade": {coinsource.SourceVIPUpgrade},
	"vipWeekly": {coinsource.SourceVIPWeekly}, "vipMonthly": {coinsource.SourceVIPMonthly},
	"lossReturn": {coinsource.SourceLoserReturn}, "rechargeBonus": {coinsource.SourceRechargeBonus},
	"withdrawalBonus": {coinsource.SourceWithdrawalBonus}, "newbieReward": {coinsource.SourceNewbieRecharge},
	"agentCommission": {coinsource.SourceAgentCommission}, "inviteReward": {coinsource.SourceInviteReward},
}

func lossRewardCredits(tx *gorm.DB, uid int64, start, end time.Time, policy config.LossReturnConfig) (int64, error) {
	sources := []string{}
	for _, category := range config.LossRewardCategories {
		if policy.RewardSources[category] {
			for _, source := range lossRewardSources[category] {
				sources = append(sources, string(source))
			}
		}
	}
	if len(sources) == 0 {
		return 0, nil
	}
	var total int64
	err := tx.Model(&LobbyCoinLedger{}).Select("COALESCE(SUM(delta),0)").Where("uid=? AND account_type='real' AND delta>0 AND source IN ? AND created_at>=? AND created_at<?", uid, sources, start, end).Scan(&total).Error
	return total, err
}

// Deduct selected wallet rewards and a nonnegative fee from game losses.
// Big integers prevent overflow and division rounds down to integer cents.
func lossReturnBase(bets, payouts, credits int64, feeBps int32) (int64, error) {
	if bets < 0 || payouts < 0 || credits < 0 || feeBps < 0 || feeBps > 10000 {
		return 0, xerr.ErrBalanceLimit
	}
	n := new(big.Int).Sub(big.NewInt(bets), big.NewInt(payouts))
	fee := new(big.Int)
	if n.Sign() > 0 {
		fee.Mul(n, big.NewInt(int64(feeBps)))
		fee.Div(fee, big.NewInt(10000))
	}
	n.Sub(n, fee)
	n.Sub(n, big.NewInt(credits))
	if n.Sign() <= 0 {
		return 0, nil
	}
	if !n.IsInt64() {
		return 0, xerr.ErrBalanceLimit
	}
	return n.Int64(), nil
}
