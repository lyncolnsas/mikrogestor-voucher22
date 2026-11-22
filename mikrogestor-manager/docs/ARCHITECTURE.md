## Arquitetura Técnica — MikroGestor Manager

### Padrão de Comunicação

```
App (React Native)
    └─► Axios Instance (Bearer JWT)
            └─► VPS HTTPS API (mikrogestor.com)
                    ├─► Prisma SQLite (dados locais)
                    └─► RouterOS API Proxy → MikroTik 10.8.0.2
```

### Gestão de Estado

- **Zustand**: Estado global (token, configurações, roteador ativo)
- **React Query**: Cache e sincronização de dados remotos (clientes, stats, saúde)
- **Local**: React `useState` para UI local (modais, forms)

### Fluxo de Desbloqueio (P0)

```
Operador toca [Desbloquear]
    └─► Modal de confirmação
            └─► POST /api/manager/unblock-client { mac, routerId }
                    └─► Backend:
                            1. mk.write(['/ip/hotspot/ip-binding/remove', mac])
                            2. mk.write(['/ip/hotspot/user/add', username, password, limitUptime])
                            3. whatsappService.send(phone, linkAutologin)
                            4. prisma.blockedClient.update({ active: false })
                    └─► App: Toast sucesso + remove card da lista
```

### Build para Distribuição

```bash
# APK para Android (distribuição direta, sem Play Store)
eas build --platform android --profile preview

# APK assinado para Play Store
eas build --platform android --profile production
```

### Segurança

| Item | Implementação |
|------|--------------|
| Token JWT | Expo SecureStore (keychain nativo) |
| Comunicação | HTTPS obrigatório (certificate pinning opcional) |
| Credenciais RB | Nunca no app — ficam no backend |
| Timeout | 15s para chamadas de API |
