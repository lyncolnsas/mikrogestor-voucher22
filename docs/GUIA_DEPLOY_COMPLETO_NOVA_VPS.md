# 🚀 Guia Definitivo de Deploy do MikroGestor em Nova VPS

> **Manual Oficial e À Prova de Falhas para Provisionamento de Produção**  
> Compatível com: **Ubuntu 22.04 LTS / 24.04 LTS**, **Debian 11 / 12**, **Coolify**, **Docker** e **Raspberry Pi OS (ARM64)**.

---

## 📑 Índice
1. [Arquitetura Geral da Infraestrutura](#1-arquitetura-geral-da-infraestrutura)
2. [Pré-Requisitos e Liberação de Portas na Nuvem](#2-pré-requisitos-e-liberação-de-portas-na-nuvem)
3. [Método Principal: Deploy com Coolify (Recomendado)](#3-método-principal-deploy-com-coolify-recomendado)
   - [Passo 1: Instalação do Coolify](#passo-1-instalação-do-coolify)
   - [Passo 2: Configuração de Host (WireGuard, Firewall e Volumes)](#passo-2-configuração-de-host-wireguard-firewall-e-volumes)
   - [Passo 3: Criação da Aplicação no Coolify](#passo-3-criação-da-aplicação-no-coolify)
   - [Passo 4: Volume Persistente SQLite (OBRIGATÓRIO)](#passo-4-volume-persistente-sqlite-obrigatório)
   - [Passo 5: Variáveis de Ambiente e DNS Wildcard](#passo-5-variáveis-de-ambiente-e-dns-wildcard)
   - [Passo 6: Deploy e Inicialização Automática](#passo-6-deploy-e-inicialização-automática)
4. [Validação Automática do Deploy (Script de 8 Camadas)](#4-validação-automática-do-deploy-script-de-8-camadas)
5. [Conectando o Primeiro MikroTik (RouterOS v7)](#5-conectando-o-primeiro-mikrotik-routeros-v7)
   - [5.1 Admin Peers (Windows & Mobile) e Acesso Remoto Winbox](#51-admin-peers-windows--mobile-e-acesso-remoto-winbox)
   - [5.2 Subdomínios Dinâmicos & SSL Let's Encrypt por Roteador](#52-subdomínios-dinâmicos--ssl-lets-encrypt-por-roteador)
   - [5.3 Gestão e Operação Autônoma via Coolify MCP Server](#53-gestão-e-operação-autônoma-via-coolify-mcp-server)
   - [5.4 WhatsApp Multi-Instâncias (Pool de 2 a 8 Números) e Biblioteca de Mídias](#54-whatsapp-multi-instâncias-pool-de-2-a-8-números-e-biblioteca-de-mídias)
6. [Método Alternativo: Deploy Direto via Docker Compose](#6-método-alternativo-deploy-direto-via-docker-compose)
7. [Troubleshooting Playbook (Resolução Imediata de Problemas)](#7-troubleshooting-playbook-resolução-imediata-de-problemas)
8. [Comandos de Emergência e Manutenção](#8-comandos-de-emergência-e-manutenção)

---

## 1. Arquitetura Geral da Infraestrutura

O MikroGestor utiliza uma arquitetura híbrida projetada para máxima performance, segurança e capacidade de controlar roteadores remotos mesmo que estejam atrás de **CGNAT ou sem IP público**:

```
[ MikroTik RouterOS v7 ] (Cliente Hotspot/PPPoE)
        │
        │ Túnel Criptografado WireGuard (UDP 51820)
        │ Subnet VPN de Controle: 10.8.0.0/24 (Split-Tunneling Estrito)
        ▼
[ Servidor VPS Ubuntu / Debian (Host) ]
  ├── Interface WireGuard: wg0 (10.8.0.1/24)
  ├── NAT Masquerade Ativo: (iptables -t nat -A POSTROUTING -o wg0 -j MASQUERADE)
  ├── Daemon WG-Manager: 127.0.0.1:51821 / 172.17.0.1:51821 (Protegido via HMAC Header)
  ├── Volume Persistente no Host: /data/mikrogestor/prisma (chmod 777)
  │
  └── [ Container Docker Coolify (MikroGestor Next.js) ]
        ├── Porta HTTP: 80 (Interna e Externa)
        ├── Volume Mapeado: /app/prisma -> /data/mikrogestor/prisma
        ├── Banco de Dados: SQLite dev.db (WAL Mode de alta concorrência)
        ├── Patch Automático: node-routeros Channel.js (!empty reply RouterOS v7)
        └── Comunicação API MikroTik: 10.8.0.2:8728 (Via Gateway Docker -> wg0)
```

### Por que o NAT Masquerade na `wg0` é crucial?
Quando o container Docker (`172.17.0.X`) envia comandos da API para o MikroTik (`10.8.0.2`), o pacote passa pelo host e entra no túnel `wg0`. Com a regra de `MASQUERADE`, o IP de origem do pacote é reescrito para `10.8.0.1` (o IP da VPS no túnel).  
Dessa forma:
1. O firewall do MikroTik reconhece o tráfego como legítimo vindo da VPS (`10.8.0.1`).
2. O MikroTik devolve a resposta diretamente pela interface VPN, eliminando 100% dos problemas de roteamento assimétrico.

---

## 2. Pré-Requisitos e Liberação de Portas na Nuvem

### Requisitos Mínimos de Servidor
- **SO**: Ubuntu 22.04 LTS ou Ubuntu 24.04 LTS (x86_64 ou ARM64) / Debian 12
- **CPU**: 1 vCPU (2 vCPUs recomendadas para 50+ roteadores)
- **RAM**: 1 GB mínimo (2 GB recomendados)
- **Disco**: 20 GB SSD

### Portas Obrigatórias no Painel da Cloud (Security Groups / Firewall Externo)
Antes de começar, certifique-se de que seu provedor (Oracle Cloud, Hetzner, AWS, Contabo, DigitalOcean, etc.) libera as seguintes portas no firewall externo:

| Porta | Protocolo | Finalidade | Origem Permitida |
|---|---|---|---|
| **22** | TCP | Acesso SSH ao Servidor | Seu IP ou `0.0.0.0/0` |
| **80** | TCP | Tráfego Web do MikroGestor / Hotspot | `0.0.0.0/0` |
| **443** | TCP | Acesso Seguro SSL / HTTPS | `0.0.0.0/0` |
| **8000** | TCP | Painel Web do Coolify | Seu IP ou `0.0.0.0/0` |
| **51820** | UDP | **Túnel WireGuard com os MikroTiks** | `0.0.0.0/0` (Essencial) |

> ⚠️ **Atenção (Oracle Cloud e AWS)**: Além do UFW interno, você DEVE abrir a porta **51820/UDP** nas *Security Lists / Security Groups* do painel da Oracle/AWS, caso contrário os pacotes do MikroTik não chegarão à VPS.

---

## 3. Método Principal: Deploy com Coolify (Recomendado)

### Passo 1: Instalação do Coolify
Na VPS recém-instalada, conecte via SSH e instale o Coolify:
```bash
ssh root@SEU_IP_VPS
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```
Aguarde a conclusão (cerca de 2 a 3 minutos). Acesse `http://SEU_IP_VPS:8000` e crie sua conta de administrador.

---

### Passo 2: Configuração de Host (WireGuard, Firewall e Volumes)
No terminal da VPS, execute o script de provisionamento automatizado do MikroGestor:
```bash
bash <(curl -sSL https://raw.githubusercontent.com/lyncolnsas/mikrogestor-voucher22/main/vpn/setup-vps.sh)
```
*(Ou se já clonou o repositório: `sudo bash vpn/setup-vps.sh`)*

#### O que este script faz automaticamente:
1. Instala pacotes do Kernel (`wireguard`, `wireguard-tools`, `iptables`, `ufw`, `python3`).
2. Ativa o encaminhamento de pacotes IPv4 no Kernel (`net.ipv4.ip_forward=1`).
3. Gera o par de chaves WireGuard (Curve25519) da VPS.
4. Cria `/etc/wireguard/wg0.conf` com **NAT Masquerade ativo** e sobe a interface `wg0` em `10.8.0.1/24`.
5. **Cria `/data/mikrogestor/prisma` com `chmod 777`** para persistência do banco SQLite.
6. Instala o daemon de gerenciamento seguro `mikrogestor-wg-manager` (porta 51821) gerenciado pelo systemd.
7. Configura o UFW em modo **Default Deny** com isolamento da porta 51821:
   ```bash
   ufw default deny incoming && ufw default allow outgoing && ufw default allow routed
   ufw allow 22/tcp comment "SSH Remote Access"
   ufw allow 80/tcp comment "HTTP Traefik Proxy"
   ufw allow 443/tcp comment "HTTPS Traefik Proxy"
   ufw allow 443/udp comment "HTTP3 Traefik Proxy"
   ufw allow 8000/tcp comment "Coolify Web UI"
   ufw allow 6001/tcp comment "Coolify Realtime WebSockets"
   ufw allow 51820/udp comment "WireGuard VPN Tunnel"
   ufw allow in on wg0 comment "WireGuard Internal Traffic"
   ufw route allow in on wg0 out on wg0 comment "WireGuard Inter-Peer Routing"
   ufw allow from 172.16.0.0/12 to any port 51821 proto tcp comment "Docker to WG-Manager"
   ufw allow from 127.0.0.1 to any port 51821 proto tcp comment "Localhost to WG-Manager"
   ufw --force enable
   ```
8. **Imprime na tela o bloco completo de variáveis para copiar e colar no Coolify!**

---

### Passo 3: Criação da Aplicação no Coolify
1. No painel do Coolify (`http://SEU_IP_VPS:8000`), clique em **+ Create New Resource** → **Application**.
2. Selecione **Public Repository** (ou configure seu GitHub App para repositório privado).
3. Insira a URL do repositório:
   ```text
   https://github.com/lyncolnsas/mikrogestor-voucher22.git
   ```
4. Branch: `main`.
5. **Build Pack**: Selecione **Nixpacks** (ou Dockerfile se disponível).
6. **Portas**: Defina a porta de escuta como **`80`**.

---

### Passo 4: Volume Persistente SQLite (OBRIGATÓRIO)
> 🚨 **REGRA CRÍTICA P0**: Sem este passo, o Coolify destruirá o banco SQLite (`dev.db`) em cada novo deploy, apagando todos os roteadores e vouchers cadastrados!

No painel da aplicação no Coolify:
1. Vá na aba **Persistent Storage** (Armazenamento Persistente).
2. Clique em **Add Volume** (Adicionar Volume).
3. Preencha exatamente:
   - **Name**: `prisma-db`
   - **Host Path**: `/data/mikrogestor/prisma`
   - **Container Path**: `/app/prisma`
4. Clique em **Save**.

> 💡 **Proteção Anti-Crash de Migração**: O script de inicialização do MikroGestor executa `npx prisma db push --accept-data-loss --skip-generate`. Isso garante que quando novos campos forem adicionados ao schema Prisma em novas versões, o Coolify nunca trave esperando confirmação interativa do terminal, subindo o container com zero retrabalho.

---

### Passo 5: Variáveis de Ambiente e DNS Wildcard

#### 1. Apontamento DNS Wildcard (Hostinger / Cloudflare / Registro.br)
Para que os subdomínios dedicados de cada roteador (ex: `001.mikrogestor.com`, `mkroca.mikrogestor.com`) funcionem automaticamente com SSL Let's Encrypt:
- **Tipo**: `A`
- **Nome / Host**: `*`
- **Valor / IP**: `SEU_IP_VPS` (ex: `2.25.168.82`)
- **TTL**: 300 segundos ou Automático

#### 2. Variáveis de Ambiente no Coolify
Na aba **Environment Variables** da aplicação no Coolify, adicione as variáveis:

```env
DATABASE_URL=file:/app/prisma/dev.db
NEXTAUTH_SECRET=sua_chave_secreta_aleatoria_32_chars
NEXTAUTH_URL=https://mikrogestor.com
PORT=80
VPS_PUBLIC_IP=SEU_IP_VPS
VPS_WG_PUBLIC_KEY=sua_chave_publica_wireguard_gerada_no_passo_2
WG_MANAGER_SECRET=seu_secret_gerado_no_passo_2

# ⚠️ REDE DOCKER DO COOLIFY:
# Se o container estiver na rede bridge 'coolify', o gateway do host é 172.16.1.1.
# Se estiver na rede bridge padrão do Docker, o gateway é 172.17.0.1.
WG_MANAGER_URL=http://172.16.1.1:51821

# ❗ OBRIGATÓRIO PARA DEPLOY EM NUVEM / VPS:
DEPLOYMENT_MODE=vps
PORTAL_PUBLIC_DOMAIN=mikrogestor.com
```

> ⚠️ **Atenção sobre o Gateway Docker (`WG_MANAGER_URL`)**:  
> No Coolify, containers criados pela plataforma usam a rede Docker nomeada `coolify` cuja faixa é `172.16.1.0/24`, tendo como gateway o IP `172.16.1.1`. Configure `WG_MANAGER_URL=http://172.16.1.1:51821`. O UFW na VPS deve estar liberado com:  
> `ufw allow from 172.16.0.0/12 to any port 51821 proto tcp`

---

### Passo 6: Deploy e Inicialização Automática
Clique no botão **Deploy** no topo do Coolify.

#### O que o sistema faz sozinho durante o build e inicialização:
1. **Fase de Build (`npm install`)**: O script `postinstall` executa automaticamente `scripts/patch-routeros.js`, garantindo que a biblioteca `node-routeros` suporte as respostas `!empty` do RouterOS v7.
2. **Fase de Inicialização (`npm start`)**:
   - Executa `npx prisma db push --accept-data-loss --skip-generate` (cria/atualiza as tabelas no SQLite persistente sem risco de bloqueio interativo).
   - Executa `node scripts/init-db.js` (ativa o modo **WAL** de alta concorrência e cria o usuário padrão `admin` / `123` caso o banco seja novo).
   - Inicia o Next.js na porta `80`.

---

## 4. Validação Automática do Deploy (Script de 8 Camadas)

Para garantir que não existe nenhuma falha oculta (de rede, firewall, banco ou VPN), execute o script de diagnóstico automatizado na VPS:

```bash
bash scripts/verificar-deploy-completo.sh
```

### Exemplo de saída esperada (Tudo Verde):
```text
═══════════════════════════════════════════════════════════════════════════
       🔍 MIKROGESTOR — VERIFICAÇÃO COMPLETA DE DEPLOY & AMBIENTE          
═══════════════════════════════════════════════════════════════════════════

1. WireGuard Host & Interface wg0:
  [✓ PASS] WireGuard CLI disponível (wireguard-tools v1.0.20210914)
  [✓ PASS] Interface wg0 ativa no host (IP: 10.8.0.1/24)
  [✓ PASS] Porta UDP 51820 ouvindo conexões dos MikroTiks

2. Encaminhamento de Pacotes & NAT Masquerade:
  [✓ PASS] IP Forwarding ativado no Kernel (net.ipv4.ip_forward=1)
  [✓ PASS] Regra NAT Masquerade ativa na interface wg0 (permite Docker falar com MikroTik)

3. Daemon WireGuard Manager (Porta 51821):
  [✓ PASS] Serviço systemd mikrogestor-wg-manager ativo
  [✓ PASS] API HTTP do Manager respondendo em 127.0.0.1:51821 (HTTP 200 OK)
  [✓ PASS] API acessível a partir da ponte Docker 172.17.0.1:51821

4. Armazenamento Persistente SQLite no Host (/data/mikrogestor/prisma):
  [✓ PASS] Diretório /data/mikrogestor/prisma existe
  [✓ PASS] Diretório possui permissão de escrita
  [✓ PASS] Banco dev.db presente no host (Tamanho: 1.2M)

5. Container MikroGestor (Docker / Coolify):
  [✓ PASS] Container ativo encontrado: mikrogestor-prod (45262b0b04c7)
  [✓ PASS] Volume persistente /data/mikrogestor/prisma montado corretamente dentro do container
  [✓ PASS] Patch RouterOS v7 (!empty) ativo dentro do container em node_modules

6. Servidor Web MikroGestor (Porta 80):
  [✓ PASS] Servidor respondendo na porta 80 (HTTP 200)

7. Status de Peers WireGuard (MikroTik):
  [✓ PASS] Peer 10.8.0.2/32: 🟢 ONLINE (Último handshake há 0m, RX: 5120KB, TX: 5120KB)

═══════════════════════════════════════════════════════════════════════════
  🎉 SUCESSO TOTAL: Todos os checks vitais passaram! (11 checks aprovados)
  O MikroGestor está 100% pronto para operar em produção.
═══════════════════════════════════════════════════════════════════════════
```

---

## 5. Conectando o Primeiro MikroTik (RouterOS v7)

1. Acesse o painel web: `http://SEU_IP_VPS` (ou seu domínio).
2. Faça login com as credenciais padrão:
   - **Usuário**: `admin`
   - **Senha**: `123`  
   *(Altere a senha após o primeiro acesso em Configurações)*.
3. No menu lateral, acesse **Roteadores** → **Adicionar Roteador**.
4. Preencha os dados:
   - **Nome do Roteador**: Ex: `RB-Hotspot-Central`
   - **IP VPN**: O sistema sugere automaticamente (ex: `10.8.0.2`)
   - **Usuário API**: `admin` (ou seu usuário MikroTik)
   - **Senha API**: Sua senha do MikroTik
   - **Porta API**: `8728`
5. Clique em **Salvar e Gerar Script WireGuard**.
6. Copie o script gerado.

### Como aplicar no MikroTik:
1. Abra o **Winbox** e conecte no seu MikroTik.
2. Abra o **New Terminal**.
3. Cole o script copiado e pressione `Enter`.
4. O script configura:
   - Interface WireGuard `wg-mikrogestor`
   - IP `10.8.0.2/24`
   - Peer apontando para a VPS com keepalive de 25s
   - Rota estrita de controle para `10.8.0.0/24` (sem desviar tráfego dos clientes da internet)
   - Regras de firewall liberando as portas 8728/8729 apenas para a VPS (`10.8.0.1`)
5. No terminal do MikroTik, teste a conexão:
   ```routeros
   /ping 10.8.0.1 count=4
   ```
   *Deve responder imediatamente com 0% packet loss!*
6. No painel do MikroGestor, o roteador ficará **Verde (Online)** e os gráficos de CPU, Memória e Hotspot carregarão em tempo real.

---

### 5.1 Admin Peers (Windows & Mobile) e Acesso Remoto Winbox

Uma das grandes vantagens da arquitetura WireGuard do MikroGestor é permitir que operadores e técnicos acessem remotamente **qualquer MikroTik via Winbox**, mesmo que o roteador esteja atrás de CGNAT de operadora ou sem IP público, sem necessidade de AnyDesk ou TeamViewer.

#### Como criar um Peer Administrativo:
1. Acesse o painel web: `/dashboard/vpn`.
2. Role até a seção **"Dispositivos de Administração (Windows / Celular / Notebook)"**.
3. Clique em **"+ Novo Peer Administrativo"**.
4. Defina o nome do operador (ex: `Notebook-Suporte-Lyncio`).
5. O sistema alocará automaticamente o próximo IP disponível na subnet de controle (ex: `10.8.0.4/32`).
6. O modal exibirá:
   - **Download de Arquivo `.conf`**: Para importar no cliente oficial WireGuard do Windows ou macOS.
   - **QR Code Interativo**: Para escanear com a câmera do celular no aplicativo WireGuard (iOS ou Android).

#### Como Acessar o MikroTik via Winbox Remotamente:
1. Ative o túnel WireGuard no seu Windows ou Celular.
2. Abra o **Winbox**.
3. No campo **Connect To**, digite o IP VPN do MikroTik (ex: `10.8.0.2` ou `10.8.0.3`).
4. Digite o **Login** e **Password** administrativos do MikroTik.
5. Clique em **Connect**.
6. A conexão abrirá instantaneamente em alta velocidade através do túnel criptografado.

> 🔒 **Regra de Firewall no MikroTik**:  
> Para garantir que o Winbox aceite conexões originadas do seu peer administrativo (`10.8.0.4`), certifique-se de que a regra de firewall permite a subnet `10.8.0.0/24` na porta 8291:  
> ```routeros
> /ip firewall filter add chain=input action=accept src-address=10.8.0.0/24 dst-port=8291 protocol=tcp comment="MG: Allow Winbox via WireGuard VPN" place-before=1
> ```

---

### 5.2 Subdomínios Dinâmicos & SSL Let's Encrypt por Roteador

O MikroGestor oferece a cada roteador cadastrado um subdomínio exclusivo (ex: `mkroca.mikrogestor.com`, `loja01.mikrogestor.com`) com **HTTPS Let's Encrypt 100% livre de avisos de segurança no Hotspot**.

#### Como funciona o fluxo automatizado:
1. **DNS Wildcard**: O apontamento DNS `* -> IP_VPS` direciona qualquer subdomínio para a VPS.
2. **Proxy Reverso Traefik (Acesso Remoto WebFig com SSL)**: Ao provisionar o roteador, o daemon `wg-manager` cria um arquivo de roteamento dinâmico em `/data/coolify/proxy/dynamic/router-<slug>.yaml` apontando para `http://<vpnIp>:80` (WebFig do MikroTik através do túnel WireGuard `10.8.0.0/24`). Ao clicar no link do subdomínio dentro do painel MikroGestor, o administrador acessa diretamente a interface WebFig com certificado SSL Let's Encrypt autêntico e válido.
3. **Emissão SSL Automática**: O Traefik solicita e renova o certificado Let's Encrypt automaticamente salvando em `/data/coolify/proxy/acme.json`.
4. **Cadeia Completa de Certificados (Full Chain)**:
   - A rota `/api/vpn/router/<id>/cert-file` entrega a cadeia de certificados completa: Folha + Intermediário Let's Encrypt (`YR2`) + Raiz (`ISRG Root X1`).
   - O MikroTik renomeia os certificados intermediários para manter o certificado folha com a chave privada (`PK: true`) amarrado ao serviço `www-ssl` e ao perfil do Hotspot (`hsprof_hotspot`), garantindo validação perfeita em Android, iOS e Windows sem alertas de autoridade desconhecida.
5. **DNS Exclusivo no DHCP (Prevenção de Vazamento DNS)**:
   - O servidor DHCP do Hotspot entrega estritamente o IP LAN do MikroTik (`192.168.88.1`) no campo `dns-server`, sem nenhum DNS público secundário (ex: `8.8.8.8`). Isso garante que todas as resoluções de nomes passem pelo roteador para interceptação precisa do captive portal.
6. **`hotspot-address` Vinculado**:
   - O perfil `/ip/hotspot/profile` tem o campo `hotspot-address` explicitamente configurado com o IP LAN do MikroTik (`192.168.88.1`), nunca `0.0.0.0`, permitindo que o RouterOS saiba exatamente onde receber o tráfego interceptado.
7. **Renovação Dinâmica e Inteligente Orientada a Eventos**:
   - Os certificados Let's Encrypt possuem validade de **90 dias** (3 meses).
   - **Fluxo Dinâmico**: O Traefik gerencia o ciclo de vida e renova o certificado automaticamente nos últimos dias de validade.
   - Assim que o certificado é renovado ou provisionado, a própria plataforma MikroGestor conecta no MikroTik via API WireGuard (`10.8.0.2:8728`) e injeta a nova cadeia completa instantaneamente, eliminando loops desnecessários de download periódico no roteador.
   - O agendador no MikroTik atua apenas como fallback seguro em caso de indisponibilidade temporária de rede no momento da virada do certificado.
8. **Regras de Rede para Redirecionamento Perfeito do Captive Portal**:
   - **Rejeição QUIC (UDP 443)**: Rejeitado com `icmp-admin-prohibited` no filter (evita `ERR_QUIC_PROTOCOL_ERROR` no Chrome e força TCP em 0ms).
   - **Rejeição DoT (TCP 853)**: Rejeitado com `tcp-reset` no filter (evita 15s de espera no Android Private DNS e força fallback para DNS 53).
   - **Bypass de Interceptação HTTPS Externo no NAT**: Regra prioritária `chain=hs-unauth protocol=tcp dst-port=443 action=return place-before=0` no NAT (evita erro `NET::ERR_CERT_COMMON_NAME_INVALID` ao navegar em `google.com` e dispara o probe HTTP 80 que abre a tela de login do Hotspot).

---

### 5.3 Gestão e Operação Autônoma via Coolify MCP Server

O projeto conta com o **CooliFy - MCP (v2.0.0)**, um servidor de protocolo de contexto de modelo independente localizado em `C:\Users\lynco\OneDrive\Documentos\-Projetos\CooliFy - MCP`.

Com ele, agentes de IA (Antigravity IDE, Claude Desktop, Cursor) têm permissão para:
- Diagnosticar o estado de containers (`docker_ps`, `docker_logs`, `docker_exec`).
- Inspecionar a interface e peers WireGuard (`wireguard_status`).
- Executar comandos bash no host via SSH com segurança (`ssh_exec`).
- Disparar deploys e reinicializações de containers via API Coolify (`coolify_deploy_application`, `coolify_restart_application`).

Para validar a integração do MCP com qualquer VPS a qualquer momento:
```bash
cd "C:\Users\lynco\OneDrive\Documentos\-Projetos\CooliFy - MCP"
```

---

### 5.4 WhatsApp Multi-Instâncias (Pool de 2 a 8 Números) e Biblioteca de Mídias

O MikroGestor possui um motor de mensageria via WhatsApp Baileys projetado para alto volume, alta disponibilidade e proteção contra bloqueios da Meta:

1. **Pool de 2 a 8 Números Concorrentes**:
   - O painel em `/dashboard/whatsapp` permite conectar múltiplos números simultaneamente via QR Code independente.
   - **Persistência Total no SQLite**: As credenciais de autenticação Baileys são salvas na tabela `BaileysAuth` dentro de `/app/prisma/dev.db`. Como esse diretório é montado no volume persistente do host (`/data/mikrogestor/prisma`), **as sessões nunca deslogam após redeploys do container**.
   - **Rotatividade Circular (Round-Robin Real)**: As mensagens enviadas pelo sistema (cadastro, PIX gerado, pagamento aprovado, etc.) alternam ciclicamente entre todos os números com status `ready`.
   - **Failover Automático**: Se um número desconectar ou falhar no envio, o sistema tenta imediatamente os outros números ativos da fila sem perder a mensagem.

2. **Grupo Central de Mídias & Auto-Inclusão Autônoma (Zero-Touch)**:
   - O administrador cria um único grupo no WhatsApp (ex: `Mikrogestor-Mídias`) e cadastra o JID do grupo em `/dashboard/settings`.
   - **Entrada Automática**: Quando um 2º, 3º ou 8º número é emparelhado no painel, ele **não precisa ser adicionado manualmente ao grupo**! Uma instância ativa já presente no grupo consulta o código de convite (`groupInviteCode`) e a nova instância entra automaticamente via `groupAcceptInvite`.

3. **Encaminhamento Nativo de Mídias (Sem Re-Upload)**:
   - Ao postar vídeos, fotos ou áudios no grupo da biblioteca, o sistema cataloga a mensagem e armazena os identificadores criptográficos da Meta.
   - Nos modelos de mensagens (`/dashboard/whatsapp/templates`), o operador vincula a mídia desejada a cada gatilho (ex: `Gatilho de Boas-Vindas` ou `Gatilho de Aprovação`).
   - O envio aos clientes ocorre via **forwarding nativo** (`relayMessage` com `generateForwardMessageContent`). O servidor nunca faz download nem re-upload de arquivos pesados, economizando 100% de CPU/banda e reduzindo drasticamente o risco de banimento por spam repetitivo.

> 📖 **Documentação Técnica Aprofundada**: Para arquitetura completa, fluxo de mensagens, chaves de gatilhos e diagnósticos, consulte `docs/ARQUITETURA_WHATSAPP_MULTI_NUMEROS_E_FORWARD.md`.

---

## 6. Método Alternativo: Deploy Direto via Docker Compose

Se você prefere não usar o Coolify e deseja rodar diretamente com Docker Compose e Caddy (SSL automático):

Crie um arquivo `docker-compose.yml` na VPS:
```yaml
version: '3.8'

services:
  mikrogestor:
    image: node:20-alpine
    container_name: mikrogestor
    restart: always
    working_dir: /app
    volumes:
      - /data/mikrogestor/prisma:/app/prisma
    ports:
      - "80:80"
    environment:
      - DATABASE_URL=file:/app/prisma/dev.db
      - NEXTAUTH_SECRET=sua_chave_secreta_aqui
      - NEXTAUTH_URL=http://SEU_IP_VPS
      - PORT=80
      - VPS_PUBLIC_IP=SEU_IP_VPS
      - VPS_WG_PUBLIC_KEY=chave_publica_vps
      - WG_MANAGER_SECRET=secret_wg_manager
      - WG_MANAGER_URL=http://172.17.0.1:51821
    command: sh -c "npm install --production && npx prisma db push && node scripts/init-db.js && next start -H 0.0.0.0 -p 80"
```

Inicie com:
```bash
docker compose up -d
```

---

## 7. Troubleshooting Playbook (Resolução Imediata de Problemas)

| Sintoma / Erro | Causa Raiz | Solução Imediata |
|---|---|---|
| `RosException: Tried to process unknown reply: !empty` | A biblioteca `node-routeros` recebeu `!empty` de uma tabela vazia do RouterOS v7 sem o patch. | O patch já está incluído no topo de `src/lib/routeros.ts` e em `scripts/patch-routeros.js`. Execute `node scripts/patch-routeros.js` no container ou faça rebuild. |
| O banco de dados zerou após novo deploy no Coolify | O volume persistente não estava montado em `/app/prisma`. | Configure em **Application → Persistent Storage**: Host `/data/mikrogestor/prisma` mapeado para Container `/app/prisma`. |
| `ECONNREFUSED 10.8.0.2:8728` ao buscar dados do roteador | O túnel WireGuard não conectou ou a porta API (8728) está desativada no MikroTik. | 1. No MikroTik: `/ip service enable api`.<br>2. Verifique o handshake: `/interface wireguard peers print`.<br>3. Verifique se a porta 51820/UDP está liberada na nuvem. |
| MikroTik pinga `10.8.0.1`, mas a API na VPS dá `ETIMEDOUT` | Falta da regra de NAT Masquerade na interface `wg0` da VPS. | Execute na VPS:<br>`iptables -t nat -A POSTROUTING -o wg0 -j MASQUERADE` |
| `Error: P1001 Can't reach database` | Permissão insuficiente no diretório de dados do SQLite. | Execute na VPS:<br>`chmod -R 777 /data/mikrogestor/prisma` |
| Syntax error ao colar o script no Winbox Terminal | Quebra de linhas Windows (`\r\n`) ou barras invertidas (`\`) no script. | Todos os comandos para RouterOS v7 devem ser gerados em linha única com `;` separando comandos. |
| Daemon WG-Manager retornando HTTP 401 Unauthorized | O cabeçalho `X-WG-Secret` enviado pelo MikroGestor não confere com o secret da VPS. | Verifique `cat /etc/mikrogestor-wg.secret` na VPS e atualize a variável `WG_MANAGER_SECRET` no Coolify. |
| Regras de Walled Garden IP ficam com flag `I` (invalid) | No RouterOS v7, a tabela `/ip/hotspot/walled-garden/ip` **NÃO ACEITA ASTERISCOS** no campo `dst-host`. | Utilize apenas o domínio exato (`mikrogestor.com`) ou IP (`dst-address`). O MikroGestor agora sanitiza e remove asteriscos automaticamente. |
| Walled Garden acumulando regras repetidas e duplicadas | Múltiplos provisionamentos ou chamadas concorrentes sem checagem de existência prévia. | O MikroGestor agora possui garantia estrita de idempotência com deduplicação ativa em `src/lib/routeros.ts`. Para limpar manualmente no Winbox: `/ip hotspot walled-garden remove [find]; /ip hotspot walled-garden ip remove [find]` e re-provisionar. |
| Container em Crash Loop após deploy com mensagem `Do you want to continue? All data will be lost.` | O Prisma detectou alteração de schema e aguarda confirmação interativa no terminal headless do Coolify. | Certifique-se de que o script `start` em `package.json` inclui `--accept-data-loss` (`npx prisma db push --accept-data-loss --skip-generate`). |

---

## 8. Comandos de Emergência e Manutenção

```bash
# 1. Ver status completo e logs do túnel WireGuard na VPS
wg show

# 2. Reiniciar o daemon de gerenciamento WireGuard
systemctl restart mikrogestor-wg-manager
journalctl -u mikrogestor-wg-manager -n 50 --no-pager

# 3. Fazer backup manual imediato do banco SQLite
cp /data/mikrogestor/prisma/dev.db /data/mikrogestor/prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)

# 4. Forçar reconexão WireGuard no MikroTik (em linha única no Winbox)
/interface wireguard peers set [find interface=wg-mikrogestor] disabled=yes; :delay 2s; /interface wireguard peers set [find interface=wg-mikrogestor] disabled=no

# 5. Visualizar logs em tempo real do container MikroGestor no Coolify
docker logs -f $(docker ps -q --filter "ancestor=*mikrogestor*" | head -1)

# 6. Rodar diagnóstico completo do MikroGestor
bash scripts/verificar-deploy-completo.sh
```

---
*Documentação validada em ambiente de produção com MikroTik RouterOS v7 e Coolify.*
