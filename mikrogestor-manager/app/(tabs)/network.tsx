import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  managerService,
  RouterHealthData,
  TrafficRealtimeData,
} from '../../services/manager.service';

function formatBps(bps: number): string {
  if (bps >= 1_000_000) {
    return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  }
  if (bps >= 1_000) {
    return `${(bps / 1_000).toFixed(1)} Kbps`;
  }
  return `${bps} bps`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

export default function NetworkScreen() {
  const [health, setHealth] = useState<RouterHealthData | null>(null);
  const [traffic, setTraffic] = useState<TrafficRealtimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveMonitoring, setLiveMonitoring] = useState(true);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (liveMonitoring) {
      timerRef.current = setInterval(() => {
        loadTrafficOnly();
      }, 3000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [liveMonitoring]);

  async function loadAll() {
    try {
      const [healthData, trafficData] = await Promise.all([
        managerService.getRouterHealth().catch(() => null),
        managerService.getTrafficRealtime().catch(() => null),
      ]);
      if (healthData) setHealth(healthData);
      if (trafficData) setTraffic(trafficData);
    } catch (err) {
      console.warn('Erro ao carregar saúde/tráfego:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadTrafficOnly() {
    try {
      const trafficData = await managerService.getTrafficRealtime();
      if (trafficData) setTraffic(trafficData);
    } catch {
      // Ignora falhas transitórias no loop ao vivo
    }
  }

  const cpuLoad = health?.cpu?.loadPercent || 0;
  const cpuColor = cpuLoad > 85 ? '#EF4444' : cpuLoad > 60 ? '#F59E0B' : '#10B981';

  const memPercent = health?.memory?.usedPercent || 0;
  const memColor = memPercent > 85 ? '#EF4444' : memPercent > 60 ? '#F59E0B' : '#3B82F6';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Saúde da RB & Tráfego</Text>
          <Text style={styles.headerSubtitle}>
            Monitoramento de Hardware & Velocidade
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.liveBadge, liveMonitoring && styles.liveBadgeActive]}
          onPress={() => setLiveMonitoring(!liveMonitoring)}
        >
          <View
            style={[
              styles.liveDot,
              { backgroundColor: liveMonitoring ? '#10B981' : '#64748B' },
            ]}
          />
          <Text style={styles.liveText}>
            {liveMonitoring ? 'AO VIVO (3s)' : 'PAUSADO'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadAll();
            }}
            tintColor="#3B82F6"
          />
        }
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Consultando MikroTik via WireGuard...</Text>
          </View>
        ) : (
          <>
            {/* CARD: VELOCIDADE & CONSUMO EM TEMPO REAL */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="speedometer" size={22} color="#3B82F6" />
                <Text style={styles.cardTitle}>Velocidade Instantânea Total</Text>
              </View>

              <View style={styles.trafficSpeedRow}>
                {/* Download */}
                <View style={styles.speedBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialCommunityIcons name="arrow-down-bold" size={20} color="#10B981" />
                    <Text style={styles.speedLabel}>Download (RX)</Text>
                  </View>
                  <Text style={[styles.speedValue, { color: '#10B981' }]}>
                    {formatBps(traffic?.totalRxBps || 0)}
                  </Text>
                </View>

                {/* Upload */}
                <View style={styles.speedBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialCommunityIcons name="arrow-up-bold" size={20} color="#3B82F6" />
                    <Text style={styles.speedLabel}>Upload (TX)</Text>
                  </View>
                  <Text style={[styles.speedValue, { color: '#3B82F6' }]}>
                    {formatBps(traffic?.totalTxBps || 0)}
                  </Text>
                </View>
              </View>

              {/* Lista de Interfaces */}
              <Text style={styles.subSectionTitle}>Tráfego por Interface</Text>
              {(traffic?.interfaces || []).map((iface, idx) => (
                <View key={iface.name || idx} style={styles.ifaceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ifaceName}>{iface.name}</Text>
                    <Text style={styles.ifaceType}>{iface.type || 'ethernet'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.ifaceSpeed, { color: '#10B981' }]}>
                      ↓ {formatBps(iface.rxBps || 0)}
                    </Text>
                    <Text style={[styles.ifaceSpeed, { color: '#3B82F6' }]}>
                      ↑ {formatBps(iface.txBps || 0)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* CARD: SAÚDE DO HARDWARE (CPU, RAM, TEMP) */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="cpu-64-bit" size={22} color="#A855F7" />
                <Text style={styles.cardTitle}>Saúde da RouterBoard (Hardware)</Text>
              </View>

              {/* Informações Gerais da RB */}
              <View style={styles.rbInfoGrid}>
                <View style={styles.rbInfoItem}>
                  <Text style={styles.rbInfoLabel}>Modelo</Text>
                  <Text style={styles.rbInfoValue}>{health?.model || 'MikroTik'}</Text>
                </View>
                <View style={styles.rbInfoItem}>
                  <Text style={styles.rbInfoLabel}>RouterOS</Text>
                  <Text style={styles.rbInfoValue}>{health?.version || 'v7'}</Text>
                </View>
                <View style={styles.rbInfoItem}>
                  <Text style={styles.rbInfoLabel}>Uptime</Text>
                  <Text style={styles.rbInfoValue}>{health?.uptime || 'N/A'}</Text>
                </View>
                <View style={styles.rbInfoItem}>
                  <Text style={styles.rbInfoLabel}>Clientes Hotspot</Text>
                  <Text style={styles.rbInfoValue}>{health?.activeHotspotCount || 0}</Text>
                </View>
              </View>

              {/* Barra de CPU */}
              <View style={styles.meterContainer}>
                <View style={styles.meterHeader}>
                  <Text style={styles.meterTitle}>Uso de CPU ({health?.cpu?.count || 1} core)</Text>
                  <Text style={[styles.meterValue, { color: cpuColor }]}>{cpuLoad}%</Text>
                </View>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(cpuLoad, 100)}%`, backgroundColor: cpuColor },
                    ]}
                  />
                </View>
              </View>

              {/* Barra de Memória RAM */}
              <View style={styles.meterContainer}>
                <View style={styles.meterHeader}>
                  <Text style={styles.meterTitle}>
                    Memória RAM ({formatBytes(health?.memory?.freeBytes || 0)} livre)
                  </Text>
                  <Text style={[styles.meterValue, { color: memColor }]}>{memPercent}%</Text>
                </View>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(memPercent, 100)}%`, backgroundColor: memColor },
                    ]}
                  />
                </View>
                <Text style={styles.memDetailsSubtext}>
                  Total: {formatBytes(health?.memory?.totalBytes || 0)} • Usado:{' '}
                  {formatBytes(health?.memory?.usedBytes || 0)}
                </Text>
              </View>

              {/* Sensores de Temperatura / Tensão (se suportado) */}
              {health?.health?.temperature || health?.health?.voltage ? (
                <View style={styles.sensorsRow}>
                  {health.health.temperature ? (
                    <View style={styles.sensorItem}>
                      <MaterialCommunityIcons name="thermometer" size={20} color="#F59E0B" />
                      <Text style={styles.sensorValue}>{health.health.temperature}°C</Text>
                      <Text style={styles.sensorLabel}>Temperatura</Text>
                    </View>
                  ) : null}

                  {health.health.voltage ? (
                    <View style={styles.sensorItem}>
                      <MaterialCommunityIcons name="lightning-bolt" size={20} color="#3B82F6" />
                      <Text style={styles.sensorValue}>{health.health.voltage}V</Text>
                      <Text style={styles.sensorLabel}>Tensão</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        )}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  liveBadgeActive: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  trafficSpeedRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  speedBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  speedLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  speedValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 6,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ifaceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  ifaceName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  ifaceType: {
    fontSize: 11,
    color: '#64748B',
  },
  ifaceSpeed: {
    fontSize: 12,
    fontWeight: '600',
  },
  rbInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  rbInfoItem: {
    width: '48%',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rbInfoLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  rbInfoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginTop: 2,
  },
  meterContainer: {
    marginBottom: 16,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  meterTitle: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  meterValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: '#0F172A',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  memDetailsSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  sensorsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 14,
  },
  sensorItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 10,
  },
  sensorValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  sensorLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
