import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MikrotikAPI } from '@/lib/routeros';
import { whatsappService } from '@/services/whatsapp';
import { MercadoPagoService } from '@/services/mercadopago';
import fs from 'fs';
import path from 'path';
import { resolveTemplateDir } from '@/lib/portal-template-utils';
import { getMaskedPortalDomain, getMaskedPortalUrl, isVpsMode } from '@/lib/domain';
import { getCustomTemplate, applyTemplateTags, getFlowConfig, getTriggerSendOptions } from '@/services/whatsapp-custom-messages';
import { signCustomerJwt } from '@/lib/jwt';


interface PortalConfig {
  enabled?: boolean;
  fields?: Record<string, boolean | string>;
  profile?: string;
  redirectUrl?: string;
}

function logEvent(type: string, data: any) {
  try {
    const logPath = path.join(process.cwd(), 'hotspot', 'error.log');
    const logMessage = `[${new Date().toISOString()}] [${type}] ${typeof data === 'string' ? data : JSON.stringify(data)}\n`;
    fs.promises.mkdir(path.dirname(logPath), { recursive: true })
      .then(() => fs.promises.appendFile(logPath, logMessage, 'utf8'))
      .catch(err => console.error('Failed to write to error.log', err));
  } catch (err) {
    console.error('Failed to log event', err);
  }
}

function createResponse(
  data: { success: boolean; message: string; data?: any; config?: any },
  isForm: boolean,
  statusCode: number = 200,
  userAgent: string = '',
  linkOrig: string = ''
) {
  if (!isForm) {
    return NextResponse.json(data, { status: statusCode });
  }

  if (data.success) {
    const finalDst = data.config?.redirectUrl || data.data?.redirectUrl || '';
    const targetLoginUrl = data.data?.linkLoginOnly || 'http://192.168.88.1/login';
    const username = data.data?.username || '';
    const passwordStr = data.data?.password || '';

    // Detect Apple device (CNA or User-Agent)
    const isApple = 
      /iPhone|iPad|iPod|Macintosh/i.test(userAgent) || 
      linkOrig.includes('apple.com') || 
      linkOrig.includes('captive.apple.com');

    if (isApple) {
      let redirectUrl = targetLoginUrl;
      const urlParams = new URLSearchParams();
      urlParams.append('username', username);
      urlParams.append('password', passwordStr);
      if (finalDst) {
        urlParams.append('dst', finalDst);
      }
      
      if (redirectUrl.includes('?')) {
        redirectUrl = `${redirectUrl}&${urlParams.toString()}`;
      } else {
        redirectUrl = `${redirectUrl}?${urlParams.toString()}`;
      }

      logEvent('APPLE_CNA_REDIRECT', { redirectUrl, userAgent, linkOrig });
      return NextResponse.redirect(redirectUrl, 302);
    }

    const htmlResponse = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Conectando...</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #0b1220;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 30px;
            border-radius: 16px;
            text-align: center;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          }
          h2 { color: #006eff; margin-top: 0; }
          p { color: #94a3b8; font-size: 14px; }
          .spinner {
            border: 4px solid rgba(255,255,255,0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #006eff;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Cadastro Concluído!</h2>
          <div class="spinner"></div>
          <p>Conectando você à internet, por favor aguarde...</p>
        </div>
        
        <form name="login" action="${targetLoginUrl}" method="POST" style="display:none;">
          <input type="hidden" name="username" value="${username}" />
          <input type="hidden" name="password" value="${passwordStr}" />
          <input type="hidden" name="dst" value="${finalDst}" />
        </form>
        
        <script>
          // Submit immediately — no need to wait for load or arbitrary delay
          (function() {
            try { document.login.submit(); } catch(e) {
              window.addEventListener('DOMContentLoaded', function() { document.login.submit(); });
            }
          })();
        </script>
      </body>
      </html>
    `;
    return new NextResponse(htmlResponse, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } else {
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Erro no Cadastro</title>
        <style>
          body { font-family: -apple-system, sans-serif; background: #0b1220; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 30px; border-radius: 16px; text-align: center; max-width: 400px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
          h2 { color: #ef4444; margin-top: 0; }
          p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
          .btn { background: #006eff; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; cursor: pointer; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Falha ao Cadastrar</h2>
          <p>${data.message}</p>
          <a href="javascript:history.back()" class="btn">Voltar e Tentar Novamente</a>
        </div>
      </body>
      </html>
    `;
    return new NextResponse(errorHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: statusCode
    });
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  const isForm = contentType.includes('application/x-www-form-urlencoded');

  try {
    // 1. Parse request body first
    let body: any = {};
    if (isForm) {
      try {
        const formData = await request.formData();
        formData.forEach((value, key) => {
          body[key] = value;
        });
        logEvent('START_REGISTRATION_FORM', { ...body, password: body.password ? '***' : null });
      } catch (formErr: any) {
        logEvent('MALFORMED_FORM', formErr?.message || formErr);
        return createResponse({ success: false, message: 'Dados de formulário inválidos.' }, isForm, 400);
      }
    } else {
      try {
        body = await request.json();
        logEvent('START_REGISTRATION_JSON', { ...body, password: body.password ? '***' : null });
      } catch (jsonErr: any) {
        logEvent('MALFORMED_JSON', jsonErr?.message || jsonErr);
        return createResponse({ success: false, message: 'JSON inválido.' }, isForm, 400);
      }
    }

    // 2. Determine template to load configuration from
    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === '1' || body.preview === '1' || body.preview === true;
    let template = searchParams.get('template') || body.template || '';

    if (!template) {
      try {
        const configRecord = await prisma.systemConfig.findUnique({
          where: { key: 'LAST_DEPLOYED_TEMPLATE' }
        });
        if (configRecord) {
          template = configRecord.value;
        }
      } catch (dbErr) {
        console.warn('Failed to fetch LAST_DEPLOYED_TEMPLATE in register API route:', dbErr);
      }
    }

    if (!template) {
      template = 'default';
    }

    const templateDir = resolveTemplateDir(template);
    let configPath = path.join(templateDir, 'config.json');

    // Fallback chain for config file path
    if (!fs.existsSync(configPath)) {
      configPath = path.join(process.cwd(), 'hotspot', 'default', 'config.json');
    }
    if (!fs.existsSync(configPath)) {
      configPath = path.join(process.cwd(), 'hotspot', 'config.json');
    }

    // 3. Read dynamic forms configuration
    let config: PortalConfig | null = null;
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.error(`Failed to parse ${configPath} in register route`, e);
      }
    }

    const enabled = config?.enabled !== undefined ? config.enabled : true;
    if (!enabled) {
      logEvent('DISABLED', `Registration is disabled for template ${template}`);
      return createResponse({ success: false, message: 'O cadastro de clientes está desativado.' }, isForm, 400);
    }

    const defaultFields = {
      nameEnabled: true,
      nameRequired: true,
      phoneEnabled: true,
      phoneRequired: true,
      birthDateEnabled: false,
      birthDateRequired: false,
      emailEnabled: false,
      emailRequired: false,
      cpfEnabled: false,
      cpfRequired: false,
      genderEnabled: false,
      genderRequired: false,
      passwordEnabled: false,
      passwordRequired: false,
      customFieldEnabled: false,
      customFieldLabel: 'Descreva aqui!',
      customFieldRequired: false,
      optInCoursesEnabled: false,
      optInCoursesLabel: 'Eu aceito receber informações dos cursos'
    };

    const fields = {
      ...defaultFields,
      ...(config?.fields || {})
    };

    const { name, username, email, cpf, gender, password, customFieldValue, optInCourses } = body;
    let { phone, birthDate } = body;
    
    // Reconstruct fields if they were posted separately via native HTML form
    // Do this FIRST before any validation so ddd+celular is always merged into phone
    const ddd = body['ddd'] || '';
    const celular = body['celular'] || '';
    if (ddd && celular) {
      phone = `${ddd.trim()}${celular.replace(/\D/g, '').trim()}`;
    }

    const birthYear = body['birthYear'] || '';
    const birthMonth = body['birthMonth'] || '';
    const birthDay = body['birthDay'] || '';
    if (!birthDate && birthYear && birthMonth && birthDay) {
      const mm = birthMonth.length < 2 ? `0${birthMonth}` : birthMonth;
      const ddVal = birthDay.length < 2 ? `0${birthDay}` : birthDay;
      birthDate = `${birthYear}-${mm}-${ddVal}`;
    }

    // Early exit: ignore empty/ghost form submissions (e.g. duplicate POST from captive portal)
    if (!username && !name && !phone && !password) {
      logEvent('IGNORED_EMPTY_SUBMISSION', 'Empty form body received, skipping.');
      return createResponse({ success: false, message: 'Submissão inválida.' }, isForm, 400);
    }
    
    // Parse optInCourses to boolean
    const isOptedIn = typeof optInCourses === 'boolean' ? optInCourses : (optInCourses === 'true' || optInCourses === 'on' || optInCourses === '1' || optInCourses === true);

    // Captive portal metadata parameters from hidden inputs or URL parameters
    const linkLoginOnly = body['link-login-only'] || '';
    const linkOrig = body['link-orig'] || '';

    // 2. Validate fields dynamically
    if (fields.nameEnabled && fields.nameRequired && !name) {
      logEvent('VALIDATION_FAILED', 'Nome Completo é obrigatório.');
      return createResponse({ success: false, message: 'Nome Completo é obrigatório.' }, isForm, 400);
    }
    if (fields.phoneEnabled && !phone) {
      logEvent('VALIDATION_FAILED', 'Telefone/WhatsApp é obrigatório.');
      return createResponse({ success: false, message: 'Telefone/WhatsApp é obrigatório.' }, isForm, 400);
    }
    if (fields.emailEnabled && fields.emailRequired && !email) {
      logEvent('VALIDATION_FAILED', 'E-mail é obrigatório.');
      return createResponse({ success: false, message: 'E-mail é obrigatório.' }, isForm, 400);
    }
    if (fields.birthDateEnabled && fields.birthDateRequired && !birthDate) {
      logEvent('VALIDATION_FAILED', 'Data de nascimento é obrigatória.');
      return createResponse({ success: false, message: 'Data de nascimento é obrigatória.' }, isForm, 400);
    }
    if (fields.cpfEnabled && fields.cpfRequired && !cpf) {
      logEvent('VALIDATION_FAILED', 'CPF é obrigatório.');
      return createResponse({ success: false, message: 'CPF é obrigatório.' }, isForm, 400);
    }
    if (fields.genderEnabled && fields.genderRequired && !gender) {
      logEvent('VALIDATION_FAILED', 'Gênero é obrigatório.');
      return createResponse({ success: false, message: 'Gênero é obrigatório.' }, isForm, 400);
    }
    if (fields.passwordEnabled && fields.passwordRequired) {
      if (!password || !password.trim()) {
        logEvent('VALIDATION_FAILED', 'Senha é obrigatória.');
        return createResponse({ success: false, message: 'Senha é obrigatória.' }, isForm, 400);
      }
    }
    if (fields.customFieldEnabled && fields.customFieldRequired && !customFieldValue) {
      logEvent('VALIDATION_FAILED', `${fields.customFieldLabel} é obrigatório.`);
      return createResponse({ success: false, message: `${fields.customFieldLabel} é obrigatório.` }, isForm, 400);
    }

    let rawPhone = '';
    if (fields.phoneEnabled) {
      rawPhone = phone ? phone.replace(/\D/g, '') : '';
      if (fields.phoneRequired && (!rawPhone || rawPhone.length < 10 || rawPhone.length > 11)) {
        logEvent('VALIDATION_FAILED', 'Telefone/WhatsApp inválido (com DDD).');
        return createResponse({ success: false, message: 'Telefone/WhatsApp inválido (com DDD).' }, isForm, 400);
      }
    }

    // 3. Format/Validate inputs — dynamically resolve username if not provided
    let resolvedUser = (username || '').trim();
    if (!resolvedUser) {
      if (rawPhone) {
        resolvedUser = rawPhone;
      } else if (name && name.trim()) {
        resolvedUser = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      } else if (cpf) {
        resolvedUser = cpf.replace(/\D/g, '');
      } else if (email && email.trim()) {
        resolvedUser = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');
      }
    }

    if (!resolvedUser) {
      logEvent('VALIDATION_FAILED', 'Nome de usuário é obrigatório.');
      return createResponse({ success: false, message: 'É obrigatório informar pelo menos o Usuário e Senha ou o WhatsApp para conexão.' }, isForm, 400);
    }
    const hotspotUser = resolvedUser.trim().toLowerCase();

    let rawCpf = null;
    if (fields.cpfEnabled && cpf) {
      rawCpf = cpf.replace(/\D/g, '');
      if (fields.cpfRequired && rawCpf.length !== 11) {
        logEvent('VALIDATION_FAILED', 'CPF deve conter exatamente 11 dígitos.');
        return createResponse({ success: false, message: 'CPF deve conter exatamente 11 dígitos.' }, isForm, 400);
      }
    }

    let parsedBirthDate: Date | null = null;
    if (birthDate && typeof birthDate === 'string' && birthDate.length >= 8) {
      parsedBirthDate = new Date(birthDate);
      if (isNaN(parsedBirthDate.getTime())) {
        parsedBirthDate = null;
      }
    }

    if (!parsedBirthDate && fields.birthDateEnabled && fields.birthDateRequired) {
      logEvent('VALIDATION_FAILED', 'Data de nascimento inválida ou não preenchida.');
      return createResponse({ success: false, message: 'Data de nascimento inválida ou não preenchida.' }, isForm, 400);
    }

    const finalName = name || (rawPhone ? `Cliente ${rawPhone}` : hotspotUser);

    // Se senha não for informada, gera senha padrão (WhatsApp ou o próprio usuário)
    let passwordStr = (password || '').trim();
    if (!passwordStr) {
      passwordStr = rawPhone || hotspotUser || '123456';
    }

    // Extrai o MAC do cliente (corpo do form, query string ou cabeçalho HTTP)
    const clientMac = (body.mac || searchParams.get('mac') || request.headers.get('x-client-mac') || '').trim().toUpperCase();

    // 3.5. Verificação de Blacklist / Clientes Bloqueados
    try {
      const orClauses: any[] = [];
      if (clientMac) orClauses.push({ mac: clientMac });
      if (rawCpf) orClauses.push({ cpf: rawCpf });
      if (rawPhone) orClauses.push({ phone: rawPhone });

      if (orClauses.length > 0) {
        const blocked = await prisma.blockedClient.findFirst({
          where: { active: true, OR: orClauses }
        });
        if (blocked) {
          logEvent('BLOCKED_CLIENT_REJECTED', { reason: blocked.reason, clientMac, rawCpf, rawPhone });
          return createResponse({
            success: false,
            message: `Acesso Bloqueado: Este dispositivo ou documento possui restrição na plataforma (${blocked.reason}). Regularize sua situação com o administrador.`
          }, isForm, 403);
        }
      }
    } catch (bErr) {
      console.warn('[Anti-Fraud] Erro ao consultar BlockedClient:', bErr);
    }

    // 3.6. Verificação Anti-Burla de Carência (15 Minutos)
    // Se o cliente já utilizou os 15 minutos e não efetuou o pagamento, ele é categoricamente bloqueado
    const planId = body.planId || searchParams.get('planId');
    let isFreeWifi = false;
    try {
      const freeWifiRec = await prisma.systemConfig.findUnique({ where: { key: 'free_wifi_mode' } });
      isFreeWifi = freeWifiRec?.value === 'true';
    } catch (fwErr) {
      console.warn('Erro ao checar free_wifi_mode:', fwErr);
    }

    if (!isFreeWifi && planId) {
      try {
        const leadSearchClauses: any[] = [];
        if (rawCpf) leadSearchClauses.push({ cpf: rawCpf });
        if (rawPhone) {
          leadSearchClauses.push({ phone: rawPhone });
          leadSearchClauses.push({ whatsappNumber: rawPhone });
        }

        if (leadSearchClauses.length > 0) {
          const prevLead = await prisma.hotspotLead.findFirst({
            where: { OR: leadSearchClauses },
            include: { payments: true }
          });

          if (prevLead) {
            const hasApproved = prevLead.payments.some((p: any) => p.status === 'approved');
            const hasTrialUsed = Boolean(prevLead.trialGrantedAt) || Boolean(prevLead.trialBlocked);

            if (hasTrialUsed && !hasApproved) {
              logEvent('TRIAL_RETRY_PREVENTED', { leadId: prevLead.id, rawCpf, rawPhone, clientMac });

              // Se o MAC for conhecido, bloqueia categoricamente no MikroTik e na Blacklist
              if (clientMac) {
                try {
                  await prisma.blockedClient.upsert({
                    where: { mac: clientMac },
                    update: { active: true, reason: 'Tentativa de re-cadastro sem pagar carência anterior' },
                    create: {
                      mac: clientMac,
                      cpf: rawCpf,
                      phone: rawPhone,
                      reason: 'Tentativa de re-cadastro sem pagar carência anterior'
                    }
                  });
                  const activeRouter = await prisma.router.findFirst({ where: { active: true } });
                  if (activeRouter) {
                    const mk = new MikrotikAPI();
                    if (await mk.connect(activeRouter.host, activeRouter.user, activeRouter.password, activeRouter.port)) {
                      await mk.blockHotspotMac(clientMac, 'Bloqueado re-cadastro sem pagar').catch(() => null);
                      mk.disconnect();
                    }
                  }
                } catch (mkBlockErr) {
                  console.warn('[Anti-Fraud] Erro ao aplicar bloqueio MikroTik:', mkBlockErr);
                }
              }

              return createResponse({
                success: false,
                message: 'Você já utilizou sua carência de 15 minutos para este cadastro e o pagamento pendente não foi confirmado. Efetue o pagamento do plano pendente para restabelecer a navegação.'
              }, isForm, 403);
            }
          }
        }
      } catch (antiFraudErr) {
        console.warn('[Anti-Fraud] Erro ao verificar histórico de carência:', antiFraudErr);
      }
    }

    // 4. Save lead in Database
    let lead;
    try {
      const isGrantingTrial = !isFreeWifi && Boolean(planId);
      lead = await prisma.hotspotLead.upsert({
        where: { hotspotUser },
        update: {
          name: finalName,
          phone: rawPhone || null,
          whatsappNumber: rawPhone || null,
          birthDate: parsedBirthDate,
          email: email || null,
          cpf: rawCpf,
          gender: gender || null,
          password: passwordStr,
          customFieldValue: customFieldValue || null,
          optInCourses: isOptedIn,
          trialGrantedAt: isGrantingTrial ? new Date() : undefined,
        },
        create: {
          name: finalName,
          phone: rawPhone || null,
          whatsappNumber: rawPhone || null,
          birthDate: parsedBirthDate,
          email: email || null,
          cpf: rawCpf,
          gender: gender || null,
          password: passwordStr,
          customFieldValue: customFieldValue || null,
          optInCourses: isOptedIn,
          hotspotUser,
          trialGrantedAt: isGrantingTrial ? new Date() : null,
        }
      });
      logEvent('DB_SAVE_SUCCESS', { leadId: lead.id, hotspotUser });

      // Sincroniza foto de perfil do contato via WhatsApp de forma assíncrona (não bloqueia resposta do captive portal)
      const contactPhone = rawPhone || lead.phone || lead.whatsappNumber;
      if (contactPhone) {
        whatsappService.downloadAndSaveContactAvatar(lead.id, contactPhone).catch((err) => {
          console.warn('[AvatarSync] Erro ao sincronizar foto de perfil no cadastro:', err);
        });
      }
    } catch (dbErr: any) {
      logEvent('DATABASE_ERROR', { error: dbErr?.message || dbErr });
      console.error('Database Error:', dbErr);
      return createResponse({ success: false, message: 'Erro ao salvar o cadastro localmente.' }, isForm, 500);
    }

    // 4.5. Processar compra de plano Pix (se selecionado e se NÃO for modo Wi-Fi Gratuito)
    let selectedPlan: any = null;
    let pixData: any = null;

    if (planId && !isFreeWifi) {
      try {
        selectedPlan = await (prisma.whatsappPlan as any).findUnique({
          where: { id: String(planId) }
        });
      } catch (planErr) {
        console.error('Erro ao buscar plano selecionado:', planErr);
      }
    }

    // Se estiver em modo venda (PORTAL_SALES_MODE !== 'free' e !isFreeWifi) e não veio planId, busca o plano padrão
    if (!selectedPlan && !isFreeWifi) {
      const salesModeCfg = await prisma.systemConfig.findUnique({ where: { key: 'PORTAL_SALES_MODE' } });
      if (salesModeCfg?.value !== 'free') {
        const { getOrSeedDefaultPlans } = await import('@/lib/plans');
        const defaultPlans = await getOrSeedDefaultPlans();
        selectedPlan = defaultPlans[0] || null;
      }
    }

    if (selectedPlan && selectedPlan.price > 0) {
      if (isPreview) {
        pixData = {
          pixId: `preview-pix-${Date.now()}`,
          pixPayload: `00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540${Number(selectedPlan.price).toFixed(2)}5802BR5913MIKROGESTOR6009SAO PAULO62070503***6304ABCD`,
          pixQrCodeBase64: '',
          amount: selectedPlan.price,
          planTitle: selectedPlan.title,
          gracePeriodMinutes: 15
        };
        logEvent('PREVIEW_PIX_SIMULATED', { amount: selectedPlan.price, planTitle: selectedPlan.title });
      } else {
        try {
          const mpConfig = await prisma.systemConfig.findUnique({ where: { key: 'MERCADOPAGO_TOKEN' } });
          if (mpConfig?.value && mpConfig.value.trim()) {
            const mpService = new MercadoPagoService(mpConfig.value.trim());
            const payerEmail = email || `${hotspotUser}@wifi.local`;
            const payerName = finalName;
            const payerCpf = rawCpf ? rawCpf.replace(/\D/g, '') : undefined;
            
            const mpResult: any = await mpService.createPixPayment({
              transaction_amount: selectedPlan.price,
              description: `Wi-Fi Hotspot - ${selectedPlan.title}`,
              payer: {
                email: payerEmail,
                first_name: payerName,
                identification: payerCpf ? { type: 'CPF', number: payerCpf } : undefined
              }
            });
            
            if (mpResult?.id) {
              const pixPayload = mpResult.point_of_interaction?.transaction_data?.qr_code || '';
              const pixQrCodeBase64 = mpResult.point_of_interaction?.transaction_data?.qr_code_base64 || '';
              const pixId = String(mpResult.id);
              
              await prisma.payment.create({
                data: {
                  leadId: lead.id,
                  pixId,
                  pixPayload,
                  pixQrCodeBase64,
                  amount: selectedPlan.price,
                  profile: selectedPlan.profile,
                  status: 'pending',
                  macAddress: clientMac || null
                }
              });
              
              pixData = {
                pixId,
                pixPayload,
                pixQrCodeBase64,
                amount: selectedPlan.price,
                planTitle: selectedPlan.title,
                gracePeriodMinutes: 15
              };
              logEvent('MP_PIX_CREATED', { pixId, amount: selectedPlan.price, planTitle: selectedPlan.title });
            }
          } else {
            // Fallback: Check manual PIX key if Mercado Pago is not configured
            const { getEffectivePixKey, generatePixPayload } = await import('@/lib/pix');
            const pixKey = await getEffectivePixKey();
            if (pixKey && pixKey.trim()) {
              const pixId = `MANUAL_reg_${Date.now()}`;
              const pixPayload = generatePixPayload(pixKey.trim(), selectedPlan.price, 'MIKROGESTOR', 'SAO PAULO');
              
              pixData = {
                pixId,
                pixPayload,
                pixQrCodeBase64: '',
                amount: selectedPlan.price,
                planTitle: selectedPlan.title,
                gracePeriodMinutes: 15
              };
              await prisma.payment.create({
                data: {
                  leadId: lead.id,
                  pixId,
                  pixPayload,
                  pixQrCodeBase64: '',
                  amount: selectedPlan.price,
                  profile: selectedPlan.profile,
                  status: 'pending',
                  macAddress: clientMac || null
                }
              });

              // Notificar admin via WhatsApp sobre novo pedido manual
              (async () => {
                try {
                  const adminNumbers = await whatsappService.getOnlineOfficialNumbers();
                  if (adminNumbers.length > 0) {
                    const adminMsg = `🔔 *Novo Pedido PIX Manual!*\n\n👤 *Cliente:* ${finalName}\n📱 *WhatsApp:* ${rawPhone || 'não informado'}\n📋 *CPF:* ${rawCpf || 'não informado'}\n🎟️ *Plano:* ${selectedPlan.title}\n💰 *Valor:* R$ ${Number(selectedPlan.price).toFixed(2)}\n🆔 *ID:* ${pixId}\n\n🔑 *Chave PIX enviada ao cliente:*\n\`${pixKey}\`\n\n➡️ Acesse o painel em /dashboard/finance para aprovar ou rejeitar.`;
                    await whatsappService.sendWhatsAppMessage('admin', adminNumbers[0], adminMsg).catch(() => {});
                  }
                } catch (e) { console.warn('[PIX Manual] Erro ao notificar admin:', e); }
              })();
            } else {
              logEvent('PIX_KEY_NOT_CONFIGURED', { planId: selectedPlan.id, planTitle: selectedPlan.title });
            }
          }
        } catch (mpErr: any) {
          console.error('[MercadoPago] Erro ao gerar cobrança PIX no cadastro:', mpErr);
          logEvent('MP_PIX_ERROR', mpErr?.message || mpErr);
        }
      }
    }

    // 5. Connect to MikroTik and create the user
    let mk;
    try {
      if (isPreview) {
        logEvent('MIKROTIK_BYPASS_PREVIEW', { hotspotUser });
        // Simular um atraso pequeno de rede para dar sensação de processamento
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        const activeRouter = await prisma.router.findFirst({ where: { active: true } });
        if (!activeRouter) {
          throw new Error('Nenhum roteador ativo encontrado no banco de dados.');
        }

        logEvent('MIKROTIK_CONNECT_START', { host: activeRouter.host, port: activeRouter.port, user: activeRouter.user });

        mk = new MikrotikAPI();
        const connected = await mk.connect(activeRouter.host, activeRouter.user, activeRouter.password, activeRouter.port);
        
        if (!connected) {
          throw new Error(`Falha ao conectar no MikroTik em ${activeRouter.host}:${activeRouter.port || 8728}`);
        }
        
        // FIX: Remove user directly by name — skip full listing (getHotspotUsers is slow on large networks)
        try {
          await mk.removeHotspotUserByName(hotspotUser);
          logEvent('MIKROTIK_USER_REMOVED', { username: hotspotUser });
        } catch {
          // User doesn't exist yet — that's fine, continue
        }

        // Build a rich comment with all user information
        const commentParts = ['AutoCadastro'];
        if (isFreeWifi) {
          commentParts.push('Wi-Fi Gratuito');
        } else if (selectedPlan) {
          commentParts.push(`Plano: ${selectedPlan.title}`);
        }
        if (pixData?.pixId) commentParts.push(`PIX: ${pixData.pixId}`);
        if (name) commentParts.push(`Nome: ${name}`);
        if (email) commentParts.push(`Email: ${email}`);
        if (birthDate) commentParts.push(`Nasc: ${birthDate}`);
        if (rawCpf) commentParts.push(`CPF: ${rawCpf}`);
        if (gender) commentParts.push(`Gen: ${gender}`);
        if (customFieldValue) commentParts.push(`Resp: ${customFieldValue}`);
        
        const finalComment = commentParts.join(' | ').substring(0, 250);

        // Add user to MikroTik Hotspot (aplica 15m de carência apenas se houver plano pago aguardando Pix)
        const profileName = (selectedPlan?.profile || (config as any)?.profile || 'default').trim() || 'default';
        const userPayload: any = {
          name: hotspotUser,
          password: passwordStr,
          profile: profileName,
          comment: finalComment,
          server: 'all'
        };
        if (selectedPlan && !isFreeWifi) {
          userPayload['limit-uptime'] = '00:15:00';
        }

        const addResult = await mk.addHotspotUser(userPayload);

        logEvent('MIKROTIK_USER_CREATED', { username: hotspotUser, result: addResult });

        mk.disconnect();
      }

    } catch (mkErr: any) {
      if (mk) mk.disconnect();
      logEvent('MIKROTIK_ERROR', { error: mkErr?.message || mkErr });
      console.error('MikroTik Error:', mkErr);
      return createResponse({ 
        success: false, 
        message: 'Cadastro local efetuado, mas erro ao integrar com o Roteador. Tente novamente.' 
      }, isForm, 500);
    }

    logEvent('SUCCESS', { username: hotspotUser });

    // FIX: Send WhatsApp welcome message as fire-and-forget — never block the HTTP response
    const targetPhone = lead?.phone || rawPhone;
    if (targetPhone) {
      const portalDomain = getMaskedPortalDomain(request.headers.get('host'));
      const wifiName = process.env.HOTSPOT_WIFI_NAME || 'nossa rede Wi-Fi';

      // Executa de forma assíncrona respeitando o Fluxograma e Régua de Sequências configurada
      (async () => {
        try {
          const [salesModeConfig, officialNumbers, flowMap] = await Promise.all([
            prisma.systemConfig.findUnique({ where: { key: 'PORTAL_SALES_MODE' } }),
            whatsappService.getOnlineOfficialNumbers(),
            getFlowConfig()
          ]);

          const isPaidMode = salesModeConfig?.value !== 'free';
          const activeFlow = isPaidMode ? flowMap.welcome_paid : flowMap.welcome_free;

          // Se o fluxo estiver globalmente desativado pelo administrador, aborta o disparo
          if (!activeFlow?.enabled) {
            logEvent('WA_FLOW_DISABLED', { isPaidMode, targetPhone });
            return;
          }

          let dispatchedInstanceId: string | undefined;

          // 1. Executa a mensagem de Boas-Vindas (Passo 1 do fluxo ativo)
          const steps = activeFlow.steps || [];
          const step1 = steps.find(s => s.id === 'step_1' && s.enabled) || steps[0];

          if (step1 && step1.enabled) {
            try {
              let officialNumbersSection = '';
              if (officialNumbers.length > 1 && isPaidMode) {
                const formattedList = officialNumbers.map(n => `• ${n}`).join('\n');
                officialNumbersSection = `\n\n🛡️ *Canais Oficiais:*\n${formattedList}`;
              }

              const portalUrl = getMaskedPortalUrl('', request.headers.get('host'));
              const rawTemplate = await getCustomTemplate(step1.key);
              const sendOpts = await getTriggerSendOptions(step1.key);

              const pixChave = pixData?.pixPayload && pixData.pixId?.startsWith('MANUAL_')
                ? pixData.pixPayload
                : '';
              const pixValor = pixData?.amount
                ? `R$ ${Number(pixData.amount).toFixed(2).replace('.', ',')}`
                : '';

              const msgBody = applyTemplateTags(rawTemplate, {
                cliente: finalName,
                usuario: hotspotUser,
                senha: passwordStr,
                cortesia: '15 minutos',
                rede_wifi: wifiName,
                canais_oficiais: officialNumbersSection,
                link_portal: `${portalUrl}/portal/planos`,
                chave_pix: pixChave ? `\n\n💳 *Pagamento PIX:*\nChave: \`${pixChave}\`\nValor: ${pixValor}\n_Envie o comprovante após o pagamento para agilizar a liberação._` : '',
                valor_pix: pixValor,
              });

              const res = await whatsappService.sendWhatsAppMessage('admin', targetPhone, msgBody, {
                skipStandby: true,
                media: sendOpts.media,
                forwardLibraryId: sendOpts.forwardLibraryId,
              });

              if (res.success && res.instanceId) {
                dispatchedInstanceId = res.instanceId;
              }

              logEvent(res.success ? 'WA_STEP_SENT' : 'WA_STEP_FAILED', {
                stepId: step1.id,
                stepKey: step1.key,
                targetPhone,
                dispatchedInstanceId
              });
            } catch (err: any) {
              logEvent('WA_STEP_ERROR', { stepId: step1?.id, error: err?.message || err });
            }
          }

          // ⚡ DISPARO CRÍTICO: Mensagem de Cobrança PIX Gerada (WA_MSG_PIX_GENERATED)
          if (pixData?.pixPayload && flowMap.pix_generated?.enabled !== false) {
            try {
              // Anti-ban humano: aguarda um intervalo de 4 a 7 segundos após as boas-vindas antes de enviar a cobrança PIX
              const humanDelay = Math.floor(Math.random() * (7000 - 4000 + 1)) + 4000;
              await new Promise(r => setTimeout(r, humanDelay));

              const portalUrl = getMaskedPortalUrl('', request.headers.get('host'));
              const rawPixTemplate = await getCustomTemplate('WA_MSG_PIX_GENERATED');
              const pixSendOpts = await getTriggerSendOptions('WA_MSG_PIX_GENERATED');
              const formattedValor = `R$ ${Number(pixData.amount).toFixed(2).replace('.', ',')}`;

              let officialNumbersSection = '';
              if (officialNumbers.length > 0) {
                const formattedList = officialNumbers.map(n => `• ${n}`).join('\n');
                officialNumbersSection = `\n\n🛡️ *Canais Oficiais:*\n${formattedList}`;
              }

              const pixMsgBody = applyTemplateTags(rawPixTemplate, {
                cliente: finalName,
                plano: pixData.planTitle || selectedPlan?.title || 'Acesso Wi-Fi',
                valor: formattedValor,
                cortesia: '15 minutos',
                pix_copia_cola: pixData.pixPayload,
                usuario: hotspotUser,
                senha: passwordStr,
                link_portal: `${portalUrl}/portal/planos`,
                rede_wifi: wifiName,
                canais_oficiais: officialNumbersSection
              });

              // 1. Envia mensagem formatada de cobrança PIX com orientações
              const resPix = await whatsappService.sendWhatsAppMessage('admin', targetPhone, pixMsgBody, {
                skipStandby: true,
                pinnedInstanceId: dispatchedInstanceId,
                media: pixSendOpts.media,
                forwardLibraryId: pixSendOpts.forwardLibraryId,
              });

              if (resPix.success && !dispatchedInstanceId && resPix.instanceId) {
                dispatchedInstanceId = resPix.instanceId;
              }

              // 2. Aguarda um intervalo humano de 2.5 a 4 segundos antes de disparar o balão isolado com o Copia e Cola puro
              const copyPasteDelay = Math.floor(Math.random() * (4000 - 2500 + 1)) + 2500;
              await new Promise(r => setTimeout(r, copyPasteDelay));

              await whatsappService.sendWhatsAppMessage('admin', targetPhone, pixData.pixPayload, {
                skipStandby: true,
                pinnedInstanceId: dispatchedInstanceId,
              });

              logEvent('WA_PIX_SENT', { targetPhone, pixId: pixData.pixId, amount: pixData.amount });
            } catch (pixErr: any) {
              console.error('[WhatsApp] Erro ao enviar mensagem PIX:', pixErr);
              logEvent('WA_PIX_ERROR', pixErr?.message || pixErr);
            }
          }
        } catch (e: any) {
          logEvent('WA_WELCOME_ERROR', e?.message || e);
        }
      })();

      logEvent('WA_WELCOME_DISPATCHED', { targetPhone });
    }

    const finalDst = config?.redirectUrl || linkOrig || 'https://www.google.com';
    
    // Obter URL do portal para construir a URL do safari-bypass
    const portalUrl = getMaskedPortalUrl('', request.headers.get('host'));
    const bypassUrl = `${portalUrl}/api/portal/safari-bypass?url=${encodeURIComponent(finalDst)}`;

    const userAgent = request.headers.get('user-agent') || '';
    const res = createResponse({ 
      success: true, 
      message: 'Cadastro realizado com sucesso!',
      data: {
        username: hotspotUser,
        password: passwordStr,
        linkLoginOnly,
        redirectUrl: bypassUrl,
        pix: pixData
      },
      config
    }, isForm, 200, userAgent, linkOrig);

    if (lead?.id) {
      try {
        const customerToken = await signCustomerJwt({
          leadId: lead.id,
          phone: lead.whatsappNumber || lead.phone,
          hotspotUser: lead.hotspotUser,
        });
        const isHttps =
          request.url.startsWith('https://') ||
          request.headers.get('x-forwarded-proto') === 'https' ||
          isVpsMode();
        res.cookies.set('portal_session', customerToken, {
          httpOnly: true,
          secure: isHttps,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60,
          path: '/',
        });
      } catch (tokenErr) {
        console.warn('[Register] Erro ao injetar portal_session:', tokenErr);
      }
    }

    return res;


  } catch (error: any) {
    console.error('Unhandled Registration Error:', error);
    try {
      const logMessage = `[${new Date().toISOString()}] Unhandled Registration Error: ${error?.message || error}\nStack: ${error?.stack || ''}\n\n`;
      fs.promises.appendFile(path.join(process.cwd(), 'hotspot', 'error.log'), logMessage, 'utf8').catch(logErr => console.error('Failed to write to error.log', logErr));
    } catch (logErr) {
      console.error('Failed to format error log', logErr);
    }
    return createResponse({ success: false, message: 'Erro interno no servidor.' }, isForm, 500);
  }
}
