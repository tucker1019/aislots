package userservice

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"
	"unicode/utf8"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/svc"
	"apps/pkg/xerr"

	"golang.org/x/crypto/bcrypt"
)

type Identity struct {
	UID       int64     `json:"uid"`
	SID       string    `json:"sid"`
	ExpiresAt time.Time `json:"expiresAt"`
}
type Service struct {
	Withdrawal         *model.WithdrawalModel
	WithdrawalTiers    []config.RechargeTier
	WithdrawalTestMode bool
	Wallet             repository.WalletStore
	Store              repository.UserStore
	TTL                time.Duration
}

func NewUserLogic(ctx *svc.ServiceContext) *Service {
	return &Service{Withdrawal: ctx.Repo.Withdrawal, WithdrawalTiers: ctx.Config.WithdrawalTiers, WithdrawalTestMode: ctx.Config.WithdrawalTestMode, Wallet: ctx.Repo.Wallet, Store: ctx.Repo.Users, TTL: ctx.Config.SessionTTL()}
}

func Hash(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func (s *Service) token() (string, time.Time) {
	return rand.Text() + rand.Text(), time.Now().UTC().Add(s.TTL)
}

func valid(account, password string) bool {
	return account == strings.TrimSpace(account) && len(account) >= 3 && len(account) <= 64 && utf8.ValidString(account) && len(password) >= 8 && len(password) <= 72
}

func (s *Service) Create(ctx context.Context, account, password string, visitor bool) (Identity, error) {
	hash := ""
	if !visitor {
		if !valid(account, password) {
			return Identity{}, xerr.ErrInvalid
		}
		encoded, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return Identity{}, err
		}
		hash = string(encoded)
	}
	token, expiry := s.token()
	uid, err := s.Store.Create(ctx, account, hash, Hash(token), expiry)
	return Identity{uid, token, expiry}, err
}

func (s *Service) Renew(ctx context.Context, uid int64, sid string) (Identity, error) {
	if uid <= 0 || len(sid) != 52 {
		return Identity{}, xerr.ErrSession
	}
	expiry := time.Now().UTC().Add(s.TTL)
	err := s.Store.Renew(ctx, uid, Hash(sid), time.Now().UTC(), expiry)
	return Identity{uid, sid, expiry}, err
}

func (s *Service) Login(ctx context.Context, uid int64, sid, account, password string) (Identity, error) {
	if uid <= 0 || len(sid) != 52 {
		return Identity{}, xerr.ErrSession
	}
	if err := s.Store.Check(ctx, uid, Hash(sid), time.Now().UTC()); err != nil {
		return Identity{}, err
	}
	target, hash, err := s.Store.Credentials(ctx, account)
	if err != nil {
		return Identity{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return Identity{}, xerr.ErrCredentials
	}
	token, expiry := s.token()
	err = s.Store.NewSession(ctx, target, Hash(token), expiry)
	return Identity{target, token, expiry}, err
}

func (s *Service) Bind(ctx context.Context, uid int64, sid, account, password string) (Identity, error) {
	if !valid(account, password) {
		return Identity{}, xerr.ErrInvalid
	}
	if uid <= 0 || len(sid) != 52 {
		return Identity{}, xerr.ErrSession
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return Identity{}, err
	}
	expiry := time.Now().UTC().Add(s.TTL)
	if err = s.Store.Bind(ctx, uid, Hash(sid), account, string(hash), time.Now().UTC(), expiry); err != nil {
		return Identity{}, err
	}
	return Identity{uid, sid, expiry}, nil
}

func (s *Service) CreateInvited(ctx context.Context, code string) (Identity, error) {
	if len(code) > 64 || strings.TrimSpace(code) != code {
		return Identity{}, xerr.ErrInvalid
	}
	store, ok := s.Store.(interface {
		CreateInvited(context.Context, string, time.Time, string) (int64, error)
	})
	if !ok {
		return Identity{}, xerr.ErrInvalid
	}
	token, expiry := s.token()
	uid, err := store.CreateInvited(ctx, Hash(token), expiry, code)
	return Identity{uid, token, expiry}, err
}
