package xerr

import (
	"errors"

	codes "apps/pb/apis/lobby/api/errors"
)

type Error struct {
	Code    codes.UserError
	Message string
	Status  int
	cause   error
}

func (e *Error) Error() string { return e.Message }
func (e *Error) Unwrap() error { return e.cause }
func New(code codes.UserError, message string, status int) *Error {
	return &Error{Code: code, Message: message, Status: status}
}

func Wrap(err error, code codes.UserError, message string) *Error {
	return &Error{Code: code, Message: message, Status: 500, cause: err}
}

func Public(err error) *Error {
	var e *Error
	if errors.As(err, &e) {
		return e
	}
	return Wrap(err, codes.UserError_USER_ERROR_INTERNAL, "服务暂时不可用")
}

var (
	ErrGameTicket         = New(codes.UserError_USER_ERROR_GAME_TICKET, "游戏进入凭据无效或已过期", 401)
	ErrGameFunds          = New(codes.UserError_USER_ERROR_GAME_FUNDS, "余额不足", 400)
	ErrGameConflict       = New(codes.UserError_USER_ERROR_GAME_CONFLICT, "游戏结算请求冲突", 409)
	ErrNewbieEmpty        = New(codes.UserError_USER_ERROR_NEWBIE_EMPTY, "当前没有可领取的新手充值奖励", 400)
	ErrVIPEmpty           = New(codes.UserError_USER_ERROR_VIP_EMPTY, "当前没有可领取的VIP奖励", 400)
	ErrVIPRequestConflict = New(codes.UserError_USER_ERROR_VIP_REQUEST_CONFLICT, "请求号已用于其他VIP领取", 409)
	ErrReturnDate         = New(codes.UserError_USER_ERROR_RETURN_DATE, "领取日期已过期，请刷新", 409)
	ErrReturnEmpty        = New(codes.UserError_USER_ERROR_RETURN_EMPTY, "当前没有可领取的奖励", 400)
	ErrCheckinCondition   = New(codes.UserError_USER_ERROR_CHECKIN_CONDITION, "今日签到条件尚未达成", 400)
	ErrCheckinDate        = New(codes.UserError_USER_ERROR_CHECKIN_DATE, "签到日期已过期，请刷新", 409)
	ErrActivityConflict   = New(codes.UserError_USER_ERROR_ACTIVITY_EVENT_CONFLICT, "业务事件编号重复且内容不同", 409)
	ErrOrderNotFound      = New(codes.UserError_USER_ERROR_ORDER_NOT_FOUND, "充值订单不存在", 404)
	ErrRechargeTier       = New(codes.UserError_USER_ERROR_RECHARGE_TIER, "充值档位不存在或已下架", 400)
	ErrRequestConflict    = New(codes.UserError_USER_ERROR_REQUEST_CONFLICT, "请求号已用于其他充值档位", 409)
	ErrBalanceLimit       = New(codes.UserError_USER_ERROR_BALANCE_LIMIT, "余额超出允许范围", 400)
	ErrInvalid            = New(codes.UserError_USER_ERROR_INVALID_ARGUMENT, "参数无效", 400)
	ErrSession            = New(codes.UserError_USER_ERROR_INVALID_SESSION, "会话无效或已过期", 401)
	ErrCredentials        = New(codes.UserError_USER_ERROR_INVALID_CREDENTIALS, "账号或密码错误", 401)
	ErrExists             = New(codes.UserError_USER_ERROR_ACCOUNT_EXISTS, "账号已存在或当前用户已绑定账号", 409)
)
