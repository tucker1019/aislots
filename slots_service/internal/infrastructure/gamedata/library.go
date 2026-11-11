package gamedata

import (
	"aislots/slots_service/internal/engine"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"sync"
)

type record struct {
	offset int64
	length int
}
type libraryFile struct {
	file    *os.File
	index   map[string][]record
	config  json.RawMessage
	gameID  string
	symbols map[string]map[int]int
}
type DiskLibrary struct {
	files map[engine.Mode]*libraryFile
	once  sync.Once
}

// OpenDiskLibrary streams both JSON files once to build byte-range indexes, never keeping skeletons in memory.
// Directories must be explicit published batches; it never guesses a "latest" directory.
func OpenDiskLibrary(baseDir, freeDir string) (*DiskLibrary, error) {
	d := &DiskLibrary{files: map[engine.Mode]*libraryFile{}}
	for _, entry := range []struct {
		mode engine.Mode
		dir  string
	}{{engine.Base, baseDir}, {engine.Free, freeDir}} {
		if entry.dir == "" {
			continue
		}
		f, err := openLibraryFile(entry.dir, entry.mode)
		if err != nil {
			d.Close()
			return nil, err
		}
		d.files[entry.mode] = f
	}
	return d, nil
}
func openLibraryFile(dir string, mode engine.Mode) (*libraryFile, error) {
	var manifest struct {
		Version    int             `json:"version"`
		Format     string          `json:"format"`
		GameID     string          `json:"gameId"`
		Mode       engine.Mode     `json:"mode"`
		Unit       string          `json:"multiplierUnit"`
		Position   string          `json:"positionOrder"`
		Hash       string          `json:"dataHash"`
		ConfigHash string          `json:"configHash"`
		Config     json.RawMessage `json:"config"`
	}
	raw, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(raw, &manifest); err != nil {
		return nil, err
	}
	if manifest.Version != 1 || manifest.Format != "winning-skeleton-v1" || manifest.Mode != mode || manifest.Unit != "raw-before-line-count" || manifest.Position != "column-major-top-to-bottom-zero-based" || len(manifest.Config) == 0 {
		return nil, fmt.Errorf("incompatible library manifest %s", dir)
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, manifest.Config); err != nil {
		return nil, err
	}
	configSum := sha256.Sum256(compact.Bytes())
	if hex.EncodeToString(configSum[:]) != manifest.ConfigHash {
		return nil, fmt.Errorf("library config checksum mismatch")
	}
	file, err := os.Open(filepath.Join(dir, "library.json"))
	if err != nil {
		return nil, err
	}
	fail := func(err error) (*libraryFile, error) { file.Close(); return nil, err }
	hash := sha256.New()
	if _, err = io.Copy(hash, file); err != nil {
		return fail(err)
	}
	if hex.EncodeToString(hash.Sum(nil)) != manifest.Hash {
		return fail(fmt.Errorf("library checksum mismatch"))
	}
	if _, err = file.Seek(0, 0); err != nil {
		return fail(err)
	}
	decoder := json.NewDecoder(file)
	token, err := decoder.Token()
	if err != nil || token != json.Delim('{') {
		return fail(fmt.Errorf("library must be multiplier object"))
	}
	index := map[string][]record{}
	symbolCoverage := map[string]map[int]int{}
	for decoder.More() {
		token, err = decoder.Token()
		if err != nil {
			return fail(err)
		}
		key, ok := token.(string)
		if !ok {
			return fail(fmt.Errorf("invalid multiplier key"))
		}
		if !engine.ValidMultiplierKey(key) {
			return fail(fmt.Errorf("noncanonical multiplier key"))
		}
		if _, exists := index[key]; exists {
			return fail(fmt.Errorf("duplicate multiplier bucket"))
		}
		token, err = decoder.Token()
		if err != nil || token != json.Delim('[') {
			return fail(fmt.Errorf("bucket must be skeleton array"))
		}
		rows := []record{}
		coverage := map[int]int{}
		for decoder.More() {
			start := decoder.InputOffset()
			var skeleton []int
			if err = decoder.Decode(&skeleton); err != nil {
				return fail(err)
			}
			end := decoder.InputOffset()
			if len(skeleton) < 1 || len(skeleton) > 30000 || end-start > 512*1024 {
				return fail(fmt.Errorf("invalid/oversized skeleton"))
			}
			participating := map[int]bool{}
			for offset := 0; offset < len(skeleton); {
				count := skeleton[offset]
				offset++
				if count < 0 || count > (len(skeleton)-offset)/2 {
					return fail(fmt.Errorf("invalid skeleton stage in %s/%s", dir, key))
				}
				for i := 0; i < count; i++ {
					symbol := skeleton[offset+1]
					if symbol > 1000 {
						symbol -= 1000
					}
					participating[symbol] = true
					offset += 2
				}
			}
			for symbol := range participating {
				coverage[symbol]++
			}
			rows = append(rows, record{start, int(end - start)})
		}
		if _, err = decoder.Token(); err != nil {
			return fail(err)
		}
		if len(rows) == 0 {
			return fail(fmt.Errorf("empty multiplier bucket"))
		}
		index[key] = rows
		symbolCoverage[key] = coverage
	}
	if _, err = decoder.Token(); err != nil {
		return fail(err)
	}
	if _, err = decoder.Token(); err != io.EOF {
		return fail(fmt.Errorf("trailing library data"))
	}
	return &libraryFile{file: file, index: index, config: manifest.Config, gameID: manifest.GameID, symbols: symbolCoverage}, nil
}
func (d *DiskLibrary) Count(mode engine.Mode, key string) int {
	if f := d.files[mode]; f != nil {
		return len(f.index[key])
	}
	return 0
}
func (d *DiskLibrary) Read(ctx context.Context, mode engine.Mode, key string, index int) ([]int, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	f := d.files[mode]
	if f == nil || index < 0 || index >= len(f.index[key]) {
		return nil, engine.ErrMissingSkeleton
	}
	r := f.index[key][index]
	raw := make([]byte, r.length)
	if _, err := f.file.ReadAt(raw, r.offset); err != nil {
		return nil, err
	}
	var data []int
	if err := json.Unmarshal(bytes.TrimLeft(raw, ", \r\n\t"), &data); err != nil {
		return nil, err
	}
	return data, nil
}
func (d *DiskLibrary) Close() error {
	var first error
	d.once.Do(func() {
		for _, f := range d.files {
			if err := f.file.Close(); err != nil && first == nil {
				first = err
			}
		}
	})
	return first
}
func (d *DiskLibrary) CheckCompatibility(game engine.Game) error {
	// Fill weights and appearance settings can change without regenerating winning skeletons.
	// Match all structural/payout rules; each sampled record is also replayed under the live config.
	normalize := func(data []byte) (map[string]any, error) {
		var m map[string]any
		if err := json.Unmarshal(data, &m); err != nil {
			return nil, err
		}
		out := map[string]any{}
		for _, key := range []string{"version", "columnHeights", "cascadeFactors", "freeCascadeFactors"} {
			out[key] = m[key]
		}
		symbols, ok := m["symbols"].([]any)
		if !ok {
			return nil, fmt.Errorf("missing symbols")
		}
		list := []any{}
		for _, v := range symbols {
			s, ok := v.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid manifest symbol")
			}
			if s["role"] == "scatter" {
				continue
			}
			list = append(list, map[string]any{"id": s["id"], "role": s["role"], "payouts": s["payouts"]})
		}
		out["symbols"] = list
		gold, ok := m["gold"].(map[string]any)
		if !ok {
			return nil, fmt.Errorf("missing gold config")
		}
		out["gold"] = map[string]any{"columns": gold["columns"], "wildSymbolId": gold["wildSymbolId"]}
		return out, nil
	}
	raw, _ := json.Marshal(game.Board)
	expected, err := normalize(raw)
	if err != nil {
		return err
	}
	for _, f := range d.files {
		actual, err := normalize(f.config)
		if err != nil {
			return err
		}
		if f.gameID != game.ID || !reflect.DeepEqual(expected, actual) {
			return fmt.Errorf("library structural config mismatch for %s; regenerate matching libraries", game.ID)
		}
	}
	return nil
}

// CheckWinningCoverage applies to newly enabled batches. Historical pinned batches
// remain readable under their original rules and are not republished implicitly.
func (d *DiskLibrary) CheckWinningCoverage(game engine.Game) error {
	for _, entry := range []struct {
		mode engine.Mode
		rows []engine.WeightRow
	}{
		{engine.Base, game.BaseRows}, {engine.Free, game.FreeRows},
	} {
		file := d.files[entry.mode]
		if file == nil || len(entry.rows) == 0 {
			continue
		}
		counts := map[int]int{}
		for _, row := range entry.rows {
			weight, err := row[1].Float64()
			if err != nil || weight <= 0 || row[0].String() == "0" {
				continue
			}
			for id, count := range file.symbols[row[0].String()] {
				counts[id] += count
			}
		}
		missing := []string{}
		for _, symbol := range game.Board.Symbols {
			if symbol.Role != "normal" || symbol.Weight <= 0 {
				continue
			}
			paying := false
			for _, raw := range symbol.Payouts {
				value, _ := raw.Float64()
				paying = paying || value > 0
			}
			id, err := strconv.Atoi(symbol.ID)
			if err == nil && paying && counts[id] == 0 {
				missing = append(missing, symbol.ID)
			}
		}
		if len(missing) > 0 {
			return fmt.Errorf("library winning-symbol coverage mismatch for %s/%s: missing symbol IDs %s", game.ID, entry.mode, strings.Join(missing, ","))
		}
	}
	return nil
}
