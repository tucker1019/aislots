package ag1

import "aislots/slots_service/internal/games/legacyways"

func New(source legacyways.Source) *legacyways.Runtime {
	return legacyways.New("AG1", source, Profile())
}
func Profile() legacyways.Profile {
	return legacyways.Profile{Columns: 5, BottomSymbolCount: 9, FreeBottomGoldColumn: 3}
}
