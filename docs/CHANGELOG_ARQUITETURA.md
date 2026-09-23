# MikroGestor — Changelog de Arquitetura

> Registro cronológico das evoluções significativas do sistema.

---

## v2.4 — Setembro 2026

### 🔐 Segurança: Autenticação OTP via WhatsApp + Tokens de Emergência Offline

- **OTP de 2 fatores obrigatório**: O login do painel exige código de 6 dígitos entregue via WhatsApp ao administrador. Sem WhatsApp ativo, o acesso é bloqueado automaticamente.
- **Tokens de Emergência Offline** (`EmergencyToken`): Pré-gerados pelo admin e postados no grupo privado de mídias do WhatsApp. Cada token é de uso único, com hash `scrypt`. Permite acesso total ao painel mesmo com todos os números WhatsApp desconectados (ataque de disconnecting).
- **Credenciais de admin**: O usuário/senha padrão (`admin/23`) foi **eliminado do sistema**. A criação de usuário inicial agora ocorre via `scripts/init-db.js` com senha customizada. A variável `ADMIN_PASSWORD` na `.env` define a senha usada no script de inicialização.
- **Proteção contra credential leak**: Endpoints de API retornam mensagens genéricas (`Usuário ou senha incorretos`) sem revelar se o usuário existe. Senhas nunca são retornadas nas respostas JSON.

### 📱 WhatsApp: Race Condition Corrigido + Aviso de Falha de Grupo

#### Problema corrigido: Race condition no ingresso automático do grupo

**Sintoma**: Quando múltiplos números WhatsApp conectavam simultaneamente (ex.: restart do container), todos obtinham o mesmo código de convite `groupInviteCode` e tentavam usá-lo ao mesmo tempo. Apenas o primeiro sucedia; os demais recebiam erro `not-authorized` do WhatsApp.

**Solução implementada** em `src/services/whatsapp-baileys.ts`:

1. **Lock de serialização** (`_groupJoinLock: Map<string, Promise<void>>`): As tentativas de ingresso são enfileiradas por `groupJid`. A segunda sessão aguarda a primeira terminar antes de solicitar um novo código de convite, garantindo que cada sessão use um código único.

2. **Delay aumentado**: O trigger de auto-ingresso passou de 3s para 5s após `connection === 'open'`, reduzindo a janela de corrida em reinicializações do container.

3. **Saída antecipada em `not-authorized`**: Quando o WhatsApp bloqueia um número de ingressar em um grupo (ex.: foi expulso anteriormente), o sistema detecta o erro e para imediatamente em vez de desperdiçar 3 tentativas.

4. **`libraryGroupJid` salvo somente após confirmação**: Antes, o JID era persistido no banco *antes* de ingressar, gerando dados falsos (banco dizia que estava no grupo mas não estava). Agora é salvo apenas após `groupAcceptInvite` ou `groupParticipantsUpdate` bem-sucedido.

#### Novo campo: `groupJoinError` no banco

O schema `WhatsappInstance` ganhou o campo `groupJoinError String?`. Ele:
- É `null` quando o número está corretamente no grupo.
- Recebe uma mensagem amigável quando o ingresso falha (ex.: `not-authorized`, sem código de convite disponível, todas tentativas esgotadas).
- É limpo automaticamente quando o número ingressa com sucesso ou já é membro do grupo.

#### Aviso visual no dashboard

O card de cada instância no painel `/dashboard/whatsapp` exibe um **banner amarelo** quando `groupJoinError !== null`:
- Ícone `⚠️` + título "Falha ao ingressar no grupo"
- Mensagem explicativa com o motivo específico
- Botão **"Tentar novamente (reiniciar)"** que reinicia o socket da instância

Quando o usuário adiciona o número manualmente ao grupo no WhatsApp e reinicia, o banner some automaticamente.

---

## v2.3 — Agosto 2026

### 🌐 Subdomínio Dedicado & SSL Automático por Roteador

- **DNS Wildcard**: Registro `* → VPS_PUBLIC_IP` no Hostinger/Cloudflare permite que qualquer roteador (`<slug>.mikrogestor.com`) resolva instantaneamente para a VPS.
- **Traefik Dynamic Configuration**: O daemon `wg-manager` cria `/data/coolify/proxy/dynamic/router-<slug>.yaml` para cada roteador conectado via VPN, configurando proxy reverso HTTPS com Let's Encrypt.
- **Renovação Automática SSL no MikroTik**: Script `/system scheduler` configurado no MikroTik baixa e importa o certificado a cada 15 dias via `/tool fetch` da rota `/api/vpn/router/<id>/cert-file`.

### 📶 WireGuard VPN: Split-Tunnel & Peers Administrativos

- **Split-Tunnel Obrigatório**: `AllowedIPs = 10.8.0.0/24` nos peers MikroTik (nunca `0.0.0.0/0`).
- **Peers Administrativos**: O painel `/dashboard/vpn` gera peers para operadores Windows/Mobile com QR Code para download imediato do `.conf`.
- **Acesso Winbox via VPN**: Com túnel ativo, o Winbox conecta diretamente no IP VPN do MikroTik (`10.8.0.X:8291`) sem AnyDesk.

---

## v2.3 — Setembro 2026

### 🛡️ Isolamento de Tráfego Hotspot (Anti-Bypass IPv6 & FastTrack)

- **Desativação Global de IPv6 (`/ipv6 settings set disable-ipv6=yes`)**: O Hotspot do RouterOS é 100% IPv4. Serviços como Google, YouTube, WhatsApp e Telegram utilizam preferencialmente IPv6 (*Happy Eyeballs* RFC 8305). Ao desativar o IPv6 no roteador, elimina-se o bypass de tráfego, forçando 100% dos fluxos através do Captive Portal IPv4.
- **Desativação de FastTrack (`action=fasttrack-connection`)**: Regras de FastTrack no IPv4 desviam pacotes de sessões estabelecidas do firewall e das regras do Hotspot. O provisionamento automatizado agora localiza e desativa todas as regras de FastTrack no roteador.
- **Correção Walled Garden Subdomínio Local**: Remoção do subdomínio local de `walled-garden/ip` para evitar interceptação indevida de HTTPS pelo WebFig (porta 443) em vez do servlet do Hotspot.
- **Hardening do Firewall UFW na VPS**: Ativação do firewall com política `default deny incoming` e `default allow routed`. Portas públicas restritas ao essencial (22, 80, 443 tcp/udp, 8000, 6001, 51820/udp), com isolamento estrito da porta 51821 (`wg-manager`) para permitir tráfego unicamente de containers Docker (`172.16.0.0/12`) e localhost.

---

## v2.2 — Julho 2026

### 🔒 Segurança de Hotspot: Anti-Tethering & Bloqueio de Inadimplentes

- **Anti-Tethering via Mangle TTL**: Regra `change-ttl new-ttl=set:1` no `chain=postrouting` impede compartilhamento da conexão via hotspot pessoal.
- **Bloqueio por MAC + CPF/Telefone**: Clientes que não pagam dentro de 15 minutos são bloqueados via `/ip/hotspot/ip-binding type=blocked`. Novos cadastros com mesmo CPF/telefone são rejeitados mesmo com MAC diferente.
- **Walled Garden Ultra Restrito**: Libera exclusivamente domínios do MikroGestor. Proibido incluir Mercado Pago, Google ou qualquer terceiro.

---

## v2.1 — Junho 2026

### 🛠 Patch RouterOS v7 (`!empty` replies)

- **Dupla proteção**:
  1. **Build-time**: `scripts/patch-routeros.js` via `postinstall` modifica `node-routeros/dist/Channel.js`.
  2. **Runtime**: Monkey-patch em `src/lib/routeros.ts` (linhas 5-33) intercepta `Channel.prototype.processPacket` e retorna `[]` quando `reply === '!empty'`.
- **NUNCA remova o bloco de patch em `src/lib/routeros.ts`.**

---

## v2.0 — Maio 2026

### 🏗 Migração para Coolify + SQLite Persistente

- **Volume obrigatório**: `/data/mikrogestor/prisma` (host) → `/app/prisma` (container).
- **Persistência Baileys**: Credenciais no SQLite via `BaileysAuth`, nunca em arquivos JSON em disco.
- **`npx prisma db push --accept-data-loss`** no start do container para sync automático de schema sem bloqueio interativo.
