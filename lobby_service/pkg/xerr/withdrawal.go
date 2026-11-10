package xerr

import (
	codes "apps/pb/apis/lobby/api/errors"
	"time"
)

var (
	ErrWithdrawalTurnover     = New(codes.UserError_USER_ERROR_WITHDRAWAL_TURNOVER, "有效流水未完成，暂不可取款", 400)
	ErrWithdrawalNotFound     = New(codes.UserError_USER_ERROR_ORDER_NOT_FOUND, "取款订单不存在", 404)
	ErrWithdrawalConflict     = New(codes.UserError_USER_ERROR_REQUEST_CONFLICT, "取款申请或审核状态冲突", 409)
	ErrWithdrawalFunds        = New(codes.UserError_USER_ERROR_WITHDRAWAL_FUNDS, "余额不足", 400)
	ErrWithdrawalAccount      = New(codes.UserError_USER_ERROR_WITHDRAWAL_ACCOUNT, "请先绑定收款账号", 400)
	ErrWithdrawalTestDisabled = New(codes.UserError_USER_ERROR_WITHDRAWAL_TEST_DISABLED, "测试审核未启用", 403)
)

// WithdrawalTurnover reports the remaining amount in minor units at rejection time.
type TurnoverItem struct {
	Source    string    `json:"source"`
	Amount    int64     `json:"amount"`
	Required  int64     `json:"required"`
	Completed int64     `json:"completed"`
	CreatedAt time.Time `json:"createdAt"`
}

func WithdrawalTurnover(remaining int64, items []TurnoverItem) *Error {
	e := *ErrWithdrawalTurnover
	e.RemainingTurnover = remaining
	e.TurnoverItems = items
	e.cause = ErrWithdrawalTurnover
	return &e
}
