import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEFAULT_BASE_URL = 'https://mikrogestor.com';
const STORAGE_KEY_TOKEN = 'mg_manager_auth_token';
const STORAGE_KEY_API_URL = 'mg_manager_api_url';

export async function getBaseUrl(): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(STORAGE_KEY_API_URL) || DEFAULT_BASE_URL;
    }
    const saved = await SecureStore.getItemAsync(STORAGE_KEY_API_URL);
    return saved || DEFAULT_BASE_URL;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

export async function setBaseUrl(url: string): Promise<void> {
  const cleanUrl = url.replace(/\/+$/, '');
  if (Platform.OS === 'web') {
    localStorage.setItem(STORAGE_KEY_API_URL, cleanUrl);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY_API_URL, cleanUrl);
}

export async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(STORAGE_KEY_TOKEN);
    }
    return await SecureStore.getItemAsync(STORAGE_KEY_TOKEN);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (token) localStorage.setItem(STORAGE_KEY_TOKEN, token);
    else localStorage.removeItem(STORAGE_KEY_TOKEN);
    return;
  }
  if (token) {
    await SecureStore.setItemAsync(STORAGE_KEY_TOKEN, token);
  } else {
    await SecureStore.deleteItemAsync(STORAGE_KEY_TOKEN);
  }
}

export const api = axios.create({
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const baseURL = await getBaseUrl();
  config.baseURL = baseURL;

  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Se não autorizado, limpa credenciais salvas
      await setAuthToken(null);
    }
    return Promise.reject(error);
  }
);
