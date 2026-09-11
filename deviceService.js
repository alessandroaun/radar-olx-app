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
 * Salva o pushToken, estado de notificações e o vínculo explícito com a conta de usuário (conta_id).
 */
export async function registerDeviceInSupabase(deviceId, pushToken = null, contaId = null, notificacoesAtivas = true) {
  if (!deviceId) return;
  try {
    // Evita duplicidade: se outro registro antigo tiver o mesmo token push, limpa nele
    if (pushToken && pushToken.startsWith('ExponentPushToken')) {
      await supabase
        .from('usuarios')
        .update({ expo_push_token: null })
        .eq('expo_push_token', pushToken)
        .neq('id', deviceId);
    }

    const payload = { 
      id: deviceId,
      conta_id: contaId || null,
      notificacoes_ativas: Boolean(notificacoesAtivas),
      updated_at: new Date().toISOString()
    };

    if (pushToken && pushToken.startsWith('ExponentPushToken')) {
      payload.expo_push_token = pushToken;
    } else if (pushToken === null) {
      payload.expo_push_token = null;
    }

    const { error } = await supabase.from('usuarios').upsert([payload]);
    if (error) {
      console.log('[DeviceService] Erro ao registrar aparelho no Supabase:', error.message);
    } else {
      console.log(`[DeviceService] Aparelho ${deviceId} sincronizado no Supabase (conta: ${contaId || 'anônimo'}, token: ${payload.expo_push_token ? 'SIM' : 'NÃO'})`);
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
 * 1. Desvincula o aparelho no Supabase (conta_id = null) para interromper sincronização com a conta.
 * 2. NUNCA recria o deviceId: o mesmo aparelho físico continua existindo com seu deviceId imutável.
 * 3. Retorna o mesmo deviceId.
 */
export async function resetDeviceOnLogout(deviceId) {
  try {
    if (deviceId) {
      console.log(`[DeviceService] Desvinculando aparelho ${deviceId} da conta no Supabase...`);
      await supabase
        .from('usuarios')
        .update({ 
          conta_id: null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', deviceId);
    }
    return deviceId;
  } catch (e) {
    console.log('[DeviceService] Erro ao desvincular aparelho no logout:', e);
    return deviceId;
  }
}
