import { api, setAuthToken, setBaseUrl } from './api';

export interface BlockedClientItem {
  id: string;
  mac: string;
  cpf?: string | null;
  phone?: string | null;
  name: string;
  reason: string;
  blockedAt: string;
  routerId?: string | null;
  paymentId?: string | null;
  paymentStatus?: string;
  hotspotUser?: string | null;
  profile?: string | null;
}

export interface RouterHealthData {
  routerId: string;
  routerName: string;
  host: string;
  online: boolean;
  model: string;
  serialNumber: string;
  version: string;
  uptime: string;
  cpu: {
    loadPercent: number;
    frequencyMhz: number;
    count: number;
  };
  memory: {
    freeBytes: number;
    totalBytes: number;
    usedBytes: number;
    usedPercent: number;
  };
  storage: {
    freeHdd: number;
    totalHdd: number;
  };
  health: {
    temperature: number | null;
    voltage: number | null;
  };
  activeHotspotCount: number;
  checkedAt: string;
  message?: string;
}

export interface InterfaceTraffic {
  name: string;
  type: string;
  macAddress: string | null;
  rxBps: number;
  txBps: number;
  rxPackets?: number;
  txPackets?: number;
}

export interface TrafficRealtimeData {
  online: boolean;
  timestamp: string;
  totalRxBps: number;
  totalTxBps: number;
  interfaces: InterfaceTraffic[];
  message?: string;
}

export interface HotspotUserItem {
  id?: string;
  name: string;
  profile?: string;
  uptime?: string;
  bytesIn?: number;
  bytesOut?: number;
  address?: string;
  macAddress?: string;
  comment?: string;
}

export interface DashboardStatsData {
  onlineUsers?: number;
  totalLeads?: number;
  blockedCount?: number;
  revenueToday?: number;
  activeRouters?: number;
  vpnOnline?: boolean;
}

export const managerService = {
  // Autenticação
  async login(username: string, password: string, serverUrl?: string) {
    if (serverUrl) {
      await setBaseUrl(serverUrl);
    }
    const response = await api.post('/api/auth/login', { username, password });
    if (response.data.success && response.data.token) {
      await setAuthToken(response.data.token);
    }
    return response.data;
  },

  async logout() {
    await setAuthToken(null);
  },

  // Dashboard
  async getDashboardStats(): Promise<DashboardStatsData> {
    try {
      const [statsRes, blockedRes] = await Promise.allSettled([
        api.get('/api/dashboard/stats'),
        api.get('/api/manager/blocked-clients'),
      ]);

      const stats = statsRes.status === 'fulfilled' ? statsRes.value.data : {};
      const blocked = blockedRes.status === 'fulfilled' ? blockedRes.value.data : { total: 0 };

      return {
        onlineUsers: stats.activeUsers || stats.onlineHotspotUsers || 0,
        totalLeads: stats.totalLeads || 0,
        blockedCount: blocked.total || (Array.isArray(blocked.data) ? blocked.data.length : 0),
        revenueToday: stats.todayRevenue || stats.revenueToday || 0,
        vpnOnline: stats.vpnOnline ?? true,
      };
    } catch {
      return { onlineUsers: 0, blockedCount: 0, revenueToday: 0 };
    }
  },

  // Central de Bloqueados e Desbloqueio
  async getBlockedClients(): Promise<BlockedClientItem[]> {
    const res = await api.get('/api/manager/blocked-clients');
    return res.data.data || [];
  },

  async unblockClient(params: {
    mac?: string;
    id?: string;
    note?: string;
    notifyWhatsApp?: boolean;
  }) {
    const res = await api.post('/api/manager/unblock-client', params);
    return res.data;
  },

  // Clientes Hotspot Ativos
  async getHotspotUsers(): Promise<HotspotUserItem[]> {
    try {
      const res = await api.get('/api/hotspot/users');
      return Array.isArray(res.data) ? res.data : (res.data.users || res.data.data || []);
    } catch {
      return [];
    }
  },

  async kickClient(params: { username?: string; mac?: string }) {
    const res = await api.post('/api/manager/kick-client', params);
    return res.data;
  },

  // Saúde da RouterBoard e Tráfego
  async getRouterHealth(routerId?: string): Promise<RouterHealthData> {
    const res = await api.get('/api/manager/router-health', {
      params: routerId ? { routerId } : undefined,
    });
    return res.data.data;
  },

  async getTrafficRealtime(routerId?: string): Promise<TrafficRealtimeData> {
    const res = await api.get('/api/manager/traffic-realtime', {
      params: routerId ? { routerId } : undefined,
    });
    return res.data.data;
  },

  // CMS: Planos Hotspot
  async getPlans() {
    const res = await api.get('/api/whatsapp-plans');
    return Array.isArray(res.data) ? res.data : (res.data.plans || res.data.data || []);
  },

  async createPlan(data: { title: string; price: number; durationMinutes?: number; profile?: string }) {
    const res = await api.post('/api/whatsapp-plans', data);
    return res.data;
  },

  async deletePlan(id: string) {
    const res = await api.delete(`/api/whatsapp-plans/${id}`);
    return res.data;
  },

  // CMS: WhatsApp Mensagens e Templates
  async getWhatsappMessages() {
    const res = await api.get('/api/admin/whatsapp-messages');
    return res.data;
  },

  async updateWhatsappMessage(key: string, template: string) {
    const res = await api.put('/api/admin/whatsapp-messages', { key, template });
    return res.data;
  },

  // Status VPN WireGuard
  async getVpnStatus() {
    const res = await api.get('/api/vpn/status');
    return res.data;
  },
};
