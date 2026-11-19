// Explicit maintenance for duplicate game storage. No changes without -apply.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"aislots/slots_service/internal/infrastructure/postgres"
)

func main() {
	action := flag.String("action", "compact-receipts", "compact-receipts, remove-orders or clear-experience-losses")
	uidFile := flag.String("experience-uids", "", "experience UID file exported from lobby (one UID per line)")
	app := flag.String("appname", "", "trusted platform appname for experience cleanup")
	key := flag.String("appkey", "", "trusted platform appkey for experience cleanup")
	backupDir := flag.String("backup-dir", "", "durable batch backup directory required for experience cleanup -apply")
	workers := flag.Int("workers", 1, "experience cleanup workers (1..4); disjoint physical windows")
	apply := flag.Bool("apply", false, "apply changes; default is read-only inspection")
	batchSize := flag.Int("batch-size", 1000, "batch target (1..10000): exact receipt limit for compaction, approximate row target for physical history windows")
	maxBatches := flag.Int("max-batches", 1, "maximum batches; 0 scans the entire history snapshot")
	flag.Parse()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if err := run(ctx, *action, *apply, *batchSize, *maxBatches, *uidFile, *app, *key, *backupDir, *workers); err != nil {
		// Driver errors can include connection details; do not print the DSN.
		fmt.Fprintln(os.Stderr, "storage maintenance failed:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, action string, apply bool, batchSize, maxBatches int, uidFile, app, key, backupDir string, workers int) error {
	if action != "compact-receipts" && action != "remove-orders" && action != "clear-experience-losses" {
		return fmt.Errorf("unknown action")
	}
	dsn := os.Getenv("AISLOTS_DATABASE_URL")
	if dsn == "" {
		return fmt.Errorf("AISLOTS_DATABASE_URL is required")
	}
	store, err := postgres.Open(ctx, dsn)
	if err != nil {
		return fmt.Errorf("cannot connect to game database")
	}
	defer store.Close()
	fmt.Printf("action=%s apply=%t\n", action, apply)
	if action == "clear-experience-losses" {
		raw, err := os.ReadFile(uidFile)
		if err != nil {
			return fmt.Errorf("cannot read experience UID file")
		}
		uids := strings.Fields(string(raw))
		return store.ClearExperienceLossReplaysConcurrent(ctx, app, key, uids, batchSize, maxBatches, workers, apply, backupDir, func(p postgres.LossCleanupProgress) {
			fmt.Printf("candidates=%d eligible=%d receipts=%d frames=%d spins=%d tickets=%d\n", p.Candidates, p.Eligible, p.Receipts, p.Frames, p.Spins, p.Tickets)
		})
	}
	if action == "remove-orders" {
		result, err := store.RemoveDuplicateOrders(ctx, apply)
		if err == nil {
			fmt.Printf("table_exists=%t table_bytes=%d removed=%t\n", result.Exists, result.Bytes, result.Removed)
		}
		return err
	}
	batch := 0
	return store.CompactReceiptHistory(ctx, batchSize, maxBatches, apply, func(p postgres.ReceiptCompactionProgress) {
		batch++
		fmt.Printf("batch=%d scanned=%d eligible=%d compacted=%d skipped=%d logical_json_before=%d logical_json_after=%d\n",
			batch, p.Scanned, p.Eligible, p.Compacted, p.Skipped, p.BeforeJSONBytes, p.AfterJSONBytes)
	})
}
