#!/bin/sh
set -eu
files=$(rg --files app pkg tools deploy -g '*.go' -g '!*.pb.go' -g '!*.gen.go' -g '!**/*_gen.go' -g '!**/mock_*.go')
printf '%s\n' "$files" | xargs go run golang.org/x/tools/cmd/goimports@v0.36.0 -w
printf '%s\n' "$files" | xargs go run mvdan.cc/gofumpt@v0.8.0 -w
