# Arquitetura de Subdomínios Dedicados e SSL Automático no MikroGestor

Este documento descreve detalhadamente a arquitetura de provisionamento de **subdomínios dedicados** e **certificados SSL Let's Encrypt automatizados** para cada roteador MikroTik conectado à VPS MikroGestor via túnel WireGuard VPN.

---

## 1. O Problema Resolvido

No modo Hotspot do MikroTik com redirecionamento de captive portal:
1. **Telas Vermelhas de Alerta de Segurança (CNA / Navegadores)**: Quando um cliente tenta navegar em um site HTTPS antes do login, se o roteador responder com um certificado auto-assinado ou sem certificado, o navegador ou o assistente de conexão (CNA da Apple/Android) exibe tela vermelha de bloqueio/risco de segurança.
2. **Conflito de Domínio (Loop de Redirecionamento)**: Se o campo `dns-name` do Hotspot Profile for preenchido com o domínio principal do sistema (`mikrogestor.com`), o MikroTik intercepta todas as consultas DNS e aponta para `192.168.88.1`, impedindo que os clientes acessem o painel da VPS ou o portal de pagamento PIX.
3. **Falta de IP Público no Roteador**: Os MikroTiks dos clientes estão atrás de CGNAT ou links comuns de operadoras (sem IP público ou DDNS fixo).

---

## 2. A Solução Implementada

Para cada roteador criado (ex: `"mkroça"`):
1. **Geração do Slug e Subdomínio**: O nome é sanitizado para conformidade DNS RFC 1123 (ex: `"mkroça"` → `"mkroca"` → `mkroca.mikrogestor.com`).
2. **Apontamento Wildcard no DNS (Hostinger)**:
   - Registro `A` com `Host: *` e `Valor: 2.25.168.82` (IP da VPS).
   - Qualquer subdomínio existente ou futuro aponta instantaneamente para a VPS sem precisar criar registros manuais para cada roteador.
3. **Proxy Reverso Dinâmico no Traefik (Coolify) — Acesso Remoto WebFig**:
   - O daemon `wg-manager` cria um arquivo dinâmico em `/data/coolify/proxy/dynamic/router-<slug>.yaml`.
   - O Traefik v3 monitora essa pasta em tempo real (`watch: true`) e publica as rotas:
     - `https://<slug>.mikrogestor.com` → `http://<vpnIp>:80` (WebFig do MikroTik através do túnel WireGuard `10.8.0.0/24`).
     - `http://<slug>.mikrogestor.com` → `http://<vpnIp>:80`.
   - **Benefício**: Ao clicar no link do subdomínio dentro do painel MikroGestor, o administrador acessa diretamente a interface WebFig do MikroTik com certificado SSL Let's Encrypt autêntico e válido, sem precisar de IP público no cliente e sem expor portas na internet.
   - O Traefik gera o certificado Let's Encrypt automaticamente via desafio HTTP-01 e armazena em `/data/coolify/proxy/acme.json`.
4. **Extração do Certificado e Chave**:
   - O daemon `wg-manager` no host lê `/data/coolify/proxy/acme.json` e expõe `GET /cert/extract?domain=<subdomain>`.
   - O MikroGestor expõe o endpoint público `/api/vpn/router/[id]/cert-file?type=cert|key` (liberado no `middleware.ts`).
5. **Injeção e Auto-Renovação no MikroTik**:
   - O provisionamento e a sincronização via API WireGuard (`10.8.0.2:8728`) importam a cadeia completa (Full Chain) em `/certificate`, vinculam a `www-ssl` (porta 443) e atualizam o Hotspot Profile:
     - `dns-name: <slug>.mikrogestor.com`
     - `ssl-certificate: mg-ssl-<slug>`
     - `https: yes`
   - Um script agendador `/system scheduler add name=mg-renew-ssl interval=15d` atua como salvaguarda automática.
6. **Roteamento Split-DNS (Externo vs Interno LAN)**:
   - **Acesso Externo (Internet/Admin)**: `<slug>.mikrogestor.com` resolve via DNS público para a VPS (`2.25.168.82`), onde o Traefik faz proxy reverso via WireGuard para `http://<vpnIp>:80` (WebFig).
   - **Acesso Interno (Clientes Wi-Fi na LAN)**: O MikroTik possui `/ip/dns/static add name=<slug>.mikrogestor.com address=192.168.88.1`. Quando o cliente Wi-Fi acessa o subdomínio, conecta-se diretamente ao servidor local do MikroTik na LAN, validando o certificado Let's Encrypt instalado no `www-ssl`.
7. **Walled Garden Completo**:
   - Libera `*mikrogestor.com*` no Walled Garden HTTP.
   - Libera `mikrogestor.com`, `www.mikrogestor.com`, `<slug>.mikrogestor.com` e o IP `2.25.168.82` no Walled Garden IP (HTTPS porta 443).

---

## 3. Mecanismo de Redirecionamento Infalível do Captive Portal

Para que 100% dos smartphones e computadores (Android, iOS, Windows, macOS) detectem o Captive Portal instantaneamente sem travar em telas de erro ou manter o tráfego em redes móveis (4G/5G):

### 3.1 DNS Exclusivo no DHCP (Sem Vazamento)
- No DHCP Network (`/ip/dhcp-server/network`), o campo `dns-server` contém **apenas** o IP do MikroTik (`192.168.88.1`).
- Nunca inclua DNSs externos como `8.8.8.8` ou `1.1.1.1` na rede do Hotspot. Dispositivos com múltiplos DNSs tentam contornar a interceptação e quebram a abertura do portal.

### 3.2 Desativação de IPv6 e FastTrack
- **IPv6**: O Hotspot do RouterOS é estritamente IPv4. O IPv6 é desativado globalmente (`/ipv6 settings set disable-ipv6=yes`) para impedir que navegadores usem *Happy Eyeballs* (RFC 8305) para vazar tráfego via IPv6 sem passar pelo captive portal.
- **FastTrack**: Regras de `action=fasttrack-connection` desviam pacotes da cadeia de controle do Hotspot. São desativadas automaticamente.

### 3.3 Rejeição de QUIC/HTTP3 (`icmp-admin-prohibited`)
- O Google Chrome tenta abrir conexões HTTPS via QUIC (UDP porta 443).
- **Problema de usar DROP**: Se a porta UDP 443 for descartada (`action=drop`), o Chrome retransmite pacotes e congela por vários segundos até estourar o timeout, exibindo na tela do usuário o erro `ERR_QUIC_PROTOCOL_ERROR`.
- **Solução com REJECT**: Rejeitar com `action=reject reject-with=icmp-admin-prohibited`. O Chrome recebe resposta imediata em 0 milissegundos e retrocede para TCP sem emitir nenhum erro na tela.

### 3.4 Rejeição de Private DNS / DoT (`tcp-reset`)
- Smartphones Android modernos vêm configurados de fábrica com "DNS Privado" ativado (DNS-over-TLS na porta TCP 853).
- **Problema de usar DROP**: Se pacotes TCP 853 forem descartados, o Android aguarda 15 segundos antes de testar a conectividade da rede Wi-Fi, decidindo manter a conexão na internet móvel (4G/5G) e nunca abrindo o portal.
- **Solução com REJECT**: Rejeitar com `action=reject reject-with=tcp-reset`. O Android falha o teste de DoT em 0ms e faz fallback imediato para a porta DNS padrão 53 do MikroTik.

### 3.5 Bypass de Interceptação HTTPS Externo no NAT (`chain=hs-unauth action=return`)
- **O Problema do NAT Padrão do Hotspot**: Quando um cliente tenta navegar em `https://google.com` antes de logar, a regra dinâmica nativa do Hotspot (`chain=hs-unauth protocol=tcp dst-port=443 action=redirect to-ports=64875`) redireciona o tráfego para o servlet interno do MikroTik (`wproxy`). O servlet apresenta o certificado do roteador (`<slug>.mikrogestor.com`). Como o navegador requisitou `google.com` mas recebeu o certificado de `<slug>.mikrogestor.com`, acusa erro fatal `NET::ERR_CERT_COMMON_NAME_INVALID` e bloqueia a navegação.
- **A Solução MikroGestor**: Inserir como prioridade absoluta no NAT:
  ```routeros
  /ip firewall nat add chain=hs-unauth protocol=tcp dst-port=443 action=return place-before=0 comment="MikroGestor: Bypass foreign HTTPS interception"
  ```
- **Como Funciona**:
  1. Com `action=return`, a requisição HTTPS externa sai da cadeia de redirecionamento NAT do Hotspot e recebe TCP RST do firewall filter do Hotspot.
  2. O navegador e o sistema operacional (CNA da Apple, Android CaptivePortalLogin, Windows NCSI), ao receberem o TCP RST imediato na tentativa HTTPS, disparam imediatamente o teste HTTP na porta 80 (`http://clients3.google.com/generate_204` ou `http://captive.apple.com`).
  3. O servlet HTTP do Hotspot intercepta a requisição na porta 80 e responde com HTTP 302 redirecionando limpa e suavemente para `http://<slug>.mikrogestor.com/login`.

---

## 4. Diagrama do Fluxo de Rede Atualizado

```
FLUXO 1: ADMIN ACESSANDO VIA INTERNET (DASHBOARD)
[ Administrador ]
        │
        ├── Acessa https://fap.mikrogestor.com
        ▼
[ DNS Hostinger ] (* -> 2.25.168.82)
        ▼
[ Traefik Proxy VPS ] (Porta 443 com Let's Encrypt Válido)
        │
        └── Túnel WireGuard (10.8.0.0/24)
              ▼
[ MikroTik WebFig ] (http://10.8.0.2:80)
      (Abre a tela de gerenciamento do roteador com segurança SSL)


FLUXO 2: CLIENTE CONECTANDO NO WI-FI HOTSPOT
[ Cliente Wi-Fi ]
        │
        ├── 1. Conecta no Wi-Fi e recebe IP + DNS 192.168.88.1 via DHCP
        │
        ├── 2. Tenta navegação em https://google.com:
        │      - UDP 443 (QUIC) -> Rejeitado com ICMP (fallback instantâneo p/ TCP)
        │      - TCP 853 (DoT)  -> Rejeitado com TCP-RST (fallback instantâneo p/ DNS 53)
        │      - TCP 443 (NAT hs-unauth) -> Bypass via action=return (recebe TCP RST)
        │
        ├── 3. Sistema operacional dispara teste HTTP 80 (generate_204)
        │
        ├── 4. Hotspot intercepta e responde HTTP 302:
        │      Location: http://fap.mikrogestor.com/login
        │
        ├── 5. Cliente resolve fap.mikrogestor.com via DNS estático local:
        │      fap.mikrogestor.com -> 192.168.88.1
        │
        ▼
[ Tela de Login do Hotspot ]
        │ (Exibida perfeitamente no navegador do cliente)
        │
        └── Cliente clica em cadastrar/comprar plano:
              Walled Garden libera acesso direto ao MikroGestor VPS (2.25.168.82)
              para geração do PIX e liberação de 15 minutos de cortesia.
```

---

## 5. Requisitos de Configuração na VPS e Hostinger

### 5.1 Hostinger / Provedor DNS
Criar um registro `A` wildcard:
- **Tipo**: `A`
- **Nome**: `*`
- **Aponta para**: `2.25.168.82`
- **TTL**: `300` ou `Default`

### 5.2 Coolify / Traefik
O container `coolify-proxy` monta o diretório de configurações dinâmicas:
- Host: `/data/coolify/proxy/dynamic/` → Container: `/traefik/dynamic/`
- Traefik flag: `--providers.file.directory=/traefik/dynamic/ --providers.file.watch=true`

### 5.3 Daemon WG-Manager (`/opt/mikrogestor-wg-manager/wg-manager.py`)
Executado como serviço systemd `mikrogestor-wg-manager.service`:
- Porta: `51821`
- Autenticação: cabeçalho `X-WG-Secret` correspondente a `/etc/mikrogestor-wg.secret`
- Endpoints:
  - `POST /traefik/subdomain/add`
  - `POST /traefik/subdomain/remove`
  - `GET /cert/extract?domain=<subdomain>`
  - `POST /peer/add`
  - `POST /peer/remove`
  - `GET /status`
  - `GET /health`
