const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando configuração do banco de dados...');

  // Otimizações de performance e vida útil do cartão MicroSD (Raspberry Pi)
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY;');
    console.log('SQLite configurado com sucesso em modo WAL (Write-Ahead Logging)!');
  } catch (pragmaErr) {
    console.warn('Aviso ao configurar PRAGMA SQLite:', pragmaErr.message);
  }

  // Auto-correção e migração defensiva de colunas críticas no SQLite
  try {
    const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table';");
    const tableNames = tables.map(t => t.name);

    if (tableNames.includes('HotspotLead')) {
      const leadCols = await prisma.$queryRawUnsafe('PRAGMA table_info(HotspotLead);');
      const colNames = leadCols.map(c => c.name);

      if (!colNames.includes('trialBlocked')) {
        console.log('[MikroGestor] Migrando: adicionando HotspotLead.trialBlocked...');
        await prisma.$executeRawUnsafe('ALTER TABLE HotspotLead ADD COLUMN trialBlocked BOOLEAN NOT NULL DEFAULT 0;');
      }
      if (!colNames.includes('trialGrantedAt')) {
        console.log('[MikroGestor] Migrando: adicionando HotspotLead.trialGrantedAt...');
        await prisma.$executeRawUnsafe('ALTER TABLE HotspotLead ADD COLUMN trialGrantedAt DATETIME;');
      }
    }

    if (tableNames.includes('WhatsappInstance')) {
      const waCols = await prisma.$queryRawUnsafe('PRAGMA table_info(WhatsappInstance);');
      const colNames = waCols.map(c => c.name);
      if (!colNames.includes('groupJoinError')) {
        console.log('[MikroGestor] Migrando: adicionando WhatsappInstance.groupJoinError...');
        await prisma.$executeRawUnsafe('ALTER TABLE WhatsappInstance ADD COLUMN groupJoinError TEXT;');
      }
    }

    if (!tableNames.includes('BlockedClient')) {
      console.log('[MikroGestor] Criando tabela BlockedClient...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS BlockedClient (
          id TEXT PRIMARY KEY,
          mac TEXT UNIQUE,
          cpf TEXT,
          phone TEXT,
          reason TEXT NOT NULL,
          blockedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          active BOOLEAN NOT NULL DEFAULT 1
        );
      `);
    }
  } catch (schemaErr) {
    console.warn('[MikroGestor] Aviso na validação defensiva de schema:', schemaErr.message);
  }
  
  // Verifica se já existe algum usuário
  const userCount = await prisma.user.count();
  
  if (userCount === 0) {
    console.log('Nenhum usuário encontrado. Criando usuário administrador inicial...');
    const crypto = require('crypto');
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync('123', salt, 64);
    const hashedPassword = `scrypt$${salt}$${derivedKey.toString('hex')}`;

    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: 'Administrador',
        role: 'ADMIN'
      }
    });
    console.log('Usuário inicial provisionado com hash criptográfico seguro (scrypt)!');
    console.log('Login: admin');
    console.log('Senha: 123');
    console.log('⚠️ [AVISO DE SEGURANÇA]: Altere a senha do usuário "admin" imediatamente após o primeiro login.');
  } else {
    console.log('O banco de dados já possui usuários. Nenhuma ação necessária.');
  }
}


main()
  .catch((e) => {
    console.error('Erro ao configurar banco de dados:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
