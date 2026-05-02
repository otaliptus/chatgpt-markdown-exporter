#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(node -e "console.log(require('$ROOT_DIR/manifest.json').version)")"
ZIP_NAME="chatgpt-exporter-v$VERSION.zip"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cd "$ROOT_DIR"
zip -r "$DIST_DIR/$ZIP_NAME" \
  manifest.json \
  content.js \
  popup.html \
  popup.css \
  popup.js \
  icons \
  README.md \
  PRIVACY.md \
  LICENSE \
  -x "*.DS_Store"

echo "$DIST_DIR/$ZIP_NAME"
