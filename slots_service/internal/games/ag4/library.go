package ag4

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"

	"aislots/slots_service/internal/rules/paylines"
)

type Library map[string][]Skeleton
type Manifest struct {
	Version              int               `json:"version"`
	Format               string            `json:"format"`
	GameID               string            `json:"gameId"`
	Mode                 string            `json:"mode"`
	ModuleVersion        string            `json:"moduleVersion"`
	SchemaVersion        int               `json:"schemaVersion"`
	ConfigHashes         map[string]string `json:"configHashes"`
	DataHash             string            `json:"dataHash"`
	Validated            bool              `json:"validated"`
	Required             int               `json:"required"`
	Covered              int               `json:"covered"`
	IgnoredZeroSkeletons int               `json:"ignoredZeroSkeletons"`
	Source               string            `json:"source"`
}

func hash(raw []byte) string { digest := sha256.Sum256(raw); return hex.EncodeToString(digest[:]) }
func (c Config) Hashes() map[string]string {
	out := map[string]string{}
	for name, raw := range c.Files {
		out[name] = hash(raw)
	}
	return out
}

// ValidateLibrary replays every positive skeleton independently of manifest
// claims. Historical zero buckets are deliberately never used as outcomes.
func ValidateLibrary(c Config, mode string, raw []byte) (Library, int, int, error) {
	var input Library
	if err := strict(raw, &input); err != nil {
		return nil, 0, 0, err
	}
	output := Library{}
	zero := 0
	for key, list := range input {
		multiplier, err := paylines.Rat(key)
		if err != nil {
			return nil, 0, 0, err
		}
		if multiplier.Sign() == 0 {
			zero += len(list)
			continue
		}
		if len(list) == 0 {
			return nil, 0, 0, fmt.Errorf("empty positive bucket %s", key)
		}
		canonical := multiplier.RatString()
		for _, s := range list {
			sequence, actual, err := Inspect(c.Rules, s, mode)
			if err == nil && mode == "base" {
				err = validateFillable(c.Rules, sequence.Boards[0])
			}
			if err != nil || actual != canonical {
				return nil, 0, 0, fmt.Errorf("invalid %s/%s skeleton: %v (actual %s)", mode, key, err, actual)
			}
		}
		output[canonical] = append(output[canonical], list...)
	}
	rows := c.Base
	if mode == "free" {
		rows = c.Respin
	}
	required := map[string]bool{}
	for _, row := range rows {
		m, _ := paylines.Rat(string(row[0]))
		w, _ := paylines.Rat(string(row[1]))
		if m.Sign() > 0 && w.Sign() > 0 {
			key := m.RatString()
			required[key] = true
			if len(output[key]) == 0 {
				return nil, 0, 0, fmt.Errorf("missing positive %s bucket %s", mode, key)
			}
		}
	}
	return output, len(required), zero, nil
}

func LoadLibrary(c Config, mode, dir string) (Library, Manifest, error) {
	var manifest Manifest
	raw, err := os.ReadFile(filepath.Join(dir, "library.json"))
	if err != nil {
		return nil, manifest, err
	}
	meta, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		return nil, manifest, err
	}
	if err = strict(meta, &manifest); err != nil {
		return nil, manifest, err
	}
	if manifest.Version != 1 || manifest.Format != "payline-skeleton-v1" || manifest.GameID != ID || manifest.Mode != mode || manifest.ModuleVersion != ModuleVersion || manifest.SchemaVersion != StateSchema || !manifest.Validated || manifest.DataHash != hash(raw) || !reflect.DeepEqual(manifest.ConfigHashes, c.Hashes()) {
		return nil, manifest, fmt.Errorf("unvalidated/mismatched AG4 release")
	}
	lib, required, zero, err := ValidateLibrary(c, mode, raw)
	if err != nil {
		return nil, manifest, err
	}
	if manifest.Required != required || manifest.Covered != required || manifest.IgnoredZeroSkeletons != zero {
		return nil, manifest, fmt.Errorf("AG4 manifest coverage mismatch")
	}
	return lib, manifest, nil
}

// Publish revalidates old candidates against today's tables. It creates one
// new self-contained immutable local release and never edits source manifests.
func Publish(configDir, baseDir, freeDir, destination string) error {
	if _, err := os.Stat(destination); !os.IsNotExist(err) {
		return fmt.Errorf("release destination exists or cannot be inspected")
	}
	c, err := LoadConfig(configDir)
	if err != nil {
		return err
	}
	type candidate struct {
		raw      []byte
		manifest Manifest
	}
	candidates := map[string]candidate{}
	for mode, dir := range map[string]string{"base": baseDir, "free": freeDir} {
		raw, err := os.ReadFile(filepath.Join(dir, "library.json"))
		if err != nil {
			return err
		}
		meta, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
		if err != nil {
			return err
		}
		var source struct {
			Version  int             `json:"version"`
			Format   string          `json:"format"`
			GameID   string          `json:"gameId"`
			Mode     string          `json:"mode"`
			DataHash string          `json:"dataHash"`
			Config   paylines.Config `json:"config"`
		}
		if err = json.Unmarshal(meta, &source); err != nil {
			return err
		}
		// Tables/revisions in a candidate may predate the latest math edits; the
		// independent replay below is mandatory rather than relabeling its version.
		if source.Version != 1 || source.Format != "payline-skeleton-v1" || source.GameID != ID || source.Mode != mode || source.DataHash != hash(raw) || !sameRules(source.Config, c.Rules) {
			return fmt.Errorf("invalid source candidate %s", mode)
		}
		_, required, zero, err := ValidateLibrary(c, mode, raw)
		if err != nil {
			return err
		}
		candidates[mode] = candidate{raw, Manifest{Version: 1, Format: "payline-skeleton-v1", GameID: ID, Mode: mode, ModuleVersion: ModuleVersion, SchemaVersion: StateSchema, ConfigHashes: c.Hashes(), DataHash: hash(raw), Validated: true, Required: required, Covered: required, IgnoredZeroSkeletons: zero, Source: filepath.Base(dir)}}
	}
	parent := filepath.Dir(destination)
	if err = os.MkdirAll(parent, 0755); err != nil {
		return err
	}
	temporary, err := os.MkdirTemp(parent, ".ag4-release-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(temporary)
	for name, raw := range c.Files {
		if err = os.WriteFile(filepath.Join(temporary, name), raw, 0644); err != nil {
			return err
		}
	}
	for mode, v := range candidates {
		dir := filepath.Join(temporary, mode+"-library")
		if err = os.Mkdir(dir, 0755); err != nil {
			return err
		}
		if err = os.WriteFile(filepath.Join(dir, "library.json"), v.raw, 0644); err != nil {
			return err
		}
		meta, _ := json.MarshalIndent(v.manifest, "", "  ")
		if err = os.WriteFile(filepath.Join(dir, "manifest.json"), append(meta, '\n'), 0644); err != nil {
			return err
		}
	}
	return os.Rename(temporary, destination)
}

func sameRules(a, b paylines.Config) bool {
	// Raw feature JSON can contain different whitespace in saved manifests.
	var af, bf Feature
	if strict(a.Feature, &af) != nil || strict(b.Feature, &bf) != nil {
		return false
	}
	a.Feature = nil
	b.Feature = nil
	return reflect.DeepEqual(a, b) && reflect.DeepEqual(af, bf)
}
