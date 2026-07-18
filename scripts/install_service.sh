#!/bin/zsh
# Installs the attendance system as a 24/7 background service (auto-starts on boot).
set -e
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SRC="$PROJECT/launchd/com.weone.attendance.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.weone.attendance.plist"

mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT/data/logs"
sed "s|__PROJECT__|$PROJECT|g" "$PLIST_SRC" > "$PLIST_DST"

launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo "✅ Service installed and started."
echo "   Dashboard:  http://localhost:8000  (or http://<this-mac-ip>:8000 from your phone)"
echo "   Logs:       $PROJECT/data/logs/"
echo ""
echo "To stop:    launchctl unload $PLIST_DST"
echo "To restart: launchctl unload $PLIST_DST && launchctl load $PLIST_DST"
echo ""
echo "⚠️  Also set the Mac to never sleep:"
echo "   System Settings → Energy → 'Prevent automatic sleeping when the display is off' = ON"
