package ag3

import "aislots/slots_service/internal/games/legacyways"

func New(source legacyways.Source) *legacyways.Runtime {
	return legacyways.New("AG3", source, Profile())
}
func Profile() legacyways.Profile {
	return legacyways.Profile{Columns: 6, BottomSymbolCount: 8, AllowTallPreview: true}
}
