import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Switch,
  RefreshControl,
  Dimensions,
  Platform,
  StatusBar,
  Vibration,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabase';
import { THEME } from './theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_SIZE = 50;

/**
 * Formata timestamp ISO para padrão brasileiro (Horário de Brasília: DD/MM/YYYY HH:mm:ss)
 */
function formatarDataBrasilia(dataIso) {
  if (!dataIso) return '-';
  try {
    const d = new Date(dataIso);
    if (isNaN(d.getTime())) return String(dataIso);
    // Formato pt-BR com fuso de Brasília
    const str = d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return str.replace(',', '');
  } catch (e) {
    return String(dataIso);
  }
}

/**
 * Retorna configurações de estilo (cores, ícone, rótulo) conforme o nível do log
 */
function getLevelConfig(level) {
  const lvl = String(level || 'INFO').toUpperCase();
  switch (lvl) {
    case 'SUCCESS':
      return {
        label: 'SUCCESS',
        color: '#16A34A',
        bg: '#DCFCE7',
        border: '#BBF7D0',
        icon: 'checkmark-circle',
      };
    case 'WARNING':
      return {
        label: 'WARNING',
        color: '#D97706',
        bg: '#FEF3C7',
        border: '#FDE68A',
        icon: 'warning',
      };
    case 'ERROR':
      return {
        label: 'ERROR',
        color: '#DC2626',
        bg: '#FEE2E2',
        border: '#FECACA',
        icon: 'alert-circle',
      };
    case 'INFO':
    default:
      return {
        label: 'INFO',
        color: '#0284C7',
        bg: '#E0F2FE',
        border: '#BAE6FD',
        icon: 'information-circle',
      };
  }
}

/**
 * Formata o rótulo amigável do emissor do log (usuario_id ou subsistema)
 */
function formatarSubsistema(usuarioId) {
  if (!usuarioId) return { label: 'Sistema Geral', icon: 'server-outline', color: '#64748B' };
  const uid = String(usuarioId).toLowerCase();
  if (uid.includes('shopee')) return { label: 'Shopee Vídeos', icon: 'videocam-outline', color: '#EE4D2D' };
  if (uid.includes('clips') || uid.includes('ml')) return { label: 'ML Clips', icon: 'play-circle-outline', color: '#EAB308' };
  if (uid.includes('updater') || uid.includes('video')) return { label: 'Atualizador Vídeos', icon: 'refresh-circle-outline', color: '#8B5CF6' };
  if (uid.includes('cupons')) return { label: 'Cupons de Desconto', icon: 'ticket-outline', color: '#EC4899' };
  if (uid.includes('promocoes')) return { label: 'Promoções Home', icon: 'flame-outline', color: '#FF5722' };
  if (uid.includes('recomendacoes')) return { label: 'Recomendações', icon: 'sparkles-outline', color: '#06B6D4' };
  if (uid.includes('busca')) return { label: 'Motor de Busca', icon: 'search-outline', color: '#3B82F6' };
  return { label: `Usuário ${usuarioId.slice(0, 8)}...`, icon: 'person-outline', color: '#475569' };
}

export function AdminLogsModal({ visible, onClose, isAdmin = false }) {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Filtros
  const [selectedLevel, setSelectedLevel] = useState('TODOS');
  const [searchText, setSearchText] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const flatListRef = useRef(null);
  const autoRefreshTimerRef = useRef(null);
  const offsetRef = useRef(0);

  // Busca inicial e reset ao abrir modal ou trocar filtro de nível
  const carregarLogsIniciais = useCallback(async (isRefresh = false) => {
    if (!isAdmin) return;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      let query = supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (selectedLevel !== 'TODOS') {
        query = query.eq('level', selectedLevel);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];
      setLogs(items);
      offsetRef.current = items.length;
      setHasMore(items.length >= PAGE_SIZE);
    } catch (err) {
      console.log('[AdminLogsModal] Erro ao carregar logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, selectedLevel]);

  // Paginação infinita ao rolar para o final
  const carregarMaisLogs = useCallback(async () => {
    if (!isAdmin || loading || loadingMore || !hasMore) return;
    setLoadingMore(true);

    const from = offsetRef.current;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (selectedLevel !== 'TODOS') {
        query = query.eq('level', selectedLevel);
      }

      const { data, error } = await query;
      if (error) throw error;

      const novosItens = data || [];
      if (novosItens.length > 0) {
        setLogs(prev => {
          const idsExistentes = new Set(prev.map(item => item.id));
          const unicos = novosItens.filter(item => !idsExistentes.has(item.id));
          return [...prev, ...unicos];
        });
        offsetRef.current = from + novosItens.length;
        setHasMore(novosItens.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.log('[AdminLogsModal] Erro na paginação de logs:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [isAdmin, loading, loadingMore, hasMore, selectedLevel]);

  // Polling em tempo real (Auto-refresh a cada 5s)
  useEffect(() => {
    if (!visible || !isAdmin || !autoRefresh) {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
      return;
    }

    autoRefreshTimerRef.current = setInterval(async () => {
      try {
        let query = supabase
          .from('logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (selectedLevel !== 'TODOS') {
          query = query.eq('level', selectedLevel);
        }

        const { data } = await query;
        if (data && data.length > 0) {
          setLogs(prev => {
            const idsExistentes = new Set(prev.map(i => i.id));
            const novos = data.filter(i => !idsExistentes.has(i.id));
            if (novos.length === 0) return prev;
            return [...novos, ...prev];
          });
        }
      } catch (e) {
        // Silêncio em background
      }
    }, 5000);

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [visible, isAdmin, autoRefresh, selectedLevel]);

  // Carrega ao abrir
  useEffect(() => {
    if (visible && isAdmin) {
      carregarLogsIniciais(false);
    } else {
      setLogs([]);
      setAutoRefresh(false);
    }
  }, [visible, isAdmin, carregarLogsIniciais]);

  // Filtro de busca textual na memória para resposta instantânea
  const logsFiltrados = useMemo(() => {
    if (!searchText || !searchText.trim()) return logs;
    const term = searchText.trim().toLowerCase();
    return logs.filter(l => {
      const msg = String(l.message || '').toLowerCase();
      const user = String(l.usuario_id || '').toLowerCase();
      const mon = String(l.monitor_id || '').toLowerCase();
      const lvl = String(l.level || '').toLowerCase();
      return msg.includes(term) || user.includes(term) || mon.includes(term) || lvl.includes(term);
    });
  }, [logs, searchText]);

  // Contadores por nível
  const estatisticas = useMemo(() => {
    let info = 0;
    let success = 0;
    let warning = 0;
    let error = 0;
    for (const l of logs) {
      const lvl = String(l.level || '').toUpperCase();
      if (lvl === 'SUCCESS') success++;
      else if (lvl === 'WARNING') warning++;
      else if (lvl === 'ERROR') error++;
      else info++;
    }
    return { info, success, warning, error, total: logs.length };
  }, [logs]);

  // Copiar log individual
  const handleCopiarLog = async (item) => {
    try {
      const texto = `[${item.level || 'INFO'}] ${formatarDataBrasilia(item.created_at)}\nEmissor: ${item.usuario_id || 'Sistema'}${item.monitor_id ? `\nMonitor: ${item.monitor_id}` : ''}\nMensagem: ${item.message || ''}`;
      await Clipboard.setStringAsync(texto);
      try { Vibration.vibrate(20); } catch (e) {}
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      // Fallback
    }
  };

  // Compartilhar / exportar texto dos logs filtrados
  const handleExportarLogs = async () => {
    try {
      const exportText = logsFiltrados.slice(0, 100).map(item => {
        return `[${item.level || 'INFO'}] [${formatarDataBrasilia(item.created_at)}] [${item.usuario_id || 'sistema'}] ${item.message}`;
      }).join('\n\n');

      await Share.share({
        title: 'Logs do Backend - AchôAI',
        message: exportText,
      });
    } catch (e) {
      // Ignorar cancelamento
    }
  };

  // Trava de segurança: somente renderiza se for admin
  if (!isAdmin || !visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

        {/* HEADER SUPERIOR ESCURO / TERMINAL PRO */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.terminalIconBadge}>
              <Ionicons name="terminal" size={18} color="#38BDF8" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.headerTitle}>Logs do Sistema</Text>
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>ADMIN</Text>
                </View>
              </View>
              <Text style={styles.headerSubtitle}>
                Observabilidade backend em tempo real
              </Text>
            </View>

            {/* Ações do Header */}
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={handleExportarLogs}
                activeOpacity={0.7}
                accessibilityLabel="Exportar logs"
              >
                <Ionicons name="share-outline" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={() => carregarLogsIniciais(true)}
                activeOpacity={0.7}
                disabled={loading || refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color="#38BDF8" />
                ) : (
                  <Ionicons name="refresh-outline" size={20} color="#94A3B8" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.headerActionBtn, { backgroundColor: '#1E293B', marginLeft: 4 }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#F8FAFC" />
              </TouchableOpacity>
            </View>
          </View>

          {/* BARRA DE ESTATÍSTICAS E AUTO-REFRESH */}
          <View style={styles.statsBar}>
            <View style={styles.statsGroup}>
              <View style={[styles.statChip, { backgroundColor: '#0369A1' }]}>
                <Text style={styles.statChipText}>{estatisticas.info} INFO</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: '#15803D' }]}>
                <Text style={styles.statChipText}>{estatisticas.success} SUCESSO</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: '#B45309' }]}>
                <Text style={styles.statChipText}>{estatisticas.warning} AVISOS</Text>
              </View>
              <View style={[styles.statChip, { backgroundColor: '#B91C1C' }]}>
                <Text style={styles.statChipText}>{estatisticas.error} ERROS</Text>
              </View>
            </View>

            {/* Toggle Auto-Refresh */}
            <View style={styles.autoRefreshBox}>
              <Text style={styles.autoRefreshText}>Ao Vivo (5s)</Text>
              <Switch
                value={autoRefresh}
                onValueChange={setAutoRefresh}
                trackColor={{ false: '#334155', true: '#0284C7' }}
                thumbColor={autoRefresh ? '#38BDF8' : '#94A3B8'}
                style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
              />
            </View>
          </View>

          {/* CAMPO DE BUSCA */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar em mensagens, módulos ou IDs..."
              placeholderTextColor="#64748B"
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchText ? (
              <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* CHIPS DE FILTRO POR NÍVEL */}
          <View style={styles.filterChipsRow}>
            {['TODOS', 'INFO', 'SUCCESS', 'WARNING', 'ERROR'].map(lvl => {
              const ativo = selectedLevel === lvl;
              return (
                <TouchableOpacity
                  key={lvl}
                  style={[styles.filterChip, ativo && styles.filterChipActive]}
                  onPress={() => setSelectedLevel(lvl)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipLabel, ativo && styles.filterChipLabelActive]}>
                    {lvl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CONTEÚDO PRINCIPAL (LISTA DE LOGS) */}
        {loading && !refreshing ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.loadingText}>Conectando ao banco e lendo histórico de logs...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={logsFiltrados}
            keyExtractor={item => item.id || String(Math.random())}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(insets.bottom + 40, 60) },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => carregarLogsIniciais(true)}
                tintColor="#38BDF8"
                colors={['#38BDF8', '#FF5722']}
              />
            }
            onEndReached={carregarMaisLogs}
            onEndReachedThreshold={0.3}
            renderItem={({ item }) => {
              const cfg = getLevelConfig(item.level);
              const sub = formatarSubsistema(item.usuario_id);
              const dataFmt = formatarDataBrasilia(item.created_at);
              const copiado = copiedId === item.id;

              return (
                <View style={[styles.logCard, { borderLeftColor: cfg.color }]}>
                  {/* Linha Superior: Nível + Data em Horário de Brasília */}
                  <View style={styles.logCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.levelBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                        <Ionicons name={cfg.icon} size={13} color={cfg.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.levelBadgeText, { color: cfg.color }]}>
                          {cfg.label}
                        </Text>
                      </View>

                      {/* Pill do Subsistema */}
                      <View style={[styles.subsystemBadge, { backgroundColor: '#1E293B' }]}>
                        <Ionicons name={sub.icon} size={11} color={sub.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.subsystemBadgeText, { color: '#E2E8F0' }]}>
                          {sub.label}
                        </Text>
                      </View>
                    </View>

                    {/* Data / Hora Brasília */}
                    <Text style={styles.timestampText}>
                      {dataFmt}
                    </Text>
                  </View>

                  {/* Mensagem do Log (Terminal Mono) */}
                  <Text style={styles.logMessage} selectable={true}>
                    {item.message || '(Sem mensagem)'}
                  </Text>

                  {/* Rodapé do Card: Metadados extras + Botão Copiar */}
                  <View style={styles.logCardFooter}>
                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {item.monitor_id && (
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>
                            Radar: {item.monitor_id.slice(0, 8)}...
                          </Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.copyBtn, copiado && styles.copyBtnSuccess]}
                      onPress={() => handleCopiarLog(item)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons
                        name={copiado ? 'checkmark' : 'copy-outline'}
                        size={13}
                        color={copiado ? '#16A34A' : '#94A3B8'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.copyBtnText, copiado && { color: '#16A34A' }]}>
                        {copiado ? 'Copiado!' : 'Copiar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBox}>
                  <Ionicons name="terminal-outline" size={44} color="#64748B" />
                </View>
                <Text style={styles.emptyTitle}>Nenhum registro encontrado</Text>
                <Text style={styles.emptySubtitle}>
                  {searchText
                    ? 'Nenhum log corresponde ao termo de busca pesquisado.'
                    : 'Aguardando novas ações dos scrapers e do worker do sistema.'}
                </Text>
                {searchText ? (
                  <TouchableOpacity
                    style={styles.emptyResetBtn}
                    onPress={() => setSearchText('')}
                  >
                    <Text style={styles.emptyResetBtnText}>Limpar Filtro</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMoreBox}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                  <Text style={styles.loadingMoreText}>Carregando mais eventos...</Text>
                </View>
              ) : !hasMore && logs.length > 0 ? (
                <View style={styles.endOfListBox}>
                  <Text style={styles.endOfListText}>Início do histórico alcançado.</Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16', // Fundo terminal escuro ultra moderno
  },
  header: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  terminalIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  adminBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 8,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B45309',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A0E1A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  statsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    flex: 1,
  },
  statChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  autoRefreshBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoRefreshText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
    marginRight: -4,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#F8FAFC',
    paddingVertical: 0,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  filterChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterChipLabelActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  logCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  subsystemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  subsystemBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  timestampText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
  logMessage: {
    fontSize: 13,
    color: '#F1F5F9',
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    marginBottom: 8,
  },
  logCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  metaChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaChipText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyBtnSuccess: {
    backgroundColor: '#DCFCE7',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  loadingText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingMoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  endOfListBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  endOfListText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyResetBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  emptyResetBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
