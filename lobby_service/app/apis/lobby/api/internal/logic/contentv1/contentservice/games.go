package contentservice

import (
	pb "apps/pb/apis/lobby/api/v1"
	"context"
	"sort"
)

func (l *Logic) Games(_ context.Context, _ *pb.LobbyGamesRequest) (*pb.LobbyGamesReply, error) {
	out := &pb.LobbyGamesReply{Games: []*pb.LobbyGame{}}
	for id, g := range l.ctx.Config.Game.Games {
		if !g.IsVisible() {
			continue
		}
		out.Games = append(out.Games, &pb.LobbyGame{Id: id, Name: g.Name, NameEn: g.NameEn, Provider: g.Provider, Cover: g.Cover, Enabled: g.Enabled, Sort: g.Sort})
	}
	sort.Slice(out.Games, func(i, j int) bool {
		a, b := out.Games[i], out.Games[j]
		if a.Sort != b.Sort {
			return a.Sort < b.Sort
		}
		return a.Id < b.Id
	})
	return out, nil
}
