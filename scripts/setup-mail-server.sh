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
cat >> /etc/postfix/main.cf << EOF

# DGT Mail Server Configuration
myhostname = $MAIL_DOMAIN
mydomain = $MAIL_DOMAIN
myorigin = \$mydomain
inet_interfaces = all
inet_protocols = all

# Local mail
mydestination = \$myhostname, localhost.\$mydomain, localhost
local_recipient_maps = unix:passwd.byname \$alias_maps
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases

# Mailbox format - Maildir
home_mailbox = Maildir/
mailbox_transport = lmtp:unix:private/dovecot-lmtp
virtual_mailbox_domains = $MAIL_DOMAIN
virtual_mailbox_base = $MAIL_HOME
virtual_mailbox_maps = regexp:/etc/postfix/virtual_mailboxes
virtual_uid_maps = static:$(id -u $MAIL_USER)
virtual_gid_maps = static:$(id -g $MAIL_USER)

# TLS
smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_use_tls = yes
smtpd_tls_session_cache_database = btree:\${data_directory}/smtpd_scache
smtp_tls_session_cache_database = btree:\${data_directory}/smtp_scache
smtpd_tls_security_level = may

# Rate limiting
default_process_limit = 100
smtpd_recipient_limit = 1000
EOF

echo "[3] Setting up virtual mailbox maps"
echo "$MAIL_DOMAIN/$MAIL_DOMAIN/" > /etc/postfix/virtual_mailboxes
postmap /etc/postfix/virtual_mailboxes

# 4. Configure Dovecot
echo "[4] Configuring Dovecot"
cat > /etc/dovecot/conf.d/99-dgt-custom.conf << EOF
# DGT Custom Configuration

protocols = imap pop3 lmtp

# Mail storage
mail_location = maildir:$MAILDIR_PATH/%u

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
ssl = required
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
systemctl restart postfix
systemctl restart dovecot

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
