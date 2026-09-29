/**
 * prepare-schema.js
 * Executado durante 'npm run build' para garantir que scripts/schema.prisma
 * esteja sempre 100% idêntico a prisma/schema.prisma antes de gerar o bundle ou imagem Docker.
 */
const fs = require('fs');
const path = require('path');

const prismaSchema = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const scriptsSchema = path.join(__dirname, 'schema.prisma');

if (fs.existsSync(prismaSchema)) {
  fs.copyFileSync(prismaSchema, scriptsSchema);
  console.log('[Schema Pre-Build] ✅ scripts/schema.prisma sincronizado com prisma/schema.prisma');
} else {
  console.warn('[Schema Pre-Build] ⚠️ prisma/schema.prisma não encontrado.');
}
