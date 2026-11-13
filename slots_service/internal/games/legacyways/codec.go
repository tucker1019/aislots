package legacyways

import (
	"bytes"
	"encoding/json"
)

func decodeStoredJSON(raw []byte, out any) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	return d.Decode(out)
}
