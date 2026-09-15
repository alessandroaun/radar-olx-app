import React, { useState, useEffect, createContext, useContext, useCallback, useRef, useMemo } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, 
  Alert, Platform, StatusBar, ActivityIndicator, Switch, Dimensions, 
  Linking, RefreshControl, Modal, FlatList, Image, Vibration, 
  Animated, Easing, KeyboardAvoidingView 
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';

import { supabase, supabaseAuth } from './supabase'; 
import { setupNotifications, registerPushToken, testLocalNotification, subscribeNotificationEvents, checkIsExpoGo } from './notificationService';
import { OLX_ESTADOS, LISTA_ESTADOS, gerarUrlOlx, FACEBOOK_ESTADOS_CIDADES, LISTA_ESTADOS_FACEBOOK, FACEBOOK_REGIOES, gerarUrlFacebook } from './olxData';
import { getOrCreateDeviceId, registerDeviceInSupabase, migrateDeviceMonitorsToAccount, resetDeviceOnLogout } from './deviceService';
import { THEME } from './theme';
import { 
  AppTopHeader, Surface, PrimaryButton, IconButton, StatusBadge, PlatformBadge, 
  StrategyBadge, SectionHeader, MetricBox, TierBadge,
  StoreLogoBadge, ProductDealCard, PlatformCircle, PlatformBubble, FrequencySelector,
  ShopeeOriginBadge, ShopeeDiscountBadge, ShopeeRatingBadge, parseShopeeInfo,
  MLFullBadge, MLFreeShippingBadge, MLDiscountBadge, parseMLInfo,
  AmazonPrimeBadge, AmazonFreeShippingBadge, AmazonDiscountBadge, parseAmazonInfo,
  MagaluFullBadge, MagaluFreeShippingBadge, MagaluDiscountBadge, parseMagaluInfo,
  KabumFreeShippingBadge, KabumDiscountBadge, parseKabumInfo,
  AmericanasFastDeliveryBadge, AmericanasFreeShippingBadge, AmericanasDiscountBadge, parseAmericanasInfo,
  SheinBestSellerBadge, SheinDiscountBadge, parseSheinInfo,
  FastShopDiscountBadge, parseFastShopInfo,
  CarrefourFreeShippingBadge, CarrefourInstallmentBadge, CarrefourDiscountBadge, CarrefourBestSellerBadge, parseCarrefourInfo,
  CasasBahiaFreeShippingBadge, CasasBahiaInstallmentBadge, CasasBahiaDiscountBadge, CasasBahiaBestSellerBadge, parseCasasBahiaInfo
} from './components';
import { RecommendationEngine, LOJAS_RECOMENDACOES, calcularFreteGratisInfo } from './recommendationService';
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
    // Isolamento estrito: Meus Radares exibe exclusivamente os radares criados pelo usuário
    query = query.neq('modo', 'pesquisa_inteligente').neq('modo', 'promocoes').neq('modo', 'recomendacoes');
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).filter(m => 
      m.modo !== 'pesquisa_inteligente' && 
      m.modo !== 'promocoes' && 
      m.modo !== 'recomendacoes' &&
      !m.nome?.startsWith('Pesquisa:') &&
      !m.produto?.startsWith('Pesquisa:') &&
      !m.produto?.startsWith('SISTEMA_') &&
      !m.nome?.startsWith('SISTEMA_')
    );
  }

  static async createMonitor(dados) {
    const payload = { ...dados };
    try {
      const { data, error } = await supabase.from('monitores').insert([payload]).select();
      if (error) throw error;
      return data ? data[0] : null;
    } catch (err) {
      if (err?.code === 'PGRST204' || String(err?.message || '').includes('column')) {
        delete payload.notificar_por_loja;
        const { data, error } = await supabase.from('monitores').insert([payload]).select();
        if (error) throw error;
        return data ? data[0] : null;
      }
      throw err;
    }
  }

  static async updateMonitor(id, dados) {
    const payload = { ...dados };
    try {
      const { data, error } = await supabase.from('monitores').update(payload).eq('id', id).select();
      if (error) throw error;
      return data ? data[0] : null;
    } catch (err) {
      if (err?.code === 'PGRST204' || String(err?.message || '').includes('column')) {
        delete payload.notificar_por_loja;
        const { data, error } = await supabase.from('monitores').update(payload).eq('id', id).select();
        if (error) throw error;
        return data ? data[0] : null;
      }
      throw err;
    }
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
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const notifInitializedRef = useRef(false);

  // Carrega perfil salvo no cache local do aparelho
  useEffect(() => {
    AsyncStorage.getItem('@achoai_user_profile_cache').then(cached => {
      if (cached) {
        try {
          setUserProfile(JSON.parse(cached));
        } catch (e) {}
      }
    });
  }, []);

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

      if (!notifInitializedRef.current && dadosResultados && dadosResultados.length > 0) {
        setUnreadNotifCount(dadosResultados.length);
        notifInitializedRef.current = true;
      } else if (dadosResultados && dadosResultados.length > lastResultsCountRef.current && hasLoadedRef.current) {
        setUnreadNotifCount(prev => prev + (dadosResultados.length - lastResultsCountRef.current));
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

    // Se acabou de expirar, recarrega dados sem pausar nenhum radar nem travar usuário
    if (state.justExpired) {
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

      // Salva nome e foto estritamente na memória cache do aparelho (NUNCA no banco)
      const fullName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '';
      const firstName = fullName ? fullName.trim().split(' ')[0] : (authUser?.email ? authUser.email.split('@')[0] : '');
      const photoUrl = authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || null;
      const perfil = { name: firstName, photoUrl };
      setUserProfile(perfil);
      await AsyncStorage.setItem('@achoai_user_profile_cache', JSON.stringify(perfil));

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
      setUserProfile(null);
      await AsyncStorage.removeItem('@achoai_user_profile_cache');

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

    // 3. Limite de varredura: Equalizado sem cooldown para todos os usuários

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

      // Sem cooldown de 60m para Free: igualado a Premium

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

  // Abertura de ofertas: Link externo direto para todos os usuários (Free e Premium)
  const handleOpenAd = useCallback((item) => {
    if (!item) return;
    const targetUrl = item.url || item.link;
    if (targetUrl) {
      Linking.openURL(formatarUrlAfiliado(targetUrl)).catch(() => showAlert({
        title: "Aviso",
        message: "Não foi possível abrir o link da oferta.",
        type: "error"
      }));
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
        const fullName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '';
        const firstName = fullName ? fullName.trim().split(' ')[0] : (authUser?.email ? authUser.email.split('@')[0] : '');
        const photoUrl = authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || null;
        const perfil = { name: firstName, photoUrl };
        setUserProfile(perfil);
        AsyncStorage.setItem('@achoai_user_profile_cache', JSON.stringify(perfil)).catch(() => {});
        await refreshTierState(currentDevId, authUser);
        if (tierRef.current === TIERS.PREMIUM || tierRef.current === TIERS.ADMIN) {
          await migrateDeviceMonitorsToAccount(currentDevId, authUser.id, currentToken);
        }
        fetchData(null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        userRef.current = null;
        setUserProfile(null);
        AsyncStorage.removeItem('@achoai_user_profile_cache').catch(() => {});
        setMonitores([]);
        setResultados([]);
        setAtividades([]);
      }
    });

    const unsubscribeEvents = subscribeNotificationEvents(
      () => { fetchData(null, true); },
      (response) => {
        const data = response?.notification?.request?.content?.data;
        const targetUrl = data?.url || data?.link;
        if (targetUrl) {
          Linking.openURL(formatarUrlAfiliado(targetUrl)).catch((err) => {
            console.log('[Radar] Erro ao abrir URL da notificação push:', err);
          });
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
            setUnreadNotifCount(prev => prev + 1);
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

  const openNotif = useCallback(() => {
    setNotifModalVisible(true);
    setUnreadNotifCount(0);
  }, []);

  const closeNotif = useCallback(() => {
    setNotifModalVisible(false);
  }, []);

  const openSettings = useCallback(() => {
    setSettingsModalVisible(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsModalVisible(false);
  }, []);

  const openAuthModal = useCallback(() => {
    setAuthModalVisible(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalVisible(false);
  }, []);

  const limparNotificacoes = useCallback(async () => {
    setResultados([]);
    setUnreadNotifCount(0);
    showAlert({
      title: "Notificações Limpas",
      message: "Todas as notificações foram limpas com sucesso.",
      type: "success",
      icon: "checkmark-circle"
    });
  }, [showAlert]);

  return (
    <RadarContext.Provider value={{ 
      monitores, resultados, atividades, pushToken, setPushToken, deviceId, user, currentOwnerId,
      notificacoesAtivas, alternarNotificacoes, testLocalNotification,
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
      showAlert, hideAlert,
      // Header and Modals controls
      openNotif, closeNotif, openSettings, closeSettings,
      openAuthModal, closeAuthModal, authModalVisible,
      unreadNotifCount, limparNotificacoes,
      userProfile, setUserProfile
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
      <NotificationsModal
        visible={notifModalVisible}
        onClose={closeNotif}
        onClearAll={limparNotificacoes}
      />
      <SettingsDrawerModal
        visible={settingsModalVisible}
        onClose={closeSettings}
      />
      <AuthTutorialModal
        visible={authModalVisible}
        onClose={closeAuthModal}
      />
    </RadarContext.Provider>
  );
}


// =====================================================================
// 3. AUXILIARES E COMPONENTES DE ESTRATÉGIA
// =====================================================================

function identificarPlataforma(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('fastshop.com.br') || u.includes('fastshop.')) return 'FASTSHOP';
  if (u.includes('carrefour.com.br') || u.includes('carrefour.')) return 'CARREFOUR';
  if (u.includes('casasbahia.com.br') || u.includes('casasbahia.')) return 'CASASBAHIA';
  if (u.includes('kabum.com.br') || u.includes('kabum.')) return 'KABUM';
  if (u.includes('americanas.com.br') || u.includes('americanas.')) return 'AMERICANAS';
  if (u.includes('shein.com') || u.includes('shein.top') || u.includes('shein.com.br') || u.includes('shein.')) return 'SHEIN';
  if (u.includes('magazineluiza.com.br') || u.includes('magalu.com') || u.includes('magalu.')) return 'MAGALU';
  if (u.includes('amazon.com.br') || u.includes('amazon.com') || u.includes('amzn.to') || u.includes('a.co')) return 'AMAZON';
  if (u.includes('facebook.com') || u.includes('fb.me') || u.includes('fb.com')) return 'FACEBOOK';
  if (u.includes('zoom.com.br')) return 'ZOOM';
  if (u.includes('shopee.com.br') || u.includes('shopee.com') || u.includes('shp.ee')) return 'SHOPEE';
  if (u.includes('mercadolivre.com') || u.includes('mercadolivre.com.br') || u.includes('meli.la') || u.includes('mercadolivre')) return 'MERCADO_LIVRE';
  if (u.includes('olx.com.br') || u.includes('olx.')) return 'OLX';
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

function formatarTempoRegressivo(proximaDataStr, now, fallbackMin = 15, createdAt = null) {
  let targetTime = null;
  if (proximaDataStr) {
    targetTime = new Date(proximaDataStr).getTime();
  } else if (createdAt) {
    const parsedCreated = new Date(createdAt).getTime();
    if (!isNaN(parsedCreated) && parsedCreated > 0) {
      targetTime = parsedCreated + (fallbackMin * 60 * 1000);
    }
  }

  if (!targetTime || isNaN(targetTime)) {
    targetTime = now + (fallbackMin * 60 * 1000);
  }

  const diffMs = targetTime - now;
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

// Modal seletor moderno e elegante para Estado e Região
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
      <View style={styles.dropdownModalOverlay}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose} 
        />
        <View style={styles.dropdownModalCard}>
          {/* Header do Seletor */}
          <View style={styles.dropdownModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <View style={styles.dropdownIconCircle}>
                <Ionicons name="location" size={18} color="#FF5722" />
              </View>
              <Text style={styles.dropdownModalTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.dropdownCloseBtn} 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Campo de Busca de Estados/Cidades */}
          <View style={styles.dropdownSearchBox}>
            <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput 
              style={styles.dropdownSearchInput}
              placeholder="Filtrar por nome ou sigla..."
              placeholderTextColor="#94A3B8"
              value={busca}
              onChangeText={setBusca}
              autoCorrect={false}
            />
            {busca.length > 0 && (
              <TouchableOpacity onPress={() => setBusca('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Lista de Opções */}
          <FlatList 
            data={filtrados}
            keyExtractor={(item, index) => item.uf || item.slug || String(index)}
            ItemSeparatorComponent={() => <View style={styles.dropdownSeparator} />}
            renderItem={({ item }) => {
              const isSelected = (item.uf && item.uf === selectedId) || (item.slug !== undefined && item.slug === selectedId) || (item.id !== undefined && item.id === selectedId);
              return (
                <TouchableOpacity 
                  style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                  onPress={() => { onSelect(item); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                    {item.nome} {item.uf ? `(${item.uf})` : ''}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color="#FF5722" />}
                </TouchableOpacity>
              );
            }}
            style={{ maxHeight: 380 }}
            showsVerticalScrollIndicator={true}
          />
        </View>
      </View>
    </Modal>
  );
}

// =====================================================================
// 4. TELAS DO APLICATIVO - ACHÔAI 2026 (INSPIRAÇÃO PECHINCHOU)
// =====================================================================

const LOJAS_FILTRO = [
  'TODOS',
  'Mercado Livre',
  'Shopee',
  'Amazon',
  'Magalu',
  'KaBuM!',
  'Americanas',
  'Casas Bahia',
  'Fast Shop',
  'Carrefour',
  'SHEIN'
];

const CUPONS_DATABASE = [
  {
    id: 'c1',
    loja: 'Mercado Livre',
    cupom: 'MELI15',
    desconto: '15% OFF',
    descricao: '15% de desconto em produtos selecionados no app.',
    regras: 'Compras acima de R$ 199',
    cor: '#FFE600',
    url: 'https://www.mercadolivre.com.br'
  },
  {
    id: 'c2',
    loja: 'Shopee',
    cupom: 'SHOPEE10',
    desconto: 'R$ 10 OFF',
    descricao: 'Economize R$ 10 na sua próxima compra.',
    regras: 'Compras acima de R$ 50',
    cor: '#EE4D2D',
    url: 'https://shopee.com.br'
  },
  {
    id: 'c3',
    loja: 'Amazon',
    cupom: 'PRIME15',
    desconto: '15% OFF',
    descricao: 'Ofertas exclusivas para assinantes Amazon Prime.',
    regras: 'Válido em Eletrônicos e Informática',
    cor: '#FF9900',
    url: 'https://www.amazon.com.br'
  },
  {
    id: 'c4',
    loja: 'Magalu',
    cupom: 'MAGALU20',
    desconto: 'R$ 20 OFF',
    descricao: 'R$ 20 de desconto no carrinho em compras acima de R$ 200.',
    regras: 'Válido no app Magalu',
    cor: '#0086FF',
    url: 'https://www.magazineluiza.com.br'
  },
  {
    id: 'c5',
    loja: 'KaBuM!',
    cupom: 'KABUM5',
    desconto: '5% OFF',
    descricao: '5% de desconto extra em Hardware e Periféricos Gamer.',
    regras: 'Cumulativo com pagamento no Pix',
    cor: '#FF6500',
    url: 'https://www.kabum.com.br'
  },
  {
    id: 'c6',
    loja: 'Americanas',
    cupom: 'VALE20',
    desconto: 'R$ 20 OFF',
    descricao: 'Economize R$ 20 no seu pedido pelo app.',
    regras: 'Compras acima de R$ 150',
    cor: '#E60014',
    url: 'https://www.americanas.com.br'
  },
  {
    id: 'c7',
    loja: 'SHEIN',
    cupom: 'SHEINBR15',
    desconto: '15% OFF',
    descricao: '15% de desconto em Moda Feminina e Masculina.',
    regras: 'Sem valor mínimo de compra',
    cor: '#222222',
    url: 'https://br.shein.com'
  },
  {
    id: 'c8',
    loja: 'Fast Shop',
    cupom: 'FASTPIX',
    desconto: '10% OFF',
    descricao: 'Até 10% de desconto adicional no pagamento à vista via Pix.',
    regras: 'Smart TVs e Smartphones selecionados',
    cor: '#E31B23',
    url: 'https://www.fastshop.com.br'
  },
  {
    id: 'c9',
    loja: 'Carrefour',
    cupom: 'MERCADO30',
    desconto: 'R$ 30 OFF',
    descricao: 'R$ 30 OFF na primeira compra pelo aplicativo.',
    regras: 'Compras acima de R$ 250',
    cor: '#004A99',
    url: 'https://www.carrefour.com.br'
  },
  {
    id: 'c10',
    loja: 'Casas Bahia',
    cupom: 'BAHIA10',
    desconto: '10% OFF',
    descricao: '10% de desconto em Eletrodomésticos e Móveis.',
    regras: 'Vendido e entregue por Casas Bahia',
    cor: '#003399',
    url: 'https://www.casasbahia.com.br'
  }
];

// =====================================================================
// ABA 1: HOME - HUB DE PROMOÇÕES EM TEMPO REAL (OFERTAS DO DIA & RELÂMPAGO)
// =====================================================================
const CATEGORIAS_ANIMACAO_ONBOARDING = [
  { icon: "phone-portrait", label: "Smartphones & Tecnologia", cor: "#0284C7", bg: "#E0F2FE" },
  { icon: "shirt", label: "Vestuário & Moda", cor: "#E11D48", bg: "#FFE4E6" },
  { icon: "cube", label: "Eletroportáteis & Casa", cor: "#EA580C", bg: "#FFEDD5" },
  { icon: "headset", label: "Áudio, Games & Tech", cor: "#7C3AED", bg: "#EDE9FE" },
  { icon: "sparkles", label: "Casa, Beleza & Limpeza", cor: "#16A34A", bg: "#DCFCE7" },
  { icon: "tv", label: "Smart TVs & Telas", cor: "#D97706", bg: "#FEF3C7" }
];

function HomePromotionsScreen({ navigation }) {
  const { user, currentOwnerId, deviceId, showAlert, openNotif, openSettings, unreadNotifCount, userProfile, openAuthModal } = useContext(RadarContext);
  const effectiveUserId = currentOwnerId || user?.id || deviceId;
  const [lojaAtiva, setLojaAtiva] = useState('TODOS');
  const [deals, setDeals] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [isOnboardingSweep, setIsOnboardingSweep] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [catIndex, setCatIndex] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(1)).current;

  const FIRST_HOME_KEY = '@achoai_first_home_sweep_done_v7';
  const [filtroOrdenacao, setFiltroOrdenacao] = useState('todos');
  const [dropdownAberto, setDropdownAberto] = useState(false);

  const FILTRO_OPCOES = [
    { key: 'todos', label: 'Padrão (Top 5 + Lojas)', icon: 'sparkles' },
    { key: 'maior_desconto', label: 'Maiores Descontos (% OFF)', icon: 'flash' },
    { key: 'frete_gratis', label: 'Apenas Frete Grátis', icon: 'car' },
    { key: 'menor_preco', label: 'Menor Preço (R$)', icon: 'trending-down' }
  ];

  const onboardingSteps = [
    { label: "Conectando aos servidores de alta performance...", sub: "Iniciando inteligência artificial AchôAI" },
    { label: "Varrendo ofertas nas 10 maiores plataformas oficiais...", sub: "Shopee, Mercado Livre, Amazon, Magalu, Casas Bahia, KaBuM!, SHEIN e mais" },
    { label: "Garimpando melhores preços e fotos verificadas...", sub: "Descartando anúncios falsos e filtrando lojas oficiais" },
    { label: "Quase lá! Montando sua vitrine de super ofertas...", sub: "Organizando as melhores oportunidades do momento" }
  ];

  // Radar Pulse Animation
  useEffect(() => {
    if (!isOnboardingSweep) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isOnboardingSweep, pulseAnim]);

  // Alternância suave de categorias animadas a cada 1.6s
  useEffect(() => {
    if (!isOnboardingSweep) return;
    const catTimer = setInterval(() => {
      Animated.sequence([
        Animated.timing(iconScaleAnim, { toValue: 1.1, duration: 250, useNativeDriver: true }),
        Animated.timing(iconScaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
      ]).start();
      setCatIndex(prev => (prev + 1) % CATEGORIAS_ANIMACAO_ONBOARDING.length);
    }, 1600);
    return () => clearInterval(catTimer);
  }, [isOnboardingSweep, iconScaleAnim]);

  const carregarPromocoes = useCallback(async (force = false) => {
    try {
      if (force) setCarregando(true);
      const proms = await RecommendationEngine.carregarPromocoesHome(force);
      // REGRA CRÍTICA: Filtragem estrita anti-OLX e anti-Facebook
      let semUsados = (proms || []).filter(item => {
        const url = (item.url || '').toLowerCase();
        const loja = (item.loja || '').toLowerCase();
        return !url.includes('olx.com') && !url.includes('facebook.com') && loja !== 'olx' && loja !== 'facebook';
      });

      // Garante organização dinâmica e aleatória a cada atualização (pull-to-refresh)
      if (semUsados.length > 0) {
        for (let i = semUsados.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [semUsados[i], semUsados[j]] = [semUsados[j], semUsados[i]];
        }
      }

      setDeals(semUsados);
      return semUsados;
    } catch (e) {
      console.log('[HomePromotions] Erro ao carregar promoções:', e);
      return [];
    } finally {
      setCarregando(false);
    }
  }, []);

  // Inicialização e Onboarding em Tela Cheia no primeiro lançamento
  useEffect(() => {
    let timerStep1, timerStep2, timerStep3, timerFinal;

    const iniciarHome = async () => {
      try {
        const jaFezSweep = await AsyncStorage.getItem(FIRST_HOME_KEY);
        if (!jaFezSweep) {
          setIsOnboardingSweep(true);
          setOnboardingStep(0);
          progressAnim.setValue(0);

          // Dispara a varredura horária no backend
          RecommendationEngine.solicitarVarreduraPromocoes();

          Animated.timing(progressAnim, {
            toValue: 1,
            duration: 10000,
            useNativeDriver: false,
          }).start();

          timerStep1 = setTimeout(() => setOnboardingStep(1), 2500);
          timerStep2 = setTimeout(() => setOnboardingStep(2), 5200);
          timerStep3 = setTimeout(() => setOnboardingStep(3), 7800);

          timerFinal = setTimeout(async () => {
            await carregarPromocoes(true);
            await AsyncStorage.setItem(FIRST_HOME_KEY, 'true');
            setIsOnboardingSweep(false);
          }, 10000);
        } else {
          // Carrega do cache para resposta imediata (0ms) e sincroniza ofertas atualizadas do Supabase em seguida
          await carregarPromocoes(false);
          carregarPromocoes(true);
        }
      } catch (err) {
        console.log('[HomePromotions] Erro na inicialização:', err);
        setIsOnboardingSweep(false);
        carregarPromocoes(true);
      }
    };

    iniciarHome();

    return () => {
      if (timerStep1) clearTimeout(timerStep1);
      if (timerStep2) clearTimeout(timerStep2);
      if (timerStep3) clearTimeout(timerStep3);
      if (timerFinal) clearTimeout(timerFinal);
    };
  }, [carregarPromocoes]);

  const dealsFiltrados = useMemo(() => {
    let list = deals;
    if (lojaAtiva !== 'TODOS') {
      list = list.filter(item => item.loja && item.loja.toLowerCase().includes(lojaAtiva.toLowerCase()));
    }

    if (filtroOrdenacao === 'frete_gratis') {
      list = list.filter(item => {
        const info = calcularFreteGratisInfo(item.loja, item.preco, item.destaque_label, item.titulo);
        return info.temFreteGratis;
      });
    } else if (filtroOrdenacao === 'maior_desconto') {
      list = [...list].sort((a, b) => (b.desconto_pct || 0) - (a.desconto_pct || 0));
    } else if (filtroOrdenacao === 'menor_preco') {
      list = [...list].sort((a, b) => (a.preco || 0) - (b.preco || 0));
    }

    return list;
  }, [deals, lojaAtiva, filtroOrdenacao]);

  const handleDealClick = (deal) => {
    if (!deal) return;
    RecommendationEngine.registrarClique(deal.titulo || deal.title, effectiveUserId, deal.loja);

    let targetUrl = deal.url;
    if (!targetUrl || /^https?:\/\/(www\.)?(shopee|mercadolivre|amazon|magazineluiza|kabum|casasbahia|fastshop|americanas|carrefour|shein)\.com(\.br)?\/?$/i.test(targetUrl)) {
      targetUrl = RecommendationEngine.gerarUrlBuscaLoja(deal.loja, deal.titulo || deal.title);
    }
    const finalUrl = formatarUrlAfiliado(targetUrl);
    Linking.openURL(finalUrl).catch(() => {
      showAlert({
        title: "Aviso",
        message: "Não foi possível abrir o link da oferta.",
        type: "error"
      });
    });
  };

  const handleToggleFavorite = (item) => {
    RecommendationEngine.registrarFavorito(item?.titulo || item?.title, effectiveUserId, item?.loja);
  };

  const catAtual = CATEGORIAS_ANIMACAO_ONBOARDING[catIndex] || CATEGORIAS_ANIMACAO_ONBOARDING[0];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* TELA DE CARREGAMENTO ENQUANTO O ONBOARDING RODA */}
      <Modal
        visible={isOnboardingSweep}
        animationType="fade"
        transparent={false}
        statusBarTranslucent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.fullscreenOnboardingOverlay}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <View style={styles.onboardingSweepCenterBox}>
            {/* Ícone Vetorial de Categoria Animado e Pulsante */}
            <Animated.View style={[styles.onboardingCategoryIconBox, { backgroundColor: catAtual.bg, transform: [{ scale: iconScaleAnim }] }]}>
              <Ionicons name={catAtual.icon} size={38} color={catAtual.cor} />
            </Animated.View>
            <Text style={[styles.onboardingCategoryBadgeText, { color: catAtual.cor }]}>{catAtual.label}</Text>

            {/* Radar Pulsante */}
            <View style={styles.onboardingPulseWrapper}>
              <Animated.View 
                style={[
                  styles.onboardingPulseRing, 
                  { transform: [{ scale: pulseAnim }] }
                ]} 
              />
              <View style={styles.onboardingPulseCore}>
                <Ionicons name="flame" size={38} color="#FFFFFF" />
              </View>
            </View>

            {/* Selo AchôAI */}
            <View style={styles.onboardingBadge}>
              <Ionicons name="sparkles" size={13} color="#FF5722" style={{ marginRight: 5 }} />
              <Text style={styles.onboardingBadgeText}>AchôAI • Radar de Ofertas</Text>
            </View>

            {/* Textos Dinâmicos por Etapa */}
            <Text style={styles.onboardingTitle}>
              {onboardingSteps[onboardingStep]?.label}
            </Text>
            <Text style={styles.onboardingSub}>
              {onboardingSteps[onboardingStep]?.sub}
            </Text>

            {/* Barra de Progresso Suave (0% a 100% em 10s) */}
            <View style={styles.onboardingProgressTrack}>
              <Animated.View 
                style={[
                  styles.onboardingProgressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]} 
              />
            </View>

            <View style={styles.onboardingFooterRow}>
              <Ionicons name="shield-checkmark" size={14} color="#16A34A" style={{ marginRight: 6 }} />
              <Text style={styles.onboardingFooterText}>
                Varredura oficial nas 10 maiores plataformas do Brasil
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* HEADER COMPARTILHADO E ENCAPSULADO (AchôAI Top Bar) */}
      <AppTopHeader 
        user={user} 
        userProfile={userProfile}
        onPressProfile={() => user ? openSettings() : openAuthModal()}
        onOpenNotif={openNotif} 
        onOpenSettings={openSettings} 
        unreadCount={unreadNotifCount} 
      />

      {/* FILTRO DE PLATAFORMAS HORIZONTAL (COMPACTO) */}
      <View style={{ height: 36, marginBottom: 2 }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          {LOJAS_FILTRO.map((loja) => {
            const isSelected = lojaAtiva === loja;
            return (
              <TouchableOpacity
                key={loja}
                style={[
                  styles.filterPill,
                  isSelected && styles.filterPillActive
                ]}
                onPress={() => {
                  try { Vibration.vibrate(15); } catch(e) {}
                  setLojaAtiva(loja);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {loja}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* FEED DE PROMOÇÕES VIRTUALIZADO DE ALTA PERFORMANCE (60 FPS SEM DELAY) */}
      <FlatList
        data={dealsFiltrados}
        keyExtractor={(item) => String(item.id || item.url || Math.random())}
        renderItem={({ item }) => (
          <ProductDealCard
            item={item}
            onPress={() => handleDealClick(item)}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        contentContainerStyle={styles.feedScrollContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={carregando}
            onRefresh={() => carregarPromocoes(true)}
            colors={['#FF5722']}
            tintColor="#FF5722"
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.pechFeedSectionTitleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="flame" size={18} color="#FF5722" style={{ marginRight: 6 }} />
                <Text style={styles.pechFeedSectionTitle}>
                  {lojaAtiva === 'TODOS' ? 'Promoções do Momento' : `Ofertas de ${lojaAtiva}`}
                </Text>
              </View>

              {/* Botão de Lista de Filtros Suspensos ao Lado do Título */}
              <TouchableOpacity 
                style={styles.dropdownFilterBtn}
                onPress={() => {
                  try { Vibration.vibrate(15); } catch(e) {}
                  setDropdownAberto(prev => !prev);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="funnel" size={12} color="#FF5722" style={{ marginRight: 4 }} />
                <Text style={styles.dropdownFilterBtnText}>
                  {FILTRO_OPCOES.find(f => f.key === filtroOrdenacao)?.label.split(' ')[0] || 'Filtrar'}
                </Text>
                <Ionicons 
                  name={dropdownAberto ? "chevron-up" : "chevron-down"} 
                  size={13} 
                  color="#64748B" 
                  style={{ marginLeft: 3 }} 
                />
              </TouchableOpacity>
            </View>

            {/* Menu Suspenso de Filtros em Formato de Lista */}
            {dropdownAberto && (
              <View style={styles.dropdownListBox}>
                <Text style={styles.dropdownListHeaderTitle}>FILTRAR PROMOÇÕES POR:</Text>
                {FILTRO_OPCOES.map(op => {
                  const isSel = filtroOrdenacao === op.key;
                  return (
                    <TouchableOpacity
                      key={op.key}
                      style={[styles.dropdownListItem, isSel && styles.dropdownListItemActive]}
                      onPress={() => {
                        try { Vibration.vibrate(15); } catch(e) {}
                        setFiltroOrdenacao(op.key);
                        setDropdownAberto(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={op.icon} 
                        size={15} 
                        color={isSel ? '#FF5722' : '#64748B'} 
                        style={{ marginRight: 8 }} 
                      />
                      <Text style={[styles.dropdownListItemText, isSel && styles.dropdownListItemTextActive]}>
                        {op.label}
                      </Text>
                      {isSel && (
                        <Ionicons name="checkmark-circle" size={16} color="#FF5722" style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.dealsCountRow}>
              <Text style={styles.dealsCountText}>
                Exibindo {dealsFiltrados.length} ofertas
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyFeedBox}>
            <Ionicons name="search-outline" size={36} color={THEME.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma oferta para esta loja no momento</Text>
            <TouchableOpacity 
              style={styles.emptyResetBtn}
              onPress={() => setLojaAtiva('TODOS')}
            >
              <Text style={styles.emptyResetBtnText}>Ver Todas as Lojas</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

// =====================================================================
// ABA 4: RECOMENDADOS PARA VOCÊ (AFINIDADE & PESOS PERSONALIZADOS)
// =====================================================================
function RecommendationsFeedScreen({ navigation }) {
  const { user, currentOwnerId, deviceId, showAlert, openNotif, openSettings, unreadNotifCount, userProfile, openAuthModal } = useContext(RadarContext);
  const effectiveUserId = currentOwnerId || user?.id || deviceId;
  const [lojaAtiva, setLojaAtiva] = useState('TODOS');
  const [deals, setDeals] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [filtroOrdenacao, setFiltroOrdenacao] = useState('todos');
  const [dropdownAberto, setDropdownAberto] = useState(false);

  const FILTRO_OPCOES = [
    { key: 'todos', label: 'Padrão (Mais Relevantes)', icon: 'sparkles' },
    { key: 'maior_desconto', label: 'Maiores Descontos (% OFF)', icon: 'flash' },
    { key: 'frete_gratis', label: 'Apenas Frete Grátis', icon: 'car' },
    { key: 'menor_preco', label: 'Menor Preço (R$)', icon: 'trending-down' }
  ];

  const carregarFeed = useCallback(async (force = false) => {
    try {
      if (force) setCarregando(true);
      const recs = await RecommendationEngine.carregarRecomendacoes(force, effectiveUserId);
      const semUsados = (recs || []).filter(item => {
        const url = (item.url || '').toLowerCase();
        const loja = (item.loja || '').toLowerCase();
        return !url.includes('olx.com') && !url.includes('facebook.com') && loja !== 'olx' && loja !== 'facebook';
      });
      setDeals(semUsados);
      return semUsados;
    } catch (e) {
      console.log('[RecommendationsFeed] Erro ao carregar feed:', e);
      return [];
    } finally {
      setCarregando(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    carregarFeed(false);
  }, [carregarFeed]);

  const dealsFiltrados = useMemo(() => {
    let list = deals;
    if (lojaAtiva !== 'TODOS') {
      list = list.filter(item => item.loja && item.loja.toLowerCase().includes(lojaAtiva.toLowerCase()));
    }

    if (filtroOrdenacao === 'frete_gratis') {
      list = list.filter(item => {
        const info = calcularFreteGratisInfo(item.loja, item.preco, item.destaque_label, item.titulo);
        return info.temFreteGratis;
      });
    } else if (filtroOrdenacao === 'maior_desconto') {
      list = [...list].sort((a, b) => (b.desconto_pct || 0) - (a.desconto_pct || 0));
    } else if (filtroOrdenacao === 'menor_preco') {
      list = [...list].sort((a, b) => {
        const pA = parseFloat(a.preco || a.price) || 0;
        const pB = parseFloat(b.preco || b.price) || 0;
        return pA - pB;
      });
    } else {
      list = [...list].sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    return list;
  }, [deals, lojaAtiva, filtroOrdenacao]);

  const handleDealClick = (deal) => {
    if (!deal) return;
    RecommendationEngine.registrarClique(deal.titulo || deal.title, effectiveUserId, deal.loja);

    let targetUrl = deal.url;
    if (!targetUrl || /^https?:\/\/(www\.)?(shopee|mercadolivre|amazon|magazineluiza|kabum|casasbahia|fastshop|americanas|carrefour|shein)\.com(\.br)?\/?$/i.test(targetUrl)) {
      targetUrl = RecommendationEngine.gerarUrlBuscaLoja(deal.loja, deal.titulo || deal.title);
    }
    const finalUrl = formatarUrlAfiliado(targetUrl);
    Linking.openURL(finalUrl).catch(() => {
      showAlert({
        title: "Aviso",
        message: "Não foi possível abrir o link da oferta.",
        type: "error"
      });
    });
  };

  const handleToggleFavorite = (item) => {
    RecommendationEngine.registrarFavorito(item?.titulo || item?.title, effectiveUserId, item?.loja);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header com Saudação 100% Idêntico ao Home (sem subtítulo no topo) */}
      <AppTopHeader 
        user={user} 
        userProfile={userProfile}
        onPressProfile={() => user ? openSettings() : openAuthModal()}
        onOpenNotif={openNotif} 
        onOpenSettings={openSettings} 
        unreadCount={unreadNotifCount} 
      />

      {/* Filtro de Lojas Horizontal com tom Avermelhado */}
      <View style={{ height: 42, marginBottom: 4 }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          {LOJAS_FILTRO.map((loja) => {
            const isSelected = lojaAtiva === loja;
            return (
              <TouchableOpacity
                key={loja}
                style={[
                  styles.filterPill,
                  isSelected && { backgroundColor: '#E11D48', borderColor: '#E11D48' }
                ]}
                onPress={() => {
                  try { Vibration.vibrate(15); } catch(e) {}
                  setLojaAtiva(loja);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {loja}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Feed Virtualizado com FlatList */}
      <FlatList
        data={dealsFiltrados}
        keyExtractor={(item) => String(item.id || item.url || Math.random())}
        renderItem={({ item }) => (
          <ProductDealCard
            item={{ ...item, is_recomendacao: true, is_top5: false, is_destaque_top5: false }}
            onPress={() => handleDealClick(item)}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        contentContainerStyle={styles.feedScrollContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={carregando}
            onRefresh={() => carregarFeed(true)}
            colors={['#E11D48']}
            tintColor="#E11D48"
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.pechFeedSectionTitleRow}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="sparkles" size={18} color="#E11D48" style={{ marginRight: 6 }} />
                  <Text style={styles.pechFeedSectionTitle}>
                    {lojaAtiva === 'TODOS' ? 'Recomendados Para Você' : `Recomendações de ${lojaAtiva}`}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2, marginLeft: 24 }}>
                  Recomendações com base nos seus radares e perfil
                </Text>
              </View>

              {/* Botão de Lista de Filtros Suspensos com Tema Avermelhado */}
              <TouchableOpacity 
                style={[styles.dropdownFilterBtn, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}
                onPress={() => {
                  try { Vibration.vibrate(15); } catch(e) {}
                  setDropdownAberto(prev => !prev);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="funnel" size={12} color="#E11D48" style={{ marginRight: 4 }} />
                <Text style={[styles.dropdownFilterBtnText, { color: '#E11D48' }]}>
                  {FILTRO_OPCOES.find(f => f.key === filtroOrdenacao)?.label.split(' ')[0] || 'Filtrar'}
                </Text>
                <Ionicons 
                  name={dropdownAberto ? "chevron-up" : "chevron-down"} 
                  size={13} 
                  color="#E11D48" 
                  style={{ marginLeft: 3 }} 
                />
              </TouchableOpacity>
            </View>

            {/* Menu Suspenso de Filtros em Formato de Lista */}
            {dropdownAberto && (
              <View style={styles.dropdownListBox}>
                <Text style={styles.dropdownListHeaderTitle}>FILTRAR RECOMENDAÇÕES POR:</Text>
                {FILTRO_OPCOES.map(op => {
                  const isSel = filtroOrdenacao === op.key;
                  return (
                    <TouchableOpacity
                      key={op.key}
                      style={[styles.dropdownListItem, isSel && { backgroundColor: '#FFF1F2' }]}
                      onPress={() => {
                        try { Vibration.vibrate(15); } catch(e) {}
                        setFiltroOrdenacao(op.key);
                        setDropdownAberto(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={op.icon} 
                        size={15} 
                        color={isSel ? '#E11D48' : '#64748B'} 
                        style={{ marginRight: 8 }} 
                      />
                      <Text style={[styles.dropdownListItemText, isSel && { color: '#E11D48', fontWeight: '800' }]}>
                        {op.label}
                      </Text>
                      {isSel && (
                        <Ionicons name="checkmark-circle" size={16} color="#E11D48" style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.dealsCountRow}>
              <Text style={styles.dealsCountText}>
                Exibindo {dealsFiltrados.length} recomendações
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyFeedBox}>
            <Ionicons name="search-outline" size={36} color={THEME.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma recomendação para esta loja no momento</Text>
            <TouchableOpacity 
              style={[styles.emptyResetBtn, { backgroundColor: '#E11D48' }]}
              onPress={() => setLojaAtiva('TODOS')}
            >
              <Text style={styles.emptyResetBtnText}>Ver Todas as Lojas</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

// =====================================================================
// ABA 2: RADARES INTELIGENTES (GESTÃO & ONBOARDING)
// =====================================================================
function RadarsScreen({ navigation }) {
  const { monitores, resultados, loading, refreshing, onRefresh, showAlert, user, openNotif, openSettings, unreadNotifCount, userProfile, openAuthModal, tier, tierState } = useContext(RadarContext);
  const [expandedRadarId, setExpandedRadarId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [testingRadarId, setTestingRadarId] = useState(null);

  const isAdmin = Boolean(
    tier === 'admin' || 
    tierState?.tier === 'admin' || 
    userProfile?.plano === 'admin' || 
    userProfile?.tipo_usuario === 'admin' || 
    user?.email?.toLowerCase().includes('admin')
  );

  const handleTestarRadar = async (monitor) => {
    try {
      try { Vibration.vibrate(25); } catch(e) {}
      setTestingRadarId(monitor.id);
      await RadarAPI.testMonitor(monitor.id);
      showAlert({
        title: "Varredura Disparada!",
        message: `O radar "${monitor.nome || monitor.produto || 'Radar'}" foi agendado para execução prioritária imediata no servidor.`,
        type: "success",
        icon: "flash"
      });
      if (onRefresh) onRefresh();
    } catch (e) {
      showAlert({ title: "Erro", message: "Não foi possível disparar o teste do radar.", type: "error" });
    } finally {
      setTimeout(() => setTestingRadarId(null), 2500);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleExpand = (id) => {
    try { Vibration.vibrate(20); } catch(e) {}
    setExpandedRadarId(prev => prev === id ? null : id);
  };

  const handleDeleteRadar = (monitor) => {
    showAlert({
      title: "Excluir Radar",
      message: `Deseja realmente remover o radar "${monitor.nome || 'Radar'}"?`,
      type: "confirm_danger",
      icon: "trash-outline",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      showCancel: true,
      onConfirm: async () => {
        try {
          await RadarAPI.deleteMonitor(monitor.id);
          if (onRefresh) onRefresh();
        } catch(e) {
          showAlert({ title: "Erro", message: "Não foi possível excluir o radar.", type: "error" });
        }
      }
    });
  };

  const handleToggleAtivo = async (monitor, val) => {
    try {
      try { Vibration.vibrate(20); } catch(e) {}
      await RadarAPI.toggleMonitor(monitor.id, val);
      if (onRefresh) onRefresh();
    } catch (e) {
      showAlert({ title: "Erro", message: "Não foi possível alterar o status do radar.", type: "error" });
    }
  };

  // Se não tem radares: Onboarding Elegante em Tela Limpa
  if (!loading && monitores.length === 0) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <AppTopHeader 
          user={user} 
          userProfile={userProfile}
          onPressProfile={() => user ? openSettings() : openAuthModal()}
          onOpenNotif={openNotif} 
          onOpenSettings={openSettings} 
          unreadCount={unreadNotifCount} 
        />
        <View style={[styles.brandHeaderClean, { paddingTop: 6 }]}>
          <Text style={styles.brandTitleText}>Radares Inteligentes</Text>
        </View>

        <ScrollView contentContainerStyle={styles.onboardingContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.onboardingHeroIcon}>
            <Ionicons name="radio" size={38} color="#FF5722" />
          </View>

          <Text style={styles.onboardingTitle}>Crie seu radar inteligente em poucos cliques</Text>
          <Text style={styles.onboardingSubtitle}>
            Acompanhe preços dos maiores e-commerces em tempo real e receba notificações imediatas assim que uma oferta for achada.
          </Text>

          <View style={styles.onboardingCardsWrap}>
            <View style={styles.onboardingCard}>
              <View style={[styles.onboardingCardIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="flash-outline" size={22} color="#3B82F6" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.onboardingCardTitle}>Rastreamento 24h na Nuvem</Text>
                <Text style={styles.onboardingCardDesc}>
                  Nosso motor verifica as lojas automaticamente no intervalo que você escolher.
                </Text>
              </View>
            </View>

            <View style={styles.onboardingCard}>
              <View style={[styles.onboardingCardIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="pricetag-outline" size={22} color="#FF5722" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.onboardingCardTitle}>Preço Alvo Personalizado</Text>
                <Text style={styles.onboardingCardDesc}>
                  Defina o valor máximo que deseja pagar e seja notificado quando o preço cair.
                </Text>
              </View>
            </View>

            <View style={styles.onboardingCard}>
              <View style={[styles.onboardingCardIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="notifications-outline" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.onboardingCardTitle}>Alertas Limpos e Diretos</Text>
                <Text style={styles.onboardingCardDesc}>
                  Notificações com fotos, preços e links diretos para a loja oficial, sem spam.
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.onboardingCtaBtn}
            onPress={() => navigation.navigate('Criar')}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.onboardingCtaBtnText}>Criar Primeiro Radar</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Padronizado */}
      <AppTopHeader 
        user={user} 
        userProfile={userProfile}
        onPressProfile={() => user ? openSettings() : openAuthModal()}
        onOpenNotif={openNotif} 
        onOpenSettings={openSettings} 
        unreadCount={unreadNotifCount} 
      />

      {/* Título da Seção Meus Radares */}
      <View style={[styles.brandHeaderClean, { paddingTop: 6 }]}>
        <View>
          <View style={styles.row}>
            <Text style={styles.brandTitleText}>Meus Radares</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{monitores.length}</Text>
            </View>
          </View>
          <Text style={styles.brandSubtitleText}>Gerencie suas varreduras ativas</Text>
        </View>

        <TouchableOpacity 
          style={styles.headerPrimaryBtn}
          onPress={() => navigation.navigate('Criar')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.headerPrimaryBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.radarsScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[THEME.primary]}
            tintColor={THEME.primary}
          />
        }
      >
        {monitores.map((monitor) => {
          const isExpanded = expandedRadarId === monitor.id;
          const itensEncontrados = resultados.filter(r => r.monitor_id === monitor.id);
          const platNome = monitor.plataforma || identificarPlataforma(monitor.urls);
          const intervaloMinutos = monitor.intervalo_valor || monitor.intervalo_minutos || 15;
          const regr = formatarTempoRegressivo(
            monitor.proxima_execucao || monitor.proxima_varredura, 
            now, 
            intervaloMinutos, 
            monitor.created_at
          );

          return (
            <View 
              key={monitor.id}
              style={styles.radarCard}
            >
              {Boolean(monitor.ativo) && <View style={styles.radarCardActiveIndicator} />}
              {/* Cabeçalho do Card */}
              <View style={styles.radarCardHeader}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.radarCardTitle} numberOfLines={1}>
                    {monitor.nome || monitor.produto || monitor.palavras || 'Radar Sem Nome'}
                  </Text>
                  
                  <View style={[styles.row, { marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginRight: 8 }}>
                      {(platNome || '').split(',').map(p => p.trim()).filter(Boolean).map((pKey, pIdx) => (
                        <View key={pIdx} style={styles.radarPlatMiniLogoBox}>
                          <StoreLogoBadge storeKey={pKey} size={15} />
                        </View>
                      ))}
                    </View>

                    <View style={styles.miniIntervalBadge}>
                      <Ionicons name="time-outline" size={12} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.miniIntervalBadgeText}>
                        {intervaloMinutos} min
                      </Text>
                    </View>
                  </View>
                </View>

                <Switch
                  value={monitor.ativo}
                  onValueChange={(val) => handleToggleAtivo(monitor, val)}
                  trackColor={{ false: '#CBD5E1', true: THEME.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Status e Próxima Verificação */}
              <View style={styles.radarCardStatusRow}>
                <View style={styles.row}>
                  <View style={[styles.statusDot, { backgroundColor: monitor.ativo ? '#10B981' : '#94A3B8' }]} />
                  <Text style={styles.statusLabelText}>
                    {monitor.ativo ? 'Monitorando ativamente' : 'Varredura pausada'}
                  </Text>
                </View>

                {monitor.ativo && (
                  <Text style={styles.countdownText}>
                    Próxima em: <Text style={{ fontWeight: '700', color: THEME.primary }}>{regr}</Text>
                  </Text>
                )}
              </View>

              {/* Botão Acordeão de Ofertas Encontradas */}
              <TouchableOpacity
                style={styles.accordionToggleBtn}
                onPress={() => toggleExpand(monitor.id)}
                activeOpacity={0.8}
              >
                <View style={styles.row}>
                  <Ionicons name="pricetags-outline" size={16} color={THEME.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.accordionToggleText}>
                    Ofertas Encontradas ({itensEncontrados.length})
                  </Text>
                </View>
                <Ionicons 
                  name={isExpanded ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color="#64748B" 
                />
              </TouchableOpacity>

              {/* Corpo Expandido com Ofertas */}
              {isExpanded && (
                <View style={styles.accordionBody}>
                  {itensEncontrados.length === 0 ? (
                    <View style={styles.accordionEmpty}>
                      <Text style={styles.accordionEmptyText}>
                        Nenhuma oferta detectada ainda. O AchôAI notificará você assim que encontrar oportunidades para este radar.
                      </Text>
                    </View>
                  ) : (
                    itensEncontrados.map((item, idx) => {
                      let itemLoja = item.loja || item.plataforma;
                      if (!itemLoja || itemLoja === 'OUTROS' || itemLoja === 'Loja Parceira') {
                        const detectada = identificarPlataforma(item.url);
                        if (detectada && detectada !== 'OUTROS') {
                          itemLoja = detectada;
                        }
                      }
                      itemLoja = itemLoja || 'OUTROS';

                      const lojaFormatada = (itemLoja === 'MERCADO_LIVRE' ? 'Mercado Livre' :
                        itemLoja === 'CASASBAHIA' ? 'Casas Bahia' :
                        itemLoja === 'FASTSHOP' ? 'Fast Shop' :
                        itemLoja === 'FACEBOOK' ? 'Facebook' :
                        itemLoja);

                      return (
                        <TouchableOpacity
                          key={item.id || idx}
                          style={styles.radarResultItem}
                          onPress={() => {
                            if (item.url) Linking.openURL(item.url);
                          }}
                          activeOpacity={0.8}
                        >
                          {item.imagem_url ? (
                            <Image source={{ uri: item.imagem_url }} style={styles.radarResultThumb} />
                          ) : (
                            <View style={styles.radarResultThumbFallback}>
                              <Ionicons name="image-outline" size={16} color="#94A3B8" />
                            </View>
                          )}
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.radarResultTitle} numberOfLines={2}>
                              {item.title || item.titulo || 'Produto Encontrado'}
                            </Text>

                            {/* Procedência da Loja & Tag de Desconto */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 6 }}>
                              <View style={styles.radarResultStoreBadge}>
                                <StoreLogoBadge storeKey={itemLoja} size={13} style={{ marginRight: 4 }} />
                                <Text style={styles.radarResultStoreName} numberOfLines={1}>
                                  {lojaFormatada}
                                </Text>
                              </View>
                              {Boolean(item.desconto_pct && item.desconto_pct > 0) && (
                                <View style={styles.radarResultDiscountTag}>
                                  <Text style={styles.radarResultDiscountText}>-{item.desconto_pct}%</Text>
                                </View>
                              )}
                            </View>

                            <Text style={styles.radarResultPrice}>
                              {item.price || item.preco ? `R$ ${Number(item.price || item.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Ver na loja'}
                            </Text>
                          </View>
                          <Ionicons name="open-outline" size={16} color={THEME.primary} />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}

              {/* Ações do Card */}
              <View style={styles.radarCardFooter}>
                {isAdmin && (
                  <TouchableOpacity 
                    style={[styles.radarActionBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                    onPress={() => handleTestarRadar(monitor)}
                    disabled={testingRadarId === monitor.id}
                  >
                    {testingRadarId === monitor.id ? (
                      <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 4 }} />
                    ) : (
                      <Ionicons name="flash-outline" size={15} color="#2563EB" style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.radarActionBtnText, { color: '#2563EB', fontWeight: '700' }]}>
                      {testingRadarId === monitor.id ? 'Testando...' : 'Testar'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={styles.radarActionBtn}
                  onPress={() => navigation.navigate('Criar', { monitor })}
                >
                  <Ionicons name="create-outline" size={15} color="#334155" style={{ marginRight: 4 }} />
                  <Text style={styles.radarActionBtnText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.radarActionBtn}
                  onPress={() => handleDeleteRadar(monitor)}
                >
                  <Ionicons name="trash-outline" size={15} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={[styles.radarActionBtnText, { color: '#EF4444' }]}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Floating Action Button (+) */}
      <TouchableOpacity
        style={styles.fabBtn}
        onPress={() => navigation.navigate('Criar')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

// =====================================================================
// ABA 3: CUPONS (INSPIRAÇÃO PECHINCHOU SCREENSHOT 2)
// =====================================================================
function CouponsScreen() {
  const { showAlert } = useContext(RadarContext);
  const [lojaFiltro, setLojaFiltro] = useState('TODOS');
  const [cupomCopiadoId, setCupomCopiadoId] = useState(null);
  const [buscaCupom, setBuscaCupom] = useState('');

  const cuponsFiltrados = useMemo(() => {
    return CUPONS_DATABASE.filter(c => {
      const matchLoja = lojaFiltro === 'TODOS' || c.loja.toLowerCase().includes(lojaFiltro.toLowerCase());
      const matchBusca = !buscaCupom.trim() || 
        c.loja.toLowerCase().includes(buscaCupom.toLowerCase()) || 
        c.cupom.toLowerCase().includes(buscaCupom.toLowerCase()) ||
        c.descricao.toLowerCase().includes(buscaCupom.toLowerCase());
      return matchLoja && matchBusca;
    });
  }, [lojaFiltro, buscaCupom]);

  const handleCopiar = async (item) => {
    try {
      try { Vibration.vibrate(50); } catch(e) {}
      await Clipboard.setStringAsync(item.cupom);
      setCupomCopiadoId(item.id);
      setTimeout(() => setCupomCopiadoId(null), 3000);
      showAlert({
        title: "Cupom Copiado!",
        message: `O código "${item.cupom}" foi copiado para sua área de transferência. Cole no carrinho da ${item.loja} para garantir seu desconto!`,
        type: "success",
        icon: "checkmark-circle"
      });
    } catch(e) {
      showAlert({ title: "Erro", message: "Não foi possível copiar o código.", type: "error" });
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Estilo Pechinchou Screenshot 2 */}
      <View style={styles.pechCuponsHeader}>
        <View style={styles.row}>
          <Ionicons name="ticket" size={18} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.pechCuponsPreTitle}>Cupons AchôAI</Text>
        </View>
        <Text style={styles.pechCuponsMainTitle}>
          Cupons das <Text style={{ color: '#EF4444' }}>Melhores Lojas</Text>
        </Text>
        <Text style={styles.pechCuponsSub}>Encontre o cupom das melhores lojas do Brasil!</Text>

        {/* Input de Busca de Lojas */}
        <View style={styles.pechCuponsSearchBox}>
          <TextInput
            style={styles.pechCuponsSearchInput}
            placeholder="Busque por lojas..."
            placeholderTextColor="#94A3B8"
            value={buscaCupom}
            onChangeText={setBuscaCupom}
          />
          <Ionicons name="search" size={20} color="#EF4444" />
        </View>
      </View>

      {/* Grade de Lojas (2 Colunas - Inspiração Pechinchou Screenshot 2) */}
      {!buscaCupom && lojaFiltro === 'TODOS' && (
        <View style={{ height: 110, paddingHorizontal: 16, marginBottom: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {LOJAS_FILTRO.filter(l => l !== 'TODOS').map(l => (
              <TouchableOpacity
                key={l}
                style={styles.pechStoreCardMini}
                onPress={() => setLojaFiltro(l)}
              >
                <StoreLogoBadge storeKey={l} size={36} />
                <Text style={styles.pechStoreCardMiniName} numberOfLines={1}>{l}</Text>
                <Text style={styles.pechStoreCardMiniCount}>Cupons ativos</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Lista de Cupons */}
      <ScrollView contentContainerStyle={styles.cuponsScrollContent} showsVerticalScrollIndicator={false}>
        {cuponsFiltrados.map((c) => {
          const isCopiado = cupomCopiadoId === c.id;
          return (
            <View key={c.id} style={styles.couponCard}>
              <View style={styles.couponCardHeader}>
                <View style={styles.row}>
                  <StoreLogoBadge storeKey={c.loja} size={22} style={{ marginRight: 6 }} />
                  <Text style={styles.couponStorePillText}>{c.loja}</Text>
                </View>
                <View style={styles.couponDiscountBadge}>
                  <Text style={styles.couponDiscountBadgeText}>{c.desconto}</Text>
                </View>
              </View>

              <Text style={styles.couponDescText}>{c.descricao}</Text>
              <Text style={styles.couponRulesText}>• {c.regras}</Text>

              {/* Caixa de Código de Cupom */}
              <View style={styles.couponCodeBox}>
                <View style={styles.couponCodeTextWrap}>
                  <Text style={styles.couponCodeText}>{c.cupom}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.couponCopyBtn, isCopiado && styles.couponCopyBtnDone]}
                  onPress={() => handleCopiar(c)}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name={isCopiado ? "checkmark-outline" : "copy-outline"} 
                    size={16} 
                    color="#FFFFFF" 
                    style={{ marginRight: 4 }} 
                  />
                  <Text style={styles.couponCopyBtnText}>
                    {isCopiado ? 'COPIADO!' : 'COPIAR'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.couponStoreLinkBtn}
                onPress={() => Linking.openURL(c.url)}
              >
                <Text style={styles.couponStoreLinkText}>Ir para {c.loja}</Text>
                <Ionicons name="arrow-forward" size={14} color={THEME.primary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// =====================================================================
// ABA 4: PESQUISA INTELIGENTE & COMPARADOR MULTI-LOJAS
// =====================================================================
function SearchScreen() {
  const { 
    resultados, handleOpenAd, user, currentOwnerId, 
    openNotif, openSettings, unreadNotifCount, userProfile, 
    openAuthModal, showAlert 
  } = useContext(RadarContext);

  // Etapas: 'busca' | 'varrendo' (animação 10s) | 'resultados'
  const [etapaBusca, setEtapaBusca] = useState('busca');
  const [termo, setTermo] = useState('');
  const [filtroChip, setFiltroChip] = useState('MAIOR_DESCONTO');
  const [resultadosInteligentes, setResultadosInteligentes] = useState([]);

  // Toggle OLX e Facebook Marketplace
  const [incluirSeminovos, setIncluirSeminovos] = useState(false);
  
  // Localização OLX
  const [olxUf, setOlxUf] = useState('BR');
  const [olxRegiao, setOlxRegiao] = useState('');
  const [modalOlxUfVisible, setModalOlxUfVisible] = useState(false);
  const [modalOlxRegiaoVisible, setModalOlxRegiaoVisible] = useState(false);

  // Localização Facebook Marketplace
  const [fbUf, setFbUf] = useState('BR');
  const [fbCidade, setFbCidade] = useState('brasil');
  const [modalFbUfVisible, setModalFbUfVisible] = useState(false);
  const [modalFbCidadeVisible, setModalFbCidadeVisible] = useState(false);

  // Itens formatados para os modais de seleção
  const itensOlxEstados = useMemo(() => {
    return LISTA_ESTADOS.map(e => ({ id: e.uf, uf: e.uf, nome: e.nome }));
  }, []);

  const itensOlxRegioes = useMemo(() => {
    const estado = OLX_ESTADOS[olxUf];
    return (estado?.regioes || []).map(r => ({ id: r.slug, nome: r.nome, slug: r.slug }));
  }, [olxUf]);

  const itensFbEstados = useMemo(() => {
    return LISTA_ESTADOS_FACEBOOK.map(e => ({ id: e.uf, uf: e.uf, nome: e.nome }));
  }, []);

  const itensFbCidades = useMemo(() => {
    const estado = FACEBOOK_ESTADOS_CIDADES[fbUf];
    return (estado?.cidades || []).map(c => ({ id: c.slug, nome: c.nome, slug: c.slug }));
  }, [fbUf]);

  // Estados da Animação de Varredura Multi-Lojas (10 segundos)
  const [faseIndex, setFaseIndex] = useState(0);
  const progressoAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.7)).current;
  const varreduraTimerRef = useRef(null);

  // 10 Categorias Oficiais com consultas representativas para clique direto (termos limpos e assertivos)
  const CATEGORIAS_PESQUISA = [
    { key: 'eletroportateis', label: 'Eletroportáteis', icon: 'cafe', bg: '#DCFCE7', query: 'Air Fryer' },
    { key: 'ar_ventilacao', label: 'Ar e Ventilação', icon: 'snow', bg: '#FCE7F3', query: 'Ventilador' },
    { key: 'telefonia', label: 'Telefonia', icon: 'phone-portrait', bg: '#FEF9C3', query: 'Smartphone' },
    { key: 'moda_beleza', label: 'Moda e Beleza', icon: 'color-palette', bg: '#E0F2FE', query: 'Perfume' },
    { key: 'games', label: 'Games & Consoles', icon: 'game-controller', bg: '#F3E8FF', query: 'PlayStation 5' },
    { key: 'informatica', label: 'Informática', icon: 'laptop', bg: '#EDE9FE', query: 'Notebook' },
    { key: 'eletrodomesticos', label: 'Eletrodomésticos', icon: 'cube', bg: '#FCE7F3', query: 'Geladeira' },
    { key: 'televisao', label: 'Televisão & Áudio', icon: 'tv', bg: '#EDE9FE', query: 'Smart TV' },
    { key: 'cama_mesa_banho', label: 'Cama, Mesa e Banho', icon: 'bed', bg: '#FFF7ED', query: 'Jogo de Cama' },
    { key: 'esporte_lazer', label: 'Esporte & Lazer', icon: 'fitness', bg: '#FEF3C7', query: 'Bicicleta' }
  ];

  const FASES_VARREDURA = [
    {
      titulo: "Conectando aos servidores de alta velocidade...",
      sub: "Inicializando conexão segura e preparando varredura simultânea",
      icon: "cloud-upload-outline",
      progresso: 25
    },
    {
      titulo: "Varrendo ofertas em lojas oficiais de varejo...",
      sub: "Consultando Shopee, Mercado Livre, Amazon, Magalu, Casas Bahia, KaBuM! e SHEIN",
      icon: "storefront-outline",
      progresso: 55
    },
    {
      titulo: incluirSeminovos ? "Buscando oportunidades na OLX e Facebook Marketplace..." : "Calibrando menores preços e estoque em tempo real...",
      sub: incluirSeminovos ? "Rastreando classificados e seminovos na sua região" : "Filtrando as melhores condições e aplicando cupons",
      icon: "pricetag-outline",
      progresso: 80
    },
    {
      titulo: "Organizando e comparando menores preços...",
      sub: "Eliminando fraudes e ordenando os melhores negócios encontrados",
      icon: "checkmark-done-circle-outline",
      progresso: 100
    }
  ];

  // Inicia o processo de pesquisa inteligente com tempo estendido e polling em tempo real
  const handleIniciarPesquisaInteligente = async (termoInput) => {
    const termoFinal = (termoInput || termo || '').trim();
    if (!termoFinal) {
      showAlert({
        title: "Atenção",
        message: "Digite o que você deseja procurar ou selecione um segmento.",
        type: "warning",
        icon: "alert-circle"
      });
      return;
    }

    setTermo(termoFinal);
    RecommendationEngine.registrarPesquisaOuRadar(termoFinal, currentOwnerId);

    // Monta lista de URLs oficiais das 10 maiores varejistas e classificados
    const termoEnc = encodeURIComponent(termoFinal);
    const termoSlug = termoFinal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const listaUrls = [
      `https://lista.mercadolivre.com.br/${termoEnc}`,
      `https://shopee.com.br/search?keyword=${termoEnc}`,
      `https://www.amazon.com.br/s?k=${termoEnc}`,
      `https://www.magazineluiza.com.br/busca/${termoEnc}/`,
      `https://www.casasbahia.com.br/${termoSlug}/b`,
      `https://www.kabum.com.br/busca/${termoEnc}`,
      `https://br.shein.com/pdsearch/${termoEnc}`,
      `https://www.carrefour.com.br/busca/${termoEnc}`,
      `https://site.fastshop.com.br/s?q=${termoEnc}`,
      `https://www.americanas.com.br/busca/${termoEnc}`
    ];

    if (incluirSeminovos) {
      const olxUrl = gerarUrlOlx(olxUf, olxRegiao, termoFinal);
      const fbUrl = gerarUrlFacebook(fbCidade, termoFinal);
      if (olxUrl) listaUrls.push(olxUrl);
      if (fbUrl) listaUrls.push(fbUrl);
    }

    // Transiciona para a animação de varredura
    setEtapaBusca('varrendo');
    setFaseIndex(0);
    progressoAnim.setValue(0);

    // Animação contínua do radar
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 2.2,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ])
      ])
    ).start();

    // Barra de progresso para 25 segundos
    Animated.timing(progressoAnim, {
      toValue: 100,
      duration: 25000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Fases da varredura sincronizadas
    const t1 = setTimeout(() => setFaseIndex(1), 3000);
    const t2 = setTimeout(() => setFaseIndex(2), 9000);
    const t3 = setTimeout(() => setFaseIndex(3), 16000);

    const owner = currentOwnerId || 'anonimo';
    let activePesquisaId = null;

    // 1. Limpeza em cascata preventiva de buscas anteriores deste usuário (SEM TOCAR EM MONITORES)
    try {
      await Promise.allSettled([
        supabase.from('pesquisas').delete().eq('usuario_id', owner),
        supabase.from('pesquisa_resultados').delete().eq('usuario_id', owner),
        supabase.from('resultados').delete().eq('usuario_id', owner).eq('destaque_label', 'pesquisa_inteligente'),
        supabase.from('usuario_interesses').delete().eq('usuario_id', owner).in('origem', ['pesquisa_pendente', 'pesquisa_processando', 'pesquisa_concluida'])
      ]);
    } catch (e_clean) {}

    // 2. Registra solicitação no motor de busca dedicado
    try {
      const { data: pesqData } = await supabase.from('pesquisas').insert({
        usuario_id: owner,
        termo: termoFinal,
        incluir_seminovos: Boolean(incluirSeminovos),
        status: 'pendente'
      }).select().maybeSingle();
      if (pesqData?.id) {
        activePesquisaId = pesqData.id;
      }
    } catch (e_p) {}

    try {
      await supabase.from('usuario_interesses').upsert({
        usuario_id: owner,
        termo: termoFinal,
        peso: incluirSeminovos ? 1 : 0,
        origem: 'pesquisa_pendente',
        updated_at: new Date().toISOString()
      }, { onConflict: 'usuario_id, termo' });
    } catch (e_fila) {}

    let buscaFinalizada = false;

    const finalizarBuscaComResultados = async () => {
      if (buscaFinalizada) return;
      buscaFinalizada = true;
      clearInterval(pollInterval);
      if (varreduraTimerRef.current) clearTimeout(varreduraTimerRef.current);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      let itensColetados = [];

      // 1. Busca da tabela dedicada pesquisa_resultados ordenada por maior desconto
      try {
        let q = supabase.from('pesquisa_resultados').select('*');
        if (activePesquisaId) {
          q = q.eq('pesquisa_id', activePesquisaId);
        } else {
          q = q.eq('usuario_id', owner);
        }
        const { data: resDedicados } = await q
          .order('desconto_pct', { ascending: false })
          .order('price', { ascending: true })
          .limit(250);
        if (resDedicados && resDedicados.length > 0) {
          itensColetados = resDedicados.map(r => ({
            id: r.id,
            titulo: r.title,
            preco: r.price ? parseFloat(r.price) : null,
            preco_original: r.preco_original ? parseFloat(r.preco_original) : (r.price ? Math.round(parseFloat(r.price) * 1.22) : null),
            imagem_url: r.imagem_url,
            url: r.url,
            loja: r.loja || RecommendationEngine.identificarLojaPorUrl(r.url),
            desconto_pct: r.desconto_pct || (r.preco_original && r.price ? Math.round(((r.preco_original - r.price) / r.preco_original) * 100) : 18),
            destaque_label: r.destaque_label || 'Oferta Verificada',
            is_seminovo: Boolean(r.is_seminovo || r.loja === 'OLX' || r.loja === 'Facebook Marketplace' || (r.url && (r.url.includes('olx.com') || r.url.includes('facebook.com')))),
            frete_gratis: Boolean(r.frete_gratis !== false)
          }));
        }
      } catch (e_ded) {}

      // 2. Se não encontrou na tabela dedicada, busca de resultados com destaque_label='pesquisa_inteligente'
      if (itensColetados.length === 0) {
        try {
          const { data: resDb } = await supabase
            .from('resultados')
            .select('*')
            .eq('usuario_id', owner)
            .eq('destaque_label', 'pesquisa_inteligente')
            .order('price', { ascending: true })
            .limit(100);

          if (resDb && resDb.length > 0) {
            itensColetados = resDb.map(r => ({
              id: r.id,
              titulo: r.title,
              preco: r.price ? parseFloat(r.price) : null,
              preco_original: r.preco_original ? parseFloat(r.preco_original) : (r.price ? Math.round(parseFloat(r.price) * 1.22) : null),
              imagem_url: r.imagem_url,
              url: r.url,
              loja: r.loja || RecommendationEngine.identificarLojaPorUrl(r.url),
              desconto_pct: r.desconto_pct || 18,
              destaque_label: r.destaque_label || 'Oferta Verificada',
              is_seminovo: Boolean(r.loja === 'OLX' || r.loja === 'Facebook Marketplace' || (r.url && (r.url.includes('olx.com') || r.url.includes('facebook.com')))),
              frete_gratis: true
            }));
          }
        } catch (e_res) {}
      }

      // IMPORTANTE: NÃO realizar busca com match fraco/solto em 'resultados' de outras pesquisas/monitores
      // para evitar retornar produtos irrelevantes (ex: TV quando o usuário pesquisou Cama).

      setResultadosInteligentes(itensColetados);
      setEtapaBusca('resultados');
    };

    // Polling a cada 1.5s: finaliza assim que o motor concluir a pesquisa multiloja
    const pollInterval = setInterval(async () => {
      if (buscaFinalizada) return;
      try {
        if (activePesquisaId) {
          const { data: pRow } = await supabase
            .from('pesquisas')
            .select('status, total_encontrados')
            .eq('id', activePesquisaId)
            .maybeSingle();

          if (pRow && pRow.status === 'concluido') {
            finalizarBuscaComResultados();
            return;
          }
        }
      } catch (e_poll) {}
    }, 1500);

    // Timeout de segurança de 32s para concluir com os melhores dados coletados
    varreduraTimerRef.current = setTimeout(() => {
      finalizarBuscaComResultados();
    }, 32000);
  };

  useEffect(() => {
    return () => {
      if (varreduraTimerRef.current) clearTimeout(varreduraTimerRef.current);
      const owner = currentOwnerId || 'anonimo';
      try {
        supabase.from('pesquisas').delete().eq('usuario_id', owner).then();
        supabase.from('pesquisa_resultados').delete().eq('usuario_id', owner).then();
        supabase.from('resultados').delete().eq('usuario_id', owner).eq('destaque_label', 'pesquisa_inteligente').then();
        supabase.from('usuario_interesses').delete().eq('usuario_id', owner).in('origem', ['pesquisa_pendente', 'pesquisa_processando', 'pesquisa_concluida']).then();
      } catch (e) {}
    };
  }, [currentOwnerId]);

  const handleResultClick = (item) => {
    RecommendationEngine.registrarClique(item.titulo || item.title, currentOwnerId, item.loja);
    if (handleOpenAd) {
      handleOpenAd(item);
    } else if (item.url) {
      Linking.openURL(item.url);
    }
  };

  const handleReiniciarPesquisa = async () => {
    const owner = currentOwnerId || 'anonimo';
    try {
      supabase.from('pesquisas').delete().eq('usuario_id', owner).then();
      supabase.from('pesquisa_resultados').delete().eq('usuario_id', owner).then();
      supabase.from('resultados').delete().eq('usuario_id', owner).eq('destaque_label', 'pesquisa_inteligente').then();
      supabase.from('usuario_interesses').delete().eq('usuario_id', owner).in('origem', ['pesquisa_pendente', 'pesquisa_processando', 'pesquisa_concluida']).then();
    } catch (e) {}
    setEtapaBusca('busca');
    setTermo('');
    setFiltroChip('MAIOR_DESCONTO');
    setResultadosInteligentes([]);
  };

  // Filtragem dos Resultados da Pesquisa Multi-Lojas
  const resultadosFiltrados = useMemo(() => {
    let lista = [...resultadosInteligentes];

    if (filtroChip === 'MENOR_PRECO') {
      lista.sort((a, b) => (parseFloat(a.preco) || 0) - (parseFloat(b.preco) || 0));
    } else if (filtroChip === 'MAIOR_DESCONTO' || filtroChip === 'TODOS') {
      lista.sort((a, b) => (parseInt(b.desconto_pct) || 0) - (parseInt(a.desconto_pct) || 0) || (parseFloat(a.preco) || 0) - (parseFloat(b.preco) || 0));
    } else if (filtroChip === 'SEMINOVOS') {
      lista = lista.filter(item => Boolean(item.is_seminovo) || item.loja === 'OLX' || item.loja === 'Facebook Marketplace');
      lista.sort((a, b) => (parseInt(b.desconto_pct) || 0) - (parseInt(a.desconto_pct) || 0) || (parseFloat(a.preco) || 0) - (parseFloat(b.preco) || 0));
    } else if (filtroChip === 'LOJAS_OFICIAIS') {
      lista = lista.filter(item => !item.is_seminovo && item.loja !== 'OLX' && item.loja !== 'Facebook Marketplace');
      lista.sort((a, b) => (parseInt(b.desconto_pct) || 0) - (parseInt(a.desconto_pct) || 0) || (parseFloat(a.preco) || 0) - (parseFloat(b.preco) || 0));
    } else if (filtroChip === 'FRETE_GRATIS') {
      lista = lista.filter(item => Boolean(item.frete_gratis));
      lista.sort((a, b) => (parseInt(b.desconto_pct) || 0) - (parseInt(a.desconto_pct) || 0) || (parseFloat(a.preco) || 0) - (parseFloat(b.preco) || 0));
    }

    return lista;
  }, [resultadosInteligentes, filtroChip]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Padronizado com Saudação, Sino e Engrenagem */}
      <AppTopHeader 
        user={user} 
        userProfile={userProfile}
        onPressProfile={() => user ? openSettings() : openAuthModal()}
        onOpenNotif={openNotif} 
        onOpenSettings={openSettings} 
        unreadCount={unreadNotifCount} 
      />

      {/* ================================================================= */}
      {/* TELA DE BUSCA: CARD FIXO NO TOPO + 10 SEGMENTOS ABAIXO            */}
      {/* ================================================================= */}
      {etapaBusca === 'busca' && (
        <ScrollView 
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 90 }} 
          showsVerticalScrollIndicator={false}
        >
          {/* CARD DE BUSCA FIXO NO TOPO */}
          <View style={styles.smartSearchPromptBox}>
            <View style={styles.smartSearchPromptHeader}>
              <Ionicons name="search" size={20} color="#FF5722" style={{ marginRight: 8 }} />
              <Text style={styles.smartSearchPromptTitle}>
                O que você deseja procurar?
              </Text>
            </View>

            {/* Texto Criativo de Instrução */}
            <Text style={styles.smartSearchInstructionText}>
              Digite abaixo o produto desejado ou escolha um dos segmentos abaixo para comparar preços em tempo real:
            </Text>

            {/* Campo de Entrada de Texto */}
            <View style={styles.smartSearchInputWrap}>
              <TextInput
                style={styles.smartSearchInput}
                placeholder="Ex: iPhone 15, PS5, Geladeira Frost Free..."
                placeholderTextColor="#94A3B8"
                value={termo}
                onChangeText={setTermo}
                returnKeyType="search"
                onSubmitEditing={() => handleIniciarPesquisaInteligente(termo)}
              />
              {termo.length > 0 && (
                <TouchableOpacity onPress={() => setTermo('')} style={{ padding: 6 }}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Toggle para OLX e Facebook Marketplace */}
            <View style={styles.smartToggleRow}>
              <View style={styles.smartToggleLabelWrap}>
                <Ionicons name="pricetags-outline" size={18} color="#6366F1" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.smartToggleTitle}>Incluir OLX e Facebook Marketplace?</Text>
                  <Text style={styles.smartToggleSubtitle}>Busca classificados e seminovos na sua região</Text>
                </View>
              </View>
              <Switch
                value={incluirSeminovos}
                onValueChange={setIncluirSeminovos}
                trackColor={{ false: '#CBD5E1', true: '#6366F1' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Seletores de Localização (Quando o Toggle Está Ativo) */}
            {incluirSeminovos && (
              <View style={styles.smartLocationContainer}>
                {/* Seletor OLX */}
                <View style={styles.smartLocationSection}>
                  <View style={[styles.row, { marginBottom: 6 }]}>
                    <StoreLogoBadge storeKey="OLX" size={18} style={{ marginRight: 6 }} />
                    <Text style={styles.smartLocationPlatformTitle}>Localização OLX:</Text>
                  </View>
                  <View style={styles.smartLocationSelectorsRow}>
                    {/* Botão Estado OLX */}
                    <TouchableOpacity
                      style={styles.smartLocationBtn}
                      activeOpacity={0.7}
                      onPress={() => setModalOlxUfVisible(true)}
                    >
                      <View style={{ flex: 1, marginRight: 4 }}>
                        <Text style={styles.smartLocationBtnLabel}>Estado</Text>
                        <Text style={styles.smartLocationBtnValue} numberOfLines={1}>
                          {olxUf === 'BR' ? 'Brasil Inteiro' : (OLX_ESTADOS[olxUf]?.nome || olxUf)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={14} color="#64748B" />
                    </TouchableOpacity>

                    {/* Botão Região OLX */}
                    <TouchableOpacity
                      style={[styles.smartLocationBtn, olxUf === 'BR' && styles.smartLocationBtnDisabled]}
                      activeOpacity={olxUf === 'BR' ? 1 : 0.7}
                      onPress={() => {
                        if (olxUf !== 'BR') setModalOlxRegiaoVisible(true);
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 4 }}>
                        <Text style={styles.smartLocationBtnLabel}>Região</Text>
                        <Text style={styles.smartLocationBtnValue} numberOfLines={1}>
                          {olxUf === 'BR' 
                            ? 'Todas as Regiões' 
                            : (olxRegiao 
                              ? (OLX_ESTADOS[olxUf]?.regioes.find(r => r.slug === olxRegiao)?.nome || olxRegiao) 
                              : 'Todo o Estado')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={14} color={olxUf === 'BR' ? '#CBD5E1' : '#64748B'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Seletor Facebook Marketplace */}
                <View style={[styles.smartLocationSection, { marginTop: 10 }]}>
                  <View style={[styles.row, { marginBottom: 6 }]}>
                    <StoreLogoBadge storeKey="Facebook" size={18} style={{ marginRight: 6 }} />
                    <Text style={styles.smartLocationPlatformTitle}>Localização Facebook Marketplace:</Text>
                  </View>
                  <View style={styles.smartLocationSelectorsRow}>
                    {/* Botão Estado FB */}
                    <TouchableOpacity
                      style={styles.smartLocationBtn}
                      activeOpacity={0.7}
                      onPress={() => setModalFbUfVisible(true)}
                    >
                      <View style={{ flex: 1, marginRight: 4 }}>
                        <Text style={styles.smartLocationBtnLabel}>Estado</Text>
                        <Text style={styles.smartLocationBtnValue} numberOfLines={1}>
                          {fbUf === 'BR' ? 'Brasil Inteiro' : (FACEBOOK_ESTADOS_CIDADES[fbUf]?.nome || fbUf)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={14} color="#64748B" />
                    </TouchableOpacity>

                    {/* Botão Cidade FB */}
                    <TouchableOpacity
                      style={[styles.smartLocationBtn, fbUf === 'BR' && styles.smartLocationBtnDisabled]}
                      activeOpacity={fbUf === 'BR' ? 1 : 0.7}
                      onPress={() => {
                        if (fbUf !== 'BR') setModalFbCidadeVisible(true);
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 4 }}>
                        <Text style={styles.smartLocationBtnLabel}>Cidade</Text>
                        <Text style={styles.smartLocationBtnValue} numberOfLines={1}>
                          {fbUf === 'BR' 
                            ? 'Todas as Cidades' 
                            : (fbCidade && fbCidade !== 'brasil' 
                              ? (FACEBOOK_ESTADOS_CIDADES[fbUf]?.cidades.find(c => c.slug === fbCidade)?.nome || fbCidade) 
                              : 'Todo o Estado')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={14} color={fbUf === 'BR' ? '#CBD5E1' : '#64748B'} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Botão de Ação "Pesquisa Inteligente" */}
            <TouchableOpacity
              style={styles.smartSearchActionBtn}
              onPress={() => handleIniciarPesquisaInteligente(termo)}
              activeOpacity={0.88}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.smartSearchActionBtnText}>Pesquisa Inteligente</Text>
            </TouchableOpacity>
          </View>

          {/* TÍTULO DOS 10 SEGMENTOS LOGO ABAIXO DO CARD DE BUSCA */}
          <View style={[styles.row, { marginTop: 22, marginBottom: 6 }]}>
            <Ionicons name="grid-outline" size={16} color="#FF5722" style={{ marginRight: 6 }} />
            <Text style={styles.smartSearchSectionTitle}>
              Ou pesquise por segmento:
            </Text>
          </View>
          <Text style={styles.smartSearchSectionSubtitle}>
            Toque em um departamento para comparar os produtos mais populares em tempo real:
          </Text>

          {/* Grid dos 10 Segmentos Oficiais */}
          <View style={styles.smartCategoriesGrid}>
            {CATEGORIAS_PESQUISA.map(cat => {
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.smartCategoryCard, 
                    { backgroundColor: cat.bg }
                  ]}
                  onPress={() => {
                    handleIniciarPesquisaInteligente(cat.query);
                  }}
                  activeOpacity={0.82}
                >
                  <View style={styles.smartCategoryIconBox}>
                    <Ionicons 
                      name={cat.icon} 
                      size={22} 
                      color="#0F172A" 
                    />
                  </View>
                  <Text 
                    style={styles.smartCategoryLabel} 
                    numberOfLines={1}
                  >
                    {cat.label}
                  </Text>
                  <Text style={styles.smartCategoryActionHint}>
                    Comparar ofertas
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ================================================================= */}
      {/* ETAPA 2: TELA LIMPA BRANCA COM ANIMAÇÃO DE 10 SEGUNDOS            */}
      {/* ================================================================= */}
      {etapaBusca === 'varrendo' && (
        <View style={styles.smartSweepCanvas}>
          {/* Círculo do Radar com Pulsos Concorrentes */}
          <View style={styles.smartRadarWrapper}>
            <Animated.View 
              style={[
                styles.smartRadarPulseRing,
                {
                  transform: [{ scale: ringScale }],
                  opacity: ringOpacity
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.smartRadarPulseCore,
                { transform: [{ scale: pulseAnim }] }
              ]}
            >
              <Ionicons name="search" size={36} color="#FFFFFF" />
            </Animated.View>
          </View>

          {/* Badge de Plataformas Ativas */}
          <View style={styles.smartSweepStoresRow}>
            <StoreLogoBadge storeKey="Mercado Livre" size={24} style={{ marginHorizontal: 3 }} />
            <StoreLogoBadge storeKey="Shopee" size={24} style={{ marginHorizontal: 3 }} />
            <StoreLogoBadge storeKey="Amazon" size={24} style={{ marginHorizontal: 3 }} />
            <StoreLogoBadge storeKey="Magalu" size={24} style={{ marginHorizontal: 3 }} />
            <StoreLogoBadge storeKey="KaBuM!" size={24} style={{ marginHorizontal: 3 }} />
            <StoreLogoBadge storeKey="Casas Bahia" size={24} style={{ marginHorizontal: 3 }} />
            <StoreLogoBadge storeKey="SHEIN" size={24} style={{ marginHorizontal: 3 }} />
            {incluirSeminovos && (
              <>
                <StoreLogoBadge storeKey="OLX" size={24} style={{ marginHorizontal: 3 }} />
                <StoreLogoBadge storeKey="Facebook" size={24} style={{ marginHorizontal: 3 }} />
              </>
            )}
          </View>

          {/* Termo Buscado */}
          <Text style={styles.smartSweepTermTitle}>
            "{termo}"
          </Text>

          {/* Mensagem da Fase Atual */}
          <View style={styles.smartSweepPhaseBox}>
            <View style={styles.row}>
              <Ionicons 
                name={FASES_VARREDURA[faseIndex].icon} 
                size={18} 
                color="#FF5722" 
                style={{ marginRight: 6 }} 
              />
              <Text style={styles.smartSweepPhaseTitle}>
                {FASES_VARREDURA[faseIndex].titulo}
              </Text>
            </View>
            <Text style={styles.smartSweepPhaseSubtitle}>
              {FASES_VARREDURA[faseIndex].sub}
            </Text>
          </View>

          {/* Barra de Progresso Suave dos 10s */}
          <View style={styles.smartSweepProgressBarBg}>
            <Animated.View 
              style={[
                styles.smartSweepProgressBarFill, 
                { 
                  width: progressoAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  })
                }
              ]} 
            />
          </View>
          <Text style={styles.smartSweepTimerText}>
            Varredura inteligente em andamento (~20s)
          </Text>
        </View>
      )}

      {/* ================================================================= */}
      {/* ETAPA 3: RESULTADOS MULTI-LOJAS COM FILTROS                       */}
      {/* ================================================================= */}
      {etapaBusca === 'resultados' && (
        <View style={{ flex: 1 }}>
          {/* Top Bar de Resultados: Contagem + Botão Nova Pesquisa */}
          <View style={styles.smartResultsTopBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.smartResultsQueryTitle} numberOfLines={1}>
                "{termo}"
              </Text>
              <Text style={styles.smartResultsCountSub}>
                {resultadosFiltrados.length} ofertas encontradas
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.smartNewSearchBtn}
              onPress={handleReiniciarPesquisa}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={14} color="#FF5722" style={{ marginRight: 4 }} />
              <Text style={styles.smartNewSearchBtnText}>Nova Pesquisa</Text>
            </TouchableOpacity>
          </View>

          {/* Chips de Filtro e Ordenação com Container Protetor */}
          <View style={styles.smartFilterChipsContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.smartFilterChipsRow}
            >
              {[
                { key: 'MAIOR_DESCONTO', label: '🔥 Maior Desconto' },
                { key: 'MENOR_PRECO', label: 'Menor Preço' },
              ].map(chip => {
                const active = filtroChip === chip.key;
                return (
                  <TouchableOpacity
                    key={chip.key}
                    style={[styles.smartFilterChip, active && styles.smartFilterChipActive]}
                    onPress={() => setFiltroChip(chip.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.smartFilterChipText, active && styles.smartFilterChipTextActive]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Lista de Resultados Virtualizada com FlatList (Desempenho Máximo e Zero Lag) */}
          <FlatList 
            data={resultadosFiltrados}
            keyExtractor={(item, index) => item?.id ? String(item.id) : (item?.url ? String(item.url) : String(index))}
            renderItem={({ item }) => (
              <ProductDealCard
                item={item}
                onPress={() => handleResultClick(item)}
                onToggleFavorite={(deal) => RecommendationEngine.registrarFavorito(deal?.titulo || deal?.title || item.titulo, currentOwnerId, deal?.loja || item.loja)}
              />
            )}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={styles.feedScrollContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyFeedBox}>
                <Ionicons name="search-outline" size={44} color="#94A3B8" />
                <Text style={styles.emptyTitle}>Nenhuma oferta encontrada</Text>
                <Text style={styles.emptyDesc}>
                  Nenhum produto correspondente a "{termo}" foi encontrado no momento. Tente buscar por outros termos ou crie um Radar Inteligente.
                </Text>
                <TouchableOpacity 
                  style={[styles.smartNewSearchBtn, { marginTop: 16 }]}
                  onPress={handleReiniciarPesquisa}
                >
                  <Text style={styles.smartNewSearchBtnText}>Voltar à Pesquisa</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      )}

      {/* Modal Seletor de UF da OLX */}
      <SelectionModal
        visible={modalOlxUfVisible}
        title="Selecione o Estado (OLX)"
        items={itensOlxEstados}
        selectedId={olxUf}
        onSelect={(item) => {
          setOlxUf(item.id);
          setOlxRegiao('');
          setModalOlxUfVisible(false);
        }}
        onClose={() => setModalOlxUfVisible(false)}
      />

      {/* Modal Seletor de Região da OLX */}
      <SelectionModal
        visible={modalOlxRegiaoVisible}
        title={`Região em ${OLX_ESTADOS[olxUf]?.nome || olxUf} (OLX)`}
        items={itensOlxRegioes}
        selectedId={olxRegiao}
        onSelect={(item) => {
          setOlxRegiao(item.id);
          setModalOlxRegiaoVisible(false);
        }}
        onClose={() => setModalOlxRegiaoVisible(false)}
      />

      {/* Modal Seletor de UF do Facebook */}
      <SelectionModal
        visible={modalFbUfVisible}
        title="Selecione o Estado (Facebook)"
        items={itensFbEstados}
        selectedId={fbUf}
        onSelect={(item) => {
          setFbUf(item.id);
          setFbCidade('brasil');
          setModalFbUfVisible(false);
        }}
        onClose={() => setModalFbUfVisible(false)}
      />

      {/* Modal Seletor de Cidade do Facebook */}
      <SelectionModal
        visible={modalFbCidadeVisible}
        title={`Cidade em ${FACEBOOK_ESTADOS_CIDADES[fbUf]?.nome || fbUf} (Facebook)`}
        items={itensFbCidades}
        selectedId={fbCidade}
        onSelect={(item) => {
          setFbCidade(item.id);
          setModalFbCidadeVisible(false);
        }}
        onClose={() => setModalFbCidadeVisible(false)}
      />

    </View>
  );
}
// =====================================================================
// MODAL: NOTIFICAÇÕES & HISTÓRICO DE ALERTAS COM ANIMAÇÃO PROFISSIONAL
// =====================================================================
function NotificationsModal({ visible, onClose, onClearAll }) {
  const { 
    resultados, notificacoesAtivas, alternarNotificacoes, 
    handleOpenAd, testLocalNotification, showAlert 
  } = useContext(RadarContext);

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = useState(visible);
  const isClosingRef = useRef(false);

  useEffect(() => {
    slideAnim.stopAnimation();
    fadeAnim.stopAnimation();

    if (visible) {
      isClosingRef.current = false;
      setShowModal(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      isClosingRef.current = true;
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && isClosingRef.current) {
          setShowModal(false);
          isClosingRef.current = false;
        }
      });
    }
  }, [visible, SCREEN_HEIGHT]);

  const handleClose = () => {
    onClose();
  };

  if (!showModal) return null;

  return (
    <Modal visible={showModal} animationType="none" transparent onRequestClose={handleClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Backdrop estático escuro que esmaece suavemente (sem subir da tela!) */}
        <Animated.View style={[styles.modalOverlayStaticBackdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={handleClose} 
          />
        </Animated.View>

        {/* Modal de notificações deslizando suavemente de baixo para cima */}
        <Animated.View 
          style={[
            styles.notifDrawerContent, 
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Header */}
          <View style={styles.notifDrawerHeader}>
            <View style={styles.row}>
              <Ionicons name="notifications" size={22} color={THEME.primary} style={{ marginRight: 8 }} />
              <Text style={styles.notifDrawerTitle}>Notificações</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {resultados && resultados.length > 0 && (
                <TouchableOpacity 
                  onPress={onClearAll} 
                  style={styles.notifClearAllBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={styles.notifClearAllBtnText}>Limpar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose} style={[styles.notifCloseBtn, { marginLeft: 8 }]}>
                <Ionicons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Toggle de Notificações Push */}
          <View style={styles.notifToggleRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.notifToggleTitle}>Alertas no Aparelho</Text>
              <Text style={styles.notifToggleSub}>Receba avisos instantâneos de novos preços baixos</Text>
            </View>
            <Switch
              value={Boolean(notificacoesAtivas)}
              onValueChange={alternarNotificacoes}
              trackColor={{ false: '#CBD5E1', true: THEME.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Botão de Testar Notificação Push */}
          <TouchableOpacity
            style={styles.notifTestPushBtn}
            activeOpacity={0.7}
            onPress={async () => {
              try {
                await testLocalNotification();
                showAlert({
                  title: "Notificação Enviada!",
                  message: "Verifique sua central de notificações do aparelho.",
                  type: "success",
                  icon: "notifications"
                });
              } catch (e) {
                showAlert({
                  title: "Aviso",
                  message: "Não foi possível disparar a notificação local.",
                  type: "warning"
                });
              }
            }}
          >
            <Ionicons name="notifications-outline" size={15} color="#EA580C" style={{ marginRight: 6 }} />
            <Text style={styles.notifTestPushBtnText}>Testar Envio de Notificação Push</Text>
          </TouchableOpacity>

          {/* Lista de Notificações Recebidas */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.notifListHeaderTitle}>HISTÓRICO RECENTE</Text>
            <Text style={styles.notifCountSub}>
              {resultados ? `${resultados.length} alertas` : '0 alertas'}
            </Text>
          </View>

          <ScrollView style={styles.notifScrollList} showsVerticalScrollIndicator={false}>
            {(!resultados || resultados.length === 0) ? (
              <View style={styles.notifEmptyState}>
                <Ionicons name="notifications-off-outline" size={36} color="#94A3B8" />
                <Text style={styles.notifEmptyStateTitle}>Nenhum alerta recente</Text>
                <Text style={styles.notifEmptyStateSub}>
                  Assim que encontrarmos produtos no preço que você monitora, eles aparecerão aqui.
                </Text>
              </View>
            ) : (
              resultados.slice(0, 30).map((r, idx) => (
                <TouchableOpacity
                  key={r.id || idx}
                  style={styles.notifItemRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    handleClose();
                    if (r.url) Linking.openURL(r.url);
                  }}
                >
                  <View style={styles.notifItemIconBox}>
                    <StoreLogoBadge storeKey={r.loja || RecommendationEngine.identificarLojaPorUrl(r.url)} size={24} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.notifItemTitle} numberOfLines={2}>
                      {r.title || 'Oferta imperdível encontrada'}
                    </Text>
                    <View style={styles.row}>
                      <Text style={styles.notifItemPrice}>
                        {r.price ? `R$ ${parseFloat(r.price).toFixed(2)}` : 'Ver oferta'}
                      </Text>
                      {r.loja && (
                        <Text style={styles.notifItemStore}> • {r.loja}</Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
// =====================================================================
// MODAL GAVETA LATERAL: CONFIGURAÇÕES & CONTA (FLUIDO 60FPS)
// =====================================================================
function SettingsDrawerModal({ visible, onClose }) {
  const { 
    user, deviceId, pushToken, tier, tierState, trialEligibility, 
    activatingTrial, subscribing, handleActivateTrial, handleSubscribePremium, 
    logoutUser, linkAccount, notificacoesAtivas, alternarNotificacoes, 
    testLocalNotification, showAlert, onRefresh, openAuthModal 
  } = useContext(RadarContext);

  const [authLoading, setAuthLoading] = useState(false);
  const [cleaningCache, setCleaningCache] = useState(false);

  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const DRAWER_WIDTH = Math.round(Math.min(SCREEN_WIDTH * 0.82, 380));

  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showModal, setShowModal] = useState(visible);
  const isClosingRef = useRef(false);

  useEffect(() => {
    slideAnim.stopAnimation();
    fadeAnim.stopAnimation();

    if (visible) {
      isClosingRef.current = false;
      setShowModal(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      isClosingRef.current = true;
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: DRAWER_WIDTH,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && isClosingRef.current) {
          setShowModal(false);
          isClosingRef.current = false;
        }
      });
    }
  }, [visible, DRAWER_WIDTH]);

  const handleClose = () => {
    onClose();
  };

  const currentTier = tierState?.tier || tier || 'free';
  const isTrialActive = currentTier === 'premium_lite';
  const isPremium = currentTier === 'premium';
  const isAdmin = currentTier === 'admin';
  const isFree = currentTier === 'free';

  const tierBadgeInfo = useMemo(() => {
    if (isAdmin) {
      return {
        label: "Administrador Master",
        icon: "shield-checkmark",
        bg: "#FEF3C7",
        border: "#FDE68A",
        text: "#B45309",
        desc: "Acesso total e irrestrito a todos os recursos, radares e diagnósticos do sistema."
      };
    }
    if (isPremium) {
      return {
        label: "Assinante Premium",
        icon: "star",
        bg: "#F3E8FF",
        border: "#E9D5FF",
        text: "#7E22CE",
        desc: tierState?.expiresAt ? `Assinatura ativa até ${new Date(tierState.expiresAt).toLocaleDateString('pt-BR')}` : "Assinatura Premium ativa."
      };
    }
    if (isTrialActive) {
      return {
        label: "Premium Light (Teste 48h)",
        icon: "sparkles",
        bg: "#FFF7ED",
        border: "#FFEDD5",
        text: "#EA580C",
        desc: tierState?.expiresAt ? `Período de teste ativo até ${new Date(tierState.expiresAt).toLocaleDateString('pt-BR')}` : "Período de teste de 2 dias ativo."
      };
    }
    return {
      label: "Plano Gratuito",
      icon: "cube-outline",
      bg: "#F1F5F9",
      border: "#CBD5E1",
      text: "#475569",
      desc: "Modo gratuito padrão. Todas as lojas integradas e alertas no aparelho."
    };
  }, [currentTier, isAdmin, isPremium, isTrialActive, tierState?.expiresAt]);

  const handleCopyDeviceId = async () => {
    if (!deviceId) return;
    try {
      await Clipboard.setStringAsync(deviceId);
      try { Vibration.vibrate(20); } catch(e) {}
      showAlert({ title: "Copiado!", message: "ID do aparelho copiado para a área de transferência.", type: "success" });
    } catch (e) {
      showAlert({ title: "ID do Aparelho", message: deviceId, type: "info" });
    }
  };

  const handleLimparCache = async () => {
    try {
      setCleaningCache(true);
      await AsyncStorage.multiRemove([
        '@achoai_cached_recommendations_v9',
        '@achoai_home_promotions_v9',
        '@achoai_last_rec_update_timestamp_v9',
        '@achoai_home_promotions_timestamp_v9',
        '@achoai_user_profile_cache',
        '@radar_renewal_modal_shown_session'
      ]);
      // Conforme arquitetura de privacidade: limpa e desloga automaticamente
      if (user) {
        await logoutUser();
      }
      if (onRefresh) onRefresh();
      showAlert({ 
        title: "Cache Limpo!", 
        message: "Dados locais, imagens e sessão foram limpos. Faça login novamente para reconectar.", 
        type: "success" 
      });
    } catch (e) {
      showAlert({ title: "Aviso", message: "Não foi possível limpar o cache local.", type: "warning" });
    } finally {
      setCleaningCache(false);
    }
  };

  if (!showModal) return null;

  return (
    <Modal visible={showModal} transparent onRequestClose={handleClose} animationType="none">
      <View style={{ flex: 1 }}>
        {/* Backdrop escurecido estático que fadeia suavemente */}
        <Animated.View style={[styles.drawerBackdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={handleClose} 
          />
        </Animated.View>

        {/* Gaveta lateral deslizando a 60fps com aceleração por hardware */}
        <Animated.View 
          renderToHardwareTextureAndroid={true}
          style={[
            styles.sideDrawerContainer, 
            { width: DRAWER_WIDTH, transform: [{ translateX: slideAnim }] }
          ]}
        >
          {/* Header da Gaveta */}
          <View style={styles.sideDrawerHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="settings" size={20} color={THEME.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sideDrawerTitle}>Configurações</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.notifCloseBtn}>
              <Ionicons name="close" size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={styles.sideDrawerScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Conta do Usuário / Login Google */}
            <View style={styles.settingsCard}>
              <View style={styles.row}>
                <View style={styles.settingsAvatar}>
                  <Ionicons name={user ? "person" : "phone-portrait-outline"} size={22} color={THEME.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.settingsAccountName}>
                    {user?.email || 'Modo Visitante (Aparelho)'}
                  </Text>
                  <Text style={styles.settingsAccountSub}>
                    {user ? 'Conta sincronizada em nuvem via Google' : 'Uso anônimo livre no seu aparelho'}
                  </Text>
                </View>
              </View>

              {user ? (
                <TouchableOpacity style={styles.settingsAuthBtnOutline} onPress={logoutUser}>
                  <Ionicons name="log-out-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={[styles.settingsAuthBtnText, { color: '#EF4444' }]}>Desconectar Conta Google</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.settingsAuthBtnPrimary} 
                  onPress={() => {
                    handleClose();
                    openAuthModal();
                  }}
                >
                  <Ionicons name="logo-google" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.settingsAuthBtnTextPrimary}>Entrar ou Criar Conta</Text>
                </TouchableOpacity>
              )}

              {/* ID Único do Aparelho com Botão de Copiar */}
              <View style={styles.settingsDeviceIdRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsDeviceIdLabel}>ID DO DISPOSITIVO</Text>
                  <Text style={styles.settingsDeviceIdValue} numberOfLines={1}>
                    {deviceId || 'Detectando aparelho...'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.settingsCopyBtn} onPress={handleCopyDeviceId}>
                  <Ionicons name="copy-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                  <Text style={styles.settingsCopyBtnText}>Copiar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Plano & Benefícios (Free, Premium, Premium Light, Admin) */}
            <View style={styles.settingsCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.settingsCardTitle}>Seu Plano Atual</Text>
                <View style={[styles.settingsTierBadge, { backgroundColor: tierBadgeInfo.bg, borderColor: tierBadgeInfo.border }]}>
                  <Ionicons name={tierBadgeInfo.icon} size={12} color={tierBadgeInfo.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.settingsTierBadgeText, { color: tierBadgeInfo.text }]}>
                    {tierBadgeInfo.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.settingsTierDescText}>
                {tierBadgeInfo.desc}
              </Text>

              {/* Ações de Upgrade e Teste Grátis de 2 Dias para Plano Free */}
              {isFree && (
                <View style={{ marginTop: 12 }}>
                  {trialEligibility?.canActivate && (
                    <TouchableOpacity 
                      style={styles.settingsTrialBtn}
                      onPress={() => {
                        handleClose();
                        handleActivateTrial(deviceId, user, pushToken);
                      }}
                      disabled={activatingTrial}
                    >
                      {activatingTrial ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.settingsTrialBtnText}>Ativar Teste Grátis de 2 Dias (Premium Light)</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    style={styles.settingsUpgradeBtn}
                    onPress={() => {
                      handleClose();
                      handleSubscribePremium();
                    }}
                    disabled={subscribing}
                  >
                    {subscribing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="star" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.settingsUpgradeBtnText}>Assinar Premium (R$ 39,90/mês)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Alertas & Notificações Push */}
            <View style={styles.settingsCard}>
              <Text style={styles.settingsCardTitle}>Alertas & Notificações</Text>
              
              <View style={styles.settingsSwitchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.settingsSwitchTitle}>Notificações Push em Tempo Real</Text>
                  <Text style={styles.settingsSwitchSub}>
                    {notificacoesAtivas ? 'Ativado: você recebe avisos imediatos de novos preços' : 'Pausado: notificações silenciosas'}
                  </Text>
                </View>
                <Switch
                  value={Boolean(notificacoesAtivas)}
                  onValueChange={alternarNotificacoes}
                  thumbColor="#FFFFFF"
                  trackColor={{ false: '#CBD5E1', true: THEME.primary }}
                />
              </View>

              <TouchableOpacity
                style={styles.settingsTestNotifBtn}
                onPress={async () => {
                  try {
                    await testLocalNotification();
                    showAlert({ title: "Teste Enviado!", message: "Verifique sua barra de notificações do Android.", type: "success" });
                  } catch(e) {
                    showAlert({ title: "Aviso", message: "Não foi possível disparar o teste.", type: "warning" });
                  }
                }}
              >
                <Ionicons name="notifications-outline" size={16} color={THEME.primary} style={{ marginRight: 6 }} />
                <Text style={styles.settingsTestNotifBtnText}>Testar Notificação Push</Text>
              </TouchableOpacity>
            </View>

            {/* Limpeza de Cache & Manutenção */}
            <View style={styles.settingsCard}>
              <Text style={styles.settingsCardTitle}>Armazenamento & Cache</Text>
              <Text style={styles.settingsCardSub}>
                Renove o catálogo de ofertas em cache. Como medida de privacidade, sua sessão será reiniciada.
              </Text>
              <TouchableOpacity 
                style={styles.settingsCleanCacheBtn}
                onPress={handleLimparCache}
                disabled={cleaningCache}
              >
                {cleaningCache ? (
                  <ActivityIndicator size="small" color="#64748B" />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={16} color="#0F172A" style={{ marginRight: 6 }} />
                    <Text style={styles.settingsCleanCacheBtnText}>Limpar Cache e Sincronizar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Sobre o Motor */}
            <View style={{ alignItems: 'center', marginVertical: 20 }}>
              <Text style={styles.aboutVersionText}>AchôAI v2.1 • Edição 2026</Text>
              <Text style={styles.aboutMottoText}>O radar inteligente que encontra as melhores ofertas.</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// =====================================================================
// MODAL: CONVITE DE LOGIN & TUTORIAL DE SINCRONIZAÇÃO EM NUVEM (COMPACTO)
// =====================================================================
function AuthTutorialModal({ visible, onClose }) {
  const { 
    linkAccount, showAlert,
    notificacoesAtivas, alternarNotificacoes 
  } = useContext(RadarContext);

  const [authLoading, setAuthLoading] = useState(false);
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const [showModal, setShowModal] = useState(visible);
  const isClosingRef = useRef(false);

  useEffect(() => {
    slideAnim.stopAnimation();
    fadeAnim.stopAnimation();
    scaleAnim.stopAnimation();

    if (visible) {
      isClosingRef.current = false;
      setShowModal(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      isClosingRef.current = true;
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.94,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && isClosingRef.current) {
          setShowModal(false);
          isClosingRef.current = false;
        }
      });
    }
  }, [visible, SCREEN_HEIGHT]);

  const handleClose = () => {
    onClose();
  };

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
        showAlert({ title: "Google Sign-In", message: error.message, type: "error" });
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
            handleClose();
            showAlert({ 
              title: "Bem-vindo!", 
              message: "Sua conta Google foi conectada. Seus radares e alertas agora estão sincronizados na nuvem!", 
              type: "success" 
            });
          }
        }
      }
    } catch (e) {
      showAlert({ title: "Aviso", message: "Serviço de autenticação temporariamente indisponível.", type: "warning" });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAtivarNotificacoesModal = async () => {
    try {
      await alternarNotificacoes(true);
      showAlert({ 
        title: "Notificações Ativadas!", 
        message: "Seu aparelho agora receberá alertas instantâneos assim que uma oferta for achada.", 
        type: "success" 
      });
    } catch (e) {
      showAlert({ title: "Aviso", message: "Verifique as permissões de notificação no seu celular.", type: "warning" });
    }
  };

  if (!showModal) return null;

  return (
    <Modal visible={showModal} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.authModalCenteredContainer}>
        {/* Backdrop escuro com fade suave */}
        <Animated.View style={[styles.modalOverlayStaticBackdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        </Animated.View>

        {/* Modal de Login e Tutorial Compacto (100% visível na tela sem scroll) */}
        <Animated.View 
          renderToHardwareTextureAndroid={true}
          style={[
            styles.authTutorialCardCompact, 
            { 
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }] 
            }
          ]}
        >
          {/* Header do Modal */}
          <View style={styles.authTutorialHeader}>
            <View style={styles.authBadgeIconBox}>
              <Ionicons name="sparkles" size={16} color="#FF5722" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.authTutorialTitle}>Sua Conta AchôAI</Text>
              <Text style={styles.authTutorialSubtitle}>
                Sincronize seus radares e alertas em tempo real
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.notifCloseBtn}>
              <Ionicons name="close" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* 3 Benefícios Compactos */}
          <View style={styles.authBenefitsBox}>
            <View style={styles.authBenefitRow}>
              <View style={[styles.authBenefitIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="cloud-done-outline" size={14} color="#3B82F6" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.authBenefitTitle}>Sincronização em Múltiplos Aparelhos</Text>
                <Text style={styles.authBenefitDesc}>
                  Acompanhe seus radares no celular, tablet ou outro dispositivo.
                </Text>
              </View>
            </View>

            <View style={styles.authBenefitRow}>
              <View style={[styles.authBenefitIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.authBenefitTitle}>Privacidade e Armazenamento Local</Text>
                <Text style={styles.authBenefitDesc}>
                  Seu nome e foto ficam exclusivamente na memória deste aparelho.
                </Text>
              </View>
            </View>

            <View style={styles.authBenefitRow}>
              <View style={[styles.authBenefitIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="infinite-outline" size={14} color="#FF5722" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.authBenefitTitle}>Uso Livre e Flexível</Text>
                <Text style={styles.authBenefitDesc}>
                  Crie radares normalmente; sua conta protege seus dados e alertas.
                </Text>
              </View>
            </View>
          </View>

          {/* Botão Principal: Conectar com o Google */}
          <TouchableOpacity 
            style={styles.authGoogleButton}
            onPress={handleLoginGoogle}
            disabled={authLoading}
            activeOpacity={0.85}
          >
            {authLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="logo-google" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.authGoogleButtonText}>Continuar com o Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Seção Importante: Notificações no Aparelho */}
          <View style={styles.authNotifBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="notifications" size={14} color={notificacoesAtivas ? "#16A34A" : "#EA580C"} style={{ marginRight: 5 }} />
              <Text style={styles.authNotifBannerTitle}>
                {notificacoesAtivas ? "Alertas Ativos no Aparelho" : "Mantenha as Notificações Ativadas"}
              </Text>
            </View>
            <Text style={styles.authNotifBannerDesc}>
              O radar vigia preços 24h. Ative para receber alertas no instante da oferta.
            </Text>

            {!notificacoesAtivas ? (
              <TouchableOpacity 
                style={styles.authEnableNotifBtn}
                onPress={handleAtivarNotificacoesModal}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.authEnableNotifBtnText}>Ativar Notificações no Aparelho</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.authNotifActiveBadge}>
                <Ionicons name="checkmark-circle" size={13} color="#16A34A" style={{ marginRight: 4 }} />
                <Text style={styles.authNotifActiveBadgeText}>Notificações push em tempo real ativadas</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
// =====================================================================
// ASSISTENTE DE CRIAÇÃO DE RADAR EM 3 ETAPAS (FULL SCREEN WIZARD)
// =====================================================================
function CreateMonitorScreen({ navigation, route }) {
  const { currentOwnerId, onRefresh, showAlert } = useContext(RadarContext);
  const editando = route?.params?.monitor;

  // Etapa Atual do Assistente (1: Lojas, 2: Produto & Estratégia, 3: Frequência & Ativação)
  const [etapa, setEtapa] = useState(1);

  // Etapa 1: Plataformas (Inicia com ZERO lojas selecionadas a menos que esteja editando)
  const [selectedPlatforms, setSelectedPlatforms] = useState(() => {
    if (editando?.plataforma) {
      return editando.plataforma.split(',').map(p => p.trim()).filter(Boolean);
    }
    if (editando?.urls) {
      const p = identificarPlataforma(editando.urls);
      return (p && p !== 'OUTROS') ? [p] : [];
    }
    return [];
  });

  // Etapa 2: Produto, Estratégia e Filtros
  const [produto, setProduto] = useState(editando?.produto || editando?.palavras?.split(' ')[0] || '');
  const [estrategia, setEstrategia] = useState(() => {
    if (editando?.modo) return editando.modo;
    if (editando?.preco_alvo) return 'preco_alvo';
    return 'menor_preco';
  });

  // Máscara monetária em tempo real (R$ 3.500,00)
  const formatarMoeda = (valorStr) => {
    const digits = String(valorStr || '').replace(/\D/g, '');
    if (!digits) return '';
    const val = (parseInt(digits, 10) / 100).toFixed(2);
    const parts = val.split('.');
    const inteira = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${inteira},${parts[1]}`;
  };

  const [precoAlvo, setPrecoAlvo] = useState(() => {
    if (editando?.preco_alvo) {
      const v = parseFloat(editando.preco_alvo);
      if (!isNaN(v) && v > 0) {
        return formatarMoeda((v * 100).toFixed(0));
      }
    }
    return '';
  });

  const handleChangePrecoAlvo = (texto) => {
    setPrecoAlvo(formatarMoeda(texto));
  };

  // Inteligência de Alerta Multi-Plataforma (Padrão desligado: 1 resultado consolidado do menor preço)
  const [notificarPorLoja, setNotificarPorLoja] = useState(() => {
    if (editando?.notificar_por_loja !== undefined) return Boolean(editando.notificar_por_loja);
    if (editando?.palavras && editando.palavras.includes('notificar_por_loja:true')) return true;
    return false;
  });

  const [freteGratis, setFreteGratis] = useState(true);

  // Localização contextual para OLX e Facebook
  const [olxUf, setOlxUf] = useState('SP');
  const [olxRegiao, setOlxRegiao] = useState('');
  const [modalOlxUfVisible, setModalOlxUfVisible] = useState(false);
  const [modalOlxRegiaoVisible, setModalOlxRegiaoVisible] = useState(false);

  const [fbUf, setFbUf] = useState('SP');
  const [fbCidade, setFbCidade] = useState('sao-paulo');
  const [modalFbUfVisible, setModalFbUfVisible] = useState(false);
  const [modalFbCidadeVisible, setModalFbCidadeVisible] = useState(false);

  // Itens formatados para os modais de seleção
  const itensOlxEstados = useMemo(() => {
    return LISTA_ESTADOS.map(e => ({ id: e.uf, uf: e.uf, nome: e.nome }));
  }, []);

  const itensOlxRegioes = useMemo(() => {
    const estado = OLX_ESTADOS[olxUf];
    return (estado?.regioes || []).map(r => ({ id: r.slug, nome: r.nome, slug: r.slug }));
  }, [olxUf]);

  const itensFbEstados = useMemo(() => {
    return LISTA_ESTADOS_FACEBOOK.map(e => ({ id: e.uf, uf: e.uf, nome: e.nome }));
  }, []);

  const itensFbCidades = useMemo(() => {
    const estado = FACEBOOK_ESTADOS_CIDADES[fbUf];
    return (estado?.cidades || []).map(c => ({ id: c.slug, nome: c.nome, slug: c.slug }));
  }, [fbUf]);

  // Etapa 3: Frequência
  const [frequencia, setFrequencia] = useState(editando?.intervalo_valor || editando?.intervalo_minutos || 15);
  const [salvando, setSalvando] = useState(false);

  const PLATAFORMAS_DISPONIVEIS = [
    'MERCADO_LIVRE',
    'SHOPEE',
    'AMAZON',
    'MAGALU',
    'KABUM',
    'AMERICANAS',
    'CASASBAHIA',
    'FASTSHOP',
    'CARREFOUR',
    'SHEIN',
    'OLX',
    'FACEBOOK'
  ];

  const togglePlatform = (key) => {
    try { Vibration.vibrate(20); } catch (e) {}
    setSelectedPlatforms(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const mudarEtapa = (novaEtapa) => {
    try { Vibration.vibrate(25); } catch (e) {}
    setEtapa(novaEtapa);
  };

  const montarUrlPorPlataforma = (platKey, termo) => {
    const t = encodeURIComponent(termo.trim());
    switch(platKey) {
      case 'MERCADO_LIVRE':
        return `https://lista.mercadolivre.com.br/${termo.trim().replace(/\s+/g, '-')}${freteGratis ? '_CustoFrete_Gratis' : ''}`;
      case 'SHOPEE':
        return `https://shopee.com.br/search?keyword=${t}`;
      case 'AMAZON':
        return `https://www.amazon.com.br/s?k=${t}`;
      case 'MAGALU':
        return `https://www.magazineluiza.com.br/busca/${t}/`;
      case 'KABUM':
        return `https://www.kabum.com.br/busca/${t}`;
      case 'AMERICANAS':
        return `https://www.americanas.com.br/busca/${t}`;
      case 'SHEIN':
        return `https://br.shein.com/pdsearch/${t}/`;
      case 'FASTSHOP':
        return `https://site.fastshop.com.br/s?q=${t}`;
      case 'CARREFOUR':
        return `https://www.carrefour.com.br/busca/${t}`;
      case 'CASASBAHIA':
        return `https://www.casasbahia.com.br/${encodeURIComponent(termo.trim().toLowerCase().replace(/\s+/g, '-'))}/b`;
      case 'OLX':
        return gerarUrlOlx(olxUf, olxRegiao, termo);
      case 'FACEBOOK':
        return gerarUrlFacebook(fbCidade, termo);
      default:
        return `https://lista.mercadolivre.com.br/${termo.trim().replace(/\s+/g, '-')}`;
    }
  };

  const handleSalvarRadar = async () => {
    if (!produto.trim()) {
      showAlert({
        title: "Atenção",
        message: "Por favor, digite o nome do produto que deseja rastrear.",
        type: "warning"
      });
      return;
    }

    try {
      setSalvando(true);

      const urlsArray = selectedPlatforms.map(platKey => montarUrlPorPlataforma(platKey, produto));
      const urlsFinal = urlsArray.join(', ');

      const precoAlvoLimpo = (precoAlvo || '').replace(/\./g, '').replace(',', '.');
      const precoAlvoNum = precoAlvoLimpo ? parseFloat(precoAlvoLimpo) : null;

      let palavrasFinal = produto.trim();
      if (estrategia === 'preco_alvo' && precoAlvoNum > 0) {
        palavrasFinal += ` preco_alvo:${precoAlvoNum}`;
      }
      if (freteGratis) {
        palavrasFinal += ` frete_gratis:true`;
      }
      if (notificarPorLoja && selectedPlatforms.length > 1) {
        palavrasFinal += ` notificar_por_loja:true`;
      }

      // PAYLOAD 100% COMPATÍVEL COM SCHEMA DO SUPABASE
      const payload = {
        usuario_id: currentOwnerId,
        nome: produto.trim().toUpperCase(),
        urls: urlsFinal,
        modo: estrategia, // 'menor_preco' | 'preco_alvo' | 'maior_desconto'
        produto: produto.trim(),
        preco_alvo: (estrategia === 'preco_alvo' && precoAlvoNum > 0) ? precoAlvoNum : null,
        margem: 15,
        palavras: palavrasFinal,
        intervalo_valor: parseInt(frequencia, 10) || 15,
        intervalo_unidade: 'minutos',
        ativo: true,
        forcar_teste: false,
        proxima_execucao: new Date(Date.now() + (parseInt(frequencia, 10) || 15) * 60 * 1000).toISOString(),
        plataforma: selectedPlatforms.join(', '),
        notificar_por_loja: Boolean(notificarPorLoja && selectedPlatforms.length > 1)
      };

      if (editando) {
        await RadarAPI.updateMonitor(editando.id, payload);
      } else {
        await RadarAPI.createMonitor(payload);
      }

      // Registra o interesse local do usuário (peso 5)
      RecommendationEngine.registrarPesquisaOuRadar(produto.trim(), currentOwnerId);

      if (onRefresh) onRefresh();

      showAlert({
        title: "Radar Ativado!",
        message: `Seu radar para "${produto.trim()}" está ativo e buscando ofertas nas ${selectedPlatforms.length} lojas selecionadas.`,
        type: "success",
        icon: "checkmark-circle",
        onConfirm: () => navigation.goBack()
      });
    } catch (e) {
      console.log("[CreateMonitor] Erro ao salvar radar:", e);
      showAlert({
        title: "Erro",
        message: "Não foi possível salvar o radar. Verifique sua conexão e tente novamente.",
        type: "error"
      });
    } finally {
      setSalvando(false);
    }
  };

  const primeiraLoja = selectedPlatforms[0] ? (THEME.platforms[selectedPlatforms[0]]?.nome || selectedPlatforms[0]) : 'loja';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header com Barra de Progresso das 3 Etapas */}
      <View style={styles.wizardHeader}>
        <TouchableOpacity 
          onPress={() => {
            if (etapa > 1) mudarEtapa(etapa - 1);
            else navigation.goBack();
          }} 
          style={styles.wizardBackBtn}
        >
          <Ionicons name={etapa > 1 ? "arrow-back" : "close"} size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.wizardHeaderTitle}>Configurar Radar</Text>
          <Text style={styles.wizardStepIndicator}>Etapa {etapa} de 3</Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* Barra de Progresso Visual */}
      <View style={styles.wizardProgressBarContainer}>
        <View style={[styles.wizardProgressBar, { width: `${(etapa / 3) * 100}%` }]} />
      </View>

      {/* ETAPA 1: SELEÇÃO DE PLATAFORMAS EM CÍRCULOS (GRID 3x4 RESPONSIVO) */}
      {etapa === 1 && (
        <View style={{ flex: 1 }}>
          <ScrollView 
            contentContainerStyle={styles.wizardStepContent} 
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.wizardTitle}>Onde você quer buscar?</Text>
            <Text style={styles.wizardSubtitle}>
              Selecione as lojas que o AchôAI deve monitorar simultaneamente.
            </Text>

            <View style={styles.wizardCirclesGrid}>
              {PLATAFORMAS_DISPONIVEIS.map(platKey => (
                <PlatformCircle
                  key={platKey}
                  platformKey={platKey}
                  selected={selectedPlatforms.includes(platKey)}
                  onToggle={() => togglePlatform(platKey)}
                />
              ))}
            </View>
          </ScrollView>

          {/* Rodapé Etapa 1 */}
          <View style={styles.wizardFooterBar}>
            <View>
              <Text style={styles.wizardFooterCountText}>
                {selectedPlatforms.length === 0 
                  ? 'Nenhuma loja selecionada' 
                  : (selectedPlatforms.length === 1 ? '1 loja selecionada' : `${selectedPlatforms.length} lojas selecionadas`)}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.wizardContinueBtn, selectedPlatforms.length === 0 && { opacity: 0.45 }]}
              onPress={() => {
                if (selectedPlatforms.length > 0) mudarEtapa(2);
              }}
              disabled={selectedPlatforms.length === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.wizardContinueBtnText}>Continuar</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ETAPA 2: PRODUTO, ESTRATÉGIA, PREÇO ALVO E ALERTA POR LOJA */}
      {etapa === 2 && (
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView 
            contentContainerStyle={styles.wizardStepContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.wizardTitle}>O que você procura?</Text>
            <Text style={styles.wizardSubtitle}>
              Digite o nome ou modelo do produto desejado para o rastreador.
            </Text>

            <View style={styles.wizardInputBox}>
              <Ionicons name="search" size={20} color="#FF5722" style={{ marginRight: 10 }} />
              <TextInput
                style={styles.wizardInputField}
                placeholder="Ex: iPhone 15 Pro, PS5 Slim, Air Fryer..."
                placeholderTextColor="#94A3B8"
                value={produto}
                onChangeText={setProduto}
                autoFocus={!produto}
              />
            </View>

            {/* Estratégias de Alerta */}
            <Text style={[styles.wizardSectionTitle, { marginTop: 22 }]}>Estratégia de Alerta</Text>
            <Text style={styles.wizardSectionSub}>Como você deseja ser notificado pelo radar?</Text>

            <View style={styles.wizardStrategiesContainer}>
              {/* Opção 1: Menor Preço Disponível */}
              <TouchableOpacity
                style={[styles.wizardStrategyCard, estrategia === 'menor_preco' && styles.wizardStrategyCardActive]}
                onPress={() => setEstrategia('menor_preco')}
                activeOpacity={0.85}
              >
                <View style={[styles.wizardRadio, estrategia === 'menor_preco' && styles.wizardRadioActive]}>
                  {estrategia === 'menor_preco' && <View style={styles.wizardRadioDot} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.wizardStrategyTitle, estrategia === 'menor_preco' && styles.wizardStrategyTitleActive]}>
                    Menor Preço Disponível
                  </Text>
                  <Text style={styles.wizardStrategyDesc}>
                    O AchôAI alerta imediatamente a oferta mais barata encontrada no momento da busca.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Opção 2: Preço Alvo */}
              <TouchableOpacity
                style={[styles.wizardStrategyCard, estrategia === 'preco_alvo' && styles.wizardStrategyCardActive]}
                onPress={() => setEstrategia('preco_alvo')}
                activeOpacity={0.85}
              >
                <View style={[styles.wizardRadio, estrategia === 'preco_alvo' && styles.wizardRadioActive]}>
                  {estrategia === 'preco_alvo' && <View style={styles.wizardRadioDot} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.wizardStrategyTitle, estrategia === 'preco_alvo' && styles.wizardStrategyTitleActive]}>
                    Preço Alvo Personalizado
                  </Text>
                  <Text style={styles.wizardStrategyDesc}>
                    Receba o alerta somente quando o produto atingir ou ficar abaixo do valor que você quer pagar.
                  </Text>
                </View>
              </TouchableOpacity>

              {estrategia === 'preco_alvo' && (
                <View style={styles.wizardPriceTargetBox}>
                  <Text style={styles.wizardPriceTargetPrefix}>R$</Text>
                  <TextInput
                    style={styles.wizardPriceTargetInput}
                    placeholder="0,00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={precoAlvo}
                    onChangeText={handleChangePrecoAlvo}
                  />
                </View>
              )}

              {/* Opção 3: Maior Desconto */}
              <TouchableOpacity
                style={[styles.wizardStrategyCard, estrategia === 'maior_desconto' && styles.wizardStrategyCardActive]}
                onPress={() => setEstrategia('maior_desconto')}
                activeOpacity={0.85}
              >
                <View style={[styles.wizardRadio, estrategia === 'maior_desconto' && styles.wizardRadioActive]}>
                  {estrategia === 'maior_desconto' && <View style={styles.wizardRadioDot} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.wizardStrategyTitle, estrategia === 'maior_desconto' && styles.wizardStrategyTitleActive]}>
                    Maior Desconto (% OFF)
                  </Text>
                  <Text style={styles.wizardStrategyDesc}>
                    Prioriza produtos com grandes quedas de preço e promoções relâmpago.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Inteligência de Alerta Multi-Plataforma (Exibido apenas se > 1 loja selecionada) */}
            {selectedPlatforms.length > 1 && (
              <TouchableOpacity 
                style={[styles.wizardToggleRow, { marginTop: 16 }]}
                onPress={() => setNotificarPorLoja(!notificarPorLoja)}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="git-branch-outline" size={16} color="#FF5722" style={{ marginRight: 6 }} />
                    <Text style={styles.wizardToggleTitle}>Notificar por Loja Separadamente</Text>
                  </View>
                  <Text style={styles.wizardToggleDesc}>
                    {notificarPorLoja
                      ? "1 resultado individual para cada loja monitorada."
                      : "1 única notificação consolidada com o melhor preço geral."}
                  </Text>
                </View>
                <Switch
                  value={notificarPorLoja}
                  onValueChange={setNotificarPorLoja}
                  trackColor={{ false: '#CBD5E1', true: THEME.primary }}
                  thumbColor="#FFFFFF"
                />
              </TouchableOpacity>
            )}

            {/* Filtro Frete Grátis */}
            <TouchableOpacity 
              style={[styles.wizardToggleRow, { marginTop: selectedPlatforms.length > 1 ? 8 : 16 }]}
              onPress={() => setFreteGratis(!freteGratis)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.wizardToggleTitle}>Apenas com Frete Grátis</Text>
                <Text style={styles.wizardToggleDesc}>Filtra produtos elegíveis a envio gratuito nas lojas.</Text>
              </View>
              <Switch
                value={freteGratis}
                onValueChange={setFreteGratis}
                trackColor={{ false: '#CBD5E1', true: THEME.primary }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Localização para OLX / Facebook caso selecionados */}
            {selectedPlatforms.includes('OLX') && (
              <View style={styles.wizardLocationBox}>
                <View style={[styles.row, { marginBottom: 8 }]}>
                  <StoreLogoBadge storeKey="OLX" size={18} style={{ marginRight: 6 }} />
                  <Text style={styles.wizardLocationTitle}>Localização na OLX</Text>
                </View>
                <View style={styles.smartLocationSelectorsRow}>
                  {/* Botão Estado OLX */}
                  <TouchableOpacity
                    style={styles.smartLocationBtn}
                    activeOpacity={0.7}
                    onPress={() => setModalOlxUfVisible(true)}
                  >
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Text style={styles.smartLocationBtnLabel}>Estado</Text>
                      <Text style={styles.smartLocationBtnValue} numberOfLines={1}>
                        {olxUf === 'BR' ? 'Brasil Inteiro' : (OLX_ESTADOS[olxUf]?.nome || olxUf)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={14} color="#64748B" />
                  </TouchableOpacity>

                  {/* Botão Região OLX */}
                  <TouchableOpacity
                    style={[styles.smartLocationBtn, olxUf === 'BR' && styles.smartLocationBtnDisabled]}
                    activeOpacity={olxUf === 'BR' ? 1 : 0.7}
                    onPress={() => {
                      if (olxUf !== 'BR') setModalOlxRegiaoVisible(true);
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Text style={styles.smartLocationBtnLabel}>Região</Text>
                      <Text style={styles.smartLocationBtnValue} numberOfLines={1}>
                        {olxUf === 'BR' 
                          ? 'Todas as Regiões' 
                          : (olxRegiao 
                            ? (OLX_ESTADOS[olxUf]?.regioes.find(r => r.slug === olxRegiao)?.nome || olxRegiao) 
                            : 'Todo o Estado')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={14} color={olxUf === 'BR' ? '#CBD5E1' : '#64748B'} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {selectedPlatforms.includes('FACEBOOK') && (
              <View style={styles.wizardLocationBox}>
                <View style={[styles.row, { marginBottom: 8 }]}>
                  <StoreLogoBadge storeKey="Facebook" size={18} style={{ marginRight: 6 }} />
                  <Text style={styles.wizardLocationTitle}>Localização no Facebook</Text>
                </View>
                <View style={styles.smartLocationSelectorsRow}>
                  {/* Botão Estado FB */}
                  <TouchableOpacity
                    style={styles.smartLocationBtn}
                    activeOpacity={0.7}
                    onPress={() => setModalFbUfVisible(true)}
                  >
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Text style={styles.smartLocationBtnLabel}>Estado</Text>
                      <Text style={styles.smartLocationBtnValue} numberOfLines={1}>
                        {fbUf === 'BR' ? 'Brasil Inteiro' : (FACEBOOK_ESTADOS_CIDADES[fbUf]?.nome || fbUf)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={14} color="#64748B" />
                  </TouchableOpacity>

                  {/* Botão Cidade FB */}
                  <TouchableOpacity
                    style={[styles.smartLocationBtn, fbUf === 'BR' && styles.smartLocationBtnDisabled]}
                    activeOpacity={fbUf === 'BR' ? 1 : 0.7}
                    onPress={() => {
                      if (fbUf !== 'BR') setModalFbCidadeVisible(true);
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Text style={styles.smartLocationBtnLabel}>Cidade</Text>
                      <Text style={styles.smartLocationBtnValue} numberOfLines={1}>
                        {fbUf === 'BR' 
                          ? 'Brasil Inteiro' 
                          : (FACEBOOK_ESTADOS_CIDADES[fbUf]?.cidades.find(c => c.slug === fbCidade)?.nome || fbCidade)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={14} color={fbUf === 'BR' ? '#CBD5E1' : '#64748B'} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Rodapé Etapa 2 */}
          <View style={styles.wizardFooterBar}>
            <TouchableOpacity 
              style={styles.wizardBackTextBtn}
              onPress={() => mudarEtapa(1)}
            >
              <Text style={styles.wizardBackTextBtnLabel}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.wizardContinueBtn, !produto.trim() && { opacity: 0.5 }]}
              onPress={() => {
                if (produto.trim()) mudarEtapa(3);
                else showAlert({ title: "Atenção", message: "Digite o produto que deseja rastrear.", type: "warning" });
              }}
              disabled={!produto.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.wizardContinueBtnText}>Continuar</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ETAPA 3: FREQUÊNCIA DE VARREDURAS & ATIVAÇÃO */}
      {etapa === 3 && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.wizardStepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.wizardTitle}>Frequência de varreduras</Text>
            <Text style={styles.wizardSubtitle}>
              Escolha de quanto em quanto tempo nossos servidores devem consultar as lojas.
            </Text>

            <FrequencySelector
              value={frequencia}
              onChange={setFrequencia}
              lojaNome={primeiraLoja}
            />
          </ScrollView>

          {/* Rodapé Etapa 3 */}
          <View style={styles.wizardFooterBar}>
            <TouchableOpacity 
              style={styles.wizardBackTextBtn}
              onPress={() => mudarEtapa(2)}
            >
              <Text style={styles.wizardBackTextBtnLabel}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.wizardActivateBtn, salvando && { opacity: 0.6 }]}
              onPress={handleSalvarRadar}
              disabled={salvando}
              activeOpacity={0.85}
            >
              {salvando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.wizardActivateBtnText}>Ativar Radar Inteligente</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}


      {/* Modais Seletores de Localização para OLX e Facebook */}
      <SelectionModal
        visible={modalOlxUfVisible}
        title="Selecione o Estado (OLX)"
        items={itensOlxEstados}
        selectedId={olxUf}
        onSelect={(item) => {
          setOlxUf(item.id);
          setOlxRegiao('');
          setModalOlxUfVisible(false);
        }}
        onClose={() => setModalOlxUfVisible(false)}
      />

      <SelectionModal
        visible={modalOlxRegiaoVisible}
        title={`Região em ${OLX_ESTADOS[olxUf]?.nome || olxUf} (OLX)`}
        items={itensOlxRegioes}
        selectedId={olxRegiao}
        onSelect={(item) => {
          setOlxRegiao(item.id);
          setModalOlxRegiaoVisible(false);
        }}
        onClose={() => setModalOlxRegiaoVisible(false)}
      />

      <SelectionModal
        visible={modalFbUfVisible}
        title="Selecione o Estado (Facebook)"
        items={itensFbEstados}
        selectedId={fbUf}
        onSelect={(item) => {
          setFbUf(item.id);
          setFbCidade('brasil');
          setModalFbUfVisible(false);
        }}
        onClose={() => setModalFbUfVisible(false)}
      />

      <SelectionModal
        visible={modalFbCidadeVisible}
        title={`Cidade em ${FACEBOOK_ESTADOS_CIDADES[fbUf]?.nome || fbUf} (Facebook)`}
        items={itensFbCidades}
        selectedId={fbCidade}
        onSelect={(item) => {
          setFbCidade(item.id);
          setModalFbCidadeVisible(false);
        }}
        onClose={() => setModalFbCidadeVisible(false)}
      />
    </View>
  );
}

// =====================================================================
// 5. NAVEGAÇÃO POR TABS - 100% VETORIAL (ESTILO PECHINCHOU)
// =====================================================================
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 20);

  return (
    <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: [
            styles.pechBottomTabBar,
            {
              height: 56 + bottomInset,
              paddingBottom: bottomInset,
            }
          ],
          tabBarActiveTintColor: THEME.primary,
          tabBarInactiveTintColor: '#94A3B8',
        }}
      >
        {/* 1. Início (Home - Promoções do Momento) */}
        <Tab.Screen 
          name="HomeTab" 
          component={HomePromotionsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.pechTabItemWrap}>
                <Ionicons 
                  name={focused ? "home" : "home-outline"} 
                  size={23} 
                  color={focused ? THEME.primary : '#94A3B8'} 
                />
                {focused && <View style={styles.pechTabActiveIndicator} />}
              </View>
            )
          }}
        />

        {/* 2. Radares Inteligentes */}
        <Tab.Screen 
          name="RadarsTab" 
          component={RadarsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.pechTabItemWrap}>
                <Ionicons 
                  name={focused ? "radio" : "radio-outline"} 
                  size={23} 
                  color={focused ? THEME.primary : '#94A3B8'} 
                />
                {focused && <View style={styles.pechTabActiveIndicator} />}
              </View>
            )
          }}
        />

        {/* 3. Cupons de Desconto */}
        <Tab.Screen 
          name="CouponsTab" 
          component={CouponsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.pechTabItemWrap}>
                <Ionicons 
                  name={focused ? "ticket" : "ticket-outline"} 
                  size={23} 
                  color={focused ? THEME.primary : '#94A3B8'} 
                />
                {focused && <View style={styles.pechTabActiveIndicator} />}
              </View>
            )
          }}
        />

        {/* 4. Recomendados Para Você (Aba Dedicada) */}
        <Tab.Screen 
          name="RecommendationsTab" 
          component={RecommendationsFeedScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.pechTabItemWrap}>
                <Ionicons 
                  name={focused ? "sparkles" : "sparkles-outline"} 
                  size={23} 
                  color={focused ? THEME.primary : '#94A3B8'} 
                />
                {focused && <View style={styles.pechTabActiveIndicator} />}
              </View>
            )
          }}
        />

        {/* 5. Pesquisar */}
        <Tab.Screen 
          name="SearchTab" 
          component={SearchScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.pechTabItemWrap}>
                <Ionicons 
                  name={focused ? "search" : "search-outline"} 
                  size={23} 
                  color={focused ? THEME.primary : '#94A3B8'} 
                />
                {focused && <View style={styles.pechTabActiveIndicator} />}
              </View>
            )
          }}
        />
      </Tab.Navigator>
  );
}

export default function App() {
  const customTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#0F172A',
      border: '#E2E8F0',
      primary: THEME.primary
    },
  };

  return (
    <SafeAreaProvider>
      <RadarProvider>
        <NavigationContainer theme={customTheme}>
          <Stack.Navigator screenOptions={{ 
            headerStyle: { backgroundColor: '#FFFFFF' }, 
            headerTintColor: THEME.primary,
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: 'bold', fontSize: 16 }
          }}>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen 
              name="Criar" 
              component={CreateMonitorScreen} 
              options={{ 
                headerShown: false,
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
// 6. ESTILOS VISUAIS - INSPIRAÇÃO PECHINCHOU (TEMA CLARO & VIBRANTE)
// =====================================================================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Pechinchou Top Header
  
  // Badge de Atualização Autônoma (Substituto do refresh manual)
  pechAutoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  pechAutoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF5722',
  },

  // Onboarding Sweep Screen (~10s no primeiro lançamento)
  
  fullscreenOnboardingOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  onboardingCategoryIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#F1F5F9',
  },
  onboardingCategoryBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },

  onboardingSweepContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  onboardingSweepCenterBox: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  onboardingPulseWrapper: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  onboardingPulseRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 87, 34, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255, 87, 34, 0.35)',
  },
  onboardingPulseCore: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FF5722',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  onboardingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    marginBottom: 16,
  },
  onboardingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF5722',
  },
  onboardingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  onboardingSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  onboardingProgressTrack: {
    width: '88%',
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 24,
  },
  onboardingProgressBar: {
    height: '100%',
    backgroundColor: '#FF5722',
    borderRadius: 3,
  },
  onboardingFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  onboardingFooterText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },

  pechTopHeader: {
    paddingTop: Platform.OS === 'android' ? 44 : 52,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  pechAvatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#FF5722',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pechAvatarInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pechGreetingSub: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  pechGreetingName: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '900',
  },
  pechHeaderIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pechinchou Sub Filters Row
  pechSubFilterRow: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pechSubFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pechSubFilterChipActive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#0F172A',
  },
  pechSubFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  pechSubFilterChipTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },

  // Pechinchou Story Circles
  pechStoriesContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pechStoryItem: {
    alignItems: 'center',
    width: 58,
  },
  pechStoryCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  pechStoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },

  // Store filter pills
  filterPillsContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#FF5722',
    borderColor: '#FF5722',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Feed Scroll
  feedScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 80,
  },
  pechFeedSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingTop: 2,
  },
  pechFeedSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  emptyFeedBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyResetBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#FF5722',
  },
  emptyResetBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // Header Radares
  brandHeaderClean: {
    paddingTop: Platform.OS === 'android' ? 44 : 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brandTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  brandSubtitleText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  headerPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5722',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  // Onboarding Radares
  onboardingContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
    alignItems: 'center',
  },
  onboardingHeroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  onboardingTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  onboardingSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  onboardingCardsWrap: {
    width: '100%',
    gap: 12,
    marginBottom: 28,
  },
  onboardingCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  onboardingCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  onboardingCardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  onboardingCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#FF5722',
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 3,
  },
  onboardingCtaBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },

  // Radares Ativos List
  radarsScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 90,
  },
  countBadge: {
    marginLeft: 8,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF5722',
  },
  radarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  radarCardActiveIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: '#FF5722',
  },
  radarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  radarCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  miniPlatBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
  },
  miniPlatBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  miniIntervalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  miniIntervalBadgeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  radarCardStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabelText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  countdownText: {
    fontSize: 12,
    color: '#334155',
  },
  accordionToggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  accordionToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF5722',
  },
  accordionBody: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  accordionEmpty: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  accordionEmptyText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  radarResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  radarResultThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  radarResultThumbFallback: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPlatMiniLogoBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  radarResultTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  radarResultStoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  radarResultStoreName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  radarResultDiscountTag: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#FECACA',
  },
  radarResultDiscountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },
  radarResultPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
    marginTop: 2,
  },
  radarCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
    paddingTop: 8,
  },
  radarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  radarActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  fabBtn: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF5722',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },

  // Pechinchou Cupons Header (Screenshot 2)
  pechCuponsHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 44 : 52,
    paddingHorizontal: 20,
    paddingBottom: 14,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pechCuponsPreTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  pechCuponsMainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 4,
    textAlign: 'center',
  },
  pechCuponsSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
    textAlign: 'center',
  },
  pechCuponsSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 44,
    width: '100%',
  },
  pechCuponsSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  pechStoreCardMini: {
    width: 90,
    height: 90,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  pechStoreCardMiniName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  pechStoreCardMiniCount: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  cuponsScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
  },
  couponCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  couponCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  couponStorePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  couponDiscountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  couponDiscountBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#16A34A',
  },
  couponDescText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  couponRulesText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  couponCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#FF5722',
    padding: 6,
  },
  couponCodeTextWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  couponCodeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FF5722',
    letterSpacing: 1.5,
  },
  couponCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5722',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  couponCopyBtnDone: {
    backgroundColor: '#16A34A',
  },
  couponCopyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  couponStoreLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 4,
  },
  couponStoreLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF5722',
  },

  searchBarContainerFull: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  sideDrawerContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    backgroundColor: '#FFFFFF',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    zIndex: 9999,
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  sideDrawerHeader: {
    paddingTop: Platform.OS === 'android' ? 44 : 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  sideDrawerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  sideDrawerScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  notifClearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  notifClearAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  notifTestPushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 10,
    paddingVertical: 9,
    marginBottom: 14,
  },
  notifTestPushBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EA580C',
  },
  notifCountSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF5722',
  },
  notifEmptySubText: {
    marginTop: 4,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Search Screen & Pechinchou Categories (Screenshot 3)
  searchTopHeader: {
    paddingTop: Platform.OS === 'android' ? 44 : 52,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  searchMainInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  searchHeaderIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifHeaderBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FF5722',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifHeaderBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  pechCategoriesSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  pechCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  pechCategoryCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
  },
  pechCategoryIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pechCategoryLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },

  // Modais de Notificações e Config
  modalOverlayClean: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalOverlayStaticBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  authModalCenteredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  authTutorialCardCompact: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    width: '100%',
    maxWidth: 420,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  // Smart Multi-Platform Search 5-Step Wizard
  smartSearchSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  smartSearchSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  smartCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  smartCategoryCard: {
    width: '48%',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    minHeight: 100,
  },
  smartCategoryCardActive: {
    borderColor: '#FF5722',
    backgroundColor: '#FFF7ED',
    elevation: 4,
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  smartCategoryIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  smartCategoryLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  smartCategoryLabelActive: {
    color: '#FF5722',
    fontWeight: '900',
  },
  smartCategoryActiveIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
    // Smart Search Modern Styles
  smartSearchInstructionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  smartToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 4,
    marginBottom: 4,
  },
  smartToggleLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  smartToggleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  smartToggleSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  smartLocationContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  smartLocationSection: {
    marginBottom: 2,
  },
  smartLocationPlatformTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF5722',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  smartLocationSelectorsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smartLocationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  smartLocationBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  smartLocationBtnLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  smartLocationBtnValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  smartCategoryActionHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF5722',
    marginTop: 4,
  },
    // Dropdown Modal Selector (OLX & Facebook)
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 35,
  },
  dropdownModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxHeight: '85%',
    padding: 18,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  dropdownModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  dropdownCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 44,
    marginVertical: 12,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#F8FAFC',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF7ED',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownItemTextSelected: {
    color: '#FF5722',
    fontWeight: '800',
  },
  smartSearchPromptBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    elevation: 4,
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  smartSearchPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  smartSearchPromptTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  smartSearchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 14,
  },
  smartSearchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  smartSearchActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5722',
    borderRadius: 14,
    height: 50,
    elevation: 4,
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  smartSearchActionBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  // 10s Sweep Canvas
  smartSweepCanvas: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  smartRadarWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  smartRadarPulseRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 87, 34, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255, 87, 34, 0.4)',
  },
  smartRadarPulseCore: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF5722',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  smartSweepStoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  smartSweepTermTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  smartSweepPhaseBox: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 22,
    width: '100%',
    maxWidth: 360,
  },
  smartSweepPhaseTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  smartSweepPhaseSubtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  smartSweepProgressBarBg: {
    width: '100%',
    maxWidth: 320,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  smartSweepProgressBarFill: {
    height: '100%',
    backgroundColor: '#FF5722',
    borderRadius: 4,
  },
  smartSweepTimerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  // Step 5: Results View
  smartResultsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  smartResultsQueryTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  smartResultsCountSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  smartNewSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  smartNewSearchBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF5722',
  },
  smartFilterChipsContainer: {
    height: 52,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    justifyContent: 'center',
  },
  smartFilterChipsRow: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 8,
  },
  smartFilterChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smartFilterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  smartFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  smartFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  authTutorialCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  authTutorialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  authBadgeIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authTutorialTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  authTutorialSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  authBenefitsBox: {
    marginBottom: 16,
    gap: 12,
  },
  authBenefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
  },
  authBenefitIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  authBenefitTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  authBenefitDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  authGoogleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    height: 48,
    marginBottom: 14,
    elevation: 2,
  },
  authGoogleButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  authNotifBanner: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  authNotifBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  authNotifBannerDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 10,
  },
  authEnableNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5722',
    borderRadius: 10,
    paddingVertical: 9,
  },
  authEnableNotifBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  authNotifActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  authNotifActiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  notifDrawerContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  notifDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  notifDrawerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  notifCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  notifToggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  notifToggleSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  notifListHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  notifEmptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  notifEmptyText: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748B',
  },
  notifItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  notifItemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  notifItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16A34A',
    marginTop: 2,
  },

  // Settings Modal
  settingsModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingsModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  settingsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  settingsAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsAccountName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  settingsAccountSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settingsAuthBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5722',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 14,
  },
  settingsAuthBtnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  settingsAuthBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 9,
    marginTop: 14,
  },
  settingsAuthBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  settingsCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsBenefitText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  settingsTestNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
  },
  settingsTestNotifBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF5722',
  },
  settingsDeviceIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  settingsDeviceIdLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  settingsDeviceIdValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  settingsCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  settingsCopyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  settingsTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  settingsTierBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  settingsTierDescText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  settingsTrialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EA580C',
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  settingsTrialBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
  },
  settingsUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7E22CE',
    borderRadius: 10,
    paddingVertical: 10,
  },
  settingsUpgradeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
  },
  settingsSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 8,
  },
  settingsSwitchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  settingsSwitchSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settingsCardSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 10,
  },
  settingsCleanCacheBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 9,
  },
  settingsCleanCacheBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  aboutVersionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  aboutMottoText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },

  // WIZARD CRIAR RADAR EM 3 ETAPAS
  wizardHeader: {
    paddingTop: Platform.OS === 'android' ? 44 : 52,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  wizardBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  wizardStepIndicator: {
    fontSize: 11,
    color: '#FF5722',
    fontWeight: '700',
    marginTop: 2,
  },
  wizardProgressBarContainer: {
    height: 3,
    backgroundColor: '#F1F5F9',
    width: '100%',
  },
  wizardProgressBar: {
    height: 3,
    backgroundColor: '#FF5722',
  },
  wizardStepContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  wizardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  wizardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  wizardCirclesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingBottom: 10,
  },
  wizardInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  wizardInputField: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  wizardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  wizardSectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  wizardStrategiesContainer: {
    gap: 10,
  },
  wizardStrategyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  wizardStrategyCardActive: {
    borderColor: '#FF5722',
    backgroundColor: '#FFF7ED',
  },
  wizardRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardRadioActive: {
    borderColor: '#FF5722',
  },
  wizardRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5722',
  },
  wizardStrategyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  wizardStrategyTitleActive: {
    color: '#FF5722',
    fontWeight: '800',
  },
  wizardStrategyDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  wizardPriceTargetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1.5,
    borderColor: '#FF5722',
    marginLeft: 32,
    marginTop: 4,
  },
  wizardPriceTargetPrefix: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FF5722',
    marginRight: 8,
  },
  wizardPriceTargetInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  wizardToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wizardToggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  wizardToggleDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  wizardLocationBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wizardLocationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  wizardLocationInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    color: '#0F172A',
  },
  wizardFooterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 16 : 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  wizardFooterCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  wizardContinueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5722',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  wizardContinueBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  wizardBackTextBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  wizardBackTextBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  wizardActivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5722',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
  },
  wizardActivateBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Navbar Inferior Vetorial (Estilo Pechinchou)
  pechBottomTabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  pechTabItemWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    width: 48,
  },
  pechTabActiveIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF5722',
  },

  // Dropdown e Filtros de Ordenação
  dropdownFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5EB',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  dropdownFilterBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF5722',
  },
  dropdownListBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownListHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 6,
  },
  dropdownListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dropdownListItemActive: {
    backgroundColor: '#FFF7ED',
  },
  dropdownListItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownListItemTextActive: {
    color: '#FF5722',
    fontWeight: '800',
  },
  dealsCountRow: {
    paddingHorizontal: 4,
    marginBottom: 4,
    marginTop: -2,
  },
  dealsCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
});
