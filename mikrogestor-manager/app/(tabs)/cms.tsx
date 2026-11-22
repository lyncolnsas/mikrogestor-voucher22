import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { managerService } from '../../services/manager.service';

export default function CmsScreen() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Novo Plano
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newMinutes, setNewMinutes] = useState('1440'); // 1 dia padrão
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const data = await managerService.getPlans();
      setPlans(data);
    } catch (err) {
      console.warn('Erro ao carregar planos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleCreatePlan() {
    if (!newTitle.trim() || !newPrice.trim()) {
      Alert.alert('Aviso', 'Preencha o título e o valor do plano.');
      return;
    }

    setSavingPlan(true);
    try {
      const priceFloat = parseFloat(newPrice.replace(',', '.'));
      const res = await managerService.createPlan({
        title: newTitle.trim(),
        price: isNaN(priceFloat) ? 5.0 : priceFloat,
        durationMinutes: parseInt(newMinutes, 10) || 1440,
      });

      if (res.success || res.id) {
        Alert.alert('Sucesso', 'Plano criado com sucesso!');
        setShowAddPlan(false);
        setNewTitle('');
        setNewPrice('');
        loadPlans();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || err.message || 'Falha ao salvar plano.');
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDeletePlan(id: string, title: string) {
    Alert.alert('Excluir Plano', `Deseja realmente remover o plano "${title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await managerService.deletePlan(id);
            Alert.alert('Sucesso', 'Plano excluído.');
            loadPlans();
          } catch (err: any) {
            Alert.alert('Erro', err.message || 'Falha ao excluir plano.');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>CMS & Gestão</Text>
          <Text style={styles.headerSubtitle}>Planos de Acesso & Mensagens</Text>
        </View>

        <TouchableOpacity
          style={styles.addPlanBtn}
          onPress={() => setShowAddPlan(true)}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.addPlanBtnText}>Novo Plano</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPlans();
            }}
            tintColor="#3B82F6"
          />
        }
      >
        <Text style={styles.sectionHeader}>Planos de Acesso Hotspot</Text>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : plans.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="ticket-outline" size={48} color="#64748B" />
            <Text style={styles.emptyText}>Nenhum plano cadastrado</Text>
          </View>
        ) : (
          plans.map((p) => (
            <View key={p.id} style={styles.planCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{p.title || p.name}</Text>
                <Text style={styles.planSubtitle}>
                  Duração: {p.durationMinutes ? `${Math.round(p.durationMinutes / 60)}h` : p.duration || 'Ilimitado'} • Perfil: {p.profile || 'hsprof_hotspot'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.planPrice}>
                  R$ {Number(p.price || 0).toFixed(2).replace('.', ',')}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDeletePlan(p.id, p.title || p.name)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Seção WhatsApp Templates Info */}
        <Text style={[styles.sectionHeader, { marginTop: 24 }]}>WhatsApp Custom Messages</Text>
        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <MaterialCommunityIcons name="whatsapp" size={22} color="#10B981" />
            <Text style={styles.infoCardTitle}>Envio de Auto-Login no Pix</Text>
          </View>
          <Text style={styles.infoCardDesc}>
            Ao confirmar o pagamento Pix de um cliente desbloqueado ou que pagou após os 15 minutos, a VPS gera e envia automaticamente a mensagem no WhatsApp com o link de 1 clique:
          </Text>
          <View style={styles.codeSnippetBox}>
            <Text style={styles.codeSnippetText}>
              https://fap.mikrogestor.com/login?username=...&password=...
            </Text>
          </View>
          <Text style={styles.infoCardDesc}>
            A tag <Text style={{ color: '#10B981', fontWeight: 'bold' }}>{'{link_autologin}'}</Text> está configurada no template padrão de pagamento aprovado.
          </Text>
        </View>
      </ScrollView>

      {/* Modal Adicionar Plano */}
      <Modal
        visible={showAddPlan}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddPlan(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cadastrar Novo Plano</Text>

            <Text style={styles.inputLabel}>Título do Plano</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 24 Horas de Acesso"
              placeholderTextColor="#64748B"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.inputLabel}>Valor (R$)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 5,00"
              placeholderTextColor="#64748B"
              value={newPrice}
              onChangeText={setNewPrice}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Duração em Minutos</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 1440 para 1 dia"
              placeholderTextColor="#64748B"
              value={newMinutes}
              onChangeText={setNewMinutes}
              keyboardType="numeric"
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddPlan(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreatePlan}
                disabled={savingPlan}
              >
                {savingPlan ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Salvar Plano</Text>
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
  addPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  addPlanBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  centerBox: {
    padding: 32,
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  planCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  planTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  planSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  planPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  infoCardDesc: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
    marginBottom: 10,
  },
  codeSnippetBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeSnippetText: {
    color: '#34D399',
    fontSize: 11,
    fontFamily: 'monospace',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
  modalSaveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
