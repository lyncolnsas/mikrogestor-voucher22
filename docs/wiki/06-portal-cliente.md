# 📱 Portal do Cliente & Portal Studio

> **← [Voltar ao Índice](./README.md)**

O **Portal do Cliente** é a interface de autenticação exibida no navegador do smartphone ou computador do usuário quando ele se conecta à rede Wi-Fi. O MikroTik intercepta a navegação e exibe esta página para login, liberação de teste ou compra de planos.

Toda a personalização visual deste portal é gerenciada no **Portal Studio** (`/dashboard/portal`).

---

## 1. Fluxo de Experiência do Cliente

```
Cliente conecta no Wi-Fi
         │
         ▼
MikroTik intercepta navegação → Abre o Portal
         │
         ▼
    ┌────────────┐
    │  Login /   │ ← Possui voucher? Digita e conecta imediatamente
    │  Boas-Vinda│ ← Deseja testar? Clica no botão de cortesia (15 min)
    └─────┬──────┘
          │ Não possui voucher
          ▼
    ┌────────────┐
    │  Cadastro  │ ← Informa Nome e WhatsApp / CPF
    │  de Leads  │
    └─────┬──────┘
          │
          ▼
    ┌────────────┐
    │ Aceite dos │ ← OBRIGATÓRIO: Botão bloqueado até marcar o aceite
    │   Termos   │
    └─────┬──────┘
          │
          ├─ Modo 100% Gratuito ────► Acesso liberado imediatamente
          │
          └─ Modo Venda via PIX ────► Escolhe plano → Paga via PIX no banco → Desbloqueio automático
```

---

## 2. O Editor Visual: Portal Studio (`/dashboard/portal`)

O administrador customiza o portal em tempo real acessando **Menu Lateral → Portal Studio**:

### Painéis de Configuração Disponíveis:

| Aba | Descrição |
| :--- | :--- |
| **Blocos** | Reorganiza e ativa/desativa seções (Voucher, Boas-Vindas, Banner, Rodapé, etc.). |
| **Identidade** | Personalização de logotipo, tipografia, efeitos de fundo (58 temas) e cores. |
| **Autenticação** | Configuração dos métodos de login, tempo do botão de cortesia (trial) e rótulos. |
| **Leads** | Escolha dos campos obrigatórios e opcionais no formulário de cadastro. |
| **Anúncios** | Configuração de vídeos e banners com contagem regressiva obrigatória (skip timer). |
| **Walled Garden** | Liberações de domínios pré-login e botão flutuante de atendimento WhatsApp. |
| **CSS Pro** | Injeção de folhas de estilo customizadas para personalização avançada. |
| **Provisionamento** | Auditoria e configuração automatizada do hotspot diretamente no MikroTik. |

---

## 3. Templates Disponíveis no Sistema

O sistema conta com templates profissionais prontos para uso em `hotspot/`:
- **Default (Cyber Dark)** — Tema dark premium com cantos pill, fibra óptica e visual de alta tecnologia.
- **FAP Campus** — Identidade acadêmica formal, contraste em dourado e azul marinho com foco em captação de leads.
- **OLIMPORI (3D Natureza & Animais)** — Tema imersivo com canvas animado de animais em 3D para eventos campestres.
- **Bubblegum Hardcore** — Visual neo-brutalist pop vibrante com alto contraste.

> Para detalhes de desenvolvimento ou criação de novos templates, consulte o [Guia de Criação de Templates de Hotspot](../GUIA_CRIACAO_TEMPLATES_HOTSPOT.md) e a [Arquitetura do Hotspot Visual CMS](../ARQUITETURA_HOTSPOT_VISUAL_CMS.md).

---

## 4. Termos de Uso e Aceite Obrigatório

O cliente **não pode concluir o acesso** sem aceitar expressamente os termos:
- ☐ Termos não aceitos → Botão desabilitado com aviso de bloqueio.
- ☑ Termos aceitos → Botão habilitado com liberação imediata ou geração do PIX.

---

## 5. Segurança Anti-Fraude e Anti-Burla

O portal integra-se com as regras de firewall do MikroTik:
1. **Verificação de Blacklist:** CPF ou Telefone com débitos ou bloqueados recebem HTTP 403 e têm o MAC bloqueado no MikroTik (`/ip/hotspot/ip-binding`).
2. **Anti-Tethering:** Injeção de regra Mangle TTL=1 para impedir revenda e compartilhamento não autorizado de internet via Hotspot móvel.
3. **Lockdown de 15 Minutos:** Carência temporária para pagamento PIX; se não houver pagamento, a conexão é encerrada categoricamente.

---

## Relacionado

- [03 — Hotspot & Planos](./03-hotspot-planos.md)
- [08 — VPN WireGuard](./08-vpn-wireguard.md)
- [09 — Segurança & Anti-Burla](./09-seguranca.md)

---
*← [Anterior: WhatsApp](./05-whatsapp.md) · [Próximo: Financeiro →](./07-financeiro.md)*
