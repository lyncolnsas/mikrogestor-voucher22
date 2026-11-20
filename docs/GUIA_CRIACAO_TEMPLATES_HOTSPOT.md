# Guia de Criação e Customização de Templates de Hotspot

> **Documento Oficial de Engenharia & Desenvolvimento de Temas**  
> **Compatibilidade Obrigatória:** MikroTik RouterOS v6 e v7 (x86, ARM, ARM64, MIPSBE, SMIPS, TILE)  
> **Módulo:** MikroGestor Portal Studio

---

## 1. Visão Geral

No MikroGestor, um **Template de Hotspot** é um pacote autocontido composto por páginas HTML, arquivos estáticos (CSS, JS, fontes, imagens) e um arquivo de configuração estruturado (`config.json`).

Quando o cliente conecta na rede Wi-Fi e tenta navegar sem estar autenticado, o MikroTik RouterOS intercepta o tráfego HTTP na porta 80 e entrega a página `login.html` do template configurado no perfil do Hotspot (`/ip/hotspot/profile`).

---

## 2. Estrutura Obrigatória de Pastas e Arquivos

Para que um template seja reconhecido pelo Portal Studio e distribuído corretamente para o MikroTik, ele **deve** residir em `hotspot/<Nome_Do_Template>/` e conter os seguintes arquivos:

```text
hotspot/<Nome_Do_Template>/
├── config.json          # Obrigatório: estado do editor visual e parâmetros de personalização
├── login.html           # Obrigatório: tela principal de captura e autenticação
├── alogin.html          # Obrigatório: redirecionamento após autenticação bem-sucedida
├── status.html          # Obrigatório: status da conexão, consumo de banda e tempo restante
├── logout.html          # Obrigatório: encerramento da sessão do usuário
├── error.html           # Obrigatório: exibição de mensagens de erro (voucher expirado, senha errada)
├── md5.js               # Obrigatório: script criptográfico CHAP para autenticação no MikroTik
├── redirect.html        # Obrigatório: fallback de redirecionamento de navegação
├── radvert.html         # Opcional/Recomendado: tela de anúncios e publicidade obrigatória
└── fonts/ (ou img/)     # Opcional: diretório de fontes e imagens locais do template
```

> [!IMPORTANT]
> O nome da pasta não deve conter caracteres especiais ou acentos para evitar incompatibilidades com o sistema de arquivos FAT/ext dos diferentes modelos de RouterBOARDs.

---

## 3. Variáveis e Diretivas Nativas do RouterOS

O motor de captive portal do MikroTik faz substituição textual por expressões no formato `$(variavel)`. **Nunca remova ou altere a sintaxe dessas variáveis nos formulários**:

| Diretiva MikroTik | Descrição / Função no Hotspot |
| :--- | :--- |
| `$(link-login-only)` | URL interna de submissão do formulário de autenticação (ex: `http://192.168.88.1/login`). |
| `$(link-orig-esc)` | URL original que o cliente tentou acessar antes de ser interceptado (escapada para URLs). |
| `$(username)` | Nome de usuário preenchido ou herdado da sessão anterior. |
| `$(password)` | Campo de senha (geralmente omitido quando o sistema usa voucher único). |
| `$(error)` | Mensagem de erro enviada pelo RouterOS em caso de falha de login. |
| `$(mac)` | Endereço MAC do dispositivo do cliente. |
| `$(ip)` | Endereço IP concedido ao cliente via DHCP. |
| `$(identity)` | Nome do roteador MikroTik (`/system/identity`). |
| `$(uptime)` | Tempo de conexão ativa da sessão (usado no `status.html`). |
| `$(session-time-left)` | Tempo restante de acesso do plano/voucher ativo (usado no `status.html`). |
| `$(bytes-in-nice)` / `$(bytes-out-nice)` | Quantidade de dados baixados/enviados formatados (MB/GB). |

### Exemplo de Formulário de Login Padrão no `login.html`:

```html
<form name="login" action="$(link-login-only)" method="post" onSubmit="return doLogin()">
  <input type="hidden" name="dst" value="$(link-orig-esc)" />
  <input type="hidden" name="popup" value="true" />

  <!-- Campo do Voucher / Usuário -->
  <div class="input-group">
    <input 
      type="text" 
      name="username" 
      id="username" 
      value="$(username)" 
      placeholder="Digite seu Voucher" 
      autocomplete="off" 
      autocapitalize="none"
      required
    />
  </div>

  <!-- Em sistemas com voucher único, a senha é espelhada ou enviada vazia -->
  <input type="hidden" name="password" id="password" value="" />

  <button type="submit" class="btn-primary" id="btn-login">
    Conectar à Internet
  </button>
</form>
```

---

## 4. Contrato de Dados do `config.json`

O arquivo `config.json` armazena todos os parâmetros editáveis no Portal Studio. Ao criar um novo template, utilize o schema de referência abaixo:

```json
{
  "businessName": "Nome da Empresa ou Estabelecimento",
  "message": "Bem-vindo ao Wi-Fi gratuito! Conecte-se abaixo.",
  "systemUrl": "https://mikrogestor.com",
  "colors": {
    "brand": "#0284c7",
    "brandDark": "#0369a1",
    "bg": "#090a0f",
    "ink": "#f8fafc",
    "muted": "#94a3b8",
    "blue": "#0284c7",
    "green": "#10b981",
    "trialButtonBg": "#0ea5e9",
    "trialButtonText": "#ffffff",
    "cardBg": "#12131f",
    "cardBorder": "#0284c7",
    "inputBg": "#18192b",
    "inputText": "#f8fafc",
    "inputBorder": "#1e293b",
    "inputPlaceholder": "#64748b",
    "loginButtonText": "#ffffff",
    "registerButtonText": "#ffffff",
    "glassOpacity": 90,
    "glassBlur": 16
  },
  "effects": {
    "bgEffect": "none",
    "bgEffectSpeed": "normal",
    "cardShape": "rounded",
    "cardNoiseTexture": false,
    "cardGlowBorder": false,
    "cardTilt3d": false,
    "btnShimmer": true,
    "btnPulse": false,
    "titleGradient": false
  },
  "studio": {
    "fontFamily": "Inter",
    "titleFontSize": 22,
    "titleFontWeight": "700",
    "titleLineHeight": 1.2,
    "btnFontSize": 14,
    "btnFontWeight": "600",
    "btnHeight": 44,
    "cardRadiusTL": 20,
    "cardRadiusTR": 20,
    "cardRadiusBR": 20,
    "cardRadiusBL": 20,
    "cardPaddingTop": 24,
    "cardPaddingRight": 24,
    "cardPaddingBottom": 24,
    "cardPaddingLeft": 24,
    "cardBorderWidth": 1,
    "cardBorderStyle": "solid",
    "cardGap": 16,
    "inputHeight": 44,
    "inputRadius": 10
  },
  "blocks": [
    { "id": "badges", "type": "badges", "label": "Badges de Conexão", "enabled": true, "canDelete": true },
    { "id": "branding", "type": "branding", "label": "Identidade & Logotipo", "enabled": true, "canDelete": false },
    { "id": "welcome", "type": "welcome", "label": "Mensagem de Boas-Vindas", "enabled": true, "canDelete": false },
    { "id": "auth", "type": "auth", "label": "Formulário de Login", "enabled": true, "canDelete": false },
    { "id": "trial", "type": "trial", "label": "Acesso de Teste (Trial)", "enabled": true, "canDelete": true },
    { "id": "ads", "type": "ads", "label": "Campanhas Promocionais", "enabled": false, "canDelete": true },
    { "id": "props", "type": "props", "label": "Status & Alertas", "enabled": true, "canDelete": false },
    { "id": "whatsapp", "type": "whatsapp", "label": "Suporte WhatsApp", "enabled": false, "canDelete": true },
    { "id": "footer", "type": "footer", "label": "Rodapé & Termos Legais", "enabled": true, "canDelete": false }
  ],
  "brand": {
    "displayMode": "both",
    "titleText": "Super Wi-Fi",
    "subtitleText": "",
    "fontFamily": "Outfit",
    "fontSize": 24,
    "textColor": "#ffffff",
    "logoUrl": ""
  },
  "fields": {
    "nameEnabled": true,
    "nameRequired": true,
    "phoneEnabled": true,
    "phoneRequired": true,
    "cpfEnabled": false,
    "cpfRequired": false,
    "emailEnabled": false,
    "emailRequired": false
  },
  "enabled": true,
  "saleMode": false,
  "systemFreeWifiMode": true,
  "trialEnabled": true,
  "trialText": "Acesso de teste disponível, ",
  "trialLinkText": "clique aqui",
  "termsText": "Ao se conectar, você concorda com os Termos de Uso e Política de Privacidade."
}
```

---

## 5. Boas Práticas e Regras de Ouro para Captive Portals

### 5.1. Compatibilidade com WebViews Móveis (CNA)
Dispositivos Apple (iOS CNA) e Android (Captive Portal Login) abrem o portal dentro de um navegador restrito com recursos limitados de JavaScript e CSS:
1. **Fallback para Métodos Modernos:** Se usar APIs como `ctx.roundRect` em canvas, sempre implemente fallback com `arc` ou `quadraticCurveTo`.
2. **Evite Dependências Externas Pesadas:** O captive portal opera em rede isolada antes do login. Não tente importar scripts grandes via CDN externo (como React ou Three.js completo) sem estarem salvos localmente na pasta do template ou liberados no Walled Garden.
3. **Imagens Leves:** Utilize WebP, SVG ou PNG comprimidos. Arquivos pesados atrasam a abertura do portal em roteadores com processador limitado.

### 5.2. Suporte a Redirecionamento HTTPS
Lembre-se da regra do **Bypass de Interceptação HTTPS Externo no NAT** (Regra #17 do `AGENTS.md`):
- O captive portal deve sempre responder com requisições HTTP porta 80 limpas para que o Android e o Windows detectem o `generate_204` instantaneamente e abram o formulário sem erro de certificado SSL.

---

## 6. Procedimento de Teste e Validação

Antes de publicar ou distribuir um novo template:

1. **Validação de Sintaxe HTML/JS:**
   ```powershell
   node -e "const fs = require('fs'); const vm = require('vm'); const code = fs.readFileSync('hotspot/<nome>/login.html', 'utf8'); console.log('Tamanho:', code.length);"
   ```
2. **Teste no Portal Studio:**
   - Acesse `/dashboard/portal` e selecione o novo template no menu suspenso do topo.
   - Verifique se as alterações de cores e textos refletem no iframe sem erros de console.
3. **Teste de Deploy:**
   - Execute o deploy em um roteador de bancada ou em ambiente de testes e valide o login por voucher real.
