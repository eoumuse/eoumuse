#!/bin/bash
# SlinkGate インストーラー (Mac用)
# ターミナルで実行: bash install_mac.sh

DEST="$HOME/Music/Ableton/User Library/Presets/Audio Effects/Max Audio Effect/SlinkGate"

echo "SlinkGate をインストール中..."
mkdir -p "$DEST"
cp SlinkGate.amxd "$DEST/"
cp slinkgate.js "$DEST/"
echo ""
echo "✓ インストール完了！"
echo ""
echo "Ableton Live を開いて："
echo "  ブラウザ → User Library → Presets → Audio Effects"
echo "  → Max Audio Effect → SlinkGate → SlinkGate.amxd"
echo "  をドラッグ＆ドロップするだけ！"
