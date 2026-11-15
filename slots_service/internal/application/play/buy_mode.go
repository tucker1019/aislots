package play

import "context"

func normalBuyMode(mode int) int {
	if mode == 0 {
		return 1
	}
	return mode
}

// BetMultiplier consults the owning runtime. Other modules retain normal mode.
func (s *Service) BetMultiplier(gameID string, mode int, version string) (int64, error) {
	mode = normalBuyMode(mode)
	if mode != 1 && mode != 2 {
		return 0, ErrInvalid
	}
	module, err := s.games.Resolve(gameID, version)
	if err != nil {
		return 0, err
	}
	if capable, ok := module.(interface{ BetMultiplier(int) (int64, error) }); ok {
		factor, err := capable.BetMultiplier(mode)
		if err != nil || factor < 1 {
			return 0, ErrInvalid
		}
		return factor, nil
	}
	if mode != 1 {
		return 0, ErrInvalid
	}
	return 1, nil
}
func (s *Service) allowedModeStake(ctx context.Context, session Session, gameID string, amount int64, mode int, version string) error {
	factor, err := s.BetMultiplier(gameID, mode, version)
	if err != nil {
		return err
	}
	if amount <= 0 || amount%factor != 0 {
		return ErrInvalid
	}
	return s.bets.AllowedTotal(ctx, session.Player, gameID, amount/factor)
}
