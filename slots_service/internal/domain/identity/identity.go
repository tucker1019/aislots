// Package identity describes platform-scoped identities, not local user accounts.
package identity

import "strings"

type Subject struct {
	AppName string `json:"appname"`
	AppKey  string `json:"appkey"`
	UID     string `json:"uid"`
}

func (s Subject) Valid() bool { return valid(s.AppName) && valid(s.AppKey) && valid(s.UID) }

// Context is trusted data obtained from platform verification, never a raw bet body.
type Context struct {
	Subject  Subject `json:"subject"`
	Country  string  `json:"country"`
	Currency string  `json:"currency"`
}

func (c Context) Valid() bool { return c.Subject.Valid() && valid(c.Country) && valid(c.Currency) }
func valid(s string) bool     { return len(s) <= 128 && strings.TrimSpace(s) != "" }
