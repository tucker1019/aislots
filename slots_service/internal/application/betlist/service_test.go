package betlist

import (
	"aislots/slots_service/internal/domain/identity"
	"context"
	"errors"
	"testing"
)

func TestExplicitPoliciesAndOverrides(t *testing.T) {
	base := Policy{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100, 200}, Default: 100}
	override := base
	override.AppName = "a"
	override.AppKey = "special"
	override.Amounts = []int64{500}
	override.Default = 500
	s, err := New([]Policy{base, override})
	if err != nil {
		t.Fatal(err)
	}
	base.Amounts[0] = 999
	who := identity.Context{Subject: identity.Subject{AppName: "a", AppKey: "app", UID: "u"}, Country: "ID", Currency: "IDR"}
	p, err := s.List(context.Background(), who, "AG1")
	if err != nil || p.Amounts[0] != 100 {
		t.Fatal(p, err)
	}
	p.Amounts[0] = 999
	if err = s.Allowed(context.Background(), who, "AG1", 100); err != nil {
		t.Fatal("caller changed policy")
	}
	who.Subject.AppKey = "special"
	if err = s.Allowed(context.Background(), who, "AG1", 100); !errors.Is(err, ErrNotAllowed) {
		t.Fatal(err)
	}
	if err = s.Allowed(context.Background(), who, "AG1", 500); err != nil {
		t.Fatal(err)
	}
	who.Currency = "USD"
	if _, err = s.List(context.Background(), who, "AG1"); !errors.Is(err, ErrUnavailable) {
		t.Fatal("fallback to wrong currency", err)
	}
	who.Currency = "IDR"
	if _, err = s.List(context.Background(), who, "AG2"); !errors.Is(err, ErrUnavailable) {
		t.Fatal("fallback to wrong game", err)
	}
}
func TestBadPolicies(t *testing.T) {
	p := Policy{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{1}, Default: 1}
	if _, err := New([]Policy{p, p}); err == nil {
		t.Fatal("duplicate scope accepted")
	}
	p.Default = 2
	if _, err := New([]Policy{p}); err == nil {
		t.Fatal("invalid default accepted")
	}
}
