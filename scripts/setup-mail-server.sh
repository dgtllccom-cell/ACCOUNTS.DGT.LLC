#!/bin/bash
# DGT Mail Server Setup - Postfix + Dovecot Configuration
# This script configures mail server for public @dgt.llc registrations
# Use staging domain (staging-mail.dgt.llc) until production DNS approval

set -e

MAIL_DOMAIN="${1:-staging-mail.dgt.llc}"
MAIL_USER="dgtmail"
MAIL_HOME="/var/mail/dgt"
MAILDIR_PATH="$MAIL_HOME/Maildir"

echo "================================"
echo "DGT Mail Server Setup"
echo "Domain: $MAIL_DOMAIN"
echo "================================"

# 1. Create mail user
if ! id "$MAIL_USER" &>/dev/null; then
  echo "[1] Creating mail user: $MAIL_USER"
  useradd -r -s /usr/sbin/nologin -d "$MAIL_HOME" "$MAIL_USER"
  mkdir -p "$MAIL_HOME"
  chown "$MAIL_USER:$MAIL_USER" "$MAIL_HOME"
  chmod 700 "$MAIL_HOME"
else
  echo "[1] Mail user $MAIL_USER already exists"
fi

# 2. Configure Postfix main.cf
echo "[2] Configuring Postfix"
postconf -e "virtual_mailbox_domains = $MAIL_DOMAIN"
postconf -e "virtual_mailbox_base = $MAIL_HOME"
postconf -e "virtual_mailbox_maps = regexp:/etc/postfix/virtual_mailboxes"
postconf -e "virtual_uid_maps = static:$(id -u $MAIL_USER)"
postconf -e "virtual_gid_maps = static:$(id -g $MAIL_USER)"
postconf -e "mailbox_transport = lmtp:unix:private/dovecot-lmtp"
postconf -e "smtpd_tls_security_level = may"

echo "[3] Setting up virtual mailbox maps"
printf "^.*@%s$ %s\n" "$MAIL_DOMAIN" "$MAILDIR_PATH/%u" > /etc/postfix/virtual_mailboxes
postmap /etc/postfix/virtual_mailboxes 2>/dev/null || true

# 4. Configure Dovecot
echo "[4] Configuring Dovecot"
mkdir -p /etc/dovecot/conf.d

# Configure core settings
cat > /etc/dovecot/conf.d/99-dgt-custom.conf << EOF
# DGT Custom Configuration
protocols = imap pop3 lmtp
mail_location = maildir:$MAILDIR_PATH/%u
disable_plaintext_auth = no
auth_mechanisms = plain

# LMTP for Postfix
service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    group = postfix
    mode = 0660
  }
}

# Authentication
userdb {
  driver = static
  args = uid=$MAIL_USER gid=$MAIL_USER home=$MAIL_HOME/%u
}

passdb {
  driver = pam
}

# TLS
ssl = yes
ssl_cert = </etc/ssl/certs/ssl-cert-snakeoil.pem
ssl_key = </etc/ssl/private/ssl-cert-snakeoil.key

# IMAP
protocol imap {
  mail_max_userip_connections = 10
}

# POP3
protocol pop3 {
  pop3_uidl_format = %08Xu%d
}
EOF

# 5. Create mailbox directory structure
echo "[5] Creating mailbox storage"
mkdir -p "$MAILDIR_PATH"
chown -R "$MAIL_USER:$MAIL_USER" "$MAILDIR_PATH"
chmod 700 "$MAILDIR_PATH"

# 6. Restart services
echo "[6] Restarting mail services"
systemctl restart postfix || { echo "Postfix restart failed"; systemctl status postfix; }
systemctl restart dovecot || { echo "Dovecot restart failed"; systemctl status dovecot; }

# 7. Verify
echo "[7] Verification"
echo "  Postfix: $(systemctl is-active postfix)"
echo "  Dovecot: $(systemctl is-active dovecot)"
echo "  Mail user: $(id $MAIL_USER)"
echo "  Mail directory: $(ls -ld $MAILDIR_PATH)"

echo ""
echo "================================"
echo "Mail server ready for staging"
echo "Domain: $MAIL_DOMAIN"
echo "Maildir: $MAILDIR_PATH"
echo "================================"
