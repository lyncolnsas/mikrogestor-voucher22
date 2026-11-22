import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { managerService, DashboardStatsData } from '../../services/manager.service';

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStatsData>({
    onlineUsers: 0,
    blockedCount: 0,
    revenueToday: 0,
    vpnOnline: true,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    // Auto-refresh a cada 20 segundos
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const data = await managerService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.warn('Erro ao carregar stats do dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header Superior */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Painel de Controle</Text>
          <Text style={styles.headerTitle}>MikroGestor Manager</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            loadData();
          }}
        >
          <MaterialCommunityIcons name="refresh" size={22} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Banner de Status VPN */}
        <View style={styles.vpnBanner}>
          <View style={styles.vpnIndicatorRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: stats.vpnOnline ? '#10B981' : '#EF4444' },
              ]}
            />
            <Text style={styles.vpnText}>
              WireGuard VPN: {stats.vpnOnline ? 'Conectado (10.8.0.0/24)' : 'Desconectado'}
            </Text>
          </View>
          <Text style={styles.vpnSubtext}>MikroTik RouterOS v7 • Proxy Seguro</Text>
        </View>

        {/* ALERTA CRÍTICO: Clientes Bloqueados por Cortesia de 15 Minutos */}
        {(stats.blockedCount || 0) > 0 ? (
          <TouchableOpacity
            style={styles.blockedAlertCard}
            onPress={() => router.push('/(tabs)/clients')}
          >
            <View style={styles.alertIconCircle}>
              <MaterialCommunityIcons name="shield-alert-outline" size={28} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertCardTitle}>
                {stats.blockedCount} Cliente(s) Bloqueado(s)
              </Text>
              <Text style={styles.alertCardSubtitle}>
                Tempo de cortesia (15 min) expirado sem pagamento Pix. Toque para gerenciar e desbloquear.
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#EF4444" />
          </TouchableOpacity>
        ) : null}

        {/* Grid de Métricas Principais */}
        <View style={styles.statsGrid}>
          {/* Clientes Ativos */}
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <MaterialCommunityIcons name="wifi-check" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{stats.onlineUsers || 0}</Text>
            <Text style={styles.statLabel}>Clientes Conectados</Text>
          </View>

          {/* Bloqueados */}
          <TouchableOpacity
            style={[styles.statCard, (stats.blockedCount || 0) > 0 && styles.statCardAlert]}
            onPress={() => router.push('/(tabs)/clients')}
          >
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <MaterialCommunityIcons name="account-cancel-outline" size={24} color="#EF4444" />
            </View>
            <Text style={[styles.statValue, (stats.blockedCount || 0) > 0 && { color: '#EF4444' }]}>
              {stats.blockedCount || 0}
            </Text>
            <Text style={styles.statLabel}>Bloqueados (15 min)</Text>
          </TouchableOpacity>

          {/* Receita Hoje */}
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <MaterialCommunityIcons name="currency-usd" size={24} color="#10B981" />
            </View>
            <Text style={styles.statValue}>
              R$ {Number(stats.revenueToday || 0).toFixed(2).replace('.', ',')}
            </Text>
            <Text style={styles.statLabel}>Receita Pix Hoje</Text>
          </View>

          {/* Saúde do Roteador */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/(tabs)/network')}
          >
            <View style={[styles.statIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <MaterialCommunityIcons name="cpu-64-bit" size={24} color="#A855F7" />
            </View>
            <Text style={styles.statValue}>Monitor</Text>
            <Text style={styles.statLabel}>Saúde RB & Tráfego</Text>
          </TouchableOpacity>
        </View>

        {/* Ações Rápidas */}
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.quickActionsList}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/(tabs)/clients')}
          >
            <MaterialCommunityIcons name="lock-open-check-outline" size={22} color="#10B981" />
            <Text style={styles.quickActionText}>Desbloquear Cliente</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/(tabs)/network')}
          >
            <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={22} color="#3B82F6" />
            <Text style={styles.quickActionText}>Visualizar Consumo e Velocidade</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/(tabs)/cms')}
          >
            <MaterialCommunityIcons name="ticket-percent-outline" size={22} color="#F59E0B" />
            <Text style={styles.quickActionText}>Gerenciar Planos e Templates WhatsApp</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  welcomeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  vpnBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  vpnIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  vpnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  vpnSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  blockedAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginBottom: 20,
    gap: 12,
  },
  alertIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F87171',
  },
  alertCardSubtitle: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
    lineHeight: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statCardAlert: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  statIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  quickActionsList: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 12,
  },
  quickActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#E2E8F0',
  },
});
