export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getMikrotikClient } from '@/lib/session';
import { routerErrorResponse } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';

export async function GET() {
  let mk;
  try {
    mk = await getMikrotikClient();
    const users = await mk.getHotspotUsers();
    mk.disconnect();

    // Incluímos a senha ('pass') necessária para impressão e reimpressão de vouchers
    const safeUsers = users.map((u: any) => ({
      id: u['.id'] || u.id,
      server: u.server || 'all',
      name: u.name,
      pass: u.password || u.name,
      profile: u.profile,
      uptime: u.uptime || '0s',
      bytesIn: u['bytes-in'] || '0',
      bytesOut: u['bytes-out'] || '0',
      comment: u.comment || ''
    }));

    return NextResponse.json({ success: true, data: safeUsers });
  } catch (error: any) {
    if (mk) mk.disconnect();
    return routerErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  let mk;
  try {
    const { id, name, ids, batchComment } = await request.json();
    mk = await getMikrotikClient();

    // 1. Delete by batch comment
    if (batchComment) {
      const count = await mk.removeHotspotUsersByComment(batchComment);
      mk.disconnect();
      return NextResponse.json({ success: true, message: `Lote apagado: ${count} vouchers removidos.` });
    }

    // 2. Delete multiple selected users
    if (Array.isArray(ids) && ids.length > 0) {
      let deletedCount = 0;
      for (const item of ids) {
        const targetId = typeof item === 'string' ? item : item?.id;
        const targetName = typeof item === 'object' ? item?.name : (targetId && !targetId.startsWith('*') ? targetId : undefined);
        
        try {
          if (targetId && targetId.startsWith('*')) {
            await mk.removeHotspotUser(targetId);
          } else if (targetName) {
            await mk.removeHotspotUserByName(targetName);
          } else if (targetId) {
            await mk.removeHotspotUser(targetId);
          }
          deletedCount++;
        } catch (e) {
          console.warn(`[DELETE /api/hotspot/users] Error removing user ${targetId || targetName}:`, e);
        }

        // Clean active session & DB
        const cleanName = targetName || (targetId && !targetId.startsWith('*') ? targetId : undefined);
        if (cleanName) {
          try {
            await mk.removeHotspotActiveByUser(cleanName);
          } catch {}
          try {
            const lead = await prisma.hotspotLead.findUnique({ where: { hotspotUser: cleanName } });
            if (lead) {
              await prisma.payment.deleteMany({ where: { leadId: lead.id } });
              await prisma.hotspotLead.delete({ where: { id: lead.id } });
            }
            await prisma.voucher.deleteMany({ where: { code: cleanName } });
          } catch (dbErr) {
            console.warn('[DELETE /api/hotspot/users] DB cleanup warning:', dbErr);
          }
        }
      }

      mk.disconnect();
      return NextResponse.json({ success: true, message: `${deletedCount} usuário(s) removido(s) com sucesso.` });
    }

    // 3. Delete single user by id / name
    if (id || name) {
      let removedFromMikrotik = false;
      const userName = name || (id && !id.startsWith('*') ? id : null);

      // Attempt by internal ID if present
      if (id && id.startsWith('*')) {
        try {
          await mk.removeHotspotUser(id);
          removedFromMikrotik = true;
        } catch (err) {
          console.warn('[DELETE /api/hotspot/users] Failed removeHotspotUser by ID, trying by name:', err);
        }
      }

      // If not yet removed or if username is available, remove by name
      if (userName) {
        try {
          await mk.removeHotspotUserByName(userName);
          removedFromMikrotik = true;
        } catch (err) {
          console.warn('[DELETE /api/hotspot/users] Failed removeHotspotUserByName:', err);
        }

        // Terminate any active sessions for this user
        try {
          await mk.removeHotspotActiveByUser(userName);
        } catch {}

        // Clean up database if this user was a HotspotLead or Voucher
        try {
          const lead = await prisma.hotspotLead.findUnique({ where: { hotspotUser: userName } });
          if (lead) {
            await prisma.payment.deleteMany({ where: { leadId: lead.id } });
            await prisma.hotspotLead.delete({ where: { id: lead.id } });
          }
          await prisma.voucher.deleteMany({ where: { code: userName } });
        } catch (dbErr) {
          console.warn('[DELETE /api/hotspot/users] DB cleanup warning:', dbErr);
        }
      } else if (!removedFromMikrotik && id) {
        await mk.removeHotspotUser(id);
      }

      mk.disconnect();
      return NextResponse.json({ success: true, message: 'Usuário removido com sucesso.' });
    }

    mk.disconnect();
    return NextResponse.json({ success: false, message: 'Nenhum ID ou Nome fornecido para exclusão.' }, { status: 400 });
  } catch (error: any) {
    if (mk) mk.disconnect();
    return NextResponse.json({ success: false, message: error.message || 'Erro ao remover usuário.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let mk;
  try {
    const { name, pass, server, profile, comment, price } = await request.json();

    if (!name || !profile) {
      return NextResponse.json({ success: false, message: 'Nome de usuário e perfil são obrigatórios.' }, { status: 400 });
    }

    const numPrice = parseFloat(price) || 0;

    mk = await getMikrotikClient();

    // Format single user for RouterOS
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const formattedDate = `${mm}.${dd}.${yy}`;
    
    // We tag single custom users with "avulso-[date]-[customComment]"
    const cleanComment = (comment || '').replace(/\s+/g, '_');
    const batchComment = `avulso-${formattedDate}${cleanComment ? `-${cleanComment}` : ''}`;

    const userData: any = {
      name,
      password: pass || name,
      profile,
      comment: batchComment
    };

    if (server && server !== 'all') {
      userData.server = server;
    }

    await mk.addHotspotUser(userData);
    mk.disconnect();

    // Store in Prisma database for financial reports
    try {
      await prisma.voucher.create({
        data: {
          code: name,
          profile,
          price: numPrice > 0 ? numPrice : null
        }
      });
    } catch (dbError) {
      console.error('Failed to save single voucher to local DB:', dbError);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Usuário avulso criado com sucesso!', 
      user: { name, pass: pass || name, profile, comment: batchComment }
    });
  } catch (error: any) {
    if (mk) mk.disconnect();
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
