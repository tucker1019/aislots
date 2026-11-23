package adminapi

import (
	"apps/app/apis/lobby/api/internal/adminauth"
	"apps/app/apis/lobby/api/internal/repository/model"
	"encoding/base64"
	"encoding/json"
	"errors"
	"gorm.io/gorm"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type API struct {
	DB          *gorm.DB
	Location    *time.Location
	Recharge    *model.RechargeModel
	RedeemCodes *model.RedeemCodeModel
	ReviewModel func(*http.Request) (*model.RechargeModel, error)
}

func ok(w http.ResponseWriter, v any) { adminauth.Reply(w, 200, "", v) }
func fail(w http.ResponseWriter, e error) {
	if errors.Is(e, gorm.ErrRecordNotFound) {
		adminauth.Reply(w, 404, "NOT_FOUND", nil)
	} else {
		adminauth.Reply(w, 500, "INTERNAL", nil)
	}
}
func page(r *http.Request) (int, int64, error) {
	l := 20
	if s := r.URL.Query().Get("limit"); s != "" {
		v, e := strconv.Atoi(s)
		if e != nil || v < 1 || v > 100 {
			return 0, 0, errors.New("limit")
		}
		l = v
	}
	var c int64
	if s := r.URL.Query().Get("cursor"); s != "" {
		b, e := base64.RawURLEncoding.DecodeString(s)
		if e != nil {
			return 0, 0, e
		}
		c, e = strconv.ParseInt(string(b), 10, 64)
		if e != nil || c < 0 {
			return 0, 0, errors.New("cursor")
		}
	}
	return l, c, nil
}
func cursor(v int64) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.FormatInt(v, 10)))
}
func mask(v string) string {
	r := []rune(v)
	if len(r) == 0 {
		return ""
	}
	if len(r) <= 4 {
		return strings.Repeat("*", len(r))
	}
	return string(r[:1]) + "***" + string(r[len(r)-2:])
}
func (a *API) queries() model.AdminQueryModel { return model.AdminQueryModel{DB: a.DB} }
func (a *API) overview(w http.ResponseWriter, r *http.Request) {
	v, e := a.queries().Overview(r.Context(), time.Now(), a.Location)
	if e != nil {
		fail(w, e)
		return
	}
	ok(w, v)
}
func (a *API) members(w http.ResponseWriter, r *http.Request) {
	l, c, e := page(r)
	if e != nil {
		adminauth.Reply(w, 400, "INVALID", nil)
		return
	}
	rows, e := a.queries().Members(r.Context(), model.AdminListCriteria{Query: strings.TrimSpace(r.URL.Query().Get("q")), BeforeID: c, Limit: l})
	if e != nil {
		fail(w, e)
		return
	}
	next := ""
	if len(rows) > l {
		rows = rows[:l]
		id, _ := strconv.ParseInt(rows[l-1].UID, 10, 64)
		next = cursor(id)
	}
	ok(w, map[string]any{"items": rows, "nextCursor": next})
}
func (a *API) member(w http.ResponseWriter, r *http.Request) {
	id, e := strconv.ParseInt(r.PathValue("uid"), 10, 64)
	if e != nil || id < 1 {
		adminauth.Reply(w, 400, "INVALID", nil)
		return
	}
	detail, e := a.queries().Member(r.Context(), id)
	if e != nil {
		fail(w, e)
		return
	}
	for i := range detail.Accounts {
		detail.Accounts[i].Account = mask(detail.Accounts[i].Account)
		detail.Accounts[i].Name = mask(detail.Accounts[i].Name)
	}
	ok(w, map[string]any{"member": detail.Member, "wallet": map[string]string{"coins": detail.Member.Coins, "turnoverRequired": strconv.FormatInt(detail.Remaining, 10)}, "accounts": detail.Accounts, "ledger": detail.Ledger})
}

func (a *API) orders(w http.ResponseWriter, r *http.Request) {
	queryCopy := *r
	urlCopy := *r.URL
	queryCopy.URL = &urlCopy
	values := r.URL.Query()
	values.Del("cursor")
	queryCopy.URL.RawQuery = values.Encode()
	l, _, e := page(&queryCopy)
	if e != nil {
		adminauth.Reply(w, 400, "INVALID", nil)
		return
	}
	kind := r.URL.Query().Get("kind")
	if kind != "deposit" && kind != "withdrawal" {
		adminauth.Reply(w, 400, "INVALID", nil)
		return
	}
	criteria := model.AdminOrderCriteria{Kind: kind, Status: r.URL.Query().Get("status"), Query: r.URL.Query().Get("q"), Limit: l}
	if s := r.URL.Query().Get("cursor"); s != "" {
		b, e := base64.RawURLEncoding.DecodeString(s)
		if e != nil {
			adminauth.Reply(w, 400, "INVALID", nil)
			return
		}
		parts := strings.SplitN(string(b), "|", 2)
		if len(parts) != 2 {
			adminauth.Reply(w, 400, "INVALID", nil)
			return
		}
		t, e := time.Parse(time.RFC3339Nano, parts[0])
		if e != nil {
			adminauth.Reply(w, 400, "INVALID", nil)
			return
		}
		criteria.BeforeTime = t
		criteria.BeforeID = parts[1]
	}
	rows, e := a.queries().Orders(r.Context(), criteria)
	if e != nil {
		fail(w, e)
		return
	}
	next := ""
	if len(rows) > l {
		rows = rows[:l]
		v := rows[l-1]
		next = base64.RawURLEncoding.EncodeToString([]byte(v.CreatedAt.Format(time.RFC3339Nano) + "|" + v.OrderID))
	}
	for i := range rows {
		rows[i].Kind = kind
		rows[i].Account = mask(rows[i].Account)
		rows[i].Name = mask(rows[i].Name)
	}
	ok(w, map[string]any{"items": rows, "nextCursor": next})
}
func (a *API) review(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Kind      string `json:"kind"`
		OrderID   string `json:"orderId"`
		Decision  string `json:"decision"`
		Reason    string `json:"reason"`
		RequestID string `json:"requestId"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&b) != nil || (b.Kind != "deposit" && b.Kind != "withdrawal") || (b.Decision != "approve" && b.Decision != "return") || len(strings.TrimSpace(b.Reason)) < 1 || len(b.Reason) > 1000 || len(b.RequestID) < 8 || len(b.RequestID) > 128 || b.OrderID == "" {
		adminauth.Reply(w, 400, "INVALID", nil)
		return
	}
	recharge := a.Recharge
	if a.ReviewModel != nil {
		var e error
		recharge, e = a.ReviewModel(r)
		if e != nil {
			fail(w, e)
			return
		}
	}
	status, e := recharge.AdminReview(r.Context(), model.AdminReview{Username: adminauth.Actor(r), Kind: b.Kind, OrderID: b.OrderID, Decision: b.Decision, Reason: b.Reason, RequestID: b.RequestID})
	if e != nil {
		if errors.Is(e, model.ErrAdminConflict) {
			adminauth.Reply(w, 409, "CONFLICT", nil)
		} else {
			fail(w, e)
		}
		return
	}
	ok(w, map[string]string{"orderId": b.OrderID, "status": status})
}
func (a *API) audit(w http.ResponseWriter, r *http.Request) {
	l, c, e := page(r)
	if e != nil {
		adminauth.Reply(w, 400, "INVALID", nil)
		return
	}
	rows, e := a.queries().Audit(r.Context(), model.AdminListCriteria{Query: r.URL.Query().Get("q"), BeforeID: c, Limit: l})
	if e != nil {
		fail(w, e)
		return
	}
	next := ""
	if len(rows) > l {
		rows = rows[:l]
		id, _ := strconv.ParseInt(rows[l-1].ID, 10, 64)
		next = cursor(id)
	}
	ok(w, map[string]any{"items": rows, "nextCursor": next})
}

func (a *API) generateRedeemCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UID      string `json:"uid"`
		Amount   string `json:"amount"`
		Turnover bool   `json:"turnover"`
		Reason   string `json:"reason"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&body) != nil {
		adminauth.Reply(w, 400, "INVALID", nil)
		return
	}
	uid, err := strconv.ParseInt(body.UID, 10, 64)
	if err != nil || uid < 1 {
		adminauth.Reply(w, 400, "INVALID", nil)
		return
	}
	amount, err := strconv.ParseInt(body.Amount, 10, 64)
	if err != nil || amount < 1 || body.Amount != strconv.FormatInt(amount, 10) {
		adminauth.Reply(w, 400, "INVALID", nil)
		return
	}
	reason := strings.TrimSpace(body.Reason)
	if len(reason) < 1 || len(reason) > 1000 {
		adminauth.Reply(w, 400, "INVALID", nil)
		return
	}
	code, row, err := a.RedeemCodes.Create(r.Context(), uid, amount, body.Turnover, adminauth.Actor(r), reason)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			adminauth.Reply(w, 404, "NOT_FOUND", nil)
		} else if err == gorm.ErrForeignKeyViolated {
			adminauth.Reply(w, 404, "NOT_FOUND", nil)
		} else {
			fail(w, err)
		}
		return
	}
	ok(w, map[string]any{"code": code, "uid": strconv.FormatInt(row.UID, 10), "amount": strconv.FormatInt(row.Amount, 10), "turnover": row.TurnoverMultiplier > 0, "createdAt": row.CreatedAt.UTC().Format(time.RFC3339Nano)})
}

func (a *API) redeemCodes(w http.ResponseWriter, r *http.Request) {
	limit := 20
	if value := r.URL.Query().Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 || parsed > 100 {
			adminauth.Reply(w, 400, "INVALID", nil)
			return
		}
		limit = parsed
	}
	var before time.Time
	var beforeID string
	if value := r.URL.Query().Get("cursor"); value != "" {
		decoded, err := base64.RawURLEncoding.DecodeString(value)
		if err != nil {
			adminauth.Reply(w, 400, "INVALID", nil)
			return
		}
		parts := strings.SplitN(string(decoded), "|", 2)
		if len(parts) != 2 {
			adminauth.Reply(w, 400, "INVALID", nil)
			return
		}
		before, err = time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			adminauth.Reply(w, 400, "INVALID", nil)
			return
		}
		beforeID = parts[1]
	}
	rows, err := a.RedeemCodes.List(r.Context(), strings.TrimSpace(r.URL.Query().Get("q")), before, beforeID, limit)
	if err != nil {
		fail(w, err)
		return
	}
	next := ""
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[limit-1]
		next = base64.RawURLEncoding.EncodeToString([]byte(last.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + last.ID))
	}
	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		item := map[string]any{"id": row.ID, "uid": strconv.FormatInt(row.UID, 10), "amount": strconv.FormatInt(row.Amount, 10), "turnover": row.Turnover, "status": row.Status, "createdBy": row.CreatedBy, "createdAt": row.CreatedAt.UTC().Format(time.RFC3339Nano)}
		if row.RedeemedAt != nil {
			item["redeemedAt"] = row.RedeemedAt.UTC().Format(time.RFC3339Nano)
		}
		items = append(items, item)
	}
	ok(w, map[string]any{"items": items, "nextCursor": next})
}
