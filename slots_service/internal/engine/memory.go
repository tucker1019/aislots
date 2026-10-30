package engine

import "context"

// MemoryLibrary is useful for embedded deployments and deterministic tests; data is cloned on construction/read.
type MemoryLibrary struct{ data map[Mode]map[string][][]int }

func NewMemoryLibrary(data map[Mode]map[string][][]int) *MemoryLibrary {
	out := &MemoryLibrary{data: map[Mode]map[string][][]int{}}
	for mode, buckets := range data {
		out.data[mode] = map[string][][]int{}
		for key, rows := range buckets {
			for _, row := range rows {
				out.data[mode][key] = append(out.data[mode][key], append([]int(nil), row...))
			}
		}
	}
	return out
}
func (m *MemoryLibrary) Count(mode Mode, key string) int { return len(m.data[mode][key]) }
func (m *MemoryLibrary) Read(ctx context.Context, mode Mode, key string, index int) ([]int, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	rows := m.data[mode][key]
	if index < 0 || index >= len(rows) {
		return nil, ErrMissingSkeleton
	}
	return append([]int(nil), rows[index]...), nil
}
