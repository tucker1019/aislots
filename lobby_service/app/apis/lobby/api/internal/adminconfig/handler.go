package adminconfig

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"unicode/utf8"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/admin/config/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"gorm.io/gorm"
)

type service struct {
	db    *gorm.DB
	actor func(*http.Request) string
}
type sectionState struct {
	Section
	PublishedVersion int64 `json:"publishedVersion"`
	DraftVersion     int64 `json:"draftVersion"`
	HasDraft         bool  `json:"hasDraft"`
}
type detail struct {
	Key              string                     `json:"key"`
	Label            string                     `json:"label"`
	Published        json.RawMessage            `json:"published"`
	Draft            json.RawMessage            `json:"draft"`
	PublishedVersion int64                      `json:"publishedVersion"`
	DraftVersion     int64                      `json:"draftVersion"`
	History          []model.AdminConfigVersion `json:"history"`
}

func respond(w http.ResponseWriter, status int, data any, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if status >= 400 {
		_ = json.NewEncoder(w).Encode(map[string]string{"code": code, "message": message})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"code": "OK", "data": data})
}
func failure(w http.ResponseWriter, e error) {
	if errors.Is(e, model.ErrAdminConfigConflict) {
		respond(w, 409, nil, "CONFIG_CONFLICT", "配置已被修改，请刷新后重试")
		return
	}
	if errors.Is(e, gorm.ErrRecordNotFound) {
		respond(w, 404, nil, "CONFIG_NOT_FOUND", "配置或历史版本不存在")
		return
	}
	respond(w, 500, nil, "CONFIG_UNAVAILABLE", "配置服务暂不可用，请重试")
}
func invalid(w http.ResponseWriter, e error) { respond(w, 400, nil, "CONFIG_INVALID", e.Error()) }
func decode(w http.ResponseWriter, r *http.Request, m proto.Message) bool {
	b, e := io.ReadAll(http.MaxBytesReader(w, r.Body, 600*1024))
	if e != nil {
		invalid(w, fmt.Errorf("请求过大"))
		return false
	}
	if e = protojson.Unmarshal(b, m); e != nil {
		invalid(w, fmt.Errorf("请求格式错误"))
		return false
	}
	return true
}
func meta(key string) (Section, bool) {
	for _, s := range Sections {
		if s.Key == key {
			return s, true
		}
	}
	return Section{}, false
}
func (s service) readDetail(r *http.Request, key string) (detail, error) {
	m, ok := meta(key)
	if !ok {
		return detail{}, gorm.ErrRecordNotFound
	}
	store := model.AdminConfigStore{DB: s.db}
	row, e := store.Get(r.Context(), key, false)
	if e != nil {
		return detail{}, e
	}
	history, e := store.History(r.Context(), key)
	return detail{Key: key, Label: m.Label, Published: row.Published, Draft: row.Draft, PublishedVersion: row.PublishedVersion, DraftVersion: row.DraftVersion, History: history}, e
}
func (s service) list(w http.ResponseWriter, r *http.Request) {
	rows, e := (model.AdminConfigStore{DB: s.db}).List(r.Context())
	if e != nil {
		failure(w, e)
		return
	}
	byKey := map[string]model.AdminConfigRow{}
	for _, row := range rows {
		byKey[row.Section] = row
	}
	items := []sectionState{}
	for _, m := range Sections {
		row, ok := byKey[m.Key]
		if !ok {
			continue
		}
		items = append(items, sectionState{m, row.PublishedVersion, row.DraftVersion, row.DraftVersion > 0})
	}
	respond(w, 200, map[string]any{"items": items}, "", "")
}
func (s service) get(w http.ResponseWriter, r *http.Request) {
	v, e := s.readDetail(r, r.PathValue("key"))
	if e != nil {
		failure(w, e)
		return
	}
	respond(w, 200, v, "", "")
}
func (s service) check(r *http.Request, key string, doc []byte) error {
	if e := ValidateDocument(key, doc); e != nil {
		return e
	}
	row, e := (model.AdminConfigStore{DB: s.db}).Get(r.Context(), key, false)
	if e != nil {
		return e
	}
	var old config.Config
	if e = applyDocument(&old, key, row.Published); e != nil {
		return e
	}
	return checkImmutable(old, key, doc)
}
func reasonValid(reason string) bool {
	n := utf8.RuneCountInString(strings.TrimSpace(reason))
	return n >= 2 && n <= 500
}
func (s service) draft(w http.ResponseWriter, r *http.Request) {
	var req pb.ConfigDraft
	if !decode(w, r, &req) {
		return
	}
	key := r.PathValue("key")
	if req.Document == nil || !reasonValid(req.Reason) || req.ExpectedVersion < 1 {
		invalid(w, fmt.Errorf("请填写配置和2至500字修改原因"))
		return
	}
	doc, e := protojson.Marshal(req.Document)
	if e != nil {
		invalid(w, e)
		return
	}
	if e = s.check(r, key, doc); e != nil {
		invalid(w, e)
		return
	}
	if e = (model.AdminConfigStore{DB: s.db}).Draft(r.Context(), key, req.ExpectedVersion, doc, s.actor(r), strings.TrimSpace(req.Reason)); e != nil {
		failure(w, e)
		return
	}
	s.get(w, r)
}
func (s service) validate(w http.ResponseWriter, r *http.Request) {
	var req pb.ConfigValidate
	if !decode(w, r, &req) {
		return
	}
	if req.Document == nil {
		invalid(w, fmt.Errorf("缺少配置文档"))
		return
	}
	doc, e := protojson.Marshal(req.Document)
	if e != nil {
		invalid(w, e)
		return
	}
	if e = s.check(r, r.PathValue("key"), doc); e != nil {
		invalid(w, e)
		return
	}
	respond(w, 200, map[string]bool{"valid": true}, "", "")
}
func (s service) publish(w http.ResponseWriter, r *http.Request) {
	var req pb.ConfigPublish
	if !decode(w, r, &req) {
		return
	}
	s.release(w, r, req.ExpectedVersion, 0, req.RequestId, req.Reason)
}
func (s service) rollback(w http.ResponseWriter, r *http.Request) {
	var req pb.ConfigRollback
	if !decode(w, r, &req) {
		return
	}
	if req.Version < 1 {
		invalid(w, fmt.Errorf("请选择有效历史版本"))
		return
	}
	s.release(w, r, req.ExpectedVersion, req.Version, req.RequestId, req.Reason)
}
func (s service) release(w http.ResponseWriter, r *http.Request, expected, target int64, request, reason string) {
	key := r.PathValue("key")
	if !known(key) {
		failure(w, gorm.ErrRecordNotFound)
		return
	}
	if expected < 1 || len(request) < 8 || len(request) > 128 || !reasonValid(reason) {
		invalid(w, fmt.Errorf("请填写发布原因并刷新配置版本后重试"))
		return
	}
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s:%d:%d:%s", key, expected, target, reason)))
	var validation error
	e := (model.AdminConfigStore{DB: s.db}).Publish(r.Context(), key, expected, target, request, hex.EncodeToString(sum[:]), s.actor(r), strings.TrimSpace(reason), func(row model.AdminConfigRow, doc json.RawMessage, version int64) (json.RawMessage, error) {
		var old config.Config
		if er := applyDocument(&old, key, row.Published); er != nil {
			return nil, er
		}
		if er := checkImmutable(old, key, doc); er != nil {
			validation = er
			return nil, er
		}
		next, er := publishDocument(key, version, doc)
		if er != nil {
			return nil, er
		}
		if er = ValidateDocument(key, next); er != nil {
			validation = er
			return nil, er
		}
		return next, nil
	})
	if e != nil {
		if validation != nil {
			invalid(w, validation)
		} else {
			failure(w, e)
		}
		return
	}
	s.get(w, r)
}
