#!/bin/sh
# 用法：sh tests/run.sh [style|batch|full]   只印失敗摘要
cd "$(dirname "$0")/.." || exit 1
MODE=${1:-batch}; FAIL=0
node tests/static.js index.html || FAIL=1
node tests/snap.js index.html || FAIL=1
node tests/fuzz.js index.html || FAIL=1
case "$MODE" in
  style) python3 tests/e2e.py || FAIL=1 ;;
  full)  python3 tests/e2e.py --full || FAIL=1 ;;
  *)     python3 tests/e2e.py --wide || FAIL=1 ;;
esac
[ $FAIL = 0 ] && echo "ALL PASS ($MODE)" || { echo "FAILED ($MODE)"; exit 1; }
