import fs from 'fs';
import path from 'path';
import ClientPage from './ClientPage';
import { prisma } from '@/lib/prisma';
import { resolveTemplateDir } from '@/lib/portal-template-utils';

// Força a página a sempre buscar os dados frescos no servidor
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  let template = typeof resolvedSearchParams?.template === 'string' ? resolvedSearchParams.template : '';

  if (!template) {
    try {
      const configRecord = await prisma.systemConfig.findUnique({
        where: { key: 'LAST_DEPLOYED_TEMPLATE' }
      });
      if (configRecord) {
        template = configRecord.value;
      }
    } catch (e) {
      console.warn('Erro ao buscar LAST_DEPLOYED_TEMPLATE no DB:', e);
    }
  }

  if (!template) {
    template = 'default';
  }

  const templateDir = resolveTemplateDir(template);
  let initialConfig = null;

  try {
    let configPath = path.join(templateDir, 'config.json');

    // Fallback chains
    if (!fs.existsSync(configPath)) {
      configPath = path.join(process.cwd(), 'hotspot', 'default', 'config.json');
    }
    if (!fs.existsSync(configPath)) {
      configPath = path.join(process.cwd(), 'hotspot', 'config.json');
    }

    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      initialConfig = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Erro ao ler config.json no servidor:', error);
  }

  const isPreview = resolvedSearchParams?.preview === '1';

  let isFreeWifiMode = false;
  try {
    const freeWifiRecord = await prisma.systemConfig.findUnique({
      where: { key: 'free_wifi_mode' }
    });
    isFreeWifiMode = freeWifiRecord?.value === 'true';
  } catch (e) {
    console.warn('Erro ao checar free_wifi_mode:', e);
  }

  let isPaidSalesMode = true;
  try {
    const salesModeRecord = await prisma.systemConfig.findUnique({
      where: { key: 'PORTAL_SALES_MODE' }
    });
    if (salesModeRecord?.value === 'free') isPaidSalesMode = false;
  } catch (e) {
    console.warn('Erro ao checar PORTAL_SALES_MODE:', e);
  }

  // Se o Modo Evento / Wi-Fi Gratuito não estiver ativo e o modo for de venda (padrão)
  const isSaleModeEnabled = !isFreeWifiMode && (isPaidSalesMode || Boolean(initialConfig?.saleMode === true));

  let activePlans: any[] = [];
  if (isSaleModeEnabled) {
    try {
      const { getOrSeedDefaultPlans } = await import('@/lib/plans');
      activePlans = await getOrSeedDefaultPlans();
    } catch (plansErr) {
      console.warn('Erro ao carregar planos para o portal:', plansErr);
    }
  }

  // Checagem de Limite de Capacidade (Fila de Espera)
  let isLimitReached = false;
  if (!isPreview) {
    try {
      const configMaxUsers = await prisma.systemConfig.findUnique({ where: { key: 'MAX_HOTSPOT_USERS' } });
      const maxUsersLimit = parseInt(configMaxUsers?.value || '0', 10);
      if (maxUsersLimit > 0) {
        const { getMikrotikClient } = await import('@/lib/session');
        const mkSession = await getMikrotikClient();
        const activeUsers = await mkSession.getHotspotActive();
        mkSession.disconnect();
        if (activeUsers.length >= maxUsersLimit) {
          isLimitReached = true;
        }
      }
    } catch (e) {
      console.warn('Erro ao checar capacidade no MikroTik:', e);
    }
  }

  if (initialConfig) {
    initialConfig.template = template;
    initialConfig.isPreview = isPreview;
    initialConfig.freeWifiMode = isFreeWifiMode;
    initialConfig.saleMode = isSaleModeEnabled;
    initialConfig.plans = isSaleModeEnabled ? activePlans : [];
    initialConfig.limitReached = isLimitReached;
  } else {
    initialConfig = { 
      template, 
      isPreview, 
      freeWifiMode: isFreeWifiMode, 
      saleMode: isSaleModeEnabled, 
      plans: isSaleModeEnabled ? activePlans : [],
      limitReached: isLimitReached
    };
  }

  return <ClientPage initialConfig={initialConfig} />;
}
