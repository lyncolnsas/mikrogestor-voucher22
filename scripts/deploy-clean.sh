#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# MikroGestor -- Deploy Limpo Zero-Clique
# Repositório: https://github.com/lyncolnsas/mikrogestor-voucher22
# ==============================================================================

APP_UUID="qtf1dw3ysntukjd7czu46msr"
PRISMA_DIR="/data/mikrogestor/prisma"
BACKUP_DIR="/data/mikrogestor/backups"
DOMAIN="mikrogestor.com"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { echo -e "${BLUE}[MG-DEPLOY]${RESET} $*"; }
ok()   { echo -e "${GREEN}[OK]${RESET} $*"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $*"; }

echo -e "${BOLD}============================================================${RESET}"
echo -e "${BOLD}     MikroGestor -- Deploy Limpo (Zero Clique)${RESET}"
echo -e "${BOLD}============================================================${RESET}"
echo ""

# 1. Backup do banco de dados
log "PASSO 1: Backup de seguranca do banco de dados..."
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ -f "$PRISMA_DIR/dev.db" ]; then
  cp "$PRISMA_DIR/dev.db" "$BACKUP_DIR/dev.db.bak.$TIMESTAMP"
  ok "Backup criado em: $BACKUP_DIR/dev.db.bak.$TIMESTAMP"
else
  warn "Banco dev.db nao encontrado -- sera inicializado no primeiro boot."
fi

# 2. Permissoes no volume persistente
log "PASSO 2: Garantindo permissoes no volume persistente..."
mkdir -p "$PRISMA_DIR"
chmod -R 777 "$PRISMA_DIR"
ok "Permissoes ajustadas com sucesso."

# 3. Correcoes no schema do banco via SQLite temporario
log "PASSO 3: Verificando colunas necessarias no schema SQLite..."
add_col_if_missing() {
  local TABLE="$1" COL="$2" DEF="$3"
  local COUNT
  COUNT=$(docker run --rm -v "$PRISMA_DIR":/db alpine sh -c \
    "apk add -q sqlite 2>/dev/null; sqlite3 /db/dev.db 'PRAGMA table_info($TABLE);'" 2>/dev/null \
    | grep -c "^[0-9]*|$COL|" || echo 0)
  if [ "$COUNT" = "0" ]; then
    docker run --rm -v "$PRISMA_DIR":/db alpine sh -c \
      "apk add -q sqlite 2>/dev/null; sqlite3 /db/dev.db 'ALTER TABLE $TABLE ADD COLUMN $COL $DEF;'" \
      2>/dev/null && ok "Adicionada coluna: $TABLE.$COL" || warn "Falha ao adicionar: $TABLE.$COL"
  else
    ok "Coluna ja existe: $TABLE.$COL"
  fi
}

if [ -f "$PRISMA_DIR/dev.db" ]; then
  add_col_if_missing "WhatsappInstance" "groupJoinError" "TEXT"
fi

# 4. Limpeza de containers antigos e liberacao de disco
log "PASSO 4: Limpando containers antigos e liberando espaco em disco..."
OLD=$(docker ps -a --filter "name=$APP_UUID" --format "{{.ID}}" 2>/dev/null || true)
if [ -n "$OLD" ]; then
  echo "$OLD" | xargs -r docker stop --timeout 20 2>/dev/null || true
  echo "$OLD" | xargs -r docker rm -f 2>/dev/null || true
  ok "Containers antigos eliminados com sucesso."
else
  warn "Nenhum container antigo ativo."
fi

# Liberar cache de build antigo do Docker para evitar "No space left on device"
docker builder prune -a -f --filter "until=1h" 2>/dev/null || true
docker image prune -a -f --filter "until=24h" 2>/dev/null || true
ok "Espaco em disco otimizado."

# 5. Notificacao de Deploy
log "PASSO 5: Disparando deploy via Coolify API..."
COOLIFY_AUTH_TOKEN="${COOLIFY_TOKEN:-${COOLIFY_API_TOKEN:-1|plahDHthpFs9JStO2953AjsfsjZKGnd9B9gTgKfx3c95a991}}"
HTTP_DEPLOY=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "http://localhost:8000/api/v1/deploy?uuid=$APP_UUID&force=true" \
  -H "Authorization: Bearer $COOLIFY_AUTH_TOKEN" \
  -H "Content-Type: application/json" 2>/dev/null || echo 000)

if [ "$HTTP_DEPLOY" = "200" ] || [ "$HTTP_DEPLOY" = "201" ]; then
  ok "Deploy disparado com sucesso via Coolify API (HTTP $HTTP_DEPLOY)!"
else
  warn "Coolify API retornou HTTP $HTTP_DEPLOY -- tentando via porta 8080..."
  curl -s -X POST "http://localhost:8080/api/v1/deploy?uuid=$APP_UUID&force=true" \
    -H "Authorization: Bearer $COOLIFY_AUTH_TOKEN" \
    -H "Content-Type: application/json" 2>/dev/null || true
fi

# 6. Monitoramento de subida
log "PASSO 6: Aguardando container e servidor HTTP iniciarem..."
MAX=240; ELAPSED=0
while [ $ELAPSED -lt $MAX ]; do
  sleep 5; ELAPSED=$((ELAPSED + 5))
  CID=$(docker ps --filter "name=$APP_UUID" --format "{{.ID}}" | head -1 || true)
  if [ -n "$CID" ]; then
    HTTP=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 8 "http://localhost:80" 2>/dev/null || echo 000)
    if [ "$HTTP" = "200" ] || [ "$HTTP" = "301" ] || [ "$HTTP" = "302" ]; then
      ok "Servidor respondendo HTTP $HTTP em ${ELAPSED}s!"
      break
    fi
    log "  Container $CID em execucao, testando HTTP... (status: $HTTP, decorrido: ${ELAPSED}s)"
  else
    log "  Aguardando criacao do container... (${ELAPSED}s/${MAX}s)"
  fi
done

# 7. Verificacao Final
log "PASSO 7: Inspecionando integridade e logs..."
CID=$(docker ps --filter "name=$APP_UUID" --format "{{.ID}}" | head -1 || true)
HTTPS_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "https://$DOMAIN" 2>/dev/null || echo 000)

if [ -n "$CID" ]; then
  ok "Container em operacao: $CID"
  ERRORS=$(docker logs "$CID" 2>&1 | grep -c "Edge runtime.*crypto\|P2022\|Cannot find module" || echo 0)
  if [ "$ERRORS" = "0" ]; then
    ok "Nenhum erro critico de Edge Runtime ou Prisma detectado nos logs!"
  else
    warn "$ERRORS avisos/erros encontrados nos logs do container."
  fi
  echo ""
  log "Ultimas 20 linhas de log:"
  docker logs "$CID" --tail 20 2>&1 | sed 's/^/  /'
fi

echo ""
echo -e "${BOLD}============================================================${RESET}"
echo "  Banco persistente: $PRISMA_DIR"
echo "  Backup salvo em:   $BACKUP_DIR/dev.db.bak.$TIMESTAMP"
echo "  Container ID:      ${CID:-nenhum}"
echo "  Status HTTPS:      $HTTPS_STATUS (https://$DOMAIN)"
echo -e "${BOLD}============================================================${RESET}"

if [ "$HTTPS_STATUS" = "200" ] || [ "$HTTPS_STATUS" = "301" ] || [ "$HTTPS_STATUS" = "302" ]; then
  echo -e "\n${GREEN}${BOLD}Deploy concluido com sucesso! https://$DOMAIN esta 100% online!${RESET}\n"
else
  echo -e "\n${YELLOW}Deploy em andamento ou finalizando inicializacao. Acesse https://$DOMAIN${RESET}\n"
fi