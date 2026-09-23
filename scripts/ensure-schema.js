/**
 * ensure-schema.js
 * Sincroniza o schema.prisma do repositório para o volume persistente.
 * Executado ANTES do `prisma db push` no startup do container.
 * Garante que o banco sempre tenha o schema mais recente do código.
 */
const fs   = require('fs');
const path = require('path');

// O schema "oráculo" está dentro da imagem Docker, em /app/scripts/schema.prisma
// O schema "destino" é o volume montado em /app/prisma/schema.prisma
const src  = path.join(__dirname, 'schema.prisma');
const dest = path.join(__dirname, '..', 'prisma', 'schema.prisma');

// Garante que o diretório de destino existe (segurança extra)
const destDir = path.dirname(dest);
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log('[Schema Sync] Diretório prisma criado:', destDir);
}

if (!fs.existsSync(src)) {
  console.warn('[Schema Sync] AVISO: schema.prisma de origem não encontrado em:', src);
  process.exit(0);
}

try {
  const srcContent = fs.readFileSync(src, 'utf8');

  let needsCopy = true;
  if (fs.existsSync(dest)) {
    const destContent = fs.readFileSync(dest, 'utf8');
    if (srcContent === destContent) {
      needsCopy = false;
      console.log('[Schema Sync] Schema já está atualizado — nenhuma ação necessária.');
    }
  }

  if (needsCopy) {
    fs.copyFileSync(src, dest);
    console.log('[Schema Sync] ✅ Schema Prisma atualizado no volume a partir do repositório!');
    console.log('[Schema Sync] Destino:', dest);
  }
} catch (err) {
  console.error('[Schema Sync] ❌ Falha ao sincronizar schema.prisma:', err.message);
  // Não aborta o boot — o prisma db push vai detectar divergências
}
