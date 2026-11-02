package codec

import "context"

// DecryptRequest is the future request decryption boundary; MVP is passthrough.
func DecryptRequest(_ context.Context, data []byte) ([]byte, error) { return data, nil }

// EncryptResponse is the future response encryption boundary; MVP is passthrough.
func EncryptResponse(_ context.Context, data []byte) ([]byte, error) { return data, nil }
