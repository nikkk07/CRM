#!/bin/bash
set -e

USER=$(whoami)
WORKDIR=$(pwd | sed 's/scripts$//')

cat > ~/Library/LaunchAgents/com.weone.crm.backend.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.weone.crm.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/python3</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>main:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>8000</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${WORKDIR}backend</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>DATABASE_URL</key>
        <string>postgresql://localhost/crm_we_one</string>
        <key>SECRET_KEY</key>
        <string>CHANGE_THIS_IN_PRODUCTION</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/crm-backend.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/crm-backend-error.log</string>
</dict>
</plist>
EOF

cat > ~/Library/LaunchAgents/com.weone.crm.caddy.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.weone.crm.caddy</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/caddy</string>
        <string>run</string>
        <string>--config</string>
        <string>${WORKDIR}Caddyfile</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${WORKDIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/caddy.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/caddy-error.log</string>
</dict>
</plist>
EOF

echo "Loading launchd services..."
launchctl load ~/Library/LaunchAgents/com.weone.crm.backend.plist
launchctl load ~/Library/LaunchAgents/com.weone.crm.caddy.plist

echo "Services installed and started!"
echo "Backend: http://localhost:8000"
echo "Frontend: https://crm.local:8443"
