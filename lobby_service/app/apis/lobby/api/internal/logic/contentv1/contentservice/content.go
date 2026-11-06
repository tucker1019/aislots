package contentservice

import (
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"context"
)

type Logic struct{ ctx *svc.ServiceContext }

func New(ctx *svc.ServiceContext) *Logic { return &Logic{ctx} }
func (l *Logic) Content(_ context.Context, _ *pb.LobbyContentRequest) (*pb.LobbyContentReply, error) {
	c := l.ctx.Config.Content
	reply := &pb.LobbyContentReply{}
	for _, locale := range []string{"zh-TW", "en-US"} {
		reply.Announcements = append(reply.Announcements, &pb.LocalizedAnnouncement{Locale: locale, Items: append([]string(nil), c.Announcements[locale]...)})
	}
	for _, b := range c.Banners {
		if !b.Enabled {
			continue
		}
		reply.Banners = append(reply.Banners, &pb.LobbyBanner{Id: b.ID, Enabled: b.Enabled, ImageZhTw: b.ImageZhTw, ImageEnUs: b.ImageEnUs, AltZhTw: b.AltZhTw, AltEnUs: b.AltEnUs, Route: b.Route})
	}
	return reply, nil
}
