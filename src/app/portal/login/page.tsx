import { prisma } from '@/lib/prisma';
import { isVpsMode, getPublicDomain } from '@/lib/domain';
import { getEffectiveWifiName } from '@/services/whatsapp-custom-messages';
import ClientLoginPortal from './ClientLoginPortal';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export default async function PortalLoginPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;

  const defaultDns = isVpsMode() ? (getPublicDomain() || 'mikrogestor.com') : 'portal.wifi.local';
  let dnsName = process.env.HOTSPOT_DNS_NAME || defaultDns;
  let networkName = await getEffectiveWifiName();
  const businessName = 'Portal Wi-Fi';
  const hotspotIp = '192.168.88.1';
  let subdomain: string | null = null;

  try {
    const [dnsConfig, router] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: 'HOTSPOT_DNS_NAME' } }),
      prisma.router.findFirst({ where: { active: true } })
    ]);

    if (dnsConfig?.value && (!isVpsMode() || !dnsConfig.value.includes('portal.wifi.local'))) {
      dnsName = dnsConfig.value;
    }
    if (router?.subdomain) {
      subdomain = router.subdomain;
    }
  } catch (e) {
    console.warn('[PortalLoginPage] Erro ao carregar configurações do banco:', e);
  }

  // Se veio SSID via searchParams, tem preferência
  const ssidParam = resolvedSearchParams?.ssid || resolvedSearchParams?.wifi;
  if (typeof ssidParam === 'string' && ssidParam.trim().length > 0) {
    networkName = decodeURIComponent(ssidParam.trim());
  }

  return (
    <ClientLoginPortal
      networkName={networkName}
      dnsName={dnsName}
      hotspotIp={hotspotIp}
      subdomain={subdomain}
      businessName={businessName}
    />
  );
}
