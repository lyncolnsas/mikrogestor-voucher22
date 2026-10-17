import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient; _dbMigrated?: boolean };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

let migrationDone = false;
let migrationRunning: Promise<void> | null = null;

/**
 * Garante que todas as colunas da VPN existam na tabela Router do SQLite.
 * Executado de forma síncrona/awaitable antes de qualquer query na tabela Router.
 */
export async function ensureVpnColumns(): Promise<void> {
  if (migrationDone) return;
  if (migrationRunning) return migrationRunning;

  migrationRunning = (async () => {
    try {
      const columns: any = await prisma.$queryRawUnsafe(`PRAGMA table_info("Router");`);
      const colNames = Array.isArray(columns) ? columns.map((c: any) => c.name) : [];

      if (colNames.length > 0) {
        if (!colNames.includes('vpnEnabled')) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Router" ADD COLUMN "vpnEnabled" BOOLEAN NOT NULL DEFAULT 0;`).catch(() => {});
        }
        if (!colNames.includes('vpnIp')) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Router" ADD COLUMN "vpnIp" TEXT;`).catch(() => {});
        }
        if (!colNames.includes('vpnPublicKey')) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Router" ADD COLUMN "vpnPublicKey" TEXT;`).catch(() => {});
        }
        if (!colNames.includes('vpnPrivKey')) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Router" ADD COLUMN "vpnPrivKey" TEXT;`).catch(() => {});
        }
        if (!colNames.includes('vpnLastSeen')) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Router" ADD COLUMN "vpnLastSeen" DATETIME;`).catch(() => {});
        }
        if (!colNames.includes('vpnStatus')) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Router" ADD COLUMN "vpnStatus" TEXT NOT NULL DEFAULT 'disconnected';`).catch(() => {});
        }
        if (!colNames.includes('subdomain')) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Router" ADD COLUMN "subdomain" TEXT;`).catch(() => {});
        }
        if (!colNames.includes('sslActive')) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Router" ADD COLUMN "sslActive" BOOLEAN NOT NULL DEFAULT 0;`).catch(() => {});
        }
        if (!colNames.includes('sslExpiresAt')) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Router" ADD COLUMN "sslExpiresAt" DATETIME;`).catch(() => {});
        }
      }

      // Garante que a tabela VpnPeer exista no SQLite
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "VpnPeer" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "deviceType" TEXT NOT NULL DEFAULT 'windows',
          "vpnIp" TEXT UNIQUE NOT NULL,
          "publicKey" TEXT NOT NULL,
          "privateKey" TEXT NOT NULL,
          "presharedKey" TEXT,
          "status" TEXT NOT NULL DEFAULT 'disconnected',
          "lastSeen" DATETIME,
          "fullTunnel" BOOLEAN NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `).catch(() => {});

      // Garante coluna fullTunnel se a tabela já existia antes
      const peerCols: any = await prisma.$queryRawUnsafe(`PRAGMA table_info("VpnPeer");`).catch(() => []);
      const peerColNames = Array.isArray(peerCols) ? peerCols.map((c: any) => c.name) : [];
      if (peerColNames.length > 0 && !peerColNames.includes('fullTunnel')) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "VpnPeer" ADD COLUMN "fullTunnel" BOOLEAN NOT NULL DEFAULT 0;`).catch(() => {});
      }

      migrationDone = true;
    } catch (e) {
      console.warn('[Prisma Auto-Migration Error]', e);
    } finally {
      migrationRunning = null;
    }
  })();

  return migrationRunning;
}

// Dispara uma vez na inicialização
ensureVpnColumns().catch(() => {});
