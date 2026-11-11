// library-check validates explicit saved batches without changing deployment configuration.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/infrastructure/gamedata"
)

func main() {
	configDir := flag.String("game-config", "", "game configuration directory")
	base := flag.String("base", "", "explicit base library batch directory")
	free := flag.String("free", "", "explicit free library batch directory")
	flag.Parse()
	if err := check(*configDir, *base, *free); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func check(configDir, base, free string) error {
	if configDir == "" || base == "" || free == "" {
		return fmt.Errorf("-game-config, -base and -free are required")
	}
	game, err := gamedata.LoadGame(configDir)
	if err != nil {
		return err
	}
	store, err := gamedata.OpenDiskLibrary(base, free)
	if err != nil {
		return err
	}
	defer store.Close()
	if err = store.CheckCompatibility(game); err != nil {
		return err
	}
	if err = store.CheckWinningCoverage(game); err != nil {
		return err
	}
	for _, entry := range []struct {
		mode engine.Mode
		rows []engine.WeightRow
	}{{engine.Base, game.BaseRows}, {engine.Free, game.FreeRows}} {
		for _, row := range entry.rows {
			weight, err := row[1].Float64()
			if err != nil {
				return err
			}
			if weight > 0 && row[0].String() != "0" && store.Count(entry.mode, row[0].String()) == 0 {
				return fmt.Errorf("missing multiplier skeleton: %s/%s/%s", game.ID, entry.mode, row[0])
			}
		}
	}
	base, _ = filepath.Abs(base)
	free, _ = filepath.Abs(free)
	fmt.Printf("PASS game=%s base=%s free=%s\n", game.ID, base, free)
	return nil
}
