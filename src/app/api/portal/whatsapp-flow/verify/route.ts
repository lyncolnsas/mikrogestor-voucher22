import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { whatsappService } from '@/services/whatsapp';
import { UAParser } from 'ua-parser-js';

export async function POST(request: Request) {
  try {
    const { phone, token } = await request.json();

    if (!phone || !token) {
      return NextResponse.json({ error: 'Phone and Token are required' }, { status: 400 });
    }

    let formattedJid = phone.replace(/\D/g, '');
    if (!formattedJid.startsWith('55') && formattedJid.length <= 11) {
        formattedJid = `55${formattedJid}`;
    }
    if (!formattedJid.includes('@s.whatsapp.net')) formattedJid = `${formattedJid}@s.whatsapp.net`;

    const isValid = await whatsappService.verifyToken(formattedJid, token);

    if (!isValid) {
      return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 400 });
    }

    // Se válido, salva o Lead no banco
    const name = `Lead ${formattedJid.split('@')[0]}`;
    const existingLead = await prisma.hotspotLead.findFirst({
       where: { whatsappNumber: formattedJid }
    });
    
    if (!existingLead) {
       const userAgent = request.headers.get('user-agent') || '';
       const parser = new UAParser(userAgent);
       const parsedDevice = parser.getDevice();
       const parsedOs = parser.getOS();
       const parsedBrowser = parser.getBrowser();

       await prisma.hotspotLead.create({
          data: {
             name: name,
             whatsappNumber: formattedJid,
             hotspotUser: name.replace(/\s+/g, '').toLowerCase(), // temporário até ele escolher um nome
             userAgent,
             deviceModel: parsedDevice.model || null,
             deviceVendor: parsedDevice.vendor || null,
             deviceType: parsedDevice.type || 'mobile',
             osName: parsedOs.name || null,
             osVersion: parsedOs.version || null,
             browserName: parsedBrowser.name || null,
          }
       });
    }

    // Continua a conversa
    const activeInstances = await prisma.whatsappInstance.findMany({ where: { status: 'connected' } });
    const instanceId = activeInstances.length > 0 ? activeInstances[0].id : 'admin';
    
    // Nao travar a request
    setTimeout(async () => {
        await whatsappService.continueRegistrationFlow(instanceId, formattedJid);
    }, 1000);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error verifying token:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
