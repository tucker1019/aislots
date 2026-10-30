.PHONY: test race vet build run check
CONFIG ?= configs/server.example.json
test:
	go test ./...
race:
	go test -race ./...
vet:
	go vet ./...
build:
	go build -o bin/slots-server ./cmd/slots-server
run:
	go run ./cmd/slots-server -config $(CONFIG)
check: test race vet

.PHONY: db-up db-down integration
# Keep the named volume when stopping the local database.
db-up:
	docker compose up -d --wait
db-down:
	docker compose down
integration:
	@test -n "$$AISLOTS_TEST_DATABASE_URL" || (echo 'Set AISLOTS_TEST_DATABASE_URL to a local test database'; exit 1)
	go test -race -count=1 ./internal/infrastructure/postgres
