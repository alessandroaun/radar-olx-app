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
  RefreshControl,
  Dimensions,
  Platform,
  StatusBar,
  Vibration,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { supabase } from './supabase';
import { THEME } from './theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Catálogo padrão com metadados dos robôs e serviços conhecidos do ecossistema AchôAI
 */
const SERVICOS_CATALOGO = [
  {
    id: 'worker_daemon',
    nome: 'Supervisor Daemon Linux (24h)',
    categoria: 'daemon',
    icone: 'hardware-chip-outline',
    descricao: 'Monitoramento contínuo e heartbeat do processo central no Moto G9 Play',
  },
  {
    id: 'home_promocoes',
    nome: 'Varredura da Home & Promoções',
    categoria: 'scraper',
    icone: 'flash-outline',
    descricao: 'Coleta de achados e ofertas quentes para o feed principal',
  },
  {
    id: 'radares_usuarios',
    nome: 'Radares dos Usuários (Notificações)',
    categoria: 'scraper',
    icone: 'radio-outline',
    descricao: 'Varredura contínua de produtos cadastrados nos alertas dos usuários',
  },
  {
    id: 'pesquisa_inteligente',
    nome: 'Motor de Busca Sob Demanda',
    categoria: 'busca',
    icone: 'search-outline',
    descricao: 'Varredura concorrente em 12 grandes e-commerces em tempo real',
  },
  {
    id: 'videos_shopee',
    nome: 'Shopee Vídeos & Achadinhos',
    categoria: 'video',
    icone: 'videocam-outline',
    descricao: 'Rastreamento de hashtags virais e produtos dos vídeos verticais',
  },
  {
    id: 'videos_ml_clips',
    nome: 'Mercado Livre Clips (Shorts)',
    categoria: 'video',
    icone: 'film-outline',
    descricao: 'Extração automatizada de vídeos curtos de ofertas do Mercado Livre',
  },
  {
    id: 'videos_updater',
    nome: 'Calibrador de Ofertas & Vídeos',
    categoria: 'video',
    icone: 'sync-circle-outline',
    descricao: 'Comparação de preços e atualização de links reais das melhores lojas',
  },
  {
    id: 'cupons_lojas',
    nome: 'Sincronizador de Cupons Multiloja',
    categoria: 'cupons',
    icone: 'ticket-outline',
    descricao: 'Varredura e validação de cupons ativos em 10 grandes lojas parceiras',
  },
  {
    id: 'recomendacoes_motor',
    nome: 'Motor de Recomendações Autônomo',
    categoria: 'motor',
    icone: 'sparkles-outline',
    descricao: 'Geração inteligente de achados personalizados com base no comportamento',
  },
];

/**
 * Formata timestamp ISO para padrão brasileiro (Horário de Brasília: DD/MM/YYYY HH:mm:ss)
 */
function formatarDataBrasilia(dataIso) {
  if (!dataIso) return '-';
  try {
    const d = new Date(dataIso);
    if (isNaN(d.getTime())) return String(dataIso);
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
 * Formata duração em segundos (ex: '45s', '1m 23s', '2h 10m')
 * Se o processo estiver 'em_execucao', calcula a duração decorrida em tempo real
 * a partir de 'duracao_segundos' do banco ou de 'ultima_execucao' / 'updated_at'.
 */
function formatarDuracaoEmTempoReal(item, nowTime) {
  const isExecuting = item.status === 'em_execucao' || item.status === 'executando' || item.status === 'rodando';

  let seg = null;

  if (isExecuting) {
    // 1. Tenta calcular pelo tempo decorrido desde o início da execução (ultima_execucao ou updated_at)
    const refData = item.ultima_execucao || item.updated_at;
    if (refData) {
      const inicio = new Date(refData).getTime();
      if (!isNaN(inicio) && inicio > 0) {
        const diff = Math.max(0, Math.floor((nowTime - inicio) / 1000));
        // Se a diferença for razoável (menor que 48 horas), usa o timer ao vivo
        if (diff < 172800) {
          seg = diff;
        }
      }
    }
    // 2. Se não calculou pelo timestamp, usa duracao_segundos do banco
    if (seg == null && item.duracao_segundos != null) {
      seg = Number(item.duracao_segundos);
    }
  } else {
    if (item.duracao_segundos != null) {
      seg = Number(item.duracao_segundos);
    }
  }

  if (seg == null || isNaN(seg)) return '-';

  const totalSeg = Math.floor(seg);
  if (totalSeg < 60) {
    return isExecuting ? `${totalSeg}s (ao vivo)` : `${Number(seg).toFixed ? Number(seg).toFixed(1) : totalSeg}s`;
  }
  const min = Math.floor(totalSeg / 60);
  const restSeg = totalSeg % 60;
  if (min < 60) {
    return `${min}m ${restSeg < 10 ? '0' : ''}${restSeg}s${isExecuting ? ' (ao vivo)' : ''}`;
  }
  const horas = Math.floor(min / 60);
  const restMin = min % 60;
  return `${horas}h ${restMin}m ${restSeg < 10 ? '0' : ''}${restSeg}s${isExecuting ? ' (ao vivo)' : ''}`;
}

/**
 * Retorna configurações de estilo (cores, ícone, rótulo) conforme o status do serviço
 */
function getStatusConfig(status) {
  const s = String(status || 'pendente').toLowerCase();
  switch (s) {
    case 'em_execucao':
    case 'executando':
    case 'rodando':
      return {
        label: 'EM EXECUÇÃO',
        color: '#059669',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        icon: 'play-circle',
        badgeColor: '#10B981',
      };
    case 'concluido':
    case 'sucesso':
      return {
        label: 'CONCLUÍDO',
        color: '#0284C7',
        bg: '#F0F9FF',
        border: '#BAE6FD',
        icon: 'checkmark-circle-outline',
        badgeColor: '#0284C7',
      };
    case 'falha':
    case 'erro':
      return {
        label: 'FALHA',
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
        icon: 'alert-circle-outline',
        badgeColor: '#DC2626',
      };
    case 'ocioso':
    case 'parado':
      return {
        label: 'OCIOSO',
        color: '#64748B',
        bg: '#F1F5F9',
        border: '#CBD5E1',
        icon: 'pause-circle-outline',
        badgeColor: '#94A3B8',
      };
    case 'pendente':
    default:
      return {
        label: 'PENDENTE',
        color: '#D97706',
        bg: '#FEF3C7',
        border: '#FDE68A',
        icon: 'time-outline',
        badgeColor: '#F59E0B',
      };
  }
}

/**
 * Retorna ícone e cor amigável por categoria
 */
function getCategoriaConfig(categoria) {
  const cat = String(categoria || 'scraper').toLowerCase();
  switch (cat) {
    case 'video':
      return { label: 'Vídeos & Feed', icon: 'videocam-outline', color: '#8B5CF6' };
    case 'cupons':
      return { label: 'Cupons', icon: 'ticket-outline', color: '#EC4899' };
    case 'busca':
      return { label: 'Motor de Busca', icon: 'search-outline', color: '#3B82F6' };
    case 'daemon':
      return { label: 'Daemon / Sistema', icon: 'hardware-chip-outline', color: '#10B981' };
    case 'motor':
      return { label: 'Motor IA / Algoritmo', icon: 'sparkles-outline', color: '#F59E0B' };
    case 'scraper':
    default:
      return { label: 'Scraper / Varredura', icon: 'globe-outline', color: '#0284C7' };
  }
}

export function AdminServicesModal({ visible, onClose, isAdmin = false }) {
  const insets = useSafeAreaInsets();
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  const [searchText, setSearchText] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [tableExists, setTableExists] = useState(true);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [nowTime, setNowTime] = useState(Date.now());

  // Cronômetro de alta precisão (1s) para atualizar a duração de processos em execução em tempo real
  useEffect(() => {
    if (!visible || !isAdmin) return;
    const ticker = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, [visible, isAdmin]);

  // Animação de pulso para status em execução
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const autoRefreshTimerRef = useRef(null);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  // Carregar dados de status do Supabase
  const carregarServicos = useCallback(async (showIndicator = true) => {
    if (!isAdmin) return;
    if (showIndicator) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('servicos_status')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setTableExists(false);
        } else {
          console.log('[AdminServicesModal] Erro ao consultar servicos_status:', error);
        }
        // Utiliza o catálogo padrão
        setServicos(SERVICOS_CATALOGO.map(c => ({
          ...c,
          status: 'pendente',
          fase_atual: 'Aguardando inicialização da tabela servicos_status...',
          itens_processados: 0,
          duracao_segundos: null,
          ultima_execucao: null,
        })));
        return;
      }

      setTableExists(true);
      const rowsFromDb = data || [];
      const dbMap = new Map();
      rowsFromDb.forEach(r => dbMap.set(r.id, r));

      // Combina catálogo padrão com o que veio do banco
      const combinados = SERVICOS_CATALOGO.map(padrao => {
        const doBanco = dbMap.get(padrao.id);
        if (doBanco) {
          dbMap.delete(padrao.id);
          return {
            ...padrao,
            ...doBanco,
            nome: doBanco.nome || padrao.nome,
            categoria: doBanco.categoria || padrao.categoria,
          };
        }
        return {
          ...padrao,
          status: 'pendente',
          fase_atual: 'Aguardando primeiro ciclo...',
          itens_processados: 0,
          duracao_segundos: null,
          ultima_execucao: null,
        };
      });

      // Inclui serviços extras que existam no banco mas não estavam no catálogo padrão
      for (const [id, extra] of dbMap.entries()) {
        combinados.push({
          id,
          nome: extra.nome || id,
          categoria: extra.categoria || 'scraper',
          icone: 'construct-outline',
          descricao: 'Serviço em segundo plano registrado no backend',
          ...extra,
        });
      }

      // Ordena: em_execucao primeiro, depois falhas, depois outros
      combinados.sort((a, b) => {
        const peso = (s) => {
          if (s === 'em_execucao') return 1;
          if (s === 'falha') return 2;
          if (s === 'concluido') return 3;
          if (s === 'ocioso') return 4;
          return 5;
        };
        const pesoDiff = peso(a.status) - peso(b.status);
        if (pesoDiff !== 0) return pesoDiff;
        return a.nome.localeCompare(b.nome);
      });

      setServicos(combinados);
    } catch (err) {
      console.log('[AdminServicesModal] Exceção ao carregar serviços:', err);
    } finally {
      if (showIndicator) setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  // Carrega ao abrir o modal
  useEffect(() => {
    if (visible && isAdmin) {
      carregarServicos(true);
    } else {
      setServicos([]);
    }
  }, [visible, isAdmin, carregarServicos]);

  // Inscrição em tempo real no Supabase (Realtime postgres_changes)
  useEffect(() => {
    if (!visible || !isAdmin) return;

    let channel = null;
    try {
      channel = supabase
        .channel('admin_servicos_status_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'servicos_status' },
          (payload) => {
            const alterado = payload.new;
            if (!alterado || !alterado.id) return;

            setServicos(prev => {
              const idx = prev.findIndex(item => item.id === alterado.id);
              if (idx >= 0) {
                const updatedList = [...prev];
                updatedList[idx] = {
                  ...updatedList[idx],
                  ...alterado,
                };
                return updatedList;
              } else {
                return [alterado, ...prev];
              }
            });
          }
        )
        .subscribe();
    } catch (e) {
      console.log('[AdminServicesModal] Falha ao assinar realtime:', e);
    }

    // Polling de segurança a cada 8 segundos
    autoRefreshTimerRef.current = setInterval(() => {
      carregarServicos(false);
    }, 8000);

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {}
      }
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [visible, isAdmin, carregarServicos]);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    carregarServicos(false);
  }, [carregarServicos]);

  // Estatísticas agregadas
  const estatisticas = useMemo(() => {
    let emExecucao = 0;
    let concluidos = 0;
    let ociosos = 0;
    let falhas = 0;

    servicos.forEach(s => {
      const st = String(s.status || '').toLowerCase();
      if (st === 'em_execucao' || st === 'executando' || st === 'rodando') emExecucao++;
      else if (st === 'concluido' || st === 'sucesso') concluidos++;
      else if (st === 'falha' || st === 'erro') falhas++;
      else ociosos++;
    });

    return {
      total: servicos.length,
      emExecucao,
      concluidos,
      ociosos,
      falhas,
    };
  }, [servicos]);

  // Filtro por categoria e busca
  const servicosFiltrados = useMemo(() => {
    let lista = servicos;

    if (selectedCategory !== 'TODOS') {
      lista = lista.filter(s => {
        const cat = String(s.categoria || '').toLowerCase();
        if (selectedCategory === 'scraper') return cat === 'scraper';
        if (selectedCategory === 'video') return cat === 'video';
        if (selectedCategory === 'busca') return cat === 'busca';
        if (selectedCategory === 'cupons') return cat === 'cupons';
        if (selectedCategory === 'daemon') return cat === 'daemon' || cat === 'motor';
        return true;
      });
    }

    if (searchText && searchText.trim()) {
      const term = searchText.trim().toLowerCase();
      lista = lista.filter(s => {
        const nome = String(s.nome || '').toLowerCase();
        const fase = String(s.fase_atual || '').toLowerCase();
        const id = String(s.id || '').toLowerCase();
        const erro = String(s.ultimo_erro || '').toLowerCase();
        return nome.includes(term) || fase.includes(term) || id.includes(term) || erro.includes(term);
      });
    }

    return lista;
  }, [servicos, selectedCategory, searchText]);

  // Copiar relatório de diagnóstico de um serviço
  const handleCopiarServico = async (item) => {
    try {
      const durTexto = formatarDuracaoEmTempoReal(item, nowTime);
      const texto = `[DIAGNÓSTICO ROBÔ/SERVIÇO]\nNome: ${item.nome} (${item.id})\nStatus: ${item.status?.toUpperCase() || 'DESCONHECIDO'}\nFase Atual: ${item.fase_atual || '-'}\nItens Processados: ${item.itens_processados || 0}\nDuração: ${durTexto}\nÚltima Execução: ${formatarDataBrasilia(item.ultima_execucao || item.updated_at)}\n${item.ultimo_erro ? `Último Erro: ${item.ultimo_erro}\n` : ''}Servidor: Moto G9 Play Linux (192.168.3.27)`;
      await Clipboard.setStringAsync(texto);
      try { Vibration.vibrate(25); } catch (e) {}
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (e) {
      // Fallback
    }
  };

  // Copiar comando SQL caso a tabela ainda não tenha sido criada
  const handleCopiarSQL = async () => {
    const sql = `CREATE TABLE IF NOT EXISTS public.servicos_status (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT DEFAULT 'scraper',
    status TEXT NOT NULL DEFAULT 'ocioso',
    fase_atual TEXT,
    ultima_execucao TIMESTAMPTZ,
    proxima_execucao TIMESTAMPTZ,
    duracao_segundos NUMERIC,
    itens_processados INT DEFAULT 0,
    ultimo_erro TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.servicos_status;
ALTER TABLE public.servicos_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.servicos_status FOR SELECT USING (true);
CREATE POLICY "Permitir escrita total para service_role" ON public.servicos_status FOR ALL USING (true);`;
    await Clipboard.setStringAsync(sql);
    try { Vibration.vibrate(30); } catch (e) {}
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  if (!isAdmin) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent={true} />

        {/* CABEÇALHO TERMINAL / ADMIN */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) }]}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="hardware-chip" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.headerTitle}>Robôs & Serviços</Text>
                <View style={styles.liveIndicator}>
                  <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                  <Text style={styles.liveText}>AO VIVO</Text>
                </View>
              </View>
              <Text style={styles.headerSubtitle}>
                Backend Moto G9 Play • Linux 24h
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => carregarServicos(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={20} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerButton, { marginLeft: 8 }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color="#F1F5F9" />
            </TouchableOpacity>
          </View>

          {/* CHIPS DE ESTATÍSTICAS */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{estatisticas.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>

            <View style={[styles.statCard, estatisticas.emExecucao > 0 && styles.statCardActive]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {estatisticas.emExecucao > 0 && (
                  <Animated.View style={[styles.statDotActive, { opacity: pulseAnim }]} />
                )}
                <Text style={[styles.statNumber, { color: estatisticas.emExecucao > 0 ? '#10B981' : '#F1F5F9' }]}>
                  {estatisticas.emExecucao}
                </Text>
              </View>
              <Text style={styles.statLabel}>Ativos</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: '#38BDF8' }]}>{estatisticas.concluidos + estatisticas.ociosos}</Text>
              <Text style={styles.statLabel}>Ociosos</Text>
            </View>

            <View style={[styles.statCard, estatisticas.falhas > 0 && styles.statCardError]}>
              <Text style={[styles.statNumber, { color: estatisticas.falhas > 0 ? '#EF4444' : '#64748B' }]}>
                {estatisticas.falhas}
              </Text>
              <Text style={styles.statLabel}>Falhas</Text>
            </View>
          </View>

          {/* BARRA DE PESQUISA */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar serviço, fase ou erro..."
              placeholderTextColor="#64748B"
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* ABAS DE CATEGORIA */}
          <View style={styles.tabsRow}>
            {[
              { id: 'TODOS', label: 'Todos' },
              { id: 'video', label: 'Vídeos' },
              { id: 'scraper', label: 'Scrapers' },
              { id: 'busca', label: 'Busca' },
              { id: 'cupons', label: 'Cupons' },
              { id: 'daemon', label: 'Motores' },
            ].map((tab) => {
              const active = selectedCategory === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                  onPress={() => setSelectedCategory(tab.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CONTEÚDO / CORPO */}
        <View style={styles.body}>
          {/* ALERTA CASO TABELA NÃO EXISTA NO SUPABASE */}
          {!tableExists && (
          <View style={styles.sqlAlertBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons name="warning-outline" size={18} color="#D97706" />
              <Text style={styles.sqlAlertTitle}>Tabela servicos_status pendente</Text>
            </View>
            <Text style={styles.sqlAlertDesc}>
              Para ativar o monitoramento em tempo real, execute o comando SQL de criação da tabela no Supabase SQL Editor.
            </Text>
            <TouchableOpacity
              style={styles.sqlCopyButton}
              onPress={handleCopiarSQL}
              activeOpacity={0.7}
            >
              <Ionicons
                name={sqlCopied ? 'checkmark-circle' : 'copy-outline'}
                size={16}
                color={sqlCopied ? '#10B981' : '#FFFFFF'}
              />
              <Text style={styles.sqlCopyButtonText}>
                {sqlCopied ? 'Comando SQL Copiado!' : 'Copiar Comando SQL'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LISTAGEM DOS SERVIÇOS */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Conectando aos sensores do servidor...</Text>
          </View>
        ) : (
          <FlatList
            data={servicosFiltrados}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(insets.bottom, 24) + 16 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#10B981"
                colors={['#10B981']}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={44} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Nenhum serviço encontrado</Text>
                <Text style={styles.emptySub}>
                  Tente alterar o filtro de categoria ou os termos da pesquisa.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const statusCfg = getStatusConfig(item.status);
              const catCfg = getCategoriaConfig(item.categoria);
              const isExecuting = item.status === 'em_execucao';
              const isCopied = copiedId === item.id;

              return (
                <View style={styles.serviceCard}>
                  {/* TOPO DO CARD */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIconAndTitle}>
                      <View style={[styles.cardServiceIcon, { backgroundColor: `${catCfg.color}18` }]}>
                        <Ionicons name={item.icone || catCfg.icon} size={20} color={catCfg.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.nome}
                        </Text>
                        <Text style={styles.cardCategoryText}>
                          {catCfg.label} • {item.id}
                        </Text>
                      </View>
                    </View>

                    {/* STATUS BADGE */}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusCfg.bg,
                          borderColor: statusCfg.border,
                        },
                      ]}
                    >
                      {isExecuting ? (
                        <Animated.View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusCfg.badgeColor, opacity: pulseAnim },
                          ]}
                        />
                      ) : (
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusCfg.badgeColor },
                          ]}
                        />
                      )}
                      <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
                        {statusCfg.label}
                      </Text>
                    </View>
                  </View>

                  {/* DESCRIÇÃO BREVE */}
                  {item.descricao ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {item.descricao}
                    </Text>
                  ) : null}

                  {/* FASE ATUAL */}
                  <View
                    style={[
                      styles.faseAtualBox,
                      isExecuting && styles.faseAtualBoxExecuting,
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Ionicons
                        name={isExecuting ? 'sync-outline' : 'navigate-outline'}
                        size={14}
                        color={isExecuting ? '#059669' : '#64748B'}
                      />
                      <Text style={[styles.faseAtualLabel, isExecuting && { color: '#059669' }]}>
                        {isExecuting ? 'FASE ATUAL EM PROGRESSO:' : 'ÚLTIMO ESTADO REGISTRADO:'}
                      </Text>
                    </View>
                    <Text style={[styles.faseAtualText, isExecuting && { color: '#065F46', fontWeight: '600' }]}>
                      {item.fase_atual || 'Aguardando próxima chamada programada.'}
                    </Text>
                  </View>

                  {/* ALERTA DE ERRO CASO EXISTA */}
                  {item.ultimo_erro ? (
                    <View style={styles.errorBanner}>
                      <Ionicons name="alert-circle" size={15} color="#DC2626" style={{ marginTop: 1 }} />
                      <Text style={styles.errorBannerText} numberOfLines={3}>
                        {item.ultimo_erro}
                      </Text>
                    </View>
                  ) : null}

                  {/* GRID DE MÉTRICAS */}
                  <View style={styles.metricsGrid}>
                    <View style={styles.metricItem}>
                      <Ionicons name="cube-outline" size={13} color="#64748B" />
                      <Text style={styles.metricLabel}>Processados:</Text>
                      <Text style={styles.metricValue}>
                        {item.itens_processados ?? 0} itens
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <Ionicons
                        name={isExecuting ? "time" : "timer-outline"}
                        size={13}
                        color={isExecuting ? "#059669" : "#64748B"}
                      />
                      <Text style={[styles.metricLabel, isExecuting && { color: "#059669", fontWeight: "700" }]}>
                        Duração:
                      </Text>
                      <Text style={[styles.metricValue, isExecuting && { color: "#059669", fontWeight: "800" }]}>
                        {formatarDuracaoEmTempoReal(item, nowTime)}
                      </Text>
                    </View>

                    <View style={[styles.metricItem, { width: '100%', marginTop: 3 }]}>
                      <Ionicons name="time-outline" size={13} color="#64748B" />
                      <Text style={styles.metricLabel}>Última Execução:</Text>
                      <Text style={[styles.metricValue, { flex: 1 }]} numberOfLines={1}>
                        {formatarDataBrasilia(item.ultima_execucao || item.updated_at)}
                      </Text>
                    </View>
                  </View>

                  {/* RODAPÉ DO CARD COM AÇÕES */}
                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={styles.copyDiagButton}
                      onPress={() => handleCopiarServico(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isCopied ? 'checkmark' : 'copy-outline'}
                        size={13}
                        color={isCopied ? '#10B981' : '#64748B'}
                      />
                      <Text style={[styles.copyDiagText, isCopied && { color: '#10B981' }]}>
                        {isCopied ? 'Copiado para a Área de Transferência!' : 'Copiar Diagnóstico'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Fundo escuro integral para preencher o notch e a barra de status sem bordas brancas
  },
  body: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statCardActive: {
    borderColor: '#10B981',
    backgroundColor: '#064E3B40',
  },
  statCardError: {
    borderColor: '#EF4444',
    backgroundColor: '#7F1D1D30',
  },
  statDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    paddingVertical: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tabButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sqlAlertBox: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
  },
  sqlAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  sqlAlertDesc: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
    marginBottom: 8,
  },
  sqlCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B45309',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  sqlCopyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardIconAndTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  cardServiceIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardCategoryText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  faseAtualBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  faseAtualBoxExecuting: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  faseAtualLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  faseAtualText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    marginBottom: 10,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#DC2626',
    lineHeight: 15,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 8,
    gap: 8,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  copyDiagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  copyDiagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
});
