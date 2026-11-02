package xerr

import (
	"errors"
	"testing"

	codes "apps/pb/apis/lobby/api/errors"
)

func TestPublicErrors(t *testing.T) {
	if Public(ErrSession) != ErrSession || ErrSession.Error() != "会话无效或已过期" {
		t.Fatal("business error changed")
	}
	cause := errors.New("private database detail")
	e := Wrap(cause, codes.UserError_USER_ERROR_DATABASE, "数据库服务暂时不可用")
	if !errors.Is(e, cause) || e.Unwrap() != cause || Public(e) != e {
		t.Fatal("cause lost")
	}
	if Public(cause).Message != "服务暂时不可用" {
		t.Fatal("internal detail leaked")
	}
}
