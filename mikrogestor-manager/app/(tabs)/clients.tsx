import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Switch,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  managerService,
  BlockedClientItem,
  HotspotUserItem,
} from '../../services/manager.service';

export default function ClientsScreen() {
  const [activeTab, setActiveTab] = useState<'blocked' | 'active'>('blocked');
  const [blockedList, setBlockedList] = useState<BlockedClientItem[]>([]);
  const [activeUsers, setActiveUsers] = useState<HotspotUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estado do Modal de Desbloqueio
  const [selectedBlocked, setSelectedBlocked] = useState<BlockedClientItem | null>(null);
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [unblockNote, setUnblockNote] = useState('');
  const [unblocking, setUnblocking] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    mac: string;
    autoLoginLink: string;
    username: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === 'blocked') {
        const data = await managerService.getBlockedClients();
        setBlockedList(data);
      } else {
        const data = await managerService.getHotspotUsers();
        setActiveUsers(data);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleConfirmUnblock() {
    if (!selectedBlocked) return;
    setUnblocking(true);

    try {
      const res = await managerService.unblockClient({
        id: selectedBlocked.id,
        mac: selectedBlocked.mac,
        note: unblockNote || 'Desbloqueio pelo MikroGestor Manager',
        notifyWhatsApp,
      });

      if (res.success) {
        setSuccessInfo({
          mac: res.data.mac,
          autoLoginLink: res.data.autoLoginLink,
          username: res.data.username,
        });

        // Remove imediatamente da lista local
        setBlockedList((prev) => prev.filter((item) => item.id !== selectedBlocked.id));
        setSelectedBlocked(null);
        setUnblockNote('');
      } else {
        Alert.alert('Erro', res.message || 'Falha ao desbloquear cliente.');
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || err.message || 'Falha na requisição.');
    } finally {
      setUnblocking(false);
    }
  }

  async function handleKickUser(username: string, mac?: string) {
    Alert.alert(
      'Encerrar Sessão',
      `Deseja derrubar a conexão de ${username}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Derrubar',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await managerService.kickClient({ username, mac });
              if (res.success) {
                Alert.alert('Sucesso', 'Sessão encerrada com sucesso no MikroTik.');
                loadData();
              }
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Falha ao derrubar sessão.');
            }
          },
        },
      ]
    );
  }

  function renderBlockedCard({ item }: { item: BlockedClientItem }) {
    const formattedDate = item.blockedAt
      ? new Date(item.blockedAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.blockedBadge}>
              <MaterialCommunityIcons name="timer-sand" size={14} color="#EF4444" />
              <Text style={styles.blockedBadgeText}>15 MIN EXPIRADO</Text>
            </View>
            <Text style={styles.cardTitle}>{item.name}</Text>
          </View>
          <Text style={styles.timeText}>{formattedDate}</Text>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="network-outline" size={16} color="#64748B" />
            <Text style={styles.detailLabel}>MAC:</Text>
            <Text style={styles.detailValueBold}>{item.mac}</Text>
          </View>

          {item.phone ? (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="whatsapp" size={16} color="#10B981" />
              <Text style={styles.detailLabel}>WhatsApp:</Text>
              <Text style={styles.detailValue}>{item.phone}</Text>
            </View>
          ) : null}

          {item.cpf ? (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="card-account-details-outline" size={16} color="#64748B" />
              <Text style={styles.detailLabel}>CPF:</Text>
              <Text style={styles.detailValue}>{item.cpf}</Text>
            </View>
          ) : null}
        </View>

        {/* Botão de Desbloqueio Facilitado */}
        <TouchableOpacity
          style={styles.unblockButton}
          onPress={() => setSelectedBlocked(item)}
        >
          <MaterialCommunityIcons name="lock-open-check-outline" size={20} color="#FFFFFF" />
          <Text style={styles.unblockButtonText}>Desbloquear Cliente Agora</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderActiveUserCard({ item }: { item: HotspotUserItem }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.activeBadge}>
              <MaterialCommunityIcons name="wifi-check" size={14} color="#10B981" />
              <Text style={styles.activeBadgeText}>ONLINE</Text>
            </View>
            <Text style={styles.cardTitle}>{item.name}</Text>
          </View>
          <TouchableOpacity
            style={styles.kickIconButton}
            onPress={() => handleKickUser(item.name, item.macAddress)}
          >
            <MaterialCommunityIcons name="close-circle-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardDetails}>
          {item.address ? (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="ip-network-outline" size={16} color="#64748B" />
              <Text style={styles.detailLabel}>IP:</Text>
              <Text style={styles.detailValue}>{item.address}</Text>
            </View>
          ) : null}

          {item.macAddress ? (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="network-outline" size={16} color="#64748B" />
              <Text style={styles.detailLabel}>MAC:</Text>
              <Text style={styles.detailValue}>{item.macAddress}</Text>
            </View>
          ) : null}

          {item.uptime ? (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#64748B" />
              <Text style={styles.detailLabel}>Tempo Online:</Text>
              <Text style={styles.detailValue}>{item.uptime}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Central de Clientes</Text>
        <Text style={styles.headerSubtitle}>Monitoramento & Desbloqueio Rápido</Text>

        {/* Abas Segmentadas */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'blocked' && styles.tabButtonActive]}
            onPress={() => setActiveTab('blocked')}
          >
            <MaterialCommunityIcons
              name="shield-alert-outline"
              size={18}
              color={activeTab === 'blocked' ? '#EF4444' : '#64748B'}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'blocked' && { color: '#F8FAFC', fontWeight: 'bold' },
              ]}
            >
              Bloqueados (15 min)
            </Text>
            {blockedList.length > 0 ? (
              <View style={styles.counterBadge}>
                <Text style={styles.counterBadgeText}>{blockedList.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'active' && styles.tabButtonActive]}
            onPress={() => setActiveTab('active')}
          >
            <MaterialCommunityIcons
              name="wifi-check"
              size={18}
              color={activeTab === 'active' ? '#10B981' : '#64748B'}
            />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'active' && { color: '#F8FAFC', fontWeight: 'bold' },
              ]}
            >
              Conectados no Hotspot
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Alerta de Sucesso após desbloqueio */}
      {successInfo ? (
        <View style={styles.successBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
            <Text style={styles.successTitle}>Cliente Desbloqueado com Sucesso!</Text>
          </View>
          <Text style={styles.successSubtext}>
            MAC {successInfo.mac} liberado no MikroTik. Usuário: {successInfo.username}
          </Text>
          <Text style={styles.autoLoginText}>Link: {successInfo.autoLoginLink}</Text>
          <TouchableOpacity
            style={styles.dismissSuccessBtn}
            onPress={() => setSuccessInfo(null)}
          >
            <Text style={styles.dismissSuccessText}>Fechar aviso</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Conteúdo da Lista */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Carregando clientes...</Text>
        </View>
      ) : activeTab === 'blocked' ? (
        <FlatList
          data={blockedList}
          keyExtractor={(item) => item.id}
          renderItem={renderBlockedCard}
          contentContainerStyle={styles.listContent}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="check-decagram-outline" size={60} color="#10B981" />
              <Text style={styles.emptyTitle}>Nenhum cliente bloqueado!</Text>
              <Text style={styles.emptySubtitle}>
                Todos os clientes cadastrados efetuaram o pagamento ou estão dentro da cortesia.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={activeUsers}
          keyExtractor={(item, index) => item.id || String(index)}
          renderItem={renderActiveUserCard}
          contentContainerStyle={styles.listContent}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="wifi-off" size={60} color="#64748B" />
              <Text style={styles.emptyTitle}>Nenhum cliente ativo no momento</Text>
            </View>
          }
        />
      )}

      {/* Modal de Desbloqueio Facilitado */}
      <Modal
        visible={!!selectedBlocked}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBlocked(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="lock-open-check" size={28} color="#10B981" />
              <Text style={styles.modalTitle}>Desbloquear Cliente</Text>
            </View>

            <Text style={styles.modalDescription}>
              Confirma a liberação do acesso para <Text style={{ fontWeight: 'bold' }}>{selectedBlocked?.name}</Text>?
            </Text>

            <View style={styles.modalDetailsBox}>
              <Text style={styles.modalDetailText}>MAC: {selectedBlocked?.mac}</Text>
              {selectedBlocked?.phone ? (
                <Text style={styles.modalDetailText}>WhatsApp: {selectedBlocked.phone}</Text>
              ) : null}
            </View>

            {/* Switch Notificar WhatsApp com link de 1 clique */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Notificar via WhatsApp</Text>
                <Text style={styles.switchSubtitle}>
                  Envia link de auto-login com 1 clique e credenciais de acesso
                </Text>
              </View>
              <Switch
                value={notifyWhatsApp}
                onValueChange={setNotifyWhatsApp}
                trackColor={{ false: '#334155', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Observação Opcional */}
            <TextInput
              style={styles.modalInput}
              placeholder="Observação (Ex: Pagou no balcão)"
              placeholderTextColor="#64748B"
              value={unblockNote}
              onChangeText={setUnblockNote}
            />

            {/* Botões do Modal */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSelectedBlocked(null)}
                disabled={unblocking}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmUnblock}
                disabled={unblocking}
              >
                {unblocking ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirmar e Desbloquear</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#0F172A',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  counterBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  counterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    marginBottom: 6,
  },
  blockedBadgeText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: 'bold',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    marginBottom: 6,
  },
  activeBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  cardDetails: {
    gap: 6,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  detailValue: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  detailValueBold: {
    fontSize: 13,
    color: '#F1F5F9',
    fontWeight: 'bold',
  },
  kickIconButton: {
    padding: 4,
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  unblockButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.3)',
    padding: 14,
  },
  successTitle: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: 'bold',
  },
  successSubtext: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 4,
  },
  autoLoginText: {
    color: '#6EE7B7',
    fontSize: 11,
    marginTop: 2,
  },
  dismissSuccessBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  dismissSuccessText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  modalDescription: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalDetailsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 4,
  },
  modalDetailText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  switchSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    padding: 12,
    fontSize: 14,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
