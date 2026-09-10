import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const DEVICE_STORAGE_KEY = '@radar_device_id';

/**
 * Gera um identificador único para o aparelho físico no formato 'dev_timestamp_random'.
 */
export function generateNewDeviceId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `dev_${timestamp}_${randomPart}`;
}

/**
 * Obtém ou gera um ID único e persistente para este aparelho físico.
 * Exemplo: 'dev_k9x2_7f8a1c90'
 */
export async function getOrCreateDeviceId() {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
    if (!deviceId) {
      deviceId = generateNewDeviceId();
      await AsyncStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
      console.log('[DeviceService] Novo ID de aparelho gerado:', deviceId);
    }
    return deviceId;
  } catch (error) {
    console.log('[DeviceService] Erro ao obter Device ID:', error);
    return `dev_temp_${Date.now()}`;
  }
}

/**
 * Registra ou atualiza o aparelho na tabela 'usuarios' do Supabase.
 * Salva o pushToken e o vínculo explícito com a conta de usuário (conta_id).
 */
export async function registerDeviceInSupabase(deviceId, pushToken = null, contaId = null) {
  if (!deviceId) return;
  try {
    const payload = { id: deviceId };
    if (pushToken && pushToken.startsWith('ExponentPushToken')) {
      payload.expo_push_token = pushToken;
    }
    payload.conta_id = contaId || null;

    const { error } = await supabase.from('usuarios').upsert([payload]);
    if (error) {
      console.log('[DeviceService] Erro ao registrar aparelho no Supabase:', error.message);
    } else {
      console.log(`[DeviceService] Aparelho ${deviceId} registrado no Supabase (conta: ${contaId || 'anônimo'})`);
    }
  } catch (e) {
    console.log('[DeviceService] Falha na sincronização do aparelho:', e);
  }
}

/**
 * Quando o usuário cria ou conecta uma conta (seja primeira vez ou reconexão):
 * 1. Vincula o aparelho à conta na tabela de usuários (conta_id = accountId).
 * 2. Transfere todos os monitores e logs criados por este aparelho para a conta.
 * 3. Se a conta já tiver outros radares, eles passarão a ser exibidos conjuntamente.
 */
export async function migrateDeviceMonitorsToAccount(deviceId, accountId, pushToken = null) {
  if (!deviceId || !accountId) return;
  try {
    console.log(`[DeviceService] Iniciando vinculação do aparelho ${deviceId} à conta ${accountId}...`);

    // 1. Vincula o aparelho à conta na tabela 'usuarios'
    await registerDeviceInSupabase(deviceId, pushToken, accountId);

    // 2. Transfere todos os monitores anônimos pertencentes a este deviceId para o accountId
    const { data: migMon, error: errMon } = await supabase
      .from('monitores')
      .update({ usuario_id: accountId })
      .eq('usuario_id', deviceId)
      .select();

    if (errMon) {
      console.log('[DeviceService] Erro ao migrar monitores:', errMon.message);
    } else {
      console.log(`[DeviceService] ${(migMon || []).length} monitores migrados do aparelho ${deviceId} para a conta ${accountId}`);
    }

    // 3. Transfere os logs do aparelho para a conta (se houver logs vinculados ao deviceId)
    const { error: errLogs } = await supabase
      .from('logs')
      .update({ usuario_id: accountId })
      .eq('usuario_id', deviceId);

    if (errLogs) {
      console.log('[DeviceService] Aviso ao migrar logs:', errLogs.message);
    }

    console.log(`[DeviceService] ✅ Sincronização concluída com sucesso para a conta ${accountId}`);
  } catch (e) {
    console.log('[DeviceService] Falha ao migrar radares:', e);
  }
}

/**
 * Ao deslogar a conta do aparelho:
 * 1. Desvincula o aparelho antigo no Supabase (conta_id = null) para interromper notificações da conta.
 * 2. Remove o ID antigo e gera um novo ID anônimo limpo no AsyncStorage.
 * 3. Registra o novo ID anônimo no Supabase (com o pushToken do aparelho, sem conta_id).
 * 4. Retorna o novo ID para que o app reinicie completamente zerado e isolado.
 */
export async function resetDeviceOnLogout(oldDeviceId, pushToken = null) {
  try {
    if (oldDeviceId) {
      console.log(`[DeviceService] Desvinculando aparelho antigo ${oldDeviceId} da conta...`);
      await supabase.from('usuarios').update({ conta_id: null }).eq('id', oldDeviceId);
    }

    const newDeviceId = generateNewDeviceId();
    await AsyncStorage.setItem(DEVICE_STORAGE_KEY, newDeviceId);
    console.log(`[DeviceService] Nova identidade anônima gerada para o aparelho: ${newDeviceId}`);

    await registerDeviceInSupabase(newDeviceId, pushToken, null);
    return newDeviceId;
  } catch (e) {
    console.log('[DeviceService] Erro ao resetar aparelho no logout:', e);
    const fallbackId = generateNewDeviceId();
    await AsyncStorage.setItem(DEVICE_STORAGE_KEY, fallbackId);
    return fallbackId;
  }
}
