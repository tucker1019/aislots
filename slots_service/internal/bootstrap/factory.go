package bootstrap

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/infrastructure/gamedata"
	"fmt"
	"io"
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
	return map[string]Factory{engine.RuleType: loadWaysCascade}
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
	e, err := engine.NewEngine(game, library, engine.Options{TriggerSymbolCount: spec.TriggerSymbolCount, FreeAwardSymbolCounts: spec.FreeAwardSymbolCounts, MaxFillAttempts: spec.MaxFillAttempts})
	if err != nil {
		return fail(err)
	}
	return LoadedGame{GameID: game.ID, Engine: e, Closer: library}, nil
}
