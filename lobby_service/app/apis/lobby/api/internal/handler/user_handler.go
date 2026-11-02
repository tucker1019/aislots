package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"apps/pkg/codec"
	"apps/pkg/xerr"
	"apps/pkg/xlog"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// API binds a generated protobuf request and dispatches to its business logic.
func API[Req proto.Message, Reply proto.Message](newRequest func() Req, action func(context.Context, Req) (Reply, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := newRequest()
		if err := decode(w, r, req); err != nil {
			fail(w, r, xerr.ErrInvalid)
			return
		}
		data, err := action(r.Context(), req)
		if err != nil {
			fail(w, r, err)
			return
		}
		respond(w, r, 200, map[string]any{"code": "OK", "data": messageJSON(data.ProtoReflect())})
	}
}

func decode(w http.ResponseWriter, r *http.Request, req proto.Message) error {
	data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 16384))
	if err != nil {
		return err
	}
	data, err = codec.DecryptRequest(r.Context(), data)
	if err != nil {
		return err
	}
	fields := map[string]json.RawMessage{}
	if len(data) > 0 {
		if err = json.Unmarshal(data, &fields); err != nil {
			return err
		}
		if fields == nil {
			return xerr.ErrInvalid
		}
	}
	descriptor := req.ProtoReflect().Descriptor().Fields()
	for i := 0; i < descriptor.Len(); i++ {
		f := descriptor.Get(i)
		name := string(f.Name())
		if name == f.JSONName() {
			continue
		}
		if v, ok := fields[f.JSONName()]; ok {
			if _, duplicate := fields[name]; duplicate {
				return xerr.ErrInvalid
			}
			fields[name] = v
			delete(fields, f.JSONName())
		}
	}
	data, err = json.Marshal(fields)
	if err != nil {
		return err
	}
	if err = json.Unmarshal(data, req); err != nil {
		return err
	}
	return bindIdentity(r, req.ProtoReflect())
}

func bindIdentity(r *http.Request, m protoreflect.Message) error {
	for _, key := range []string{"uid", "sid", "orderId", "status", "limit", "cursor"} {
		values, ok := r.URL.Query()[key]
		if !ok {
			continue
		}
		if len(values) != 1 {
			return xerr.ErrInvalid
		}
		field := m.Descriptor().Fields().ByJSONName(key)
		if field == nil {
			return xerr.ErrInvalid
		}
		value := protoreflect.ValueOfString(values[0])
		if key == "limit" {
			n, err := strconv.ParseInt(values[0], 10, 32)
			if err != nil {
				return xerr.ErrInvalid
			}
			value = protoreflect.ValueOfInt32(int32(n))
		}
		if key == "uid" {
			uid, err := strconv.ParseInt(values[0], 10, 64)
			if err != nil {
				return xerr.ErrInvalid
			}
			value = protoreflect.ValueOfInt64(uid)
		}
		if m.Has(field) && m.Get(field).Interface() != value.Interface() {
			return xerr.ErrInvalid
		}
		m.Set(field, value)
	}
	return nil
}

// Preserve numeric int64 JSON values and use proto json_name consistently.
func messageJSON(message protoreflect.Message) map[string]any {
	out := map[string]any{}
	fields := message.Descriptor().Fields()
	for i := 0; i < fields.Len(); i++ {
		f := fields.Get(i)
		v := message.Get(f)
		if f.IsList() {
			items := []any{}
			list := v.List()
			for j := 0; j < list.Len(); j++ {
				items = append(items, scalarJSON(f, list.Get(j)))
			}
			out[f.JSONName()] = items
		} else {
			out[f.JSONName()] = scalarJSON(f, v)
		}
	}
	return out
}

func scalarJSON(f protoreflect.FieldDescriptor, v protoreflect.Value) any {
	if f.Kind() == protoreflect.MessageKind {
		return messageJSON(v.Message())
	}
	return v.Interface()
}

func fail(w http.ResponseWriter, r *http.Request, err error) {
	public := xerr.Public(err)
	if public.Status >= 500 {
		xlog.Error(r.Context(), "lobby request failed", "path", r.URL.Path, "error", err)
	}
	respond(w, r, public.Status, map[string]any{"code": public.Code.Number(), "message": public.Message})
}

func respond(w http.ResponseWriter, r *http.Request, status int, value any) {
	data, err := json.Marshal(value)
	if err == nil {
		data, err = codec.EncryptResponse(r.Context(), data)
	}
	if err != nil {
		http.Error(w, "response encoding failed", 500)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write(data)
}
func Health(w http.ResponseWriter, r *http.Request) { respond(w, r, 200, map[string]any{"code": "OK"}) }
