package bootstrap

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/games"
	"aislots/slots_service/internal/games/ag4"
	"aislots/slots_service/internal/infrastructure/gamedata"
	"aislots/slots_service/internal/rules/paylines"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
)

// LoadedGame owns one immutable rules implementation and its resources.
type LoadedGame struct {
	GameID string
	Engine bet.Spinner
	Closer io.Closer
}

// Factory validates type-specific config and assembles its generator AND validator.
// Spin must return only fully validated outcomes; the settlement layer must not know matching rules.
type Factory func(GameConfig) (LoadedGame, error)

func builtInFactories() map[string]Factory {
	return map[string]Factory{engine.RuleType: loadWaysCascade, paylines.RuleType: loadPaylines}
}
func loadWaysCascade(spec GameConfig) (LoadedGame, error) {
	if spec.RuleType != engine.RuleType || spec.BaseLibraryDir == "" || spec.FreeLibraryDir == "" || spec.TriggerSymbolCount < 3 || spec.TriggerSymbolCount > 5 || spec.MaxFillAttempts < 1 || spec.MaxFillAttempts > 1000 {
		return LoadedGame{}, fmt.Errorf("invalid %s configuration", engine.RuleType)
	}
	game, err := gamedata.LoadGame(spec.ConfigDir)
	if err != nil {
		return LoadedGame{}, err
	}
	library, err := gamedata.OpenDiskLibrary(spec.BaseLibraryDir, spec.FreeLibraryDir)
	if err != nil {
		return LoadedGame{}, err
	}
	fail := func(err error) (LoadedGame, error) { library.Close(); return LoadedGame{}, err }
	if err = library.CheckCompatibility(game); err != nil {
		return fail(err)
	}
	if spec.Current {
		if err = library.CheckWinningCoverage(game); err != nil {
			return fail(err)
		}
	}
	e, err := engine.NewEngine(game, library, engine.Options{TriggerSymbolCount: spec.TriggerSymbolCount, FreeAwardSymbolCounts: spec.FreeAwardSymbolCounts, MaxFillAttempts: spec.MaxFillAttempts})
	if err != nil {
		return fail(err)
	}
	slog.Info("game library validated", "gameId", game.ID, "version", e.Version(), "configDir", spec.ConfigDir, "baseLibraryDir", spec.BaseLibraryDir, "freeLibraryDir", spec.FreeLibraryDir, "current", spec.Current)
	module, err := games.WrapWays(game.ID, e)
	if err != nil {
		return fail(err)
	}
	return LoadedGame{GameID: game.ID, Engine: module, Closer: library}, nil
}

func loadAG4(spec GameConfig) (LoadedGame, error) {
	if spec.RuleType != paylines.RuleType || spec.BaseLibraryDir == "" || spec.FreeLibraryDir == "" {
		return LoadedGame{}, fmt.Errorf("invalid AG4 configuration")
	}
	module, err := ag4.Load(spec.ConfigDir, spec.BaseLibraryDir, spec.FreeLibraryDir, ag4.Options{MaxFillAttempts: spec.MaxFillAttempts})
	if err != nil {
		return LoadedGame{}, err
	}
	slog.Info("game module validated", "gameId", ag4.ID, "version", module.Version(), "current", spec.Current)
	return LoadedGame{GameID: ag4.ID, Engine: module}, nil
}

// A matching algorithm does not select a game's bonus state machine. New
// payline games register their own loader here instead of inheriting AG4.
func loadPaylines(spec GameConfig) (LoadedGame, error) {
	modules := map[string]Factory{ag4.ID: loadAG4}
	id := filepath.Base(filepath.Clean(spec.ConfigDir))
	factory := modules[id]
	if factory == nil {
		return LoadedGame{}, fmt.Errorf("unregistered payline game module %q", id)
	}
	return factory(spec)
}
