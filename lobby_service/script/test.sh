#!/bin/sh
set -eu
go test ./...
result=$(mktemp)
trap 'rm -f "$result"' EXIT
go test ./pkg/... ./app/apis/lobby/api/internal/logic/... -coverprofile=coverage.out > "$result"
cat "$result"
awk '
/^ok/ && /coverage:/ {for(i=1;i<=NF;i++) if($i=="coverage:") {threshold=($2 ~ /^apps\/pkg\// ? 90 : 80);if($(i+1)+0<threshold)bad=1}}
END {exit bad}' "$result"
