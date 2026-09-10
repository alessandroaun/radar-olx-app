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

import { supabase, supabaseAuth } from './supabase'; 
import { setupNotifications, registerPushToken, testLocalNotification, subscribeNotificationEvents, checkIsExpoGo } from './notificationService';
import { OLX_ESTADOS, LISTA_ESTADOS, gerarUrlOlx } from './olxData';
import { getOrCreateDeviceId, registerDeviceInSupabase, migrateDeviceMonitorsToAccount, resetDeviceOnLogout } from './deviceService';
import { THEME } from './theme';
import { 
  Surface, PrimaryButton, IconButton, StatusBadge, PlatformBadge, 
  StrategyBadge, SectionHeader, MetricBox 
} from './components';

WebBrowser.maybeCompleteAuthSession();

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

  const currentOwnerId = user?.id || deviceId;

  const fetchData = useCallback(async (targetOwnerId = null, silent = false) => {
    const ownerId = targetOwnerId || userRef.current?.id || deviceIdRef.current;
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(null, true);
  }, [fetchData]);

  const alternarNotificacoes = useCallback(async (novoValor) => {
    setNotificacoesAtivas(novoValor);
    await AsyncStorage.setItem('@radar_notificacoes_ativas', String(novoValor));
    const currentDevId = deviceIdRef.current;
    if (!novoValor) {
      setPushToken(null);
      pushTokenRef.current = null;
      if (currentDevId) {
        await supabase.from('usuarios').update({ expo_push_token: null }).eq('id', currentDevId);
      }
    } else {
      if (currentDevId) {
        const token = await registerPushToken(currentDevId, userRef.current?.id);
        if (token) {
          setPushToken(token);
          pushTokenRef.current = token;
        }
      }
    }
  }, []);

  const linkAccount = useCallback(async (authUser) => {
    if (!authUser) return;
    try {
      setLoading(true);
      setUser(authUser);
      userRef.current = authUser;

      const currentDevId = deviceIdRef.current;
      const currentToken = pushTokenRef.current;

      if (currentDevId) {
        await migrateDeviceMonitorsToAccount(currentDevId, authUser.id, currentToken);
      }
      await fetchData(authUser.id);
    } catch (e) {
      console.log("[Radar] Erro ao vincular conta e migrar radares:", e);
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const logoutUser = useCallback(async () => {
    try {
      setLoading(true);
      const oldDevId = deviceIdRef.current;
      const currentToken = pushTokenRef.current;

      await supabaseAuth.auth.signOut();

      const newDevId = await resetDeviceOnLogout(oldDevId, currentToken);
      setDeviceId(newDevId);
      deviceIdRef.current = newDevId;

      setUser(null);
      userRef.current = null;

      setMonitores([]);
      setResultados([]);
      setAtividades([]);
      hasLoadedRef.current = false;

      await fetchData(newDevId);
    } catch (e) {
      console.log("[Radar] Erro ao efetuar logout:", e);
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

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

      await registerDeviceInSupabase(devId, null, currentUser?.id);

      if (currentUser) {
        await migrateDeviceMonitorsToAccount(devId, currentUser.id, null);
      }

      fetchData(currentUser?.id || devId);

      const savedNotif = await AsyncStorage.getItem('@radar_notificacoes_ativas');
      const isNotifActive = savedNotif !== null ? savedNotif === 'true' : true;
      if (mounted) setNotificacoesAtivas(isNotifActive);

      if (isNotifActive) {
        try {
          const token = await registerPushToken(devId, currentUser?.id);
          if (token && mounted) {
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
    }

    init();

    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(async (event, session) => {
      const authUser = session?.user ?? null;
      const currentDevId = deviceIdRef.current;
      const currentToken = pushTokenRef.current;

      if (event === 'SIGNED_IN' && authUser && currentDevId) {
        setUser(authUser);
        userRef.current = authUser;
        await migrateDeviceMonitorsToAccount(currentDevId, authUser.id, currentToken);
        fetchData(authUser.id);
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
        if (data?.url) {
          Linking.openURL(data.url).catch(() => {});
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      if (unsubscribeEvents) unsubscribeEvents();
    };
  }, [fetchData]);

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
          // ISOLAMENTO RIGOROSO: Só processa se o resultado pertencer a um monitor deste usuário
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
          // ISOLAMENTO RIGOROSO: Só processa se o log pertencer a um monitor deste usuário
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

  return (
    <RadarContext.Provider value={{ 
      monitores, resultados, atividades, pushToken, setPushToken, deviceId, user, currentOwnerId,
      notificacoesAtivas, alternarNotificacoes,
      loading, refreshing, onRefresh, fetchData, linkAccount, logoutUser 
    }}>
      {children}
    </RadarContext.Provider>
  );
}

// =====================================================================
// 3. AUXILIARES E COMPONENTES DE ESTRATÉGIA
// =====================================================================

function identificarPlataforma(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('zoom.com.br')) return 'ZOOM';
  if (u.includes('buscape.com.br')) return 'BUSCAPE';
  if (u.includes('olx.com.br')) return 'OLX';
  return 'OUTROS';
}

function identificarEstrategia(m) {
  if (!m) return 'mais_recentes';
  if (m.modo === 'menor_preco') return 'menor_preco';
  if (m.modo === 'por_preco') return 'por_preco';
  if (m.modo === 'mais_recentes') return 'mais_recentes';
  if (m.preco_alvo && Number(m.preco_alvo) > 0) return 'por_preco';
  return 'mais_recentes';
}

function extrairInfoOlx(url) {
  let ufEncontrada = 'CE';
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
  const { monitores, resultados, atividades, loading, refreshing, onRefresh, fetchData } = useContext(RadarContext);
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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      
      {/* BRAND BAR SUPERIOR COM LOGO 3D REAL (TRANSPARENTE) */}
      <View style={styles.brandHeader}>
        <View style={styles.brandGroup}>
          <Image 
            source={require('./assets/android-icon-foreground.png')} 
            style={styles.brandLogoImage} 
            resizeMode="contain" 
          />
          <View style={styles.brandTextGroup}>
            <Text style={styles.brandName}>AchôAI</Text>
            <View style={styles.livePulseRow}>
              <View style={styles.livePulseDot} />
              <Text style={styles.livePulseText}>Robô Online</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.btnHeaderAction}
          onPress={() => navigation.navigate('Criar')}
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
            label="Radares Ativos"
            sublabel="Em monitoramento"
            color={THEME.primary}
            bg={THEME.primaryGlow}
          />
          <MetricBox 
            icon="pricetag"
            value={resultados.length}
            label="Oportunidades"
            sublabel="Itens capturados"
            color={THEME.success}
            bg={THEME.successBg}
          />
          <MetricBox 
            icon="timer-outline"
            value={segProxFormatado}
            label="Próxima Busca"
            sublabel="Ciclo do robô"
            color={THEME.info}
            bg={THEME.infoBg}
          />
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
            return (
              <Surface key={item.id} style={styles.opportunityCard}>
                <View style={styles.opportunityHeader}>
                  <PlatformBadge platformKey={plat} />
                  <Text style={styles.opportunityDate}>
                    {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Hoje
                  </Text>
                </View>

                <Text style={styles.opportunityTitle} numberOfLines={2}>{item.title}</Text>

                <View style={styles.opportunityFooter}>
                  {item.price !== null ? (
                    <View style={styles.priceContainer}>
                      <Text style={styles.pricePrefix}>R$</Text>
                      <Text style={styles.priceNumber}>{Number(item.price).toFixed(2)}</Text>
                    </View>
                  ) : (
                    <Text style={styles.priceConsult}>Sob Consulta</Text>
                  )}

                  <TouchableOpacity 
                    style={styles.btnOpenOffer}
                    onPress={() => Linking.openURL(item.url).catch(() => Alert.alert("Erro", "Não foi possível abrir o link."))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnOpenOfferText}>
                      {plat === 'ZOOM' ? 'Ver no Zoom' : plat === 'BUSCAPE' ? 'Ver no Buscapé' : plat === 'OLX' ? 'Ver na OLX' : 'Abrir Oferta'}
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

        <Surface style={styles.telemetryCard}>
          {loading && atividades.length === 0 ? (
            <ActivityIndicator size="small" color={THEME.primary} style={{ padding: 25 }} />
          ) : atividades.length === 0 ? (
            <View style={styles.telemetryEmpty}>
              <Ionicons name="time-outline" size={22} color={THEME.textSubtle} style={{ marginBottom: 6 }} />
              <Text style={styles.emptyCardSub}>Aguardando primeiro ciclo de varredura...</Text>
            </View>
          ) : (
            atividades.map((at, idx) => {
              const dotColor = at.level === 'SUCCESS' ? THEME.success 
                             : at.level === 'ERROR' ? THEME.danger 
                             : at.level === 'WARNING' ? THEME.warning 
                             : THEME.info;
              return (
                <View key={at.id || idx} style={[styles.telemetryRow, idx === atividades.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.telemetryDot, { backgroundColor: dotColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.telemetryMessage}>{at.message}</Text>
                    <View style={styles.telemetryMetaRow}>
                      <Text style={styles.telemetryTime}>{new Date(at.created_at).toLocaleTimeString()}</Text>
                      <Text style={styles.telemetrySeparator}>•</Text>
                      <Text style={styles.telemetrySource}>Robô AchôAI</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </Surface>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// --- TELA 2: RADARES ATIVOS ---
function MonitorListScreen({ navigation }) {
  const { monitores, loading, refreshing, onRefresh, fetchData } = useContext(RadarContext);
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
      Alert.alert("Erro", "Não foi possível atualizar o radar.");
    }
  };

  const dispararTeste = async (id) => {
    try {
      setTestandoId(id);
      await RadarAPI.testMonitor(id);
      Alert.alert(
        "⚡ Varredura Acionada!", 
        "Comando enviado com sucesso! O robô iniciará a varredura em instantes."
      );
      fetchData(null, true);
    } catch (e) {
      Alert.alert("Erro", "Falha ao enviar comando de varredura.");
    } finally {
      setTimeout(() => setTestandoId(null), 1500);
    }
  };

  const removerRadar = (id, nome) => {
    Alert.alert(
      "Excluir Radar",
      `Deseja realmente remover o monitor "${nome}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Excluir", 
          style: "destructive", 
          onPress: async () => {
            await RadarAPI.deleteMonitor(id);
            fetchData(null, true);
          } 
        }
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />

      {/* TOP HEADER */}
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenHeaderTitle}>Radares Ativos</Text>
          <Text style={styles.screenHeaderSub}>{monitores.length} tarefas de busca configuradas</Text>
        </View>
        <TouchableOpacity 
          style={styles.headerBtnSquare}
          onPress={() => navigation.navigate('Criar')}
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
              onPress={() => navigation.navigate('Criar')}
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
            } else if (modoEstrat === 'menor_preco') {
              estratDesc = 'Menor Preço';
            } else if (modoEstrat === 'por_preco' && temAlvo) {
              estratDesc = `Alvo R$ ${alvo.toFixed(0)} (±${margem}%)`;
            } else if (m.palavras && m.palavras.includes('ordenar_menor_preco')) {
              estratDesc = 'Recentes (Menor Valor)';
            }

            const infoLocal = plataforma === 'OLX' ? extrairInfoOlx(m.urls) : null;
            const estadoNome = infoLocal ? OLX_ESTADOS[infoLocal.uf]?.nome || infoLocal.uf : null;

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
                    <TouchableOpacity 
                      style={[styles.btnScanNow, (!m.ativo || testandoId === m.id) && { opacity: 0.7 }]}
                      onPress={() => dispararTeste(m.id)}
                      disabled={testandoId === m.id || !m.ativo}
                      activeOpacity={0.8}
                    >
                      {testandoId === m.id ? (
                        <ActivityIndicator size="small" color="#08090D" />
                      ) : (
                        <>
                          <Ionicons name="radio-outline" size={13} color="#08090D" style={{ marginRight: 4 }} />
                          <Text style={styles.btnScanNowText}>Varrer</Text>
                        </>
                      )}
                    </TouchableOpacity>

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
        onPress={() => navigation.navigate('Criar')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#08090D" />
      </TouchableOpacity>
    </View>
  );
}

// --- TELA 3: ALERTAS / OPORTUNIDADES CAPTURADAS ---
function AlertsScreen({ navigation }) {
  const { resultados, loading, refreshing, onRefresh, fetchData } = useContext(RadarContext);
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
          <Text style={styles.screenHeaderTitle}>Oportunidades</Text>
          <Text style={styles.screenHeaderSub}>{resultados.length} anúncios e ofertas detectados</Text>
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
        {['TODAS', 'OLX', 'ZOOM', 'BUSCAPE', 'OUTROS'].map(k => {
          const isSelected = filtroPlataforma === k;
          const label = k === 'TODAS' ? 'Todas' : k === 'OUTROS' ? 'Web' : k === 'BUSCAPE' ? 'Buscapé' : k === 'ZOOM' ? 'Zoom' : 'OLX';
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

      <ScrollView 
        contentContainerStyle={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />}
        showsVerticalScrollIndicator={false}
      >
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
            return (
              <Surface key={res.id} style={styles.alertCardFull} elevated>
                <View style={styles.alertHeaderRow}>
                  <View style={styles.row}>
                    <PlatformBadge platformKey={plat} />
                    <View style={styles.robotTag}>
                      <Ionicons name="checkmark-circle" size={13} color={THEME.success} style={{ marginRight: 4 }} />
                      <Text style={styles.robotTagText}>Capturado pelo Robô</Text>
                    </View>
                  </View>
                  <Text style={styles.alertTime}>
                    {new Date(res.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <Text style={styles.alertTitleFull}>{res.title}</Text>

                <View style={styles.alertPriceRow}>
                  <View>
                    <Text style={styles.alertPriceLabel}>VALOR CAPTURADO</Text>
                    {res.price !== null ? (
                      <Text style={styles.alertPriceValue}>R$ {Number(res.price).toFixed(2)}</Text>
                    ) : (
                      <Text style={styles.priceConsult}>Sob Consulta</Text>
                    )}
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.btnAlertAction}
                    onPress={() => Linking.openURL(res.url).catch(() => Alert.alert("Erro", "Não foi possível abrir o link."))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnAlertActionText}>Acessar Oferta</Text>
                    <Ionicons name="open-outline" size={14} color="#08090D" style={{ marginLeft: 5 }} />
                  </TouchableOpacity>
                </View>
              </Surface>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// --- TELA 4: MODAL DE CRIAÇÃO / EDIÇÃO DE RADAR ---
function CreateMonitorScreen({ navigation, route }) {
  const { 
    currentOwnerId, pushToken, setPushToken, deviceId, user, fetchData, 
    notificacoesAtivas, alternarNotificacoes 
  } = useContext(RadarContext);
  const editando = route?.params?.monitor;

  const platInicial = editando ? identificarPlataforma(editando.urls) : 'OLX';
  const [plataforma, setPlataforma] = useState(platInicial);

  const infoOlx = editando && platInicial === 'OLX' ? extrairInfoOlx(editando.urls) : { uf: 'CE', regiaoSlug: 'fortaleza-e-regiao' };
  const [estadoUf, setEstadoUf] = useState(infoOlx.uf);
  const [regiaoSlug, setRegiaoSlug] = useState(infoOlx.regiaoSlug);
  const [modalEstadoVisivel, setModalEstadoVisivel] = useState(false);
  const [modalRegiaoVisivel, setModalRegiaoVisivel] = useState(false);
  const [modalAvisoNotifVisivel, setModalAvisoNotifVisivel] = useState(false);
  const [ativandoNotif, setAtivandoNotif] = useState(false);

  const [modo, setModo] = useState(editando?.modo === 'noticia' ? 'noticia' : 'produto');
  const estratInicial = editando ? identificarEstrategia(editando) : 'mais_recentes';
  const [estrategia, setEstrategia] = useState(estratInicial);
  const [ordenarMenorPreco, setOrdenarMenorPreco] = useState(
    editando?.palavras ? editando.palavras.includes('ordenar_menor_preco') : false
  );

  const [nome, setNome] = useState(editando?.nome || '');
  const [produto, setProduto] = useState(editando?.produto || '');
  const [urls, setUrls] = useState(editando?.urls || '');
  const [precoAlvo, setPrecoAlvo] = useState(editando?.preco_alvo ? String(editando.preco_alvo) : '');
  const [margem, setMargem] = useState(String(editando?.margem || '15'));
  const [palavras, setPalavras] = useState(editando?.modo === 'noticia' ? (editando?.palavras || '') : '');
  const [intervalo, setIntervalo] = useState(String(editando?.intervalo_valor || '30'));
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
    } else if (plataforma === 'ZOOM') {
      urlFinal = `https://www.zoom.com.br/search?q=${encodeURIComponent(produto.trim())}`;
    } else if (plataforma === 'BUSCAPE') {
      urlFinal = `https://www.buscape.com.br/search?q=${encodeURIComponent(produto.trim())}`;
    } else {
      urlFinal = urls.trim();
    }

    let modoFinal = 'mais_recentes';
    let palavrasFinal = '';

    if (modo === 'noticia') {
      modoFinal = 'noticia';
      palavrasFinal = palavras.trim();
    } else {
      modoFinal = estrategia;
      if (estrategia === 'mais_recentes' && ordenarMenorPreco) {
        palavrasFinal = 'ordenar_menor_preco:true';
      }
    }

    const payload = {
      usuario_id: currentOwnerId,
      nome: nome.trim(),
      urls: urlFinal,
      modo: modoFinal,
      produto: produto.trim(),
      preco_alvo: (estrategia === 'por_preco' && alvoNum > 0) ? alvoNum : null,
      margem: margemNum,
      palavras: palavrasFinal,
      intervalo_valor: Number(intervalo) || 30,
      intervalo_unidade: 'minutos',
      ativo: true,
      forcar_teste: false
    };

    try {
      setSalvando(true);
      if (editando) {
        await RadarAPI.updateMonitor(editando.id, payload);
        fetchData(null, true);
        Alert.alert(
          "✅ Radar Atualizado!",
          `As configurações de "${nome.trim()}" foram atualizadas com sucesso.`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        await RadarAPI.createMonitor(payload);
        fetchData(null, true);
        Alert.alert(
          "✅ Radar Ativado!",
          "Monitor cadastrado com sucesso! As varreduras ocorrerão conforme a frequência agendada ou ao tocar no botão 'Varrer'.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    } catch (e) {
      Alert.alert("Erro", "Falha de conexão com o Supabase ao salvar radar.");
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
        Alert.alert("✅ Notificações Ativadas!", "Seu aparelho agora receberá alertas instantâneos de novas oportunidades.");
        await executarSalvamento();
      } else {
        Alert.alert(
          "Permissão Necessária",
          "Não será possível receber as notificações dos alertas. Habilite as notificações nas configurações do seu celular.",
          [
            { text: "Salvar sem Notificações", onPress: () => { setModalAvisoNotifVisivel(false); executarSalvamento(); } },
            { text: "Cancelar", style: "cancel" }
          ]
        );
      }
    } catch (e) {
      Alert.alert("Aviso", "Falha ao registrar notificações no aparelho.");
    } finally {
      setAtivandoNotif(false);
    }
  };

  const salvar = async () => {
    if (!nome.trim() || !intervalo.trim()) {
      return Alert.alert("Campos Obrigatórios", "Informe ao menos o Nome do Radar e a Frequência.");
    }

    if (plataforma === 'OUTROS') {
      if (!urls.trim()) {
        return Alert.alert("Campos Obrigatórios", "Informe a URL da página para monitorar.");
      }
      if (modo === 'noticia' && !palavras.trim()) {
        return Alert.alert("Campos Obrigatórios", "Informe ao menos uma palavra-chave.");
      }
      if (modo === 'produto' && !produto.trim()) {
        return Alert.alert("Campos Obrigatórios", "Informe o termo do anúncio pesquisado.");
      }
    } else {
      if (!produto.trim()) {
        return Alert.alert("Campos Obrigatórios", "Informe o termo do anúncio (ex: iPhone 15, Notebook Dell, Cadeira Gamer).");
      }
    }

    if (estrategia === 'por_preco' && modo !== 'noticia') {
      if (!precoAlvo.trim() || alvoNum <= 0) {
        return Alert.alert("Preço Alvo Obrigatório", "Na estratégia 'Rastrear pelo Preço', digite o valor alvo desejado (em R$).");
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
        
        {editando && (
          <View style={styles.editNoticeBanner}>
            <Ionicons name="create" size={15} color={THEME.primary} style={{ marginRight: 8 }} />
            <Text style={styles.editNoticeText}>Editando parâmetros do radar existente</Text>
          </View>
        )}

        {/* 1. SELEÇÃO DA PLATAFORMA */}
        <Text style={styles.formSectionTitle}>1. ONDE O ROBÔ DEVE BUSCAR</Text>
        <View style={styles.platformGrid}>
          {[
            { key: 'OLX', nome: 'OLX', icon: 'cart-outline', color: '#A855F7' },
            { key: 'ZOOM', nome: 'Zoom', icon: 'search-outline', color: '#F59E0B' },
            { key: 'BUSCAPE', nome: 'Buscapé', icon: 'pricetag-outline', color: '#10B981' },
            { key: 'OUTROS', nome: 'Outros Sites', icon: 'globe-outline', color: '#06B6D4' }
          ].map(p => {
            const isActive = plataforma === p.key;
            return (
              <TouchableOpacity 
                key={p.key}
                style={[styles.platformCardBtn, isActive && styles.platformCardBtnActive]}
                onPress={() => {
                  setPlataforma(p.key);
                  if (p.key === 'ZOOM' || p.key === 'BUSCAPE') {
                    if (estrategia === 'mais_recentes') setEstrategia('menor_preco');
                  }
                  if (p.key !== 'OUTROS') setModo('produto');
                }}
                activeOpacity={0.7}
              >
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

        {(plataforma === 'ZOOM' || plataforma === 'BUSCAPE') && (
          <View style={styles.comparatorBanner}>
            <Ionicons name="information-circle-outline" size={16} color={THEME.primary} style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              {plataforma === 'ZOOM' 
                ? "O Zoom compara preços em lojas como Amazon, Magazine Luiza e Mercado Livre em todo o Brasil."
                : "O Buscapé compara ofertas no comércio eletrônico com link direto para a compra na loja parceira."}
            </Text>
          </View>
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
                      Alert.alert("Brasil Inteiro", "A opção Brasil abrange automaticamente todas as regiões do país.");
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
                  : plataforma === 'ZOOM' || plataforma === 'BUSCAPE'
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
            {!(plataforma === 'ZOOM' || plataforma === 'BUSCAPE') && (
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

            {/* ESTRATÉGIA: POR PREÇO ALVO */}
            <TouchableOpacity 
              style={[styles.strategyCard, estrategia === 'por_preco' && styles.strategyCardActive]}
              onPress={() => setEstrategia('por_preco')}
              activeOpacity={0.8}
            >
              <View style={styles.strategyHeader}>
                <View style={[styles.strategyIconCircle, estrategia === 'por_preco' && styles.strategyIconCircleActive]}>
                  <Ionicons name="pricetag-outline" size={17} color={estrategia === 'por_preco' ? THEME.primary : THEME.textMuted} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={[styles.strategyTitle, estrategia === 'por_preco' && styles.strategyTitleActive]}>
                    Rastrear por Preço Alvo (Faixa Orçamentária)
                  </Text>
                  <Text style={styles.strategyDesc}>
                    Filtra ofertas com margem de tolerância em torno do seu valor desejado.
                  </Text>
                </View>
                <Ionicons 
                  name={estrategia === 'por_preco' ? "radio-button-on" : "radio-button-off"} 
                  size={19} 
                  color={estrategia === 'por_preco' ? THEME.primary : THEME.textSubtle} 
                />
              </View>

              {estrategia === 'por_preco' && (
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
            placeholder="30" 
            placeholderTextColor={THEME.textSubtle} 
            keyboardType="numeric" 
            value={intervalo} 
            onChangeText={setIntervalo} 
          />
        </Surface>

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
          if (item.uf === 'BR') {
            setRegiaoSlug('');
          } else {
            const regs = OLX_ESTADOS[item.uf]?.regioes || [];
            setRegiaoSlug(regs.length > 1 ? regs[1].slug : regs[0]?.slug || '');
          }
        }}
        onClose={() => setModalEstadoVisivel(false)}
      />

      <SelectionModal 
        visible={modalRegiaoVisivel}
        title={`Regiões de ${OLX_ESTADOS[estadoUf]?.nome}`}
        items={regioesDoEstado}
        selectedId={regiaoSlug}
        onSelect={(item) => setRegiaoSlug(item.slug)}
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
    pushToken, deviceId, user, fetchData, linkAccount, logoutUser,
    notificacoesAtivas, alternarNotificacoes 
  } = useContext(RadarContext);

  const [authTab, setAuthTab] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authSenha, setAuthSenha] = useState('');
  const [authConfirmaSenha, setAuthConfirmaSenha] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [modalRecuperacaoVisivel, setModalRecuperacaoVisivel] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState('');
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);

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
        Alert.alert("Google Sign-In", error.message);
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
            Alert.alert("✅ Sucesso", "Conta Google conectada com sucesso!");
          }
        }
      }
    } catch (e) {
      Alert.alert(
        "Configuração do Google", 
        "Para utilizar o login com o Google, ative o provedor Google no Supabase Dashboard e adicione a URL de retorno às Redirect URLs autorizadas."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLoginEmail = async () => {
    if (!authEmail.trim() || !authSenha.trim()) {
      return Alert.alert("Campos Obrigatórios", "Informe seu email e senha.");
    }
    try {
      setAuthLoading(true);
      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authSenha.trim()
      });
      if (error) {
        Alert.alert("Falha no Login", error.message);
      } else {
        if (data?.user) {
          await linkAccount(data.user);
        }
        Alert.alert("✅ Conectado", `Bem-vindo de volta, ${data.user.email}!`);
        setAuthEmail('');
        setAuthSenha('');
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível conectar.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignupEmail = async () => {
    if (!authEmail.trim() || !authSenha.trim() || !authConfirmaSenha.trim()) {
      return Alert.alert("Campos Obrigatórios", "Preencha todos os campos para criar sua conta.");
    }
    if (authSenha.length < 6) {
      return Alert.alert("Senha Curta", "A senha deve conter ao menos 6 caracteres.");
    }
    if (authSenha !== authConfirmaSenha) {
      return Alert.alert("Senhas Não Conferem", "A senha e a confirmação devem ser idênticas.");
    }
    try {
      setAuthLoading(true);
      const { data, error } = await supabaseAuth.auth.signUp({
        email: authEmail.trim(),
        password: authSenha.trim()
      });
      if (error) {
        Alert.alert("Falha no Cadastro", error.message);
      } else {
        if (data?.user) {
          await linkAccount(data.user);
        }
        Alert.alert(
          "✅ Conta Criada!", 
          "Sua conta foi criada com sucesso e os dados deste aparelho já foram vinculados a ela!"
        );
        setAuthEmail('');
        setAuthSenha('');
        setAuthConfirmaSenha('');
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível criar a conta.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!emailRecuperacao.trim()) {
      return Alert.alert("Email Obrigatório", "Informe o email cadastrado.");
    }
    try {
      setRecuperandoSenha(true);
      const { error } = await supabaseAuth.auth.resetPasswordForEmail(emailRecuperacao.trim());
      if (error) {
        Alert.alert("Aviso", error.message);
      } else {
        Alert.alert(
          "Email Enviado", 
          "Caso este email esteja cadastrado, enviamos as instruções para recuperação da sua senha."
        );
        setModalRecuperacaoVisivel(false);
        setEmailRecuperacao('');
      }
    } catch (e) {
      Alert.alert("Erro", "Falha ao solicitar recuperação de senha.");
    } finally {
      setRecuperandoSenha(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Sair da Conta",
      "Deseja realmente desconectar? Este aparelho voltará a operar no modo anônimo limpo e não terá acesso aos dados da conta.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sair", 
          style: "destructive", 
          onPress: async () => {
            await logoutUser();
          } 
        }
      ]
    );
  };

  const dispararTesteLocal = async () => {
    try {
      const res = await testLocalNotification();
      if (res && res.success === false) {
        Alert.alert("Informação", res.message);
      } else {
        Alert.alert("Sucesso", "Notificação de teste disparada na barra de status.");
      }
    } catch (e) {
      Alert.alert("Aviso", "Notificações locais requerem o app compilado.");
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />

      {/* TOP HEADER */}
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenHeaderTitle}>Configurações</Text>
          <Text style={styles.screenHeaderSub}>Identidade, Nuvem e Servidor</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        
        {/* SEÇÃO 1: IDENTIDADE DO USUÁRIO */}
        <SectionHeader title="IDENTIDADE DO USUÁRIO" icon="person-circle-outline" />

        {user ? (
          <Surface style={styles.settingsCard} elevated>
            <View style={styles.rowBetween}>
              <View style={[styles.row, { flex: 1, marginRight: 10 }]}>
                <View style={styles.userAvatarBox}>
                  <Ionicons name="person" size={18} color={THEME.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.userEmailText} numberOfLines={1}>{user.email}</Text>
                  <Text style={styles.userProviderText}>
                    {user.app_metadata?.provider === 'google' ? 'Conectado via Google' : 'Conectado via Email/Senha'}
                  </Text>
                </View>
              </View>
              <View style={[styles.badgeSuccessPill, { flexShrink: 0 }]}>
                <View style={styles.badgeSuccessDot} />
                <Text style={styles.badgeSuccessPillText}>CONECTADO</Text>
              </View>
            </View>

            <View style={styles.divider} />
            <Text style={styles.syncDescText}>
              Seus radares e alertas estão sincronizados em nuvem. Qualquer outro aparelho conectado com este email terá acesso instantâneo.
            </Text>

            <TouchableOpacity 
              style={styles.btnLogoutModern}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={15} color={THEME.danger} style={{ marginRight: 6 }} />
              <Text style={styles.btnLogoutModernText}>Desconectar Conta</Text>
            </TouchableOpacity>
          </Surface>
        ) : (
          <Surface style={styles.settingsCard} elevated>
            <Text style={styles.syncDescText}>
              Crie ou acesse sua conta para sincronizar seus radares entre vários aparelhos. Se preferir continuar sem conta, seus dados ficam salvos de forma segura e privada neste aparelho.
            </Text>

            <TouchableOpacity 
              style={styles.btnGoogleModern}
              onPress={handleLoginGoogle}
              activeOpacity={0.85}
              disabled={authLoading}
            >
              <Ionicons name="logo-google" size={17} color="#08090D" style={{ marginRight: 8 }} />
              <Text style={styles.btnGoogleModernText}>Continuar com o Google</Text>
            </TouchableOpacity>

            <View style={styles.authDividerRow}>
              <View style={styles.authDividerLine} />
              <Text style={styles.authDividerText}>ou email e senha</Text>
              <View style={styles.authDividerLine} />
            </View>

            <View style={styles.authTabPillWrap}>
              <TouchableOpacity 
                style={[styles.authTabPill, authTab === 'login' && styles.authTabPillActive]}
                onPress={() => setAuthTab('login')}
              >
                <Text style={[styles.authTabPillText, authTab === 'login' && styles.authTabPillTextActive]}>Entrar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.authTabPill, authTab === 'cadastro' && styles.authTabPillActive]}
                onPress={() => setAuthTab('cadastro')}
              >
                <Text style={[styles.authTabPillText, authTab === 'cadastro' && styles.authTabPillTextActive]}>Criar Conta</Text>
              </TouchableOpacity>
            </View>

            {authTab === 'login' ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputTitle}>EMAIL</Text>
                <TextInput 
                  style={styles.inputField}
                  placeholder="seu@email.com"
                  placeholderTextColor={THEME.textSubtle}
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={[styles.inputTitle, { marginTop: 10 }]}>SENHA</Text>
                <TextInput 
                  style={styles.inputField}
                  placeholder="Sua senha de acesso"
                  placeholderTextColor={THEME.textSubtle}
                  value={authSenha}
                  onChangeText={setAuthSenha}
                  secureTextEntry
                />

                <TouchableOpacity 
                  onPress={() => { setEmailRecuperacao(authEmail); setModalRecuperacaoVisivel(true); }}
                  style={{ alignSelf: 'flex-end', marginTop: 8 }}
                >
                  <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
                </TouchableOpacity>

                <PrimaryButton 
                  title="Entrar na Conta"
                  onPress={handleLoginEmail}
                  loading={authLoading}
                  style={{ marginTop: 14 }}
                />
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputTitle}>SEU EMAIL</Text>
                <TextInput 
                  style={styles.inputField}
                  placeholder="seu@email.com"
                  placeholderTextColor={THEME.textSubtle}
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={[styles.inputTitle, { marginTop: 10 }]}>CRIAR SENHA</Text>
                <TextInput 
                  style={styles.inputField}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={THEME.textSubtle}
                  value={authSenha}
                  onChangeText={setAuthSenha}
                  secureTextEntry
                />

                <Text style={[styles.inputTitle, { marginTop: 10 }]}>CONFIRMAR SENHA</Text>
                <TextInput 
                  style={styles.inputField}
                  placeholder="Repita a mesma senha"
                  placeholderTextColor={THEME.textSubtle}
                  value={authConfirmaSenha}
                  onChangeText={setAuthConfirmaSenha}
                  secureTextEntry
                />

                <PrimaryButton 
                  title="Cadastrar e Vincular"
                  onPress={handleSignupEmail}
                  loading={authLoading}
                  style={{ marginTop: 14 }}
                />
              </View>
            )}
          </Surface>
        )}

        {/* SEÇÃO 2: SERVIDOR DO ROBÔ */}
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
            • Responsável pelo processamento e varredura periódica de anúncios e ofertas na internet.
          </Text>
        </Surface>

        {/* SEÇÃO 3: NOTIFICAÇÕES */}
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

        {/* SEÇÃO 4: SOBRE O ACHÔAI */}
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
            <Text style={styles.aboutMetaValue}>1.0.0 (Build 2026)</Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: 6 }]}>
            <Text style={styles.aboutMetaLabel}>Fontes Integradas</Text>
            <Text style={styles.aboutMetaValue}>OLX, Zoom, Buscapé & Web</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.aboutCopyrightText}>
            A11 Digital © 2026. Todos os direitos reservados.
          </Text>
        </Surface>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* MODAL RECUPERAÇÃO DE SENHA */}
      <Modal visible={modalRecuperacaoVisivel} animationType="fade" transparent={true} onRequestClose={() => setModalRecuperacaoVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recuperar Senha</Text>
              <TouchableOpacity onPress={() => setModalRecuperacaoVisivel(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={THEME.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.syncDescText}>
              Informe seu email para enviarmos instruções seguras de recuperação de acesso.
            </Text>

            <Text style={[styles.inputTitle, { marginTop: 12 }]}>EMAIL</Text>
            <TextInput 
              style={styles.inputField}
              placeholder="seu@email.com"
              placeholderTextColor={THEME.textSubtle}
              value={emailRecuperacao}
              onChangeText={setEmailRecuperacao}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <PrimaryButton 
              title="Enviar Link de Recuperação"
              onPress={handleResetPassword}
              loading={recuperandoSenha}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>
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
  telemetryEmpty: { alignItems: 'center', paddingVertical: 15 },
  telemetryRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.cardBorder },
  telemetryDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 5, marginRight: 10 },
  telemetryMessage: { fontSize: 12, color: THEME.textSecondary, lineHeight: 17 },
  telemetryMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  telemetryTime: { fontSize: 10, color: THEME.textSubtle },
  telemetrySeparator: { fontSize: 10, color: THEME.textSubtle, marginHorizontal: 5 },
  telemetrySource: { fontSize: 10, color: THEME.textMuted },

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
    marginBottom: 10
  },
  btnGoogleModernText: { fontSize: 13, fontWeight: '700', color: '#08090D' },
  authDividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  authDividerLine: { flex: 1, height: 1, backgroundColor: THEME.cardBorder },
  authDividerText: { fontSize: 11, color: THEME.textSubtle, marginHorizontal: 8 },
  authTabPillWrap: { flexDirection: 'row', backgroundColor: THEME.cardBgElevated, borderRadius: THEME.radius.sm, padding: 3, marginBottom: 10 },
  authTabPill: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  authTabPillActive: { backgroundColor: THEME.primary },
  authTabPillText: { fontSize: 11, fontWeight: '700', color: THEME.textMuted },
  authTabPillTextActive: { color: '#08090D', fontWeight: '800' },
  forgotPasswordText: { fontSize: 11, color: THEME.primary, fontWeight: '600' },
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