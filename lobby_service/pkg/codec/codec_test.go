package codec

import (
	"bytes"
	"context"
	"testing"
)

func TestPassthrough(t *testing.T) {
	data := []byte(`{"uid":1}`)
	a, err := DecryptRequest(context.Background(), data)
	if err != nil || !bytes.Equal(a, data) {
		t.Fatal(err)
	}
	b, err := EncryptResponse(context.Background(), a)
	if err != nil || !bytes.Equal(b, data) {
		t.Fatal(err)
	}
}
