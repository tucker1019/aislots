package repository

import (
	"time"

	"apps/app/apis/lobby/api/internal/config"

	"apps/app/apis/lobby/api/internal/repository/model"

	"gorm.io/gorm"
)

type Repository struct {
	Withdrawal *model.WithdrawalModel
	Wallet     WalletStore
	Agent      AgentStore
	Invite     *model.InviteModel
	Game       GameStore
	Users      UserStore
	Recharge   RechargeStore
	Checkin    CheckinStore
	Returns    ReturnStore
	Activity   *model.ActivityModel
	VIP        VIPStore
	Newbie     NewbieStore
}

func New(db *gorm.DB, locations ...*time.Location) *Repository {
	loc := time.UTC
	if len(locations) > 0 {
		loc = locations[0]
	}
	return &Repository{Withdrawal: &model.WithdrawalModel{DB: db}, Wallet: &model.WalletAccountModel{DB: db}, Users: &model.UserModel{DB: db}, Recharge: &model.RechargeModel{DB: db, ActivityLocation: loc}, Checkin: &model.CheckinModel{DB: db}, Returns: &model.ReturnModel{DB: db}, Activity: &model.ActivityModel{DB: db, Location: loc}}
}

// ConfigureVIP wires the same engine into user creation, recharge and game event transactions.
func (r *Repository) ConfigureVIP(db *gorm.DB, c config.VIPConfig, loc *time.Location) {
	engine := &model.VIPModel{DB: db, Config: c, Location: loc}
	r.VIP = engine
	r.Activity.VIP = engine
	r.Game = &model.GameModel{DB: db, Location: loc, VIP: engine}
	if users, ok := r.Users.(*model.UserModel); ok {
		users.VIP = engine
	}
	if recharge, ok := r.Recharge.(*model.RechargeModel); ok {
		recharge.VIP = engine
	}
}

func (r *Repository) ConfigureNewbie(db *gorm.DB, c config.NewbieConfig) {
	engine := &model.NewbieModel{DB: db, Config: c}
	r.Newbie = engine
	if users, ok := r.Users.(*model.UserModel); ok {
		users.Newbie = engine
	}
}

func (r *Repository) ConfigureInvite(db *gorm.DB, c config.InviteConfig) {
	m := &model.InviteModel{DB: db, Config: c}
	r.Invite = m
	if users, ok := r.Users.(*model.UserModel); ok {
		users.Invite = m
	}
}

func (r *Repository) ConfigureAgent(db *gorm.DB, c config.AgentConfig, games map[string]config.GameEntry, loc *time.Location) {
	r.Agent = &model.AgentModel{DB: db, Config: c, Games: games, Location: loc}
}
