export GOTOOLCHAIN := go1.25.0

.PHONY: build gen test lint format model mock run
source:
	python3 script/coin_sources.py
build: source
	PATH="$(HOME)/go/bin:$$PATH" protoc -I protos -I protos/third_party --go_out=. --go_opt=module=apps --descriptor_set_out=protos/descriptor.pb --include_imports apis/lobby/api/v1/user_api.proto apis/lobby/api/v1/recharge_api.proto apis/lobby/api/v1/checkin_api.proto apis/lobby/api/v1/return_api.proto apis/lobby/api/v1/vip_api.proto apis/lobby/api/v1/newbie_recharge_api.proto apis/lobby/api/errors/user_error.proto common/errors/error_prefix.proto
	go run ./tools/httpgen
gen: build
model:
	go run ./tools/modelgen
mock:
	go generate ./app/...
test:
	sh script/test.sh
lint:
	GOTOOLCHAIN=go1.25.0 go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.5.0 run
format:
	sh script/format.sh
run:
	go run ./app/apis/lobby/api
