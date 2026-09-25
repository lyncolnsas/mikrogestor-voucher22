import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import type { IWhatsappAdapter, SendMessageOptions, SendMessageResult } from './whatsapp-interface';
import { usePrismaAuthState } from './baileys-prisma-auth';
import { generateForwardMessageContent } from '@whiskeysockets/baileys';

// ─── Template text converters (Meta → Baileys free text) ─────────────────────

const TEMPLATE_TEXTS: Record<string, (...vars: string[]) => string> = {
  liberacao_wifi: (cliente: string, nomeProduto: string) =>
    `Olá ${cliente}! 🎉 Temos uma ótima notícia:\n\nA sua vaga no plano *${nomeProduto}* foi liberada!\n\nA sua conexão já está pronta para uso no seu dispositivo.\n\nPara gerenciar o seu serviço ou tirar dúvidas, basta responder a esta mensagem.`,
  lembrete_pagamento: (cliente: string, valor: string) =>
    `Olá ${cliente}, tudo bem? Notamos uma pendência na renovação do seu acesso Wi-Fi.\n\nPara evitar interrupções, lembre-se de concluir o pagamento de *R$ ${valor}*.\n\nCaso já tenha pago, por favor desconsidere esta mensagem.`,
  numero_de_serie_: (cliente: string, us: string, sn: string) =>
    `Olá ${cliente}! A sua configuração foi concluída com sucesso.\n\nDetalhes de acesso:\n\nUS: *${us}*\nSN: *${sn}*\n\nGuarde essas informações para conectar seus aparelhos. Se precisar de suporte, basta responder aqui.`,
};

function extractParamsFromComponents(components: any[]): string[] {
  const params: string[] = [];
  for (const comp of components || []) {
    if (comp?.parameters) {
      for (const p of comp.parameters) {
        if (p?.text !== undefined) params.push(String(p.text));
      }
    }
  }
  return params;
}

// ─── Masking config (loaded from DB, cached globally) ─────────────────────────

export interface MaskingConfig {
  enabled: boolean;
  browserFingerprint: boolean;
  simulateTyping: boolean;
  simulateReading: boolean;
  simulateReceipt: boolean;
  typingDelayBetweenChunks: boolean;
  standbyEnabled: boolean;
  standbyMinSeconds: number;
  standbyMaxSeconds: number;
  typingCancelSimulation: boolean;
}

const DEFAULT_MASKING: MaskingConfig = {
  enabled: false,
  browserFingerprint: true,
  simulateTyping: true,
  simulateReading: true,
  simulateReceipt: true,
  typingDelayBetweenChunks: true,
  standbyEnabled: false,
  standbyMinSeconds: 30,
  standbyMaxSeconds: 180,
  typingCancelSimulation: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Calculate realistic typing duration based on text length at ~55 WPM */
function typingDuration(text: string): number {
  const avgWordLen = 5;
  const wpm = randomBetween(50, 70);
  const words = text.length / avgWordLen;
  const ms = (words / wpm) * 60 * 1000;
  return Math.min(Math.max(ms, 800), 6000); // clamp 0.8s–6s
}

/** Split message into natural human chunks (by sentence or length) */
function splitIntoChunks(text: string): string[] {
  if (text.length <= 120) return [text];
  const sentences = text.split(/(?<=[.!?…])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > 150 && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += (current ? ' ' : '') + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

// ─── Message handler type ────────────────────────────────────────────────────

export type MessageHandler = (instanceId: string, remoteJid: string, text: string, messageKey?: any) => Promise<void>;

// ─── Session Instance Representation ─────────────────────────────────────────

export interface BaileysSessionInstance {
  id: string;
  name: string;
  number: string | null;
  sock: any;
  qrCode: string | null;
  status: 'disconnected' | 'waiting_qr' | 'reconnecting' | 'connected' | 'error';
  sessionDir: string;
  isConnecting: boolean;
  lastSeen: Date | null;
  reconnectTimeout?: NodeJS.Timeout;
  libraryGroupJid?: string | null;
  libraryGroupName?: string | null;
  lastSentTimestamp?: number;
}

// ─── BaileysAdapter (Multi-Instance Manager) ──────────────────────────────────

export class BaileysAdapter implements IWhatsappAdapter {
  private sessions: Map<string, BaileysSessionInstance> = new Map();
  private roundRobinIndex: number = 0;
  private onMessageReceived?: MessageHandler;
  private onConnected?: (instanceId: string) => void;
  private maskingConfig: MaskingConfig = { ...DEFAULT_MASKING };
  private maskingConfigLoaded = false;
  private baseDir = path.join(process.cwd(), 'baileys_sessions');
  /**
   * Lock de serialização para ingresso no grupo central.
   * Evita race condition quando múltiplas sessões conectam simultaneamente
   * e tentam usar o mesmo código de convite ao mesmo tempo.
   * Chave: groupJid → Promise em andamento (ou undefined se livre).
   */
  private _groupJoinLock: Map<string, Promise<void>> = new Map();

  constructor(onMessageReceived?: MessageHandler) {
    this.onMessageReceived = onMessageReceived;
    this.initSessionsPool().catch(err => {
      console.error('[BaileysManager] Erro ao inicializar pool de sessões:', err);
    });
  }

  public setMessageHandler(handler: MessageHandler) {
    this.onMessageReceived = handler;
  }

  public setOnConnected(handler: (instanceId: string) => void) {
    this.onConnected = handler;
  }

  // ─── Pool Initialization ────────────────────────────────────────────────────

  /**
   * Inicializa todas as instâncias cadastradas no banco como Baileys e ativas.
   * Se nenhuma existir, migra a sessão legada ou cria a instância padrão.
   */
  public async initSessionsPool(): Promise<void> {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }

      // Migração suave: se existir pasta antiga baileys_session com credenciais e sem instâncias no banco
      const legacyDir = path.join(process.cwd(), 'baileys_session');
      let instances = await prisma.whatsappInstance.findMany({
        where: { engine: 'baileys', active: true }
      });

      if (instances.length === 0) {
        // Cria instância padrão no banco
        const defaultInstance = await prisma.whatsappInstance.create({
          data: {
            name: 'WhatsApp Principal 1',
            engine: 'baileys',
            status: 'disconnected',
            active: true
          }
        });
        instances = [defaultInstance];

        // Se houver sessão legada preexistente, copia para a nova pasta isolada
        const targetDir = path.join(this.baseDir, `instance_${defaultInstance.id}`);
        if (fs.existsSync(legacyDir) && fs.existsSync(path.join(legacyDir, 'creds.json')) && !fs.existsSync(targetDir)) {
          try {
            fs.mkdirSync(targetDir, { recursive: true });
            fs.cpSync(legacyDir, targetDir, { recursive: true });
            console.log(`[BaileysManager] Sessão legada migrada com sucesso para ${targetDir}`);
          } catch (mErr) {
            console.warn('[BaileysManager] Falha ao migrar sessão legada:', mErr);
          }
        }
      }

      // Inicia conexões em paralelo para todas as instâncias ativas
      for (const inst of instances) {
        await this.connectInstance(inst.id, inst.name);
      }
    } catch (err) {
      console.error('[BaileysManager] Erro no carregamento do pool:', err);
    }
  }

  // ─── Single Instance Connection ─────────────────────────────────────────────

  public async connectInstance(instanceId: string, customName?: string): Promise<BaileysSessionInstance> {
    let session = this.sessions.get(instanceId);
    const sessionDir = path.join(this.baseDir, `instance_${instanceId}`);

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    if (!session) {
      session = {
        id: instanceId,
        name: customName || `WhatsApp ${instanceId.slice(0, 6)}`,
        number: null,
        sock: null,
        qrCode: null,
        status: 'disconnected',
        sessionDir,
        isConnecting: false,
        lastSeen: null,
        libraryGroupJid: null,
        libraryGroupName: null,
      };
      this.sessions.set(instanceId, session);
    }

    // Garante que o grupo configurado no banco esteja sempre sincronizado em memória
    try {
      const dbInst = await prisma.whatsappInstance.findUnique({
        where: { id: instanceId },
        select: { libraryGroupJid: true, libraryGroupName: true }
      });
      if (dbInst) {
        session.libraryGroupJid = dbInst.libraryGroupJid || null;
        session.libraryGroupName = dbInst.libraryGroupName || null;
      }
    } catch {}

    if (session.isConnecting) return session;
    session.isConnecting = true;

    try {
      const Baileys = await import('@whiskeysockets/baileys');
      const makeWASocket = Baileys.makeWASocket || Baileys.default;
      const { DisconnectReason, fetchLatestBaileysVersion } = Baileys;
      const pinoModule = await import('pino');
      const pino = (pinoModule as any).default || pinoModule;

      // Persistência no SQLite (Prisma) com migração automática dos JSONs legados de sessionDir ou legacyDir
      const legacyDir = path.join(process.cwd(), 'baileys_session');
      const fallbackDir = fs.existsSync(sessionDir) ? sessionDir : legacyDir;
      const { state, saveCreds } = await usePrismaAuthState(instanceId, fallbackDir);
      let version: [number, number, number] = [2, 3000, 1015901307];
      try {
        const v = await fetchLatestBaileysVersion();
        if (v?.version) version = v.version;
      } catch {
        // Fallback offline
      }

      // Anti-Ban: Realistic Chrome User-Agent dinâmico
      const maskCfg = await this.loadMaskingConfig();
      const browserAgent: [string, string, string] = (maskCfg.enabled && maskCfg.browserFingerprint)
        ? ['Chrome (Windows)', 'Chrome', '128.0.6613.120']
        : ['Chrome', 'Chrome', '125.0.6422.112'];

      session.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: browserAgent,
        logger: pino({ level: 'silent' }),
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });

      session.sock.ev.on('creds.update', saveCreds);

      session.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          session!.qrCode = qr;
          session!.status = 'waiting_qr';
          console.log(`[Baileys][${session!.id}] QR Code gerado para pareamento.`);
          await prisma.whatsappInstance.update({
            where: { id: session!.id },
            data: { status: 'waiting_qr', qrCode: qr }
          }).catch(() => {});
        }

        if (connection === 'open') {
          session!.status = 'connected';
          session!.qrCode = null;
          session!.isConnecting = false;
          session!.lastSeen = new Date();

          const rawNumber = session!.sock?.user?.id?.split(':')[0]?.split('@')[0] || null;
          session!.number = rawNumber;

          console.log(`[Baileys][${session!.id}] Conectado e autenticado! Número: ${rawNumber || 'identificando...'}`);

          await prisma.whatsappInstance.update({
            where: { id: session!.id },
            data: {
              status: 'connected',
              qrCode: null,
              number: rawNumber || undefined,
              lastSeen: new Date()
            }
          }).catch(() => {});

          // Auto-inclusão autônoma no grupo central de mídias (compartilhado entre 2 até 8 números)
          // Delay de 5s: aguarda o socket estabilizar completamente antes de tentar entrar no grupo.
          // Crítico em reconexões com código 515 (restart required), onde o flood de histórico
          // (potencialmente milhares de mensagens) pode impedir o ACK do groupAcceptInvite.
          // 5s (em vez de 3s) reduz a janela de race condition quando múltiplos aparelhos
          // conectam quase ao mesmo tempo (restart do container, por exemplo).
          setTimeout(() => {
            this.ensureInstanceInLibraryGroup(session!).catch(err => {
              console.error(`[Baileys][AutoGroup][${session!.id}] Erro ao sincronizar com grupo central:`, err?.message || err);
            });
          }, 5000);

          if (this.onConnected) {
            try {
              this.onConnected(session!.id);
            } catch (err) {
              console.error(`[Baileys][${session!.id}] Erro no callback onConnected:`, err);
            }
          }
        }

        if (connection === 'close') {
          session!.isConnecting = false;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          session!.status = shouldReconnect ? 'reconnecting' : 'disconnected';
          console.log(`[Baileys][${session!.id}] Conexão encerrada (código: ${statusCode}). Reconectar: ${shouldReconnect}`);

          await prisma.whatsappInstance.update({
            where: { id: session!.id },
            data: {
              status: session!.status,
              qrCode: null
            }
          }).catch(() => {});

          if (shouldReconnect) {
            if (session!.reconnectTimeout) clearTimeout(session!.reconnectTimeout);
            session!.reconnectTimeout = setTimeout(() => {
              this.connectInstance(session!.id).catch(() => {});
            }, 5000);
          } else {
            session!.qrCode = null;
          }
        }
      });

      // ── Incoming Messages Listener ──────────────────────────────────────────
      session.sock.ev.on('messages.upsert', async (chatUpdate: any) => {
        try {
          for (const msg of chatUpdate.messages || []) {
            if (!msg.message) continue;
            const remoteJid = msg.key.remoteJid || '';

            // ── Captura de mídia do grupo de biblioteca (por aparelho ou global) ─
            // Permite tanto notify quanto append, e NÃO descarta fromMe (permite que o próprio bot/dono envie no grupo)
            if (remoteJid.endsWith('@g.us')) {
              await this.processMessageForLibrary(session!, msg);
              continue; // Não processa mensagens de grupo no chatbot de clientes
            }

            // ── Chatbot: apenas mensagens individuais recebidas de clientes ─
            if (chatUpdate.type !== 'notify') continue;
            if (msg.key.fromMe) continue;
            if (remoteJid.includes('@g.us')) continue;

            // ── Anti-Ban: Simulação de Leitura Humana (Blue Ticks com delay) ─
            this.loadMaskingConfig().then(cfg => {
              if (cfg.enabled && cfg.simulateReading) {
                this.simulateReading(session!, remoteJid, msg.key).catch(() => {});
              }
            }).catch(() => {});

            const text =
              msg.message.conversation ||
              msg.message.extendedTextMessage?.text ||
              msg.message.buttonsResponseMessage?.selectedButtonId ||
              msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
              '';

            const trimmed = text.trim();
            if (trimmed && this.onMessageReceived) {
              console.log(`[Baileys][${session!.id}] Mensagem de ${remoteJid}: "${trimmed.slice(0, 30)}"`);
              await this.onMessageReceived(session!.id, remoteJid, trimmed, msg.key);
            }
          }
        } catch (err) {
          console.error(`[Baileys][${session!.id}] Erro ao processar mensagem:`, err);
        }
      });

      // ── Sincronização de Histórico (captura mídias já enviadas recentemente) ────
      session.sock.ev.on('messaging-history.set', async (history: any) => {
        try {
          const messages = history?.messages || [];
          if (messages.length > 0) {
            console.log(`[Baileys][${session!.id}] Sincronizando histórico (${messages.length} mensagens)... Verificando mídias do grupo.`);
            for (const msg of messages) {
              if (msg?.key?.remoteJid?.endsWith('@g.us')) {
                await this.processMessageForLibrary(session!, msg);
              }
            }
          }
        } catch (err) {
          console.error(`[Baileys][${session!.id}] Erro ao ler histórico:`, err);
        }
      });

    } catch (err: any) {
      session.status = 'error';
      session.isConnecting = false;
      console.error(`[Baileys][${session.id}] Erro na inicialização:`, err?.message || err);
      await prisma.whatsappInstance.update({
        where: { id: session.id },
        data: { status: 'error' }
      }).catch(() => {});
    }

    return session;
  }

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────

  /**
   * Encerramento gracioso obrigatório:
   * 1. Finaliza WebSocket via sock.end() / sock.logout()
   * 2. Remove todos os listeners
   * 3. Aguarda confirmação antes de alterar status ou apagar sessão
   */
  public async gracefulShutdown(instanceId: string, deleteData = false): Promise<void> {
    const session = this.sessions.get(instanceId);
    if (!session) return;

    console.log(`[Baileys][${instanceId}] Iniciando Graceful Shutdown (deleteData: ${deleteData})...`);
    if (session.reconnectTimeout) {
      clearTimeout(session.reconnectTimeout);
      session.reconnectTimeout = undefined;
    }

    session.status = 'disconnected';
    session.qrCode = null;
    session.isConnecting = false;

    if (session.sock) {
      try {
        if (deleteData) {
          await session.sock.logout().catch(() => {});
        }
        session.sock.end(new Error('Graceful shutdown solicitado'));
      } catch (e) {
        // Ignora erros ao fechar socket
      }
      try {
        session.sock.ev?.removeAllListeners();
      } catch {}
      session.sock = null;
    }

    await sleep(500); // Aguarda liberação de handle do SO

    if (deleteData) {
      // Remove do banco de dados SQLite
      await prisma.baileysAuth.deleteMany({
        where: { instanceId }
      }).catch(() => {});

      if (fs.existsSync(session.sessionDir)) {
        try {
          fs.rmSync(session.sessionDir, { recursive: true, force: true });
        } catch {}
      }
      console.log(`[Baileys][${instanceId}] Dados de autenticação removidos com sucesso.`);
    }

    await prisma.whatsappInstance.update({
      where: { id: instanceId },
      data: { status: 'disconnected', qrCode: null }
    }).catch(() => {});

    if (deleteData) {
      this.sessions.delete(instanceId);
    }
  }

  /** Desconecta todas as instâncias ativas no desligamento da aplicação */
  public async shutdownAll(): Promise<void> {
    for (const id of this.sessions.keys()) {
      await this.gracefulShutdown(id, false);
    }
  }

  // ─── Selection & Round-Robin ────────────────────────────────────────────────

  private isSocketReady(session?: BaileysSessionInstance): boolean {
    if (!session || !session.sock) return false;
    return session.status === 'connected' && Boolean(session.sock.user);
  }

  /**
   * Obtém a sessão correta considerando Session Pinning ou Round-Robin
   */
  public getSession(pinnedInstanceId?: string): BaileysSessionInstance | null {
    // 1. Se houver Session Pinning estrito
    if (pinnedInstanceId) {
      const pinned = this.sessions.get(pinnedInstanceId);
      if (pinned && this.isSocketReady(pinned)) {
        return pinned;
      }
      console.warn(`[BaileysManager] Instância fixada ${pinnedInstanceId} não está pronta. Buscando alternativa...`);
    }

    // 2. Coleta todas as instâncias conectadas e prontas
    const readySessions = Array.from(this.sessions.values()).filter(s => this.isSocketReady(s));
    if (readySessions.length === 0) {
      return null;
    }

    // 3. Balanceamento Round-Robin
    const selected = readySessions[this.roundRobinIndex % readySessions.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % readySessions.length;
    return selected;
  }

  /** Lista todos os números de telefone online conectados */
  public getOnlineNumbers(): string[] {
    const list: string[] = [];
    for (const s of this.sessions.values()) {
      if (this.isSocketReady(s) && s.number) {
        list.push(s.number);
      }
    }
    return list;
  }

  /** Lista todas as sessões registradas em memória */
  public getAllSessions(): BaileysSessionInstance[] {
    return Array.from(this.sessions.values());
  }

  // ─── Masking Simulation ─────────────────────────────────────────────────────

  private async loadMaskingConfig(): Promise<MaskingConfig> {
    try {
      const rows = await prisma.systemConfig.findMany({
        where: { key: { startsWith: 'BAILEYS_MASK_' } }
      });
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;

      this.maskingConfig = {
        enabled: map['BAILEYS_MASK_ENABLED'] === 'true',
        browserFingerprint: map['BAILEYS_MASK_BROWSER'] !== 'false',
        simulateTyping: map['BAILEYS_MASK_TYPING'] !== 'false',
        simulateReading: map['BAILEYS_MASK_READING'] !== 'false',
        simulateReceipt: map['BAILEYS_MASK_RECEIPT'] !== 'false',
        typingDelayBetweenChunks: map['BAILEYS_MASK_CHUNKS'] !== 'false',
        standbyEnabled: map['BAILEYS_MASK_STANDBY'] === 'true',
        standbyMinSeconds: parseInt(map['BAILEYS_MASK_STANDBY_MIN'] || '30'),
        standbyMaxSeconds: parseInt(map['BAILEYS_MASK_STANDBY_MAX'] || '180'),
        typingCancelSimulation: map['BAILEYS_MASK_TYPING_CANCEL'] !== 'false',
      };
      this.maskingConfigLoaded = true;
    } catch {}
    return this.maskingConfig;
  }

  public async saveMaskingConfig(config: Partial<MaskingConfig>): Promise<void> {
    const entries: Array<{ key: string; value: string }> = [];
    if (config.enabled !== undefined) entries.push({ key: 'BAILEYS_MASK_ENABLED', value: String(config.enabled) });
    if (config.browserFingerprint !== undefined) entries.push({ key: 'BAILEYS_MASK_BROWSER', value: String(config.browserFingerprint) });
    if (config.simulateTyping !== undefined) entries.push({ key: 'BAILEYS_MASK_TYPING', value: String(config.simulateTyping) });
    if (config.simulateReading !== undefined) entries.push({ key: 'BAILEYS_MASK_READING', value: String(config.simulateReading) });
    if (config.simulateReceipt !== undefined) entries.push({ key: 'BAILEYS_MASK_RECEIPT', value: String(config.simulateReceipt) });
    if (config.typingDelayBetweenChunks !== undefined) entries.push({ key: 'BAILEYS_MASK_CHUNKS', value: String(config.typingDelayBetweenChunks) });
    if (config.standbyEnabled !== undefined) entries.push({ key: 'BAILEYS_MASK_STANDBY', value: String(config.standbyEnabled) });
    if (config.standbyMinSeconds !== undefined) entries.push({ key: 'BAILEYS_MASK_STANDBY_MIN', value: String(config.standbyMinSeconds) });
    if (config.standbyMaxSeconds !== undefined) entries.push({ key: 'BAILEYS_MASK_STANDBY_MAX', value: String(config.standbyMaxSeconds) });
    if (config.typingCancelSimulation !== undefined) entries.push({ key: 'BAILEYS_MASK_TYPING_CANCEL', value: String(config.typingCancelSimulation) });

    await Promise.all(entries.map(({ key, value }) =>
      prisma.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } })
    ));
    this.maskingConfigLoaded = false;
  }

  public async getMaskingConfig(): Promise<MaskingConfig> {
    return this.loadMaskingConfig();
  }

  public async simulateReading(session: BaileysSessionInstance, remoteJid: string, messageKey: any): Promise<void> {
    const cfg = await this.loadMaskingConfig();
    if (!cfg.enabled || !cfg.simulateReading || !this.isSocketReady(session)) return;

    try {
      if (cfg.simulateReceipt) {
        await sleep(randomBetween(500, 2000));
      }
      await sleep(randomBetween(2000, 8000));
      await session.sock.readMessages([messageKey]);
    } catch {}
  }

  private async simulateTypingPresence(session: BaileysSessionInstance, jid: string, text: string, cfg: MaskingConfig): Promise<void> {
    if (!this.isSocketReady(session)) return;
    try {
      const duration = typingDuration(text);
      if (cfg.typingCancelSimulation) {
        await session.sock.sendPresenceUpdate('composing', jid);
        await sleep(randomBetween(600, 1500));
        await session.sock.sendPresenceUpdate('paused', jid);
        await sleep(randomBetween(400, 900));
        await session.sock.sendPresenceUpdate('composing', jid);
        await sleep(duration);
      } else {
        await session.sock.sendPresenceUpdate('composing', jid);
        await sleep(duration);
      }
      await session.sock.sendPresenceUpdate('paused', jid);
    } catch {}
  }

  // ─── JID Resolution (9º dígito Brasil) ──────────────────────────────────────

  private async resolveJid(session: BaileysSessionInstance, to: string): Promise<string> {
    let digits = to.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    digits = digits.replace(/@.+/, '');
    const defaultJid = `${digits}@s.whatsapp.net`;

    if (!session.sock) return defaultJid;
    const cleanJid = (j: string) => j.replace(/:\d+@/, '@');

    try {
      const check1 = await session.sock.onWhatsApp(digits);
      if (check1 && check1.length > 0 && check1[0]?.exists && check1[0]?.jid) {
        return cleanJid(check1[0].jid);
      }

      if (digits.startsWith('55') && digits.length === 13) {
        const ddd = digits.slice(2, 4);
        const without9 = `55${ddd}${digits.slice(5)}`;
        const checkWithout9 = await session.sock.onWhatsApp(without9);
        if (checkWithout9 && checkWithout9.length > 0 && checkWithout9[0]?.exists && checkWithout9[0]?.jid) {
          return cleanJid(checkWithout9[0].jid);
        }
      }

      if (digits.startsWith('55') && digits.length === 12) {
        const ddd = digits.slice(2, 4);
        const with9 = `55${ddd}9${digits.slice(4)}`;
        const checkWith9 = await session.sock.onWhatsApp(with9);
        if (checkWith9 && checkWith9.length > 0 && checkWith9[0]?.exists && checkWith9[0]?.jid) {
          return cleanJid(checkWith9[0].jid);
        }
      }
    } catch {}

    return defaultJid;
  }

  // ─── Public Send Implementation ─────────────────────────────────────────────

  async sendMessage(to: string, text: string, options?: SendMessageOptions): Promise<SendMessageResult> {
    const readySessions = Array.from(this.sessions.values()).filter(s => this.isSocketReady(s));
    if (readySessions.length === 0) {
      console.error(`[BaileysManager] Nenhum aparelho Baileys pronto para envio para ${to}.`);
      return { success: false, error: 'Nenhum aparelho WhatsApp conectado no momento' };
    }

    // Se houver sessão fixada válida, prioriza ela; senão usa Round-Robin entre os aparelhos conectados (2 até 8 números)
    let sessionPool: BaileysSessionInstance[] = [];
    if (options?.pinnedInstanceId) {
      const pinned = this.sessions.get(options.pinnedInstanceId);
      if (pinned && this.isSocketReady(pinned)) {
        sessionPool = [pinned, ...readySessions.filter(s => s.id !== pinned.id)];
      }
    }

    if (sessionPool.length === 0) {
      // Rotação Round-Robin circular perfeita
      const startIndex = this.roundRobinIndex % readySessions.length;
      this.roundRobinIndex = (this.roundRobinIndex + 1) % readySessions.length;
      sessionPool = [
        ...readySessions.slice(startIndex),
        ...readySessions.slice(0, startIndex)
      ];
    }

    let lastError: any = null;

    // Tenta enviar com as sessões disponíveis na ordem da rotação (com failover automático)
    for (const session of sessionPool) {
      try {
        const result = await this.sendViaSingleSession(session, to, text, options);
        if (result.success) {
          return result;
        }
        lastError = result.error;
      } catch (err: any) {
        lastError = err?.message || err;
        console.warn(`[BaileysManager] Falha de envio no aparelho ${session.name} (${session.number || session.id}): ${lastError}. Tentando próximo número da rotação...`);
      }
    }

    return { success: false, error: lastError || 'Falha ao enviar mensagem em todos os números disponíveis' };
  }

  private async sendViaSingleSession(session: BaileysSessionInstance, to: string, text: string, options?: SendMessageOptions): Promise<SendMessageResult> {
    const cfg = await this.loadMaskingConfig();
    const jid = await this.resolveJid(session, to);

    // Anti-burst cooldown: se uma mensagem acabou de ser enviada por este chip, aguarda um respiro natural
    const now = Date.now();
    const lastSent = session.lastSentTimestamp || 0;
    const timeSinceLastSend = now - lastSent;
    const minCooldown = cfg.enabled ? randomBetween(1500, 3000) : 400;
    if (timeSinceLastSend < minCooldown) {
      await sleep(minCooldown - timeSinceLastSend);
    }
    session.lastSentTimestamp = Date.now();

    const sendMediaIfPresent = async () => {
      // 1. Prioridade: Forward nativo da Biblioteca (sem re-upload, mesmo ID de mídia da Meta)
      if (options?.forwardLibraryId) {
        try {
          const libEntry = await prisma.mediaLibrary.findUnique({
            where: { id: options.forwardLibraryId }
          });
          if (libEntry) {
            const originalMsg = JSON.parse(libEntry.messageJson);
            const forwardContent = generateForwardMessageContent(originalMsg, false);
            await session.sock.relayMessage(jid, forwardContent, {});
            await sleep(1500);
            return; // forward concluído com sucesso
          }
          console.warn(`[Baileys][${session.id}] forwardLibraryId "${options.forwardLibraryId}" não encontrado. Tentando fallback de URL.`);
        } catch (fwdErr) {
          console.error(`[Baileys][${session.id}] Erro ao fazer forward da biblioteca:`, fwdErr);
        }
      }

      // 2. Fallback: Upload via URL pública
      if (options?.media?.url && options?.media?.type) {
        try {
          const msgPayload: any = { [options.media.type]: { url: options.media.url } };
          if (options.media.type === 'audio') {
            msgPayload.mimetype = 'audio/mp4';
          }
          await session.sock.sendMessage(jid, msgPayload);
          await sleep(1500);
        } catch (mediaErr) {
          console.error(`[Baileys][${session.id}] Erro ao enviar mídia para ${jid}:`, mediaErr);
        }
      }
    };

    // Immediate transactional send (credentials / vouchers / PIX)
    if (options?.skipStandby || !cfg.enabled) {
      if (cfg.enabled && cfg.simulateTyping) {
        try {
          await session.sock.sendPresenceUpdate('composing', jid);
          await sleep(randomBetween(800, 1500));
          await session.sock.sendPresenceUpdate('paused', jid);
        } catch {}
      }
      await sendMediaIfPresent();
      await session.sock.sendMessage(jid, { text });
      console.log(`[Baileys][${session.id}] Mensagem enviada com sucesso para ${jid} via aparelho ${session.name} (${session.number})`);
      this.incrementDailyCount(session.id);
      return { success: true, instanceId: session.id };
    }

    // Standby delay simulation
    if (cfg.standbyEnabled) {
      const delayMs = randomBetween(cfg.standbyMinSeconds * 1000, cfg.standbyMaxSeconds * 1000);
      await sleep(delayMs);
    }

    await sendMediaIfPresent();

    const chunks = cfg.typingDelayBetweenChunks ? splitIntoChunks(text) : [text];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (cfg.simulateTyping) {
        await this.simulateTypingPresence(session, jid, chunk, cfg);
      }
      await session.sock.sendMessage(jid, { text: chunk });
      if (i < chunks.length - 1) {
        await sleep(randomBetween(1200, 3500));
      }
    }

    this.incrementDailyCount(session.id);
    console.log(`[Baileys][${session.id}] Mensagem enviada com sucesso para ${jid} via aparelho ${session.name} (${session.number})`);
    return { success: true, instanceId: session.id };
  }

  async sendTemplate(
    to: string,
    templateName: string,
    _languageCode: string,
    components: any[],
    options?: SendMessageOptions
  ): Promise<SendMessageResult> {
    const params = extractParamsFromComponents(components);
    const builder = TEMPLATE_TEXTS[templateName];
    const text = builder ? builder(...params) : (params.length > 0 ? params.join('\n') : `Notificação: ${templateName}`);
    return this.sendMessage(to, text, options);
  }

  private incrementDailyCount(instanceId: string) {
    prisma.whatsappInstance.update({
      where: { id: instanceId },
      data: {
        dailyCount: { increment: 1 },
        lastSeen: new Date()
      }
    }).catch(() => {});
  }

  // ─── Status & QR Accessors ──────────────────────────────────────────────────

  getQrCode(instanceId?: string): string | null {
    if (instanceId) {
      return this.sessions.get(instanceId)?.qrCode || null;
    }
    // Retorna o primeiro que tiver QR esperando
    for (const s of this.sessions.values()) {
      if (s.qrCode) return s.qrCode;
    }
    return null;
  }

  getStatus(instanceId?: string): string {
    if (instanceId) {
      const s = this.sessions.get(instanceId);
      if (s?.sock?.user && s.status === 'reconnecting') return 'connected';
      return s?.status || 'disconnected';
    }
    // Se alguma estiver conectada, o provedor Baileys está ativo
    const anyConnected = Array.from(this.sessions.values()).some(s => this.isSocketReady(s));
    if (anyConnected) return 'connected';
    const anyQr = Array.from(this.sessions.values()).some(s => s.status === 'waiting_qr');
    if (anyQr) return 'waiting_qr';
    return 'disconnected';
  }

  async logout(instanceId?: string): Promise<void> {
    if (instanceId) {
      await this.gracefulShutdown(instanceId, true);
      return;
    }
    // Se não especificado, desconecta a primeira ou todas
    for (const id of this.sessions.keys()) {
      await this.gracefulShutdown(id, true);
    }
  }

  async restart(instanceId?: string): Promise<void> {
    if (instanceId) {
      await this.gracefulShutdown(instanceId, false);
      await this.connectInstance(instanceId);
      return;
    }
    for (const id of this.sessions.keys()) {
      await this.gracefulShutdown(id, false);
      await this.connectInstance(id);
    }
  }

  async getProfilePictureUrl(to: string, instanceId?: string): Promise<string | null> {
    const session = instanceId ? this.sessions.get(instanceId) : this.getSession();
    if (!session || !this.isSocketReady(session)) return null;

    try {
      const jid = await this.resolveJid(session, to);
      try {
        const url = await session.sock.profilePictureUrl(jid, 'image');
        if (url) return url;
      } catch {
        try {
          const previewUrl = await session.sock.profilePictureUrl(jid, 'preview');
          if (previewUrl) return previewUrl;
        } catch {}
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Busca em tempo real todos os grupos nos quais esta instância participa.
   * Executa groupFetchAllParticipating() nativo do Baileys no socket do aparelho.
   */
  async fetchInstanceGroups(instanceId: string): Promise<Array<{
    jid: string;
    subject: string;
    participantsCount: number;
    creation?: number;
    desc?: string;
  }>> {
    const session = this.sessions.get(instanceId);
    if (!session || !this.isSocketReady(session)) {
      throw new Error(`Aparelho "${session?.name || instanceId}" não está conectado ao WhatsApp. Conecte-o antes de consultar os grupos.`);
    }

    try {
      const rawGroups = await session.sock.groupFetchAllParticipating();
      const groupsList = Object.values(rawGroups || {}).map((g: any) => ({
        jid: g.id as string,
        subject: (g.subject as string) || 'Grupo sem nome',
        participantsCount: Array.isArray(g.participants) ? g.participants.length : 0,
        creation: g.creation as number | undefined,
        desc: g.desc ? g.desc.toString() : '',
      }));

      // Ordena alfabeticamente pelo nome do grupo
      groupsList.sort((a, b) => a.subject.localeCompare(b.subject, 'pt-BR', { sensitivity: 'base' }));
      return groupsList;
    } catch (err: any) {
      console.error(`[Baileys][${instanceId}] Erro ao buscar grupos participantes:`, err);
      throw new Error(`Falha ao ler grupos do WhatsApp: ${err.message || err}`);
    }
  }

  /**
   * Atualiza em memória o grupo de biblioteca desta instância
   */
  setInstanceLibraryGroup(instanceId: string, groupJid: string | null, groupName: string | null): void {
    const session = this.sessions.get(instanceId);
    if (session) {
      session.libraryGroupJid = groupJid;
      session.libraryGroupName = groupName;
    }
  }

  /**
   * Extrai mídia de forma robusta desembrulhando envelopes do WhatsApp
   * (ephemeralMessage, viewOnceMessage, viewOnceMessageV2, documentWithCaptionMessage)
   */
  private extractMediaInfo(rawMessage: any): { mediaType: string; innerMsg: any } | null {
    if (!rawMessage || typeof rawMessage !== 'object') return null;
    let msg = rawMessage;

    // Desempacota envelopes recursivamente
    for (let i = 0; i < 6; i++) {
      if (msg?.ephemeralMessage?.message) {
        msg = msg.ephemeralMessage.message;
        continue;
      }
      if (msg?.viewOnceMessage?.message) {
        msg = msg.viewOnceMessage.message;
        continue;
      }
      if (msg?.viewOnceMessageV2?.message) {
        msg = msg.viewOnceMessageV2.message;
        continue;
      }
      if (msg?.documentWithCaptionMessage?.message) {
        msg = msg.documentWithCaptionMessage.message;
        continue;
      }
      break;
    }

    if (msg.imageMessage) return { mediaType: 'image', innerMsg: msg.imageMessage };
    if (msg.videoMessage) return { mediaType: 'video', innerMsg: msg.videoMessage };
    if (msg.audioMessage) return { mediaType: 'audio', innerMsg: msg.audioMessage };
    if (msg.documentMessage) return { mediaType: 'document', innerMsg: msg.documentMessage };
    if (msg.stickerMessage) return { mediaType: 'image', innerMsg: msg.stickerMessage };

    return null;
  }

  /**
   * Processa uma mensagem vinda de grupo e salva na MediaLibrary se pertencer
   * ao grupo configurado nesta instância ou globalmente.
   * Não descarta msg.key.fromMe (permite que o próprio bot/dono envie a mídia no grupo).
   */
  private async processMessageForLibrary(session: BaileysSessionInstance, msg: any): Promise<boolean> {
    try {
      if (!msg || !msg.message) return false;
      const remoteJid = msg.key?.remoteJid || '';
      if (!remoteJid || !remoteJid.endsWith('@g.us')) return false;

      // 1. Identifica o JID do grupo desta instância
      let instanceGroupJid = session?.libraryGroupJid;
      if (!instanceGroupJid && session?.id) {
        const dbInst = await prisma.whatsappInstance.findUnique({
          where: { id: session.id },
          select: { libraryGroupJid: true, libraryGroupName: true }
        });
        if (dbInst?.libraryGroupJid) {
          session.libraryGroupJid = dbInst.libraryGroupJid;
          session.libraryGroupName = dbInst.libraryGroupName;
          instanceGroupJid = dbInst.libraryGroupJid;
        }
      }

      let isTargetGroup = Boolean(instanceGroupJid && remoteJid.toLowerCase() === instanceGroupJid.toLowerCase());

      // Fallback: Grupo global em SystemConfig
      if (!isTargetGroup) {
        const globalLibGroupJid = await prisma.systemConfig
          .findUnique({ where: { key: 'WHATSAPP_MEDIA_LIBRARY_GROUP' } })
          .then(r => r?.value || '');
        if (globalLibGroupJid && remoteJid.toLowerCase() === globalLibGroupJid.toLowerCase()) {
          isTargetGroup = true;
        }
      }

      if (!isTargetGroup) return false;

      // 2. Extrai mídia
      const mediaInfo = this.extractMediaInfo(msg.message);
      if (!mediaInfo) {
        console.log(`[Baileys][MediaLibrary] Mensagem recebida no grupo ${remoteJid} (sem mídia suportada). Chaves: ${Object.keys(msg.message || {})}`);
        return true; // Mensagem pertence ao grupo, mas é texto ou formato não de mídia
      }

      const { mediaType, innerMsg } = mediaInfo;
      const messageId = msg.key?.id || `msg-${Date.now()}`;

      // Evita duplicatas se a mesma mensagem já foi catalogada
      const existing = await prisma.mediaLibrary.findFirst({
        where: { messageId }
      });
      if (existing) {
        console.log(`[Baileys][MediaLibrary] Mídia [${messageId}] já existente na biblioteca. Ignorando.`);
        return true;
      }

      const caption =
        innerMsg?.caption ||
        innerMsg?.fileName ||
        `${mediaType.toUpperCase()} - ${new Date().toLocaleTimeString('pt-BR')}`;
      const mimeType = innerMsg?.mimetype || null;

      // Gera thumbnail base64 para preview imediato no painel
      let thumbnailUrl: string | null = null;
      if (innerMsg?.jpegThumbnail) {
        try {
          const buf = Buffer.from(innerMsg.jpegThumbnail);
          thumbnailUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
        } catch {}
      }

      await prisma.mediaLibrary.create({
        data: {
          caption,
          mediaType,
          mimeType,
          thumbnailUrl,
          messageJson: JSON.stringify(msg),
          sourceJid: remoteJid,
          messageId,
          instanceId: session?.id || null,
        }
      });

      const groupDisplayName = session?.libraryGroupName || remoteJid;
      console.log(`[Baileys][MediaLibrary] ✅ MÍDIA CATALOGADA COM SUCESSO! Tipo: ${mediaType} — "${caption}" (Grupo: ${groupDisplayName}, Aparelho: ${session?.name || session?.id})`);
      return true;
    } catch (err: any) {
      console.error(`[Baileys][MediaLibrary] Erro ao processar mensagem do grupo:`, err);
      return false;
    }
  }

  /**
   * Garante que um aparelho conectado (seja ele o 1º ou o 8º) esteja automaticamente
   * inserido no grupo central de mídias compartilhado.
   * Se não estiver, adiciona via admin ou ingressa via código de convite.
   */
  async ensureInstanceInLibraryGroup(session: BaileysSessionInstance): Promise<void> {
    if (!this.isSocketReady(session) || !session.sock || !session.number) return;

    try {
      // 1. Identifica o grupo central
      let targetGroupJid = session.libraryGroupJid;
      let targetGroupName = session.libraryGroupName;

      if (!targetGroupJid) {
        // Busca do fallback global ou de qualquer outra instância
        const globalGroup = await prisma.systemConfig.findUnique({
          where: { key: 'WHATSAPP_MEDIA_LIBRARY_GROUP' }
        });
        if (globalGroup?.value) {
          targetGroupJid = globalGroup.value;
          const anyInst = await prisma.whatsappInstance.findFirst({
            where: { libraryGroupJid: targetGroupJid },
            select: { libraryGroupName: true }
          });
          targetGroupName = anyInst?.libraryGroupName || 'Grupo Central';
        } else {
          // Busca de qualquer instância que já tenha grupo configurado
          const anyInst = await prisma.whatsappInstance.findFirst({
            where: { engine: 'baileys', libraryGroupJid: { not: null } },
            select: { libraryGroupJid: true, libraryGroupName: true }
          });
          if (anyInst?.libraryGroupJid) {
            targetGroupJid = anyInst.libraryGroupJid;
            targetGroupName = anyInst.libraryGroupName;
          }
        }
      }

      if (!targetGroupJid) {
        // Nenhum grupo configurado no sistema ainda
        return;
      }

      // Sincroniza somente em memória agora — salva no banco APENAS após confirmar ingresso
      session.libraryGroupJid = targetGroupJid;
      session.libraryGroupName = targetGroupName;

      const rawNumber = session.number.replace(/\D/g, '');
      const userJid = `${rawNumber}@s.whatsapp.net`;

      // 2. Verifica se o novo número já é participante do grupo
      let isAlreadyMember = false;
      let existingSessionInGroup: BaileysSessionInstance | null = null;
      let adminSessionInGroup: BaileysSessionInstance | null = null;

      for (const s of this.sessions.values()) {
        if (this.isSocketReady(s) && s.sock) {
          try {
            const metadata = await s.sock.groupMetadata(targetGroupJid);
            if (metadata && Array.isArray(metadata.participants)) {
              existingSessionInGroup = s;
              const hasUser = metadata.participants.some((p: any) => p.id.replace(/\D/g, '').includes(rawNumber));
              if (hasUser) {
                isAlreadyMember = true;
                break;
              }
              const currentSelfJid = s.sock.user?.id?.replace(/\D/g, '') || '';
              const selfParticipant = metadata.participants.find((p: any) => p.id.replace(/\D/g, '').includes(currentSelfJid));
              if (selfParticipant && (selfParticipant.admin === 'admin' || selfParticipant.admin === 'superadmin')) {
                adminSessionInGroup = s;
              }
            }
          } catch {}
        }
      }

      if (isAlreadyMember) {
        console.log(`[Baileys][AutoGroup] ✅ Aparelho ${session.name} (${rawNumber}) já é membro do grupo central "${targetGroupName || targetGroupJid}".`);
        // Confirma no banco e limpa qualquer erro anterior
        await prisma.whatsappInstance.update({
          where: { id: session.id },
          data: { libraryGroupJid: targetGroupJid, libraryGroupName: targetGroupName ?? null, groupJoinError: null }
        }).catch(() => {});
        return;
      }

      console.log(`[Baileys][AutoGroup] Aparelho ${session.name} (${rawNumber}) NÃO está no grupo central. Ingressando automaticamente...`);

      // Helper para confirmar ingresso no banco e limpar erro
      const confirmJoinInDb = async () => {
        await prisma.whatsappInstance.update({
          where: { id: session.id },
          data: { libraryGroupJid: targetGroupJid, libraryGroupName: targetGroupName ?? null, groupJoinError: null }
        }).catch(() => {});
      };

      // Helper para registrar falha de ingresso no banco
      const saveJoinErrorInDb = async (errorMsg: string) => {
        await prisma.whatsappInstance.update({
          where: { id: session.id },
          data: { groupJoinError: errorMsg }
        }).catch(() => {});
      };

      // 3. Método 1: Adição direta por uma sessão que seja administradora
      if (adminSessionInGroup) {
        try {
          console.log(`[Baileys][AutoGroup] Adicionando ${rawNumber} ao grupo via admin (${adminSessionInGroup.name})...`);
          await adminSessionInGroup.sock.groupParticipantsUpdate(targetGroupJid, [userJid], 'add');
          console.log(`[Baileys][AutoGroup] ✅ ${rawNumber} adicionado ao grupo central com sucesso via admin!`);
          await confirmJoinInDb();
          return;
        } catch (addErr: any) {
          console.warn(`[Baileys][AutoGroup] Falha ao adicionar via admin (${addErr?.message || addErr}). Tentando via convite...`);
        }
      }

      // 4. Método 2: Ingressar via código de convite com LOCK de serialização.
      // Problema original: múltiplas sessões conectando ao mesmo tempo obtêm o MESMO código
      // de convite e tentam usá-lo simultaneamente — apenas a primeira funciona, as demais
      // recebem 'not-authorized'. O lock garante que apenas uma sessão ingresse por vez.
      const doJoinWithLock = async (): Promise<void> => {
        let inviteCode: string | null = null;

        // Obtém código de convite de uma sessão já no grupo (admin obrigatório para groupInviteCode)
        const sessionsToTry = [...this.sessions.values()].filter(
          s => this.isSocketReady(s) && s.sock && s.id !== session.id
        );
        // Prioriza sessão admin, depois qualquer outra no grupo
        const orderedSessions = [
          ...(adminSessionInGroup ? [adminSessionInGroup] : []),
          ...(existingSessionInGroup && existingSessionInGroup !== adminSessionInGroup ? [existingSessionInGroup] : []),
          ...sessionsToTry.filter(s => s !== adminSessionInGroup && s !== existingSessionInGroup),
        ];

        for (const s of orderedSessions) {
          try {
            inviteCode = await s.sock.groupInviteCode(targetGroupJid);
            if (inviteCode) break;
          } catch {}
        }

        if (!inviteCode) {
          const msg = `Não foi possível obter o link de convite do grupo. Verifique se algum número conectado é administrador do grupo.`;
          console.warn(`[Baileys][AutoGroup] ${msg} (${rawNumber})`);
          await saveJoinErrorInDb(msg);
          return;
        }

        // Retry com backoff: até 3 tentativas com 5s de intervalo.
        // Necessário porque após reconexão código-515 o socket pode rejeitar groupAcceptInvite
        // enquanto ainda está processando a sincronização do histórico.
        let joined = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`[Baileys][AutoGroup] Aparelho ${session.name} entrando no grupo via código "${inviteCode}" (tentativa ${attempt}/3)...`);
            await session.sock.groupAcceptInvite(inviteCode);
            console.log(`[Baileys][AutoGroup] ✅ Aparelho ${session.name} (${rawNumber}) entrou no grupo central com sucesso via convite! (tentativa ${attempt})`);
            joined = true;
            break;
          } catch (inviteErr: any) {
            const errMsg = inviteErr?.message || String(inviteErr);
            console.warn(`[Baileys][AutoGroup] Tentativa ${attempt}/3 falhou para ${session.name}: ${errMsg}`);
            if (errMsg.includes('not-authorized')) {
              // O número foi banido/removido do grupo pelo WhatsApp — não adianta tentar mais
              const msg = `Número bloqueado pelo WhatsApp para ingressar no grupo automaticamente (not-authorized). Adicione manualmente o número ${rawNumber} ao grupo "${targetGroupName || targetGroupJid}" e reinicie a conexão.`;
              console.error(`[Baileys][AutoGroup] ❌ ${session.name}: ${msg}`);
              await saveJoinErrorInDb(msg);
              break;
            }
            if (attempt < 3) {
              await sleep(5000); // aguarda 5s antes da próxima tentativa
              // Re-gera o código de convite (o anterior pode ter sido consumido por outra sessão)
              for (const s of orderedSessions) {
                try {
                  const newCode = await s.sock.groupInviteCode(targetGroupJid);
                  if (newCode) { inviteCode = newCode; break; }
                } catch {}
              }
            }
          }
        }

        if (joined) {
          await confirmJoinInDb();
        } else {
          const msg = `Todas as tentativas de ingresso no grupo falharam para o número ${rawNumber}. Adicione manualmente ao grupo "${targetGroupName || targetGroupJid}" e reinicie a conexão.`;
          console.error(`[Baileys][AutoGroup] ❌ ${session.name}: ${msg}`);
          await saveJoinErrorInDb(msg);
        }
      };

      // Serializa usando lock por groupJid: se já há uma operação em andamento para o mesmo grupo,
      // aguarda ela terminar antes de iniciar a próxima (evita usar o mesmo código simultaneamente)
      const existingLock = this._groupJoinLock.get(targetGroupJid) ?? Promise.resolve();
      const newLock = existingLock.then(() => doJoinWithLock()).catch(() => {});
      this._groupJoinLock.set(targetGroupJid, newLock);
      // Limpa o lock após conclusão para não acumular memória
      newLock.finally(() => {
        if (this._groupJoinLock.get(targetGroupJid) === newLock) {
          this._groupJoinLock.delete(targetGroupJid);
        }
      });
      await newLock;

    } catch (err: any) {
      console.error(`[Baileys][AutoGroup] Erro ao sincronizar aparelho no grupo:`, err?.message || err);
    }
  }

  /**
   * Sincroniza todas as instâncias conectadas para o mesmo grupo central
   */
  async syncAllInstancesToGroup(groupJid: string, groupName: string): Promise<void> {
    for (const session of this.sessions.values()) {
      session.libraryGroupJid = groupJid;
      session.libraryGroupName = groupName;
      if (this.isSocketReady(session)) {
        this.ensureInstanceInLibraryGroup(session).catch(() => {});
      }
    }
  }
}
