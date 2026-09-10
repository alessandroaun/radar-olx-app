import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export const checkIsExpoGo = () => {
  try {
    return isRunningInExpoGo() || 
           Constants?.executionEnvironment === ExecutionEnvironment?.StoreClient ||
           Constants?.appOwnership === 'expo';
  } catch (e) {
    return false;
  }
};

let Notifications = null;
if (!checkIsExpoGo()) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.log('[Radar] expo-notifications não carregado:', e);
  }
}

export async function setupNotifications() {
  if (checkIsExpoGo() || !Notifications) {
    console.log('[Radar] Executando no Expo Go: Push remoto desativado para evitar restrições do SDK 53+.');
    return;
  }

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('achoai-alerts', {
        name: 'AchôAI Alertas',
        description: 'Notificações de novas oportunidades e notícias relevantes',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF9500',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('default', {
        name: 'AchôAI Geral',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF9500',
        sound: 'default',
      });
    }
  } catch (e) {
    console.log('[Radar] Erro em setupNotifications:', e);
  }
}

export async function registerPushToken(deviceId, contaId = null) {
  if (checkIsExpoGo() || !Notifications) {
    return 'Modo Expo Go Ativo (Gere o APK para Push Remoto)';
  }

  if (!Device.isDevice) {
    return 'Emulador (Push remoto indisponível)';
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Permissão de notificação não concedida.');
      return null;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? 
                      Constants?.easConfig?.projectId ?? 
                      'a68a6cba-cbc8-482b-968b-f501341bea46';

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log('[Radar] Push Token registrado no Supabase:', token);

    const payload = { id: deviceId, expo_push_token: token };
    if (contaId) payload.conta_id = contaId;

    await supabase.from('usuarios').upsert([payload]);

    return token;
  } catch (e) {
    console.log('[Radar] Erro ao obter Push Token:', e);
    return null;
  }
}

export async function testLocalNotification() {
  if (checkIsExpoGo()) {
    return {
      success: false,
      message: "Modo Expo Go ativo: Para disparar notificações locais no Android SDK 53+, gere o APK standalone."
    };
  }
  if (!Notifications) {
    try {
      Notifications = require('expo-notifications');
    } catch (e) {
      throw new Error("Módulo de notificações não disponível.");
    }
  }
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: "🚨 Teste de Notificação AchôAI",
      body: "Seu aparelho Android está pronto para receber alertas do AchôAI!",
      sound: 'default',
    },
    trigger: null,
  });
}

export function subscribeNotificationEvents(onReceived, onResponse) {
  if (checkIsExpoGo() || !Notifications) {
    return () => {};
  }

  let sub1 = null;
  let sub2 = null;

  try {
    if (onReceived && Notifications.addNotificationReceivedListener) {
      sub1 = Notifications.addNotificationReceivedListener(onReceived);
    }
    if (onResponse && Notifications.addNotificationResponseReceivedListener) {
      sub2 = Notifications.addNotificationResponseReceivedListener(onResponse);
    }
  } catch (e) {
    console.log('[Radar] Erro ao registrar listeners:', e);
  }

  return () => {
    if (sub1 && sub1.remove) sub1.remove();
    if (sub2 && sub2.remove) sub2.remove();
  };
}
