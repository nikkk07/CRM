#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Keep the Render free-tier backend warm from the always-on Mac Mini.
#
# WHY: Render's free plan spins the web service DOWN after ~15 min with no
# inbound traffic. The next visitor then waits 30–60s for a cold boot — which is
# exactly the "site won't load, needs a hard refresh again and again" symptom.
# The in-process self_ping can't help: once Render stops the instance, its
# scheduler stops too. An EXTERNAL pinger is required. The Mac runs 24/7, so it
# is the ideal free pinger.
#
# This installs a launchd job that GETs /health every 10 minutes.
#
# Usage:  bash CRM/scripts/setup_keepwarm.sh
# Remove: launchctl unload ~/Library/LaunchAgents/com.weone.crm.keepwarm.plist
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-https://crm-weoneaviation.onrender.com}"
LABEL="com.weone.crm.keepwarm"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG="$HOME/Library/Logs/${LABEL}.log"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/curl</string>
        <string>-fsS</string>
        <string>--max-time</string>
        <string>60</string>
        <string>${BACKEND_URL}/health</string>
    </array>
    <key>StartInterval</key>
    <integer>600</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG}</string>
    <key>StandardErrorPath</key>
    <string>${LOG}</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "✅ Keep-warm installed: pinging ${BACKEND_URL}/health every 10 min."
echo "   Log: ${LOG}"
echo "   Test now: curl -fsS ${BACKEND_URL}/health"
