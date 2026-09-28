import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { spinText } from '@/utils/spintax';

export interface MessageTriggerDefinition {
  id: string;
  key: string;
  mode: 'free' | 'paid'; // Separador obrigatório e estrito
  category: 'hotspot' | 'sales' | 'finance' | 'chatbot' | 'support';
  categoryLabel: string;
  title: string;
  triggerEvent: string;
  description: string;
  defaultTemplate: string;
  availableTags: Array<{ tag: string; label: string; example: string }>;
}

export const WHATSAPP_TRIGGERS: MessageTriggerDefinition[] = [
  // ══════════════════════════════════════════════════════════════════════════════
  // MODELOS PAGOS (MODO VENDA / PAGO)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    id: 'welcome_paid',
    key: 'WA_MSG_WELCOME_PAID',
    mode: 'paid',
    category: 'hotspot',
    categoryLabel: 'Portal Hotspot',
    title: 'Boas-Vindas no Hotspot (Modo Venda com Cortesia)',
    triggerEvent: 'Quando o cliente termina de se cadastrar no portal captive com plano pago e recebe cortesia temporária de internet para pagar.',
    description: 'Envia credenciais de login, cortesia para navegação e lista de canais oficiais anti-golpe.',
    defaultTemplate: `🌐 *Bem-vindo(a) à nossa Rede Wi-Fi!*

Olá, *{cliente}*!

🔑 *Suas Credenciais:*
• *Login:* \`{usuario}\`
• *Senha:* \`{senha}\`
• *Cortesia:* {cortesia} ⚡

📶 *Como se reconectar:*
Conecte-se na nossa rede Wi-Fi *{rede_wifi}*. Se não abrir a página de login automaticamente, toque aqui:
👉 {link_da_pagina_de_login}

Para escolher um plano após a cortesia:
👉 {link_portal}`,
    availableTags: [
      { tag: '{cliente}', label: 'Nome do Cliente', example: 'João da Silva' },
      { tag: '{usuario}', label: 'Usuário Hotspot', example: 'joao.silva' },
      { tag: '{senha}', label: 'Senha de Acesso', example: '99123456' },
      { tag: '{cortesia}', label: 'Tempo de Cortesia', example: '15 minutos' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'Wi-Fi Visitantes' },
      { tag: '{link_da_pagina_de_login}', label: 'Link da Página de Login', example: 'https://mikrogestor.com/portal/login' },
      { tag: '{link_login}', label: 'Link de Login (Curto)', example: 'https://mikrogestor.com/portal/login' },
      { tag: '{canais_oficiais}', label: 'Lista de Números Oficiais', example: '• +55 44 9999-9999' },
      { tag: '{link_portal}', label: 'Link do Portal de Planos', example: 'https://mikrogestor.com/portal/planos' },
    ],
  },
  {
    id: 'pix_generated',
    key: 'WA_MSG_PIX_GENERATED',
    mode: 'paid',
    category: 'finance',
    categoryLabel: 'Vendas & Cobrança',
    title: 'Cobrança PIX Gerada (Compra de Acesso)',
    triggerEvent: 'Quando o cliente escolhe um plano no portal ou no WhatsApp e gera um pagamento PIX.',
    description: 'Envia o resumo do pedido, valor, cortesia para pagamento e o código PIX Copia e Cola.',
    defaultTemplate: `⚡ *PIX Gerado com Sucesso!*

Olá, *{cliente}*! Pedido do plano *{plano}* no valor de *{valor}*.

Liberamos {cortesia} de cortesia para você abrir o app do seu banco.

📱 *Chave PIX Copia e Cola:*
\`{pix_copia_cola}\`

_Assim que pagar, sua conexão continuará ativa automaticamente!_`,
    availableTags: [
      { tag: '{cliente}', label: 'Nome do Cliente', example: 'Carlos Souza' },
      { tag: '{plano}', label: 'Nome do Plano', example: '1 Dia Ilimitado' },
      { tag: '{valor}', label: 'Valor Formatado', example: 'R$ 5,00' },
      { tag: '{cortesia}', label: 'Tempo de Cortesia', example: '15 minutos' },
      { tag: '{pix_copia_cola}', label: 'Código PIX Copia e Cola', example: '00020126580014br.gov.bcb.pix...' },
      { tag: '{usuario}', label: 'Usuário Hotspot', example: 'carlos' },
      { tag: '{senha}', label: 'Senha de Acesso', example: '123456' },
    ],
  },
  {
    id: 'payment_approved_hotspot',
    key: 'WA_MSG_PAYMENT_APPROVED_HOTSPOT',
    mode: 'paid',
    category: 'finance',
    categoryLabel: 'Vendas & Cobrança',
    title: 'Pagamento Confirmado (Hotspot Contínuo)',
    triggerEvent: 'Quando o Mercado Pago confirma o PIX ou o administrador aprova manualmente no painel.',
    description: 'Avisa que o plano foi ativado sem interrupção e reenvia login/senha para salvar.',
    defaultTemplate: `🎉 *Pagamento Confirmado!*\n\nOlá, *{cliente}*! Seu plano *{plano}* foi ativado com sucesso!\n\n🌐 *Status da Conexão:* Ativa (Sem interrupções)\n👤 *Usuário:* \`{usuario}\`\n🔑 *Senha:* \`{senha}\`\n\nAcompanhe seu tempo de conexão no portal:\n👉 {link_portal}\n\nObrigado pela preferência e bom uso! 🚀`,
    availableTags: [
      { tag: '{cliente}', label: 'Nome do Cliente', example: 'Carlos Souza' },
      { tag: '{plano}', label: 'Nome do Plano', example: '1 Semana VIP' },
      { tag: '{usuario}', label: 'Usuário Hotspot', example: 'carlos' },
      { tag: '{senha}', label: 'Senha de Acesso', example: '123456' },
      { tag: '{link_portal}', label: 'Link do Portal', example: 'http://portal.wifi.local/portal/planos' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'MikroGestor Wi-Fi' },
    ],
  },
  {
    id: 'voucher_delivery',
    key: 'WA_MSG_VOUCHER_DELIVERY',
    mode: 'paid',
    category: 'sales',
    categoryLabel: 'Vouchers & Códigos',
    title: 'Entrega de Voucher Avulso / Pago',
    triggerEvent: 'Quando um voucher avulso pago é comprado, gerado ou enviado pelo painel.',
    description: 'Envia o código do voucher pago em destaque e o tempo de validade.',
    defaultTemplate: `🎟️ *Seu Voucher de Acesso Wi-Fi Chegou!*\n\nOlá, *{cliente}*!\n\n🔑 *Código do Voucher:* \`{codigo_voucher}\`\n⏳ *Validade:* {validade}\n\nConecte-se na rede Wi-Fi *{rede_wifi}* e use o código acima para navegar livremente. 🚀`,
    availableTags: [
      { tag: '{cliente}', label: 'Nome do Cliente', example: 'Ana Beatriz' },
      { tag: '{codigo_voucher}', label: 'Código do Voucher', example: 'WIFI-9842' },
      { tag: '{validade}', label: 'Tempo de Validade', example: '2 Horas' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'MikroGestor Wi-Fi' },
    ],
  },
  {
    id: 'chatbot_greeting_paid',
    key: 'WA_MSG_CHATBOT_GREETING_PAID',
    mode: 'paid',
    category: 'chatbot',
    categoryLabel: 'Autoatendimento (Chatbot)',
    title: 'Chatbot: Saudação Inicial (Modo Venda de Planos)',
    triggerEvent: 'Quando uma pessoa chama no WhatsApp e o sistema oferece compra de planos e portal.',
    description: 'Dá as boas-vindas com link do portal e oferece venda direta de pacotes de internet.',
    defaultTemplate: `👋 Olá! Bem-vindo(a) ao atendimento automático da nossa rede Wi-Fi.\n\nPara liberar seu acesso à internet pelo navegador, visite:\n{link_portal_registro}\n\nOu se deseja comprar um plano de acesso por aqui agora mesmo, responda com o seu *NOME*:`,
    availableTags: [
      { tag: '{link_portal_registro}', label: 'Link de Registro no Portal', example: 'http://portal.wifi.local/portal/register' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'MikroGestor Wi-Fi' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // MODELOS FREE (MODO GRATUITO / EVENTO / LIBERADO)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    id: 'welcome_free',
    key: 'WA_MSG_WELCOME_FREE',
    mode: 'free',
    category: 'hotspot',
    categoryLabel: 'Portal Hotspot',
    title: 'Boas-Vindas no Hotspot (Modo Grátis / Evento)',
    triggerEvent: 'Quando o cliente se cadastra no portal captive com navegação gratuita liberada.',
    description: 'Envia credenciais de acesso liberado e link de reconexão sem menção a cobrança.',
    defaultTemplate: `🌐 *Bem-vindo(a) à nossa Rede Wi-Fi!*\n\nOlá, *{cliente}*! Seu cadastro foi concluído com sucesso.\n\n🔑 *Suas Credenciais de Acesso:*\n• *Usuário:* \`{usuario}\`\n• *Senha:* \`{senha}\`\n• *Status:* Acesso Livre e Gratuito ⚡\n\n📶 *Como se reconectar se cair a conexão:*\nConecte-se na nossa rede Wi-Fi *{rede_wifi}*. Se não abrir a página de login automaticamente no seu aparelho, toque aqui:\n👉 {link_da_pagina_de_login}\n\nTenha uma excelente navegação na nossa rede *{rede_wifi}*! 🚀`,
    availableTags: [
      { tag: '{cliente}', label: 'Nome do Cliente', example: 'Maria Oliveira' },
      { tag: '{usuario}', label: 'Usuário Hotspot', example: 'maria.oliveira' },
      { tag: '{senha}', label: 'Senha de Acesso', example: '88123456' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'Wi-Fi Evento' },
      { tag: '{link_da_pagina_de_login}', label: 'Link da Página de Login', example: 'https://mikrogestor.com/portal/login' },
      { tag: '{link_login}', label: 'Link de Login (Curto)', example: 'https://mikrogestor.com/portal/login' },
    ],
  },
  {
    id: 'voucher_delivery_free',
    key: 'WA_MSG_VOUCHER_DELIVERY_FREE',
    mode: 'free',
    category: 'sales',
    categoryLabel: 'Vouchers & Códigos',
    title: 'Entrega de Voucher Gratuito / Cortesia / Evento',
    triggerEvent: 'Quando um voucher gratuito ou passe de evento é distribuído aos convidados.',
    description: 'Envia o voucher de cortesia com instruções simples de conexão sem dados de pagamento.',
    defaultTemplate: `🎟️ *Seu Voucher Cortesia de Wi-Fi Chegou!*\n\nOlá, *{cliente}*! Você recebeu um passe de acesso para a nossa rede Wi-Fi *{rede_wifi}*.\n\n🔑 *Código de Acesso:* \`{codigo_voucher}\`\n⏳ *Validade:* {validade}\n\n📶 *Página de Login:*\nSe a tela de login não abrir automaticamente ao conectar no Wi-Fi, acesse:\n👉 {link_da_pagina_de_login}\n\nNavegue à vontade! 🚀`,
    availableTags: [
      { tag: '{cliente}', label: 'Nome do Cliente', example: 'Lucas Gabriel' },
      { tag: '{codigo_voucher}', label: 'Código do Voucher', example: 'FREE-2024' },
      { tag: '{validade}', label: 'Tempo de Validade', example: 'Dia Todo' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'Wi-Fi Visitantes' },
      { tag: '{link_da_pagina_de_login}', label: 'Link da Página de Login', example: 'https://mikrogestor.com/portal/login' },
      { tag: '{link_login}', label: 'Link de Login (Curto)', example: 'https://mikrogestor.com/portal/login' },
    ],
  },
  {
    id: 'welcome_step2_paid',
    key: 'WA_MSG_WELCOME_STEP2_PAID',
    mode: 'paid',
    category: 'hotspot',
    categoryLabel: 'Portal Hotspot',
    title: 'Boas-Vindas Passo 2: Link de Planos (Modo Venda)',
    triggerEvent: 'Disparado automaticamente alguns segundos após a Mensagem 1 para isolar o link e facilitar o clique no celular.',
    description: 'Envia o link direto para a página de planos sem poluição de texto.',
    defaultTemplate: `👉 *Acesse nossa página de planos para continuar navegando após a cortesia:*\n{link_portal}`,
    availableTags: [
      { tag: '{cliente}', label: 'Nome do Cliente', example: 'João da Silva' },
      { tag: '{link_portal}', label: 'Link do Portal de Planos', example: 'http://portal.wifi.local/portal/planos' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'Wi-Fi Visitantes' },
    ],
  },
  {
    id: 'welcome_step3_paid',
    key: 'WA_MSG_WELCOME_STEP3_PAID',
    mode: 'paid',
    category: 'hotspot',
    categoryLabel: 'Portal Hotspot',
    title: 'Boas-Vindas Passo 3: Lembrete de Expiração da Cortesia',
    triggerEvent: 'Disparado alguns minutos após o cadastro, avisando que a cortesia gratuita está perto de vencer.',
    description: 'Avisa o cliente para não ficar sem conexão e escolher um pacote antes da desconexão.',
    defaultTemplate: `⏳ *Atenção, {cliente}!*\n\nSua cortesia de internet está chegando ao fim. Para não perder sua conexão, acesse o link abaixo e escolha seu plano:\n{link_portal}`,
    availableTags: [
      { tag: '{cliente}', label: 'Nome do Cliente', example: 'João da Silva' },
      { tag: '{link_portal}', label: 'Link do Portal de Planos', example: 'http://portal.wifi.local/portal/planos' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'Wi-Fi Visitantes' },
    ],
  },
  {
    id: 'welcome_step2_free',
    key: 'WA_MSG_WELCOME_STEP2_FREE',
    mode: 'free',
    category: 'hotspot',
    categoryLabel: 'Portal Hotspot',
    title: 'Boas-Vindas Passo 2: Informações do Evento / Redes Sociais',
    triggerEvent: 'Disparado alguns minutos após a conexão gratuita para engajamento dos visitantes.',
    description: 'Mensagem de relacionamento para convidados do evento ou clientes do estabelecimento.',
    defaultTemplate: `📱 Esperamos que esteja aproveitando a nossa rede *{rede_wifi}*!\n\nSiga nossas redes sociais e fique por dentro de todas as novidades. Bom evento! 🎉`,
    availableTags: [
      { tag: '{cliente}', label: 'Nome do Cliente', example: 'Maria Oliveira' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'Wi-Fi Evento' },
    ],
  },
  {
    id: 'chatbot_greeting_free',
    key: 'WA_MSG_CHATBOT_GREETING_FREE',
    mode: 'free',
    category: 'chatbot',
    categoryLabel: 'Autoatendimento (Chatbot)',
    title: 'Chatbot: Saudação Inicial (Modo Grátis / Suporte)',
    triggerEvent: 'Quando o cliente chama no WhatsApp durante evento ou operação gratuita.',
    description: 'Informa que o Wi-Fi é gratuito e direciona diretamente para o link de conexão.',
    defaultTemplate: `👋 Olá! Bem-vindo(a) ao Wi-Fi gratuito da rede *{rede_wifi}*!\n\nPara liberar sua internet agora mesmo sem custo, acesse o link abaixo no seu navegador e confirme seus dados:\n{link_portal_registro}\n\nSe precisar de ajuda com a sua conexão, basta responder aqui! 🤝`,
    availableTags: [
      { tag: '{link_portal_registro}', label: 'Link de Registro no Portal', example: 'http://portal.wifi.local/portal/register' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'MikroGestor Wi-Fi' },
    ],
  },
  {
    id: 'raffle_winner_free',
    key: 'WA_MSG_RAFFLE_WINNER_FREE',
    mode: 'free',
    category: 'hotspot',
    categoryLabel: 'Sorteios & Leads',
    title: 'Notificação de Sorteio (Evento Gratuito)',
    triggerEvent: 'Quando um visitante ou participante do evento gratuito é sorteado.',
    description: 'Envia mensagem comemorativa para retirada do brinde ou prêmio.',
    defaultTemplate: `🎁 *PARABÉNS, {cliente}!* 🎁\n\nVocê foi sorteado(a) no evento da rede *{rede_wifi}*!\n\nProcure nossa equipe no local para resgatar seu prêmio! 🎉`,
    availableTags: [
      { tag: '{cliente}', label: 'Nome do Cliente', example: 'Marcos Paulo' },
      { tag: '{telefone}', label: 'Telefone do Cliente', example: '44999998888' },
      { tag: '{rede_wifi}', label: 'Nome da Rede Wi-Fi', example: 'MikroGestor Wi-Fi' },
    ],
  },
];

export interface FlowStepConfig {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  delaySeconds: number;
}

export interface TriggerFlowConfig {
  enabled: boolean;
  steps: FlowStepConfig[];
}

export interface SystemFlowMap {
  welcome_paid: TriggerFlowConfig;
  welcome_free: TriggerFlowConfig;
  pix_generated: { enabled: boolean; key: string };
  payment_approved: { enabled: boolean; key: string };
  voucher_paid: { enabled: boolean; key: string };
  voucher_free: { enabled: boolean; key: string };
  chatbot_paid: { enabled: boolean; key: string };
  chatbot_free: { enabled: boolean; key: string };
}

export const DEFAULT_FLOW_MAP: SystemFlowMap = {
  welcome_paid: {
    enabled: true,
    steps: [
      { id: 'step_1', name: 'Passo 1: Boas-Vindas & Credenciais', key: 'WA_MSG_WELCOME_PAID', enabled: true, delaySeconds: 0 },
      { id: 'step_2', name: 'Passo 2: Link de Planos Isolado', key: 'WA_MSG_WELCOME_STEP2_PAID', enabled: false, delaySeconds: 10 },
      { id: 'step_3', name: 'Passo 3: Lembrete Antes de Vencer Cortesia', key: 'WA_MSG_WELCOME_STEP3_PAID', enabled: false, delaySeconds: 600 },
    ],
  },
  welcome_free: {
    enabled: true,
    steps: [
      { id: 'step_1', name: 'Passo 1: Acesso Livre Liberado', key: 'WA_MSG_WELCOME_FREE', enabled: true, delaySeconds: 0 },
      { id: 'step_2', name: 'Passo 2: Engajamento / Redes Sociais', key: 'WA_MSG_WELCOME_STEP2_FREE', enabled: false, delaySeconds: 120 },
    ],
  },
  pix_generated: { enabled: true, key: 'WA_MSG_PIX_GENERATED' },
  payment_approved: { enabled: true, key: 'WA_MSG_PAYMENT_APPROVED_HOTSPOT' },
  voucher_paid: { enabled: true, key: 'WA_MSG_VOUCHER_DELIVERY' },
  voucher_free: { enabled: true, key: 'WA_MSG_VOUCHER_DELIVERY_FREE' },
  chatbot_paid: { enabled: true, key: 'WA_MSG_CHATBOT_GREETING_PAID' },
  chatbot_free: { enabled: true, key: 'WA_MSG_CHATBOT_GREETING_FREE' },
};

/**
 * Retorna o mapa completo de fluxos configurado no SQLite
 */
export async function getFlowConfig(): Promise<SystemFlowMap> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: 'FLOW_CONFIG_V1' } });
    if (config?.value) {
      const parsed = JSON.parse(config.value);
      return { ...DEFAULT_FLOW_MAP, ...parsed };
    }
  } catch (err) {
    console.error('[WhatsAppCustomMessages] Erro ao carregar mapa de fluxos:', err);
  }
  return DEFAULT_FLOW_MAP;
}

/**
 * Salva o mapa completo de fluxos no SQLite
 */
export async function saveFlowConfig(flowMap: SystemFlowMap): Promise<boolean> {
  try {
    await prisma.systemConfig.upsert({
      where: { key: 'FLOW_CONFIG_V1' },
      update: { value: JSON.stringify(flowMap) },
      create: { key: 'FLOW_CONFIG_V1', value: JSON.stringify(flowMap) },
    });
    return true;
  } catch (err) {
    console.error('[WhatsAppCustomMessages] Erro ao salvar mapa de fluxos:', err);
    return false;
  }
}

/**
 * Retorna o modo ativo do sistema ('free' | 'paid')
 */
export async function getActivePortalSalesMode(): Promise<'free' | 'paid'> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: 'PORTAL_SALES_MODE' } });
    if (config?.value === 'free') return 'free';
    if (config?.value === 'paid') return 'paid';
  } catch {}
  return 'paid'; // Default de fábrica: modo venda
}

/**
 * Retorna o template formatado (do banco ou o padrão de fábrica)
 */
export async function getCustomTemplate(key: string): Promise<string> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    if (row?.value && row.value.trim().length > 0) {
      return row.value;
    }
  } catch (err) {
    console.error(`[WhatsAppCustomMessages] Erro ao buscar template ${key}:`, err);
  }

  const def = WHATSAPP_TRIGGERS.find((t) => t.key === key);
  return def?.defaultTemplate || '';
}

/**
 * Retorna o nome exato da rede Wi-Fi (SSID) pré-configurado
 */
export async function getEffectiveWifiName(): Promise<string> {
  // 1. Configuração explícita salva no banco de dados (prioridade máxima)
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: { in: ['HOTSPOT_WIFI_NAME', 'HOTSPOT_NETWORK_NAME'] },
      },
    });
    const wifiConf = configs.find((c) => c.key === 'HOTSPOT_WIFI_NAME')?.value?.trim();
    if (wifiConf) return wifiConf;

    const netConf = configs.find((c) => c.key === 'HOTSPOT_NETWORK_NAME')?.value?.trim();
    if (netConf) return netConf;
  } catch (err) {
    console.error('[getEffectiveWifiName] Erro ao buscar no banco:', err);
  }

  // 2. Variável de ambiente do sistema
  if (process.env.HOTSPOT_WIFI_NAME?.trim()) {
    return process.env.HOTSPOT_WIFI_NAME.trim();
  }
  if (process.env.HOTSPOT_NETWORK_NAME?.trim()) {
    return process.env.HOTSPOT_NETWORK_NAME.trim();
  }

  // 3. Metadata do template ativo em uso (ex: FAP -> "Faculdade Adventista do Paraná")
  try {
    const lastTpl = await prisma.systemConfig.findUnique({
      where: { key: 'LAST_DEPLOYED_TEMPLATE' },
    });
    const tplName = lastTpl?.value?.trim() || 'FAP';
    const configPath = path.join(process.cwd(), 'hotspot', tplName, 'config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed.businessName?.trim()) return parsed.businessName.trim();
      if (parsed.brand?.subtitleText?.trim()) return parsed.brand.subtitleText.trim();
    }
  } catch (err) {
    console.error('[getEffectiveWifiName] Erro ao ler template ativo:', err);
  }

  // 4. Nome ou descrição do roteador MikroTik ativo (se houver e não for teste)
  try {
    const router = await prisma.router.findFirst({ where: { active: true } });
    if (router?.name && router.name !== 'teste' && router.name !== 'default') {
      return router.name.trim();
    }
  } catch {}

  // 5. Default padrão institucional exato
  return 'Faculdade Adventista do Paraná';
}

/**
 * Interpola tags {variavel} no texto do template
 */
export function applyTemplateTags(template: string, vars: Record<string, string>): string {
  let result = template;
  const finalVars = { ...vars };

  // Suporte flexível e intercambiável para tags de link de login e portal
  if (!finalVars.link_da_pagina_de_login && finalVars.link_login) {
    finalVars.link_da_pagina_de_login = finalVars.link_login;
  }
  if (!finalVars.link_login && finalVars.link_da_pagina_de_login) {
    finalVars.link_login = finalVars.link_da_pagina_de_login;
  }
  if (!finalVars.link_da_pagina_de_login && finalVars.link_portal) {
    finalVars.link_da_pagina_de_login = finalVars.link_portal.replace(/\/portal\/planos\/?$/i, '/portal/login');
    finalVars.link_login = finalVars.link_da_pagina_de_login;
  }

  // Pré-configuração estrita da rede Wi-Fi: se vazia ou genérica, usa o fallback exato
  if (!finalVars.rede_wifi || finalVars.rede_wifi.trim() === '' || finalVars.rede_wifi === 'nossa rede Wi-Fi') {
    finalVars.rede_wifi = 'Faculdade Adventista do Paraná';
  }

  for (const [key, val] of Object.entries(finalVars)) {
    const pattern = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(pattern, val || '');
  }
  return spinText(result);
}

/**
 * Retorna os dados da mídia associada ao template (se houver)
 */
export async function getCustomTemplateMedia(key: string): Promise<{ url: string; type: 'image' | 'video' | 'audio' | 'document' } | undefined> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: `${key}_MEDIA` } });
    if (row?.value) {
      return JSON.parse(row.value);
    }
  } catch (err) {
    console.error(`[WhatsAppCustomMessages] Erro ao buscar mídia para template ${key}:`, err);
  }
  return undefined;
}

/**
 * Retorna o ID da MediaLibrary vinculada ao template (se houver).
 * Tem precedência sobre getCustomTemplateMedia — forward nativo sem re-upload.
 */
export async function getCustomTemplateForwardId(key: string): Promise<string | undefined> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: `${key}_FORWARD_ID` } });
    return row?.value || undefined;
  } catch (err) {
    console.error(`[WhatsAppCustomMessages] Erro ao buscar forwardId para template ${key}:`, err);
  }
  return undefined;
}

/**
 * Retorna opções completas de envio para o gatilho (mídia ou forward nativo da biblioteca)
 * Se a mídia vinculada foi deletada da MediaLibrary, auto-limpa a referência para evitar
 * que o disparo fique travado ou 'offline'.
 */
export async function getTriggerSendOptions(key: string): Promise<{
  media?: { url: string; type: 'image' | 'video' | 'audio' | 'document' };
  forwardLibraryId?: string;
}> {
  let forwardLibraryId = await getCustomTemplateForwardId(key);
  if (forwardLibraryId) {
    try {
      const exists = await prisma.mediaLibrary.findUnique({
        where: { id: forwardLibraryId },
        select: { id: true }
      });
      if (!exists) {
        console.warn(`[WhatsAppCustomMessages] Mídia "${forwardLibraryId}" foi excluída da biblioteca. Auto-limpando gatilho "${key}" para não quebrar envios.`);
        await prisma.systemConfig.deleteMany({
          where: { key: `${key}_FORWARD_ID` }
        }).catch(() => {});
        forwardLibraryId = undefined;
      }
    } catch {
      // Ignora erro transitório de verificação
    }
  }

  const media = await getCustomTemplateMedia(key);
  return {
    forwardLibraryId: forwardLibraryId || undefined,
    media: media || undefined,
  };
}
