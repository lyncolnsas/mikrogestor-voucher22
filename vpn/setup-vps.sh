#!/usr/bin/env bash
# ==============================================================================
#  MIKROGESTOR — INSTALADOR AUTOMÁTICO WIREGUARD VPN (VPS / COOLIFY / RASPBERRY PI)
#  Instala e configura WireGuard + daemon de gerenciamento HTTP em 1 único comando.
#  Compatibilidade: Ubuntu 20.04+, Debian 11+, Raspberry Pi OS (ARM64 / ARMv7)
#  Uso: sudo bash setup-vps.sh
# ==============================================================================

set -euo pipefail

# ─── Cores e Formatação ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${CYAN}[VPN-SETUP]${NC} $1"; }
success() { echo -e "${GREEN}${BOLD}[✓ OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[AVISO]${NC} $1"; }
error()   { echo -e "${RED}${BOLD}[ERRO]${NC} $1"; exit 1; }

# ─── Verificação de Privilégios ───────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    error "Este script precisa ser executado como root. Use: sudo bash $0"
fi

# ─── Variáveis Globais ────────────────────────────────────────────────────────
WG_DIR="/etc/wireguard"
WG_INTERFACE="wg0"
WG_PORT=51820
VPN_SUBNET="10.8.0.0/24"
VPN_SERVER_IP="10.8.0.1"
WG_MANAGER_PORT=51821
WG_MANAGER_DIR="/opt/mikrogestor-wg-manager"
WG_MANAGER_SECRET_FILE="/etc/mikrogestor-wg.secret"

echo -e "${CYAN}${BOLD}"
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║       MIKROGESTOR — INSTALADOR AUTOMATIZADO WIREGUARD VPN & COOLIFY       ║"
echo "║       Suporte: Linux VPS (x86_64) | Raspberry Pi (ARM64/ARMv7) | Docker   ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── 1. Instalação de Dependências ────────────────────────────────────────────
log "Passo 1/7: Instalando pacotes necessários..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

# Instalação com suporte a Debian, Ubuntu e Raspberry Pi OS
apt-get install -y --no-install-recommends \
    wireguard \
    wireguard-tools \
    python3 \
    openssl \
    curl \
    iproute2 \
    iptables \
    ufw \
    ca-certificates

success "Dependências do WireGuard e do sistema instaladas com sucesso."

# ─── 2. Habilitação de IP Forwarding ──────────────────────────────────────────
log "Passo 2/7: Habilitando encaminhamento de pacotes IPv4 (Kernel IP Forwarding)..."
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-mikrogestor-vpn.conf
sysctl -p /etc/sysctl.d/99-mikrogestor-vpn.conf >/dev/null 2>&1 || true
success "IP Forwarding ativado no Kernel."

# ─── 3. Chaves Criptográficas Curve25519 ──────────────────────────────────────
log "Passo 3/7: Gerando chaves criptográficas WireGuard do Servidor..."
mkdir -p "$WG_DIR"
chmod 700 "$WG_DIR"

if [[ -f "$WG_DIR/private.key" && -f "$WG_DIR/public.key" ]]; then
    warn "Chaves WireGuard existentes detectadas. Mantendo par atual."
else
    wg genkey | tee "$WG_DIR/private.key" | wg pubkey > "$WG_DIR/public.key"
    chmod 600 "$WG_DIR/private.key"
fi

VPS_PRIVATE_KEY=$(cat "$WG_DIR/private.key")
VPS_PUBLIC_KEY=$(cat "$WG_DIR/public.key")
success "Par de chaves do servidor validado."

# ─── 4. Configuração da Interface wg0 ─────────────────────────────────────────
log "Passo 4/8: Criando /etc/wireguard/wg0.conf..."

cat > "$WG_DIR/$WG_INTERFACE.conf" <<EOF
[Interface]
Address = ${VPN_SERVER_IP}/24
ListenPort = ${WG_PORT}
PrivateKey = ${VPS_PRIVATE_KEY}

# Regras de roteamento e permissão de tráfego de controle VPN (com MASQUERADE para Docker e clientes com Full Tunnel)
PostUp   = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o %i -j MASQUERADE; iptables -t nat -A POSTROUTING -s 10.8.0.0/24 ! -o %i -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o %i -j MASQUERADE; iptables -t nat -D POSTROUTING -s 10.8.0.0/24 ! -o %i -j MASQUERADE
EOF

chmod 600 "$WG_DIR/$WG_INTERFACE.conf"

# Reiniciar / Ativar interface WireGuard
systemctl enable wg-quick@$WG_INTERFACE >/dev/null 2>&1 || true
wg-quick down $WG_INTERFACE >/dev/null 2>&1 || true
wg-quick up $WG_INTERFACE
success "Interface WireGuard ${WG_INTERFACE} ativa em ${VPN_SERVER_IP}/24 (porta UDP ${WG_PORT})."

# ─── 5. Diretório de Persistência SQLite (Coolify/Docker) ──────────────────────
log "Passo 5/8: Criando diretório de persistência do banco de dados no host..."
mkdir -p /data/mikrogestor/prisma
chmod -R 777 /data/mikrogestor/prisma
success "Diretório /data/mikrogestor/prisma configurado (garante que o SQLite não seja perdido em redeploys)."

# ─── 6. Instalação do Daemon WireGuard Manager (Python) ───────────────────────
log "Passo 6/8: Instalando WireGuard Manager Daemon em ${WG_MANAGER_DIR}..."

mkdir -p "$WG_MANAGER_DIR"

# Token de autenticação HMAC/Header
if [[ ! -f "$WG_MANAGER_SECRET_FILE" ]]; then
    openssl rand -hex 32 > "$WG_MANAGER_SECRET_FILE"
    chmod 600 "$WG_MANAGER_SECRET_FILE"
fi
WG_MANAGER_SECRET=$(cat "$WG_MANAGER_SECRET_FILE")

# Escrever wg-manager.py via base64 para eliminar 100% dos erros de escape em bash
cat << 'EOF' | base64 -d > "$WG_MANAGER_DIR/wg-manager.py"
IyEvdXNyL2Jpbi9lbnYgcHl0aG9uMwppbXBvcnQgaHR0cC5zZXJ2ZXIsIGpzb24sIHN1YnByb2Nlc3MsIG9zLCBzeXMsIGxvZ2dpbmcsIGhtYWMsIGJhc2U2NCwgdXJsbGliLnBhcnNlCgpsb2dnaW5nLmJhc2ljQ29uZmlnKGxldmVsPWxvZ2dpbmcuSU5GTywgZm9ybWF0PSclKGFzY3RpbWUpcyBbV0ctTUdSXSAlKGxldmVsbmFtZSlzICUobWVzc2FnZSlzJykKbG9nID0gbG9nZ2luZy5nZXRMb2dnZXIoX19uYW1lX18pCgpXR19JTlRFUkZBQ0UgPSBvcy5lbnZpcm9uLmdldCgnV0dfSU5URVJGQUNFJywgJ3dnMCcpCkJJTkRfSE9TVCAgICA9ICcwLjAuMC4wJwpCSU5EX1BPUlQgICAgPSBpbnQob3MuZW52aXJvbi5nZXQoJ1dHX01BTkFHRVJfUE9SVCcsICc1MTgyMScpKQpTRUNSRVRfRklMRSAgPSAnL2V0Yy9taWtyb2dlc3Rvci13Zy5zZWNyZXQnCgpkZWYgbG9hZF9zZWNyZXQoKToKICAgIHRyeToKICAgICAgICB3aXRoIG9wZW4oU0VDUkVUX0ZJTEUpIGFzIGY6CiAgICAgICAgICAgIHJldHVybiBmLnJlYWQoKS5zdHJpcCgpCiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6CiAgICAgICAgbG9nLmVycm9yKGYnQ2Fubm90IHJlYWQgc2VjcmV0OiB7ZX0nKQogICAgICAgIHN5cy5leGl0KDEpCgpTRUNSRVQgPSBsb2FkX3NlY3JldCgpCgpkZWYgcnVuKGNtZCk6CiAgICByZXN1bHQgPSBzdWJwcm9jZXNzLnJ1bihjbWQsIHNoZWxsPVRydWUsIGNhcHR1cmVfb3V0cHV0PVRydWUsIHRleHQ9VHJ1ZSkKICAgIHJldHVybiByZXN1bHQuc3Rkb3V0LnN0cmlwKCksIHJlc3VsdC5zdGRlcnIuc3RyaXAoKSwgcmVzdWx0LnJldHVybmNvZGUKCmRlZiB2ZXJpZnlfc2VjcmV0KGhlYWRlcnMpOgogICAgYXV0aCA9IGhlYWRlcnMuZ2V0KCdYLVdHLVNlY3JldCcsICcnKQogICAgcmV0dXJuIGhtYWMuY29tcGFyZV9kaWdlc3QoYXV0aCwgU0VDUkVUKQoKY2xhc3MgV0dIYW5kbGVyKGh0dHAuc2VydmVyLkJhc2VIVFRQUmVxdWVzdEhhbmRsZXIpOgogICAgZGVmIGxvZ19tZXNzYWdlKHNlbGYsIGZvcm1hdCwgKmFyZ3MpOgogICAgICAgIGxvZy5pbmZvKGYne3NlbGYuY2xpZW50X2FkZHJlc3NbMF19IC0ge2Zvcm1hdCAlIGFyZ3N9JykKCiAgICBkZWYgc2VuZF9qc29uKHNlbGYsIGNvZGUsIGRhdGEpOgogICAgICAgIGJvZHkgPSBqc29uLmR1bXBzKGRhdGEpLmVuY29kZSgpCiAgICAgICAgc2VsZi5zZW5kX3Jlc3BvbnNlKGNvZGUpCiAgICAgICAgc2VsZi5zZW5kX2hlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKQogICAgICAgIHNlbGYuc2VuZF9oZWFkZXIoJ0NvbnRlbnQtTGVuZ3RoJywgbGVuKGJvZHkpKQogICAgICAgIHNlbGYuZW5kX2hlYWRlcnMoKQogICAgICAgIHNlbGYud2ZpbGUud3JpdGUoYm9keSkKCiAgICBkZWYgcmVhZF9ib2R5KHNlbGYpOgogICAgICAgIGxlbmd0aCA9IGludChzZWxmLmhlYWRlcnMuZ2V0KCdDb250ZW50LUxlbmd0aCcsIDApKQogICAgICAgIHJldHVybiBqc29uLmxvYWRzKHNlbGYucmZpbGUucmVhZChsZW5ndGgpKSBpZiBsZW5ndGggZWxzZSB7fQoKICAgIGRlZiBkb19HRVQoc2VsZik6CiAgICAgICAgaWYgbm90IHZlcmlmeV9zZWNyZXQoc2VsZi5oZWFkZXJzKToKICAgICAgICAgICAgcmV0dXJuIHNlbGYuc2VuZF9qc29uKDQwMSwgeydlcnJvcic6ICdVbmF1dGhvcml6ZWQnfSkKICAgICAgICBpZiBzZWxmLnBhdGggPT0gJy9oZWFsdGgnOgogICAgICAgICAgICByZXR1cm4gc2VsZi5zZW5kX2pzb24oMjAwLCB7J29rJzogVHJ1ZX0pCiAgICAgICAgaWYgc2VsZi5wYXRoID09ICcvc3RhdHVzJzoKICAgICAgICAgICAgc3Rkb3V0LCBzdGRlcnIsIHJjID0gcnVuKGYnd2cgc2hvdyB7V0dfSU5URVJGQUNFfSBkdW1wJykKICAgICAgICAgICAgaWYgcmMgIT0gMDoKICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLnNlbmRfanNvbig1MDAsIHsnZXJyb3InOiBzdGRlcnJ9KQogICAgICAgICAgICBsaW5lcyA9IFtsIGZvciBsIGluIHN0ZG91dC5zcGxpdGxpbmVzKCkgaWYgbC5zdHJpcCgpXQogICAgICAgICAgICBwZWVycyA9IFtdCiAgICAgICAgICAgIGZvciBsaW5lIGluIGxpbmVzWzE6XToKICAgICAgICAgICAgICAgIHBhcnRzID0gbGluZS5zcGxpdCgnCScpCiAgICAgICAgICAgICAgICBpZiBsZW4ocGFydHMpIDwgODoKICAgICAgICAgICAgICAgICAgICBjb250aW51ZQogICAgICAgICAgICAgICAgcHViX2tleSwgXywgZW5kcG9pbnQsIGFsbG93ZWRfaXBzLCBsYXN0X2hzLCByeCwgdHgsIF8gPSBwYXJ0c1s6OF0KICAgICAgICAgICAgICAgIHBlZXJzLmFwcGVuZCh7CiAgICAgICAgICAgICAgICAgICAgJ3B1YmxpY0tleSc6IHB1Yl9rZXksCiAgICAgICAgICAgICAgICAgICAgJ2VuZHBvaW50JzogZW5kcG9pbnQgaWYgZW5kcG9pbnQgIT0gJyhub25lKScgZWxzZSBOb25lLAogICAgICAgICAgICAgICAgICAgICdhbGxvd2VkSXBzJzogYWxsb3dlZF9pcHMsCiAgICAgICAgICAgICAgICAgICAgJ2xhc3RIYW5kc2hha2UnOiBpbnQobGFzdF9ocyksCiAgICAgICAgICAgICAgICAgICAgJ3RyYW5zZmVyUngnOiBpbnQocngpLAogICAgICAgICAgICAgICAgICAgICd0cmFuc2ZlclR4JzogaW50KHR4KSwKICAgICAgICAgICAgICAgIH0pCiAgICAgICAgICAgIHJldHVybiBzZWxmLnNlbmRfanNvbigyMDAsIHsnaW50ZXJmYWNlJzogV0dfSU5URVJGQUNFLCAncGVlcnMnOiBwZWVyc30pCiAgICAgICAgaWYgc2VsZi5wYXRoLnN0YXJ0c3dpdGgoJy9jZXJ0L2V4dHJhY3QnKToKICAgICAgICAgICAgcXVlcnkgPSB1cmxsaWIucGFyc2UudXJscGFyc2Uoc2VsZi5wYXRoKS5xdWVyeQogICAgICAgICAgICBwYXJhbXMgPSB1cmxsaWIucGFyc2UucGFyc2VfcXMocXVlcnkpCiAgICAgICAgICAgIHRhcmdldF9kb21haW4gPSBwYXJhbXMuZ2V0KCdkb21haW4nLCBbJyddKVswXS5zdHJpcCgpCiAgICAgICAgICAgIGlmIG5vdCB0YXJnZXRfZG9tYWluOgogICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuc2VuZF9qc29uKDQwMCwgeydlcnJvcic6ICdkb21haW4gcXVlcnkgcGFyYW1ldGVyIHJlcXVpcmVkJ30pCiAgICAgICAgICAgIGFjbWVfcGF0aCA9ICcvZGF0YS9jb29saWZ5L3Byb3h5L2FjbWUuanNvbicKICAgICAgICAgICAgaWYgbm90IG9zLnBhdGguZXhpc3RzKGFjbWVfcGF0aCk6CiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5zZW5kX2pzb24oNDA0LCB7J2Vycm9yJzogJ2FjbWUuanNvbiBub3QgZm91bmQnfSkKICAgICAgICAgICAgdHJ5OgogICAgICAgICAgICAgICAgd2l0aCBvcGVuKGFjbWVfcGF0aCwgJ3InLCBlbmNvZGluZz0ndXRmLTgnKSBhcyBmOgogICAgICAgICAgICAgICAgICAgIGFjbWVfZGF0YSA9IGpzb24ubG9hZChmKQogICAgICAgICAgICAgICAgY2VydHMgPSBhY21lX2RhdGEuZ2V0KCdsZXRzZW5jcnlwdCcsIHt9KS5nZXQoJ0NlcnRpZmljYXRlcycsIFtdKQogICAgICAgICAgICAgICAgZm9yIGMgaW4gY2VydHM6CiAgICAgICAgICAgICAgICAgICAgZF9tYWluID0gYy5nZXQoJ2RvbWFpbicsIHt9KS5nZXQoJ21haW4nLCAnJykKICAgICAgICAgICAgICAgICAgICBkX3NhbnMgPSBjLmdldCgnZG9tYWluJywge30pLmdldCgnc2FucycsIFtdKSBvciBbXQogICAgICAgICAgICAgICAgICAgIGlmIGRfbWFpbiA9PSB0YXJnZXRfZG9tYWluIG9yIHRhcmdldF9kb21haW4gaW4gZF9zYW5zOgogICAgICAgICAgICAgICAgICAgICAgICBjZXJ0X2I2NCA9IGMuZ2V0KCdjZXJ0aWZpY2F0ZScsICcnKQogICAgICAgICAgICAgICAgICAgICAgICBrZXlfYjY0ID0gYy5nZXQoJ2tleScsICcnKQogICAgICAgICAgICAgICAgICAgICAgICBjZXJ0X3N0ciA9IGJhc2U2NC5iNjRkZWNvZGUoY2VydF9iNjQpLmRlY29kZSgndXRmLTgnLCBlcnJvcnM9J2lnbm9yZScpCiAgICAgICAgICAgICAgICAgICAgICAgIGtleV9zdHIgPSBiYXNlNjQuYjY0ZGVjb2RlKGtleV9iNjQpLmRlY29kZSgndXRmLTgnLCBlcnJvcnM9J2lnbm9yZScpCiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLnNlbmRfanNvbigyMDAsIHsKICAgICAgICAgICAgICAgICAgICAgICAgICAgICdvayc6IFRydWUsCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZG9tYWluJzogdGFyZ2V0X2RvbWFpbiwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjZXJ0aWZpY2F0ZSc6IGNlcnRfc3RyLAogICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3ByaXZhdGVLZXknOiBrZXlfc3RyCiAgICAgICAgICAgICAgICAgICAgICAgIH0pCiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5zZW5kX2pzb24oNDA0LCB7J2Vycm9yJzogZidDZXJ0aWZpY2F0ZSBmb3Ige3RhcmdldF9kb21haW59IG5vdCBmb3VuZCBpbiBhY21lLmpzb24nfSkKICAgICAgICAgICAgZXhjZXB0IEV4Y2VwdGlvbiBhcyBlOgogICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuc2VuZF9qc29uKDUwMCwgeydlcnJvcic6IHN0cihlKX0pCiAgICAgICAgcmV0dXJuIHNlbGYuc2VuZF9qc29uKDQwNCwgeydlcnJvcic6ICdOb3QgZm91bmQnfSkKCiAgICBkZWYgZG9fUE9TVChzZWxmKToKICAgICAgICBpZiBub3QgdmVyaWZ5X3NlY3JldChzZWxmLmhlYWRlcnMpOgogICAgICAgICAgICByZXR1cm4gc2VsZi5zZW5kX2pzb24oNDAxLCB7J2Vycm9yJzogJ1VuYXV0aG9yaXplZCd9KQogICAgICAgIGJvZHkgPSBzZWxmLnJlYWRfYm9keSgpCiAgICAgICAgaWYgc2VsZi5wYXRoID09ICcvcGVlci9hZGQnOgogICAgICAgICAgICBwdWJfa2V5ID0gYm9keS5nZXQoJ3B1YmxpY0tleScsICcnKS5zdHJpcCgpCiAgICAgICAgICAgIHZwbl9pcCAgPSBib2R5LmdldCgndnBuSXAnLCAnJykuc3RyaXAoKQogICAgICAgICAgICBpZiBub3QgcHViX2tleSBvciBub3QgdnBuX2lwOgogICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuc2VuZF9qc29uKDQwMCwgeydlcnJvcic6ICdwdWJsaWNLZXkgYW5kIHZwbklwIHJlcXVpcmVkJ30pCiAgICAgICAgICAgIF8sIGVyciwgcmMgPSBydW4oZid3ZyBzZXQge1dHX0lOVEVSRkFDRX0gcGVlciAie3B1Yl9rZXl9IiBhbGxvd2VkLWlwcyB7dnBuX2lwfS8zMicpCiAgICAgICAgICAgIGlmIHJjICE9IDA6CiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5zZW5kX2pzb24oNTAwLCB7J2Vycm9yJzogZXJyfSkKICAgICAgICAgICAgcnVuKGYnd2ctcXVpY2sgc2F2ZSB7V0dfSU5URVJGQUNFfScpCiAgICAgICAgICAgIHJldHVybiBzZWxmLnNlbmRfanNvbigyMDAsIHsnb2snOiBUcnVlLCAndnBuSXAnOiB2cG5faXB9KQogICAgICAgIGlmIHNlbGYucGF0aCA9PSAnL3BlZXIvcmVtb3ZlJzoKICAgICAgICAgICAgcHViX2tleSA9IGJvZHkuZ2V0KCdwdWJsaWNLZXknLCAnJykuc3RyaXAoKQogICAgICAgICAgICBpZiBub3QgcHViX2tleToKICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLnNlbmRfanNvbig0MDAsIHsnZXJyb3InOiAncHVibGljS2V5IHJlcXVpcmVkJ30pCiAgICAgICAgICAgIHJ1bihmJ3dnIHNldCB7V0dfSU5URVJGQUNFfSBwZWVyICJ7cHViX2tleX0iIHJlbW92ZScpCiAgICAgICAgICAgIHJ1bihmJ3dnLXF1aWNrIHNhdmUge1dHX0lOVEVSRkFDRX0nKQogICAgICAgICAgICByZXR1cm4gc2VsZi5zZW5kX2pzb24oMjAwLCB7J29rJzogVHJ1ZX0pCiAgICAgICAgaWYgc2VsZi5wYXRoID09ICcvdHJhZWZpay9zdWJkb21haW4vYWRkJzoKICAgICAgICAgICAgc3ViZG9tYWluID0gYm9keS5nZXQoJ3N1YmRvbWFpbicsICcnKS5zdHJpcCgpCiAgICAgICAgICAgIHZwbl9pcCAgICA9IGJvZHkuZ2V0KCd2cG5JcCcsICcnKS5zdHJpcCgpCiAgICAgICAgICAgIHNsdWcgICAgICA9IGJvZHkuZ2V0KCdzbHVnJywgJycpLnN0cmlwKCkKICAgICAgICAgICAgaWYgbm90IHN1YmRvbWFpbiBvciBub3QgdnBuX2lwIG9yIG5vdCBzbHVnOgogICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuc2VuZF9qc29uKDQwMCwgeydlcnJvcic6ICdzdWJkb21haW4sIHZwbklwLCBhbmQgc2x1ZyByZXF1aXJlZCd9KQogICAgICAgICAgICBkeW5hbWljX2RpciA9ICcvZGF0YS9jb29saWZ5L3Byb3h5L2R5bmFtaWMnCiAgICAgICAgICAgIG9zLm1ha2VkaXJzKGR5bmFtaWNfZGlyLCBleGlzdF9vaz1UcnVlKQogICAgICAgICAgICB5YW1sX2NvbnRlbnQgPSBmIiIiIyBBdXRvLWdlbmVyYXRlZCBieSBNaWtyb0dlc3RvciBmb3Igcm91dGVyIHtzbHVnfQpodHRwOgogIHJvdXRlcnM6CiAgICByb3V0ZXIte3NsdWd9OgogICAgICBlbnRyeVBvaW50czoKICAgICAgICAtIGh0dHBzCiAgICAgIHJ1bGU6IEhvc3QoYHtzdWJkb21haW59YCkKICAgICAgc2VydmljZTogc2VydmljZS17c2x1Z30KICAgICAgdGxzOgogICAgICAgIGNlcnRSZXNvbHZlcjogbGV0c2VuY3J5cHQKICAgIHJvdXRlci17c2x1Z30taHR0cDoKICAgICAgZW50cnlQb2ludHM6CiAgICAgICAgLSBodHRwCiAgICAgIHJ1bGU6IEhvc3QoYHtzdWJkb21haW59YCkKICAgICAgc2VydmljZTogc2VydmljZS17c2x1Z30KICBzZXJ2aWNlczoKICAgIHNlcnZpY2Ute3NsdWd9OgogICAgICBsb2FkQmFsYW5jZXI6CiAgICAgICAgc2VydmVyczoKICAgICAgICAgIC0gdXJsOiAiaHR0cDovL3t2cG5faXB9OjgwIgoiIiIKICAgICAgICAgICAgZmlsZV9wYXRoID0gb3MucGF0aC5qb2luKGR5bmFtaWNfZGlyLCBmJ3JvdXRlci17c2x1Z30ueWFtbCcpCiAgICAgICAgICAgIHdpdGggb3BlbihmaWxlX3BhdGgsICd3JywgZW5jb2Rpbmc9J3V0Zi04JykgYXMgZjoKICAgICAgICAgICAgICAgIGYud3JpdGUoeWFtbF9jb250ZW50KQogICAgICAgICAgICBsb2cuaW5mbyhmJ1RyYWVmaWsgZHluYW1pYyBwcm94eSBjcmVhdGVkOiB7ZmlsZV9wYXRofSAoe3N1YmRvbWFpbn0gLT4ge3Zwbl9pcH06ODApJykKICAgICAgICAgICAgcmV0dXJuIHNlbGYuc2VuZF9qc29uKDIwMCwgeydvayc6IFRydWUsICdmaWxlJzogZmlsZV9wYXRoLCAnc3ViZG9tYWluJzogc3ViZG9tYWlufSkKICAgICAgICBpZiBzZWxmLnBhdGggPT0gJy90cmFlZmlrL3N1YmRvbWFpbi9yZW1vdmUnOgogICAgICAgICAgICBzbHVnID0gYm9keS5nZXQoJ3NsdWcnLCAnJykuc3RyaXAoKQogICAgICAgICAgICBpZiBub3Qgc2x1ZzoKICAgICAgICAgICAgICAgIHJldHVybiBzZWxmLnNlbmRfanNvbig0MDAsIHsnZXJyb3InOiAnc2x1ZyByZXF1aXJlZCd9KQogICAgICAgICAgICBmaWxlX3BhdGggPSBvcy5wYXRoLmpvaW4oJy9kYXRhL2Nvb2xpZnkvcHJveHkvZHluYW1pYycsIGYncm91dGVyLXtzbHVnfS55YW1sJykKICAgICAgICAgICAgaWYgb3MucGF0aC5leGlzdHMoZmlsZV9wYXRoKToKICAgICAgICAgICAgICAgIG9zLnJlbW92ZShmaWxlX3BhdGgpCiAgICAgICAgICAgICAgICBsb2cuaW5mbyhmJ1RyYWVmaWsgZHluYW1pYyBwcm94eSByZW1vdmVkOiB7ZmlsZV9wYXRofScpCiAgICAgICAgICAgIHJldHVybiBzZWxmLnNlbmRfanNvbigyMDAsIHsnb2snOiBUcnVlfSkKICAgICAgICByZXR1cm4gc2VsZi5zZW5kX2pzb24oNDA0LCB7J2Vycm9yJzogJ05vdCBmb3VuZCd9KQoKaWYgX19uYW1lX18gPT0gJ19fbWFpbl9fJzoKICAgICMgR2FyYW50ZSBOQVQgTWFzcXVlcmFkZSBlIGZvcndhcmRpbmcgcGFyYSBjbGllbnRlcyBXaXJlR3VhcmQgY29tIEZ1bGwgVHVubmVsIChuYXZlZ2HDp8OjbyBwcm90ZWdpZGEgcGVsYSBWUFMpCiAgICB0cnk6CiAgICAgICAgcnVuKGYnaXB0YWJsZXMgLXQgbmF0IC1DIFBPU1RST1VUSU5HIC1zIDEwLjguMC4wLzI0ICEgLW8ge1dHX0lOVEVSRkFDRX0gLWogTUFTUVVFUkFERSAyPi9kZXYvbnVsbCB8fCBpcHRhYmxlcyAtdCBuYXQgLUEgUE9TVFJPVVRJTkcgLXMgMTAuOC4wLjAvMjQgISAtbyB7V0dfSU5URVJGQUNFfSAtaiBNQVNRVUVSQURFJykKICAgICAgICBydW4oZidpcHRhYmxlcyAtQyBGT1JXQVJEIC1pIHtXR19JTlRFUkZBQ0V9IC1qIEFDQ0VQVCAyPi9kZXYvbnVsbCB8fCBpcHRhYmxlcyAtQSBGT1JXQVJEIC1pIHtXR19JTlRFUkZBQ0V9IC1qIEFDQ0VQVCcpCiAgICAgICAgcnVuKGYnaXB0YWJsZXMgLUMgRk9SV0FSRCAtbyB7V0dfSU5URVJGQUNFfSAtaiBBQ0NFUFQgMj4vZGV2L251bGwgfHwgaXB0YWJsZXMgLUEgRk9SV0FSRCAtbyB7V0dfSU5URVJGQUNFfSAtaiBBQ0NFUFQnKQogICAgICAgIHJ1bignc3lzY3RsIC13IG5ldC5pcHY0LmlwX2ZvcndhcmQ9MScpCiAgICBleGNlcHQgRXhjZXB0aW9uIGFzIGU6CiAgICAgICAgbG9nLndhcm5pbmcoZidDb3VsZCBub3QgY29uZmlndXJlIE5BVCBtYXNxdWVyYWRlIGZvciBmdWxsIHR1bm5lbDoge2V9JykKCiAgICBzZXJ2ZXIgPSBodHRwLnNlcnZlci5IVFRQU2VydmVyKChCSU5EX0hPU1QsIEJJTkRfUE9SVCksIFdHSGFuZGxlcikKICAgIGxvZy5pbmZvKGYnV0cgTWFuYWdlciBsaXN0ZW5pbmcgb24ge0JJTkRfSE9TVH06e0JJTkRfUE9SVH0nKQogICAgc2VydmVyLnNlcnZlX2ZvcmV2ZXIoKQo=
EOF

chmod +x "$WG_MANAGER_DIR/wg-manager.py"

# Criar Serviço Systemd
cat > /etc/systemd/system/mikrogestor-wg-manager.service << EOF
[Unit]
Description=MikroGestor WireGuard Manager Daemon
After=network.target wg-quick@wg0.service
Requires=wg-quick@wg0.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 ${WG_MANAGER_DIR}/wg-manager.py
Restart=always
RestartSec=5
Environment=WG_INTERFACE=${WG_INTERFACE}
Environment=WG_MANAGER_PORT=${WG_MANAGER_PORT}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mikrogestor-wg-manager >/dev/null 2>&1
systemctl restart mikrogestor-wg-manager
success "Daemon wg-manager ativo em 0.0.0.0:${WG_MANAGER_PORT} (serviço systemd habilitado)."

# ─── 7. Configuração do Firewall (UFW / Iptables) ─────────────────────────────
log "Passo 7/8: Configurando regras de firewall UFW..."

if command -v ufw >/dev/null 2>&1; then
    # Garantir que portas vitais do sistema nunca sejam bloqueadas
    ufw allow 22/tcp comment "SSH Server" >/dev/null 2>&1 || true
    ufw allow 80/tcp comment "HTTP Web" >/dev/null 2>&1 || true
    ufw allow 443/tcp comment "HTTPS SSL" >/dev/null 2>&1 || true
    ufw allow 8000/tcp comment "Coolify Dashboard" >/dev/null 2>&1 || true
    
    # Porta UDP pública para o túnel WireGuard com MikroTiks
    ufw allow ${WG_PORT}/udp comment "MikroGestor WireGuard UDP" >/dev/null 2>&1 || true
    
    # Porta TCP do daemon liberada estritamente para subnets Docker (RFC 1918)
    ufw allow from 172.16.0.0/12 to any port ${WG_MANAGER_PORT} proto tcp comment "MikroGestor Docker to WG-Manager" >/dev/null 2>&1 || true
    ufw allow from 10.0.0.0/8 to any port ${WG_MANAGER_PORT} proto tcp comment "MikroGestor Local Subnet" >/dev/null 2>&1 || true
    ufw reload >/dev/null 2>&1 || true
    success "Firewall UFW ajustado com segurança (portas 22, 80, 443, 8000, 51820/udp e 51821/tcp liberadas)."
fi

# ─── 8. Auto-Detecção de IP Público e Testes de Integridade ───────────────────
log "Passo 8/8: Executando auto-testes de integridade..."

# Detecção resiliente de IP Público
PUBLIC_IP=$(curl -s4 --max-time 3 https://api.ipify.org || \
            curl -s4 --max-time 3 https://icanhazip.com || \
            curl -s4 --max-time 3 https://ifconfig.me || \
            hostname -I | awk '{print $1}')
PUBLIC_IP=$(echo "$PUBLIC_IP" | tr -d '[:space:]')

# Teste local do daemon
TEST_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "X-WG-Secret: ${WG_MANAGER_SECRET}" "http://127.0.0.1:${WG_MANAGER_PORT}/health" || echo "000")
if [[ "$TEST_HTTP" == "200" ]]; then
    success "Auto-teste HTTP local em 127.0.0.1:${WG_MANAGER_PORT} aprovado (HTTP 200 OK)."
else
    warn "Daemon retornou HTTP ${TEST_HTTP}. Verifique 'journalctl -u mikrogestor-wg-manager -n 20'."
fi

# Se houver interface docker0 (Coolify/Docker presente), testar IP da ponte
if ip addr show docker0 >/dev/null 2>&1; then
    DOCKER_GW=$(ip -4 addr show docker0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n1 || echo "172.17.0.1")
    TEST_DOCKER=$(curl -s -o /dev/null -w "%{http_code}" -H "X-WG-Secret: ${WG_MANAGER_SECRET}" "http://${DOCKER_GW}:${WG_MANAGER_PORT}/health" || echo "000")
    if [[ "$TEST_DOCKER" == "200" ]]; then
        success "Comunicação Docker-Host via ${DOCKER_GW}:${WG_MANAGER_PORT} aprovada (HTTP 200 OK)."
    else
        warn "Ponte Docker ${DOCKER_GW} ainda não acessível diretamente (verifique regras de rede)."
    fi
else
    DOCKER_GW="172.17.0.1"
fi

# Gerar chave aleatória para NEXTAUTH_SECRET se não existir
NEXTAUTH_GEN_SECRET=$(openssl rand -hex 32)

# ─── Resumo e Variáveis Prontas para Coolify ──────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}      🎉 VPS CONFIGURADA COM SUCESSO TOTAL PARA O MIKROGESTOR!             ${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "1. ${CYAN}${BOLD}PERSISTENT STORAGE NO COOLIFY (OBRIGATÓRIO):${NC}"
echo -e "   Vá em: ${BOLD}Application → Persistent Storage → Add Volume${NC}"
echo -e "   - ${YELLOW}Container Path:${NC} /app/prisma"
echo -e "   - ${YELLOW}Host Path:     ${NC} /data/mikrogestor/prisma"
echo -e "   (Ou adicione em Custom Docker Run Options: ${BOLD}-v /data/mikrogestor/prisma:/app/prisma${NC})"
echo ""
echo -e "2. ${CYAN}${BOLD}ENVIRONMENT VARIABLES NO COOLIFY (Copie e cole tudo):${NC}"
echo -e "${YELLOW}---------------------------------------------------------------------------"
echo "DATABASE_URL=file:/app/prisma/dev.db"
echo "NEXTAUTH_SECRET=${NEXTAUTH_GEN_SECRET}"
echo "NEXTAUTH_URL=http://${PUBLIC_IP}"
echo "PORT=80"
echo "VPS_PUBLIC_IP=${PUBLIC_IP}"
echo "VPS_WG_PUBLIC_KEY=${VPS_PUBLIC_KEY}"
echo "WG_MANAGER_SECRET=${WG_MANAGER_SECRET}"
echo "WG_MANAGER_URL=http://${DOCKER_GW}:${WG_MANAGER_PORT}"
echo -e "---------------------------------------------------------------------------${NC}"
echo ""
echo -e "Status da Interface WireGuard:"
wg show
echo ""
echo -e "${CYAN}Comando de diagnóstico completo:${NC} bash scripts/verificar-deploy-completo.sh"
echo -e "${GREEN}${BOLD}Pronto para deploy limpo e sem erros!${NC}"