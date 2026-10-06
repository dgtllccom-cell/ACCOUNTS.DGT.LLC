#!/usr/bin/env bash
# ==============================================================================
# Stalwart Mail Server Installation & Setup Script for DGT.LLC
# Host: 72.60.209.121
# Domain: dgt.llc
# ==============================================================================
set -euo pipefail

echo ">>> [1/6] Preparing environment and directories..."
mkdir -p /etc/stalwart-mail
mkdir -p /var/lib/stalwart-mail/data
mkdir -p /var/lib/stalwart-mail/blobs
mkdir -p /var/log/stalwart-mail

echo ">>> [2/6] Downloading Stalwart Mail Server binary..."
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    DOWNLOAD_URL="https://github.com/stalwartlabs/mail-server/releases/latest/download/stalwart-mail-x86_64-unknown-linux-gnu.tar.gz"
else
    DOWNLOAD_URL="https://github.com/stalwartlabs/mail-server/releases/latest/download/stalwart-mail-aarch64-unknown-linux-gnu.tar.gz"
fi

TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"
curl -fsSL "$DOWNLOAD_URL" -o stalwart-mail.tar.gz
tar -xzf stalwart-mail.tar.gz
mv stalwart-mail /usr/local/bin/stalwart-mail
chmod +x /usr/local/bin/stalwart-mail
cd /
rm -rf "$TMP_DIR"

echo ">>> [3/6] Installing Stalwart systemd service..."
cat << 'EOF' > /etc/systemd/system/stalwart-mail.service
[Unit]
Description=Stalwart Mail Server
After=network.target network-online.target systemd-networkd.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/lib/stalwart-mail
ExecStart=/usr/local/bin/stalwart-mail -c /etc/stalwart-mail/config.toml
Restart=on-failure
RestartSec=5s
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

echo ">>> [4/6] Configuring UFW Firewall for Mail Protocols..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow 25/tcp comment "SMTP incoming" || true
    ufw allow 465/tcp comment "SMTPS secure" || true
    ufw allow 587/tcp comment "SMTP submission" || true
    ufw allow 993/tcp comment "IMAPS secure" || true
    ufw status || true
fi

echo ">>> [5/6] Checking Stalwart binary version..."
/usr/local/bin/stalwart-mail --version || true

echo ">>> [6/6] Installation completed successfully."
