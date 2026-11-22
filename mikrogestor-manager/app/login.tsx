import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { managerService } from '../services/manager.service';
import { getBaseUrl } from '../services/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('https://mikrogestor.com');
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    getBaseUrl().then((url) => setServerUrl(url));
  }, []);

  async function handleLogin() {
    if (!username.trim() || !password) {
      setErrorMessage('Preencha o usuário e a senha.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await managerService.login(username.trim(), password, serverUrl.trim());
      if (res.success) {
        router.replace('/(tabs)');
      } else {
        setErrorMessage(res.message || 'Falha na autenticação.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Erro ao conectar ao servidor.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="router-wireless" size={44} color="#3B82F6" />
          </View>
          <Text style={styles.brandTitle}>MikroGestor</Text>
          <Text style={styles.brandSubtitle}>PAINEL DO OPERADOR & CMS</Text>
        </View>

        {/* Card de Login */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Acesso Administrativo</Text>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Campo Usuário */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Usuário</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="account-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ex: admin"
                placeholderTextColor="#64748B"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Campo Senha */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="lock-outline" size={20} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Sua senha de acesso"
                placeholderTextColor="#64748B"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          {/* Alternar Configuração de Servidor */}
          <TouchableOpacity
            style={styles.toggleConfigBtn}
            onPress={() => setShowConfig(!showConfig)}
          >
            <MaterialCommunityIcons
              name={showConfig ? 'chevron-up' : 'cog-outline'}
              size={16}
              color="#3B82F6"
            />
            <Text style={styles.toggleConfigText}>
              {showConfig ? 'Ocultar servidor' : 'Configurar URL do servidor'}
            </Text>
          </TouchableOpacity>

          {showConfig ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>URL da API VPS</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="server-network" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="https://mikrogestor.com"
                  placeholderTextColor="#64748B"
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          ) : null}

          {/* Botão Entrar */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.loginBtnText}>Entrar no Sistema</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Rodapé informativo */}
        <Text style={styles.footerText}>
          MikroGestor Manager v1.0.0 • Hotspot & WireGuard Control
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  brandSubtitle: {
    fontSize: 12,
    letterSpacing: 2,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#F8FAFC',
    fontSize: 15,
  },
  toggleConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 6,
  },
  toggleConfigText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '500',
  },
  loginBtn: {
    backgroundColor: '#2563EB',
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    marginTop: 24,
  },
});
