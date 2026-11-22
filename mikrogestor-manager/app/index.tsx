import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { getAuthToken } from '../services/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SplashScreen() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await getAuthToken();
      if (token) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    } catch {
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="router-wireless" size={72} color="#3B82F6" />
      <Text style={styles.title}>MikroGestor</Text>
      <Text style={styles.subtitle}>MANAGER CMS</Text>
      <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 13,
    letterSpacing: 3,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
});
