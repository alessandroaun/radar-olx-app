import React, { useState, useEffect, createContext, useContext, useCallback, useRef, useMemo } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, 
  Alert, Platform, StatusBar, ActivityIndicator, Switch, Dimensions, 
  Linking, RefreshControl, Modal, FlatList, Image, Vibration 
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';

import { supabase, supabaseAuth } from './supabase'; 
import { setupNotifications, registerPushToken, testLocalNotification, subscribeNotificationEvents, checkIsExpoGo } from './notificationService';
import { OLX_ESTADOS, LISTA_ESTADOS, gerarUrlOlx } from './olxData';
import { getOrCreateDeviceId, registerDeviceInSupabase, migrateDeviceMonitorsToAccount, resetDeviceOnLogout } from './deviceService';
import { THEME } from './theme';
import { 
  Surface, PrimaryButton, IconButton, StatusBadge, PlatformBadge, 
  StrategyBadge, SectionHeader, MetricBox, TierBadge,
  ShopeeOriginBadge, ShopeeDiscountBadge, ShopeeRatingBadge, parseShopeeInfo,
  MLFullBadge, MLFreeShippingBadge, MLDiscountBadge, parseMLInfo,
  AmazonPrimeBadge, AmazonFreeShippingBadge, AmazonDiscountBadge, parseAmazonInfo,
  MagaluFullBadge, MagaluFreeShippingBadge, MagaluDiscountBadge, parseMagaluInfo,
  KabumFreeShippingBadge, KabumDiscountBadge, parseKabumInfo,
  AmericanasFastDeliveryBadge, AmericanasFreeShippingBadge, AmericanasDiscountBadge, parseAmericanasInfo,
  SheinBestSellerBadge, SheinDiscountBadge, parseSheinInfo
} from './components';
import { TierService, TIERS, TIER_LIMITS } from './tierService';
import { 
  LockOverlay, LockBadge, FreemiumModal, CelebrationModal, 
  TrialExpiredModal, RenewalModal, AdDetailModal 
} from './FreemiumModals';
import { CustomAlertModal } from './CustomAlertModal';


WebBrowser.maybeCompleteAuthSession();

// =====================================================================
// AFILIADOS MERCADO LIVRE (CONFIGURAÇÃO OFICIAL)
// =====================================================================
export const ML_AFFILIATE_CONFIG = {
  tool: '58245087',
  word: 'alessandrouchoadonascimento'
};

export function formatarUrlAfiliado(url) {
  if (!url) return '';
  const urlStr = String(url).trim();
  const lower = urlStr.toLowerCase();
  if (lower.includes('mercadolivre.com') || lower.includes('meli.la')) {
    if (lower.includes('matt_tool=')) return urlStr;
    const hasFrag = urlStr.includes('#');
    const [base, frag] = hasFrag ? urlStr.split('#') : [urlStr, ''];
    const sep = base.includes('?') ? '&' : '?';
    const finalBase = `${base}${sep}matt_tool=${ML_AFFILIATE_CONFIG.tool}&matt_word=${ML_AFFILIATE_CONFIG.word}&forceInApp=true`;
    return hasFrag ? `${finalBase}#${frag}` : finalBase;
  }
  return urlStr;
}

// =====================================================================
// 1. API SERVICE (SUPABASE) - CONTRATOS 100% PRESERVADOS
// =====================================================================
class RadarAPI {
  static async getMonitors(ownerId = null) {
    let query = supabase.from('monitores').select('*').order('created_at', { ascending: false });
    if (ownerId) {
      query = query.eq('usuario_id', ownerId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async createMonitor(dados) {
    const { data, error } = await supabase.from('monitores').insert([dados]).select();
    if (error) throw error;
    return data ? data[0] : null;
  }

  static async updateMonitor(id, dados) {
    const { data, error } = await supabase.from('monitores').update(dados).eq('id', id).select();
    if (error) throw error;
    return data ? data[0] : null;
  }

  static async toggleMonitor(id, status) {
    const { error } = await supabase.from('monitores').update({ ativo: status }).eq('id', id);
    if (error) throw error;
  }

  static async deleteMonitor(id) {
    const { error } = await supabase.from('monitores').delete().eq('id', id);
    if (error) throw error;
  }

  static async testMonitor(id) {
    const { error } = await supabase.from('monitores').update({ forcar_teste: true, ativo: true }).eq('id', id);
    if (error) throw error;
  }

  static async pauseAllMonitors(ownerId = null) {
    let query = supabase.from('monitores').update({ ativo: false, forcar_teste: false });
    if (ownerId) {
      query = query.eq('usuario_id', ownerId);
    }
    const { error } = await query;
    if (error) throw error;
  }

  static async resumeAllMonitors(ownerId = null) {
    let query = supabase.from('monitores').update({ ativo: true });
    if (ownerId) {
      query = query.eq('usuario_id', ownerId);
    }
    const { error } = await query;
    if (error) throw error;
  }

  static async stopAllSweeps(ownerId = null) {
    let query = supabase.from('monitores').update({ forcar_teste: false, ativo: false });
    if (ownerId) {
      query = query.eq('usuario_id', ownerId);
    }
    const { error } = await query;
    if (error) throw error;
  }

  static async getLogs(limit = 8, monitorIds = []) {
    try {
      if (!monitorIds || monitorIds.length === 0) return [];
      const { data, error } = await supabase.from('logs')
        .select('*')
        .in('monitor_id', monitorIds)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return [];
      return data || [];
    } catch (e) { return []; }
  }

  static async getAllResults(limit = 40, monitorIds = []) {
    try {
      if (!monitorIds || monitorIds.length === 0) return [];
      const { data, error } = await supabase.from('resultados')
        .select('*')
        .in('monitor_id', monitorIds)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return [];
      return data || [];
    } catch (e) { return []; }
  }
}

// =====================================================================
// 2. CONTEXTO GLOBAL (STATE MANAGEMENT)
// =====================================================================
const RadarContext = createContext({});

function RadarProvider({ children }) {
  const [monitores, setMonitores] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [pushToken, setPushToken] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(true);

  // Freemium States
  const [tierState, setTierState] = useState({
    tier: TIERS.FREE,
    expiresAt: null,
    trialUsed: false
  });
  const [trialEligibility, setTrialEligibility] = useState({ canActivate: true });
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [freemiumModalVisible, setFreemiumModalVisible] = useState(false);
  const [celebrationModalVisible, setCelebrationModalVisible] = useState(false);
  const [trialExpiredModalVisible, setTrialExpiredModalVisible] = useState(false);
  const [renewalModalVisible, setRenewalModalVisible] = useState(false);
  const [remainingRenewalDays, setRemainingRenewalDays] = useState(5);
  const [adDetailModalVisible, setAdDetailModalVisible] = useState(false);
  const [selectedAdItem, setSelectedAdItem] = useState(null);
  const [sweepCooldownSeconds, setSweepCooldownSeconds] = useState(0);
  const [antiSpamCooldowns, setAntiSpamCooldowns] = useState({});
  const [varrendoMonitorId, setVarrendoMonitorId] = useState(null);

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    icon: null,
    confirmText: 'Entendido',
    cancelText: 'Cancelar',
    onConfirm: null,
    onCancel: null,
    showCancel: false
  });

  const showAlert = useCallback(({
    title,
    message,
    type = 'info',
    icon = null,
    confirmText = 'Entendido',
    cancelText = 'Cancelar',
    onConfirm = null,
    onCancel = null,
    showCancel = false
  }) => {
    setAlertConfig({
      visible: true,
      title: title || '',
      message: message || '',
      type,
      icon,
      confirmText,
      cancelText,
      onConfirm,
      onCancel,
      showCancel: showCancel || type === 'confirm_danger' || type === 'confirm_warning'
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  }, []);

  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;
  const pushTokenRef = useRef(pushToken);
  pushTokenRef.current = pushToken;
  const userRef = useRef(user);
  userRef.current = user;
  const monitoresRef = useRef(monitores);
  monitoresRef.current = monitores;
  const hasLoadedRef = useRef(false);
  const lastResultsCountRef = useRef(0);

  const tier = tierState.tier;
  const tierRef = useRef(tier);
  tierRef.current = tier;

  // Se o usuário for Free, mesmo conectado as informações ficam limitadas apenas ao aparelho (deviceId)
  // Se for Premium ou Admin, a conta Google recebe a assinatura e sincroniza entre múltiplos aparelhos (user.id || deviceId)
  const currentOwnerId = (tier === TIERS.FREE) ? deviceId : (user?.id || deviceId);

  const fetchData = useCallback(async (targetOwnerId = null, silent = false) => {
    const ownerId = targetOwnerId || ((tierRef.current === TIERS.FREE) ? deviceIdRef.current : (userRef.current?.id || deviceIdRef.current));
    if (!ownerId) return;
    try {
      if (!silent && !hasLoadedRef.current) {
        setLoading(true);
      }
      const dadosMonitores = await RadarAPI.getMonitors(ownerId);
      const monitorIds = (dadosMonitores || []).map(m => m.id);

      const [dadosResultados, dadosAtividades] = await Promise.all([
        RadarAPI.getAllResults(40, monitorIds),
        RadarAPI.getLogs(8, monitorIds)
      ]);

      if (dadosResultados && dadosResultados.length > lastResultsCountRef.current && hasLoadedRef.current) {
        try {
          Vibration.vibrate(Platform.OS === 'android' ? [0, 80, 50, 100] : 100);
        } catch (e) {}
      }
      lastResultsCountRef.current = (dadosResultados || []).length;

      setMonitores(dadosMonitores || []);
      setResultados(dadosResultados || []);
      setAtividades(dadosAtividades || []);
      hasLoadedRef.current = true;
    } catch (e) {
      console.log("Erro ao sincronizar com Supabase:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshTierState = useCallback(async (devId = null, authUser = null) => {
    const currentDev = devId || deviceIdRef.current;
    const currentUser = authUser || userRef.current;
    if (!currentDev) return;

    const state = await TierService.getTierState(currentDev, currentUser);
    setTierState(state);

    const eligibility = await TierService.canActivateTrial(currentDev, currentUser, pushTokenRef.current);
    setTrialEligibility(eligibility);

    // Se acabou de expirar, aciona modal e pausa radares excedentes (> 1)
    if (state.justExpired) {
      setTrialExpiredModalVisible(true);
      try {
        const dadosMonitores = await RadarAPI.getMonitors(currentDev);
        const { monitoresToPause } = TierService.pruneExcessRadars(dadosMonitores, TIERS.FREE);
        for (const m of monitoresToPause) {
          await RadarAPI.updateMonitor(m.id, { ativo: false });
        }
      } catch (e) {}
      fetchData(currentDev, true);
    }

    // Se estiver no plano Premium e faltar <= 5 dias para expirar, mostra aviso de renovação
    if (state.tier === TIERS.PREMIUM && state.expiresAt) {
      const rem = TierService.getRemainingTime(state.expiresAt);
      if (rem && rem.isExpiringSoon && rem.days <= 5) {
        setRemainingRenewalDays(rem.days);
        const renewalShown = await AsyncStorage.getItem('@radar_renewal_modal_shown_session');
        if (!renewalShown) {
          setRenewalModalVisible(true);
          await AsyncStorage.setItem('@radar_renewal_modal_shown_session', 'true');
        }
      }
    }
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(null, true);
    refreshTierState();
  }, [fetchData, refreshTierState]);

  const alternarNotificacoes = useCallback(async (novoValor) => {
    setNotificacoesAtivas(novoValor);
    await AsyncStorage.setItem('@radar_notificacoes_ativas', String(novoValor));
    const currentDevId = deviceIdRef.current;
    if (!novoValor) {
      setPushToken(null);
      pushTokenRef.current = null;
      if (currentDevId) {
        await supabase.from('usuarios').update({ 
          expo_push_token: null,
          notificacoes_ativas: false,
          updated_at: new Date().toISOString()
        }).eq('id', currentDevId);
      }
    } else {
      if (currentDevId) {
        const token = await registerPushToken(currentDevId, userRef.current?.id);
        if (token) {
          setPushToken(token);
          pushTokenRef.current = token;
          await supabase.from('usuarios').update({
            expo_push_token: token,
            notificacoes_ativas: true,
            updated_at: new Date().toISOString()
          }).eq('id', currentDevId);
        }
      }
    }
    // Revalida elegibilidade de trial caso tenha sido alterado
    if (currentDevId) {
      refreshTierState(currentDevId, userRef.current);
    }
  }, [refreshTierState]);

  const linkAccount = useCallback(async (authUser) => {
    if (!authUser) return;
    try {
      setLoading(true);
      setUser(authUser);
      userRef.current = authUser;

      const currentDevId = deviceIdRef.current;
      const currentToken = pushTokenRef.current;

      // Atualiza o estado de tier para ver se esta conta possui plano Premium
      await refreshTierState(currentDevId, authUser);

      // Se o usuário for Premium ou Admin, migra os radares para a conta Google sincronizar
      if (currentDevId && (tierRef.current === TIERS.PREMIUM || tierRef.current === TIERS.ADMIN)) {
        await migrateDeviceMonitorsToAccount(currentDevId, authUser.id, currentToken);
      } else if (currentDevId) {
        await registerDeviceInSupabase(currentDevId, currentToken, authUser.id);
      }

      await fetchData(null);
    } catch (e) {
      console.log("[Radar] Erro ao vincular conta Google:", e);
    } finally {
      setLoading(false);
    }
  }, [fetchData, refreshTierState]);

  const logoutUser = useCallback(async () => {
    try {
      setLoading(true);
      const currentDevId = deviceIdRef.current;

      await supabaseAuth.auth.signOut();

      // Desvincula o aparelho no Supabase mantendo o mesmo deviceId!
      await resetDeviceOnLogout(currentDevId);

      setUser(null);
      userRef.current = null;

      setMonitores([]);
      setResultados([]);
      setAtividades([]);
      hasLoadedRef.current = false;

      // Ao deslogar, usuário volta a ser Free estrito neste aparelho
      await refreshTierState(currentDevId, null);
      await fetchData(currentDevId);
    } catch (e) {
      console.log("[Radar] Erro ao efetuar logout:", e);
    } finally {
      setLoading(false);
    }
  }, [fetchData, refreshTierState]);

  // Disparo manual do botão "Varrer" com verificação de cooldown e polling até conclusão
  const dispararVarreduraManual = useCallback(async (monitorId) => {
    if (!monitorId) return false;

    // 1. Evita duplo acionamento concorrente no mesmo radar
    if (varrendoMonitorId === monitorId) {
      return false;
    }

    // 2. Proteção Anti-Spam: delay de 90 segundos no mesmo card (ignorado para ADMIN)
    if (tierRef.current !== TIERS.ADMIN) {
      const expCooldown = antiSpamCooldowns[monitorId];
      if (expCooldown && expCooldown > Date.now()) {
        const restSec = Math.ceil((expCooldown - Date.now()) / 1000);
        showAlert({
          title: "Proteção Anti-Spam",
          message: `Aguarde mais ${restSec} segundos para varrer este mesmo radar novamente e evitar sobrecarga do servidor.`,
          type: "warning",
          icon: "time-outline"
        });
        return false;
      }
    }

    // 3. Checa limite de cooldown de 60 minutos do Plano Free
    if (tierRef.current === TIERS.FREE) {
      const cooldown = await TierService.getSweepCooldown(TIERS.FREE);
      if (cooldown > 0) {
        const min = Math.floor(cooldown / 60);
        const sec = cooldown % 60;
        showAlert({
          title: "Limite do Plano Free",
          message: `No plano Free, o robô pode ser acionado manualmente 1 vez a cada 60 minutos.\n\nAguarde ${min > 0 ? `${min}m ` : ''}${sec}s ou faça upgrade para o AchôAI Premium para varrer quantas vezes quiser sem tempo de espera!`,
          type: "warning",
          icon: "lock-closed",
          confirmText: "Ver Planos",
          cancelText: "Aguardar",
          showCancel: true,
          onConfirm: () => setFreemiumModalVisible(true)
        });
        return false;
      }
    }

    try {
      setVarrendoMonitorId(monitorId);
      await RadarAPI.testMonitor(monitorId);

      // Polling aguardando o worker processar a varredura (forcar_teste volta a ser false)
      let finalizado = false;
      let tentativas = 0;
      while (!finalizado && tentativas < 20) {
        await new Promise(r => setTimeout(r, 1500));
        tentativas++;
        try {
          const { data } = await supabase.from('monitores').select('forcar_teste').eq('id', monitorId).single();
          if (data && data.forcar_teste === false) {
            finalizado = true;
          }
        } catch (pollErr) {}
      }

      // Aplica o cooldown de 90 segundos para este radar específico (exceto para ADMIN)
      if (tierRef.current !== TIERS.ADMIN) {
        const novoExp = Date.now() + 90 * 1000;
        setAntiSpamCooldowns(prev => {
          const updated = { ...prev, [monitorId]: novoExp };
          AsyncStorage.setItem('@achoai_antispam_cooldowns', JSON.stringify(updated)).catch(() => {});
          return updated;
        });
      }

      if (tierRef.current === TIERS.FREE) {
        await TierService.recordSweep();
        setSweepCooldownSeconds(3600);
      }

      // Recarrega todos os dados atualizados com novas ofertas e logs silenciosamente
      await fetchData(null, true);

      // Modal de varredura concluída removido permanentemente conforme solicitado
      return true;
    } catch (e) {
      showAlert({
        title: "Erro na Varredura",
        message: "Falha ao processar comando de varredura nos servidores.",
        type: "error"
      });
      return false;
    } finally {
      setVarrendoMonitorId(null);
    }
  }, [varrendoMonitorId, antiSpamCooldowns, fetchData, showAlert]);

  // Abertura de ofertas: Free abre dentro do app com cadeado; Premium abre link externo direto
  const handleOpenAd = useCallback((item) => {
    if (!item) return;
    if (tierRef.current === TIERS.FREE) {
      setSelectedAdItem(item);
      setAdDetailModalVisible(true);
    } else {
      if (item.url) {
        Linking.openURL(formatarUrlAfiliado(item.url)).catch(() => showAlert({
          title: "Aviso",
          message: "Não foi possível abrir o link da oferta.",
          type: "error"
        }));
      }
    }
  }, [showAlert]);

  // Ativação do teste grátis de 2 dias (Premium Lite)
  const handleActivateTrial = useCallback(async () => {
    try {
      const devId = deviceIdRef.current;
      const authUser = userRef.current;
      const token = pushTokenRef.current;

      if (!authUser) {
        showAlert({
          title: "Conectar Conta Google",
          message: "Para ativar seu teste grátis de 2 dias (Premium Lite), é necessário conectar sua conta Google primeiro.",
          type: "warning",
          confirmText: "Ir para Configurações",
          cancelText: "Cancelar",
          showCancel: true,
          onConfirm: () => setFreemiumModalVisible(false)
        });
        return;
      }

      if (!token) {
        showAlert({
          title: "Ativar Notificações",
          message: "Para ativar o teste de 2 dias (Premium Lite), é obrigatório estar com as notificações ativadas no seu celular.",
          type: "warning",
          icon: "notifications-outline"
        });
        return;
      }

      setActivatingTrial(true);
      const res = await TierService.activateTrial(devId, authUser, token);

      if (res.success) {
        await refreshTierState(devId, authUser);
        setFreemiumModalVisible(false);
        showAlert({
          title: "Teste Grátis Ativado!",
          message: "Você agora tem acesso completo a todas as funções do AchôAI Premium durante 48 horas (2 dias)!",
          type: "success",
          icon: "sparkles"
        });
        fetchData(null, true);
      } else {
        showAlert({
          title: "Aviso",
          message: res.message || "Não foi possível ativar o teste grátis.",
          type: "warning"
        });
      }
    } catch (e) {
      showAlert({
        title: "Erro",
        message: "Falha ao ativar teste de 2 dias.",
        type: "error"
      });
    } finally {
      setActivatingTrial(false);
    }
  }, [refreshTierState, fetchData, showAlert]);

  // Assinatura do plano Premium por 30 dias (R$ 39,90/mês)
  const handleSubscribePremium = useCallback(async () => {
    try {
      const devId = deviceIdRef.current;
      const authUser = userRef.current;

      if (!authUser) {
        showAlert({
          title: "Conectar Conta Google",
          message: "Para assinar o plano Premium (R$ 39,90/mês), é necessário conectar sua conta Google para associar sua assinatura.",
          type: "warning",
          confirmText: "Ir para Configurações",
          cancelText: "Cancelar",
          showCancel: true,
          onConfirm: () => setFreemiumModalVisible(false)
        });
        return;
      }

      setSubscribing(true);

      // Simula checkout seguro via Google Play Billing
      await new Promise(resolve => setTimeout(resolve, 1600));

      const res = await TierService.simulateSubscribePremium(devId, authUser);
      if (res.success) {
        await refreshTierState(devId, authUser);
        setFreemiumModalVisible(false);
        setCelebrationModalVisible(true);

        if (authUser && devId) {
          await migrateDeviceMonitorsToAccount(devId, authUser.id, pushTokenRef.current);
        }
        fetchData(null, true);
      } else {
        showAlert({
          title: "Aviso",
          message: res.message || "Não foi possível processar a assinatura.",
          type: "warning"
        });
      }
    } catch (e) {
      showAlert({
        title: "Erro",
        message: "Falha ao processar assinatura.",
        type: "error"
      });
    } finally {
      setSubscribing(false);
    }
  }, [refreshTierState, fetchData, showAlert]);

  // Atualização em tempo real do cooldown de 60 min no Free
  useEffect(() => {
    const timer = setInterval(async () => {
      if (tierRef.current === TIERS.FREE) {
        const rem = await TierService.getSweepCooldown(TIERS.FREE);
        setSweepCooldownSeconds(rem);
      } else {
        setSweepCooldownSeconds(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Carrega cooldowns anti-spam de 120s persistidos no cache
  useEffect(() => {
    AsyncStorage.getItem('@achoai_antispam_cooldowns').then(cached => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const now = Date.now();
          const clean = {};
          for (const [id, exp] of Object.entries(parsed)) {
            if (exp > now) clean[id] = exp;
          }
          setAntiSpamCooldowns(clean);
        } catch (e) {}
      }
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setupNotifications();

      const devId = await getOrCreateDeviceId();
      if (!mounted) return;
      setDeviceId(devId);
      deviceIdRef.current = devId;

      const { data: { session } } = await supabaseAuth.auth.getSession();
      const currentUser = session?.user ?? null;
      if (currentUser && mounted) {
        setUser(currentUser);
        userRef.current = currentUser;
      }

      const savedNotif = await AsyncStorage.getItem('@radar_notificacoes_ativas');
      const isNotifActive = savedNotif !== null ? savedNotif === 'true' : true;
      if (mounted) setNotificacoesAtivas(isNotifActive);

      let currentToken = null;
      if (isNotifActive) {
        try {
          const token = await registerPushToken(devId, currentUser?.id);
          if (token && mounted) {
            currentToken = token;
            setPushToken(token);
            pushTokenRef.current = token;
          }
        } catch (err) {
          console.log('Aviso Push:', err);
        }
      } else {
        setPushToken(null);
        pushTokenRef.current = null;
      }

      await registerDeviceInSupabase(devId, currentToken, currentUser?.id, isNotifActive);
      await refreshTierState(devId, currentUser);

      if (currentUser && (tierRef.current === TIERS.PREMIUM || tierRef.current === TIERS.ADMIN)) {
        await migrateDeviceMonitorsToAccount(devId, currentUser.id, currentToken);
      }

      fetchData(null);
    }

    init();

    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(async (event, session) => {
      const authUser = session?.user ?? null;
      const currentDevId = deviceIdRef.current;
      const currentToken = pushTokenRef.current;

      if (event === 'SIGNED_IN' && authUser && currentDevId) {
        setUser(authUser);
        userRef.current = authUser;
        await refreshTierState(currentDevId, authUser);
        if (tierRef.current === TIERS.PREMIUM || tierRef.current === TIERS.ADMIN) {
          await migrateDeviceMonitorsToAccount(currentDevId, authUser.id, currentToken);
        }
        fetchData(null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        userRef.current = null;
        setMonitores([]);
        setResultados([]);
        setAtividades([]);
      }
    });

    const unsubscribeEvents = subscribeNotificationEvents(
      () => { fetchData(null, true); },
      (response) => {
        const data = response?.notification?.request?.content?.data;
        const title = response?.notification?.request?.content?.title;
        if (data?.url) {
          if (tierRef.current === TIERS.FREE) {
            setSelectedAdItem({
              id: `notif_${Date.now()}`,
              title: title || 'Oferta Detectada pelo Robô',
              price: null,
              url: data.url,
              created_at: new Date().toISOString()
            });
            setAdDetailModalVisible(true);
          } else {
            Linking.openURL(formatarUrlAfiliado(data.url)).catch(() => {});
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      if (unsubscribeEvents) unsubscribeEvents();
    };
  }, [fetchData, refreshTierState]);

  // Realtime Supabase
  useEffect(() => {
    if (!currentOwnerId) return;

    let debounceTimer = null;
    const debouncedSilentFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchData(null, true);
      }, 1200);
    };

    const channel = supabase
      .channel(`realtime-radar-${currentOwnerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitores' }, (payload) => {
        if (payload?.eventType === 'UPDATE' && payload.new) {
          setMonitores(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        } else if (payload?.eventType === 'INSERT' && payload.new) {
          if (payload.new.usuario_id === currentOwnerId) {
            setMonitores(prev => [payload.new, ...prev.filter(m => m.id !== payload.new.id)]);
          }
        } else if (payload?.eventType === 'DELETE' && payload.old) {
          setMonitores(prev => prev.filter(m => m.id !== payload.old.id));
        }
        debouncedSilentFetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resultados' }, (payload) => {
        if (payload?.eventType === 'INSERT' && payload.new) {
          const currentMonitorIds = (monitoresRef.current || []).map(m => m.id);
          if (payload.new.monitor_id && currentMonitorIds.includes(payload.new.monitor_id)) {
            setResultados(prev => {
              if (prev.some(r => r.id === payload.new.id)) return prev;
              return [payload.new, ...prev].slice(0, 40);
            });
            try {
              Vibration.vibrate(Platform.OS === 'android' ? [0, 80, 50, 100] : 100);
            } catch (e) {}
          }
        }
        debouncedSilentFetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, (payload) => {
        if (payload?.eventType === 'INSERT' && payload.new) {
          const currentMonitorIds = (monitoresRef.current || []).map(m => m.id);
          if (payload.new.monitor_id && currentMonitorIds.includes(payload.new.monitor_id)) {
            setAtividades(prev => {
              if (prev.some(l => l.id === payload.new.id)) return prev;
              return [payload.new, ...prev].slice(0, 8);
            });
          }
        }
        debouncedSilentFetch();
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [currentOwnerId, fetchData]);

  const pausarOuRetomarVarreduras = useCallback(async () => {
    const temAtivos = (monitores || []).some(m => m.ativo);
    if (temAtivos) {
      showAlert({
        title: "Pausar Todas as Varreduras?",
        message: "O robô deixará de varrer automaticamente as plataformas até que você retome os radares.",
        type: "warning",
        icon: "pause-circle",
        confirmText: "Pausar Tudo",
        cancelText: "Voltar",
        showCancel: true,
        onConfirm: async () => {
          try {
            await RadarAPI.pauseAllMonitors(currentOwnerId);
            setVarrendoMonitorId(null);
            await fetchData(null, true);
            showAlert({
              title: "Varreduras Pausadas",
              message: "Todos os seus radares foram pausados com sucesso.",
              type: "success",
              icon: "checkmark-circle"
            });
          } catch (e) {
            showAlert({
              title: "Erro",
              message: "Não foi possível pausar as varreduras.",
              type: "error"
            });
          }
        }
      });
    } else {
      if ((monitores || []).length === 0) {
        showAlert({
          title: "Nenhum Radar",
          message: "Você ainda não possui nenhum radar cadastrado para retomar.",
          type: "warning",
          icon: "alert-circle"
        });
        return;
      }
      try {
        await RadarAPI.resumeAllMonitors(currentOwnerId);
        await fetchData(null, true);
        showAlert({
          title: "Varreduras Retomadas",
          message: "Todos os seus radares foram reativados e o robô voltou a operar normalmente!",
          type: "success",
          icon: "play-circle"
        });
      } catch (e) {
        showAlert({
          title: "Erro",
          message: "Não foi possível retomar as varreduras.",
          type: "error"
        });
      }
    }
  }, [monitores, currentOwnerId, fetchData, showAlert]);

  const pararVarredurasEmergencia = useCallback(async () => {
    showAlert({
      title: "Parar Todas as Varreduras?",
      message: "Isso cancelará imediatamente qualquer varredura em andamento e desativará todos os seus radares ativos para sua segurança.",
      type: "warning",
      icon: "stop-circle",
      confirmText: "Parar Agora",
      cancelText: "Cancelar",
      showCancel: true,
      onConfirm: async () => {
        try {
          setVarrendoMonitorId(null);
          await RadarAPI.stopAllSweeps(currentOwnerId);
          await fetchData(null, true);
          showAlert({
            title: "Operação Interrompida",
            message: "Todas as varreduras foram canceladas e os radares foram parados com segurança.",
            type: "success",
            icon: "shield-checkmark"
          });
        } catch (e) {
          showAlert({
            title: "Erro",
            message: "Falha ao interromper as varreduras no servidor.",
            type: "error"
          });
        }
      }
    });
  }, [currentOwnerId, fetchData, showAlert]);

  return (
    <RadarContext.Provider value={{ 
      monitores, resultados, atividades, pushToken, setPushToken, deviceId, user, currentOwnerId,
      notificacoesAtivas, alternarNotificacoes,
      loading, refreshing, onRefresh, fetchData, linkAccount, logoutUser,
      // Freemium context
      tier, tierState, trialEligibility, activatingTrial, subscribing,
      sweepCooldownSeconds, dispararVarreduraManual, handleOpenAd,
      antiSpamCooldowns, varrendoMonitorId,
      pausarOuRetomarVarreduras, pararVarredurasEmergencia,
      openUpgradeModal: () => setFreemiumModalVisible(true),
      closeUpgradeModal: () => setFreemiumModalVisible(false),
      handleActivateTrial, handleSubscribePremium,
      refreshTierState,
      showAlert, hideAlert
    }}>
      {children}
      <FreemiumModal 
        visible={freemiumModalVisible}
        onClose={() => setFreemiumModalVisible(false)}
        onActivateTrial={handleActivateTrial}
        onSubscribe={handleSubscribePremium}
        trialEligibility={trialEligibility}
        activatingTrial={activatingTrial}
        subscribing={subscribing}
      />
      <CelebrationModal 
        visible={celebrationModalVisible}
        onClose={() => setCelebrationModalVisible(false)}
        durationDays={30}
      />
      <TrialExpiredModal 
        visible={trialExpiredModalVisible}
        onSubscribe={() => {
          setTrialExpiredModalVisible(false);
          handleSubscribePremium();
        }}
        onContinueFree={() => setTrialExpiredModalVisible(false)}
      />
      <RenewalModal 
        visible={renewalModalVisible}
        remainingDays={remainingRenewalDays}
        onRenew={() => {
          setRenewalModalVisible(false);
          handleSubscribePremium();
        }}
        onDismiss={() => setRenewalModalVisible(false)}
      />
      <AdDetailModal 
        visible={adDetailModalVisible}
        item={selectedAdItem}
        onClose={() => {
          setAdDetailModalVisible(false);
          setSelectedAdItem(null);
        }}
        onUnlock={() => {
          setAdDetailModalVisible(false);
          setFreemiumModalVisible(true);
        }}
      />
      <CustomAlertModal 
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        icon={alertConfig.icon}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
        showCancel={alertConfig.showCancel}
        onClose={hideAlert}
      />
    </RadarContext.Provider>
  );
}


// =====================================================================
// 3. AUXILIARES E COMPONENTES DE ESTRATÉGIA
// =====================================================================

function identificarPlataforma(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('kabum.com.br')) return 'KABUM';
  if (u.includes('americanas.com.br')) return 'AMERICANAS';
  if (u.includes('shein.com') || u.includes('shein.top')) return 'SHEIN';
  if (u.includes('magazineluiza.com.br') || u.includes('magalu.com')) return 'MAGALU';
  if (u.includes('amazon.com.br') || u.includes('amazon.com') || u.includes('amzn.to')) return 'AMAZON';
  if (u.includes('facebook.com')) return 'FACEBOOK';
  if (u.includes('zoom.com.br')) return 'ZOOM';
  if (u.includes('shopee.com.br')) return 'SHOPEE';
  if (u.includes('mercadolivre.com') || u.includes('mercadolivre.com.br')) return 'MERCADO_LIVRE';
  if (u.includes('olx.com.br')) return 'OLX';
  return 'OUTROS';
}

function normalizarSlugCidade(texto) {
  if (!texto) return 'fortaleza';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function extrairCidadeFacebook(url) {
  if (!url) return 'fortaleza';
  const match = url.match(/marketplace\/([^\/\?]+)/);
  if (match && match[1] && !['search', 'item', 'category'].includes(match[1])) {
    return match[1];
  }
  return 'fortaleza';
}

function identificarEstrategia(m) {
  if (!m) return 'mais_recentes';
  if (m.modo === 'maior_desconto') return 'maior_desconto';
  if (m.modo === 'menor_preco') return 'menor_preco';
  if (m.modo === 'por_preco') return 'por_preco';
  if (m.modo === 'mais_recentes') return 'mais_recentes';
  if (m.preco_alvo && Number(m.preco_alvo) > 0) return 'por_preco';
  return 'mais_recentes';
}

function extrairInfoOlx(url) {
  let ufEncontrada = 'BR';
  let regiaoEncontrada = '';
  if (!url) return { uf: ufEncontrada, regiaoSlug: regiaoEncontrada };

  const u = url.toLowerCase();
  if (u.includes('/brasil?') || u.includes('/brasil/') || u.endsWith('/brasil')) {
    return { uf: 'BR', regiaoSlug: '' };
  }

  for (const [uf, dados] of Object.entries(OLX_ESTADOS)) {
    if (uf === 'BR') continue;
    if (url.includes(`/${dados.slug}/`) || url.includes(`/${dados.slug}?`) || url.endsWith(`/${dados.slug}`)) {
      ufEncontrada = uf;
      for (const reg of dados.regioes) {
        if (reg.slug && url.includes(`/${reg.slug}`)) {
          regiaoEncontrada = reg.slug;
          break;
        }
      }
      break;
    }
  }
  return { uf: ufEncontrada, regiaoSlug: regiaoEncontrada };
}

function formatarTempoRegressivo(proximaDataStr, now) {
  if (!proximaDataStr) return 'Aguardando agendamento';
  const diffMs = new Date(proximaDataStr).getTime() - now;
  if (diffMs <= 0) return 'Varrendo em instantes...';

  const totalSegundos = Math.floor(diffMs / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  if (horas > 0) return `${horas}h ${minutos}m ${segundos}s`;
  if (minutos > 0) return `${minutos}m ${segundos}s`;
  return `${segundos}s`;
}

function calcularSegundosProximaVarredura(monitores, now) {
  const ativos = (monitores || []).filter(m => m.ativo && m.proxima_execucao);
  if (ativos.length === 0) return null;
  
  let menorDiff = Infinity;
  for (const m of ativos) {
    const diff = Math.floor((new Date(m.proxima_execucao).getTime() - now) / 1000);
    if (diff < menorDiff) menorDiff = diff;
  }
  if (menorDiff === Infinity) return null;
  return menorDiff <= 0 ? 0 : menorDiff;
}

// Componente de Vidro Fosco Cross-Platform (sem fallback de caixa cinza opaca no Android)
function FrostedOverlay({ style, children }) {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={50} tint="dark" style={style}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={style}>
      {children}
    </View>
  );
}

// Modal seletor moderno para Estado e Região
function SelectionModal({ visible, title, items, selectedId, onSelect, onClose }) {
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (visible) setBusca('');
  }, [visible]);

  const filtrados = (items || []).filter(it => {
    const texto = `${it.nome || ''} ${it.uf || ''}`.toLowerCase();
    return texto.includes(busca.toLowerCase());
  });

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={THEME.textMuted} />
            </TouchableOpacity>
          </View>

          {(items && items.length > 6) && (
            <View style={styles.modalSearchBox}>
              <Ionicons name="search-outline" size={16} color={THEME.textSubtle} style={{ marginRight: 8 }} />
              <TextInput 
                style={styles.modalSearchInput}
                placeholder="Filtrar opções..."
                placeholderTextColor={THEME.textSubtle}
                value={busca}
                onChangeText={setBusca}
                autoCorrect={false}
              />
              {busca.length > 0 && (
                <TouchableOpacity onPress={() => setBusca('')}>
                  <Ionicons name="close-circle" size={16} color={THEME.textSubtle} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <FlatList 
            data={filtrados}
            keyExtractor={(item, index) => item.uf || item.slug || String(index)}
            renderItem={({ item }) => {
              const isSelected = (item.uf && item.uf === selectedId) || (item.slug !== undefined && item.slug === selectedId);
              return (
                <TouchableOpacity 
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  onPress={() => { onSelect(item); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                    {item.nome} {item.uf ? `(${item.uf})` : ''}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color={THEME.primary} />}
                </TouchableOpacity>
              );
            }}
            style={{ maxHeight: 340 }}
          />
        </View>
      </View>
    </Modal>
  );
}

// =====================================================================
// 4. TELAS DO APLICATIVO
// =====================================================================

// --- TELA 1: HOME / DASHBOARD (VISÃO GERAL OPERACIONAL) ---
function DashboardScreen({ navigation }) {
  const { 
    monitores, resultados, atividades, loading, refreshing, onRefresh, fetchData,
    tier, openUpgradeModal, handleOpenAd, showAlert,
    pausarOuRetomarVarreduras, pararVarredurasEmergencia, varrendoMonitorId
  } = useContext(RadarContext);
  const ativos = monitores.filter(m => m.ativo).length;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { fetchData(null, true); });
    return unsub;
  }, [navigation, fetchData]);

  const segProx = calcularSegundosProximaVarredura(monitores, now);
  const segProxFormatado = useMemo(() => {
    if (segProx === null) return '--';
    if (segProx <= 0) return 'Agora';
    if (segProx > 60) return `${Math.ceil(segProx / 60)}m`;
    return `${segProx}s`;
  }, [segProx]);

  const handleNovoRadarPress = () => {
    if (tier === TIERS.FREE && monitores.length >= 1) {
      showAlert({
        title: "Limite do Plano Free",
        message: "Usuários do plano Free podem criar até 1 radar por vez. Desbloqueie até 5 radares simultâneos e varreduras ultra rápidas assinando o AchôAI Premium!",
        type: "warning",
        icon: "lock-closed",
        confirmText: "Conhecer Premium",
        cancelText: "Entendi",
        showCancel: true,
        onConfirm: openUpgradeModal
      });
    } else {
      navigation.navigate('Criar');
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      
      {/* BRAND BAR SUPERIOR COM LOGO 3D REAL, STATUS E TIER BADGE */}
      <View style={styles.brandHeader}>
        <View style={styles.brandGroup}>
          <Image 
            source={require('./assets/android-icon-foreground.png')} 
            style={styles.brandLogoImage} 
            resizeMode="contain" 
          />
          <View style={styles.brandTextGroup}>
            <View style={styles.row}>
              <Text style={styles.brandName}>AchôAI</Text>
              <View style={{ marginLeft: 8 }}>
                <TierBadge tier={tier} onPress={openUpgradeModal} size="sm" />
              </View>
            </View>
            <View style={styles.livePulseRow}>
              <View style={styles.livePulseDot} />
              <Text style={styles.livePulseText}>Robô Online</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.btnHeaderAction}
          onPress={handleNovoRadarPress}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={17} color="#08090D" style={{ marginRight: 2 }} />
          <Text style={styles.btnHeaderActionText}>Novo Radar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* MÉTRICAS OPERACIONAIS */}
        <View style={styles.metricsRow}>
          <MetricBox 
            icon="pulse"
            value={ativos}
            label="Radares"
            sublabel="Monitorando"
            color={THEME.primary}
            bg={THEME.primaryGlow}
          />
          <MetricBox 
            icon="pricetag"
            value={resultados.length}
            label="Oportunidades"
            sublabel="Capturadas"
            color={THEME.success}
            bg={THEME.successBg}
          />
          {tier === TIERS.FREE ? (
            <MetricBox 
              icon="lock-closed"
              value="3 Horas"
              label="Próxima Busca"
              sublabel="Upgrade ⚡"
              color={THEME.primary}
              bg={THEME.primaryGlow}
              onPress={openUpgradeModal}
            />
          ) : (
            <MetricBox 
              icon="timer-outline"
              value={segProxFormatado}
              label="Próxima Busca"
              sublabel="Ciclo do Robô"
              color={THEME.info}
              bg={THEME.infoBg}
            />
          )}
        </View>

        {/* SEÇÃO: ÚLTIMAS OPORTUNIDADES */}
        <SectionHeader 
          title="Últimas Oportunidades" 
          icon="sparkles"
          actionText={resultados.length > 0 ? `Ver Todas (${resultados.length})` : null}
          onAction={() => navigation.navigate('Alertas')}
        />

        {resultados.length === 0 ? (
          <Surface style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="scan-outline" size={28} color={THEME.primary} />
            </View>
            <Text style={styles.emptyCardTitle}>Nenhuma oportunidade capturada ainda</Text>
            <Text style={styles.emptyCardSub}>
              O robô de busca analisa as plataformas nos intervalos configurados e avisará com vibração e alerta assim que encontrar novidades.
            </Text>
          </Surface>
        ) : (
          resultados.slice(0, 3).map(item => {
            const plat = identificarPlataforma(item.url);
            const shopeeInfo = plat === 'SHOPEE' 
              ? parseShopeeInfo(item.title, item.url) 
              : { cleanTitle: item.title, origem: null, desconto: null, score: null, vendidos: null };
            const mlInfo = plat === 'MERCADO_LIVRE'
              ? parseMLInfo(item.title, item.url)
              : null;
            const amzInfo = plat === 'AMAZON'
              ? parseAmazonInfo(item.title, item.url)
              : null;
            const magaluInfo = plat === 'MAGALU'
              ? parseMagaluInfo(item.title, item.url)
              : null;
            const kabumInfo = plat === 'KABUM'
              ? parseKabumInfo(item.title, item.url)
              : null;
            const ameInfo = plat === 'AMERICANAS'
              ? parseAmericanasInfo(item.title, item.url)
              : null;
            const sheinInfo = plat === 'SHEIN'
              ? parseSheinInfo(item.title, item.url)
              : null;
            const displayTitle = plat === 'SHOPEE' 
              ? shopeeInfo.cleanTitle 
              : plat === 'MERCADO_LIVRE' && mlInfo 
              ? mlInfo.cleanTitle 
              : plat === 'AMAZON' && amzInfo
              ? amzInfo.cleanTitle
              : plat === 'MAGALU' && magaluInfo
              ? magaluInfo.cleanTitle
              : plat === 'KABUM' && kabumInfo
              ? kabumInfo.cleanTitle
              : plat === 'AMERICANAS' && ameInfo
              ? ameInfo.cleanTitle
              : plat === 'SHEIN' && sheinInfo
              ? sheinInfo.cleanTitle
              : item.title;

            return (
              <Surface key={item.id} style={styles.opportunityCard}>
                <View style={styles.opportunityHeader}>
                  <View style={styles.opportunityHeaderTags}>
                    <PlatformBadge platformKey={plat} />
                    {plat === 'SHOPEE' && shopeeInfo.origem && (
                      <ShopeeOriginBadge origem={shopeeInfo.origem} />
                    )}
                    {plat === 'SHOPEE' && shopeeInfo.desconto && (
                      <ShopeeDiscountBadge discount={shopeeInfo.desconto} />
                    )}
                    {plat === 'SHOPEE' && (shopeeInfo.score || shopeeInfo.vendidos) && (
                      <ShopeeRatingBadge score={shopeeInfo.score} vendidos={shopeeInfo.vendidos} />
                    )}
                    {plat === 'MERCADO_LIVRE' && mlInfo && mlInfo.isFull && (
                      <MLFullBadge />
                    )}
                    {plat === 'MERCADO_LIVRE' && mlInfo && mlInfo.isFreteGratis && (
                      <MLFreeShippingBadge />
                    )}
                    {plat === 'MERCADO_LIVRE' && mlInfo && mlInfo.desconto && (
                      <MLDiscountBadge discount={mlInfo.desconto} />
                    )}
                    {plat === 'AMAZON' && amzInfo && amzInfo.origem && (
                      <ShopeeOriginBadge origem={amzInfo.origem} />
                    )}
                    {plat === 'AMAZON' && amzInfo && amzInfo.isPrime && (
                      <AmazonPrimeBadge />
                    )}
                    {plat === 'AMAZON' && amzInfo && amzInfo.isFreteGratis && !amzInfo.isPrime && (
                      <AmazonFreeShippingBadge />
                    )}
                    {plat === 'AMAZON' && amzInfo && amzInfo.desconto && (
                      <AmazonDiscountBadge discount={amzInfo.desconto} />
                    )}
                    {plat === 'AMAZON' && amzInfo && amzInfo.score && (
                      <ShopeeRatingBadge score={amzInfo.score} />
                    )}
                    {plat === 'MAGALU' && magaluInfo && magaluInfo.origem && (
                      <ShopeeOriginBadge origem={magaluInfo.origem} />
                    )}
                    {plat === 'MAGALU' && magaluInfo && magaluInfo.isFull && (
                      <MagaluFullBadge />
                    )}
                    {plat === 'MAGALU' && magaluInfo && magaluInfo.isFreteGratis && (
                      <MagaluFreeShippingBadge />
                    )}
                    {plat === 'MAGALU' && magaluInfo && magaluInfo.desconto && (
                      <MagaluDiscountBadge discount={magaluInfo.desconto} />
                    )}
                    {plat === 'MAGALU' && magaluInfo && magaluInfo.score && (
                      <ShopeeRatingBadge score={magaluInfo.score} />
                    )}
                    {plat === 'KABUM' && kabumInfo && kabumInfo.isFreteGratis && (
                      <KabumFreeShippingBadge />
                    )}
                    {plat === 'KABUM' && kabumInfo && kabumInfo.desconto && (
                      <KabumDiscountBadge discount={kabumInfo.desconto} />
                    )}
                    {plat === 'KABUM' && kabumInfo && kabumInfo.score && (
                      <ShopeeRatingBadge score={kabumInfo.score} />
                    )}
                    {plat === 'AMERICANAS' && ameInfo && ameInfo.isEntregaRapida && (
                      <AmericanasFastDeliveryBadge />
                    )}
                    {plat === 'AMERICANAS' && ameInfo && ameInfo.isFreteGratis && (
                      <AmericanasFreeShippingBadge />
                    )}
                    {plat === 'AMERICANAS' && ameInfo && ameInfo.desconto && (
                      <AmericanasDiscountBadge discount={ameInfo.desconto} />
                    )}
                    {plat === 'AMERICANAS' && ameInfo && ameInfo.score && (
                      <ShopeeRatingBadge score={ameInfo.score} />
                    )}
                    {plat === 'SHEIN' && sheinInfo && sheinInfo.origem && (
                      <ShopeeOriginBadge origem={sheinInfo.origem} />
                    )}
                    {plat === 'SHEIN' && sheinInfo && sheinInfo.isMaisVendidos && (
                      <SheinBestSellerBadge />
                    )}
                    {plat === 'SHEIN' && sheinInfo && sheinInfo.desconto && (
                      <SheinDiscountBadge discount={sheinInfo.desconto} />
                    )}
                    {plat === 'SHEIN' && sheinInfo && sheinInfo.score && (
                      <ShopeeRatingBadge score={sheinInfo.score} />
                    )}
                  </View>
                  <Text style={styles.opportunityDate}>
                    {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Hoje
                  </Text>
                </View>

                <Text style={styles.opportunityTitle} numberOfLines={2}>{displayTitle}</Text>

                <View style={styles.opportunityFooter}>
                  {item.price !== null && Number(item.price) > 0 ? (
                    <View style={styles.priceContainer}>
                      <Text style={styles.pricePrefix}>R$</Text>
                      <Text style={styles.priceNumber}>{Number(item.price).toFixed(2)}</Text>
                    </View>
                  ) : (
                    <Text style={styles.priceConsult}>Sob Consulta</Text>
                  )}

                  <TouchableOpacity 
                    style={styles.btnOpenOffer}
                    onPress={() => {
                      if (item.url) {
                        Linking.openURL(formatarUrlAfiliado(item.url)).catch(() => showAlert({
                          title: "Erro",
                          message: "Não foi possível abrir o link da oferta.",
                          type: "error"
                        }));
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnOpenOfferText}>
                      {plat === 'KABUM' ? 'Ver no KaBuM' : plat === 'AMERICANAS' ? 'Ver na Americanas' : plat === 'SHEIN' ? 'Ver na SHEIN' : plat === 'MAGALU' ? 'Ver no Magalu' : plat === 'AMAZON' ? 'Ver na Amazon' : plat === 'MERCADO_LIVRE' ? 'Ver no Mercado Livre' : plat === 'SHOPEE' ? 'Ver na Shopee' : plat === 'ZOOM' ? 'Ver no Zoom' : plat === 'FACEBOOK' ? 'Ver no Facebook' : plat === 'OLX' ? 'Ver na OLX' : 'Ver Oferta'}
                    </Text>
                    <Ionicons name="arrow-forward" size={13} color={THEME.primary} style={{ marginLeft: 5 }} />
                  </TouchableOpacity>
                </View>
              </Surface>
            );
          })
        )}

        {/* SEÇÃO: HISTÓRICO DE VARREDURAS (TELEMETRIA EM TEMPO REAL) */}
        <SectionHeader 
          title="Histórico de Varreduras" 
          icon="hardware-chip-outline"
        />

        <Surface style={[styles.telemetryCard, { position: 'relative', overflow: 'hidden', minHeight: 180 }]}>
          <View style={styles.telemetryTargetContainer}>
            {atividades.length === 0 ? (
              <View style={{ paddingVertical: 10 }}>
                <View style={styles.telemetryRow}>
                  <View style={[styles.telemetryDot, { backgroundColor: THEME.success }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.telemetryMessage, tier === TIERS.FREE && styles.blurredTelemetryMessage]}>
                      Robô AchôAI conectado e operando em segundo plano
                    </Text>
                    <View style={styles.telemetryMetaRow}>
                      <Text style={[styles.telemetryTime, tier === TIERS.FREE && styles.blurredTime]}>Hoje</Text>
                      <Text style={styles.telemetrySeparator}>•</Text>
                      <Text style={[styles.telemetrySource, tier === TIERS.FREE && styles.blurredTime]}>Sistema</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.telemetryRow}>
                  <View style={[styles.telemetryDot, { backgroundColor: THEME.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.telemetryMessage, tier === TIERS.FREE && styles.blurredTelemetryMessage]}>
                      Varredura inteligente programada para as plataformas ativas
                    </Text>
                    <View style={styles.telemetryMetaRow}>
                      <Text style={[styles.telemetryTime, tier === TIERS.FREE && styles.blurredTime]}>Hoje</Text>
                      <Text style={styles.telemetrySeparator}>•</Text>
                      <Text style={[styles.telemetrySource, tier === TIERS.FREE && styles.blurredTime]}>Robô AchôAI</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.telemetryRow, { borderBottomWidth: 0 }]}>
                  <View style={[styles.telemetryDot, { backgroundColor: THEME.info }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.telemetryMessage, tier === TIERS.FREE && styles.blurredTelemetryMessage]}>
                      Aguardando próximo ciclo de varredura...
                    </Text>
                    <View style={styles.telemetryMetaRow}>
                      <Text style={[styles.telemetryTime, tier === TIERS.FREE && styles.blurredTime]}>Hoje</Text>
                      <Text style={styles.telemetrySeparator}>•</Text>
                      <Text style={[styles.telemetrySource, tier === TIERS.FREE && styles.blurredTime]}>Agendador</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              atividades.slice(0, 6).map((at, idx) => {
                const dotColor = at.level === 'SUCCESS' ? THEME.success 
                               : at.level === 'ERROR' ? THEME.danger 
                               : at.level === 'WARNING' ? THEME.warning 
                               : THEME.info;
                return (
                  <View key={at.id || idx} style={[styles.telemetryRow, idx === Math.min(atividades.length, 6) - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[styles.telemetryDot, { backgroundColor: dotColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.telemetryMessage, tier === TIERS.FREE && styles.blurredTelemetryMessage]}>
                        {at.message}
                      </Text>
                      <View style={styles.telemetryMetaRow}>
                        <Text style={[styles.telemetryTime, tier === TIERS.FREE && styles.blurredTime]}>
                          {new Date(at.created_at).toLocaleTimeString('pt-BR')}
                        </Text>
                        <Text style={styles.telemetrySeparator}>•</Text>
                        <Text style={[styles.telemetrySource, tier === TIERS.FREE && styles.blurredTime]}>Robô AchôAI</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* OVERLAY DESFOCADO COM CADEADO E FROSTED GLASS SE FOR FREE */}
          {tier === TIERS.FREE && (
            <FrostedOverlay style={[StyleSheet.absoluteFill, styles.frostedOverlay]}>
              <View style={styles.frostedLockContent}>
                <View style={styles.frostedLockCircle}>
                  <Ionicons name="lock-closed" size={24} color="#FFF" />
                </View>
                <Text style={styles.frostedLockTitle}>Histórico em Tempo Real</Text>
                <Text style={styles.frostedLockSub}>
                  O robô está trabalhando em segundo plano. Desbloqueie a telemetria ao vivo com o AchôAI Premium.
                </Text>
                <TouchableOpacity 
                  style={styles.btnFrostedUnlock}
                  onPress={openUpgradeModal}
                  activeOpacity={0.85}
                >
                  <Ionicons name="sparkles" size={14} color="#08090D" style={{ marginRight: 6 }} />
                  <Text style={styles.btnFrostedUnlockText}>Desbloquear com Premium</Text>
                </TouchableOpacity>
              </View>
            </FrostedOverlay>
          )}
        </Surface>

        {/* SEÇÃO: CONTROLES DE VARREDURA (PAUSAR / PARAR) */}
        <SectionHeader 
          title="Controles de Varredura" 
          icon="shield-checkmark-outline"
        />

        <Surface style={styles.emergencyControlsCard}>
          <View style={styles.emergencyHeaderRow}>
            <View style={[styles.statusIndicatorDot, { backgroundColor: varrendoMonitorId ? THEME.primary : ativos > 0 ? THEME.success : THEME.warning }]} />
            <Text style={styles.emergencyStatusText}>
              {varrendoMonitorId 
                ? 'Varredura em andamento pelo robô...' 
                : ativos > 0 
                  ? `${ativos} radar${ativos > 1 ? 'es' : ''} operando normalmente` 
                  : 'Todas as varreduras estão pausadas'}
            </Text>
          </View>
          <Text style={styles.emergencyCardDesc}>
            Controle a atividade do robô instantaneamente. Você pode pausar temporariamente as buscas programadas ou interromper qualquer varredura com segurança.
          </Text>

          <View style={styles.emergencyButtonsRow}>
            <TouchableOpacity 
              style={[
                styles.btnEmergencyAction, 
                ativos > 0 ? styles.btnPauseMode : styles.btnResumeMode
              ]}
              onPress={pausarOuRetomarVarreduras}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={ativos > 0 ? "pause-circle" : "play-circle"} 
                size={18} 
                color={ativos > 0 ? "#F59E0B" : THEME.primary} 
                style={{ marginRight: 6 }} 
              />
              <Text style={[
                styles.btnEmergencyText, 
                { color: ativos > 0 ? "#F59E0B" : THEME.primary }
              ]}>
                {ativos > 0 ? "Pausar" : "Retomar"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btnEmergencyAction, styles.btnStopMode]}
              onPress={pararVarredurasEmergencia}
              activeOpacity={0.8}
            >
              <Ionicons name="stop-circle" size={18} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={[styles.btnEmergencyText, { color: '#EF4444' }]}>
                Parar
              </Text>
            </TouchableOpacity>
          </View>
        </Surface>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}


// --- TELA 2: RADARES ATIVOS ---
function MonitorListScreen({ navigation }) {
  const { 
    monitores, loading, refreshing, onRefresh, fetchData,
    tier, sweepCooldownSeconds, dispararVarreduraManual, openUpgradeModal,
    antiSpamCooldowns, varrendoMonitorId, showAlert 
  } = useContext(RadarContext);
  const [testandoId, setTestandoId] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const alternarStatus = async (id, atual) => {
    try {
      await RadarAPI.toggleMonitor(id, !atual);
      fetchData(null, true);
    } catch (e) {
      showAlert({
        title: "Erro",
        message: "Não foi possível atualizar o radar.",
        type: "error"
      });
    }
  };

  const handleDispararVarrer = async (id) => {
    setTestandoId(id);
    await dispararVarreduraManual(id);
    setTestandoId(null);
  };

  const handleCriarRadarPress = () => {
    if (tier === TIERS.FREE && monitores.length >= 1) {
      showAlert({
        title: "Limite do Plano Free",
        message: "Você atingiu o limite de 1 radar ativo no Plano Free. Desbloqueie até 5 radares simultâneos e varreduras ultra rápidas assinando o AchôAI Premium!",
        type: "warning",
        icon: "lock-closed",
        confirmText: "Conhecer Premium",
        cancelText: "Entendi",
        showCancel: true,
        onConfirm: openUpgradeModal
      });
    } else {
      navigation.navigate('Criar');
    }
  };

  const removerRadar = (id, nome) => {
    showAlert({
      title: "Excluir Radar",
      message: `Deseja realmente remover o monitor "${nome}"? Esta ação apagará as regras de varredura deste radar.`,
      type: "confirm_danger",
      icon: "trash-outline",
      confirmText: "Sim, Excluir",
      cancelText: "Cancelar",
      showCancel: true,
      onConfirm: async () => {
        try {
          await RadarAPI.deleteMonitor(id);
          fetchData(null, true);
        } catch (err) {
          showAlert({
            title: "Erro",
            message: "Falha ao excluir o radar.",
            type: "error"
          });
        }
      }
    });
  };

  // Formata o tempo de espera do cooldown de 60 min
  const formatarCooldown = (segundos) => {
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    if (min > 0) return `${min}m ${sec}s`;
    return `${sec}s`;
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />

      {/* TOP HEADER */}
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenHeaderTitle}>Radares Ativos</Text>
          <Text style={styles.screenHeaderSub}>
            {monitores.length} {monitores.length === 1 ? 'radar configurado' : 'radares configurados'}
            {tier === TIERS.FREE ? ' (Limite: 1)' : ' (Até 5)'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.headerBtnSquare}
          onPress={handleCriarRadarPress}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color={THEME.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && monitores.length === 0 ? (
          <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 60 }} />
        ) : monitores.length === 0 ? (
          <View style={styles.emptyFullState}>
            <View style={styles.emptyIconPulseCircle}>
              <Ionicons name="radio-outline" size={42} color={THEME.primary} />
            </View>
            <Text style={styles.emptyStateTitle}>Nenhum Radar Configurado</Text>
            <Text style={styles.emptyStateSub}>
              Crie seu primeiro radar para monitorar anúncios na OLX, Zoom, Buscapé ou páginas de notícias com inteligência.
            </Text>
            <PrimaryButton 
              title="Criar Primeiro Radar"
              icon="add-circle-outline"
              onPress={handleCriarRadarPress}
              style={{ marginTop: 24, width: '100%', maxWidth: 260 }}
            />
          </View>
        ) : (
          monitores.map(m => {
            const isProd = m.modo !== 'noticia';
            const plataforma = identificarPlataforma(m.urls);
            const modoEstrat = identificarEstrategia(m);
            const temAlvo = m.preco_alvo !== null && m.preco_alvo !== undefined && Number(m.preco_alvo) > 0;
            const alvo = temAlvo ? Number(m.preco_alvo) : 0;
            const margem = Number(m.margem) || 15;

            let estratDesc = 'Mais Recentes';
            if (m.modo === 'noticia') {
              estratDesc = 'Notícia';
            } else if (modoEstrat === 'maior_desconto') {
              const apenas1 = m.palavras && (m.palavras.includes('ml_apenas_maior_desconto:true') || m.palavras.includes('shopee_apenas_maior_desconto:true') || m.palavras.includes('amz_apenas_maior_desconto:true') || m.palavras.includes('magalu_apenas_maior_desconto:true') || m.palavras.includes('kabum_apenas_maior_desconto:true') || m.palavras.includes('ame_apenas_maior_desconto:true') || m.palavras.includes('shein_apenas_maior_desconto:true'));
              estratDesc = apenas1 ? 'Único Maior Desconto' : 'Maior Desconto';
            } else if (modoEstrat === 'menor_preco') {
              estratDesc = 'Menor Preço';
            } else if (modoEstrat === 'por_preco' && temAlvo) {
              estratDesc = `Alvo R$ ${alvo.toFixed(0)} (±${margem}%)`;
            } else if (m.palavras && m.palavras.includes('ordenar_menor_preco')) {
              estratDesc = 'Recentes (Menor Valor)';
            }

            const infoLocal = plataforma === 'OLX' ? extrairInfoOlx(m.urls) : null;
            const estadoNome = infoLocal ? OLX_ESTADOS[infoLocal.uf]?.nome || infoLocal.uf : null;
            const emCooldown = tier === TIERS.FREE && sweepCooldownSeconds > 0;

            return (
              <Surface key={m.id} style={styles.radarCard} elevated={m.ativo}>
                {/* CABEÇALHO DO RADAR */}
                <View style={styles.radarCardHeader}>
                  <View style={[styles.radarModeIcon, { backgroundColor: isProd ? THEME.primaryGlow : THEME.infoBg }]}>
                    <Ionicons name={isProd ? "cart-outline" : "newspaper-outline"} size={16} color={isProd ? THEME.primary : THEME.info} />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={styles.radarTitle} numberOfLines={1}>{m.nome}</Text>
                    <View style={styles.radarTagsRow}>
                      <PlatformBadge platformKey={plataforma} />
                      <StrategyBadge text={estratDesc} />
                      {estadoNome && (
                        <View style={styles.locationChip}>
                          <Ionicons name="location-outline" size={10} color={THEME.textMuted} style={{ marginRight: 2 }} />
                          <Text style={styles.locationChipText}>{infoLocal.uf}</Text>
                        </View>
                      )}
                      {plataforma === 'SHOPEE' && (() => {
                        const palavrasStr = (m.palavras || '').toLowerCase();
                        const urlStr = (m.urls || '').toLowerCase();
                        const isOnlyNac = palavrasStr.includes('shopee_origem:nacional') || urlStr.includes('locations=-1');
                        const isOnlyInter = palavrasStr.includes('shopee_origem:internacional');
                        const temMelhorAval = palavrasStr.includes('shopee_melhor_avaliacao:true') || urlStr.includes('sortby=sales');

                        let locBadge = null;
                        if (isOnlyNac) {
                          locBadge = (
                            <View style={[styles.locationChip, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                              <Ionicons name="flag-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
                              <Text style={[styles.locationChipText, { color: '#10B981', fontWeight: '700' }]}>Nacional</Text>
                            </View>
                          );
                        } else if (isOnlyInter) {
                          locBadge = (
                            <View style={[styles.locationChip, { borderColor: 'rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                              <Ionicons name="globe-outline" size={10} color="#3B82F6" style={{ marginRight: 3 }} />
                              <Text style={[styles.locationChipText, { color: '#3B82F6', fontWeight: '700' }]}>Internacional</Text>
                            </View>
                          );
                        } else {
                          locBadge = (
                            <>
                              <View style={[styles.locationChip, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                                <Ionicons name="flag-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
                                <Text style={[styles.locationChipText, { color: '#10B981', fontWeight: '700' }]}>Nacional</Text>
                              </View>
                              <View style={[styles.locationChip, { borderColor: 'rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                                <Ionicons name="globe-outline" size={10} color="#3B82F6" style={{ marginRight: 3 }} />
                                <Text style={[styles.locationChipText, { color: '#3B82F6', fontWeight: '700' }]}>Internacional</Text>
                              </View>
                            </>
                          );
                        }

                        return (
                          <>
                            {locBadge}
                            {temMelhorAval && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(255, 187, 0, 0.35)', backgroundColor: 'rgba(255, 187, 0, 0.08)' }]}>
                                <Ionicons name="star" size={10} color="#FFBB00" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#FFBB00', fontWeight: '700' }]}>Top Avaliado</Text>
                              </View>
                            )}
                          </>
                        );
                      })()}
                      {plataforma === 'MERCADO_LIVRE' && (() => {
                        const palavrasStr = (m.palavras || '').toLowerCase();
                        const urlStr = (m.urls || '').toLowerCase();
                        const temFull = palavrasStr.includes('ml_full:true') || urlStr.includes('_frete_full');
                        const temFrete = palavrasStr.includes('ml_frete_gratis:true') || urlStr.includes('_custofrete_gratis');
                        const temNovo = palavrasStr.includes('ml_novo:true') || urlStr.includes('/novo/');
                        const temUsado = palavrasStr.includes('ml_usado:true') || urlStr.includes('/usado/');

                        return (
                          <>
                            {temFull && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(0, 166, 80, 0.35)', backgroundColor: 'rgba(0, 166, 80, 0.08)' }]}>
                                <Ionicons name="flash" size={10} color="#00A650" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#00A650', fontWeight: '700' }]}>FULL</Text>
                              </View>
                            )}
                            {temFrete && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                                <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#10B981', fontWeight: '700' }]}>Frete Grátis</Text>
                              </View>
                            )}
                            {temNovo && !temUsado && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(255, 230, 0, 0.35)', backgroundColor: 'rgba(255, 230, 0, 0.08)' }]}>
                                <Text style={[styles.locationChipText, { color: '#FFE600', fontWeight: '700' }]}>Novo</Text>
                              </View>
                            )}
                            {temUsado && !temNovo && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(148, 163, 184, 0.35)', backgroundColor: 'rgba(148, 163, 184, 0.08)' }]}>
                                <Text style={[styles.locationChipText, { color: '#94A3B8', fontWeight: '700' }]}>Usado</Text>
                              </View>
                            )}
                          </>
                        );
                      })()}
                      {plataforma === 'AMAZON' && (() => {
                        const palavrasStr = (m.palavras || '').toLowerCase();
                        const temFrete = palavrasStr.includes('amz_frete_gratis:true');
                        const temAval = palavrasStr.includes('amz_melhor_avaliacao:true');
                        const temNac = palavrasStr.includes('amz_nacional:true');
                        const temInter = palavrasStr.includes('amz_internacional:true');
                        const temNovo = palavrasStr.includes('amz_novo:true');
                        const temUsado = palavrasStr.includes('amz_usado:true');

                        return (
                          <>
                            {temFrete && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(255, 153, 0, 0.35)', backgroundColor: 'rgba(255, 153, 0, 0.08)' }]}>
                                <Ionicons name="car-outline" size={10} color="#FF9900" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#FF9900', fontWeight: '700' }]}>Frete Grátis</Text>
                              </View>
                            )}
                            {temAval && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(255, 187, 0, 0.35)', backgroundColor: 'rgba(255, 187, 0, 0.08)' }]}>
                                <Ionicons name="star" size={10} color="#FFBB00" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#FFBB00', fontWeight: '700' }]}>Melhor Avaliação</Text>
                              </View>
                            )}
                            {temNac && !temInter && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                                <Ionicons name="flag-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
                                <Text style={[styles.locationChipText, { color: '#10B981', fontWeight: '700' }]}>Nacional</Text>
                              </View>
                            )}
                            {temInter && !temNac && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                                <Ionicons name="globe-outline" size={10} color="#3B82F6" style={{ marginRight: 3 }} />
                                <Text style={[styles.locationChipText, { color: '#3B82F6', fontWeight: '700' }]}>Internacional</Text>
                              </View>
                            )}
                            {temNovo && !temUsado && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(255, 230, 0, 0.35)', backgroundColor: 'rgba(255, 230, 0, 0.08)' }]}>
                                <Text style={[styles.locationChipText, { color: '#FFE600', fontWeight: '700' }]}>Novo</Text>
                              </View>
                            )}
                            {temUsado && !temNovo && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(148, 163, 184, 0.35)', backgroundColor: 'rgba(148, 163, 184, 0.08)' }]}>
                                <Text style={[styles.locationChipText, { color: '#94A3B8', fontWeight: '700' }]}>Usado</Text>
                              </View>
                            )}
                          </>
                        );
                      })()}
                      {plataforma === 'MAGALU' && (() => {
                        const palavrasStr = (m.palavras || '').toLowerCase();
                        const temFull = palavrasStr.includes('magalu_entrega_rapida:true') || palavrasStr.includes('magalu_full:true');
                        const temFrete = palavrasStr.includes('magalu_frete_gratis:true');
                        const temAval = palavrasStr.includes('magalu_melhor_avaliacao:true');
                        const temNac = palavrasStr.includes('magalu_nacional:true');
                        const temInter = palavrasStr.includes('magalu_internacional:true');

                        return (
                          <>
                            {temFull && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(0, 134, 255, 0.45)', backgroundColor: 'rgba(0, 134, 255, 0.12)' }]}>
                                <Ionicons name="flash" size={10} color="#0086FF" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#0086FF', fontWeight: '800' }]}>Full</Text>
                              </View>
                            )}
                            {temFrete && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                                <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#10B981', fontWeight: '700' }]}>Frete Grátis</Text>
                              </View>
                            )}
                            {temAval && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(255, 187, 0, 0.35)', backgroundColor: 'rgba(255, 187, 0, 0.08)' }]}>
                                <Ionicons name="star" size={10} color="#FFBB00" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#FFBB00', fontWeight: '700' }]}>Melhor Avaliação</Text>
                              </View>
                            )}
                            {temNac && !temInter && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                                <Ionicons name="flag-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
                                <Text style={[styles.locationChipText, { color: '#10B981', fontWeight: '700' }]}>Nacional</Text>
                              </View>
                            )}
                            {temInter && !temNac && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                                <Ionicons name="globe-outline" size={10} color="#3B82F6" style={{ marginRight: 3 }} />
                                <Text style={[styles.locationChipText, { color: '#3B82F6', fontWeight: '700' }]}>Internacional</Text>
                              </View>
                            )}
                          </>
                        );
                      })()}
                      {plataforma === 'KABUM' && (() => {
                        const palavrasStr = (m.palavras || '').toLowerCase();
                        const temFrete = palavrasStr.includes('kabum_frete_gratis:true');
                        const temAval = palavrasStr.includes('kabum_melhor_avaliacao:true');

                        return (
                          <>
                            {temFrete && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                                <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#10B981', fontWeight: '700' }]}>Frete Grátis</Text>
                              </View>
                            )}
                            {temAval && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(255, 187, 0, 0.35)', backgroundColor: 'rgba(255, 187, 0, 0.08)' }]}>
                                <Ionicons name="star" size={10} color="#FFBB00" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#FFBB00', fontWeight: '700' }]}>Melhor Avaliação</Text>
                              </View>
                            )}
                          </>
                        );
                      })()}
                      {plataforma === 'AMERICANAS' && (() => {
                        const palavrasStr = (m.palavras || '').toLowerCase();
                        const temRapida = palavrasStr.includes('ame_entrega_rapida:true') || palavrasStr.includes('americanas_entrega_rapida:true') || palavrasStr.includes('ame_full:true');
                        const temFrete = palavrasStr.includes('ame_frete_gratis:true') || palavrasStr.includes('americanas_frete_gratis:true');
                        const temAval = palavrasStr.includes('ame_melhor_avaliacao:true') || palavrasStr.includes('americanas_melhor_avaliacao:true');

                        return (
                          <>
                            {temRapida && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(230, 0, 20, 0.45)', backgroundColor: 'rgba(230, 0, 20, 0.12)' }]}>
                                <Ionicons name="flash" size={10} color="#E60014" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#E60014', fontWeight: '800' }]}>Entrega Rápida</Text>
                              </View>
                            )}
                            {temFrete && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                                <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#10B981', fontWeight: '700' }]}>Frete Grátis</Text>
                              </View>
                            )}
                            {temAval && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(255, 187, 0, 0.35)', backgroundColor: 'rgba(255, 187, 0, 0.08)' }]}>
                                <Ionicons name="star" size={10} color="#FFBB00" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#FFBB00', fontWeight: '700' }]}>Melhor Avaliação</Text>
                              </View>
                            )}
                          </>
                        );
                      })()}
                      {plataforma === 'SHEIN' && (() => {
                        const palavrasStr = (m.palavras || '').toLowerCase();
                        const temNac = palavrasStr.includes('shein_nacional:true');
                        const temInter = palavrasStr.includes('shein_internacional:true');
                        const temMaisVendidos = palavrasStr.includes('shein_mais_vendidos:true');
                        const temAval = palavrasStr.includes('shein_melhor_avaliacao:true');

                        return (
                          <>
                            {temNac && !temInter && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                                <Ionicons name="flag-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
                                <Text style={[styles.locationChipText, { color: '#10B981', fontWeight: '700' }]}>Nacional</Text>
                              </View>
                            )}
                            {temInter && !temNac && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(59, 130, 246, 0.08)' }]}>
                                <Ionicons name="globe-outline" size={10} color="#3B82F6" style={{ marginRight: 3 }} />
                                <Text style={[styles.locationChipText, { color: '#3B82F6', fontWeight: '700' }]}>Internacional</Text>
                              </View>
                            )}
                            {temMaisVendidos && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(245, 158, 11, 0.45)', backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                                <Ionicons name="flame" size={10} color="#F59E0B" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#F59E0B', fontWeight: '800' }]}>Mais Vendidos</Text>
                              </View>
                            )}
                            {temAval && (
                              <View style={[styles.locationChip, { borderColor: 'rgba(255, 187, 0, 0.35)', backgroundColor: 'rgba(255, 187, 0, 0.08)' }]}>
                                <Ionicons name="star" size={10} color="#FFBB00" style={{ marginRight: 2 }} />
                                <Text style={[styles.locationChipText, { color: '#FFBB00', fontWeight: '700' }]}>Melhor Avaliação</Text>
                              </View>
                            )}
                          </>
                        );
                      })()}
                    </View>
                  </View>
                  <Switch 
                    value={m.ativo}
                    onValueChange={() => alternarStatus(m.id, m.ativo)}
                    trackColor={{ false: '#1E2333', true: THEME.primary }}
                    thumbColor="#FFF"
                  />
                </View>

                {/* TERMO DE BUSCA EM DESTAQUE */}
                <View style={styles.radarSearchTermBox}>
                  <Ionicons name="search" size={13} color={THEME.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.radarSearchTermText} numberOfLines={1}>
                    {m.produto || m.palavras || 'Termo não especificado'}
                  </Text>
                </View>

                {/* RODAPÉ DO RADAR */}
                <View style={styles.radarCardFooter}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radarFrequencyLabel}>
                      Varredura a cada {m.intervalo_valor} min
                    </Text>
                    <View style={styles.radarCountdownRow}>
                      <Ionicons name="time-outline" size={12} color={m.ativo ? THEME.primary : THEME.textSubtle} style={{ marginRight: 4 }} />
                      <Text style={[styles.radarCountdownText, !m.ativo && { color: THEME.textSubtle }]}>
                        {!m.ativo ? 'Pausado' : formatarTempoRegressivo(m.proxima_execucao, now)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.radarActionsGroup}>
                    {(() => {
                      const estaVarrendo = testandoId === m.id || varrendoMonitorId === m.id;
                      const antiSpamRestante = (tier !== TIERS.ADMIN && antiSpamCooldowns && antiSpamCooldowns[m.id]) 
                        ? Math.max(0, Math.ceil((antiSpamCooldowns[m.id] - now) / 1000)) 
                        : 0;
                      const emCooldownAntiSpam = tier !== TIERS.ADMIN && antiSpamRestante > 0;
                      const emCooldownFree = tier === TIERS.FREE && sweepCooldownSeconds > 0;

                      return (
                        <TouchableOpacity 
                          style={[
                            styles.btnScanNow, 
                            (!m.ativo || estaVarrendo) && { opacity: 0.7 },
                            (emCooldownAntiSpam || emCooldownFree) && { 
                              backgroundColor: 'rgba(255, 255, 255, 0.08)', 
                              borderWidth: 1, 
                              borderColor: 'rgba(255, 255, 255, 0.12)' 
                            }
                          ]}
                          onPress={() => {
                            if (tier !== TIERS.ADMIN && emCooldownAntiSpam) {
                              showAlert({
                                title: "Proteção Anti-Spam",
                                message: `Aguarde mais ${antiSpamRestante}s para varrer este mesmo radar novamente e evitar sobrecarga do servidor.`,
                                type: "warning",
                                icon: "time-outline"
                              });
                              return;
                            }
                            handleDispararVarrer(m.id);
                          }}
                          disabled={!m.ativo || estaVarrendo || (tier !== TIERS.ADMIN && (emCooldownAntiSpam || emCooldownFree))}
                          activeOpacity={0.8}
                        >
                          {estaVarrendo ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <ActivityIndicator size="small" color="#08090D" style={{ marginRight: 5 }} />
                              <Text style={styles.btnScanNowText}>Varrendo...</Text>
                            </View>
                          ) : emCooldownAntiSpam ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="time-outline" size={12} color={THEME.textMuted} style={{ marginRight: 4 }} />
                              <Text style={[styles.btnScanNowText, { color: THEME.textMuted, fontSize: 11 }]}>
                                {antiSpamRestante}s
                              </Text>
                            </View>
                          ) : emCooldownFree ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="lock-closed" size={11} color={THEME.warning} style={{ marginRight: 4 }} />
                              <Text style={[styles.btnScanNowText, { color: THEME.warning, fontSize: 11 }]}>
                                {formatarCooldown(sweepCooldownSeconds)}
                              </Text>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="radio-outline" size={13} color="#08090D" style={{ marginRight: 4 }} />
                              <Text style={styles.btnScanNowText}>Varrer</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })()}

                    <IconButton 
                      icon="create-outline" 
                      onPress={() => navigation.navigate('Criar', { monitor: m })} 
                      size={34}
                      iconSize={15}
                      style={{ marginLeft: 6 }}
                    />
                    <IconButton 
                      icon="trash-outline" 
                      onPress={() => removerRadar(m.id, m.nome)} 
                      color={THEME.danger}
                      size={34}
                      iconSize={15}
                      style={{ marginLeft: 6 }}
                    />
                  </View>
                </View>
              </Surface>
            );
          })
        )}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* BOTÃO FLUTUANTE ADICIONAR */}
      <TouchableOpacity 
        style={styles.fabGlow}
        onPress={handleCriarRadarPress}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#08090D" />
      </TouchableOpacity>
    </View>
  );
}


// --- TELA 3: ALERTAS / OPORTUNIDADES CAPTURADAS ---
function AlertsScreen({ navigation }) {
  const { 
    resultados, loading, refreshing, onRefresh, fetchData,
    tier, handleOpenAd, openUpgradeModal, showAlert 
  } = useContext(RadarContext);
  const [filtroPlataforma, setFiltroPlataforma] = useState('TODAS');
  const [buscaTexto, setBuscaTexto] = useState('');

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { fetchData(null, true); });
    return unsub;
  }, [navigation, fetchData]);

  const resultadosFiltrados = useMemo(() => {
    return resultados.filter(res => {
      const plat = identificarPlataforma(res.url);
      if (filtroPlataforma !== 'TODAS' && plat !== filtroPlataforma) return false;
      if (buscaTexto.trim()) {
        const query = buscaTexto.toLowerCase();
        const matchTitle = (res.title || '').toLowerCase().includes(query);
        const matchPrice = String(res.price || '').includes(query);
        if (!matchTitle && !matchPrice) return false;
      }
      return true;
    });
  }, [resultados, filtroPlataforma, buscaTexto]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />

      {/* TOP HEADER */}
      <View style={styles.screenHeader}>
        <View>
          <View style={styles.row}>
            <Text style={styles.screenHeaderTitle}>Oportunidades</Text>
            {tier === TIERS.FREE && (
              <View style={{ marginLeft: 8 }}>
                <LockBadge text="PROTEGIDO" onPress={openUpgradeModal} />
              </View>
            )}
          </View>
          <Text style={styles.screenHeaderSub}>
            {resultados.length} anúncios e ofertas detectados
          </Text>
        </View>
      </View>

      {/* BARRA DE PESQUISA */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={16} color={THEME.textSubtle} style={{ marginRight: 8 }} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Pesquisar por produto ou valor..."
            placeholderTextColor={THEME.textSubtle}
            value={buscaTexto}
            onChangeText={setBuscaTexto}
          />
          {buscaTexto.length > 0 && (
            <TouchableOpacity onPress={() => setBuscaTexto('')}>
              <Ionicons name="close-circle" size={16} color={THEME.textSubtle} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CHIPS DE FILTRO POR PLATAFORMA */}
      <View style={styles.filterChipRow}>
        {['TODAS', 'OLX', 'FACEBOOK', 'MERCADO_LIVRE', 'SHOPEE', 'AMAZON', 'MAGALU', 'KABUM', 'AMERICANAS', 'SHEIN', 'ZOOM', 'OUTROS'].map(k => {
          const isSelected = filtroPlataforma === k;
          const label = k === 'TODAS' ? 'Todas' : k === 'OUTROS' ? 'Web' : k === 'FACEBOOK' ? 'Facebook' : k === 'MERCADO_LIVRE' ? 'Mercado Livre' : k === 'SHOPEE' ? 'Shopee' : k === 'AMAZON' ? 'Amazon' : k === 'MAGALU' ? 'Magalu' : k === 'KABUM' ? 'KaBuM!' : k === 'AMERICANAS' ? 'Americanas' : k === 'SHEIN' ? 'SHEIN' : k === 'ZOOM' ? 'Zoom' : 'OLX';
          return (
            <TouchableOpacity 
              key={k}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => setFiltroPlataforma(k)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ÁREA DE LISTAGEM COM OVERLAY FROSTED GLASS PARA USUÁRIOS FREE */}
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView 
          contentContainerStyle={[styles.scrollArea, { paddingBottom: 90 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={tier !== TIERS.FREE}
        >
          <View style={styles.alertsTargetContainer}>
            {loading && resultados.length === 0 ? (
              <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
            ) : resultadosFiltrados.length === 0 ? (
              <View style={styles.emptyFullState}>
                <View style={styles.emptyIconPulseCircle}>
                  <Ionicons name="notifications-off-outline" size={38} color={THEME.textSubtle} />
                </View>
                <Text style={styles.emptyStateTitle}>
                  {buscaTexto.length > 0 ? 'Nenhum resultado encontrado' : 'Nenhuma oportunidade no momento'}
                </Text>
                <Text style={styles.emptyStateSub}>
                  {buscaTexto.length > 0 
                    ? 'Tente ajustar os termos de pesquisa ou remover os filtros de plataforma.' 
                    : 'Quando o robô detectar um anúncio dentro das suas configurações, ele aparecerá aqui imediatamente.'}
                </Text>
              </View>
            ) : (
              resultadosFiltrados.map(res => {
                const plat = identificarPlataforma(res.url);
                const shopeeInfo = plat === 'SHOPEE' 
                  ? parseShopeeInfo(res.title, res.url) 
                  : { cleanTitle: res.title, origem: null, desconto: null, score: null, vendidos: null };
                const mlInfo = plat === 'MERCADO_LIVRE'
                  ? parseMLInfo(res.title, res.url)
                  : null;
                const amzInfo = plat === 'AMAZON'
                  ? parseAmazonInfo(res.title, res.url)
                  : null;
                const magaluInfo = plat === 'MAGALU'
                  ? parseMagaluInfo(res.title, res.url)
                  : null;
                const kabumInfo = plat === 'KABUM'
                  ? parseKabumInfo(res.title, res.url)
                  : null;
                const ameInfo = plat === 'AMERICANAS'
                  ? parseAmericanasInfo(res.title, res.url)
                  : null;
                const sheinInfo = plat === 'SHEIN'
                  ? parseSheinInfo(res.title, res.url)
                  : null;
                const displayTitle = plat === 'SHOPEE' 
                  ? shopeeInfo.cleanTitle 
                  : plat === 'MERCADO_LIVRE' && mlInfo 
                  ? mlInfo.cleanTitle 
                  : plat === 'AMAZON' && amzInfo
                  ? amzInfo.cleanTitle
                  : plat === 'MAGALU' && magaluInfo
                  ? magaluInfo.cleanTitle
                  : plat === 'KABUM' && kabumInfo
                  ? kabumInfo.cleanTitle
                  : plat === 'AMERICANAS' && ameInfo
                  ? ameInfo.cleanTitle
                  : plat === 'SHEIN' && sheinInfo
                  ? sheinInfo.cleanTitle
                  : res.title;

                return (
                  <Surface key={res.id} style={styles.alertCardFull} elevated>
                    <View style={styles.alertHeaderRow}>
                      <View style={styles.alertHeaderTagsWrap}>
                        <PlatformBadge platformKey={plat} />
                        {plat === 'SHOPEE' && shopeeInfo.origem && (
                          <ShopeeOriginBadge origem={shopeeInfo.origem} />
                        )}
                        {plat === 'SHOPEE' && shopeeInfo.desconto && (
                          <ShopeeDiscountBadge discount={shopeeInfo.desconto} />
                        )}
                        {plat === 'SHOPEE' && (shopeeInfo.score || shopeeInfo.vendidos) && (
                          <ShopeeRatingBadge score={shopeeInfo.score} vendidos={shopeeInfo.vendidos} />
                        )}
                        {plat === 'MERCADO_LIVRE' && mlInfo && mlInfo.isFull && (
                          <MLFullBadge />
                        )}
                        {plat === 'MERCADO_LIVRE' && mlInfo && mlInfo.isFreteGratis && (
                          <MLFreeShippingBadge />
                        )}
                        {plat === 'MERCADO_LIVRE' && mlInfo && mlInfo.desconto && (
                          <MLDiscountBadge discount={mlInfo.desconto} />
                        )}
                        {plat === 'AMAZON' && amzInfo && amzInfo.origem && (
                          <ShopeeOriginBadge origem={amzInfo.origem} />
                        )}
                        {plat === 'AMAZON' && amzInfo && amzInfo.isPrime && (
                          <AmazonPrimeBadge />
                        )}
                        {plat === 'AMAZON' && amzInfo && amzInfo.isFreteGratis && !amzInfo.isPrime && (
                          <AmazonFreeShippingBadge />
                        )}
                        {plat === 'AMAZON' && amzInfo && amzInfo.desconto && (
                          <AmazonDiscountBadge discount={amzInfo.desconto} />
                        )}
                        {plat === 'AMAZON' && amzInfo && amzInfo.score && (
                          <ShopeeRatingBadge score={amzInfo.score} />
                        )}
                        {plat === 'MAGALU' && magaluInfo && magaluInfo.origem && (
                          <ShopeeOriginBadge origem={magaluInfo.origem} />
                        )}
                        {plat === 'MAGALU' && magaluInfo && magaluInfo.isFull && (
                          <MagaluFullBadge />
                        )}
                        {plat === 'MAGALU' && magaluInfo && magaluInfo.isFreteGratis && (
                          <MagaluFreeShippingBadge />
                        )}
                        {plat === 'MAGALU' && magaluInfo && magaluInfo.desconto && (
                          <MagaluDiscountBadge discount={magaluInfo.desconto} />
                        )}
                        {plat === 'MAGALU' && magaluInfo && magaluInfo.score && (
                          <ShopeeRatingBadge score={magaluInfo.score} />
                        )}
                        {plat === 'KABUM' && kabumInfo && kabumInfo.isFreteGratis && (
                          <KabumFreeShippingBadge />
                        )}
                        {plat === 'KABUM' && kabumInfo && kabumInfo.desconto && (
                          <KabumDiscountBadge discount={kabumInfo.desconto} />
                        )}
                        {plat === 'KABUM' && kabumInfo && kabumInfo.score && (
                          <ShopeeRatingBadge score={kabumInfo.score} />
                        )}
                        {plat === 'AMERICANAS' && ameInfo && ameInfo.isEntregaRapida && (
                          <AmericanasFastDeliveryBadge />
                        )}
                        {plat === 'AMERICANAS' && ameInfo && ameInfo.isFreteGratis && (
                          <AmericanasFreeShippingBadge />
                        )}
                        {plat === 'AMERICANAS' && ameInfo && ameInfo.desconto && (
                          <AmericanasDiscountBadge discount={ameInfo.desconto} />
                        )}
                        {plat === 'AMERICANAS' && ameInfo && ameInfo.score && (
                          <ShopeeRatingBadge score={ameInfo.score} />
                        )}
                        {plat === 'SHEIN' && sheinInfo && sheinInfo.origem && (
                          <ShopeeOriginBadge origem={sheinInfo.origem} />
                        )}
                        {plat === 'SHEIN' && sheinInfo && sheinInfo.isMaisVendidos && (
                          <SheinBestSellerBadge />
                        )}
                        {plat === 'SHEIN' && sheinInfo && sheinInfo.desconto && (
                          <SheinDiscountBadge discount={sheinInfo.desconto} />
                        )}
                        {plat === 'SHEIN' && sheinInfo && sheinInfo.score && (
                          <ShopeeRatingBadge score={sheinInfo.score} />
                        )}
                        <View style={styles.robotTag}>
                          <Ionicons name="checkmark-circle" size={13} color={THEME.success} style={{ marginRight: 4 }} />
                          <Text style={styles.robotTagText}>Capturado pelo Robô</Text>
                        </View>
                      </View>
                      <Text style={[styles.alertTime, tier === TIERS.FREE && styles.blurredTime]}>
                        {new Date(res.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>

                    <Text 
                      style={[styles.alertTitleFull, tier === TIERS.FREE && styles.blurredTextTitle]}
                      numberOfLines={2}
                    >
                      {displayTitle}
                    </Text>

                    <View style={styles.alertPriceRow}>
                      <View>
                        <Text style={styles.alertPriceLabel}>VALOR CAPTURADO</Text>
                        {res.price !== null && Number(res.price) > 0 ? (
                          <Text style={[styles.alertPriceValue, tier === TIERS.FREE && styles.blurredPrice]}>
                            R$ {Number(res.price).toFixed(2)}
                          </Text>
                        ) : (
                          <Text style={[styles.priceConsult, tier === TIERS.FREE && styles.blurredPrice]}>Sob Consulta</Text>
                        )}
                      </View>
                      
                      <TouchableOpacity 
                        style={[styles.btnAlertAction, tier === TIERS.FREE && styles.btnAlertActionLocked]}
                        onPress={() => {
                          if (tier === TIERS.FREE) {
                            openUpgradeModal();
                          } else {
                            if (res.url) {
                              Linking.openURL(formatarUrlAfiliado(res.url)).catch(() => showAlert({
                                title: "Erro",
                                message: "Não foi possível abrir o link da oferta.",
                                type: "error"
                              }));
                            }
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.btnAlertActionText, tier === TIERS.FREE && styles.btnAlertActionLockedText]}>
                          {tier === TIERS.FREE ? 'Exclusivo Premium' : 'Acessar Oferta'}
                        </Text>
                        <Ionicons 
                          name={tier === TIERS.FREE ? "lock-closed" : "open-outline"} 
                          size={13} 
                          color={tier === TIERS.FREE ? THEME.textMuted : "#08090D"} 
                          style={{ marginLeft: 5 }} 
                        />
                      </TouchableOpacity>
                    </View>
                  </Surface>
                );
              })
            )}
          </View>
          <View style={{ height: 80 }} />
        </ScrollView>

        {/* OVERLAY DESFOCADO COM FROSTED GLASS E CADEADO CENTRAL SE FOR FREE */}
        {tier === TIERS.FREE && (
          <FrostedOverlay style={[StyleSheet.absoluteFill, styles.alertsFrostedOverlay]}>
            <View style={styles.alertsLockCard}>
              <View style={styles.alertsLockIconCircle}>
                <Ionicons name="lock-closed" size={30} color="#FFF" />
              </View>
              <Text style={styles.alertsLockTitle}>Feed de Ofertas Protegido</Text>
              <Text style={styles.alertsLockSub}>
                O robô capturou <Text style={{ color: THEME.primary, fontWeight: '800' }}>{resultados.length} oportunidades</Text> para você!
                {'\n\n'}
                Para visualizar todas as ofertas sem desfoque e clicar para ser redirecionado diretamente à página de compra, ative o AchôAI Premium.
              </Text>

              <TouchableOpacity 
                style={styles.btnAlertsUnlock}
                onPress={openUpgradeModal}
                activeOpacity={0.85}
              >
                <Ionicons name="diamond" size={16} color="#08090D" style={{ marginRight: 8 }} />
                <Text style={styles.btnAlertsUnlockText}>Desbloquear Todas as Ofertas</Text>
              </TouchableOpacity>
            </View>
          </FrostedOverlay>
        )}
      </View>
    </View>
  );
}


// --- TELA 4: MODAL DE CRIAÇÃO / EDIÇÃO DE RADAR ---
function CreateMonitorScreen({ navigation, route }) {
  const { 
    currentOwnerId, pushToken, setPushToken, deviceId, user, fetchData, 
    notificacoesAtivas, alternarNotificacoes,
    tier, openUpgradeModal, monitores, showAlert 
  } = useContext(RadarContext);
  const editando = route?.params?.monitor;

  const platInicial = editando ? identificarPlataforma(editando.urls) : 'OLX';
  const [plataforma, setPlataforma] = useState(platInicial);

  const infoOlx = editando && platInicial === 'OLX' ? extrairInfoOlx(editando.urls) : { uf: 'BR', regiaoSlug: '' };
  const [estadoUf, setEstadoUf] = useState(infoOlx.uf);
  const [regiaoSlug, setRegiaoSlug] = useState(infoOlx.regiaoSlug);

  // Carrega última localização de estado e região salva em cache para novos radares
  useEffect(() => {
    if (!editando) {
      AsyncStorage.getItem('@achoai_last_olx_location').then(cached => {
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.uf && OLX_ESTADOS[parsed.uf]) {
              setEstadoUf(parsed.uf);
              setRegiaoSlug(parsed.regiaoSlug || '');
            }
          } catch (e) {}
        }
      });
    }
  }, [editando]);

  const [cidadeFacebook, setCidadeFacebook] = useState(
    editando && platInicial === 'FACEBOOK' ? extrairCidadeFacebook(editando.urls) : 'fortaleza'
  );
  const [modalEstadoVisivel, setModalEstadoVisivel] = useState(false);
  const [modalRegiaoVisivel, setModalRegiaoVisivel] = useState(false);
  const [modalAvisoNotifVisivel, setModalAvisoNotifVisivel] = useState(false);
  const [ativandoNotif, setAtivandoNotif] = useState(false);

  const [modo, setModo] = useState(editando?.modo === 'noticia' ? 'noticia' : 'produto');
  const estratInicial = editando 
    ? ((platInicial === 'MERCADO_LIVRE' || platInicial === 'SHOPEE' || platInicial === 'AMAZON' || platInicial === 'MAGALU' || platInicial === 'KABUM' || platInicial === 'AMERICANAS' || platInicial === 'SHEIN') && identificarEstrategia(editando) === 'mais_recentes' 
        ? 'maior_desconto' 
        : identificarEstrategia(editando)) 
    : 'menor_preco';
  const [estrategia, setEstrategia] = useState(estratInicial);
  const [ordenarMenorPreco, setOrdenarMenorPreco] = useState(
    editando?.palavras ? editando.palavras.includes('ordenar_menor_preco') : false
  );

  // Procedência e filtros de produtos na Shopee
  const isShopeeEdit = editando && platInicial === 'SHOPEE';
  const palavrasEdit = (editando?.palavras || '').toLowerCase();
  const urlsEdit = (editando?.urls || '').toLowerCase();

  const initNacional = isShopeeEdit
    ? (palavrasEdit.includes('shopee_origem:internacional') ? false : true)
    : true;
  const initInternacional = isShopeeEdit
    ? (palavrasEdit.includes('shopee_origem:nacional') || urlsEdit.includes('locations=-1') ? false : true)
    : true;

  const [shopeeNacional, setShopeeNacional] = useState(initNacional);
  const [shopeeInternacional, setShopeeInternacional] = useState(initInternacional);
  const [shopeeMelhorAvaliacao, setShopeeMelhorAvaliacao] = useState(
    isShopeeEdit ? (palavrasEdit.includes('shopee_melhor_avaliacao:true') || urlsEdit.includes('sortby=sales')) : false
  );

  // Filtros personalizáveis do Mercado Livre (todos desmarcados por padrão)
  const isMLEdit = editando && platInicial === 'MERCADO_LIVRE';
  const [mlFreteGratis, setMlFreteGratis] = useState(
    isMLEdit ? (palavrasEdit.includes('ml_frete_gratis:true') || urlsEdit.includes('_custofrete_gratis')) : false
  );
  const [mlFull, setMlFull] = useState(
    isMLEdit ? (palavrasEdit.includes('ml_full:true') || urlsEdit.includes('_frete_full')) : false
  );
  const [mlNacional, setMlNacional] = useState(
    isMLEdit ? (palavrasEdit.includes('ml_nacional:true') || urlsEdit.includes('shipping*origin_10215068')) : false
  );
  const [mlInternacional, setMlInternacional] = useState(
    isMLEdit ? (palavrasEdit.includes('ml_internacional:true') || urlsEdit.includes('shipping*origin_10215069')) : false
  );
  const [mlNovo, setMlNovo] = useState(
    isMLEdit ? (palavrasEdit.includes('ml_novo:true') || urlsEdit.includes('/novo/')) : false
  );
  const [mlUsado, setMlUsado] = useState(
    isMLEdit ? (palavrasEdit.includes('ml_usado:true') || urlsEdit.includes('/usado/')) : false
  );

  // Filtros personalizáveis da Amazon (todos desmarcados por padrão)
  const isAmzEdit = editando && platInicial === 'AMAZON';
  const [amzFreteGratis, setAmzFreteGratis] = useState(
    isAmzEdit ? (palavrasEdit.includes('amz_frete_gratis:true') || urlsEdit.includes('p_n_free_shipping_eligible')) : false
  );
  const [amzMelhorAvaliacao, setAmzMelhorAvaliacao] = useState(
    isAmzEdit ? (palavrasEdit.includes('amz_melhor_avaliacao:true') || urlsEdit.includes('s=review-rank')) : false
  );
  const [amzNacional, setAmzNacional] = useState(
    isAmzEdit ? palavrasEdit.includes('amz_nacional:true') : false
  );
  const [amzInternacional, setAmzInternacional] = useState(
    isAmzEdit ? palavrasEdit.includes('amz_internacional:true') : false
  );
  const [amzNovo, setAmzNovo] = useState(
    isAmzEdit ? palavrasEdit.includes('amz_novo:true') : false
  );
  const [amzUsado, setAmzUsado] = useState(
    isAmzEdit ? palavrasEdit.includes('amz_usado:true') : false
  );

  // Filtros personalizáveis da Magalu (todos desmarcados por padrão)
  const isMagaluEdit = editando && platInicial === 'MAGALU';
  const [magaluFreteGratis, setMagaluFreteGratis] = useState(
    isMagaluEdit ? palavrasEdit.includes('magalu_frete_gratis:true') : false
  );
  const [magaluEntregaRapida, setMagaluEntregaRapida] = useState(
    isMagaluEdit ? (palavrasEdit.includes('magalu_entrega_rapida:true') || palavrasEdit.includes('magalu_full:true')) : false
  );
  const [magaluMelhorAvaliacao, setMagaluMelhorAvaliacao] = useState(
    isMagaluEdit ? palavrasEdit.includes('magalu_melhor_avaliacao:true') : false
  );
  const [magaluNacional, setMagaluNacional] = useState(
    isMagaluEdit ? palavrasEdit.includes('magalu_nacional:true') : false
  );
  const [magaluInternacional, setMagaluInternacional] = useState(
    isMagaluEdit ? palavrasEdit.includes('magalu_internacional:true') : false
  );

  // Filtros personalizáveis da KaBuM! (todos desmarcados por padrão)
  const isKabumEdit = editando && platInicial === 'KABUM';
  const [kabumFreteGratis, setKabumFreteGratis] = useState(
    isKabumEdit ? palavrasEdit.includes('kabum_frete_gratis:true') : false
  );
  const [kabumMelhorAvaliacao, setKabumMelhorAvaliacao] = useState(
    isKabumEdit ? palavrasEdit.includes('kabum_melhor_avaliacao:true') : false
  );

  // Filtros personalizáveis da Americanas (todos desmarcados por padrão)
  const isAmeEdit = editando && platInicial === 'AMERICANAS';
  const [ameEntregaRapida, setAmeEntregaRapida] = useState(
    isAmeEdit ? (palavrasEdit.includes('ame_entrega_rapida:true') || palavrasEdit.includes('americanas_entrega_rapida:true') || palavrasEdit.includes('ame_full:true')) : false
  );
  const [ameFreteGratis, setAmeFreteGratis] = useState(
    isAmeEdit ? (palavrasEdit.includes('ame_frete_gratis:true') || palavrasEdit.includes('americanas_frete_gratis:true')) : false
  );
  const [ameMelhorAvaliacao, setAmeMelhorAvaliacao] = useState(
    isAmeEdit ? (palavrasEdit.includes('ame_melhor_avaliacao:true') || palavrasEdit.includes('americanas_melhor_avaliacao:true')) : false
  );

  // Filtros personalizáveis da SHEIN
  const isSheinEdit = editando && platInicial === 'SHEIN';
  const initSheinNacional = isSheinEdit
    ? (palavrasEdit.includes('shein_nacional:true') || (!palavrasEdit.includes('shein_internacional:true')))
    : true;
  const initSheinInternacional = isSheinEdit
    ? (palavrasEdit.includes('shein_internacional:true') || (!palavrasEdit.includes('shein_nacional:true')))
    : true;

  const [sheinNacional, setSheinNacional] = useState(initSheinNacional);
  const [sheinInternacional, setSheinInternacional] = useState(initSheinInternacional);
  const [sheinMaisVendidos, setSheinMaisVendidos] = useState(
    isSheinEdit ? palavrasEdit.includes('shein_mais_vendidos:true') : false
  );
  const [sheinMelhorAvaliacao, setSheinMelhorAvaliacao] = useState(
    isSheinEdit ? palavrasEdit.includes('shein_melhor_avaliacao:true') : false
  );

  const [apenasMaiorDesconto, setApenasMaiorDesconto] = useState(
    isMLEdit ? palavrasEdit.includes('ml_apenas_maior_desconto:true') : (isShopeeEdit ? (palavrasEdit.includes('shopee_apenas_maior_desconto:true') || palavrasEdit.includes('ml_apenas_maior_desconto:true')) : (isAmzEdit ? palavrasEdit.includes('amz_apenas_maior_desconto:true') : (isMagaluEdit ? palavrasEdit.includes('magalu_apenas_maior_desconto:true') : (isKabumEdit ? palavrasEdit.includes('kabum_apenas_maior_desconto:true') : (isAmeEdit ? (palavrasEdit.includes('ame_apenas_maior_desconto:true') || palavrasEdit.includes('americanas_apenas_maior_desconto:true')) : (isSheinEdit ? palavrasEdit.includes('shein_apenas_maior_desconto:true') : false))))))
  );

  const [nome, setNome] = useState(editando?.nome || '');
  const [produto, setProduto] = useState(editando?.produto || '');
  const [urls, setUrls] = useState(editando?.urls || '');
  const [precoAlvo, setPrecoAlvo] = useState(editando?.preco_alvo ? String(editando.preco_alvo) : '');
  const [margem, setMargem] = useState(String(editando?.margem || '15'));
  const [palavras, setPalavras] = useState(editando?.modo === 'noticia' ? (editando?.palavras || '') : '');
  const [intervalo, setIntervalo] = useState(
    tier === TIERS.FREE ? '180' : String(editando?.intervalo_valor || '30')
  );
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: editando ? 'Editar Radar de Varredura' : 'Novo Radar de Varredura'
    });
  }, [navigation, editando]);

  const regioesDoEstado = (OLX_ESTADOS[estadoUf]?.regioes) || [{ nome: 'Todo o Estado', slug: '' }];
  const regiaoAtual = regioesDoEstado.find(r => r.slug === regiaoSlug) || regioesDoEstado[0];

  const alvoNum = Number(precoAlvo) || 0;
  const margemNum = Number(margem) || 0;
  const minEstimado = alvoNum - (alvoNum * (margemNum / 100));
  const maxEstimado = alvoNum + (alvoNum * (margemNum / 100));

  const executarSalvamento = async () => {
    let urlFinal = '';
    if (plataforma === 'OLX') {
      urlFinal = gerarUrlOlx(estadoUf, regiaoSlug, produto);
      AsyncStorage.setItem('@achoai_last_olx_location', JSON.stringify({ uf: estadoUf, regiaoSlug })).catch(() => {});
    } else if (plataforma === 'FACEBOOK') {
      const slugCidade = normalizarSlugCidade(cidadeFacebook) || 'fortaleza';
      urlFinal = `https://www.facebook.com/marketplace/${slugCidade}/search/?query=${encodeURIComponent(produto.trim())}`;
    } else if (plataforma === 'ZOOM') {
      urlFinal = `https://www.zoom.com.br/search?q=${encodeURIComponent(produto.trim())}`;
    } else if (plataforma === 'SHOPEE') {
      let sortParam = (shopeeMelhorAvaliacao || estrategia === 'maior_desconto') ? 'sales' : (estrategia === 'menor_preco' ? 'price_asc' : 'ctime');
      let shopeeQuery = `keyword=${encodeURIComponent(produto.trim())}&noCorrection=true&page=0&sortBy=${sortParam}`;
      if (shopeeNacional && !shopeeInternacional) {
        shopeeQuery += '&locations=-1';
      }
      urlFinal = `https://shopee.com.br/search?${shopeeQuery}`;
    } else if (plataforma === 'MERCADO_LIVRE') {
      let termoSlug = produto.trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!termoSlug) termoSlug = 'produtos';

      let pathPrefix = '';
      if (mlNovo && !mlUsado) {
        pathPrefix = '/novo';
      } else if (!mlNovo && mlUsado) {
        pathPrefix = '/usado';
      }

      let suffixes = '';
      if (mlFreteGratis) suffixes += '_CustoFrete_Gratis';
      if (mlFull) suffixes += '_Frete_Full';
      if (mlNacional && !mlInternacional) suffixes += '_SHIPPING*ORIGIN_10215068';
      else if (!mlNacional && mlInternacional) suffixes += '_SHIPPING*ORIGIN_10215069';

      if (estrategia === 'maior_desconto') {
        suffixes += '_Discount_5-100';
      } else if (estrategia === 'menor_preco') {
        suffixes += '_OrderId_PRICE_ASC';
      }

      urlFinal = `https://lista.mercadolivre.com.br${pathPrefix}/${termoSlug}${suffixes}`;
    } else if (plataforma === 'AMAZON') {
      urlFinal = `https://www.amazon.com.br/s?k=${encodeURIComponent(produto.trim())}`;
    } else if (plataforma === 'MAGALU') {
      let termoMagalu = produto.trim().replace(/\s+/g, '+');
      urlFinal = `https://www.magazineluiza.com.br/busca/${encodeURIComponent(termoMagalu)}/`;
      if (estrategia === 'menor_preco') {
        urlFinal += '?sortType=price&sortOrientation=asc';
      }
    } else if (plataforma === 'KABUM') {
      let termoKabum = produto.trim().replace(/\s+/g, '-').toLowerCase();
      urlFinal = `https://www.kabum.com.br/busca/${encodeURIComponent(termoKabum)}`;
      if (estrategia === 'menor_preco') {
        urlFinal += '?sort=price';
      }
    } else if (plataforma === 'AMERICANAS') {
      let termoAme = produto.trim();
      let orderParam = (estrategia === 'menor_preco') ? 'OrderByPriceASC' : (ameMelhorAvaliacao ? 'OrderByReviewRateDESC' : 'OrderByTopSaleDESC');
      urlFinal = `https://www.americanas.com.br/api/catalog_system/pub/products/search?ft=${encodeURIComponent(termoAme)}&O=${orderParam}&_from=0&_to=49`;
    } else if (plataforma === 'SHEIN') {
      let termoShein = produto.trim().replace(/\s+/g, '-');
      urlFinal = `https://br.shein.com/pdsearch/${encodeURIComponent(termoShein)}/`;
    } else {
      urlFinal = urls.trim();
    }

    let modoFinal = 'mais_recentes';
    let tagsArray = [];

    if (modo === 'noticia') {
      modoFinal = 'noticia';
      tagsArray.push(palavras.trim());
    } else {
      modoFinal = estrategia;
      if (estrategia === 'mais_recentes' && ordenarMenorPreco) {
        tagsArray.push('ordenar_menor_preco:true');
      }
      if (plataforma === 'SHOPEE') {
        if (shopeeNacional && !shopeeInternacional) {
          tagsArray.push('shopee_origem:nacional');
        } else if (!shopeeNacional && shopeeInternacional) {
          tagsArray.push('shopee_origem:internacional');
        } else {
          tagsArray.push('shopee_origem:todas');
        }
        if (shopeeMelhorAvaliacao) {
          tagsArray.push('shopee_melhor_avaliacao:true');
        }
        if (estrategia === 'maior_desconto' && apenasMaiorDesconto) {
          tagsArray.push('shopee_apenas_maior_desconto:true');
        }
      }
      if (plataforma === 'MERCADO_LIVRE') {
        if (mlFreteGratis) tagsArray.push('ml_frete_gratis:true');
        if (mlFull) tagsArray.push('ml_full:true');
        if (mlNacional) tagsArray.push('ml_nacional:true');
        if (mlInternacional) tagsArray.push('ml_internacional:true');
        if (mlNovo) tagsArray.push('ml_novo:true');
        if (mlUsado) tagsArray.push('ml_usado:true');
        if (estrategia === 'maior_desconto' && apenasMaiorDesconto) {
          tagsArray.push('ml_apenas_maior_desconto:true');
        }
      }
      if (plataforma === 'AMAZON') {
        if (amzFreteGratis) tagsArray.push('amz_frete_gratis:true');
        if (amzMelhorAvaliacao) tagsArray.push('amz_melhor_avaliacao:true');
        if (amzNacional) tagsArray.push('amz_nacional:true');
        if (amzInternacional) tagsArray.push('amz_internacional:true');
        if (amzNovo) tagsArray.push('amz_novo:true');
        if (amzUsado) tagsArray.push('amz_usado:true');
        if (estrategia === 'maior_desconto' && apenasMaiorDesconto) {
          tagsArray.push('amz_apenas_maior_desconto:true');
        }
      }
      if (plataforma === 'MAGALU') {
        if (magaluFreteGratis) tagsArray.push('magalu_frete_gratis:true');
        if (magaluEntregaRapida) tagsArray.push('magalu_entrega_rapida:true');
        if (magaluMelhorAvaliacao) tagsArray.push('magalu_melhor_avaliacao:true');
        if (magaluNacional) tagsArray.push('magalu_nacional:true');
        if (magaluInternacional) tagsArray.push('magalu_internacional:true');
        if (estrategia === 'maior_desconto' && apenasMaiorDesconto) {
          tagsArray.push('magalu_apenas_maior_desconto:true');
        }
      }
      if (plataforma === 'KABUM') {
        if (kabumFreteGratis) tagsArray.push('kabum_frete_gratis:true');
        if (kabumMelhorAvaliacao) tagsArray.push('kabum_melhor_avaliacao:true');
        if (estrategia === 'maior_desconto' && apenasMaiorDesconto) {
          tagsArray.push('kabum_apenas_maior_desconto:true');
        }
      }
      if (plataforma === 'AMERICANAS') {
        if (ameEntregaRapida) tagsArray.push('ame_entrega_rapida:true');
        if (ameFreteGratis) tagsArray.push('ame_frete_gratis:true');
        if (ameMelhorAvaliacao) tagsArray.push('ame_melhor_avaliacao:true');
        if (estrategia === 'maior_desconto' && apenasMaiorDesconto) {
          tagsArray.push('ame_apenas_maior_desconto:true');
        }
      }
      if (plataforma === 'SHEIN') {
        if (sheinNacional && !sheinInternacional) {
          tagsArray.push('shein_nacional:true');
        } else if (!sheinNacional && sheinInternacional) {
          tagsArray.push('shein_internacional:true');
        }
        if (sheinMaisVendidos) tagsArray.push('shein_mais_vendidos:true');
        if (sheinMelhorAvaliacao) tagsArray.push('shein_melhor_avaliacao:true');
        if (estrategia === 'maior_desconto' && apenasMaiorDesconto) {
          tagsArray.push('shein_apenas_maior_desconto:true');
        }
      }
    }
    const palavrasFinal = tagsArray.filter(Boolean).join(',');

    const intervaloFinal = tier === TIERS.FREE ? 180 : Math.max(15, Number(intervalo) || 30);

    const payload = {
      usuario_id: currentOwnerId,
      nome: nome.trim(),
      urls: urlFinal,
      modo: modoFinal,
      produto: produto.trim(),
      preco_alvo: (estrategia === 'por_preco' && alvoNum > 0) ? alvoNum : null,
      margem: margemNum,
      palavras: palavrasFinal,
      intervalo_valor: intervaloFinal,
      intervalo_unidade: 'minutos',
      ativo: true,
      forcar_teste: false
    };

    try {
      setSalvando(true);
      if (editando) {
        await RadarAPI.updateMonitor(editando.id, payload);
        fetchData(null, true);
        showAlert({
          title: "Radar Atualizado!",
          message: `As configurações de "${nome.trim()}" foram atualizadas e o robô já está operando com as novas regras!`,
          type: "radar_saved",
          icon: "thumbs-up",
          confirmText: "Ver Meus Radares",
          onConfirm: () => navigation.goBack()
        });
      } else {
        await RadarAPI.createMonitor(payload);
        fetchData(null, true);
        showAlert({
          title: "Radar em Operação!",
          message: `O monitor "${nome.trim()}" foi salvo com sucesso! O robô de busca já iniciou o monitoramento conforme o intervalo programado.`,
          type: "radar_saved",
          icon: "thumbs-up",
          confirmText: "Ver Meus Radares",
          onConfirm: () => navigation.goBack()
        });
      }
    } catch (e) {
      showAlert({
        title: "Erro ao Salvar",
        message: "Falha de conexão com o Supabase ao salvar radar.",
        type: "error"
      });
    } finally {
      setSalvando(false);
    }
  };

  const tentarAtivarNotificacoes = async () => {
    try {
      setAtivandoNotif(true);
      await alternarNotificacoes(true);
      const token = await registerPushToken(deviceId, user?.id);
      if (token && String(token).startsWith('ExponentPushToken')) {
        setPushToken(token);
        setModalAvisoNotifVisivel(false);
        showAlert({
          title: "Notificações Ativadas!",
          message: "Seu aparelho agora receberá alertas instantâneos de novas oportunidades.",
          type: "success",
          icon: "notifications-outline"
        });
        await executarSalvamento();
      } else {
        showAlert({
          title: "Permissão Necessária",
          message: "Não será possível receber as notificações dos alertas. Habilite as notificações nas configurações do seu celular.",
          type: "confirm_warning",
          icon: "notifications-off-outline",
          confirmText: "Salvar sem Notificações",
          cancelText: "Cancelar",
          showCancel: true,
          onConfirm: () => {
            setModalAvisoNotifVisivel(false);
            executarSalvamento();
          }
        });
      }
    } catch (e) {
      showAlert({
        title: "Aviso",
        message: "Falha ao registrar notificações no aparelho.",
        type: "warning"
      });
    } finally {
      setAtivandoNotif(false);
    }
  };

  const salvar = async () => {
    if (!nome.trim() || !intervalo.trim()) {
      showAlert({
        title: "Campos Obrigatórios",
        message: "Informe ao menos o Nome do Radar e a Frequência.",
        type: "warning",
        icon: "alert-circle"
      });
      return;
    }

    const intervaloNum = Number(intervalo);
    if (tier !== TIERS.FREE && (isNaN(intervaloNum) || intervaloNum < 15)) {
      showAlert({
        title: "Frequência Mínima de 15 min",
        message: "O tempo mínimo permitido entre varreduras é de 15 minutos para evitar sobrecarga no servidor.",
        type: "warning",
        icon: "time-outline"
      });
      return;
    }

    // Validação de limite no Plano Free
    if (!editando && tier === TIERS.FREE && (monitores || []).length >= 1) {
      showAlert({
        title: "Limite do Plano Free",
        message: "Usuários do plano Free só podem criar 1 radar por vez. Desbloqueie até 5 radares simultâneos e varreduras de 15 minutos assinando o AchôAI Premium!",
        type: "warning",
        icon: "lock-closed",
        confirmText: "Ver Planos",
        cancelText: "Entendi",
        showCancel: true,
        onConfirm: openUpgradeModal
      });
      return;
    }

    if (plataforma === 'OUTROS') {
      if (tier === TIERS.FREE) {
        showAlert({
          title: "Recurso Premium",
          message: "A plataforma Outros Sites é exclusiva para assinantes Premium.",
          type: "warning",
          icon: "lock-closed",
          confirmText: "Ver Planos",
          cancelText: "Voltar",
          showCancel: true,
          onConfirm: openUpgradeModal
        });
        return;
      }
      if (!urls.trim()) {
        showAlert({
          title: "Campos Obrigatórios",
          message: "Informe a URL da página para monitorar.",
          type: "warning",
          icon: "alert-circle"
        });
        return;
      }
      if (modo === 'noticia' && !palavras.trim()) {
        showAlert({
          title: "Campos Obrigatórios",
          message: "Informe ao menos uma palavra-chave.",
          type: "warning",
          icon: "alert-circle"
        });
        return;
      }
      if (modo === 'produto' && !produto.trim()) {
        showAlert({
          title: "Campos Obrigatórios",
          message: "Informe o termo do anúncio pesquisado.",
          type: "warning",
          icon: "alert-circle"
        });
        return;
      }
    } else {
      if (!produto.trim()) {
        showAlert({
          title: "Campos Obrigatórios",
          message: "Informe o termo do anúncio (ex: iPhone 15, Notebook Dell, Cadeira Gamer).",
          type: "warning",
          icon: "alert-circle"
        });
        return;
      }
    }

    if (estrategia === 'por_preco' && modo !== 'noticia') {
      if (tier === TIERS.FREE) {
        showAlert({
          title: "Recurso Premium",
          message: "A estratégia Por Preço Alvo é exclusiva para assinantes Premium.",
          type: "warning",
          icon: "lock-closed",
          confirmText: "Ver Planos",
          cancelText: "Voltar",
          showCancel: true,
          onConfirm: openUpgradeModal
        });
        return;
      }
      if (!precoAlvo.trim() || alvoNum <= 0) {
        showAlert({
          title: "Preço Alvo Obrigatório",
          message: "Na estratégia 'Rastrear pelo Preço', digite o valor alvo desejado (em R$).",
          type: "warning",
          icon: "pricetag-outline"
        });
        return;
      }
    }

    const temPushToken = Boolean(pushToken && String(pushToken).startsWith('ExponentPushToken'));
    const notificacoesProntas = Boolean(notificacoesAtivas && temPushToken);
    if (!notificacoesProntas && !editando) {
      setModalAvisoNotifVisivel(true);
      return;
    }

    await executarSalvamento();
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        
        {editando ? (
          <View style={styles.editNoticeBanner}>
            <Ionicons name="create" size={15} color={THEME.primary} style={{ marginRight: 8 }} />
            <Text style={styles.editNoticeText}>Editando parâmetros do radar existente</Text>
          </View>
        ) : tier === TIERS.FREE && (monitores || []).length >= 1 ? (
          <View style={[styles.editNoticeBanner, { borderColor: THEME.warning, backgroundColor: THEME.warningBg }]}>
            <Ionicons name="lock-closed" size={15} color={THEME.warning} style={{ marginRight: 8 }} />
            <Text style={[styles.editNoticeText, { color: THEME.text }]}>
              Você já possui 1 radar ativo (limite do Plano Free). Salvar este radar requer o AchôAI Premium.
            </Text>
          </View>
        ) : null}

        {/* 1. SELEÇÃO DA PLATAFORMA */}
        <Text style={styles.formSectionTitle}>1. ONDE O ROBÔ DEVE BUSCAR</Text>
        <View style={styles.platformGrid}>
          {[
            { key: 'OLX', nome: 'OLX', icon: 'cart-outline', color: '#A855F7', locked: false },
            { key: 'MERCADO_LIVRE', nome: 'Mercado Livre', icon: 'cube-outline', color: '#FFE600', locked: false },
            { key: 'SHOPEE', nome: 'Shopee', icon: 'bag-handle-outline', color: '#EE4D2D', locked: false },
            { key: 'AMAZON', nome: 'Amazon', icon: 'cart-outline', color: '#FF9900', locked: false },
            { key: 'MAGALU', nome: 'Magalu', icon: 'bag-handle-outline', color: '#0086FF', locked: false },
            { key: 'KABUM', nome: 'KaBuM!', icon: 'hardware-chip-outline', color: '#FF6500', locked: false },
            { key: 'AMERICANAS', nome: 'Americanas', icon: 'storefront-outline', color: '#E60014', locked: false },
            { key: 'SHEIN', nome: 'SHEIN', icon: 'shirt-outline', color: '#FFFFFF', locked: false },
            { key: 'FACEBOOK', nome: 'Facebook Marketplace', icon: 'logo-facebook', color: '#1877F2', locked: false },
            { key: 'ZOOM', nome: 'Zoom', icon: 'search-outline', color: '#F59E0B', locked: false },
            { key: 'OUTROS', nome: 'Outros Sites', icon: 'globe-outline', color: '#06B6D4', locked: tier === TIERS.FREE }
          ].map(p => {
            const isActive = plataforma === p.key;
            return (
              <TouchableOpacity 
                key={p.key}
                style={[styles.platformCardBtn, isActive && styles.platformCardBtnActive]}
                onPress={() => {
                  if (p.locked) {
                    showAlert({
                      title: "Recurso Premium",
                      message: "Monitorar páginas da internet e portais de notícias externos é exclusivo do AchôAI Premium.",
                      type: "warning",
                      icon: "lock-closed",
                      confirmText: "Ver Planos",
                      cancelText: "Entendi",
                      showCancel: true,
                      onConfirm: openUpgradeModal
                    });
                    return;
                  }
                  setPlataforma(p.key);
                  if (p.key === 'ZOOM') {
                    if (estrategia === 'mais_recentes') setEstrategia('menor_preco');
                  }
                  if (p.key === 'MERCADO_LIVRE' || p.key === 'SHOPEE' || p.key === 'AMAZON' || p.key === 'MAGALU' || p.key === 'KABUM' || p.key === 'AMERICANAS' || p.key === 'SHEIN') {
                    if (estrategia === 'mais_recentes') setEstrategia('maior_desconto');
                  }
                  if (p.key !== 'OUTROS') setModo('produto');
                }}
                activeOpacity={0.7}
              >
                {p.locked && (
                  <View style={{ position: 'absolute', top: 6, right: 6 }}>
                    <Ionicons name="lock-closed" size={12} color={THEME.warning} />
                  </View>
                )}
                <View style={[styles.platformIconCircle, { backgroundColor: isActive ? THEME.primaryGlow : 'rgba(255,255,255,0.05)' }]}>
                  <Ionicons name={p.icon} size={18} color={isActive ? THEME.primary : p.color} />
                </View>
                <Text style={[styles.platformCardBtnText, isActive && styles.platformCardBtnTextActive]}>
                  {p.nome}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {plataforma === 'MERCADO_LIVRE' && (
          <View style={[styles.comparatorBanner, { borderColor: 'rgba(255, 230, 0, 0.35)', backgroundColor: 'rgba(255, 230, 0, 0.08)' }]}>
            <Ionicons name="cube-outline" size={16} color="#FFE600" style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              O Mercado Livre monitora produtos com suporte a frete grátis, entrega FULL, filtros de procedência e captura dos maiores descontos promocionais (% OFF).
            </Text>
          </View>
        )}

        {plataforma === 'SHOPEE' && (
          <View style={[styles.comparatorBanner, { borderColor: 'rgba(238, 77, 45, 0.35)', backgroundColor: 'rgba(238, 77, 45, 0.08)' }]}>
            <Ionicons name="bag-handle-outline" size={16} color="#EE4D2D" style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              A Shopee monitora ofertas com entrega nacional ou internacional, maiores descontos (% OFF) e filtro inteligente de melhor avaliação positiva com score e volume de vendas.
            </Text>
          </View>
        )}

        {plataforma === 'AMAZON' && (
          <View style={[styles.comparatorBanner, { borderColor: 'rgba(255, 153, 0, 0.35)', backgroundColor: 'rgba(255, 153, 0, 0.08)' }]}>
            <Ionicons name="cart-outline" size={16} color="#FF9900" style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              A Amazon monitora produtos com suporte a frete grátis e Prime, filtro de melhores avaliações com score de satisfação e captura dos maiores descontos promocionais (% OFF).
            </Text>
          </View>
        )}

        {plataforma === 'MAGALU' && (
          <View style={[styles.comparatorBanner, { borderColor: 'rgba(0, 134, 255, 0.35)', backgroundColor: 'rgba(0, 134, 255, 0.08)' }]}>
            <Ionicons name="bag-handle-outline" size={16} color="#0086FF" style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              O Magazine Luiza (Magalu) monitora ofertas com entrega rápida Full, frete grátis, melhores avaliações dos clientes e captura dos maiores descontos promocionais (% OFF).
            </Text>
          </View>
        )}

        {plataforma === 'KABUM' && (
          <View style={[styles.comparatorBanner, { borderColor: 'rgba(255, 101, 0, 0.35)', backgroundColor: 'rgba(255, 101, 0, 0.08)' }]}>
            <Ionicons name="hardware-chip-outline" size={16} color="#FF6500" style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              O KaBuM! é especializado em tecnologia, hardware, computadores e celulares (apenas produtos novos e nacionais), com suporte a frete grátis, melhores avaliações dos clientes e maiores descontos promocionais (% OFF).
            </Text>
          </View>
        )}

        {plataforma === 'AMERICANAS' && (
          <View style={[styles.comparatorBanner, { borderColor: 'rgba(230, 0, 20, 0.35)', backgroundColor: 'rgba(230, 0, 20, 0.08)' }]}>
            <Ionicons name="storefront-outline" size={16} color="#E60014" style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              A Americanas monitora produtos com suporte a entrega rápida Full, frete grátis, melhores avaliações dos clientes e captura dos maiores descontos promocionais (% OFF).
            </Text>
          </View>
        )}

        {plataforma === 'SHEIN' && (
          <View style={[styles.comparatorBanner, { borderColor: 'rgba(255, 255, 255, 0.35)', backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
            <Ionicons name="shirt-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              A SHEIN monitora moda e vestuário com opções de procedência nacional ou internacional, produtos Mais Vendidos na Shein, melhores avaliações dos clientes e maiores descontos promocionais (% OFF).
            </Text>
          </View>
        )}

        {plataforma === 'FACEBOOK' && (
          <View style={[styles.comparatorBanner, { borderColor: 'rgba(24, 119, 242, 0.35)', backgroundColor: 'rgba(24, 119, 242, 0.08)' }]}>
            <Ionicons name="logo-facebook" size={16} color="#1877F2" style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              O Facebook Marketplace rastreia ofertas de vendedores e lojas na cidade selecionada com link direto para o anúncio.
            </Text>
          </View>
        )}

        {plataforma === 'ZOOM' && (
          <View style={styles.comparatorBanner}>
            <Ionicons name="information-circle-outline" size={16} color={THEME.primary} style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              O Zoom compara preços em lojas como Amazon, Magazine Luiza e Mercado Livre em todo o Brasil.
            </Text>
          </View>
        )}

        {/* SE FOR FACEBOOK MARKETPLACE: CIDADE */}
        {plataforma === 'FACEBOOK' && (
          <>
            <Text style={[styles.formSectionTitle, { marginTop: 18 }]}>LOCALIZAÇÃO (FACEBOOK MARKETPLACE)</Text>
            <Surface style={styles.formSurface}>
              <Text style={styles.inputTitle}>CIDADE DA BUSCA</Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="Ex: fortaleza, saopaulo, riodejaneiro..." 
                placeholderTextColor={THEME.textSubtle} 
                value={cidadeFacebook} 
                onChangeText={setCidadeFacebook} 
                autoCapitalize="none"
              />
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                {[
                  { label: 'Fortaleza', slug: 'fortaleza' },
                  { label: 'São Paulo', slug: 'saopaulo' },
                  { label: 'Rio de Janeiro', slug: 'riodejaneiro' },
                  { label: 'Belo Horizonte', slug: 'belohorizonte' },
                  { label: 'Curitiba', slug: 'curitiba' },
                  { label: 'Brasília', slug: 'brasilia' },
                  { label: 'Recife', slug: 'recife' },
                  { label: 'Salvador', slug: 'salvador' },
                  { label: 'Goiânia', slug: 'goiania' },
                  { label: 'Porto Alegre', slug: 'portoalegre' },
                ].map(c => {
                  const isSelected = normalizarSlugCidade(cidadeFacebook) === c.slug;
                  return (
                    <TouchableOpacity 
                      key={c.slug}
                      style={[
                        styles.filterChip, 
                        { marginRight: 8, paddingHorizontal: 12, paddingVertical: 6 }, 
                        isSelected && styles.filterChipActive
                      ]}
                      onPress={() => setCidadeFacebook(c.slug)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={[styles.urlPreviewBox, { marginTop: 12 }]}>
                <Ionicons name="link-outline" size={13} color={THEME.success} style={{ marginRight: 6 }} />
                <Text style={styles.urlPreviewText} numberOfLines={1}>
                  {`https://www.facebook.com/marketplace/${normalizarSlugCidade(cidadeFacebook)}/search/?query=${encodeURIComponent(produto || '...')}`}
                </Text>
              </View>
            </Surface>
          </>
        )}

        {/* SE FOR OLX: ESTADO E REGIÃO */}
        {plataforma === 'OLX' && (
          <>
            <Text style={[styles.formSectionTitle, { marginTop: 18 }]}>LOCALIZAÇÃO GEOGRÁFICA (OLX)</Text>
            <Surface style={styles.formSurface}>
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.selectBtn, { marginRight: 8 }]} 
                  onPress={() => setModalEstadoVisivel(true)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectBtnLabel}>ESTADO (UF)</Text>
                    <Text style={styles.selectBtnValue} numberOfLines={1}>
                      {estadoUf === 'BR' ? 'Brasil Inteiro' : `${OLX_ESTADOS[estadoUf]?.nome} (${estadoUf})`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={15} color={THEME.primary} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.selectBtn, estadoUf === 'BR' && { opacity: 0.85 }]} 
                  onPress={() => {
                    if (estadoUf === 'BR') {
                      showAlert({
                        title: "Brasil Inteiro",
                        message: "A opção Brasil abrange automaticamente todas as regiões do país.",
                        type: "info",
                        icon: "globe-outline"
                      });
                    } else {
                      setModalRegiaoVisivel(true);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectBtnLabel}>REGIÃO</Text>
                    <Text style={styles.selectBtnValue} numberOfLines={1}>
                      {estadoUf === 'BR' ? 'Todas as Regiões' : regiaoAtual.nome}
                    </Text>
                  </View>
                  <Ionicons name={estadoUf === 'BR' ? "checkmark-circle" : "chevron-down"} size={15} color={THEME.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.urlPreviewBox}>
                <Ionicons name="link-outline" size={13} color={THEME.success} style={{ marginRight: 6 }} />
                <Text style={styles.urlPreviewText} numberOfLines={1}>
                  {gerarUrlOlx(estadoUf, regiaoSlug, produto)}
                </Text>
              </View>
            </Surface>
          </>
        )}

        {/* SE FOR OUTROS SITES */}
        {plataforma === 'OUTROS' && (
          <>
            <View style={[styles.segmentWrap, { marginTop: 14 }]}>
              <TouchableOpacity 
                style={[styles.segmentOption, modo === 'produto' && styles.segmentOptionActive]}
                onPress={() => setModo('produto')}
              >
                <Ionicons name="cart" size={16} color={modo === 'produto' ? '#08090D' : THEME.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.segmentLabel, modo === 'produto' && styles.segmentLabelActive]}>Página de Anúncio</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.segmentOption, modo === 'noticia' && styles.segmentOptionActive]}
                onPress={() => setModo('noticia')}
              >
                <Ionicons name="newspaper" size={16} color={modo === 'noticia' ? '#08090D' : THEME.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.segmentLabel, modo === 'noticia' && styles.segmentLabelActive]}>Portal de Notícias</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.formSectionTitle, { marginTop: 14 }]}>URL DA PÁGINA</Text>
            <Surface style={styles.formSurface}>
              <Text style={styles.inputTitle}>ENDEREÇO COMPLETO (HTTPS://...)</Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="Ex: https://g1.globo.com/ ou URL do anúncio" 
                placeholderTextColor={THEME.textSubtle} 
                value={urls} 
                onChangeText={setUrls} 
                autoCapitalize="none"
              />
            </Surface>
          </>
        )}

        {/* 2. IDENTIFICAÇÃO DO RADAR */}
        <Text style={[styles.formSectionTitle, { marginTop: 18 }]}>2. O QUE VOCÊ PROCURA</Text>
        <Surface style={styles.formSurface}>
          <Text style={styles.inputTitle}>NOME DO RADAR</Text>
          <TextInput 
            style={styles.inputField} 
            placeholder="Ex: iPhone 15 Pro Max 256GB" 
            placeholderTextColor={THEME.textSubtle} 
            value={nome} 
            onChangeText={setNome} 
          />

          {modo !== 'noticia' ? (
            <>
              <Text style={[styles.inputTitle, { marginTop: 14 }]}>TERMO DE PESQUISA</Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="Ex: iphone 15 256gb" 
                placeholderTextColor={THEME.textSubtle} 
                value={produto} 
                onChangeText={setProduto} 
              />
              <Text style={styles.helperText}>
                {plataforma === 'OLX'
                  ? "O robô buscará exatamente este termo nos anúncios da região definida."
                  : plataforma === 'FACEBOOK'
                  ? "O robô buscará anúncios no Facebook Marketplace da cidade selecionada."
                  : plataforma === 'SHOPEE'
                  ? "O robô buscará anúncios na Shopee com entrega nacional e filtros automáticos."
                  : plataforma === 'MERCADO_LIVRE'
                  ? "O robô buscará este produto no Mercado Livre aplicando os filtros configurados."
                  : plataforma === 'AMAZON'
                  ? "O robô buscará este produto na Amazon aplicando os filtros configurados."
                  : plataforma === 'MAGALU'
                  ? "O robô buscará este produto no Magazine Luiza aplicando os filtros configurados."
                  : plataforma === 'KABUM'
                  ? "O robô buscará este produto no KaBuM! aplicando os filtros configurados."
                  : plataforma === 'AMERICANAS'
                  ? "O robô buscará este produto na Americanas aplicando os filtros configurados."
                  : plataforma === 'SHEIN'
                  ? "O robô buscará este produto na SHEIN aplicando os filtros configurados."
                  : plataforma === 'ZOOM'
                  ? "O comparador filtrará os preços de lojas confiáveis com este termo."
                  : "O robô buscará este produto na página cadastrada."}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.inputTitle, { marginTop: 14 }]}>PALAVRAS-CHAVE DA MATÉRIA</Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="concurso, edital, vaga (separadas por vírgula)" 
                placeholderTextColor={THEME.textSubtle} 
                value={palavras} 
                onChangeText={setPalavras} 
              />
              <Text style={styles.helperText}>Dispara alerta sempre que todas as palavras forem localizadas juntas.</Text>
            </>
          )}
        </Surface>

        {/* 3. ESTRATÉGIA DE CAPTURA */}
        {modo !== 'noticia' && (
          <>
            <Text style={[styles.formSectionTitle, { marginTop: 18 }]}>3. ESTRATÉGIA INTELIGENTE DE CAPTURA</Text>

            {/* OPÇÕES E FILTROS DO MERCADO LIVRE */}
            {plataforma === 'MERCADO_LIVRE' && (
              <Surface style={[styles.shopeeOptionsCard, { borderColor: 'rgba(255, 230, 0, 0.3)' }]}>
                <View style={styles.shopeeOptionsHeader}>
                  <Ionicons name="options-outline" size={15} color="#FFE600" style={{ marginRight: 6 }} />
                  <Text style={[styles.shopeeOptionsTitle, { color: '#FFE600' }]}>FILTROS DO MERCADO LIVRE</Text>
                </View>
                <Text style={styles.shopeeOptionsDesc}>
                  Personalize sua busca selecionando os filtros desejados (desmarcados por padrão):
                </Text>

                <View style={styles.checkboxContainer}>
                  {/* 1. Frete Grátis */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, mlFreteGratis && styles.checkboxRowItemActive]}
                    onPress={() => setMlFreteGratis(!mlFreteGratis)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={mlFreteGratis ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={mlFreteGratis ? "#10B981" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, mlFreteGratis && styles.checkboxItemTitleActive]}>
                          Frete Grátis
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>GRÁTIS</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas anúncios com frete grátis</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 2. Entrega FULL */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, mlFull && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setMlFull(!mlFull)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={mlFull ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={mlFull ? "#00A650" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, mlFull && styles.checkboxItemTitleActive]}>
                          Entrega FULL
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(0, 166, 80, 0.15)', borderColor: 'rgba(0, 166, 80, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#00A650' }}>⚡ FULL</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Produtos com envio rápido do galpão Mercado Livre</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 3. Nacional */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, mlNacional && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setMlNacional(!mlNacional)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={mlNacional ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={mlNacional ? "#10B981" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, mlNacional && styles.checkboxItemTitleActive]}>
                          Nacional
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>BRASIL</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Produtos enviados de dentro do Brasil</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 4. Internacional */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, mlInternacional && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setMlInternacional(!mlInternacional)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={mlInternacional ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={mlInternacional ? "#3B82F6" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, mlInternacional && styles.checkboxItemTitleActive]}>
                          Internacional
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#3B82F6' }}>EXTERIOR</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Produtos de compra internacional</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 5. Novo */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, mlNovo && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setMlNovo(!mlNovo)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={mlNovo ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={mlNovo ? "#FFE600" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, mlNovo && styles.checkboxItemTitleActive]}>
                          Novo
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(255, 230, 0, 0.15)', borderColor: 'rgba(255, 230, 0, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFE600' }}>NOVO</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas produtos novos e lacrados</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 6. Usado */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, mlUsado && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setMlUsado(!mlUsado)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={mlUsado ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={mlUsado ? "#94A3B8" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, mlUsado && styles.checkboxItemTitleActive]}>
                          Usado
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(148, 163, 184, 0.15)', borderColor: 'rgba(148, 163, 184, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#94A3B8' }}>USADO</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas produtos seminovos e usados</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Surface>
            )}

            {/* OPÇÕES DE PROCEDÊNCIA (SHOPEE: NACIONAL / INTERNACIONAL) */}
            {plataforma === 'SHOPEE' && (
              <Surface style={styles.shopeeOptionsCard}>
                <View style={styles.shopeeOptionsHeader}>
                  <Ionicons name="location-outline" size={15} color="#EE4D2D" style={{ marginRight: 6 }} />
                  <Text style={styles.shopeeOptionsTitle}>PROCEDÊNCIA DOS PRODUTOS</Text>
                </View>
                <Text style={styles.shopeeOptionsDesc}>
                  Selecione os locais de envio para a varredura (ao menos um deve estar ativo):
                </Text>

                <View style={styles.checkboxContainer}>
                  {/* Opção Nacional */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, shopeeNacional && styles.checkboxRowItemActive]}
                    onPress={() => {
                      if (shopeeNacional && !shopeeInternacional) {
                        showAlert({
                          title: "Seleção Obrigatória",
                          message: "Ao menos uma opção de procedência (Nacional ou Internacional) deve permanecer ativa.",
                          type: "warning",
                          icon: "alert-circle"
                        });
                        return;
                      }
                      setShopeeNacional(!shopeeNacional);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={shopeeNacional ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={shopeeNacional ? "#EE4D2D" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, shopeeNacional && styles.checkboxItemTitleActive]}>
                          Nacional
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>BRASIL</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Anúncios enviados de dentro do Brasil</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Opção Internacional */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, shopeeInternacional && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => {
                      if (!shopeeNacional && shopeeInternacional) {
                        showAlert({
                          title: "Seleção Obrigatória",
                          message: "Ao menos uma opção de procedência (Nacional ou Internacional) deve permanecer ativa.",
                          type: "warning",
                          icon: "alert-circle"
                        });
                        return;
                      }
                      setShopeeInternacional(!shopeeInternacional);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={shopeeInternacional ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={shopeeInternacional ? "#EE4D2D" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, shopeeInternacional && styles.checkboxItemTitleActive]}>
                          Internacional
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#3B82F6' }}>EXTERIOR</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Produtos importados enviados de fora do país</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Opção Por Melhor Avaliação Positiva */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, shopeeMelhorAvaliacao && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setShopeeMelhorAvaliacao(!shopeeMelhorAvaliacao)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={shopeeMelhorAvaliacao ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={shopeeMelhorAvaliacao ? "#FFBB00" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, shopeeMelhorAvaliacao && styles.checkboxItemTitleActive]}>
                          Por Melhor Avaliação Positiva
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(255, 187, 0, 0.15)', borderColor: 'rgba(255, 187, 0, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFBB00' }}>⭐ TOP SCORE</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Filtra por maior volume de vendas e nota máxima (4.0 a 5.0 estrelas)</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Surface>
            )}

            {/* OPÇÕES E FILTROS DA AMAZON */}
            {plataforma === 'AMAZON' && (
              <Surface style={[styles.shopeeOptionsCard, { borderColor: 'rgba(255, 153, 0, 0.3)' }]}>
                <View style={styles.shopeeOptionsHeader}>
                  <Ionicons name="options-outline" size={15} color="#FF9900" style={{ marginRight: 6 }} />
                  <Text style={[styles.shopeeOptionsTitle, { color: '#FF9900' }]}>FILTROS DA AMAZON</Text>
                </View>
                <Text style={styles.shopeeOptionsDesc}>
                  Personalize sua busca selecionando os filtros desejados (desmarcados por padrão):
                </Text>

                <View style={styles.checkboxContainer}>
                  {/* 1. Frete Grátis */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, amzFreteGratis && styles.checkboxRowItemActive]}
                    onPress={() => setAmzFreteGratis(!amzFreteGratis)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={amzFreteGratis ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={amzFreteGratis ? "#10B981" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, amzFreteGratis && styles.checkboxItemTitleActive]}>
                          Frete Grátis
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>GRÁTIS</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas anúncios com frete grátis ou Prime elegível</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 2. Melhor Avaliação Positiva (Substitui Entrega FULL) */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, amzMelhorAvaliacao && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setAmzMelhorAvaliacao(!amzMelhorAvaliacao)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={amzMelhorAvaliacao ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={amzMelhorAvaliacao ? "#FFBB00" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, amzMelhorAvaliacao && styles.checkboxItemTitleActive]}>
                          Melhor Avaliação Positiva
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(255, 187, 0, 0.15)', borderColor: 'rgba(255, 187, 0, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFBB00' }}>⭐ TOP SCORE</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Filtra por notas máximas (4.0 a 5.0 estrelas) e satisfação de clientes</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 3. Nacional */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, amzNacional && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setAmzNacional(!amzNacional)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={amzNacional ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={amzNacional ? "#10B981" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, amzNacional && styles.checkboxItemTitleActive]}>
                          Nacional
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>BRASIL</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Produtos enviados de estoques no Brasil</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 4. Internacional */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, amzInternacional && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setAmzInternacional(!amzInternacional)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={amzInternacional ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={amzInternacional ? "#3B82F6" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, amzInternacional && styles.checkboxItemTitleActive]}>
                          Internacional
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#3B82F6' }}>EXTERIOR</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Produtos de compras e importação internacional</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 5. Novo */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, amzNovo && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setAmzNovo(!amzNovo)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={amzNovo ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={amzNovo ? "#FFE600" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, amzNovo && styles.checkboxItemTitleActive]}>
                          Novo
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(255, 230, 0, 0.15)', borderColor: 'rgba(255, 230, 0, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFE600' }}>NOVO</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas produtos novos e lacrados</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 6. Usado */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, amzUsado && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setAmzUsado(!amzUsado)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={amzUsado ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={amzUsado ? "#94A3B8" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, amzUsado && styles.checkboxItemTitleActive]}>
                          Usado
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(148, 163, 184, 0.15)', borderColor: 'rgba(148, 163, 184, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#94A3B8' }}>USADO</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas produtos seminovos e recondicionados</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Surface>
            )}

            {/* OPÇÕES E FILTROS DA MAGALU */}
            {plataforma === 'MAGALU' && (
              <Surface style={[styles.shopeeOptionsCard, { borderColor: 'rgba(0, 134, 255, 0.3)' }]}>
                <View style={styles.shopeeOptionsHeader}>
                  <Ionicons name="options-outline" size={15} color="#0086FF" style={{ marginRight: 6 }} />
                  <Text style={[styles.shopeeOptionsTitle, { color: '#0086FF' }]}>FILTROS DA MAGALU</Text>
                </View>
                <Text style={styles.shopeeOptionsDesc}>
                  Personalize sua busca selecionando os filtros desejados (desmarcados por padrão):
                </Text>

                <View style={styles.checkboxContainer}>
                  {/* 1. Entrega Mais Rápida (Full) */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, magaluEntregaRapida && styles.checkboxRowItemActive]}
                    onPress={() => setMagaluEntregaRapida(!magaluEntregaRapida)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={magaluEntregaRapida ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={magaluEntregaRapida ? "#0086FF" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, magaluEntregaRapida && styles.checkboxItemTitleActive]}>
                          Entrega Mais Rápida
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(0, 134, 255, 0.15)', borderColor: 'rgba(0, 134, 255, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#0086FF' }}>⚡ FULL</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas anúncios com envio e entrega rápida Full Magalu</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 2. Frete Grátis */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, magaluFreteGratis && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setMagaluFreteGratis(!magaluFreteGratis)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={magaluFreteGratis ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={magaluFreteGratis ? "#10B981" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, magaluFreteGratis && styles.checkboxItemTitleActive]}>
                          Frete Grátis
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>GRÁTIS</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas anúncios elegíveis para frete grátis</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 3. Melhor Avaliação Positiva */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, magaluMelhorAvaliacao && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setMagaluMelhorAvaliacao(!magaluMelhorAvaliacao)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={magaluMelhorAvaliacao ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={magaluMelhorAvaliacao ? "#FFBB00" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, magaluMelhorAvaliacao && styles.checkboxItemTitleActive]}>
                          Melhor Avaliação Positiva
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(255, 187, 0, 0.15)', borderColor: 'rgba(255, 187, 0, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFBB00' }}>⭐ TOP SCORE</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Filtra por notas máximas (4.0 a 5.0 estrelas) e aprovação de clientes</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 4. Nacional */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, magaluNacional && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setMagaluNacional(!magaluNacional)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={magaluNacional ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={magaluNacional ? "#10B981" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, magaluNacional && styles.checkboxItemTitleActive]}>
                          Nacional
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>BRASIL</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Produtos enviados de estoques no Brasil</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 5. Internacional */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, magaluInternacional && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setMagaluInternacional(!magaluInternacional)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={magaluInternacional ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={magaluInternacional ? "#3B82F6" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, magaluInternacional && styles.checkboxItemTitleActive]}>
                          Internacional
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#3B82F6' }}>EXTERIOR</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Produtos de compras e importação internacional</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Surface>
            )}

            {/* OPÇÕES E FILTROS DO KABUM */}
            {plataforma === 'KABUM' && (
              <Surface style={[styles.shopeeOptionsCard, { borderColor: 'rgba(255, 101, 0, 0.3)' }]}>
                <View style={styles.shopeeOptionsHeader}>
                  <Ionicons name="hardware-chip-outline" size={15} color="#FF6500" style={{ marginRight: 6 }} />
                  <Text style={[styles.shopeeOptionsTitle, { color: '#FF6500' }]}>FILTROS DO KABUM!</Text>
                </View>
                <Text style={styles.shopeeOptionsDesc}>
                  Personalize sua busca selecionando os filtros desejados (desmarcados por padrão):
                </Text>

                <View style={styles.checkboxContainer}>
                  {/* 1. Frete Grátis */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, kabumFreteGratis && styles.checkboxRowItemActive]}
                    onPress={() => setKabumFreteGratis(!kabumFreteGratis)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={kabumFreteGratis ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={kabumFreteGratis ? "#10B981" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, kabumFreteGratis && styles.checkboxItemTitleActive]}>
                          Frete Grátis
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>GRÁTIS</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas anúncios com frete grátis</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 2. Melhor Avaliação Positiva */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, kabumMelhorAvaliacao && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setKabumMelhorAvaliacao(!kabumMelhorAvaliacao)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={kabumMelhorAvaliacao ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={kabumMelhorAvaliacao ? "#FFBB00" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, kabumMelhorAvaliacao && styles.checkboxItemTitleActive]}>
                          Melhor Avaliação Positiva
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(255, 187, 0, 0.15)', borderColor: 'rgba(255, 187, 0, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFBB00' }}>⭐ TOP SCORE</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Filtra por notas máximas (4.0 a 5.0 estrelas) e aprovação de clientes</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Surface>
            )}

            {/* OPÇÕES E FILTROS DA AMERICANAS */}
            {plataforma === 'AMERICANAS' && (
              <Surface style={[styles.shopeeOptionsCard, { borderColor: 'rgba(230, 0, 20, 0.3)' }]}>
                <View style={styles.shopeeOptionsHeader}>
                  <Ionicons name="storefront-outline" size={15} color="#E60014" style={{ marginRight: 6 }} />
                  <Text style={[styles.shopeeOptionsTitle, { color: '#E60014' }]}>FILTROS DA AMERICANAS</Text>
                </View>
                <Text style={styles.shopeeOptionsDesc}>
                  Personalize sua busca selecionando os filtros desejados (desmarcados por padrão):
                </Text>

                <View style={styles.checkboxContainer}>
                  {/* 1. Entrega Mais Rápida */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, ameEntregaRapida && styles.checkboxRowItemActive]}
                    onPress={() => setAmeEntregaRapida(!ameEntregaRapida)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={ameEntregaRapida ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={ameEntregaRapida ? "#E60014" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, ameEntregaRapida && styles.checkboxItemTitleActive]}>
                          Entrega Mais Rápida
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(230, 0, 20, 0.15)', borderColor: 'rgba(230, 0, 20, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#E60014' }}>⚡ FULL</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas anúncios vendidos e entregues pela Americanas</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 2. Frete Grátis */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, ameFreteGratis && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setAmeFreteGratis(!ameFreteGratis)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={ameFreteGratis ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={ameFreteGratis ? "#10B981" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, ameFreteGratis && styles.checkboxItemTitleActive]}>
                          Frete Grátis
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>GRÁTIS</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Apenas anúncios elegíveis para frete grátis</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 3. Melhor Avaliação Positiva */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, ameMelhorAvaliacao && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setAmeMelhorAvaliacao(!ameMelhorAvaliacao)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={ameMelhorAvaliacao ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={ameMelhorAvaliacao ? "#FFBB00" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, ameMelhorAvaliacao && styles.checkboxItemTitleActive]}>
                          Melhor Avaliação Positiva
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(255, 187, 0, 0.15)', borderColor: 'rgba(255, 187, 0, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFBB00' }}>⭐ TOP SCORE</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Filtra por notas máximas (4.0 a 5.0 estrelas) e satisfação de clientes</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Surface>
            )}

            {/* OPÇÕES E FILTROS DA SHEIN */}
            {plataforma === 'SHEIN' && (
              <Surface style={[styles.shopeeOptionsCard, { borderColor: 'rgba(255, 255, 255, 0.3)' }]}>
                <View style={styles.shopeeOptionsHeader}>
                  <Ionicons name="shirt-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={[styles.shopeeOptionsTitle, { color: '#FFFFFF' }]}>FILTROS DA SHEIN</Text>
                </View>
                <Text style={styles.shopeeOptionsDesc}>
                  Personalize sua busca selecionando procedência e filtros da SHEIN:
                </Text>

                <View style={styles.checkboxContainer}>
                  {/* Opção Nacional */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, sheinNacional && styles.checkboxRowItemActive]}
                    onPress={() => {
                      if (sheinNacional && !sheinInternacional) {
                        showAlert({
                          title: "Seleção Obrigatória",
                          message: "Ao menos uma opção de procedência (Nacional ou Internacional) deve permanecer ativa.",
                          type: "warning",
                          icon: "alert-circle"
                        });
                        return;
                      }
                      setSheinNacional(!sheinNacional);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={sheinNacional ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={sheinNacional ? "#10B981" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, sheinNacional && styles.checkboxItemTitleActive]}>
                          Nacional
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>BRASIL</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Anúncios com envio rápido de estoques nacionais</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Opção Internacional */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, sheinInternacional && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => {
                      if (!sheinNacional && sheinInternacional) {
                        showAlert({
                          title: "Seleção Obrigatória",
                          message: "Ao menos uma opção de procedência (Nacional ou Internacional) deve permanecer ativa.",
                          type: "warning",
                          icon: "alert-circle"
                        });
                        return;
                      }
                      setSheinInternacional(!sheinInternacional);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={sheinInternacional ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={sheinInternacional ? "#3B82F6" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, sheinInternacional && styles.checkboxItemTitleActive]}>
                          Internacional
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#3B82F6' }}>EXTERIOR</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Peças importadas do catálogo global da SHEIN</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Opção Mais Vendidos na Shein */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, sheinMaisVendidos && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setSheinMaisVendidos(!sheinMaisVendidos)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={sheinMaisVendidos ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={sheinMaisVendidos ? "#F59E0B" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, sheinMaisVendidos && styles.checkboxItemTitleActive]}>
                          Mais Vendidos Na Shein
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#F59E0B' }}>🔥 HOT</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Filtra exclusivamente as peças e roupas mais populares e compradas</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Opção Melhor Avaliação Positiva */}
                  <TouchableOpacity 
                    style={[styles.checkboxRowItem, sheinMelhorAvaliacao && styles.checkboxRowItemActive, { marginTop: 8 }]}
                    onPress={() => setSheinMelhorAvaliacao(!sheinMelhorAvaliacao)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={sheinMelhorAvaliacao ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={sheinMelhorAvaliacao ? "#FFBB00" : THEME.textSubtle} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.row}>
                        <Text style={[styles.checkboxItemTitle, sheinMelhorAvaliacao && styles.checkboxItemTitleActive]}>
                          Por Melhor Avaliação Positiva
                        </Text>
                        <View style={[styles.miniOriginBadge, { backgroundColor: 'rgba(255, 187, 0, 0.15)', borderColor: 'rgba(255, 187, 0, 0.35)' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFBB00' }}>⭐ TOP SCORE</Text>
                        </View>
                      </View>
                      <Text style={styles.checkboxItemSub}>Filtra por notas máximas e avaliações positivas de usuárias</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </Surface>
            )}

            {/* ESTRATÉGIA: MAIOR DESCONTO (MERCADO LIVRE, SHOPEE, AMAZON, MAGALU, KABUM, AMERICANAS E SHEIN) */}
            {(plataforma === 'MERCADO_LIVRE' || plataforma === 'SHOPEE' || plataforma === 'AMAZON' || plataforma === 'MAGALU' || plataforma === 'KABUM' || plataforma === 'AMERICANAS' || plataforma === 'SHEIN') && (
              <TouchableOpacity 
                style={[styles.strategyCard, estrategia === 'maior_desconto' && styles.strategyCardActive]}
                onPress={() => setEstrategia('maior_desconto')}
                activeOpacity={0.8}
              >
                <View style={styles.strategyHeader}>
                  <View style={[styles.strategyIconCircle, estrategia === 'maior_desconto' && styles.strategyIconCircleActive]}>
                    <Ionicons name="flame" size={17} color={estrategia === 'maior_desconto' ? THEME.primary : THEME.textMuted} />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={[styles.strategyTitle, estrategia === 'maior_desconto' && styles.strategyTitleActive]}>
                      Rastrear Anúncios com Maior Desconto
                    </Text>
                    <Text style={styles.strategyDesc}>
                      {apenasMaiorDesconto
                        ? "Captura exclusivamente o único anúncio com o maior desconto promocional (% OFF) da pesquisa."
                        : "Captura até 15 anúncios com os maiores descontos promocionais (% OFF), notificando do menor para o maior para a melhor oferta ficar no topo."}
                    </Text>
                  </View>
                  <Ionicons 
                    name={estrategia === 'maior_desconto' ? "radio-button-on" : "radio-button-off"} 
                    size={19} 
                    color={estrategia === 'maior_desconto' ? THEME.primary : THEME.textSubtle} 
                  />
                </View>

                {estrategia === 'maior_desconto' && (
                  <View style={styles.strategyExtraBox}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.sortToggleTitle}>Apenas Único Maior Desconto</Text>
                        <Text style={styles.sortToggleDesc}>
                          {apenasMaiorDesconto 
                            ? "Ativado: rastreia e apresenta apenas 1 anúncio (o de maior % OFF)" 
                            : "Desativado: rastreia até 15 anúncios com os maiores descontos"}
                        </Text>
                      </View>
                      <Switch 
                        value={apenasMaiorDesconto}
                        onValueChange={setApenasMaiorDesconto}
                        trackColor={{ false: '#1E2333', true: THEME.primary }}
                        thumbColor="#FFF"
                      />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            )}
            
            {/* ESTRATÉGIA: MENOR PREÇO */}
            <TouchableOpacity 
              style={[styles.strategyCard, estrategia === 'menor_preco' && styles.strategyCardActive]}
              onPress={() => setEstrategia('menor_preco')}
              activeOpacity={0.8}
            >
              <View style={styles.strategyHeader}>
                <View style={[styles.strategyIconCircle, estrategia === 'menor_preco' && styles.strategyIconCircleActive]}>
                  <Ionicons name="trending-down" size={17} color={estrategia === 'menor_preco' ? THEME.primary : THEME.textMuted} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={[styles.strategyTitle, estrategia === 'menor_preco' && styles.strategyTitleActive]}>
                    Rastrear Menor Preço Disponível
                  </Text>
                  <Text style={styles.strategyDesc}>
                    Captura exclusivamente a melhor oferta de menor preço dentre os resultados encontrados.
                  </Text>
                </View>
                <Ionicons 
                  name={estrategia === 'menor_preco' ? "radio-button-on" : "radio-button-off"} 
                  size={19} 
                  color={estrategia === 'menor_preco' ? THEME.primary : THEME.textSubtle} 
                />
              </View>
            </TouchableOpacity>

            {/* ESTRATÉGIA: MAIS RECENTES */}
            {plataforma !== 'ZOOM' && plataforma !== 'MERCADO_LIVRE' && plataforma !== 'SHOPEE' && plataforma !== 'AMAZON' && plataforma !== 'MAGALU' && plataforma !== 'KABUM' && plataforma !== 'AMERICANAS' && plataforma !== 'SHEIN' && (
              <TouchableOpacity 
                style={[styles.strategyCard, estrategia === 'mais_recentes' && styles.strategyCardActive]}
                onPress={() => setEstrategia('mais_recentes')}
                activeOpacity={0.8}
              >
                <View style={styles.strategyHeader}>
                  <View style={[styles.strategyIconCircle, estrategia === 'mais_recentes' && styles.strategyIconCircleActive]}>
                    <Ionicons name="time-outline" size={17} color={estrategia === 'mais_recentes' ? THEME.primary : THEME.textMuted} />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={[styles.strategyTitle, estrategia === 'mais_recentes' && styles.strategyTitleActive]}>
                      Rastrear Todos os Anúncios Mais Recentes
                    </Text>
                    <Text style={styles.strategyDesc}>
                      Notifica todos os novos anúncios recém-publicados na plataforma.
                    </Text>
                  </View>
                  <Ionicons 
                    name={estrategia === 'mais_recentes' ? "radio-button-on" : "radio-button-off"} 
                    size={19} 
                    color={estrategia === 'mais_recentes' ? THEME.primary : THEME.textSubtle} 
                  />
                </View>

                {estrategia === 'mais_recentes' && (
                  <View style={styles.strategyExtraBox}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.sortToggleTitle}>Priorizar Menor Preço</Text>
                        <Text style={styles.sortToggleDesc}>Ordena a captura do menor para o maior valor</Text>
                      </View>
                      <Switch 
                        value={ordenarMenorPreco}
                        onValueChange={setOrdenarMenorPreco}
                        trackColor={{ false: '#1E2333', true: THEME.primary }}
                        thumbColor="#FFF"
                      />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* ESTRATÉGIA: POR PREÇO ALVO (COM CADEADO NO FREE) */}
            <TouchableOpacity 
              style={[
                styles.strategyCard, 
                estrategia === 'por_preco' && styles.strategyCardActive,
                tier === TIERS.FREE && { borderColor: 'rgba(255, 122, 0, 0.3)' }
              ]}
              onPress={() => {
                if (tier === TIERS.FREE) {
                  showAlert({
                    title: "Recurso Exclusivo Premium",
                    message: "O rastreamento de anúncios por Preço Alvo com faixa de tolerância é exclusivo para assinantes AchôAI Premium.",
                    type: "warning",
                    icon: "lock-closed",
                    confirmText: "Ver Planos",
                    cancelText: "Entendi",
                    showCancel: true,
                    onConfirm: openUpgradeModal
                  });
                  return;
                }
                setEstrategia('por_preco');
              }}
              activeOpacity={0.8}
            >
              <View style={styles.strategyHeader}>
                <View style={[styles.strategyIconCircle, estrategia === 'por_preco' && styles.strategyIconCircleActive]}>
                  <Ionicons name="pricetag-outline" size={17} color={estrategia === 'por_preco' ? THEME.primary : THEME.textMuted} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <View style={styles.row}>
                    <Text style={[styles.strategyTitle, estrategia === 'por_preco' && styles.strategyTitleActive]}>
                      Rastrear por Preço Alvo (Orçamento)
                    </Text>
                    {tier === TIERS.FREE && (
                      <View style={{ marginLeft: 6 }}>
                        <LockBadge text="PREMIUM" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.strategyDesc}>
                    Filtra ofertas com margem de tolerância em torno do seu valor desejado.
                  </Text>
                </View>
                <Ionicons 
                  name={tier === TIERS.FREE ? "lock-closed" : (estrategia === 'por_preco' ? "radio-button-on" : "radio-button-off")} 
                  size={19} 
                  color={tier === TIERS.FREE ? THEME.warning : (estrategia === 'por_preco' ? THEME.primary : THEME.textSubtle)} 
                />
              </View>

              {estrategia === 'por_preco' && tier !== TIERS.FREE && (
                <View style={styles.strategyExtraBox}>
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.inputTitle}>VALOR ALVO (R$) *</Text>
                      <TextInput 
                        style={styles.inputField} 
                        placeholder="Ex: 1500" 
                        placeholderTextColor={THEME.textSubtle} 
                        keyboardType="numeric" 
                        value={precoAlvo} 
                        onChangeText={setPrecoAlvo} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputTitle}>TOLERÂNCIA (%)</Text>
                      <TextInput 
                        style={styles.inputField} 
                        placeholder="15" 
                        placeholderTextColor={THEME.textSubtle} 
                        keyboardType="numeric" 
                        value={margem} 
                        onChangeText={setMargem} 
                      />
                    </View>
                  </View>

                  {alvoNum > 0 ? (
                    <View style={styles.targetPreviewCard}>
                      <Ionicons name="filter" size={14} color={THEME.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.targetPreviewText}>
                        Faixa aceita: <Text style={{ color: THEME.success, fontWeight: 'bold' }}>R$ {minEstimado.toFixed(2)}</Text> até <Text style={{ color: THEME.success, fontWeight: 'bold' }}>R$ {maxEstimado.toFixed(2)}</Text>
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.helperText, { color: THEME.warning, marginTop: 8 }]}>
                      ⚠️ Digite o valor alvo desejado para calcular a faixa orçamentária.
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* 4. FREQUÊNCIA DE VARREDURA */}
        <Text style={[styles.formSectionTitle, { marginTop: 18 }]}>4. FREQUÊNCIA DE VARREDURA</Text>
        {tier === TIERS.FREE ? (
          <Surface style={styles.formSurface}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.inputTitle}>INTERVALO FREE</Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: THEME.text, marginTop: 4 }}>
                  3 horas (180 minutos)
                </Text>
                <Text style={[styles.helperText, { marginTop: 6 }]}>
                  🔒 Frequência padrão do Plano Free. Varreduras ultra rápidas a cada 15 minutos estão disponíveis no AchôAI Premium.
                </Text>
              </View>
              <TouchableOpacity onPress={openUpgradeModal}>
                <LockBadge text="LIBERAR 15M" />
              </TouchableOpacity>
            </View>
          </Surface>
        ) : (
          <Surface style={styles.formSurface}>
            <Text style={styles.inputTitle}>PRESETS RÁPIDOS</Text>
            <View style={styles.presetsRow}>
              {['15', '30', '60', '120'].map(p => {
                const isSelected = String(intervalo) === p;
                const label = p === '60' ? '1 hora' : p === '120' ? '2 horas' : `${p} min`;
                return (
                  <TouchableOpacity 
                    key={p}
                    style={[styles.presetPill, isSelected && styles.presetPillActive]}
                    onPress={() => setIntervalo(p)}
                  >
                    <Text style={[styles.presetPillText, isSelected && styles.presetPillTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.inputTitle, { marginTop: 12 }]}>INTERVALO MANUAL (MINUTOS)</Text>
            <TextInput 
              style={styles.inputField} 
              placeholder="15" 
              placeholderTextColor={THEME.textSubtle} 
              keyboardType="numeric" 
              value={intervalo} 
              onChangeText={setIntervalo} 
            />
            <Text style={[styles.helperText, { marginTop: 4 }]}>
              Tempo mínimo: 15 minutos (para evitar sobrecarga no servidor).
            </Text>
          </Surface>
        )}

        {/* BOTÃO SALVAR */}
        <View style={{ marginTop: 22 }}>
          <PrimaryButton 
            title={editando ? "Atualizar Radar" : "Salvar e Ativar Radar"} 
            icon={editando ? "save-outline" : "rocket-outline"}
            onPress={salvar}
            loading={salvando}
            size="lg"
          />
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>


      {/* MODAIS DE SUPORTE */}
      <SelectionModal 
        visible={modalEstadoVisivel}
        title="Selecione o Estado (UF)"
        items={LISTA_ESTADOS}
        selectedId={estadoUf}
        onSelect={(item) => {
          setEstadoUf(item.uf);
          let novaRegiao = '';
          if (item.uf === 'BR') {
            novaRegiao = '';
          } else {
            const regs = OLX_ESTADOS[item.uf]?.regioes || [];
            novaRegiao = regs.length > 1 ? regs[1].slug : regs[0]?.slug || '';
          }
          setRegiaoSlug(novaRegiao);
          AsyncStorage.setItem('@achoai_last_olx_location', JSON.stringify({ uf: item.uf, regiaoSlug: novaRegiao })).catch(() => {});
        }}
        onClose={() => setModalEstadoVisivel(false)}
      />

      <SelectionModal 
        visible={modalRegiaoVisivel}
        title={`Regiões de ${OLX_ESTADOS[estadoUf]?.nome}`}
        items={regioesDoEstado}
        selectedId={regiaoSlug}
        onSelect={(item) => {
          setRegiaoSlug(item.slug);
          AsyncStorage.setItem('@achoai_last_olx_location', JSON.stringify({ uf: estadoUf, regiaoSlug: item.slug })).catch(() => {});
        }}
        onClose={() => setModalRegiaoVisivel(false)}
      />

      <Modal visible={modalAvisoNotifVisivel} animationType="fade" transparent={true} onRequestClose={() => setModalAvisoNotifVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <View style={[styles.emptyIconPulseCircle, { marginBottom: 12 }]}>
                <Ionicons name="notifications-off-outline" size={28} color={THEME.primary} />
              </View>
              <Text style={[styles.modalTitle, { textAlign: 'center' }]}>Notificações Desativadas</Text>
              <Text style={styles.modalBodyText}>
                Este aparelho ainda não possui as notificações ativadas para o AchôAI.
              </Text>
              <Text style={[styles.modalBodyText, { color: THEME.text, fontWeight: '500', marginTop: 8 }]}>
                O robô fará as varreduras e salvará as oportunidades, mas você não receberá avisos sonoros na barra de status do celular.
              </Text>
            </View>

            <PrimaryButton 
              title="Ativar Notificações no Aparelho"
              icon="notifications"
              onPress={tentarAtivarNotificacoes}
              loading={ativandoNotif}
              style={{ marginTop: 12 }}
            />

            <TouchableOpacity 
              style={[styles.btnSecondaryTextOnly, { marginTop: 10 }]}
              onPress={() => {
                setModalAvisoNotifVisivel(false);
                executarSalvamento();
              }}
            >
              <Text style={styles.btnSecondaryTextOnlyLabel}>Salvar Mesmo Assim (Sem Avisos Push)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ marginTop: 10, alignItems: 'center', paddingVertical: 6 }}
              onPress={() => setModalAvisoNotifVisivel(false)}
            >
              <Text style={{ color: THEME.textSubtle, fontSize: 12 }}>Voltar ao Formulário</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- TELA 5: CONFIGURAÇÕES & IDENTIDADE ---
function SettingsScreen() {
  const { 
    pushToken, user, fetchData, linkAccount, logoutUser,
    notificacoesAtivas, alternarNotificacoes,
    tier, tierState, trialEligibility, activatingTrial, subscribing,
    openUpgradeModal, handleActivateTrial, handleSubscribePremium,
    showAlert
  } = useContext(RadarContext);

  const [authLoading, setAuthLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    const updateTime = () => {
      if (tierState?.expiresAt) {
        setTimeRemaining(TierService.getRemainingTime(tierState.expiresAt));
      } else {
        setTimeRemaining(null);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, [tierState?.expiresAt]);

  const handleLoginGoogle = async () => {
    try {
      setAuthLoading(true);
      const redirectUrl = makeRedirectUri({
        scheme: 'radarapp',
        path: 'auth/callback',
      });

      const { data, error } = await supabaseAuth.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true
        }
      });
      if (error) {
        showAlert({
          title: "Google Sign-In",
          message: error.message,
          type: "error"
        });
        return;
      }
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          const url = result.url;
          const hashIndex = url.indexOf('#');
          const queryIndex = url.indexOf('?');
          const fragment = hashIndex !== -1 ? url.substring(hashIndex + 1) : queryIndex !== -1 ? url.substring(queryIndex + 1) : '';
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionErr } = await supabaseAuth.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            if (sessionErr) throw sessionErr;
            if (sessionData?.user) {
              await linkAccount(sessionData.user);
            }
            showAlert({
              title: "Conectado!",
              message: "Sua conta Google foi conectada com sucesso.",
              type: "success",
              icon: "checkmark-circle"
            });
          }
        }
      }
    } catch (e) {
      showAlert({
        title: "Configuração do Google",
        message: "Para utilizar o login com o Google, ative o provedor Google no Supabase Dashboard e adicione a URL de retorno às Redirect URLs autorizadas.",
        type: "warning",
        icon: "alert-circle"
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    showAlert({
      title: "Desconectar Conta Google",
      message: "Deseja realmente desconectar? Seus dados serão mantidos com segurança e este aparelho voltará ao modo anônimo local.",
      type: "confirm_warning",
      icon: "log-out-outline",
      confirmText: "Sim, Sair",
      cancelText: "Cancelar",
      showCancel: true,
      onConfirm: async () => {
        await logoutUser();
      }
    });
  };

  const dispararTesteLocal = async () => {
    try {
      const res = await testLocalNotification();
      if (res && res.success === false) {
        showAlert({
          title: "Informação",
          message: res.message,
          type: "info"
        });
      } else {
        showAlert({
          title: "Notificação Enviada!",
          message: "Notificação de teste disparada na barra de status.",
          type: "success",
          icon: "notifications-outline"
        });
      }
    } catch (e) {
      showAlert({
        title: "Aviso",
        message: "Notificações locais requerem o app compilado.",
        type: "warning"
      });
    }
  };


  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />

      {/* TOP HEADER */}
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenHeaderTitle}>Configurações</Text>
          <Text style={styles.screenHeaderSub}>Plano, Conta e Notificações</Text>
        </View>
        <TierBadge tier={tier} size="md" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        
        {/* SEÇÃO 1: MINHA ASSINATURA & PLANO */}
        <SectionHeader title="MINHA ASSINATURA & PLANO" icon="sparkles-outline" />
        <Surface style={styles.settingsCard} elevated>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.settingsItemTitle}>
                {tier === TIERS.ADMIN ? 'Administrador Master' :
                 tier === TIERS.PREMIUM ? 'Plano Premium Ativo' :
                 tier === TIERS.LITE ? 'Teste Grátis (Premium Lite)' : 'Plano Gratuito'}
              </Text>
              <Text style={styles.helperText}>
                {tier === TIERS.ADMIN ? 'Acesso vitalício irrestrito a todas as ferramentas.' :
                 tier === TIERS.PREMIUM ? 'Varreduras sem cooldown, 5 radares e sincronização.' :
                 tier === TIERS.LITE ? 'Aproveite 48 horas completas com todos os benefícios Premium.' :
                 'Monitoramento essencial de 1 radar restrito a este aparelho.'}
              </Text>
            </View>
            <TierBadge tier={tier} size="md" />
          </View>

          {/* Contador de Tempo do Plano */}
          {tier === TIERS.PREMIUM && timeRemaining && (
            <View style={styles.subscriptionTimeBox}>
              <View style={styles.row}>
                <Ionicons 
                  name="time-outline" 
                  size={16} 
                  color={timeRemaining.isExpiringSoon ? THEME.warning : THEME.primary} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[styles.subscriptionTimeText, timeRemaining.isExpiringSoon && { color: THEME.warning }]}>
                  {timeRemaining.days > 0 
                    ? `${timeRemaining.days} dias, ${timeRemaining.hours}h e ${timeRemaining.minutes}m restantes`
                    : `${timeRemaining.hours}h e ${timeRemaining.minutes}m restantes`}
                </Text>
              </View>
              {timeRemaining.isExpiringSoon && (
                <View style={styles.expiringSoonAlert}>
                  <Ionicons name="alert-circle" size={14} color={THEME.warning} style={{ marginRight: 6 }} />
                  <Text style={styles.expiringSoonText}>
                    Sua assinatura expira em breve! Renove agora para manter seus radares adicionais ativos.
                  </Text>
                </View>
              )}
            </View>
          )}

          {tier === TIERS.LITE && timeRemaining && (
            <View style={styles.subscriptionTimeBox}>
              <View style={styles.row}>
                <Ionicons name="hourglass-outline" size={16} color={THEME.primary} style={{ marginRight: 6 }} />
                <Text style={styles.subscriptionTimeText}>
                  {timeRemaining.hours > 0 
                    ? `${timeRemaining.hours} horas e ${timeRemaining.minutes} minutos restantes`
                    : `${timeRemaining.minutes} minutos restantes`}
                </Text>
              </View>
              <Text style={styles.trialInfoSub}>
                Após o término das 48h, sua conta voltará automaticamente ao plano Free.
              </Text>
            </View>
          )}

          {tier === TIERS.ADMIN && (
            <View style={styles.adminPerksBox}>
              <Ionicons name="shield-checkmark" size={16} color={THEME.success} style={{ marginRight: 8 }} />
              <Text style={styles.adminPerksText}>
                Acesso Vitalício Irrestrito • Radares Ilimitados • Sem Cooldown
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* Botões de Ação de Assinatura */}
          {tier === TIERS.FREE && (
            <View>
              <TouchableOpacity 
                style={styles.btnUpgradeSaaS}
                onPress={handleSubscribePremium}
                activeOpacity={0.85}
                disabled={subscribing}
              >
                {subscribing ? (
                  <ActivityIndicator size="small" color="#08090D" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#08090D" style={{ marginRight: 8 }} />
                    <Text style={styles.btnUpgradeSaaSText}>Assinar Premium (R$ 39,90/mês)</Text>
                  </>
                )}
              </TouchableOpacity>

              {trialEligibility?.canActivate && (
                <TouchableOpacity 
                  style={styles.btnTrialSaaS}
                  onPress={handleActivateTrial}
                  activeOpacity={0.8}
                  disabled={activatingTrial}
                >
                  {activatingTrial ? (
                    <ActivityIndicator size="small" color={THEME.primary} />
                  ) : (
                    <>
                      <Ionicons name="gift-outline" size={15} color={THEME.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.btnTrialSaaSText}>Ativar 2 Dias Grátis (Premium Lite)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {tier === TIERS.LITE && (
            <TouchableOpacity 
              style={styles.btnUpgradeSaaS}
              onPress={handleSubscribePremium}
              activeOpacity={0.85}
              disabled={subscribing}
            >
              {subscribing ? (
                <ActivityIndicator size="small" color="#08090D" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color="#08090D" style={{ marginRight: 8 }} />
                  <Text style={styles.btnUpgradeSaaSText}>Garantir Assinatura Premium (R$ 39,90/mês)</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {tier === TIERS.PREMIUM && (
            <TouchableOpacity 
              style={[styles.btnUpgradeSaaS, timeRemaining?.isExpiringSoon && { backgroundColor: THEME.warning }]}
              onPress={handleSubscribePremium}
              activeOpacity={0.85}
              disabled={subscribing}
            >
              {subscribing ? (
                <ActivityIndicator size="small" color="#08090D" />
              ) : (
                <>
                  <Ionicons name="repeat" size={16} color="#08090D" style={{ marginRight: 8 }} />
                  <Text style={styles.btnUpgradeSaaSText}>Renovar Assinatura (R$ 39,90/mês)</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </Surface>

        {/* SEÇÃO 2: IDENTIDADE & CONTA GOOGLE */}
        <SectionHeader title="IDENTIDADE E CONTA" icon="person-circle-outline" />

        {user ? (
          <Surface style={styles.settingsCard} elevated>
            <View style={styles.rowBetween}>
              <View style={[styles.row, { flex: 1, marginRight: 10 }]}>
                <View style={styles.userAvatarBox}>
                  <Ionicons name="person" size={18} color={THEME.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.userEmailText} numberOfLines={1}>{user.email}</Text>
                  <Text style={styles.userProviderText}>Conta Google Conectada</Text>
                </View>
              </View>
              <View style={[styles.badgeSuccessPill, { flexShrink: 0 }]}>
                <View style={styles.badgeSuccessDot} />
                <Text style={styles.badgeSuccessPillText}>CONECTADO</Text>
              </View>
            </View>

            <View style={styles.divider} />
            
            {tier === TIERS.FREE ? (
              <View style={styles.deviceNoticeBox}>
                <Ionicons name="phone-portrait-outline" size={16} color={THEME.textMuted} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.deviceNoticeText}>
                  <Text style={{ fontWeight: 'bold', color: THEME.text }}>Modo Dispositivo Único (Free): </Text>
                  Seus radares e notificações ficam salvos exclusivamente neste aparelho. Para sincronizar em múltiplos dispositivos, ative o plano Premium.
                </Text>
              </View>
            ) : (
              <View style={styles.syncNoticeBox}>
                <Ionicons name="cloud-done-outline" size={16} color={THEME.success} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.syncNoticeText}>
                  <Text style={{ fontWeight: 'bold', color: THEME.text }}>Sincronização em Nuvem Ativa: </Text>
                  Seus radares e oportunidades são sincronizados automaticamente em tempo real em todos os seus aparelhos conectados.
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.btnLogoutModern}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={15} color={THEME.danger} style={{ marginRight: 6 }} />
              <Text style={styles.btnLogoutModernText}>Desconectar Conta Google</Text>
            </TouchableOpacity>
          </Surface>
        ) : (
          <Surface style={styles.settingsCard} elevated>
            <Text style={styles.syncDescText}>
              Conecte sua conta Google com 1 clique para gerenciar sua assinatura e usufruir da sincronização em nuvem caso seja assinante Premium.
            </Text>

            <TouchableOpacity 
              style={styles.btnGoogleModern}
              onPress={handleLoginGoogle}
              activeOpacity={0.85}
              disabled={authLoading}
            >
              {authLoading ? (
                <ActivityIndicator size="small" color="#08090D" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color="#08090D" style={{ marginRight: 10 }} />
                  <Text style={styles.btnGoogleModernText}>Continuar com o Google</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.helperText, { textAlign: 'center', marginTop: 4 }]}>
              Login rápido e seguro sem formulários ou senhas.
            </Text>
          </Surface>
        )}

        {/* SEÇÃO 3: MOTOR DE VARREDURA */}
        <SectionHeader title="MOTOR DE VARREDURA" icon="hardware-chip-outline" />
        <Surface style={styles.settingsCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.settingsItemTitle}>Servidor de Varredura</Text>
              <Text style={styles.settingsItemSub}>Online e Operante</Text>
            </View>
            <View style={styles.badgeSuccessPill}>
              <View style={styles.badgeSuccessDot} />
              <Text style={styles.badgeSuccessPillText}>ONLINE</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.helperText}>
            • Responsável pelo processamento autônomo e varredura periódica de anúncios e ofertas na internet.
          </Text>
        </Surface>

        {/* SEÇÃO 5: NOTIFICAÇÕES */}
        <SectionHeader title="NOTIFICAÇÕES DO DISPOSITIVO" icon="notifications-outline" />
        <Surface style={styles.settingsCard}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.settingsItemTitle}>Alertas na Barra de Status</Text>
              <Text style={styles.helperText}>
                Notificar imediatamente sempre que uma nova oportunidade for capturada.
              </Text>
            </View>
            <Switch 
              value={notificacoesAtivas}
              onValueChange={alternarNotificacoes}
              trackColor={{ false: '#1E2333', true: THEME.primary }}
              thumbColor="#FFF"
            />
          </View>

          {checkIsExpoGo() && (
            <View style={styles.infoNoticeBanner}>
              <Ionicons name="information-circle" size={16} color={THEME.warning} style={{ marginRight: 6 }} />
              <Text style={styles.infoNoticeText}>
                Em ambiente Expo Go, notificações em segundo plano têm restrições no Android 13+. No APK final, operam 100%.
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.btnTestNotification}
            onPress={dispararTesteLocal}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={15} color={THEME.primary} style={{ marginRight: 6 }} />
            <Text style={styles.btnTestNotificationText}>Testar Notificação Local</Text>
          </TouchableOpacity>
        </Surface>

        {/* SEÇÃO 6: SOBRE O ACHÔAI */}
        <SectionHeader title="SOBRE O ACHÔAI" icon="information-circle-outline" />
        <Surface style={styles.settingsCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.settingsItemTitle, { fontSize: 16, fontWeight: 'bold' }]}>AchôAI</Text>
              <Text style={styles.helperText}>Monitoramento inteligente de anúncios e ofertas</Text>
            </View>
            <View style={[styles.badgeSuccessPill, { backgroundColor: THEME.primaryGlow }]}>
              <Text style={[styles.badgeSuccessPillText, { color: THEME.primary }]}>PRODUÇÃO</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={styles.aboutMetaLabel}>Versão do App</Text>
            <Text style={styles.aboutMetaValue}>1.0.0 (Build 2026 SaaS)</Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: 6 }]}>
            <Text style={styles.aboutMetaLabel}>Fontes Integradas</Text>
            <Text style={styles.aboutMetaValue}>OLX, Facebook, Zoom & Web</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.aboutCopyrightText}>
            AchôAI © 2026. Todos os direitos reservados.
          </Text>
        </Surface>

        <View style={{ height: 90 }} />
      </ScrollView>

    </View>
  );
}

// =====================================================================
// 5. NAVEGAÇÃO MODERNA 2026 (BOTTOM TABS & STACK)
// =====================================================================

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const { resultados } = useContext(RadarContext);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 24);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: [
          styles.bottomTabBar,
          {
            height: 58 + bottomInset,
            paddingBottom: bottomInset,
          }
        ],
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.textSubtle,
        tabBarLabelStyle: styles.bottomTabLabel,
        tabBarItemStyle: {
          paddingTop: 6,
          paddingBottom: 2,
        },
        tabBarIcon: ({ color, focused }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Radares') iconName = focused ? 'radio' : 'radio-outline';
          else if (route.name === 'Alertas') iconName = focused ? 'notifications' : 'notifications-outline';
          else if (route.name === 'Config') iconName = focused ? 'settings' : 'settings-outline';
          return (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapFocused]}>
              <Ionicons name={iconName} size={20} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Radares" component={MonitorListScreen} />
      <Tab.Screen 
        name="Alertas" 
        component={AlertsScreen} 
        options={{
          tabBarBadge: resultados.length > 0 ? (resultados.length > 99 ? '99+' : resultados.length) : undefined,
          tabBarBadgeStyle: styles.tabBadgeStyle
        }}
      />
      <Tab.Screen name="Config" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const customTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: THEME.bg,
      card: THEME.cardBg,
      text: THEME.text,
      border: THEME.cardBorder,
      primary: THEME.primary
    },
  };

  return (
    <SafeAreaProvider>
      <RadarProvider>
        <NavigationContainer theme={customTheme}>
          <Stack.Navigator screenOptions={{ 
            headerStyle: { backgroundColor: THEME.bgSecondary }, 
            headerTintColor: THEME.primary,
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: 'bold', fontSize: 16 }
          }}>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen 
              name="Criar" 
              component={CreateMonitorScreen} 
              options={{ 
                title: 'Configurar Radar',
                presentation: 'modal',
                animation: 'slide_from_bottom' 
              }} 
            />
          </Stack.Navigator>
        </NavigationContainer>
      </RadarProvider>
    </SafeAreaProvider>
  );
}

// =====================================================================
// 6. ESTILOS MODERNOS (EDITION 2026)
// =====================================================================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  scrollArea: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 60 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Brand Header (Home)
  brandHeader: {
    paddingTop: Platform.OS === 'android' ? 44 : 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: THEME.cardBorder
  },
  brandGroup: { flexDirection: 'row', alignItems: 'center' },
  brandLogoImage: {
    width: 44,
    height: 44,
    marginRight: 10
  },
  brandTextGroup: { justifyContent: 'center' },
  brandName: { fontSize: 20, fontWeight: '900', color: THEME.text, letterSpacing: 0.4 },
  livePulseRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  livePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.success, marginRight: 5 },
  livePulseText: { fontSize: 10, fontWeight: '600', color: THEME.success, letterSpacing: 0.3 },
  btnHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm
  },
  btnHeaderActionText: { fontSize: 12, fontWeight: '800', color: '#08090D' },

  // Screen Headers (Telas Secundárias)
  screenHeader: {
    paddingTop: Platform.OS === 'android' ? 44 : 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: THEME.cardBorder
  },
  screenHeaderTitle: { fontSize: 20, fontWeight: '900', color: THEME.text, letterSpacing: 0.3 },
  screenHeaderSub: { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
  headerBtnSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.cardBgElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    alignItems: 'center',
    justifyContent: 'center'
  },

  // Métricas
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },

  // Oportunidades (Home)
  opportunityCard: { padding: 14, marginBottom: 10 },
  opportunityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  opportunityHeaderTags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1, marginRight: 8 },
  opportunityDate: { fontSize: 11, color: THEME.textSubtle },
  opportunityTitle: { fontSize: 14, fontWeight: '700', color: THEME.text, lineHeight: 19 },
  opportunityFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: THEME.cardBorder },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline' },
  pricePrefix: { fontSize: 11, fontWeight: '700', color: THEME.success, marginRight: 3 },
  priceNumber: { fontSize: 17, fontWeight: '900', color: THEME.success },
  priceConsult: { fontSize: 13, fontWeight: '600', color: THEME.textMuted },
  btnOpenOffer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primaryGlow,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.3)'
  },
  btnOpenOfferText: { fontSize: 11, fontWeight: '700', color: THEME.primary },

  // Telemetria (Logs)
  telemetryCard: { padding: 14 },
  telemetryTargetContainer: { width: '100%' },
  telemetryEmpty: { alignItems: 'center', paddingVertical: 15 },
  telemetryRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.cardBorder },
  telemetryDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 5, marginRight: 10 },
  telemetryMessage: { fontSize: 12, color: THEME.textSecondary, lineHeight: 17 },
  telemetryMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  telemetryTime: { fontSize: 10, color: THEME.textSubtle },
  telemetrySeparator: { fontSize: 10, color: THEME.textSubtle, marginHorizontal: 5 },
  telemetrySource: { fontSize: 10, color: THEME.textMuted },

  // Frosted Glass Overlays (Home Telemetria)
  frostedOverlay: {
    backgroundColor: 'rgba(17, 20, 29, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  frostedLockContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  frostedLockCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4
  },
  frostedLockTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.text,
    textAlign: 'center',
    marginBottom: 4
  },
  frostedLockSub: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12
  },
  btnFrostedUnlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: THEME.radius.sm
  },
  btnFrostedUnlockText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#08090D'
  },

  // Controles de Varredura (Home Emergency Controls)
  emergencyControlsCard: {
    padding: 16,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    backgroundColor: THEME.cardBg,
    marginTop: 4,
    marginBottom: 8
  },
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  statusIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  emergencyStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text
  },
  emergencyCardDesc: {
    fontSize: 12,
    color: THEME.textSubtle,
    lineHeight: 17,
    marginBottom: 14
  },
  emergencyButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  btnEmergencyAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1
  },
  btnPauseMode: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)'
  },
  btnResumeMode: {
    backgroundColor: THEME.primaryGlow,
    borderColor: THEME.primary
  },
  btnStopMode: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)'
  },
  btnEmergencyText: {
    fontSize: 13,
    fontWeight: '700'
  },

  // Frosted Glass Overlays (Aba Alertas Completa)
  alertsTargetContainer: { width: '100%' },
  alertsFrostedOverlay: {
    backgroundColor: 'rgba(8, 9, 13, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10
  },
  blurredTextTitle: {
    color: 'transparent',
    textShadowColor: 'rgba(240, 242, 248, 0.40)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 11,
  },
  blurredPrice: {
    color: 'transparent',
    textShadowColor: 'rgba(16, 185, 129, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 13,
  },
  blurredTime: {
    color: 'transparent',
    textShadowColor: 'rgba(148, 163, 184, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  blurredTelemetryMessage: {
    color: 'transparent',
    textShadowColor: 'rgba(240, 242, 248, 0.40)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  },
  btnAlertActionLocked: {
    backgroundColor: THEME.cardBgElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  btnAlertActionLockedText: {
    color: THEME.textMuted,
    fontWeight: '700',
  },
  alertsLockCard: {
    backgroundColor: 'rgba(17, 20, 29, 0.94)',
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.35)',
    padding: 22,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8
  },
  alertsLockIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5
  },
  alertsLockTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.text,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 8
  },
  alertsLockSub: {
    fontSize: 13,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18
  },
  btnAlertsUnlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: THEME.radius.md,
    width: '100%',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4
  },
  btnAlertsUnlockText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#08090D',
    letterSpacing: 0.3
  },

  // Cards de Radar (Aba 2)
  radarCard: { padding: 15, marginBottom: 12 },
  radarCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  radarModeIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radarTitle: { fontSize: 15, fontWeight: '800', color: THEME.text },
  radarTagsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
  locationChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  locationChipText: { fontSize: 10, color: THEME.textMuted, fontWeight: '600' },
  radarSearchTermBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  radarSearchTermText: { fontSize: 12, color: THEME.textSecondary, fontWeight: '600' },
  radarCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.cardBorder },
  radarFrequencyLabel: { fontSize: 11, color: THEME.textMuted },
  radarCountdownRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  radarCountdownText: { fontSize: 12, fontWeight: '700', color: THEME.primary },
  radarActionsGroup: { flexDirection: 'row', alignItems: 'center' },
  btnScanNow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: THEME.radius.sm
  },
  btnScanNowText: { fontSize: 11, fontWeight: '900', color: '#08090D' },
  fabGlow: {
    position: 'absolute',
    bottom: 22,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10
  },

  // Busca e Filtros (Aba Alertas)
  searchBarContainer: { paddingHorizontal: 16, paddingTop: 10 },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBgElevated,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  searchInput: { flex: 1, fontSize: 13, color: THEME.text, padding: 0 },
  filterChipRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.cardBgElevated,
    marginRight: 6,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  filterChipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  filterChipText: { fontSize: 11, fontWeight: '700', color: THEME.textMuted },
  filterChipTextActive: { color: '#08090D' },

  // Cards de Alerta Completo (Aba Alertas)
  alertCardFull: { padding: 15, marginBottom: 12 },
  alertHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertHeaderTagsWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1, marginRight: 8 },
  robotTag: { flexDirection: 'row', alignItems: 'center', marginLeft: 6 },
  robotTagText: { fontSize: 10, color: THEME.success, fontWeight: '700' },
  alertTime: { fontSize: 11, color: THEME.textSubtle },
  alertTitleFull: { fontSize: 15, fontWeight: '700', color: THEME.text, marginVertical: 8, lineHeight: 21 },
  alertPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: THEME.cardBorder },
  alertPriceLabel: { fontSize: 9, fontWeight: '800', color: THEME.textSubtle, letterSpacing: 0.5 },
  alertPriceValue: { fontSize: 19, fontWeight: '900', color: THEME.success, marginTop: 2 },
  btnAlertAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: THEME.radius.sm
  },
  btnAlertActionText: { fontSize: 11, fontWeight: '900', color: '#08090D' },

  // Formulário de Criação (Aba Criar)
  editNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primaryGlow,
    padding: 10,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.cardBorderActive,
    marginBottom: 12
  },
  editNoticeText: { fontSize: 12, fontWeight: '700', color: THEME.primary },
  formSectionTitle: { fontSize: 11, fontWeight: '800', color: THEME.textMuted, letterSpacing: 1, marginBottom: 8 },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  platformCardBtn: {
    width: '48%',
    backgroundColor: THEME.cardBg,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8
  },
  platformCardBtnActive: { borderColor: THEME.primary, backgroundColor: THEME.primaryGlow },
  platformIconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  platformCardBtnText: { fontSize: 12, fontWeight: '700', color: THEME.textSecondary },
  platformCardBtnTextActive: { color: THEME.primary, fontWeight: '800' },
  comparatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primaryGlow,
    padding: 10,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,122,0,0.2)',
    marginBottom: 10
  },
  comparatorBannerText: { flex: 1, fontSize: 11, color: THEME.textSecondary, lineHeight: 16 },
  formSurface: { padding: 14, marginBottom: 14 },
  selectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBgElevated,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  selectBtnLabel: { fontSize: 9, fontWeight: '800', color: THEME.textSubtle, letterSpacing: 0.5 },
  selectBtnValue: { fontSize: 12, fontWeight: '700', color: THEME.text, marginTop: 2 },
  urlPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  urlPreviewText: { fontSize: 11, color: THEME.textSubtle, flex: 1 },
  segmentWrap: { flexDirection: 'row', backgroundColor: THEME.cardBgElevated, borderRadius: THEME.radius.sm, padding: 3, marginBottom: 12 },
  segmentOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 6 },
  segmentOptionActive: { backgroundColor: THEME.primary },
  segmentLabel: { fontSize: 12, color: THEME.textMuted, fontWeight: '600' },
  segmentLabelActive: { color: '#08090D', fontWeight: '800' },
  inputTitle: { fontSize: 10, fontWeight: '800', color: THEME.textSubtle, letterSpacing: 0.6, marginBottom: 6 },
  inputField: {
    backgroundColor: THEME.cardBgElevated,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.text,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  helperText: { fontSize: 11, color: THEME.textSubtle, marginTop: 5, lineHeight: 16 },

  // Cards de Estratégia
  strategyCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 14,
    marginBottom: 10
  },
  strategyCardActive: { borderColor: THEME.primary, backgroundColor: THEME.cardBgElevated },
  strategyHeader: { flexDirection: 'row', alignItems: 'center' },
  strategyIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: THEME.cardBgElevated, alignItems: 'center', justifyContent: 'center' },
  strategyIconCircleActive: { backgroundColor: THEME.primaryGlow },
  strategyTitle: { fontSize: 13, fontWeight: '700', color: THEME.textSecondary },
  strategyTitleActive: { color: THEME.primary, fontWeight: '800' },
  strategyDesc: { fontSize: 11, color: THEME.textMuted, marginTop: 2, lineHeight: 16 },
  strategyExtraBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.cardBorder },
  sortToggleTitle: { fontSize: 12, fontWeight: '700', color: THEME.textSecondary },
  sortToggleDesc: { fontSize: 10, color: THEME.textSubtle, marginTop: 2 },
  targetPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primaryGlow,
    padding: 9,
    borderRadius: THEME.radius.sm,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,122,0,0.3)'
  },
  targetPreviewText: { fontSize: 11, color: THEME.textSecondary },

  // Shopee Procedência Options
  shopeeOptionsCard: {
    padding: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(238, 77, 45, 0.35)',
    backgroundColor: 'rgba(238, 77, 45, 0.05)',
    marginTop: 10,
    marginBottom: 12
  },
  shopeeOptionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  shopeeOptionsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EE4D2D',
    letterSpacing: 0.8
  },
  shopeeOptionsDesc: {
    fontSize: 11,
    color: THEME.textMuted,
    marginBottom: 10,
    lineHeight: 15
  },
  checkboxContainer: {
    gap: 8
  },
  checkboxRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBgElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: THEME.radius.sm,
    padding: 10
  },
  checkboxRowItemActive: {
    borderColor: 'rgba(238, 77, 45, 0.5)',
    backgroundColor: 'rgba(238, 77, 45, 0.08)'
  },
  checkboxItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
    marginRight: 6
  },
  checkboxItemTitleActive: {
    color: '#FFF'
  },
  checkboxItemSub: {
    fontSize: 10,
    color: THEME.textSubtle,
    marginTop: 1
  },
  miniOriginBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1
  },

  // Presets de Frequência
  presetsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  presetPill: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 7,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.cardBgElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  presetPillActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  presetPillText: { fontSize: 11, fontWeight: '700', color: THEME.textMuted },
  presetPillTextActive: { color: '#08090D', fontWeight: '800' },

  // Configurações
  settingsCard: { padding: 16, marginBottom: 14 },
  userAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.primaryGlow,
    borderWidth: 1,
    borderColor: THEME.cardBorderActive,
    alignItems: 'center',
    justifyContent: 'center'
  },
  userEmailText: { fontSize: 14, fontWeight: '800', color: THEME.text },
  userProviderText: { fontSize: 11, color: THEME.textMuted, marginTop: 2 },
  badgeSuccessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  badgeSuccessDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: THEME.success, marginRight: 5 },
  badgeSuccessPillText: { fontSize: 10, fontWeight: '800', color: THEME.success },
  syncDescText: { fontSize: 12, color: THEME.textMuted, lineHeight: 18, marginBottom: 10 },
  divider: { height: 1, backgroundColor: THEME.cardBorder, marginVertical: 12 },
  btnLogoutModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.dangerBg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: THEME.radius.sm,
    paddingVertical: 10,
    marginTop: 4
  },
  btnLogoutModernText: { fontSize: 12, fontWeight: '800', color: THEME.danger },
  btnGoogleModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.radius.sm,
    paddingVertical: 12,
    marginBottom: 4
  },
  btnGoogleModernText: { fontSize: 13, fontWeight: '700', color: '#08090D' },
  subscriptionTimeBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: THEME.radius.sm,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  subscriptionTimeText: { fontSize: 13, fontWeight: '800', color: THEME.primary },
  expiringSoonAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.warningBg,
    padding: 8,
    borderRadius: THEME.radius.xs,
    marginTop: 8
  },
  expiringSoonText: { flex: 1, fontSize: 11, color: THEME.warning, fontWeight: '600', lineHeight: 15 },
  trialInfoSub: { fontSize: 11, color: THEME.textSubtle, marginTop: 4 },
  adminPerksBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.successBg,
    padding: 10,
    borderRadius: THEME.radius.sm,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  adminPerksText: { flex: 1, fontSize: 11, color: THEME.success, fontWeight: '700' },
  btnUpgradeSaaS: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    borderRadius: THEME.radius.sm,
    paddingVertical: 12,
    marginBottom: 8
  },
  btnUpgradeSaaSText: { fontSize: 13, fontWeight: '900', color: '#08090D' },
  btnTrialSaaS: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.cardBgElevated,
    borderWidth: 1,
    borderColor: THEME.primary,
    borderRadius: THEME.radius.sm,
    paddingVertical: 10
  },
  btnTrialSaaSText: { fontSize: 12, fontWeight: '800', color: THEME.primary },
  deviceNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: THEME.radius.sm,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  deviceNoticeText: { flex: 1, fontSize: 11, color: THEME.textMuted, lineHeight: 16 },
  syncNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.successBg,
    borderRadius: THEME.radius.sm,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)'
  },
  syncNoticeText: { flex: 1, fontSize: 11, color: THEME.textSecondary, lineHeight: 16 },
  settingsItemTitle: { fontSize: 14, fontWeight: '700', color: THEME.text },
  settingsItemSub: { fontSize: 11, color: THEME.success, marginTop: 2, fontWeight: '600' },
  infoNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.warningBg,
    padding: 10,
    borderRadius: THEME.radius.sm,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  infoNoticeText: { flex: 1, fontSize: 11, color: THEME.warning, lineHeight: 16 },
  btnTestNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: THEME.cardBgElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12
  },
  btnTestNotificationText: { fontSize: 12, fontWeight: '700', color: THEME.primary },
  aboutMetaLabel: { fontSize: 12, color: THEME.textMuted },
  aboutMetaValue: { fontSize: 12, fontWeight: '700', color: THEME.text },
  aboutCopyrightText: { fontSize: 11, color: THEME.textSubtle, textAlign: 'center' },

  // Modais
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: {
    backgroundColor: THEME.cardBg,
    borderRadius: THEME.radius.lg,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 18
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: THEME.text },
  modalCloseBtn: { padding: 4 },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBgElevated,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  modalSearchInput: { flex: 1, color: THEME.text, fontSize: 13, padding: 0 },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.cardBorder
  },
  modalItemSelected: { backgroundColor: THEME.cardBgElevated, borderRadius: THEME.radius.sm },
  modalItemText: { fontSize: 13, color: THEME.textSecondary },
  modalItemTextSelected: { color: THEME.primary, fontWeight: '800' },
  modalBodyText: { fontSize: 12, color: THEME.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 4 },
  btnSecondaryTextOnly: { alignItems: 'center', paddingVertical: 8 },
  btnSecondaryTextOnlyLabel: { fontSize: 12, color: THEME.textMuted, fontWeight: '600' },

  // Estados Vazios
  emptyCard: { alignItems: 'center', padding: 25, marginTop: 4 },
  emptyIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: THEME.primaryGlow, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyCardTitle: { fontSize: 14, fontWeight: '800', color: THEME.text, marginBottom: 4 },
  emptyCardSub: { fontSize: 12, color: THEME.textSubtle, textAlign: 'center', lineHeight: 17 },
  emptyFullState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, marginTop: 60 },
  emptyIconPulseCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.cardBgElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  emptyStateTitle: { fontSize: 17, fontWeight: '800', color: THEME.text, marginBottom: 6, textAlign: 'center' },
  emptyStateSub: { fontSize: 13, color: THEME.textMuted, textAlign: 'center', lineHeight: 19 },

  // Barra de Navegação Inferior
  bottomTabBar: {
    backgroundColor: THEME.bgSecondary,
    borderTopColor: THEME.cardBorder,
    borderTopWidth: 1,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  bottomTabLabel: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  tabIconWrap: { width: 36, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  tabIconWrapFocused: { backgroundColor: THEME.primaryGlow },
  tabBadgeStyle: {
    backgroundColor: THEME.primary,
    color: '#08090D',
    fontSize: 10,
    fontWeight: '900',
    minWidth: 18,
    height: 18,
    borderRadius: 9
  }
});