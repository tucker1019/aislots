package adminconfig

import (
	"encoding/json"
	"fmt"
)

// MergeGameCatalog adds missing catalog fields and entries without overwriting
// published operations settings, platform identity, or per-game launch addresses.
func MergeGameCatalog(published, defaults json.RawMessage) (json.RawMessage, error) {
	var current, seed map[string]json.RawMessage
	if err := json.Unmarshal(published, &current); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(defaults, &seed); err != nil {
		return nil, err
	}
	var entries, base map[string]map[string]json.RawMessage
	if err := json.Unmarshal(current["games"], &entries); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(seed["games"], &base); err != nil {
		return nil, err
	}
	if entries == nil || base == nil {
		return nil, fmt.Errorf("games object required")
	}
	for id, fields := range base {
		if _, exists := entries[id]; !exists {
			entries[id] = fields
			continue
		}
		for field, value := range fields {
			if _, exists := entries[id][field]; !exists {
				entries[id][field] = value
			}
		}
	}
	raw, err := json.Marshal(entries)
	if err != nil {
		return nil, err
	}
	current["games"] = raw
	out, err := json.Marshal(current)
	if err != nil {
		return nil, err
	}
	return out, ValidateDocument("games", out)
}
