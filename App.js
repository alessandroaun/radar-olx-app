import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, 
  Alert, Platform, LayoutAnimation, StatusBar, 
  ActivityIndicator, Switch, Dimensions, Linking, RefreshControl,
  Modal, FlatList
} from 'react-native';
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

WebBrowser.maybeCompleteAuthSession();

// =====================================================================
// 1. CONFIGURAÇÕES VISUAIS E TEMA MODERNO ANDROID
// =====================================================================
const THEME = {
  bg: '#07090E',
  cardBg: '#11141D',
  cardBorder: '#1E2333',
  primary: '#FF9500', 
  primaryGlow: 'rgba(255, 149, 0, 0.2)',
  primaryHover: '#FFA726',
  secondary: '#0A84FF', 
  text: '#F5F7FA',
  textMuted: '#8A93A6',
  textSubtle: '#4E5669',
  success: '#30D158',
  successBg: 'rgba(48, 209, 88, 0.15)',
  danger: '#FF453A',
  dangerBg: 'rgba(255, 69, 58, 0.15)',
  warning: '#FFD60A',
  badgeBg: '#191E2B'
};

// =====================================================================
// 2. API SERVICE (SUPABASE)
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

  static async getLogs(limit = 8, monitorIds = null) {
    try {
      if (monitorIds !== null && monitorIds.length === 0) return [];
      let query = supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (monitorIds !== null) {
        query = query.in('monitor_id', monitorIds);
      }
      const { data, error } = await query;
      if (error) return [];
      return data || [];
    } catch (e) { return []; }
  }

  static async getAllResults(limit = 40, monitorIds = null) {
    try {
      let query = supabase.from('resultados').select('*').order('created_at', { ascending: false }).limit(limit);
      if (monitorIds !== null) {
        if (monitorIds.length === 0) return [];
        query = query.in('monitor_id', monitorIds);
      }
      const { data, error } = await query;
      if (error) return [];
      return data || [];
    } catch (e) { return []; }
  }
}

// =====================================================================
// 3. CONTEXTO GLOBAL (STATE MANAGEMENT)
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

  // Refs para manter valores atualizados sem disparar recriação de callbacks
  const deviceIdRef = useRef(deviceId);
  deviceIdRef.current = deviceId;
  const pushTokenRef = useRef(pushToken);
  pushTokenRef.current = pushToken;
  const userRef = useRef(user);
  userRef.current = user;

  // O dono dos radares é o ID da conta conectada ou o ID anônimo do aparelho
  const currentOwnerId = user?.id || deviceId;

  const fetchData = useCallback(async (targetOwnerId = null) => {
    const ownerId = targetOwnerId || userRef.current?.id || deviceIdRef.current;
    if (!ownerId) return;
    try {
      setLoading(true);
      const dadosMonitores = await RadarAPI.getMonitors(ownerId);
      const monitorIds = (dadosMonitores || []).map(m => m.id);

      const [dadosResultados, dadosAtividades] = await Promise.all([
        RadarAPI.getAllResults(40, monitorIds),
        RadarAPI.getLogs(8, monitorIds)
      ]);

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMonitores(dadosMonitores || []);
      setResultados(dadosResultados || []);
      setAtividades(dadosAtividades || []);
    } catch (e) {
      console.log("Erro ao sincronizar com Supabase:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Função centralizada para alternar estado de notificações do aparelho
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
      console.log('[Radar] Notificações desativadas: token limpo no contexto e Supabase.');
    } else {
      if (currentDevId) {
        const token = await registerPushToken(currentDevId, userRef.current?.id);
        if (token) {
          setPushToken(token);
          pushTokenRef.current = token;
        }
      }
      console.log('[Radar] Notificações ativadas pelo usuário.');
    }
  }, []);

  // Função centralizada para vincular conta ao aparelho e migrar dados
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

  // Função centralizada para logout limpo com desvinculação completa
  const logoutUser = useCallback(async () => {
    try {
      setLoading(true);
      const oldDevId = deviceIdRef.current;
      const currentToken = pushTokenRef.current;

      // 1. Encerra a sessão Auth
      await supabaseAuth.auth.signOut();

      // 2. Desvincula o aparelho antigo no banco e gera novo ID limpo
      const newDevId = await resetDeviceOnLogout(oldDevId, currentToken);
      setDeviceId(newDevId);
      deviceIdRef.current = newDevId;

      setUser(null);
      userRef.current = null;

      // 3. Limpa completamente todos os dados do estado local
      setMonitores([]);
      setResultados([]);
      setAtividades([]);

      // 4. Busca dados para o novo ID limpo (inicia zerado)
      await fetchData(newDevId);
    } catch (e) {
      console.log("[Radar] Erro ao efetuar logout:", e);
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  // Inicialização do Aparelho, Push e Sessão Auth (executa no mount)
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

      // Registra aparelho no Supabase
      await registerDeviceInSupabase(devId, null, currentUser?.id);

      // Se já estava autenticado ao abrir o app, garante migração de eventuais dados órfãos
      if (currentUser) {
        await migrateDeviceMonitorsToAccount(devId, currentUser.id, null);
      }

      fetchData(currentUser?.id || devId);

      // Verifica preferência de notificações
      const savedNotif = await AsyncStorage.getItem('@radar_notificacoes_ativas');
      const isNotifActive = savedNotif !== null ? savedNotif === 'true' : true;
      if (mounted) setNotificacoesAtivas(isNotifActive);

      // Registra push token apenas se o usuário permitiu nas configurações
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

    // Listener de eventos Auth do Supabase
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
      () => { fetchData(); },
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

  // Inscrição em canais Realtime do Supabase para atualização instantânea
  useEffect(() => {
    if (!currentOwnerId) return;

    const channel = supabase
      .channel(`realtime-radar-${currentOwnerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitores' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resultados' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
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
// 4. COMPONENTES VISUAIS REUTILIZÁVEIS
// =====================================================================
const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>
    {children}
  </View>
);

const PrimaryButton = ({ title, onPress, icon, loading: btnLoading }) => (
  <TouchableOpacity 
    style={[styles.btnPrimary, btnLoading && { opacity: 0.7 }]} 
    onPress={onPress} 
    activeOpacity={0.8}
    disabled={btnLoading}
  >
    {btnLoading ? (
      <ActivityIndicator size="small" color="#000" />
    ) : (
      <>
        {icon && <Ionicons name={icon} size={18} color="#000" style={{ marginRight: 8 }} />}
        <Text style={styles.btnPrimaryText}>{title}</Text>
      </>
    )}
  </TouchableOpacity>
);

// =====================================================================
// 4.1. COMPONENTES E AUXILIARES DE PLATAFORMAS E ESTRATÉGIAS
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

  for (const [uf, dados] of Object.entries(OLX_ESTADOS)) {
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

// Formata o contador regressivo ignorando horas e minutos se forem zero
function formatarTempoRegressivo(proximaDataStr, now) {
  if (!proximaDataStr) return 'Aguardando agendamento';
  const diffMs = new Date(proximaDataStr).getTime() - now;
  if (diffMs <= 0) return 'Varrendo em instantes...';

  const totalSegundos = Math.floor(diffMs / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  if (horas > 0) {
    return `${horas}h ${minutos}m ${segundos}s`;
  }
  if (minutos > 0) {
    return `${minutos}m ${segundos}s`;
  }
  return `${segundos}s`;
}

// Calcula os segundos restantes para o radar ativo mais próximo
function calcularSegundosProximaVarredura(monitores, now) {
  const ativos = (monitores || []).filter(m => m.ativo && m.proxima_execucao);
  if (ativos.length === 0) return null;
  
  let menorDiff = Infinity;
  for (const m of ativos) {
    const diff = Math.floor((new Date(m.proxima_execucao).getTime() - now) / 1000);
    if (diff < menorDiff) {
      menorDiff = diff;
    }
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
              <Ionicons name="close" size={22} color={THEME.text} />
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
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={THEME.primary} />}
                </TouchableOpacity>
              );
            }}
            style={{ maxHeight: 350 }}
          />
        </View>
      </View>
    </Modal>
  );
}

// =====================================================================
// 5. TELAS (SCREENS)
// =====================================================================

// --- TELA 1: HOME / DASHBOARD ---
function DashboardScreen({ navigation }) {
  const { monitores, resultados, atividades, loading, refreshing, onRefresh, fetchData } = useContext(RadarContext);
  const ativos = monitores.filter(m => m.ativo).length;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { fetchData(); });
    return unsub;
  }, [navigation, fetchData]);

  const segProx = calcularSegundosProximaVarredura(monitores, now);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>AchôAI</Text>
          <Text style={styles.headerSubtitle}>Monitoramento de anúncios e notícias relevantes</Text>
          <View style={[styles.serverPill, { marginTop: 6 }]}>
            <View style={styles.serverDot} />
            <Text style={styles.serverText}>Servidor de Varredura Online</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.headerBtn} 
          onPress={() => navigation.navigate('Criar')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={24} color={THEME.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />}
      >
        <View style={styles.statsRow}>
          <Card style={styles.statBox}>
            <View style={styles.statIconBadge}>
              <Ionicons name="pulse" size={20} color={THEME.primary} />
            </View>
            <Text style={styles.statNumber}>{ativos}</Text>
            <Text style={styles.statLabel}>Radares Ativos</Text>
          </Card>

          <Card style={styles.statBox}>
            <View style={[styles.statIconBadge, { backgroundColor: THEME.successBg }]}>
              <Ionicons name="pricetag" size={20} color={THEME.success} />
            </View>
            <Text style={styles.statNumber}>{resultados.length}</Text>
            <Text style={styles.statLabel}>Oportunidades Totais</Text>
          </Card>

          <Card style={styles.statBox}>
            <View style={[styles.statIconBadge, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
              <Ionicons name="timer-outline" size={20} color={THEME.secondary} />
            </View>
            <Text style={styles.statNumber}>
              {segProx === null ? '--' : segProx === 0 ? 'Agora' : `${segProx}s`}
            </Text>
            <Text style={styles.statLabel}>Próxima Varredura</Text>
          </Card>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ÚLTIMAS OPORTUNIDADES CAPTURADAS</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Alertas')}>
            <Text style={styles.sectionLink}>Ver Todas</Text>
          </TouchableOpacity>
        </View>

        {resultados.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="scan-outline" size={36} color={THEME.textSubtle} />
            <Text style={styles.emptyCardText}>Nenhum anúncio detectado ainda.</Text>
            <Text style={styles.emptyCardSub}>O robô de busca monitora ofertas nos intervalos configurados.</Text>
          </Card>
        ) : (
          resultados.slice(0, 3).map(item => (
            <Card key={item.id} style={styles.resultCard}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.resultDate}>
                    {new Date(item.created_at).toLocaleDateString('pt-BR')} às {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {item.price !== null && (
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceText}>R$ {Number(item.price).toFixed(2)}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.openBtn} 
                onPress={() => Linking.openURL(item.url).catch(() => Alert.alert("Erro", "Não foi possível abrir o link."))}
                activeOpacity={0.7}
              >
                <Text style={styles.openBtnText}>
                  {item.url.includes('zoom.com.br') ? 'Ver Oferta no Zoom' : item.url.includes('buscape.com.br') ? 'Ver Oferta no Buscapé' : item.url.includes('olx.com.br') ? 'Ver Anúncio na OLX' : 'Abrir Link do Anúncio'}
                </Text>
                <Ionicons name="open-outline" size={14} color={THEME.primary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </Card>
          ))
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>HISTÓRICO DE VARREDURAS</Text>
        </View>
        <Card style={styles.logCard}>
          {loading ? (
            <ActivityIndicator size="small" color={THEME.primary} style={{ padding: 20 }} />
          ) : atividades.length === 0 ? (
            <Text style={styles.emptyCardSub}>Aguardando ciclo de varredura...</Text>
          ) : (
            atividades.map((at, idx) => (
              <View key={at.id || idx} style={[styles.logRow, idx === atividades.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[
                  styles.logDot, 
                  { backgroundColor: at.level === 'SUCCESS' ? THEME.success : at.level === 'ERROR' ? THEME.danger : at.level === 'WARNING' ? THEME.warning : THEME.secondary }
                ]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.logMessage}>{at.message}</Text>
                  <Text style={styles.logTime}>{new Date(at.created_at).toLocaleTimeString()} • Servidor do Robô</Text>
                </View>
              </View>
            ))
          )}
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// --- TELA 2: RADARES (MONITORES) ---
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
      fetchData();
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
      fetchData();
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
            fetchData();
          } 
        }
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>Radares Ativos</Text>
          <Text style={styles.headerSubtitle}>{monitores.length} tarefas cadastradas</Text>
        </View>
        <TouchableOpacity 
          style={styles.headerBtn} 
          onPress={() => navigation.navigate('Criar')}
        >
          <Ionicons name="add" size={24} color={THEME.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
        ) : monitores.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="radio-outline" size={70} color={THEME.textSubtle} />
            <Text style={styles.emptyStateTitle}>Nenhum Radar Criado</Text>
            <Text style={styles.emptyStateSub}>
              Crie seu primeiro radar no AchôAI para monitorar anúncios na OLX, Zoom, Buscapé ou notícias importantes.
            </Text>
            <TouchableOpacity 
              style={[styles.btnPrimary, { marginTop: 25, width: '100%' }]} 
              onPress={() => navigation.navigate('Criar')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#000" style={{ marginRight: 6 }} />
              <Text style={styles.btnPrimaryText}>Criar Primeiro Radar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          monitores.map(m => {
            const isProd = m.modo !== 'noticia';
            const plataforma = identificarPlataforma(m.urls);
            const modoEstrat = identificarEstrategia(m);
            const temAlvo = m.preco_alvo !== null && m.preco_alvo !== undefined && Number(m.preco_alvo) > 0;
            const alvo = temAlvo ? Number(m.preco_alvo) : 0;
            const margem = Number(m.margem) || 15;
            const min = alvo - (alvo * (margem / 100));
            const max = alvo + (alvo * (margem / 100));

            let platNome = 'OLX';
            let platCor = THEME.primary;
            if (plataforma === 'ZOOM') {
              platNome = 'ZOOM';
              platCor = THEME.warning;
            } else if (plataforma === 'BUSCAPE') {
              platNome = 'Buscapé';
              platCor = THEME.success;
            } else if (plataforma === 'OUTROS') {
              platNome = isProd ? 'Web' : 'Notícia';
              platCor = THEME.secondary;
            }

            let estratDesc = 'Mais Recentes';
            if (m.modo === 'noticia') {
              estratDesc = 'Notícia';
            } else if (modoEstrat === 'menor_preco') {
              estratDesc = 'Menor Preço';
            } else if (modoEstrat === 'por_preco' && temAlvo) {
              estratDesc = `Alvo R$ ${alvo.toFixed(0)} (±${margem}%)`;
            } else if (m.palavras && m.palavras.includes('ordenar_menor_preco')) {
              estratDesc = 'Recentes (Menor > Maior)';
            }

            return (
              <Card key={m.id} style={styles.radarCard}>
                {/* CABEÇALHO DO CARD COM ALINHAMENTO CORRETO DO SWITCH */}
                <View style={styles.radarCardHeader}>
                  <View style={styles.radarTitleGroup}>
                    <View style={[styles.modeBadge, { backgroundColor: isProd ? THEME.primaryGlow : 'rgba(10, 132, 255, 0.15)' }]}>
                      <Ionicons name={isProd ? "cart-outline" : "newspaper-outline"} size={16} color={isProd ? THEME.primary : THEME.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.radarTitle} numberOfLines={1}>{m.nome}</Text>
                      <View style={[styles.row, { marginTop: 3 }]}>
                        <View style={[styles.platformBadge, { borderColor: platCor }]}>
                          <Text style={[styles.platformBadgeText, { color: platCor }]}>{platNome}</Text>
                        </View>
                        <Text style={styles.strategyBadgeText} numberOfLines={1}>{estratDesc}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.switchWrapper}>
                    <Switch 
                      value={m.ativo}
                      onValueChange={() => alternarStatus(m.id, m.ativo)}
                      trackColor={{ false: '#2C3040', true: THEME.primary }}
                      thumbColor="#FFF"
                    />
                  </View>
                </View>

                {/* CORPO DO CARD COM DETALHES DA ESTRATÉGIA */}
                <View style={styles.radarBody}>
                  {isProd ? (
                    <>
                      <Text style={styles.radarParam}>
                        Termo: <Text style={{ color: THEME.text, fontWeight: 'bold' }}>{m.produto || 'Todos'}</Text>
                      </Text>
                      {modoEstrat === 'menor_preco' ? (
                        <Text style={styles.radarParamSub}>
                          🎯 Capturando automaticamente o menor valor disponível
                        </Text>
                      ) : modoEstrat === 'por_preco' && temAlvo ? (
                        <>
                          <Text style={styles.radarParam}>
                            Alvo: <Text style={{ color: THEME.success, fontWeight: 'bold' }}>R$ {alvo.toFixed(2)}</Text> (±{margem}%)
                          </Text>
                          <Text style={styles.radarParamSub}>
                            Faixa aceita: R$ {min.toFixed(2)} até R$ {max.toFixed(2)}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.radarParam}>
                          Preço: <Text style={{ color: THEME.secondary, fontWeight: 'bold' }}>
                            {m.palavras && m.palavras.includes('ordenar_menor_preco') ? 'Todos (Ordenado Menor > Maior)' : 'Todos os anúncios mais recentes'}
                          </Text>
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.radarParam}>
                      Palavras: <Text style={{ color: THEME.text, fontWeight: 'bold' }}>{m.palavras || 'Nenhuma'}</Text>
                    </Text>
                  )}
                  <Text style={styles.radarUrl} numberOfLines={1}>🔗 {m.urls}</Text>
                </View>

                {/* RODAPÉ DO CARD HARMONIOSO E EQUILIBRADO */}
                <View style={styles.radarFooterHarmonious}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.radarFrequencyText}>
                      Varredura a cada {m.intervalo_valor} min
                    </Text>
                    <View style={[styles.row, { marginTop: 2 }]}>
                      <Ionicons name="time-outline" size={12} color={m.ativo ? THEME.primary : THEME.textSubtle} style={{ marginRight: 4 }} />
                      <Text style={[styles.radarCountdownText, !m.ativo && { color: THEME.textSubtle }]}>
                        {!m.ativo ? 'Radar pausado' : formatarTempoRegressivo(m.proxima_execucao, now)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.row}>
                    {/* Botão Varrer com tamanho proporcional e harmônico */}
                    <TouchableOpacity 
                      style={styles.btnVarrerCompact} 
                      onPress={() => dispararTeste(m.id)}
                      disabled={testandoId === m.id || !m.ativo}
                      activeOpacity={0.8}
                    >
                      {testandoId === m.id ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <>
                          <Ionicons name="radio-outline" size={13} color="#000" style={{ marginRight: 5 }} />
                          <Text style={styles.btnVarrerCompactText}>Varrer Agora</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Botão Editar discreto ao lado da lixeira */}
                    <TouchableOpacity 
                      style={[styles.btnIconAction, { marginLeft: 6 }]} 
                      onPress={() => navigation.navigate('Criar', { monitor: m })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={16} color={THEME.textMuted} />
                    </TouchableOpacity>

                    {/* Botão Excluir */}
                    <TouchableOpacity 
                      style={[styles.btnIconAction, { marginLeft: 6 }]} 
                      onPress={() => removerRadar(m.id, m.nome)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color={THEME.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('Criar')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

// --- TELA 3: ALERTAS / HISTÓRICO COMPLETO ---
function AlertsScreen({ navigation }) {
  const { resultados, loading, refreshing, onRefresh, fetchData } = useContext(RadarContext);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { fetchData(); });
    return unsub;
  }, [navigation, fetchData]);

  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>Oportunidades</Text>
          <Text style={styles.headerSubtitle}>{resultados.length} itens capturados</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 50 }} />
        ) : resultados.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="notifications-off-outline" size={70} color={THEME.textSubtle} />
            <Text style={styles.emptyStateTitle}>Nenhum Alerta no Momento</Text>
            <Text style={styles.emptyStateSub}>
              Quando o robô encontrar um anúncio compatível, ele aparecerá aqui com o valor destacado.
            </Text>
          </View>
        ) : (
          resultados.map(res => (
            <Card key={res.id} style={styles.resultCardFull}>
              <View style={styles.rowBetween}>
                <View style={styles.row}>
                  <Ionicons name="checkmark-circle" size={18} color={THEME.success} style={{ marginRight: 6 }} />
                  <Text style={styles.resultTag}>Capturado pelo Robô</Text>
                </View>
                <Text style={styles.resultTimeAgo}>
                  {new Date(res.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <Text style={styles.resultTitleFull}>{res.title}</Text>

              {res.price !== null && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>VALOR IDENTIFICADO</Text>
                  <Text style={styles.priceValue}>R$ {Number(res.price).toFixed(2)}</Text>
                </View>
              )}

              <TouchableOpacity 
                style={styles.btnOpenFull} 
                onPress={() => Linking.openURL(res.url).catch(() => Alert.alert("Erro", "Não foi possível abrir o link."))}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={18} color="#000" style={{ marginRight: 8 }} />
                <Text style={styles.btnOpenFullText}>Abrir Página do Anúncio</Text>
              </TouchableOpacity>
            </Card>
          ))
        )}
        <View style={{ height: 100 }} />
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

  // Plataforma inicial
  const platInicial = editando ? identificarPlataforma(editando.urls) : 'OLX';
  const [plataforma, setPlataforma] = useState(platInicial);

  // OLX Estado e Região
  const infoOlx = editando && platInicial === 'OLX' ? extrairInfoOlx(editando.urls) : { uf: 'CE', regiaoSlug: 'fortaleza-e-regiao' };
  const [estadoUf, setEstadoUf] = useState(infoOlx.uf);
  const [regiaoSlug, setRegiaoSlug] = useState(infoOlx.regiaoSlug);
  const [modalEstadoVisivel, setModalEstadoVisivel] = useState(false);
  const [modalRegiaoVisivel, setModalRegiaoVisivel] = useState(false);
  const [modalAvisoNotifVisivel, setModalAvisoNotifVisivel] = useState(false);
  const [ativandoNotif, setAtivandoNotif] = useState(false);

  // Modo básico (produto ou noticia)
  const [modo, setModo] = useState(editando?.modo === 'noticia' ? 'noticia' : 'produto');

  // Estratégia de captura
  const estratInicial = editando ? identificarEstrategia(editando) : 'mais_recentes';
  const [estrategia, setEstrategia] = useState(estratInicial);
  const [ordenarMenorPreco, setOrdenarMenorPreco] = useState(
    editando?.palavras ? editando.palavras.includes('ordenar_menor_preco') : false
  );

  // Campos de formulário
  const [nome, setNome] = useState(editando?.nome || '');
  const [produto, setProduto] = useState(editando?.produto || '');
  const [urls, setUrls] = useState(editando?.urls || '');
  const [precoAlvo, setPrecoAlvo] = useState(editando?.preco_alvo ? String(editando.preco_alvo) : '');
  const [margem, setMargem] = useState(String(editando?.margem || '15'));
  const [palavras, setPalavras] = useState(editando?.modo === 'noticia' ? (editando?.palavras || '') : '');
  const [intervalo, setIntervalo] = useState(String(editando?.intervalo_valor || '30'));
  const [salvando, setSalvando] = useState(false);

  // Atualizar título da barra de navegação se estiver editando
  useEffect(() => {
    navigation.setOptions({
      title: editando ? 'Editar Radar de Varredura' : 'Novo Radar de Varredura'
    });
  }, [navigation, editando]);

  // Regiões do estado selecionado
  const regioesDoEstado = (OLX_ESTADOS[estadoUf]?.regioes) || [{ nome: 'Todo o Estado', slug: '' }];
  const regiaoAtual = regioesDoEstado.find(r => r.slug === regiaoSlug) || regioesDoEstado[0];

  const alvoNum = Number(precoAlvo) || 0;
  const margemNum = Number(margem) || 0;
  const minEstimado = alvoNum - (alvoNum * (margemNum / 100));
  const maxEstimado = alvoNum + (alvoNum * (margemNum / 100));

  const executarSalvamento = async () => {
    // Composição da URL final
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

    // Composição do Modo e Palavras
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
        fetchData();
        Alert.alert(
          "✅ Radar Atualizado!",
          `As configurações de "${nome.trim()}" foram atualizadas com sucesso.`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        await RadarAPI.createMonitor(payload);
        fetchData();
        Alert.alert(
          "✅ Radar Ativado!",
          "Monitor cadastrado com sucesso! As varreduras ocorrerão conforme a frequência agendada ou ao tocar no botão 'Varrer Agora'.",
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
          "Não será possível receber as notificações dos alertas. Certifique-se de habilitar as notificações nas configurações do seu celular.",
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
        return Alert.alert("Campos Obrigatórios", "Informe o termo do anúncio (ex: iPhone 15, S24 Ultra, Cadeiras Coral).");
      }
    }

    if (estrategia === 'por_preco' && modo !== 'noticia') {
      if (!precoAlvo.trim() || alvoNum <= 0) {
        return Alert.alert("Preço Alvo Obrigatório", "Na estratégia 'Rastrear pelo Preço', digite o valor alvo desejado (em R$).");
      }
    }

    // Se o usuário desativou as notificações nas Configurações ou o aparelho não possui token push ativo
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
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollArea}>
        
        {/* Banner de Edição */}
        {editando && (
          <View style={styles.editNoticeBanner}>
            <Ionicons name="create" size={16} color={THEME.secondary} style={{ marginRight: 8 }} />
            <Text style={styles.editNoticeText}>Modo de Edição do Radar Ativo</Text>
          </View>
        )}

        {/* 1. SELEÇÃO DA PLATAFORMA DE PESQUISA */}
        <Text style={styles.formSectionTitle}>ESCOLHA A PLATAFORMA DE PESQUISA</Text>
        <View style={styles.platformChipRow}>
          {[
            { key: 'OLX', nome: 'OLX', icon: 'cart-outline' },
            { key: 'ZOOM', nome: 'ZOOM', icon: 'search-outline' },
            { key: 'BUSCAPE', nome: 'Buscapé', icon: 'pricetag-outline' },
            { key: 'OUTROS', nome: 'Outros Sites', icon: 'globe-outline' }
          ].map(p => {
            const isActive = plataforma === p.key;
            return (
              <TouchableOpacity 
                key={p.key}
                style={[styles.platformChip, isActive && styles.platformChipActive]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setPlataforma(p.key);
                  if (p.key === 'ZOOM' || p.key === 'BUSCAPE') {
                    if (estrategia === 'mais_recentes') {
                      setEstrategia('menor_preco');
                    }
                  }
                  if (p.key !== 'OUTROS') setModo('produto');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name={p.icon} size={20} color={isActive ? THEME.primary : THEME.textMuted} />
                <Text style={[styles.platformChipText, isActive && styles.platformChipTextActive]}>
                  {p.nome}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Banners Explicativos de Plataforma */}
        {(plataforma === 'ZOOM' || plataforma === 'BUSCAPE') && (
          <View style={styles.comparatorBanner}>
            <Ionicons name="information-circle-outline" size={18} color={THEME.primary} style={{ marginRight: 8 }} />
            <Text style={styles.comparatorBannerText}>
              {plataforma === 'ZOOM' 
                ? "O Zoom compara preços em grandes lojas (Magazine Luiza, Amazon, Casas Bahia, etc.) em todo o Brasil e extrai o link direto para a compra."
                : "O Buscapé compara ofertas no comércio eletrônico nacional com redirecionamento direto para a loja parceira."}
            </Text>
          </View>
        )}

        {/* 2. LOCALIZAÇÃO DO ANÚNCIO (OLX) */}
        {plataforma === 'OLX' && (
          <>
            <Text style={[styles.formSectionTitle, { marginTop: 15 }]}>LOCALIZAÇÃO DO ANÚNCIO (OLX)</Text>
            <Card style={styles.formCard}>
              <View style={styles.row}>
                {/* ESTADO */}
                <TouchableOpacity 
                  style={[styles.selectBtn, { marginRight: 8 }]} 
                  onPress={() => setModalEstadoVisivel(true)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectBtnLabel}>ESTADO (UF)</Text>
                    <Text style={styles.selectBtnValue} numberOfLines={1}>
                      {OLX_ESTADOS[estadoUf]?.nome} ({estadoUf})
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={THEME.primary} />
                </TouchableOpacity>

                {/* REGIÃO */}
                <TouchableOpacity 
                  style={styles.selectBtn} 
                  onPress={() => setModalRegiaoVisivel(true)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectBtnLabel}>REGIÃO</Text>
                    <Text style={styles.selectBtnValue} numberOfLines={1}>
                      {regiaoAtual.nome}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={THEME.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.urlPreviewBox}>
                <Ionicons name="link-outline" size={14} color={THEME.success} style={{ marginRight: 6 }} />
                <Text style={styles.urlPreviewText} numberOfLines={1}>
                  {gerarUrlOlx(estadoUf, regiaoSlug, produto)}
                </Text>
              </View>
            </Card>
          </>
        )}

        {/* SE FOR OUTROS SITES: SELETOR DE MODO E URL MANUAL */}
        {plataforma === 'OUTROS' && (
          <>
            <View style={[styles.segmentWrap, { marginTop: 10 }]}>
              <TouchableOpacity 
                style={[styles.segmentOption, modo === 'produto' && styles.segmentOptionActive]}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setModo('produto'); }}
              >
                <Ionicons name="cart" size={18} color={modo === 'produto' ? '#000' : THEME.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.segmentLabel, modo === 'produto' && { color: '#000', fontWeight: 'bold' }]}>Página de Anúncio</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.segmentOption, modo === 'noticia' && styles.segmentOptionActive]}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setModo('noticia'); }}
              >
                <Ionicons name="newspaper" size={18} color={modo === 'noticia' ? '#000' : THEME.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.segmentLabel, modo === 'noticia' && { color: '#000', fontWeight: 'bold' }]}>Sites de Notícias)</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.formSectionTitle, { marginTop: 10 }]}>URL DO SITE OU PÁGINA</Text>
            <Card style={styles.formCard}>
              <Text style={styles.inputTitle}>ENDEREÇO DA PÁGINA (HTTPS://...)</Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="Ex: https://g1.globo.com/ ou URL customizada" 
                placeholderTextColor={THEME.textSubtle} 
                value={urls} 
                onChangeText={setUrls}
                autoCapitalize="none"
              />
            </Card>
          </>
        )}

        {/* 3. IDENTIFICAÇÃO DO RADAR */}
        <Text style={[styles.formSectionTitle, { marginTop: 15 }]}>IDENTIFICAÇÃO DO RADAR</Text>
        <Card style={styles.formCard}>
          <Text style={styles.inputTitle}>NOME DO RADAR</Text>
          <TextInput 
            style={styles.inputField} 
            placeholder="Ex: Anuncio de Iphone" 
            placeholderTextColor={THEME.textSubtle} 
            value={nome} 
            onChangeText={setNome} 
          />

          {modo !== 'noticia' ? (
            <>
              <Text style={[styles.inputTitle, { marginTop: 15 }]}>
                PALAVRAS PARA USAR NA PESQUISA
              </Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="Ex: iphone 15 256gb" 
                placeholderTextColor={THEME.textSubtle} 
                value={produto} 
                onChangeText={setProduto} 
              />
              <Text style={styles.helperText}>
                {plataforma === 'OLX'
                  ? "O robô busca este termo na OLX da região escolhida e valida os anúncios encontrados."
                  : plataforma === 'ZOOM' || plataforma === 'BUSCAPE'
                  ? "O comparador buscará este produto em lojas parceiras de todo o Brasil."
                  : "O robô buscará este termo nos anúncios da página cadastrada."}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.inputTitle, { marginTop: 15 }]}>PALAVRAS-CHAVE DA NOTÍCIA</Text>
              <TextInput 
                style={styles.inputField} 
                placeholder="concurso, edital, vaga (separadas por vírgula)" 
                placeholderTextColor={THEME.textSubtle} 
                value={palavras} 
                onChangeText={setPalavras} 
              />
              <Text style={styles.helperText}>Dispara se todas as palavras forem encontradas juntas no texto da matéria.</Text>
            </>
          )}
        </Card>

        {/* 4. FILTROS E ESTRATÉGIA DE CAPTURA (MODO PRODUTO) */}
        {modo !== 'noticia' && (
          <>
            <Text style={[styles.formSectionTitle, { marginTop: 20 }]}>ESTRATÉGIA DE CAPTURA</Text>
            
            {/* CARD 1: MENOR VALOR */}
            <TouchableOpacity 
              style={[styles.strategyCard, estrategia === 'menor_preco' && styles.strategyCardActive]}
              onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setEstrategia('menor_preco'); }}
              activeOpacity={0.8}
            >
              <View style={styles.strategyHeader}>
                <View style={[styles.strategyIconWrap, estrategia === 'menor_preco' && styles.strategyIconWrapActive]}>
                  <Ionicons name="trending-down-outline" size={18} color={estrategia === 'menor_preco' ? THEME.primary : THEME.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.strategyTitle, estrategia === 'menor_preco' && styles.strategyTitleActive]}>
                    Rastrear o Menor Valor Disponível
                  </Text>
                  <Text style={styles.strategyDesc}>
                    Captura exclusivamente a oferta de menor preço dentre todos os resultados encontrados.
                  </Text>
                </View>
                <Ionicons 
                  name={estrategia === 'menor_preco' ? "radio-button-on" : "radio-button-off"} 
                  size={20} 
                  color={estrategia === 'menor_preco' ? THEME.primary : THEME.textSubtle} 
                />
              </View>
            </TouchableOpacity>

            {/* CARD 2: MAIS RECENTES COM OPÇÃO DE ORDENAR (Disponível apenas em OLX e Outros Sites) */}
            {!(plataforma === 'ZOOM' || plataforma === 'BUSCAPE') && (
              <TouchableOpacity 
                style={[styles.strategyCard, estrategia === 'mais_recentes' && styles.strategyCardActive]}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setEstrategia('mais_recentes'); }}
                activeOpacity={0.8}
              >
                <View style={styles.strategyHeader}>
                  <View style={[styles.strategyIconWrap, estrategia === 'mais_recentes' && styles.strategyIconWrapActive]}>
                    <Ionicons name="time-outline" size={18} color={estrategia === 'mais_recentes' ? THEME.primary : THEME.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.strategyTitle, estrategia === 'mais_recentes' && styles.strategyTitleActive]}>
                      Rastrear Todos os Anúncios Mais Recentes
                    </Text>
                    <Text style={styles.strategyDesc}>
                      Retorna todos os anúncios compatíveis recém-publicados.
                    </Text>
                  </View>
                  <Ionicons 
                    name={estrategia === 'mais_recentes' ? "radio-button-on" : "radio-button-off"} 
                    size={20} 
                    color={estrategia === 'mais_recentes' ? THEME.primary : THEME.textSubtle} 
                  />
                </View>

                {estrategia === 'mais_recentes' && (
                  <View style={styles.strategyExtra}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.sortToggleText}>Ordenar do Menor para o Maior Valor</Text>
                        <Text style={styles.sortToggleSub}>Receba as notificações priorizando as opções mais em conta</Text>
                      </View>
                      <Switch 
                        value={ordenarMenorPreco}
                        onValueChange={setOrdenarMenorPreco}
                        trackColor={{ false: '#2C3040', true: THEME.primary }}
                        thumbColor="#FFF"
                      />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* CARD 3: POR PREÇO ALVO */}
            <TouchableOpacity 
              style={[styles.strategyCard, estrategia === 'por_preco' && styles.strategyCardActive]}
              onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setEstrategia('por_preco'); }}
              activeOpacity={0.8}
            >
              <View style={styles.strategyHeader}>
                <View style={[styles.strategyIconWrap, estrategia === 'por_preco' && styles.strategyIconWrapActive]}>
                  <Ionicons name="pricetag-outline" size={18} color={estrategia === 'por_preco' ? THEME.primary : THEME.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.strategyTitle, estrategia === 'por_preco' && styles.strategyTitleActive]}>
                    Rastrear Anúncio pelo Preço (Alvo)
                  </Text>
                  <Text style={styles.strategyDesc}>
                    Filtra anúncios dentro de uma margem em torno do seu orçamento desejado.
                  </Text>
                </View>
                <Ionicons 
                  name={estrategia === 'por_preco' ? "radio-button-on" : "radio-button-off"} 
                  size={20} 
                  color={estrategia === 'por_preco' ? THEME.primary : THEME.textSubtle} 
                />
              </View>

              {estrategia === 'por_preco' && (
                <View style={styles.strategyExtra}>
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={styles.inputTitle}>PREÇO ALVO (R$) *</Text>
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
                    <View style={styles.previewBox}>
                      <Text style={styles.previewTitle}>🎯 FAIXA ACEITA PELO ROBÔ:</Text>
                      <Text style={styles.previewRange}>
                        R$ {minEstimado.toFixed(2)} até R$ {maxEstimado.toFixed(2)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.helperText, { color: THEME.warning, marginTop: 8 }]}>
                      ⚠️ Digite o valor alvo desejado para calcular a faixa aceita.
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* 5. FREQUÊNCIA DE VARREDURA */}
        <Text style={[styles.formSectionTitle, { marginTop: 20 }]}>FREQUÊNCIA DE VARREDURA</Text>
        <Card style={styles.formCard}>
          <Text style={styles.inputTitle}>INTERVALO ENTRE CONSULTAS (MINUTOS)</Text>
          <TextInput 
            style={styles.inputField} 
            placeholder="30" 
            placeholderTextColor={THEME.textSubtle} 
            keyboardType="numeric" 
            value={intervalo} 
            onChangeText={setIntervalo} 
          />
        </Card>

        {/* BOTÃO SALVAR / ATUALIZAR */}
        <View style={{ marginTop: 25 }}>
          <PrimaryButton 
            title={editando ? "Atualizar Radar" : "Salvar e Ativar Radar"} 
            onPress={salvar} 
            icon={editando ? "save-outline" : "rocket-outline"} 
            loading={salvando} 
          />
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* MODAL ESTADO */}
      <SelectionModal 
        visible={modalEstadoVisivel}
        title="Selecione o Estado (UF)"
        items={LISTA_ESTADOS}
        selectedId={estadoUf}
        onSelect={(item) => {
          setEstadoUf(item.uf);
          const regs = OLX_ESTADOS[item.uf]?.regioes || [];
          setRegiaoSlug(regs.length > 1 ? regs[1].slug : regs[0]?.slug || '');
        }}
        onClose={() => setModalEstadoVisivel(false)}
      />

      {/* MODAL REGIÃO */}
      <SelectionModal 
        visible={modalRegiaoVisivel}
        title={`Regiões de ${OLX_ESTADOS[estadoUf]?.nome}`}
        items={regioesDoEstado}
        selectedId={regiaoSlug}
        onSelect={(item) => setRegiaoSlug(item.slug)}
        onClose={() => setModalRegiaoVisivel(false)}
      />

      {/* MODAL DE AVISO DE NOTIFICAÇÕES DESATIVADAS */}
      <Modal visible={modalAvisoNotifVisivel} animationType="fade" transparent={true} onRequestClose={() => setModalAvisoNotifVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <View style={[styles.statIconBadge, { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 149, 0, 0.15)', marginBottom: 12 }]}>
                <Ionicons name="notifications-off-outline" size={30} color={THEME.primary} />
              </View>
              <Text style={[styles.modalTitle, { textAlign: 'center', fontSize: 18 }]}>Notificações Desativadas</Text>
              <Text style={{ fontSize: 13, color: THEME.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 19 }}>
                Este aparelho ainda não possui as notificações ativadas para o Radar Inteligente.
              </Text>
              <Text style={{ fontSize: 13, color: THEME.text, textAlign: 'center', marginTop: 8, lineHeight: 19, fontWeight: '500' }}>
                O robô fará as varreduras e salvará as oportunidades normalmente, mas você <Text style={{ color: THEME.warning, fontWeight: 'bold' }}>não receberá alertas sonoros ou na barra de status</Text> do celular quando um anúncio for encontrado.
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.btnPrimary, { marginTop: 15 }]}
              onPress={tentarAtivarNotificacoes}
              disabled={ativandoNotif}
              activeOpacity={0.8}
            >
              {ativandoNotif ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="notifications" size={18} color="#000" style={{ marginRight: 6 }} />
                  <Text style={styles.btnPrimaryText}>Ativar Notificações no Aparelho</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btnAction, { marginTop: 10, justifyContent: 'center', paddingVertical: 12 }]}
              onPress={() => {
                setModalAvisoNotifVisivel(false);
                executarSalvamento();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnActionText, { color: THEME.textMuted }]}>Salvar Mesmo Assim (Sem Avisos Push)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ marginTop: 12, alignItems: 'center', paddingVertical: 6 }}
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

// --- TELA 5: CONFIGURAÇÕES & DIAGNÓSTICO ---
function SettingsScreen() {
  const { 
    pushToken, deviceId, user, fetchData, linkAccount, logoutUser,
    notificacoesAtivas, alternarNotificacoes 
  } = useContext(RadarContext);

  const [authTab, setAuthTab] = useState('login'); // 'login' | 'cadastro'
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
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>Configurações</Text>
          <Text style={styles.headerSubtitle}>Identidade, Nuvem e Servidor</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollArea}>
        
        {/* SEÇÃO 1: CONTA & IDENTIFICAÇÃO DO USUÁRIO */}
        <Text style={styles.formSectionTitle}>IDENTIDADE DO USUÁRIO</Text>
        
        {user ? (
          /* CONTA CONECTADA */
          <Card style={styles.authCard}>
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <View style={styles.userAvatarBadge}>
                  <Ionicons name="person" size={20} color={THEME.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.userEmailText} numberOfLines={1}>{user.email}</Text>
                  <Text style={styles.userProviderSub}>
                    {user.app_metadata?.provider === 'google' ? 'Conectado via Google' : 'Conectado via Email/Senha'}
                  </Text>
                </View>
              </View>
              <View style={styles.badgeSuccess}>
                <Text style={styles.badgeSuccessText}>CONECTADO</Text>
              </View>
            </View>

            <View style={styles.divider} />
            <Text style={styles.authSyncDesc}>
              Seus radares e alertas estão salvos e sincronizados com a sua conta. Qualquer outro aparelho conectado com este email terá acesso instantâneo às mesmas configurações.
            </Text>

            <TouchableOpacity 
              style={[styles.btnLogout, { marginTop: 10 }]} 
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={16} color={THEME.danger} style={{ marginRight: 6 }} />
              <Text style={styles.btnLogoutText}>Desconectar Conta</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          /* MODO DISPOSITIVO + FORMULÁRIO DE LOGIN / CADASTRO */
          <Card style={styles.authCard}>
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 13, color: THEME.textMuted, lineHeight: 19 }}>
                Faça login ou crie sua conta para sincronizar seus radares e alertas entre vários dispositivos. Se preferir continuar sem conta, seus dados ficam salvos de forma segura e privada neste aparelho.
              </Text>
            </View>

            {/* BOTÃO GOOGLE SIGN-IN */}
            <TouchableOpacity 
              style={styles.btnGoogle} 
              onPress={handleLoginGoogle}
              activeOpacity={0.8}
              disabled={authLoading}
            >
              <Ionicons name="logo-google" size={18} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.btnGoogleText}>Continuar com o Google</Text>
            </TouchableOpacity>

            <View style={styles.authOrRow}>
              <View style={styles.authOrLine} />
              <Text style={styles.authOrText}>ou com email e senha</Text>
              <View style={styles.authOrLine} />
            </View>

            {/* ABAS: ENTRAR / CRIAR CONTA */}
            <View style={styles.authTabWrap}>
              <TouchableOpacity 
                style={[styles.authTabBtn, authTab === 'login' && styles.authTabBtnActive]}
                onPress={() => setAuthTab('login')}
              >
                <Text style={[styles.authTabBtnText, authTab === 'login' && styles.authTabBtnTextActive]}>
                  Entrar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.authTabBtn, authTab === 'cadastro' && styles.authTabBtnActive]}
                onPress={() => setAuthTab('cadastro')}
              >
                <Text style={[styles.authTabBtnText, authTab === 'cadastro' && styles.authTabBtnTextActive]}>
                  Criar Conta
                </Text>
              </TouchableOpacity>
            </View>

            {/* FORMULÁRIO ENTRAR */}
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
                  <Text style={styles.forgotPasswordText}>Esqueceu sua senha?</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.btnAuthSubmit, { marginTop: 15 }]} 
                  onPress={handleLoginEmail}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.btnAuthSubmitText}>Entrar na Conta</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* FORMULÁRIO CRIAR CONTA */
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

                <Text style={[styles.inputTitle, { marginTop: 10 }]}>CRIAR UMA SENHA</Text>
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

                <TouchableOpacity 
                  style={[styles.btnAuthSubmit, { marginTop: 15 }]} 
                  onPress={handleSignupEmail}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.btnAuthSubmitText}>Cadastrar e Vincular Aparelho</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}

        {/* SEÇÃO 2: SERVIDOR DO ROBÔ */}
        <Text style={[styles.formSectionTitle, { marginTop: 20 }]}>SERVIDOR DO ROBÔ</Text>
        <Card style={styles.configCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.configTitle}>Servidor do Robô</Text>
              <Text style={styles.configSub}>Online e Operante</Text>
            </View>
            <View style={styles.badgeSuccess}>
              <Text style={styles.badgeSuccessText}>ONLINE</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.configItem}>• Responsável pelo processamento e varredura periódica de anúncios e ofertas em tempo real.</Text>
        </Card>

        {/* SEÇÃO 3: NOTIFICAÇÕES DO DISPOSITIVO */}
        <Text style={[styles.formSectionTitle, { marginTop: 20 }]}>NOTIFICAÇÕES DO DISPOSITIVO</Text>
        <Card style={styles.configCard}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.configTitle}>Ativar as Notificações do App</Text>
              <Text style={styles.helperText}>
                Notificar na barra de status sempre que um novo anúncio ou oportunidade for capturado.
              </Text>
            </View>
            <Switch 
              value={notificacoesAtivas}
              onValueChange={alternarNotificacoes}
              trackColor={{ false: '#2C3040', true: THEME.primary }}
              thumbColor="#FFF"
            />
          </View>

          {checkIsExpoGo() && (
            <View style={[styles.infoBanner, { marginTop: 12 }]}>
              <Ionicons name="information-circle-outline" size={16} color={THEME.warning} style={{ marginRight: 6 }} />
              <Text style={styles.infoBannerText}>
                Em ambiente Expo Go, notificações push em segundo plano possuem limitações no Android 13+. No APK compilado, funcionam integralmente.
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.btnAction, { marginTop: 15, alignSelf: 'flex-start', paddingHorizontal: 15 }]} 
            onPress={dispararTesteLocal}
          >
            <Ionicons name="notifications-outline" size={16} color={THEME.primary} style={{ marginRight: 6 }} />
            <Text style={styles.btnActionText}>Testar Notificação Local</Text>
          </TouchableOpacity>
        </Card>

        {/* SEÇÃO 4: SOBRE O APLICATIVO */}
        <Text style={[styles.formSectionTitle, { marginTop: 20 }]}>SOBRE O APLICATIVO</Text>
        <Card style={styles.configCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.configTitle, { fontSize: 18, fontWeight: 'bold' }]}>AchôAI</Text>
              <Text style={[styles.helperText, { marginTop: 2 }]}>Monitoramento de anúncios e notícias relevantes</Text>
            </View>
            <View style={[styles.badgeSuccess, { backgroundColor: THEME.primaryGlow }]}>
              <Text style={[styles.badgeSuccessText, { color: THEME.primary, fontWeight: 'bold' }]}>PRODUÇÃO</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.rowBetween}>
            <Text style={{ color: THEME.textMuted, fontSize: 13 }}>Versão Oficial</Text>
            <Text style={{ color: THEME.text, fontWeight: 'bold', fontSize: 13 }}>1.0.0 (Play Store)</Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: 8 }]}>
            <Text style={{ color: THEME.textMuted, fontSize: 13 }}>Plataformas Integradas</Text>
            <Text style={{ color: THEME.text, fontSize: 13 }}>OLX, Zoom, Buscapé & Web</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.aboutFooterText}>
            AchôAI © 2026. Todos os direitos reservados.
          </Text>
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* MODAL DE RECUPERAÇÃO DE SENHA */}
      <Modal visible={modalRecuperacaoVisivel} animationType="fade" transparent={true} onRequestClose={() => setModalRecuperacaoVisivel(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recuperar Senha</Text>
              <TouchableOpacity onPress={() => setModalRecuperacaoVisivel(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={THEME.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.authSyncDesc}>
              Informe seu email cadastrado para enviarmos um link de redefinição de senha com segurança.
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

            <TouchableOpacity 
              style={[styles.btnAuthSubmit, { marginTop: 16 }]} 
              onPress={handleResetPassword}
              disabled={recuperandoSenha}
            >
              {recuperandoSenha ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.btnAuthSubmitText}>Enviar Link de Recuperação</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =====================================================================
// 6. NAVEGAÇÃO E ROTAS
// =====================================================================
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: THEME.cardBg,
          borderTopColor: THEME.cardBorder,
          borderTopWidth: 1,
          elevation: 8,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: THEME.textSubtle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Radares') iconName = focused ? 'radio' : 'radio-outline';
          else if (route.name === 'Alertas') iconName = focused ? 'notifications' : 'notifications-outline';
          else if (route.name === 'Config') iconName = focused ? 'settings' : 'settings-outline';
          return <Ionicons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Radares" component={MonitorListScreen} />
      <Tab.Screen name="Alertas" component={AlertsScreen} />
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
    <RadarProvider>
      <NavigationContainer theme={customTheme}>
        <Stack.Navigator screenOptions={{ 
          headerStyle: { backgroundColor: THEME.cardBg }, 
          headerTintColor: THEME.primary,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: 'bold' }
        }}>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen 
            name="Criar" 
            component={CreateMonitorScreen} 
            options={{ 
              title: 'Novo Radar de Varredura',
              presentation: 'modal',
              animation: 'slide_from_bottom' 
            }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </RadarProvider>
  );
}

// =====================================================================
// 7. ESTILOS OTIMIZADOS
// =====================================================================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  scrollArea: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 60 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  topHeader: { 
    paddingTop: Platform.OS === 'android' ? 45 : 55, 
    paddingHorizontal: 16, 
    paddingBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.cardBorder
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: THEME.text },
  headerSubtitle: { fontSize: 13, color: THEME.textMuted, marginTop: 2 },
  headerBtn: { 
    width: 40, height: 40, borderRadius: 20, 
    backgroundColor: THEME.badgeBg, 
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: THEME.cardBorder
  },

  serverPill: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: THEME.badgeBg, 
    paddingHorizontal: 8, paddingVertical: 3, 
    borderRadius: 12, marginTop: 4, alignSelf: 'flex-start' 
  },
  serverDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: THEME.success, marginRight: 6 },
  serverText: { fontSize: 11, color: THEME.textMuted, fontWeight: '600' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 15 },
  statBox: { flex: 1, marginHorizontal: 4, padding: 12, alignItems: 'center' },
  statIconBadge: { 
    width: 36, height: 36, borderRadius: 18, 
    backgroundColor: THEME.primaryGlow, 
    justifyContent: 'center', alignItems: 'center', marginBottom: 8 
  },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: THEME.text },
  statLabel: { fontSize: 11, color: THEME.textMuted, marginTop: 2, textAlign: 'center' },

  card: { 
    backgroundColor: THEME.cardBg, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: THEME.cardBorder, 
    padding: 16,
    marginBottom: 12
  },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 10 },
  sectionTitle: { fontSize: 12, color: THEME.textMuted, fontWeight: 'bold', letterSpacing: 1 },
  sectionLink: { fontSize: 12, color: THEME.primary, fontWeight: 'bold' },

  resultCard: { padding: 14 },
  resultTitle: { fontSize: 15, fontWeight: '600', color: THEME.text },
  resultDate: { fontSize: 11, color: THEME.textMuted, marginTop: 4 },
  priceBadge: { backgroundColor: THEME.successBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  priceText: { color: THEME.success, fontWeight: 'bold', fontSize: 14 },
  openBtn: { 
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', 
    marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: THEME.cardBorder, width: '100%' 
  },
  openBtnText: { color: THEME.primary, fontSize: 12, fontWeight: 'bold' },

  logCard: { padding: 12 },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.cardBorder },
  logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, marginRight: 10 },
  logMessage: { fontSize: 13, color: THEME.text, lineHeight: 18 },
  logTime: { fontSize: 10, color: THEME.textMuted, marginTop: 2 },

  radarCard: { padding: 16 },
  radarCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  radarTitleGroup: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  switchWrapper: { paddingRight: 4, justifyContent: 'center', alignItems: 'flex-end' },
  platformBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 6 },
  platformBadgeText: { fontSize: 10, fontWeight: 'bold' },
  strategyBadgeText: { fontSize: 11, color: THEME.textMuted, flexShrink: 1 },
  modeBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  radarTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.text, flex: 1 },
  radarBody: { marginVertical: 12, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: THEME.cardBorder },
  radarParam: { fontSize: 13, color: THEME.textMuted, marginBottom: 4 },
  radarParamSub: { fontSize: 12, color: THEME.primary, fontWeight: '500', marginBottom: 4 },
  radarUrl: { fontSize: 11, color: THEME.textSubtle, marginTop: 4 },
  radarFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  radarMeta: { fontSize: 12, color: THEME.textMuted, fontWeight: '500' },
  btnAction: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: THEME.badgeBg, 
    borderWidth: 1, borderColor: THEME.cardBorder, 
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 
  },
  btnActionText: { color: THEME.primary, fontSize: 12, fontWeight: 'bold', marginLeft: 4 },

  fab: { 
    position: 'absolute', bottom: 20, right: 20, 
    width: 58, height: 58, borderRadius: 29, 
    backgroundColor: THEME.primary, 
    justifyContent: 'center', alignItems: 'center', 
    elevation: 8, shadowColor: THEME.primary, shadowOpacity: 0.4, shadowRadius: 6 
  },

  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyStateTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.text, marginTop: 15, marginBottom: 8 },
  emptyStateSub: { fontSize: 14, color: THEME.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyCard: { alignItems: 'center', padding: 25 },
  emptyCardText: { fontSize: 15, fontWeight: '600', color: THEME.textMuted, marginTop: 8 },
  emptyCardSub: { fontSize: 12, color: THEME.textSubtle, textAlign: 'center', marginTop: 4 },

  resultCardFull: { padding: 16, marginBottom: 12 },
  resultTag: { fontSize: 11, color: THEME.success, fontWeight: '600' },
  resultTimeAgo: { fontSize: 11, color: THEME.textMuted },
  resultTitleFull: { fontSize: 17, fontWeight: 'bold', color: THEME.text, marginVertical: 10, lineHeight: 22 },
  priceRow: { 
    backgroundColor: THEME.badgeBg, padding: 12, borderRadius: 10, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 
  },
  priceLabel: { fontSize: 11, color: THEME.textMuted, fontWeight: 'bold' },
  priceValue: { fontSize: 18, fontWeight: 'bold', color: THEME.success },
  btnOpenFull: { 
    backgroundColor: THEME.primary, flexDirection: 'row', 
    justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 10, marginTop: 10 
  },
  btnOpenFullText: { color: '#000', fontWeight: 'bold', fontSize: 14 },

  segmentWrap: { flexDirection: 'row', backgroundColor: THEME.cardBg, borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: THEME.cardBorder },
  segmentOption: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 8 },
  segmentOptionActive: { backgroundColor: THEME.primary },
  segmentLabel: { fontSize: 14, color: THEME.textMuted, fontWeight: '600' },

  formSectionTitle: { fontSize: 11, color: THEME.textMuted, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
  formCard: { padding: 16 },
  inputTitle: { fontSize: 11, color: THEME.textMuted, fontWeight: 'bold', marginBottom: 6 },
  inputField: { 
    backgroundColor: THEME.badgeBg, color: THEME.text, 
    fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: THEME.cardBorder
  },
  helperText: { fontSize: 11, color: THEME.textSubtle, marginTop: 6, fontStyle: 'italic' },
  previewBox: { backgroundColor: 'rgba(48, 209, 88, 0.1)', padding: 12, borderRadius: 10, marginTop: 15, borderWidth: 1, borderColor: 'rgba(48, 209, 88, 0.25)' },
  previewTitle: { fontSize: 11, color: THEME.success, fontWeight: 'bold' },
  previewRange: { fontSize: 16, color: THEME.text, fontWeight: 'bold', marginTop: 4 },

  btnPrimary: { 
    backgroundColor: THEME.primary, paddingVertical: 15, borderRadius: 12, 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    elevation: 4, shadowColor: THEME.primary, shadowOpacity: 0.3, shadowRadius: 6
  },
  btnPrimaryText: { color: '#000', fontSize: 15, fontWeight: 'bold' },

  configCard: { padding: 16 },
  configTitle: { fontSize: 15, fontWeight: 'bold', color: THEME.text },
  configSub: { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
  badgeSuccess: { backgroundColor: THEME.successBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeSuccessText: { color: THEME.success, fontSize: 11, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: THEME.cardBorder, marginVertical: 12 },
  configItem: { fontSize: 13, color: THEME.textMuted, marginBottom: 6 },
  tokenBox: { 
    backgroundColor: THEME.badgeBg, padding: 10, borderRadius: 8, 
    color: THEME.primary, fontSize: 11, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginVertical: 8, borderWidth: 1, borderColor: THEME.cardBorder
  },

  // Estilos de Edição
  editNoticeBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(10, 132, 255, 0.12)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 15,
    borderWidth: 1, borderColor: 'rgba(10, 132, 255, 0.3)'
  },
  editNoticeText: { color: THEME.secondary, fontSize: 13, fontWeight: 'bold' },

  // Estilos de Plataformas
  platformChipRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  platformChip: { 
    flex: 1, marginHorizontal: 3, paddingVertical: 10, paddingHorizontal: 4, 
    borderRadius: 10, borderWidth: 1, borderColor: THEME.cardBorder, 
    backgroundColor: THEME.badgeBg, alignItems: 'center', justifyContent: 'center' 
  },
  platformChipActive: { backgroundColor: THEME.primaryGlow, borderColor: THEME.primary },
  platformChipText: { fontSize: 11, fontWeight: 'bold', color: THEME.textMuted, marginTop: 4, textAlign: 'center' },
  platformChipTextActive: { color: THEME.primary },

  // Banner comparador
  comparatorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: THEME.badgeBg,
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: THEME.cardBorder, marginBottom: 15
  },
  comparatorBannerText: { flex: 1, fontSize: 12, color: THEME.textMuted, lineHeight: 17 },

  // Seletores Estado / Região
  selectBtn: { 
    flex: 1, backgroundColor: THEME.badgeBg, borderRadius: 10, 
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, 
    borderColor: THEME.cardBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' 
  },
  selectBtnLabel: { fontSize: 10, color: THEME.textSubtle, fontWeight: 'bold' },
  selectBtnValue: { fontSize: 13, color: THEME.text, fontWeight: '600', marginTop: 2 },
  urlPreviewBox: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(48, 209, 88, 0.08)', 
    padding: 10, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: 'rgba(48, 209, 88, 0.2)' 
  },
  urlPreviewText: { flex: 1, fontSize: 11, color: THEME.success, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' },

  // Estilos de Estratégia de Captura
  strategyCard: { 
    borderRadius: 12, borderWidth: 1, borderColor: THEME.cardBorder, 
    backgroundColor: THEME.cardBg, padding: 14, marginBottom: 10 
  },
  strategyCardActive: { borderColor: THEME.primary, backgroundColor: 'rgba(255, 149, 0, 0.06)' },
  strategyHeader: { flexDirection: 'row', alignItems: 'center' },
  strategyIconWrap: { 
    width: 32, height: 32, borderRadius: 16, 
    backgroundColor: THEME.badgeBg, justifyContent: 'center', alignItems: 'center', marginRight: 10 
  },
  strategyIconWrapActive: { backgroundColor: THEME.primaryGlow },
  strategyTitle: { fontSize: 14, fontWeight: 'bold', color: THEME.textMuted },
  strategyTitleActive: { color: THEME.primary },
  strategyDesc: { fontSize: 11, color: THEME.textSubtle, marginTop: 3 },
  strategyExtra: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.cardBorder },
  sortToggleText: { fontSize: 13, fontWeight: '600', color: THEME.text },
  sortToggleSub: { fontSize: 11, color: THEME.textSubtle, marginTop: 2 },

  // Estilos do Modal de Seleção
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { 
    backgroundColor: THEME.cardBg, borderRadius: 16, width: '100%', maxWidth: 400, 
    borderWidth: 1, borderColor: THEME.cardBorder, padding: 18 
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.text },
  modalCloseBtn: { padding: 4 },
  modalSearchBox: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.badgeBg, 
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10, 
    borderWidth: 1, borderColor: THEME.cardBorder 
  },
  modalSearchInput: { flex: 1, color: THEME.text, fontSize: 13, padding: 0 },
  modalItem: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: THEME.cardBorder 
  },
  modalItemSelected: { backgroundColor: THEME.badgeBg, borderRadius: 8 },
  modalItemText: { fontSize: 14, color: THEME.textMuted },
  modalItemTextSelected: { color: THEME.primary, fontWeight: 'bold' },

  // Estilos de Autenticação e Gestão de Contas
  authCard: {
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  userAvatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: THEME.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)'
  },
  userEmailText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: THEME.text
  },
  userProviderSub: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2
  },
  authSyncDesc: {
    fontSize: 13,
    color: THEME.textMuted,
    lineHeight: 18,
    marginBottom: 10
  },
  deviceMetaText: {
    fontSize: 12,
    color: THEME.textSubtle,
    marginTop: 4
  },
  btnLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.dangerBg,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)'
  },
  btnLogoutText: {
    color: THEME.danger,
    fontSize: 13,
    fontWeight: 'bold'
  },
  deviceModeBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  deviceModeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME.text
  },
  deviceTagText: {
    fontSize: 11,
    color: THEME.textSubtle,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    backgroundColor: THEME.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  deviceModeSub: {
    fontSize: 12,
    color: THEME.textMuted,
    lineHeight: 17,
    marginBottom: 16
  },
  btnGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4
  },
  btnGoogleText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold'
  },
  authOrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10
  },
  authOrLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.cardBorder
  },
  authOrText: {
    fontSize: 11,
    color: THEME.textSubtle,
    paddingHorizontal: 10,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  authTabWrap: {
    flexDirection: 'row',
    backgroundColor: THEME.badgeBg,
    borderRadius: 10,
    padding: 3,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  authTabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8
  },
  authTabBtnActive: {
    backgroundColor: THEME.cardBg,
    borderWidth: 1,
    borderColor: THEME.primary
  },
  authTabBtnText: {
    fontSize: 13,
    color: THEME.textMuted,
    fontWeight: '600'
  },
  authTabBtnTextActive: {
    color: THEME.primary,
    fontWeight: 'bold'
  },
  forgotPasswordText: {
    fontSize: 12,
    color: THEME.primary,
    fontWeight: '600'
  },
  btnAuthSubmit: {
    backgroundColor: THEME.primary,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: THEME.primary,
    shadowOpacity: 0.25,
    shadowRadius: 5
  },
  btnAuthSubmitText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold'
  },

  // Estilos do Botão Varrer e Ações do Card
  btnVarrer: {
    backgroundColor: THEME.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    elevation: 3,
    shadowColor: THEME.primary,
    shadowOpacity: 0.35,
    shadowRadius: 5
  },
  btnVarrerText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold'
  },
  btnVarrerCompact: {
    backgroundColor: THEME.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    elevation: 2,
    shadowColor: THEME.primary,
    shadowOpacity: 0.25,
    shadowRadius: 3
  },
  btnVarrerCompactText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold'
  },
  btnIconAction: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: THEME.badgeBg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    justifyContent: 'center',
    alignItems: 'center'
  },
  radarFooterHarmonious: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.cardBorder
  },
  radarFrequencyText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.text
  },
  radarCountdownText: {
    fontSize: 11,
    color: THEME.primary,
    fontWeight: '600'
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 214, 10, 0.1)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.25)'
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    color: THEME.warning,
    lineHeight: 16
  },
  aboutFooterText: {
    fontSize: 12,
    color: THEME.textSubtle,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18
  }
});