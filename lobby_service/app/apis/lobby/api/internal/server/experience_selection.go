package server

import (
	"apps/app/apis/lobby/api/internal/config"
	"crypto/rand"
	"fmt"
	"math/big"
	"sort"
)

func experienceDraw(total int64) (int64, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(total))
	if err != nil {
		return 0, err
	}
	return n.Int64(), nil
}
func selectExperienceGame(c config.ExperienceConfig, games map[string]config.GameEntry, draw func(int64) (int64, error)) (string, error) {
	weights := c.Weights()
	ids := []string{}
	var total int64
	for id, weight := range weights {
		g, ok := games[id]
		if ok && g.Enabled && g.APIURL != "" && weight > 0 {
			ids = append(ids, id)
			total += weight
		}
	}
	if total == 0 {
		return "", nil
	}
	sort.Strings(ids)
	n, err := draw(total)
	if err != nil {
		return "", err
	}
	if n < 0 || n >= total {
		return "", fmt.Errorf("invalid experience random draw")
	}
	for _, id := range ids {
		if n < weights[id] {
			return id, nil
		}
		n -= weights[id]
	}
	return "", fmt.Errorf("invalid experience weights")
}
func experienceShouldStop(rounds, every, chance int, draw func() int) bool {
	return every > 0 && rounds > 0 && rounds%every == 0 && chance > 0 && draw() <= chance
}
