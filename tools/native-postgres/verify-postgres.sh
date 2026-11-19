#!/usr/bin/env bash
# Historical schema proofs and CURRENT native acceptance have distinct sources.
set -euo pipefail
cd "$(dirname "$0")/../.."
export STOCK_NATIVE_ROOT=$PWD
native_history=$(mktemp -d "${TMPDIR:-/tmp}/stock-native-schema-history.XXXXXX")
trap 'rm -rf "$native_history"' EXIT
python3 tools/native-postgres/history-copy.py "$native_history"
cd "$native_history"
bash -c 'source tools/migration/verify-typed-postgres.sh; source "$STOCK_NATIVE_ROOT/tools/native-postgres/acceptance.sh"' "$native_history/tools/migration/verify-typed-postgres.sh"
