// Package platform registers outbound adapters per platform application.
package platform

import (
	"aislots/slots_service/internal/platform"
	"fmt"
)

type App struct{ AppName, AppKey string }
type Registry struct{ clients map[App]platform.Client }

func NewRegistry(clients map[App]platform.Client) (*Registry, error) {
	r := &Registry{clients: map[App]platform.Client{}}
	for app, c := range clients {
		if app.AppName == "" || app.AppKey == "" || c == nil {
			return nil, fmt.Errorf("invalid platform application adapter")
		}
		r.clients[app] = c
	}
	return r, nil
}
func (r *Registry) Resolve(name, key string) (platform.Client, error) {
	c := r.clients[App{name, key}]
	if c == nil {
		return nil, platform.ErrUnavailable
	}
	return c, nil
}
