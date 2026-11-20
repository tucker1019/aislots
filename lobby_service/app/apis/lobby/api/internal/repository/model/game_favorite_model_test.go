package model

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestFavoritesPersistIdempotentlyAndStayPrivate(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	users := &UserModel{DB: db}
	uid, err := users.Create(ctx, "", "", "favorite-one", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	other, err := users.Create(ctx, "", "", "favorite-two", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	m := &GameFavoriteModel{DB: db}
	var wg sync.WaitGroup
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if e := m.Set(ctx, uid, "AG2", true); e != nil {
				t.Error(e)
			}
		}()
	}
	wg.Wait()
	restored := &GameFavoriteModel{DB: db}
	ids, err := restored.List(ctx, uid)
	if err != nil || len(ids) != 1 || ids[0] != "AG2" {
		t.Fatal(ids, err)
	}
	ids, err = restored.List(ctx, other)
	if err != nil || len(ids) != 0 {
		t.Fatal("cross-user favorites", ids, err)
	}
	if err = m.Set(ctx, other, "AG2", false); err != nil {
		t.Fatal(err)
	}
	ids, err = m.List(ctx, uid)
	if err != nil || len(ids) != 1 {
		t.Fatal("other user deleted favorite", ids, err)
	}
	for i := 0; i < 2; i++ {
		if err = m.Set(ctx, uid, "AG2", false); err != nil {
			t.Fatal(err)
		}
	}
	ids, err = restored.List(ctx, uid)
	if err != nil || len(ids) != 0 {
		t.Fatal(ids, err)
	}
}
