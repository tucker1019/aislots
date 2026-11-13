package legacyways

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"

	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/engine"
)

// Display is the existing Ways client's DTO, not a required runtime contract.
type Display struct {
	BottomSymbols    []int        `json:"bottomSymbols,omitempty"`
	SpinWinAmount    int64        `json:"spinWinAmount,omitempty"`
	AwardedFreeSpins int          `json:"awardedFreeSpins,omitempty"`
	CascadeFactors   []string     `json:"cascadeFactors,omitempty"`
	CascadeIndex     int          `json:"cascadeIndex"`
	PreviewRows      int          `json:"previewRows,omitempty"`
	Mode             engine.Mode  `json:"mode"`
	Board            engine.Board `json:"board"`
	Wins             []engine.Win `json:"wins"`
	RemovedIDs       []int        `json:"removedIds"`
	TransformedIDs   []int        `json:"transformedIds"`
	FreeRemaining    int          `json:"freeRemaining"`
	TriggeredFree    bool         `json:"triggeredFree"`
}

func (p Profile) BottomSymbols(gameID, betID string, spin int, free bool) []int {
	if p.Columns == 0 || p.BottomSymbolCount == 0 {
		return nil
	}
	result := make([]int, p.Columns)
	for c := range result {
		digest := sha256.Sum256([]byte(fmt.Sprintf("bottom:v1:%s:%s:%d:%d", gameID, betID, spin, c)))
		symbol := int(digest[0])%p.BottomSymbolCount + 1
		if free && c+1 == p.FreeBottomGoldColumn {
			symbol += 1000
		}
		result[c] = symbol
	}
	return result
}

func (r *Runtime) Present(out game.Result, ctx game.FrameContext) (json.RawMessage, error) {
	if ctx.FrameIndex < 0 || ctx.FrameIndex >= len(out.Frames) {
		return nil, fmt.Errorf("invalid presentation frame")
	}
	var data Display
	if err := json.Unmarshal(out.Frames[ctx.FrameIndex].Payload, &data); err != nil {
		return nil, err
	}
	var old engine.SpinResult
	if err := json.Unmarshal(out.Payload, &old); err != nil {
		return nil, err
	}
	displayPreview := len(old.Round.Previews) == len(out.Frames)
	for _, col := range data.Board {
		if len(col) > 4 && !r.profile.AllowTallPreview {
			displayPreview = false
		}
	}
	if displayPreview {
		previews := old.Round.Previews[ctx.FrameIndex]
		if len(previews) != len(data.Board) {
			return nil, fmt.Errorf("invalid preview columns")
		}
		display := make(engine.Board, len(data.Board))
		for c, col := range data.Board {
			display[c] = append([]engine.Cell{previews[c]}, col...)
		}
		data.Board = display
		data.PreviewRows = 1
	}
	data.BottomSymbols = r.profile.BottomSymbols(out.GameID, ctx.RoundID, ctx.SpinIndex, data.Mode == engine.Free)
	return json.Marshal(data)
}
