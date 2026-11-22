# Mapa de Telas — MikroGestor Manager

## Fluxo de Navegação

```
Splash Screen
    └─► Login
            └─► Tab Bar Principal
                    ├─► [1] Dashboard
                    │       ├─► Card Status VPN
                    │       ├─► Card Clientes Ativos
                    │       ├─► Card Bloqueados (badge vermelho)
                    │       ├─► Card Receita Hoje
                    │       └─► Feed de Alertas
                    │
                    ├─► [2] Clientes
                    │       ├─► Lista Ativos (tab)
                    │       │       └─► Detalhe do Cliente
                    │       │               ├─► Kick Sessão
                    │       │               └─► Enviar WhatsApp
                    │       └─► Lista Bloqueados (tab) ★ P0
                    │               └─► Modal Desbloquear
                    │                       └─► Confirmação → Toast Sucesso
                    │
                    ├─► [3] Rede
                    │       ├─► Gráfico Tráfego Tempo Real
                    │       ├─► Top Clientes por Consumo
                    │       └─► Saúde RouterBoard
                    │               ├─► CPU (gauge)
                    │               ├─► RAM (barra)
                    │               ├─► Temperatura (termômetro)
                    │               └─► Uptime
                    │
                    ├─► [4] CMS
                    │       ├─► Planos (lista + botão +)
                    │       │       └─► Editor de Plano (nome, preço, duração)
                    │       ├─► Templates WhatsApp
                    │       │       └─► Editor de Texto com tags
                    │       ├─► Portal (logo, cores, campos)
                    │       └─► Leads
                    │               └─► Lista com filtros + Exportar CSV
                    │
                    └─► [5] Config
                            ├─► URL da API
                            ├─► Notificações Push
                            ├─► Tema (Claro/Escuro)
                            ├─► Logout
                            └─► Versão do App
```

## Paleta de Cores

| Elemento | Cor |
|---------|-----|
| Primária | `#1E40AF` (azul MikroGestor) |
| Sucesso | `#16A34A` (verde) |
| Alerta | `#D97706` (laranja) |
| Crítico | `#DC2626` (vermelho) |
| Background Dark | `#0F172A` |
| Card Dark | `#1E293B` |

## Ícone do App

Logo do MikroGestor com fundo escuro `#0F172A`, bordas arredondadas padrão Android/iOS.
Nome exibido abaixo: **MG Manager**
