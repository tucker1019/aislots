package model

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"testing"
	"time"

	"gorm.io/gorm"
)

func TestAdminMembersExcludeExperienceAccounts(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	create := func(kind, account, nickname string) int64 {
		t.Helper()
		u := LobbyUser{AccountType: kind, Nickname: nickname, AvatarID: 1}
		if account != "" {
			u.Account = &account
			hash := "unused-test-password-hash"
			u.PasswordHash = &hash
		}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&LobbyWalletBalance{UID: u.UID}).Error; err != nil {
			t.Fatal(err)
		}
		return u.UID
	}
	real := create("real", "member-search-real", "共同昵称")
	experience := create("experience", "member-search-experience", "共同昵称")
	visitor := create("real", "", "体验玩家")
	create("experience", "", "共同昵称")
	q := AdminQueryModel{DB: db}
	for _, tc := range []struct {
		name     string
		criteria AdminListCriteria
		want     []int64
	}{
		{"list", AdminListCriteria{Limit: 20}, []int64{visitor, real}},
		{"page lookahead excludes experience", AdminListCriteria{Limit: 1}, []int64{visitor, real}},
		{"cursor skips experience", AdminListCriteria{Limit: 1, BeforeID: visitor}, []int64{real}},
		{"real UID", AdminListCriteria{Limit: 20, Query: strconv.FormatInt(real, 10)}, []int64{real}},
		{"experience UID", AdminListCriteria{Limit: 20, Query: strconv.FormatInt(experience, 10)}, nil},
		{"account", AdminListCriteria{Limit: 20, Query: "member-search"}, []int64{real}},
		{"experience account", AdminListCriteria{Limit: 20, Query: "member-search-experience"}, nil},
		{"nickname", AdminListCriteria{Limit: 20, Query: "共同昵称"}, []int64{real}},
		{"real visitor with experience nickname", AdminListCriteria{Limit: 20, Query: "体验玩家"}, []int64{visitor}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rows, err := q.Members(ctx, tc.criteria)
			if err != nil {
				t.Fatal(err)
			}
			var got []int64
			for _, row := range rows {
				uid, err := strconv.ParseInt(row.UID, 10, 64)
				if err != nil {
					t.Fatal(err)
				}
				got = append(got, uid)
			}
			if !slices.Equal(got, tc.want) {
				t.Fatalf("member UIDs: got %v, want %v", got, tc.want)
			}
		})
	}
	for _, uid := range []int64{real, visitor} {
		if detail, err := q.Member(ctx, uid); err != nil || detail.Member.UID != strconv.FormatInt(uid, 10) {
			t.Fatalf("real member detail missing: uid=%d, err=%v", uid, err)
		}
	}
	if _, err := q.Member(ctx, experience); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("experience member detail should be hidden: %v", err)
	}
}

func TestAdminOverviewActivityDay(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", "overview-timezone", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	times := []time.Time{time.Date(2026, 6, 10, 16, 59, 59, 0, time.UTC), time.Date(2026, 6, 10, 17, 0, 0, 0, time.UTC), time.Date(2026, 6, 11, 16, 59, 59, 0, time.UTC), time.Date(2026, 6, 11, 17, 0, 0, 0, time.UTC)}
	for i, settled := range times {
		id := string(rune('a' + i))
		if e = db.Create(&LobbyRechargeOrder{OrderID: id, UID: uid, RequestID: id, TierID: "test", Amount: int64(i+1) * 100, CreditAmount: int64(i+1) * 100, Coins: int64(i+1) * 100, Status: "success", SettledAt: &settled, CreatedAt: settled, SettleAt: settled}).Error; e != nil {
			t.Fatal(e)
		}
		if e = db.Create(&LobbyWithdrawalOrder{OrderID: id, UID: uid, RequestID: id, TierID: "test", Channel: "test1", Account: "test", Name: "test", Amount: int64(i+1) * 200, Status: "success", SettledAt: &settled, CreatedAt: settled}).Error; e != nil {
			t.Fatal(e)
		}
	}
	loc, _ := time.LoadLocation("Asia/Jakarta")
	v, e := (AdminQueryModel{DB: db}).Overview(ctx, time.Date(2026, 6, 11, 0, 30, 0, 0, time.UTC), loc)
	if e != nil {
		t.Fatal(e)
	}
	if v.TodayDeposits != "500" || v.TodayWithdrawals != "1000" || v.Members != 1 {
		t.Fatalf("activity day totals %+v", v)
	}
}
func TestAdminQueriesHonorCancelledContext(t *testing.T) {
	db := vipTestDB(t)
	q := AdminQueryModel{DB: db}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, e := q.Overview(ctx, time.Now(), nil); !errors.Is(e, context.Canceled) {
		t.Fatalf("overview cancellation %v", e)
	}
	if _, e := q.Members(ctx, AdminListCriteria{Limit: 20}); !errors.Is(e, context.Canceled) {
		t.Fatalf("members cancellation %v", e)
	}
	if _, e := q.Member(ctx, 1); !errors.Is(e, context.Canceled) {
		t.Fatalf("member cancellation %v", e)
	}
	if _, e := q.Orders(ctx, AdminOrderCriteria{Kind: "deposit", Limit: 20}); !errors.Is(e, context.Canceled) {
		t.Fatalf("orders cancellation %v", e)
	}
	if _, e := q.Audit(ctx, AdminListCriteria{Limit: 20}); !errors.Is(e, context.Canceled) {
		t.Fatalf("audit cancellation %v", e)
	}
}
