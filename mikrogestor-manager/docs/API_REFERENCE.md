# Referência de APIs — MikroGestor Manager

> Base URL: `https://mikrogestor.com`  
> Autenticação: `Authorization: Bearer <JWT>`

---

## Auth

### Login
```
POST /api/auth/login
Body: { "username": "admin", "password": "..." }
Response: { "token": "JWT...", "expiresIn": 86400 }
```

---

## Dashboard

### Stats
```
GET /api/dashboard/stats
Response: { "activeClients": 12, "blockedClients": 3, "revenueToday": 45.00, ... }
```

### Leads
```
GET /api/dashboard/leads?page=1&limit=20
Response: { "leads": [...], "total": 150 }
```

---

## Clientes Hotspot

### Listar Usuários Hotspot
```
GET /api/hotspot/users
Response: [{ "username": "...", "mac": "...", "ip": "...", "uptime": "...", "bytesIn": 0, "bytesOut": 0 }]
```

---

## Manager (Endpoints Novos a Criar)

### Clientes Bloqueados
```
GET /api/manager/blocked-clients
Response: [{
  "mac": "9A:1E:3E:0D:8C:34",
  "name": "Lyncoln Samuel",
  "phone": "+5511...",
  "blockedAt": "2026-11-22T01:30:00Z",
  "routerId": "router-fap",
  "paymentId": "ec8c588e..."
}]
```

### Desbloquear Cliente
```
POST /api/manager/unblock-client
Body: { "mac": "9A:1E:3E:0D:8C:34", "routerId": "router-fap", "note": "Manual app" }
Response: { "success": true, "autoLoginLink": "https://fap.mikrogestor.com/login?username=...&password=..." }
```

### Kick de Sessão
```
POST /api/manager/kick-client
Body: { "username": "lyncoln", "routerId": "router-fap" }
Response: { "success": true }
```

### Saúde do RouterBoard
```
GET /api/manager/router-health?routerId=router-fap
Response: {
  "cpu": 12,
  "freeMemory": 45678912,
  "totalMemory": 67108864,
  "temperature": 48.5,
  "voltage": 24.0,
  "uptime": "3d 2h 15m",
  "version": "7.14.3",
  "model": "RB941-2nD"
}
```

### Tráfego em Tempo Real
```
GET /api/manager/traffic-realtime?routerId=router-fap
Response: {
  "interfaces": [
    { "name": "ether1", "rxBps": 1234567, "txBps": 234567 }
  ],
  "topClients": [
    { "mac": "...", "name": "...", "rxBytes": 123456789 }
  ],
  "timestamp": "2026-11-22T01:30:00Z"
}
```

---

## CMS

### Planos WhatsApp
```
GET  /api/whatsapp-plans
POST /api/whatsapp-plans           Body: { "title": "...", "price": 5.00, "durationMinutes": 1440 }
PUT  /api/whatsapp-plans/:id       Body: { "price": 7.00 }
DELETE /api/whatsapp-plans/:id
```

### Templates de Mensagem
```
GET /api/admin/whatsapp-messages
PUT /api/admin/whatsapp-messages   Body: { "key": "WA_MSG_PAYMENT_APPROVED_HOTSPOT", "template": "..." }
```

### Config do Portal
```
GET /api/portal/config
PUT /api/portal/config             Body: { "wifiName": "...", "welcomeText": "..." }
```

### Leads
```
GET /api/portal/admin/leads?page=1&status=paid
GET /api/portal/export             (CSV download)
```

---

## VPN / Roteadores

### Status WireGuard
```
GET /api/vpn/status
Response: { "peers": [{ "name": "fap", "ip": "10.8.0.2", "online": true, "latencyMs": 12 }] }
```

### Lista de Roteadores
```
GET /api/system/routers
Response: [{ "id": "router-fap", "name": "FAP", "vpnIp": "10.8.0.2", "slug": "fap" }]
```

---

## WhatsApp

### Status das Instâncias
```
GET /api/whatsapp/status
Response: { "instances": [{ "id": 1, "phone": "+55...", "status": "open" }] }
```

---

*Atualizado: 22/11/2026*
