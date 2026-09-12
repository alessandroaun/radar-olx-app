import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// =====================================================================
// 1. CONSTANTES DE TIERS E CONFIGURAÇÕES
// =====================================================================

export const TIERS = {
  FREE: 'free',
  LITE: 'premium_lite',
  PREMIUM: 'premium',
  ADMIN: 'admin'
};

const STORAGE_KEYS = {
  TIER_STATE: '@radar_tier_state',
  LAST_SWEEP: '@radar_ultimo_varrer',
  TRIAL_USED_LOCAL: '@radar_trial_used_local',
  MODAL_EXPIRED_SHOWN: '@radar_modal_expired_shown'
};

// Limites e restrições por tier
export const TIER_LIMITS = {
  [TIERS.FREE]: {
    name: 'Free',
    label: 'Plano Gratuito',
    maxRadars: 1,
    allowedPlatforms: ['OLX', 'FACEBOOK', 'ZOOM', 'SHOPEE', 'MERCADO_LIVRE', 'AMAZON'],
    allowedStrategies: ['mais_recentes', 'menor_preco', 'maior_desconto'], // padrão
    canUseTargetPrice: false,
    fixedIntervalMinutes: 180, // Travado em 3 horas (180 min)
    sweepCooldownSeconds: 3600, // 60 minutos entre varreduras manuais
    canOpenExternalLinks: false, // Abre no app com cadeado
    canSyncMultiDevice: false, // Restrito apenas a este dispositivo
    canViewTelemetry: false, // Cadeado na telemetria
    canViewNextScanTime: false, // Cadeado na próxima busca
  },
  [TIERS.LITE]: {
    name: 'Premium Lite',
    label: 'Teste Grátis (2 Dias)',
    maxRadars: 5,
    allowedPlatforms: ['OLX', 'FACEBOOK', 'ZOOM', 'SHOPEE', 'MERCADO_LIVRE', 'AMAZON', 'OUTROS'],
    allowedStrategies: ['mais_recentes', 'menor_preco', 'por_preco', 'maior_desconto', 'noticia'],
    canUseTargetPrice: true,
    fixedIntervalMinutes: null, // Livre
    sweepCooldownSeconds: 0,
    canOpenExternalLinks: true,
    canSyncMultiDevice: true,
    canViewTelemetry: true,
    canViewNextScanTime: true,
    trialDurationHours: 48 // 2 dias
  },
  [TIERS.PREMIUM]: {
    name: 'Premium',
    label: 'Assinatura Premium',
    maxRadars: 5,
    allowedPlatforms: ['OLX', 'FACEBOOK', 'ZOOM', 'SHOPEE', 'MERCADO_LIVRE', 'AMAZON', 'OUTROS'],
    allowedStrategies: ['mais_recentes', 'menor_preco', 'por_preco', 'maior_desconto', 'noticia'],
    canUseTargetPrice: true,
    fixedIntervalMinutes: null, // Livre
    sweepCooldownSeconds: 0,
    canOpenExternalLinks: true,
    canSyncMultiDevice: true,
    canViewTelemetry: true,
    canViewNextScanTime: true,
    priceMonthly: 'R$ 39,90',
    durationDays: 30
  },
  [TIERS.ADMIN]: {
    name: 'Admin',
    label: 'Administrador Master',
    maxRadars: 9999, // Ilimitado
    allowedPlatforms: ['OLX', 'FACEBOOK', 'ZOOM', 'SHOPEE', 'MERCADO_LIVRE', 'AMAZON', 'OUTROS'],
    allowedStrategies: ['mais_recentes', 'menor_preco', 'por_preco', 'maior_desconto', 'noticia'],
    canUseTargetPrice: true,
    fixedIntervalMinutes: null,
    sweepCooldownSeconds: 0,
    canOpenExternalLinks: true,
    canSyncMultiDevice: true,
    canViewTelemetry: true,
    canViewNextScanTime: true,
    isLifetime: true
  }
};

// =====================================================================
// 2. SERVIÇO DE ASSINATURAS E TIERS
// =====================================================================

export class TierService {
  /**
   * Obtém o estado completo do plano do usuário/aparelho.
   * Regra: Usuário anônimo sem conta Google é SEMPRE Free.
   * Planos pagos e trial pertencem exclusivamente à conta Google (tabela 'contas').
   */
  static async getTierState(deviceId, authUser = null) {
    let state = {
      tier: TIERS.FREE,
      expiresAt: null, // ISO string
      trialUsed: false,
      trialStartedAt: null,
      subscribedAt: null,
      justExpired: false
    };

    // 1. Modo anônimo / Expo Go sem conta Google:
    if (!authUser?.id) {
      try {
        // A. Verifica cache local de admin (salvo via Master Key)
        const localCached = await AsyncStorage.getItem(STORAGE_KEYS.TIER_STATE);
        if (localCached) {
          const parsed = JSON.parse(localCached);
          if (parsed?.tier === TIERS.ADMIN) {
            return {
              ...state,
              ...parsed,
              tier: TIERS.ADMIN,
              expiresAt: null
            };
          }
        }

        // B. Consulta no Supabase se este aparelho (deviceId) possui registro admin
        if (deviceId) {
          // 1. Verifica diretamente na tabela 'contas' se o id do aparelho foi cadastrado como admin
          const { data: contaDev } = await supabase
            .from('contas')
            .select('*')
            .eq('id', deviceId)
            .maybeSingle();

          if (contaDev && (contaDev.tipo_usuario === 'admin' || contaDev.plano === 'admin')) {
            state.tier = TIERS.ADMIN;
            state.expiresAt = null;
            await AsyncStorage.setItem(STORAGE_KEYS.TIER_STATE, JSON.stringify(state));
            return state;
          }

          // 2. Verifica se a linha de 'usuarios' tem conta_id vinculada a uma conta admin
          const { data: usuarioRow } = await supabase
            .from('usuarios')
            .select('conta_id')
            .eq('id', deviceId)
            .maybeSingle();

          if (usuarioRow?.conta_id) {
            const { data: contaVinculada } = await supabase
              .from('contas')
              .select('*')
              .eq('id', usuarioRow.conta_id)
              .maybeSingle();

            if (contaVinculada && (contaVinculada.tipo_usuario === 'admin' || contaVinculada.plano === 'admin')) {
              state.tier = TIERS.ADMIN;
              state.expiresAt = null;
              await AsyncStorage.setItem(STORAGE_KEYS.TIER_STATE, JSON.stringify(state));
              return state;
            }
          }
        }
      } catch (err) {
        console.log('[TierService] Erro ao verificar admin no modo anônimo:', err);
      }
      return state;
    }

    try {
      // 2. Consulta a conta na tabela relacional 'contas'
      const { data: conta, error: errConta } = await supabase
        .from('contas')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (conta) {
        state.trialUsed = Boolean(conta.trial_usado);
        state.trialStartedAt = conta.trial_iniciado_em || null;

        // Se for admin (vitalício)
        if (conta.tipo_usuario === 'admin' || conta.plano === 'admin') {
          state.tier = TIERS.ADMIN;
          state.expiresAt = null;
        } else if (conta.plano === TIERS.PREMIUM) {
          // Verifica se a assinatura Premium expirou
          if (conta.plano_expira_em && new Date(conta.plano_expira_em).getTime() <= Date.now()) {
            console.log(`[TierService] Assinatura Premium da conta ${authUser.email} expirou. Revertendo para Free.`);
            state.tier = TIERS.FREE;
            state.expiresAt = null;
            state.justExpired = true;
            state.previousTier = TIERS.PREMIUM;

            // Persiste downgrade no banco
            await supabase.from('contas').update({ 
              plano: TIERS.FREE, 
              updated_at: new Date().toISOString() 
            }).eq('id', authUser.id);
          } else {
            state.tier = TIERS.PREMIUM;
            state.expiresAt = conta.plano_expira_em;
          }
        } else if (conta.plano === TIERS.LITE) {
          // Verifica se o teste grátis (48h) expirou
          if (conta.plano_expira_em && new Date(conta.plano_expira_em).getTime() <= Date.now()) {
            console.log(`[TierService] Teste Grátis (Lite) da conta ${authUser.email} expirou. Revertendo para Free.`);
            state.tier = TIERS.FREE;
            state.expiresAt = null;
            state.justExpired = true;
            state.previousTier = TIERS.LITE;

            // Persiste downgrade no banco
            await supabase.from('contas').update({ 
              plano: TIERS.FREE, 
              updated_at: new Date().toISOString() 
            }).eq('id', authUser.id);
          } else {
            state.tier = TIERS.LITE;
            state.expiresAt = conta.plano_expira_em;
          }
        } else {
          state.tier = TIERS.FREE;
        }
      } else {
        // Primeira conexão desta conta Google: cria o registro em 'contas' com plano 'free'
        await supabase.from('contas').insert([{
          id: authUser.id,
          email: authUser.email,
          plano: TIERS.FREE,
          tipo_usuario: 'user'
        }]);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.TIER_STATE, JSON.stringify(state));
      return state;
    } catch (e) {
      console.log('[TierService] Erro ao obter estado do tier da conta:', e);
      return state;
    }
  }

  /**
   * Salva o estado de tier no armazenamento local e na tabela 'contas' do Supabase.
   */
  static async saveTierState(deviceId, authUser, state) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TIER_STATE, JSON.stringify(state));

      if (authUser?.id) {
        const updateData = {
          plano: state.tier,
          plano_expira_em: state.expiresAt || null,
          trial_usado: Boolean(state.trialUsed),
          updated_at: new Date().toISOString()
        };
        if (state.trialStartedAt) {
          updateData.trial_iniciado_em = state.trialStartedAt;
        }
        if (state.tier === TIERS.ADMIN) {
          updateData.tipo_usuario = 'admin';
        }

        await supabase.from('contas').upsert([{
          id: authUser.id,
          email: authUser.email,
          ...updateData
        }]);
      }
    } catch (e) {
      console.log('[TierService] Erro ao salvar estado do tier:', e);
    }
  }

  /**
   * Verifica se o aparelho E a conta Google têm direito ao teste de 2 dias (Premium Lite).
   * Regras:
   * 1. Requer conta Google conectada.
   * 2. Requer notificações ativadas com push token válido.
   * 3. Conta não pode ter usado trial anteriormente.
   * 4. Push Token de hardware não pode ter usado trial anteriormente (tabela trial_push_tokens).
   */
  static async canActivateTrial(deviceId, authUser = null, pushToken = null) {
    try {
      // 1. Requer conta Google
      if (!authUser?.id) {
        return { 
          canActivate: false, 
          reason: 'requires_login', 
          message: 'Para ativar o teste de 2 dias, conecte sua conta Google primeiro.' 
        };
      }

      // 2. Requer notificações ativadas
      if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
        return { 
          canActivate: false, 
          reason: 'requires_push', 
          message: 'Para ativar o teste grátis (Premium Lite), ative as notificações do app no aparelho.' 
        };
      }

      // 3. Verificação na tabela 'contas'
      const { data: conta } = await supabase
        .from('contas')
        .select('trial_usado, plano')
        .eq('id', authUser.id)
        .maybeSingle();

      if (conta && (conta.trial_usado === true || conta.plano === TIERS.LITE || conta.plano === TIERS.PREMIUM)) {
        return { 
          canActivate: false, 
          reason: 'account_used', 
          message: 'Esta conta Google já utilizou o período de teste grátis.' 
        };
      }

      // 4. Verificação de hardware via push token na tabela 'trial_push_tokens'
      const { data: tokenRows } = await supabase
        .from('trial_push_tokens')
        .select('push_token')
        .eq('push_token', pushToken)
        .limit(1);

      if (tokenRows && tokenRows.length > 0) {
        return { 
          canActivate: false, 
          reason: 'token_used', 
          message: 'Este aparelho já utilizou o teste grátis anteriormente. Assine o plano Premium para continuar aproveitando!' 
        };
      }

      // 5. Verificação no aparelho na tabela 'usuarios'
      if (deviceId) {
        const { data: devRows } = await supabase
          .from('usuarios')
          .select('trial_usado')
          .eq('id', deviceId)
          .maybeSingle();

        if (devRows && devRows.trial_usado === true) {
          return { 
            canActivate: false, 
            reason: 'device_used', 
            message: 'Este aparelho já utilizou o teste grátis de 2 dias.' 
          };
        }
      }

      return { canActivate: true };
    } catch (e) {
      console.log('[TierService] Erro ao verificar elegibilidade de trial:', e);
      return { canActivate: false, reason: 'error', message: 'Erro ao validar elegibilidade de teste.' };
    }
  }

  /**
   * Ativa o teste grátis de 2 dias (Premium Lite).
   * Registra a utilização no Supabase na conta Google, em trial_push_tokens e no aparelho.
   */
  static async activateTrial(deviceId, authUser = null, pushToken = null) {
    try {
      const eligibility = await this.canActivateTrial(deviceId, authUser, pushToken);
      if (!eligibility.canActivate) {
        return { success: false, reason: eligibility.reason, message: eligibility.message };
      }

      const now = new Date();
      // 48 horas a partir de agora
      const expiresAt = new Date(now.getTime() + (48 * 60 * 60 * 1000)).toISOString();

      const newState = {
        tier: TIERS.LITE,
        expiresAt: expiresAt,
        trialUsed: true,
        trialStartedAt: now.toISOString(),
        justExpired: false
      };

      // 1. Atualiza a conta Google em 'contas'
      await supabase.from('contas').upsert([{
        id: authUser.id,
        email: authUser.email,
        plano: TIERS.LITE,
        plano_expira_em: expiresAt,
        trial_usado: true,
        trial_iniciado_em: now.toISOString(),
        updated_at: now.toISOString()
      }]);

      // 2. Registra o pushToken permanentemente em 'trial_push_tokens' (Anti-Fraude)
      await supabase.from('trial_push_tokens').upsert([{
        push_token: pushToken,
        device_id: deviceId,
        conta_id: authUser.id,
        created_at: now.toISOString()
      }]);

      // 3. Atualiza o aparelho em 'usuarios'
      if (deviceId) {
        await supabase.from('usuarios').update({
          conta_id: authUser.id,
          trial_usado: true,
          updated_at: now.toISOString()
        }).eq('id', deviceId);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.TIER_STATE, JSON.stringify(newState));
      await AsyncStorage.setItem(STORAGE_KEYS.TRIAL_USED_LOCAL, 'true');

      console.log(`[TierService] ✅ Teste Grátis (Premium Lite) ativado para conta ${authUser.email} até ${expiresAt}`);
      return { success: true, expiresAt };
    } catch (e) {
      console.log('[TierService] Erro ao ativar trial:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Simulação do fluxo de pagamento e ativação do plano Premium por 30 dias.
   * Concede os 30 dias à Conta Google.
   */
  static async simulateSubscribePremium(deviceId, authUser = null) {
    try {
      if (!authUser?.id) {
        return { 
          success: false, 
          reason: 'requires_login', 
          message: 'Conecte sua conta Google para assinar o plano Premium.' 
        };
      }

      const now = new Date();
      // 30 dias de assinatura
      const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString();

      const newState = {
        tier: TIERS.PREMIUM,
        expiresAt: expiresAt,
        trialUsed: true,
        subscribedAt: now.toISOString(),
        justExpired: false
      };

      // 1. Atualiza a tabela 'contas' no Supabase
      await supabase.from('contas').upsert([{
        id: authUser.id,
        email: authUser.email,
        plano: TIERS.PREMIUM,
        plano_expira_em: expiresAt,
        trial_usado: true,
        updated_at: now.toISOString()
      }]);

      // 2. Vincula o aparelho atual à conta
      if (deviceId) {
        await supabase.from('usuarios').update({
          conta_id: authUser.id,
          updated_at: now.toISOString()
        }).eq('id', deviceId);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.TIER_STATE, JSON.stringify(newState));
      console.log(`[TierService] 🎉 Assinatura Premium ativada para ${authUser.email} até ${expiresAt}`);
      return { success: true, expiresAt };
    } catch (e) {
      console.log('[TierService] Erro ao assinar plano premium:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Promove ou define um usuário como Administrador vitalício.
   */
  static async setAdminTier(deviceId, authUser = null) {
    if (!authUser?.id) {
      return { success: false, message: 'Requer conta Google conectada.' };
    }
    const newState = {
      tier: TIERS.ADMIN,
      expiresAt: null,
      trialUsed: true,
      justExpired: false
    };
    await supabase.from('contas').upsert([{
      id: authUser.id,
      email: authUser.email,
      plano: TIERS.ADMIN,
      tipo_usuario: 'admin',
      updated_at: new Date().toISOString()
    }]);
    if (deviceId) {
      await supabase.from('usuarios').update({
        conta_id: authUser.id,
        updated_at: new Date().toISOString()
      }).eq('id', deviceId);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.TIER_STATE, JSON.stringify(newState));
    return { success: true };
  }

  /**
   * Ativa permissão Admin vitalícia no aparelho através da Chave Mestra.
   * Salva no AsyncStorage local e sincroniza no Supabase nas tabelas 'contas' e 'usuarios'.
   */
  static async activateDeviceAdmin(deviceId, secretKey) {
    const VALID_KEYS = ['achoai2026', 'admin2026', 'master2026'];
    if (!secretKey || !VALID_KEYS.includes(secretKey.trim().toLowerCase())) {
      return { success: false, message: 'Chave de Administrador incorreta.' };
    }

    try {
      const state = {
        tier: TIERS.ADMIN,
        expiresAt: null,
        trialUsed: true,
        trialStartedAt: null,
        subscribedAt: new Date().toISOString(),
        justExpired: false,
        isDeviceAdmin: true
      };

      // 1. Salva localmente para persistência imediata
      await AsyncStorage.setItem(STORAGE_KEYS.TIER_STATE, JSON.stringify(state));

      // 2. Upsert na tabela 'contas' com o ID do aparelho
      if (deviceId) {
        await supabase.from('contas').upsert([{
          id: deviceId,
          email: `admin_${deviceId.substring(0, 10)}@achoai.app`,
          plano: TIERS.ADMIN,
          tipo_usuario: 'admin',
          updated_at: new Date().toISOString()
        }]);

        // 3. Atualiza vínculo na tabela 'usuarios'
        await supabase.from('usuarios').update({
          conta_id: deviceId,
          updated_at: new Date().toISOString()
        }).eq('id', deviceId);
      }

      console.log(`[TierService] Aparelho ${deviceId} promovido a ADMIN vitalício!`);
      return { success: true, state };
    } catch (e) {
      console.log('[TierService] Erro ao ativar admin no aparelho:', e);
      return { success: false, message: e.message || 'Erro ao sincronizar permissão com o banco.' };
    }
  }

  /**
   * Reverte o aparelho para o plano Free (útil para testes de experiência do usuário comum).
   */
  static async deactivateDeviceAdmin(deviceId) {
    try {
      const state = {
        tier: TIERS.FREE,
        expiresAt: null,
        trialUsed: false,
        justExpired: false
      };
      await AsyncStorage.setItem(STORAGE_KEYS.TIER_STATE, JSON.stringify(state));

      if (deviceId) {
        await supabase.from('contas').delete().eq('id', deviceId);
        await supabase.from('usuarios').update({
          conta_id: null,
          updated_at: new Date().toISOString()
        }).eq('id', deviceId);
      }

      return { success: true, state };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Verifica e formata o tempo restante de uma assinatura temporária.
   * Retorna { days, hours, minutes, totalSeconds, isExpiringSoon }
   */
  static getRemainingTime(expiresAt) {
    if (!expiresAt) return null;
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, totalSeconds: 0, isExpiringSoon: false, expired: true };

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    // Expira em breve se faltar 5 dias ou menos (<= 5 dias = 432000 segundos)
    const isExpiringSoon = totalSeconds <= (5 * 24 * 3600);

    return {
      days,
      hours,
      minutes,
      totalSeconds,
      isExpiringSoon,
      expired: false,
      formattedText: days > 0 
        ? `${days}d ${hours}h ${minutes}m restantes`
        : hours > 0 
        ? `${hours}h ${minutes}m restantes`
        : `${minutes} min restantes`
    };
  }

  /**
   * Cooldown de 60 minutos do botão "Varrer" para usuários Free.
   */
  static async getSweepCooldown(tier) {
    if (tier !== TIERS.FREE) return 0; // Outros tiers não têm cooldown
    try {
      const lastSweepStr = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SWEEP);
      if (!lastSweepStr) return 0;

      const lastSweepTime = parseInt(lastSweepStr, 10);
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastSweepTime) / 1000);
      const remainingSeconds = 3600 - elapsedSeconds;

      return remainingSeconds > 0 ? remainingSeconds : 0;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Registra o momento em que o usuário acionou o botão "Varrer".
   */
  static async recordSweep() {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SWEEP, String(Date.now()));
    } catch (e) {}
  }

  /**
   * Regra de auto-downgrade e ajuste de radares:
   * Mantém apenas 1 radar ativo e pausa todos os demais quando o usuário volta para o Free.
   */
  static pruneExcessRadars(monitores, tier) {
    if (tier !== TIERS.FREE || !monitores || monitores.length <= 1) {
      return { monitoresToKeep: monitores, monitoresToPause: [] };
    }

    // Ordena pelo mais recente criado
    const ordenados = [...monitores].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const principal = ordenados[0];
    const excedentes = ordenados.slice(1).filter(m => m.ativo);

    return {
      monitoresToKeep: [principal],
      monitoresToPause: excedentes
    };
  }
}
