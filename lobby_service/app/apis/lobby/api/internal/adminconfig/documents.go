// Package adminconfig stores audited configuration versions, never filesystem paths.
package adminconfig

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"strings"

	"apps/app/apis/lobby/api/internal/config"
)

type Section struct {
	Key         string `json:"key"`
	Label       string `json:"label"`
	Description string `json:"description"`
}

var Sections = []Section{
	{"content", "公告与轮播", "繁体中文/英文公告、Banner图片与站内跳转"},
	{"recharge", "存款档位", "金额、赠送、手续费（金额单位：分）；只影响新订单"},
	{"withdrawal", "取款档位", "金额、赠送、手续费（金额单位：分）；保留原订单快照"},
	{"checkin", "每日签到", "奖励和达标要求；活动时区固定"},
	{"returns", "反水与亏损返还", "整数基点：100基点=1%；仅影响未结算的新统计周期"},
	{"turnover", "取款流水倍数", "按入账来源配置；历史入账流水要求不重算"},
	{"agent", "代理佣金", "厂商阶梯及比例；历史结算规则保持快照"},
	{"vip", "VIP等级与奖励", "升级、保级、周月工资；已生成奖励不变"},
	{"invite", "邀请好友", "达标要求、奖励和邀请链接"},
	{"newbie-recharge", "新手充值", "新注册参与者期限与档位；已有参与者保留原规则"},
	{"games", "游戏入口", "游戏封面、排序、是否显示与上线；隐藏不返回，未上线敬请期待"},
	{"experience", "体验账号", "体验账号生成与游戏间隔"},
}

func known(key string) bool {
	for _, s := range Sections {
		if key == s.Key {
			return true
		}
	}
	return false
}

func withDocument(key string, doc []byte, run func(string) error) error {
	if !known(key) {
		return fmt.Errorf("unknown configuration section")
	}
	if len(doc) == 0 || len(doc) > 512*1024 {
		return fmt.Errorf("configuration document must be between 1 and 524288 bytes")
	}
	var value any
	d := json.NewDecoder(bytes.NewReader(doc))
	d.UseNumber()
	if e := d.Decode(&value); e != nil {
		return fmt.Errorf("invalid configuration JSON: %w", e)
	}
	if e := d.Decode(new(any)); e != io.EOF {
		return fmt.Errorf("trailing configuration JSON")
	}
	if e := safeValues(value, key); e != nil {
		return e
	}
	f, e := os.CreateTemp("", "aislots-config-*.json")
	if e != nil {
		return e
	}
	path := f.Name()
	defer func() { _ = os.Remove(path) }()
	if _, e = f.Write(doc); e != nil {
		_ = f.Close()
		return e
	}
	if e = f.Close(); e != nil {
		return e
	}
	return run(path)
}
func safeValues(v any, section string, path ...string) error {
	switch t := v.(type) {
	case json.Number:
		// Only games.<gameId>.theoreticalRtp is a percentage with decimals.
		if section == "games" && len(path) == 3 && path[0] == "games" && path[2] == "theoreticalRtp" {
			n, err := t.Float64()
			if err != nil || math.IsNaN(n) || math.IsInf(n, 0) || n < 0 || n > 100 {
				return fmt.Errorf("theoretical RTP must be between 0 and 100")
			}
			return nil
		}
		n, e := t.Int64()
		if e != nil || n > 9007199254740991 || n < -9007199254740991 {
			return fmt.Errorf("configuration numbers must be safe integers")
		}
	case map[string]any:
		for k, n := range t {
			l := strings.ToLower(k)
			if strings.Contains(l, "password") || strings.Contains(l, "secret") || strings.Contains(l, "token") {
				return fmt.Errorf("secrets must remain deployment environment variables")
			}
			if e := safeValues(n, section, append(path, k)...); e != nil {
				return e
			}
		}
	case []any:
		for _, n := range t {
			if e := safeValues(n, section, append(path, "[]")...); e != nil {
				return e
			}
		}
	}
	return nil
}
func strict[T any](b []byte) error {
	d := json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	var v T
	return d.Decode(&v)
}
func ValidateDocument(key string, doc []byte) error {
	return withDocument(key, doc, func(path string) error {
		var e error
		switch key {
		case "content":
			_, e = config.LoadContent(path)
		case "recharge", "withdrawal":
			_, e = config.LoadRechargeTiers(path)
		case "checkin":
			_, e = config.LoadCheckin(path)
		case "returns":
			if e = strict[config.ReturnConfig](doc); e == nil {
				_, e = config.LoadReturns(path)
			}
		case "turnover":
			_, e = config.LoadTurnover(path)
		case "agent":
			_, e = config.LoadAgent(path)
		case "vip":
			_, e = config.LoadVIP(path)
		case "invite":
			_, e = config.LoadInvite(path)
		case "newbie-recharge":
			_, e = config.LoadNewbie(path)
		case "experience":
			_, e = config.LoadExperience(path)
		case "games":
			if e = strict[config.GameConfig](doc); e == nil {
				_, e = config.LoadGames(path)
			}
		}
		if e != nil {
			return fmt.Errorf("invalid %s configuration: %w", key, e)
		}
		return nil
	})
}
func applyDocument(c *config.Config, key string, doc []byte) error {
	if e := ValidateDocument(key, doc); e != nil {
		return e
	}
	return withDocument(key, doc, func(path string) error {
		var e error
		switch key {
		case "content":
			c.Content, e = config.LoadContent(path)
		case "recharge":
			c.RechargeTiers, e = config.LoadRechargeTiers(path)
		case "withdrawal":
			c.WithdrawalTiers, e = config.LoadRechargeTiers(path)
		case "checkin":
			c.Checkin, e = config.LoadCheckin(path)
		case "returns":
			c.Returns, e = config.LoadReturns(path)
		case "turnover":
			c.Turnover, e = config.LoadTurnover(path)
		case "agent":
			c.Agent, e = config.LoadAgent(path)
		case "vip":
			c.VIP, e = config.LoadVIP(path)
		case "invite":
			c.Invite, e = config.LoadInvite(path)
		case "newbie-recharge":
			c.Newbie, e = config.LoadNewbie(path)
		case "games":
			token := c.Game.ServiceToken
			c.Game, e = config.LoadGames(path)
			c.Game.ServiceToken = token
		}
		return e
	})
}
func checkImmutable(c config.Config, key string, doc []byte) error {
	switch key {
	case "checkin":
		var v config.CheckinConfig
		if e := json.Unmarshal(doc, &v); e != nil {
			return e
		}
		if v.Timezone != c.Checkin.Timezone {
			return fmt.Errorf("活动时区不能在线修改")
		}
	case "games":
		var v config.GameConfig
		if e := json.Unmarshal(doc, &v); e != nil {
			return e
		}
		old := c.Game
		if v.AppName != old.AppName || v.AppKey != old.AppKey || v.Country != old.Country || v.Currency != old.Currency {
			return fmt.Errorf("平台身份和币种不能在线修改")
		}
	case "vip":
		var v config.VIPConfig
		if e := json.Unmarshal(doc, &v); e != nil {
			return e
		}
		if len(v.Levels) < len(c.VIP.Levels) {
			return fmt.Errorf("不能移除已有VIP等级；避免已升级用户奖励失效")
		}
	}
	return nil
}
func versioned(key string) bool {
	return key == "checkin" || key == "turnover" || key == "agent" || key == "vip" || key == "invite" || key == "newbie-recharge"
}
func publishDocument(key string, version int64, doc []byte) ([]byte, error) {
	if !versioned(key) {
		return doc, nil
	}
	var v map[string]json.RawMessage
	if e := json.Unmarshal(doc, &v); e != nil {
		return nil, e
	}
	b, _ := json.Marshal(fmt.Sprintf("admin-%s-%d", key, version))
	v["version"] = b
	return json.Marshal(v)
}
