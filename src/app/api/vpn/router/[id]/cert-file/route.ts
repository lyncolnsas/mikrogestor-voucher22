import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wireguardService } from '@/services/wireguard';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'cert';

    const router = await prisma.router.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        vpnIp: true,
      },
    });

    if (!router) {
      return new Response('Roteador não encontrado', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (!router.subdomain) {
      return new Response('Roteador não possui subdomínio configurado', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const certResult = await wireguardService.getDomainCert(router.subdomain);

    if (!certResult.ok) {
      return new Response(
        `Certificado SSL para ${router.subdomain} ainda não foi emitido pelo Let's Encrypt: ${certResult.error}`,
        {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }
      );
    }

    if (type === 'key') {
      if (!certResult.privateKey) {
        return new Response('Chave privada não encontrada no certificado', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
      return new Response(certResult.privateKey, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-pem-file',
          'Content-Disposition': 'inline; filename="mg-key.pem"',
        },
      });
    }

    // Extrai estritamente o certificado folha (leaf cert) para evitar que o RouterOS
    // crie múltiplos certificados com o mesmo nome ao importar a cadeia completa (fullchain),
    // o que causava a seleção de um certificado sem chave privada para www-ssl e Hotspot.
    if (!certResult.certificate) {
      return new Response('Certificado público não encontrado', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const certBlocks = certResult.certificate.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
    const leafCert = certBlocks ? certBlocks[0] : certResult.certificate;

    return new Response(leafCert, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-pem-file',
        'Content-Disposition': 'inline; filename="mg-cert.pem"',
      },
    });
  } catch (error: any) {
    return new Response(`Erro ao buscar arquivos de certificado: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
