import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getBaseUrl, setBaseUrl, setAuthToken } from '../../services/api';
import { managerService } from '../../services/manager.service';

export default function SettingsScreen() {
  const [serverUrl, setServerUrlState] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);

  useEffect(() => {
    getBaseUrl().then((url) => setServerUrlState(url));
  }, []);

  async function handleSaveServerUrl() {
    if (!serverUrl.trim()) return;
    setSavingUrl(true);
    try {
      await setBaseUrl(serverUrl.trim());
      setEditingUrl(false);
      Alert.alert('Sucesso', 'Endereço do servidor salvo!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o endereço.');
    } finally {
      setSavingUrl(false);
    }
  }

  async function handleLogout() {
    Alert.alert('Sair do App', 'Deseja realmente encerrar a sessão no aplicativo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await managerService.logout();
          router.replace('/login');
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ajustes do Aplicativo</Text>
        <Text style={styles.headerSubtitle}>Configuração do Servidor & Conexão</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cartão de Conexão com o Servidor */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="server-network" size={22} color="#3B82F6" />
            <Text style={styles.cardTitle}>Servidor VPS / API</Text>
          </View>

          {editingUrl ? (
            <View style={{ marginTop: 8 }}>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrlState}
                placeholder="https://mikrogestor.com"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditingUrl(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveServerUrl}
                  disabled={savingUrl}
                >
                  <Text style={styles.saveBtnText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.urlRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.urlLabel}>URL Atual:</Text>
                <Text style={styles.urlValue}>{serverUrl}</Text>
              </View>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setEditingUrl(true)}
              >
                <MaterialCommunityIcons name="pencil" size={18} color="#3B82F6" />
                <Text style={styles.editBtnText}>Alterar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Informações da Versão */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="information-outline" size={22} color="#10B981" />
            <Text style={styles.cardTitle}>Sobre o MikroGestor Manager</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Versão:</Text>
            <Text style={styles.infoValue}>1.0.0 (Build APK)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plataforma:</Text>
            <Text style={styles.infoValue}>Android & iOS (React Native Expo)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Protocolo de Controle:</Text>
            <Text style={styles.infoValue}>WireGuard VPN + HTTPS REST</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Compatibilidade:</Text>
            <Text style={styles.infoValue}>MikroTik RouterOS v7.x</Text>
          </View>
        </View>

        {/* Botão de Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Encerrar Sessão (Logout)</Text>
        </TouchableOpacity>
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
  scrollContent: {
    padding: 16,
    gap: 16,
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
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  urlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  urlLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  urlValue: {
    fontSize: 14,
    color: '#F1F5F9',
    fontWeight: '500',
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  editBtnText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    padding: 12,
    fontSize: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#334155',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#CBD5E1',
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  infoLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  infoValue: {
    fontSize: 13,
    color: '#F1F5F9',
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
