# 🛡️ Segurança & Anti-Burla

> **← [Voltar ao Índice](./README.md)**

O MikroGestor implementa múltiplas camadas de segurança para proteger a receita do estabelecimento e garantir que apenas clientes pagantes (ou dentro do período de cortesia) usem a rede.

---

## Tela de Controle de Acesso

![Segurança e Controle de Acesso](../../docs/wiki/screenshots/09-seguranca.png)

O painel de segurança mostra:
- **Blacklist de MACs**: dispositivos permanentemente bloqueados
- **Blacklist de CPFs/Telefones**: identidades bloqueadas por inadimplência
- **Sessões ativas**: quem está online agora
- **Tentativas de burla**: MACs aleatórios, reuso de vouchers, múltiplos cadastros

---

## Sistema de Bloqueio Progressivo por Inadimplência

```
Cliente usa 15 minutos de cortesia
         │
         └─ Pagou? ──► ✅ Acesso liberado normalmente
         │
         └─ Não pagou? (timer expirou)
                  │
                  ▼
         1. Sessão Hotspot encerrada (API MikroTik)
         2. Usuário desabilitado no banco de dados
         3. MAC Address → ip-binding type=blocked no MikroTik
         4. CPF + Telefone → blacklist interna
```

**Resultado**: o cliente não consegue voltar à rede pelo mesmo Wi-Fi, mesmo que:
- Esqueça a rede e reconecte
- Ative "Endereço MAC aleatório" no celular (o CPF ainda identifica)
- Tente criar novo cadastro com telefone diferente mas mesmo CPF

---

## Anti-Burla por MAC Aleatório

O celular moderno permite gerar MACs aleatórios para dificultar rastreamento. O MikroGestor contorna isso verificando:

1. **Novo MAC aparece** tentando se cadastrar
2. Sistema verifica CPF/Telefone → está na blacklist?
3. **Sim** → rejeita cadastro (HTTP 403) **E** adiciona o novo MAC também à blacklist
4. O cliente continua bloqueado independente de quantos MACs gere

---

## Anti-Tethering (Compartilhamento)

O sistema impede que um cliente compartilhe a internet com outros dispositivos:

### Mecanismo 1: TTL Manipulation (Mangle)
```
/ip firewall mangle add chain=postrouting out-interface=bridge 
action=change-ttl new-ttl=set:1 
comment="MikroGestor: Anti-Tethering"
```

Todos os pacotes saem do MikroTik com TTL=1. Quando chegam ao celular, o kernel decrementa para 0. Se o cliente ativar Hotspot Pessoal, o celular não consegue repassar os pacotes (TTL=0 é descartado).

### Mecanismo 2: Shared-Users=1
No perfil Hotspot do RouterOS, `shared-users=1` limita a 1 dispositivo simultâneo por credencial.

---

## Isolamento de Tráfego Hotspot (IPv6 & FastTrack)

Para evitar que serviços populares como **Google, YouTube, WhatsApp e Telegram** escapem do Captive Portal antes da autenticação:

### 1. Desativação Obrigatória de IPv6
O Hotspot do MikroTik RouterOS opera **exclusivamente na pilha IPv4**. Dispositivos modernos priorizam IPv6 (*Happy Eyeballs*). Se o provedor/roteador entregar IPv6, esses apps saem diretamente pela WAN sem passar pelo Hotspot.
O provisionamento desativa o IPv6 globalmente no MikroTik:
```routeros
/ipv6 settings set disable-ipv6=yes
```

### 2. Desativação Obrigatória de FastTrack
Regras de FastTrack (`action=fasttrack-connection`) desviam pacotes de conexões ativas do kernel de firewall e das filas do Hotspot. O provisionamento desativa automaticamente o FastTrack no IPv4:
```routeros
/ip firewall filter disable [find action=fasttrack-connection]
```

---

## Walled Garden — Controle de Acesso Antes da Autenticação

O Walled Garden define o que o cliente pode acessar **antes** de pagar/se autenticar:

| Tipo | Configuração | Por quê |
|------|-------------|---------|
| HTTP (porta 80) | `*mikrogestor.com*` | Portal de cadastro e pagamento |
| HTTPS (porta 443) | IP exato da VPS | WhatsApp Web funciona antes de pagar (não liberamos) |

> [!WARNING]
> **NUNCA** adicione domínios de terceiros ao Walled Garden (Google Pay, Mercado Pago, WhatsApp). O cliente recebe 15 minutos de internet completa após se cadastrar — usa o app do **próprio banco** para pagar o PIX.

> [!CAUTION]
> No RouterOS v7, `dst-host` no `walled-garden/ip` **não aceita wildcards com asterisco** (fica `invalid: true`). Use o IP exato da VPS (`2.25.168.82`) e o domínio exato (`mikrogestor.com`, `www.mikrogestor.com`).

---

## Hardening da VPS & Firewall UFW

A infraestrutura do servidor VPS opera sob política estrita de negação (`default deny incoming`), minimizando a superfície de ataque e garantindo que serviços internos nunca fiquem expostos à internet:

### Política e Portas Liberadas
| Porta / Interface | Protocolo | Origem Permitida | Finalidade / Serviço |
|---|---|---|---|
| **22** | TCP | `0.0.0.0/0` | Acesso remoto administrativo SSH |
| **80** | TCP | `0.0.0.0/0` | Traefik Proxy (HTTP / Desafio Let's Encrypt) |
| **443** | TCP & UDP | `0.0.0.0/0` | Traefik Proxy (HTTPS e HTTP/3) |
| **8000** | TCP | `0.0.0.0/0` | Painel Administrativo Coolify |
| **6001** | TCP | `0.0.0.0/0` | Coolify Realtime WebSockets |
| **51820** | UDP | `0.0.0.0/0` | Túnel WireGuard (MikroTiks e Operadores) |
| **wg0** | Qualquer | `10.8.0.0/24` | Tráfego interno de controle WireGuard |
| **51821** | TCP | `172.16.0.0/12`, `127.0.0.1` | Daemon interno de controle WireGuard (`wg-manager`) |

> [!IMPORTANT]
> A porta de controle **51821** (`wg-manager`) é estritamente restrita à rede Docker interna e localhost. Tentativas de conexão a partir da internet pública são bloqueadas pelo firewall. Além disso, as rotas exigem autenticação via cabeçalho `X-WG-Secret`.

---

## Controle de Acesso Administrativo

O painel administrativo possui:
- **Autenticação com senha** (não exposta publicamente)
- **Sessão com JWT** (tokens de curta duração)
- **Rate limiting** nas rotas de API (proteção contra brute force)
- **Logs de acesso** com IP de origem registrado

---

## Relacionado

- [06 — Portal do Cliente (termos e cadastro)](./06-portal-cliente.md)
- [03 — Hotspot & Planos (anti-tethering)](./03-hotspot-planos.md)

---
*← [Anterior: VPN WireGuard](./08-vpn-wireguard.md) · [Próximo: FAQ →](./10-faq.md)*
