package handler

import (
	"net/http/httptest"
	"strings"
	"testing"

	pb "apps/pb/apis/lobby/api/v1"
)

func TestOrderQueryBinding(t *testing.T) {
	for _, tc := range []struct {
		query, body string
		valid       bool
	}{
		{"uid=7&sid=abc&orderId=order&status=pending&limit=5&cursor=abc&app_name=lobby", "", true},
		{"limit=2147483648", "", false},
		{"limit=5&limit=6", "", false},
		{"limit=5", `{"limit":6}`, false},
		{"orderId=a", `{"orderId":"b"}`, false},
		{"orderId=a&orderId=b", "", false},
		{"uid=bad", "", false},
	} {
		r := httptest.NewRequest("GET", "/?"+tc.query, strings.NewReader(tc.body))
		req := &pb.RechargeRequest{}
		err := decode(httptest.NewRecorder(), r, req)
		if (err == nil) != tc.valid {
			t.Fatal(tc, err)
		}
		if tc.valid && (req.GetUid() != 7 || req.OrderId != "order" || req.Limit != 5 || req.Status != "pending" || req.Cursor != "abc") {
			t.Fatal(req)
		}
	}
}
