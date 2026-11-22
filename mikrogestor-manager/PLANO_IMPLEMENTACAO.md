# MikroGestor Manager — Plano de Implementação

> Aplicativo mobile de gestão completa do ecossistema MikroGestor.  
> Versão alvo: **1.0.0** | Plataformas: Android & iOS | Framework: **React Native (Expo)**

---

## 1. Visão Geral

O **MikroGestor Manager** é o painel de controle mobile do operador de rede. Ele se comunica exclusivamente com a API REST da VPS (`https://mikrogestor.com`) e, via WireGuard, opcionalmente com os roteadores MikroTik diretamente.

### Objetivos Principais
| # | Funcionalidade | Prioridade |
|---|---------------|-----------|
| 1 | Status de conectividade (VPN + Hotspot) | P0 |
| 2 | Desbloqueio de clientes bloqueados (cortesia 15min) | P0 |
| 3 | Visualização de clientes ativos / inadimplentes | P0 |
| 4 | Monitor de tráfego / velocidade em tempo real | P1 |
| 5 | Saúde do RouterBoard (CPU, RAM, temp, uptime) | P1 |
| 6 | CMS completo (planos, templates portal, WhatsApp) | P2 |
| 7 | Notificações push (novo cliente, pagamento, bloqueio) | P2 |

---

## 2. Stack Técnica

```
Framework:   React Native + Expo (SDK 52+)
Navegação:   Expo Router (file-based, como Next.js)
UI:          NativeWind (Tailwind para RN) + React Native Paper
Estado:      Zustand + React Query (TanStack Query v5)
Websocket:   Socket.io-client (para tráfego em tempo real)
Gráficos:    Victory Native XL
Push:        Expo Notifications + OneSignal
Auth:        JWT (Bearer Token via API /api/auth/login)
Build:       EAS Build (Android APK / iOS IPA)
```

---

## 3. Arquitetura de Comunicação

```
┌─────────────────────────────────────────────────────────┐
│                  MikroGestor Manager App                 │
│                   (React Native / Expo)                  │
└─────────────┬───────────────────────────────────────────┘
              │ HTTPS REST + Bearer JWT
              ▼
┌─────────────────────────────────────────────────────────┐
│          API VPS  (https://mikrogestor.com)              │
│          Next.js — porta 80 (nunca 3000)                │
│                                                         │
│  /api/auth/login          /api/portal/check-expirations │
│  /api/dashboard/stats     /api/portal/admin/blacklist   │
│  /api/traffic             /api/portal/admin/leads       │
│  /api/hotspot/users       /api/portal/admin/approve-pix │
│  /api/vpn/status          /api/system/routers           │
│  /api/whatsapp/status     /api/whatsapp-plans           │
└─────────────────────────────────────────────────────────┘
              │ WireGuard 10.8.0.0/24 (Acesso Direto)
              ▼
┌─────────────────────────────────────────────────────────┐
│         MikroTik RouterBoard (10.8.0.2)                 │
│         RouterOS v7 — API 8728 (via VPS proxy)          │
└─────────────────────────────────────────────────────────┘
```

> **Nota de Segurança:** O app nunca se conecta diretamente na API RouterOS 8728. Toda comunicação com o MikroTik passa pelo proxy seguro da VPS (que usa o WireGuard + autenticação JWT). Isso evita expor credenciais do roteador no app.

---

## 4. Mapa de Telas

### 4.1 Fluxo de Autenticação
```
Splash → Login (usuário/senha admin) → Dashboard Principal
                ↓
        OTP (opcional, se habilitado em /api/auth/otp)
```

### 4.2 Navegação Principal (Tab Bar)
```
[ Dashboard ] [ Clientes ] [ Rede ] [ CMS ] [ Config ]
```

---

## 5. Telas Detalhadas

### 5.1 Dashboard (Home)
**Rota API:** `GET /api/dashboard/stats`

**Widgets:**
- 🟢/🔴 **Status da Conexão VPN** — Ping para `10.8.0.2`, resultado em ms
- 📊 **Clientes Ativos** — Total conectados no Hotspot agora
- 🚫 **Clientes Bloqueados** — Aguardando desbloqueio (cortesia expirada)
- 💰 **Receita Hoje** — Total aprovado no dia (MP Webhook)
- ⚡ **Tráfego Total** — Upload + Download acumulado do dia
- 🔔 **Alertas Recentes** — Feed das últimas 5 ações (bloqueio, pagamento, etc.)

**Atualização:** Auto-refresh a cada 30 segundos via React Query `refetchInterval`.

---

### 5.2 Clientes Ativos
**Rota API:** `GET /api/hotspot/users` + `GET /api/portal/admin/leads`

**Lista com:**
- Nome, MAC address, IP atual
- Tempo online / tempo restante no plano
- Velocidade atual (↑ upload / ↓ download)
- Status: `ativo` | `bloqueado` | `expirado`

**Ações por cliente (swipe ou botão):**
- 👁 Ver detalhes completos
- 🔓 **Desbloquear** (cliente bloqueado)
- ❌ Kickar sessão ativa
- 💬 Enviar WhatsApp manual

---

### 5.3 Tela de Desbloqueio (P0 — Funcionalidade Crítica)
**Rota API:** `POST /api/portal/admin/approve-pix` ou endpoint dedicado

**Fluxo:**
1. Badge vermelho no ícone de Clientes indica quantidade de bloqueados
2. Tela "Clientes Bloqueados" lista MAC + Nome + Horário de bloqueio
3. Botão **[🔓 Desbloquear]** por cliente
4. Confirmação: `"Desbloquear LYNCOLN e recriar acesso no MikroTik?"`
5. App chama API → API remove IP-Binding `type=blocked`, recria usuário Hotspot, envia WhatsApp com link de auto-login
6. Toast de confirmação: `"Cliente desbloqueado com sucesso!"`

**Dessbloqueio em Lote:** Checkbox para selecionar múltiplos + botão "Desbloquear Todos".

**Payload para desbloqueio manual pelo app:**
```json
POST /api/portal/admin/approve-pix
{
  "paymentId": "<uuid>",
  "manualOverride": true,
  "operatorNote": "Desbloqueado pelo app manager"
}
```

> **Nota:** Precisará de um novo endpoint dedicado `POST /api/manager/unblock-client` que aceite `{ mac: string, routerId: string }` para desbloqueio direto sem necessidade de paymentId.

---

### 5.4 Monitor de Tráfego / Velocidade
**Rota API:** `GET /api/traffic`

**Visualizações:**
- 📈 Gráfico de linha em tempo real (Victory Native) — TX/RX dos últimos 60 segundos
- 🏎️ Velocidade atual por interface (ether1, wlan1, wg0)
- 📦 Bytes totais transferidos (session e acumulado)
- Top 5 Clientes por consumo de banda

**Atualização:** Polling a cada 5 segundos (Victory Native XL suporta animação suave).

**Dados coletados via RouterOS:**
```
/interface/monitor-traffic (via API proxy da VPS)
```

---

### 5.5 Saúde do RouterBoard
**Rota API:** `GET /api/system/network` + proxy para RouterOS `/system/health`

**Métricas exibidas:**
| Métrica | Fonte RouterOS |
|---------|---------------|
| CPU % | `/system/resource` → `cpu-load` |
| RAM Livre | `/system/resource` → `free-memory` |
| Temperatura | `/system/health` → `temperature` |
| Tensão | `/system/health` → `voltage` |
| Uptime | `/system/resource` → `uptime` |
| Versão RouterOS | `/system/resource` → `version` |
| Modelo do Board | `/system/routerboard` → `model` |
| Número de série | `/system/routerboard` → `serial-number` |

**Visual:** Cards com indicadores coloridos (verde/amarelo/vermelho baseado em thresholds).

**Thresholds sugeridos:**
- CPU > 80% → ⚠️ Amarelo; > 95% → 🔴 Crítico
- RAM livre < 20MB → ⚠️ Amarelo; < 10MB → 🔴 Crítico
- Temperatura > 65°C → ⚠️ Amarelo; > 80°C → 🔴 Crítico

---

### 5.6 CMS Manager

#### 5.6.1 Planos de Acesso
**Rota API:** `GET/POST/PUT/DELETE /api/whatsapp-plans`

- Listar planos existentes
- Criar novo plano (nome, preço, duração em minutos/horas/dias)
- Editar preço e duração
- Ativar / Desativar plano

#### 5.6.2 Templates de Mensagem WhatsApp
**Rota API:** `GET/PUT /api/admin/whatsapp-messages`

- Visualizar templates: Boas-vindas, Pagamento Aprovado, Bloqueio, Expiração
- Editar texto com tags disponíveis: `{nome}`, `{usuario}`, `{senha}`, `{link_autologin}`, `{plano}`, `{tempo}`
- Preview da mensagem antes de salvar

#### 5.6.3 Configuração do Portal Hotspot
**Rota API:** `GET/PUT /api/portal/config`

- Nome do Wi-Fi exibido no portal
- Logo e cores (upload de imagem)
- Texto de boas-vindas
- Habilitar/desabilitar campos do cadastro (CPF, telefone, e-mail)

#### 5.6.4 Leads / Cadastros
**Rota API:** `GET /api/portal/admin/leads` + `GET /api/dashboard/leads`

- Lista completa de leads cadastrados
- Filtros: data, status de pagamento, plano
- Exportar CSV

---

### 5.7 Configurações do App
- URL base da API (configurável para multi-tenant)
- Token de autenticação / re-login
- Notificações push (habilitar/desabilitar por tipo)
- Tema: Claro / Escuro
- Versão do app e informações de suporte

---

## 6. Endpoints a Criar no Backend (Novos)

Os seguintes endpoints precisam ser criados em `src/app/api/manager/` para suportar o app:

### 6.1 `GET /api/manager/blocked-clients`
Retorna lista de clientes atualmente bloqueados no IP-Binding do MikroTik com `type=blocked`.
```json
Response: [
  {
    "mac": "9A:1E:3E:0D:8C:34",
    "ip": "192.168.88.253",
    "name": "Lyncoln Samuel",
    "phone": "+55...",
    "blockedAt": "2026-11-22T01:30:00Z",
    "paymentId": "ec8c588e...",
    "routerId": "router-fap"
  }
]
```

### 6.2 `POST /api/manager/unblock-client`
Desbloqueia um cliente diretamente pelo MAC, sem depender do fluxo de webhook.
```json
Request: { "mac": "9A:1E:3E:0D:8C:34", "routerId": "router-fap", "note": "Manual pelo app" }
Response: { "success": true, "autoLoginLink": "https://fap.mikrogestor.com/login?username=...&password=..." }
```

### 6.3 `GET /api/manager/router-health`
Proxy para `/system/resource` e `/system/health` do RouterOS.
```json
Response: {
  "cpu": 12,
  "freeMemory": 45678912,
  "totalMemory": 67108864,
  "temperature": 48.5,
  "voltage": 24.0,
  "uptime": "3d 2h 15m",
  "version": "7.14.3",
  "model": "RB941-2nD",
  "serial": "..."
}
```

### 6.4 `GET /api/manager/traffic-realtime`
Retorna snapshot atual de tráfego de todas as interfaces.
```json
Response: {
  "interfaces": [
    { "name": "ether1", "rxBps": 1234567, "txBps": 234567 },
    { "name": "wlan1",  "rxBps": 876543,  "txBps": 123456 }
  ],
  "topClients": [
    { "mac": "...", "name": "...", "rxBytes": 123456789, "txBytes": 23456789 }
  ],
  "timestamp": "2026-11-22T01:30:00Z"
}
```

### 6.5 `POST /api/manager/kick-client`
Derruba a sessão ativa de um cliente no Hotspot.
```json
Request: { "username": "lyncoln", "routerId": "router-fap" }
Response: { "success": true }
```

---

## 7. Autenticação e Segurança do App

```
1. POST /api/auth/login → { token: "JWT...", expiresIn: 86400 }
2. Token salvo no Expo SecureStore (nunca AsyncStorage)
3. Interceptor Axios adiciona header: Authorization: Bearer <token>
4. Refresh automático 5 minutos antes do vencimento
5. Em 401: redireciona para tela de Login
```

**Permissões necessárias do Android/iOS:**
- Internet (obrigatório)
- Notificações push
- Câmera (opcional — para escanear QR Code de roteador)

---

## 8. Notificações Push

**Disparadas pelo backend** via `OneSignal REST API` ou `Expo Push API`:

| Evento | Título | Corpo |
|--------|--------|-------|
| Cliente bloqueado | 🚫 Cliente Bloqueado | "Lyncoln foi bloqueado (15min). Toque para desbloquear." |
| Pagamento aprovado | ✅ Pagamento Recebido | "R$ 5,00 confirmado — Lyncoln desbloqueado." |
| Novo cadastro | 👤 Novo Cliente | "Lyncoln acabou de se cadastrar no portal." |
| CPU crítica | 🔴 Alerta RB | "CPU do FAP em 97%! Verifique." |
| Roteador offline | ⚠️ RB Offline | "fap.mikrogestor.com não responde via WireGuard." |

---

## 9. Fases de Implementação

### Fase 1 — MVP (2 semanas)
- [ ] Setup Expo + Expo Router + NativeWind
- [ ] Tela de Login + JWT auth + SecureStore
- [ ] Dashboard com stats básicos
- [ ] Lista de Clientes Bloqueados
- [ ] **Tela de Desbloqueio Manual** (funcionalidade P0)
- [ ] Criar endpoints `GET /api/manager/blocked-clients` e `POST /api/manager/unblock-client` no backend
- [ ] Build APK via EAS para Android

### Fase 2 — Monitor (1 semana)
- [ ] Monitor de Tráfego em tempo real (gráficos Victory Native)
- [ ] Saúde do RouterBoard (CPU, RAM, Temperatura)
- [ ] Criar endpoints `GET /api/manager/router-health` e `GET /api/manager/traffic-realtime`
- [ ] Kick de sessão ativa

### Fase 3 — CMS (2 semanas)
- [ ] Gestão de Planos (CRUD)
- [ ] Editor de Templates WhatsApp
- [ ] Configuração do Portal Hotspot (logo, cores, texto)
- [ ] Listagem e exportação de Leads

### Fase 4 — Notificações & Polimento (1 semana)
- [ ] Push Notifications (OneSignal ou Expo Push)
- [ ] Integração no backend para disparar notificações nos eventos
- [ ] Tema escuro
- [ ] Splash screen, ícone, nome "MikroGestor Manager"
- [ ] Publicação na Play Store (track interno/alpha)

---

## 10. Estrutura de Pastas do App

```
mikrogestor-manager/
├── app/                          # Expo Router (file-based routing)
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (tabs)/
│   │   ├── index.tsx             # Dashboard
│   │   ├── clients.tsx           # Clientes + Bloqueados
│   │   ├── network.tsx           # Tráfego + Saúde RB
│   │   ├── cms.tsx               # CMS Manager
│   │   └── settings.tsx          # Configurações
│   └── _layout.tsx
│
├── components/
│   ├── dashboard/
│   │   ├── StatsCard.tsx
│   │   ├── AlertFeed.tsx
│   │   └── ConnectionBadge.tsx
│   ├── clients/
│   │   ├── ClientListItem.tsx
│   │   ├── BlockedClientCard.tsx
│   │   └── UnblockModal.tsx      # Modal de confirmação de desbloqueio
│   ├── network/
│   │   ├── TrafficChart.tsx      # Victory Native XL
│   │   ├── RouterHealthCard.tsx
│   │   └── InterfaceRow.tsx
│   └── cms/
│       ├── PlanEditor.tsx
│       ├── TemplateEditor.tsx
│       └── LeadsTable.tsx
│
├── services/
│   ├── api.ts                    # Axios instance + interceptors
│   ├── auth.service.ts
│   ├── clients.service.ts
│   ├── network.service.ts
│   └── cms.service.ts
│
├── stores/
│   ├── auth.store.ts             # Zustand: token, user
│   └── app.store.ts              # Zustand: configs globais
│
├── hooks/
│   ├── useBlockedClients.ts      # React Query
│   ├── useRouterHealth.ts
│   ├── useTraffic.ts
│   └── useDashboardStats.ts
│
├── constants/
│   ├── api.ts                    # BASE_URL = https://mikrogestor.com
│   └── thresholds.ts             # CPU/RAM/Temp limits
│
├── app.json                      # Expo config
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 11. Configuração Inicial do Projeto

```bash
# Dentro de mikrogestor-manager/
npx create-expo-app@latest . --template blank-typescript
npx expo install expo-router expo-secure-store expo-notifications
npm install nativewind react-native-paper
npm install @tanstack/react-query zustand axios
npm install victory-native react-native-svg react-native-reanimated
npm install react-native-safe-area-context react-native-screens

# EAS CLI para build
npm install -g eas-cli
eas login
eas build:configure
```

---

## 12. Variáveis de Ambiente

```env
# mikrogestor-manager/.env
EXPO_PUBLIC_API_BASE_URL=https://mikrogestor.com
EXPO_PUBLIC_APP_NAME=MikroGestor Manager
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_ONESIGNAL_APP_ID=<id_aqui>
```

---

## 13. Referência Rápida: APIs do Backend Existentes

| Funcionalidade | Método | Endpoint |
|---------------|--------|---------|
| Login admin | POST | `/api/auth/login` |
| Stats dashboard | GET | `/api/dashboard/stats` |
| Leads | GET | `/api/dashboard/leads` |
| Clientes Hotspot | GET | `/api/hotspot/users` |
| Planos WA | GET/POST | `/api/whatsapp-plans` |
| Aprovar Pix (manual) | POST | `/api/portal/admin/approve-pix` |
| Blacklist / Bloqueados | GET | `/api/portal/admin/blacklist` |
| Tráfego | GET | `/api/traffic` |
| Status VPN | GET | `/api/vpn/status` |
| Status WhatsApp | GET | `/api/whatsapp/status` |
| Config Portal | GET/PUT | `/api/portal/config` |
| Msgs WhatsApp | GET/PUT | `/api/admin/whatsapp-messages` |
| Verificar expiração | GET | `/api/portal/check-expirations` |
| **[NOVO]** Bloqueados | GET | `/api/manager/blocked-clients` |
| **[NOVO]** Desbloquear | POST | `/api/manager/unblock-client` |
| **[NOVO]** Saúde RB | GET | `/api/manager/router-health` |
| **[NOVO]** Tráfego RT | GET | `/api/manager/traffic-realtime` |
| **[NOVO]** Kick cliente | POST | `/api/manager/kick-client` |

---

*Documento gerado em 22/11/2026 — Versão 1.0*  
*Próximo passo: implementar Fase 1 (MVP) iniciando pelos endpoints `/api/manager/` no backend.*
