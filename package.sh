#!/bin/bash
set -e

VERSION=$(node -p "require('./manifest.json').version")
OUT="puresidetabs-${VERSION}.zip"

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

if [[ "$*" == *"--deploy"* ]]; then
    unzip -o "$OUT" -d out
    echo "Deployed to out/"
fi
