#!/bin/bash
set -e

VERSION=$(node -p "require('./manifest.json').version")
OUT="puresitetabs-${VERSION}.zip"

zip -r "$OUT" \
    manifest.json \
    background.js \
    common.js \
    common.css \
    icons \
    popup \
    sidebar \
    settings \
    --exclude "*.DS_Store"

echo "Created $OUT"
