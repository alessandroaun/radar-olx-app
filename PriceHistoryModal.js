import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Animated,
  Easing,
  Vibration,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from './theme';
import { StoreLogoBadge } from './components';
import { supabase } from './supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Normaliza o título para agrupar variações mantendo modelo e especificações específicas.
 */
export function normalizarNomeProdutoJS(titulo) {
  if (!titulo) return '';
  let t = String(titulo).trim();
  t = t.replace(/#[\w\d_-]+/g, ' ');
  t = t.replace(/[*_~`]+/g, ' ');
  t = t.replace(/\b(compre aqui:?|veja aqui:?|clique aqui:?|link na bio:?|confira:?)\b/gi, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * Formata valores numéricos para Real Brasileiro (R$)
 */
function formatarMoeda(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return 'R$ --';
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formata data YYYY-MM-DD para DD/MM
 */
function formatarDataLabel(dataIso) {
  if (!dataIso) return '';
  try {
    const partes = String(dataIso).split('T')[0].split('-');
    if (partes.length === 3) {
      const hoje = new Date();
      const anoHoje = hoje.getFullYear();
      const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
      const diaHoje = String(hoje.getDate()).padStart(2, '0');
      const hojeIso = `${anoHoje}-${mesHoje}-${diaHoje}`;

      if (dataIso.startsWith(hojeIso)) return 'Hoje';
      return `${partes[2]}/${partes[1]}`;
    }
    return String(dataIso).slice(5, 10);
  } catch (e) {
    return String(dataIso);
  }
}

export const PriceHistoryModal = ({
  visible,
  item,
  onClose,
  onOpenOfferUrl,
}) => {
  const [showModal, setShowModal] = useState(visible);
  const [loading, setLoading] = useState(true);
  const [historyPoints, setHistoryPoints] = useState([]);
  const [storeOffers, setStoreOffers] = useState([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [useProxyFallback, setUseProxyFallback] = useState(false);

  useEffect(() => {
    setImgError(false);
    setUseProxyFallback(false);
  }, [item?.imagem_url, item?.image, item?.foto, item?.thumbnail, item?.produto_imagem]);

  const imagemResolvida = useMemo(() => {
    let u = (item?.imagem_url || item?.image || item?.foto || item?.thumbnail || item?.produto_imagem || '').trim();
    if (!u) return null;
    if (u.startsWith('//')) {
      u = 'https:' + u;
    } else if (u.startsWith('http://')) {
      u = 'https://' + u.slice(7);
    }
    if (u.includes('{w}x{h}')) {
      u = u.replace('{w}x{h}', '800x560');
    }
    if (u.includes('proxy.duckduckgo.com')) {
      try {
        const match = u.match(/[?&]u=([^&]+)/);
        if (match && match[1]) {
          u = decodeURIComponent(match[1]);
        }
      } catch (e) {}
    }
    return u;
  }, [item?.imagem_url, item?.image, item?.foto, item?.thumbnail, item?.produto_imagem]);

  const imageSource = useMemo(() => {
    if (!imagemResolvida) return null;
    const isCasasBahia = imagemResolvida.includes('casasbahia') || imagemResolvida.includes('extra.com') || imagemResolvida.includes('pontofrio');
    if (useProxyFallback && isCasasBahia) {
      return { uri: `https://proxy.duckduckgo.com/iu/?u=${encodeURIComponent(imagemResolvida)}` };
    }
    if (isCasasBahia) {
      return {
        uri: imagemResolvida,
        headers: {
          Referer: 'https://www.casasbahia.com.br/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        }
      };
    }
    return { uri: imagemResolvida };
  }, [imagemResolvida, useProxyFallback]);

  const handleImageError = () => {
    const isCasasBahia = imagemResolvida && (imagemResolvida.includes('casasbahia') || imagemResolvida.includes('extra.com') || imagemResolvida.includes('pontofrio'));
    if (isCasasBahia && !useProxyFallback) {
      setUseProxyFallback(true);
    } else {
      setImgError(true);
    }
  };

  const isClosingRef = useRef(false);

  // Animações a 60 FPS de entrada e saída (idênticas ao NotificationsModal)
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    try {
      Vibration.vibrate(15);
    } catch (e) {}

    slideAnim.stopAnimation();
    fadeAnim.stopAnimation();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowModal(false);
      isClosingRef.current = false;
      if (onClose) onClose();
    });
  };

  // Efeito 1: Controle de Abertura/Fechamento e Escurecimento Progressivo do Fundo
  useEffect(() => {
    slideAnim.stopAnimation();
    fadeAnim.stopAnimation();

    if (visible) {
      isClosingRef.current = false;
      fadeAnim.setValue(0);
      slideAnim.setValue(SCREEN_HEIGHT);
      setShowModal(true);

      // Aguarda montagem nativa da janela modal para garantir fade-in 100% gradual e suave
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 320,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 320,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              useNativeDriver: true,
            }),
          ]).start();
        });
      }, 20);

      return () => clearTimeout(timer);
    } else if (!isClosingRef.current && showModal) {
      handleClose();
    }
  }, [visible, SCREEN_HEIGHT]);

  // Efeito 2: Carregamento de dados assíncronos (desacoplado da animação)
  useEffect(() => {
    if (visible && item) {
      setLoading(true);
      setSelectedPointIndex(null);
      carregarDadosHistorico();
    }
  }, [visible, item?.id, item?.titulo]);

  const carregarDadosHistorico = async () => {
    if (!item) {
      setLoading(false);
      return;
    }

    try {
      const tituloOriginal = item?.titulo || item?.title || item?.produto_titulo || '';
      const cleanTitle = normalizarNomeProdutoJS(tituloOriginal);
      const precoAtual = parseFloat(item?.preco || item?.price || item?.produto_preco) || 0;
      const cleanUrl = (item?.url || item?.url_produto || item?.produto_url || '').split('?')[0].replace(/\/$/, '');

      let pontosEvolucao = [];
      let ofertasLojas = [];

      // 1. Tenta buscar evolução diária agrupada na view com correspondência estrita
      try {
        let queryView = supabase
          .from('view_evolucao_precos_diaria')
          .select('*')
          .order('dia_referencia', { ascending: true })
          .limit(40);

        if (cleanTitle.length >= 10) {
          const prefixo = cleanTitle.slice(0, 40);
          if (cleanUrl.length > 15) {
            queryView = queryView.or(`produto_nome.ilike.%${prefixo}%,url_melhor_oferta.ilike.%${cleanUrl.slice(-30)}%`);
          } else {
            queryView = queryView.ilike('produto_nome', `%${prefixo}%`);
          }
        } else if (cleanUrl.length > 15) {
          queryView = queryView.ilike('url_melhor_oferta', `%${cleanUrl.slice(-30)}%`);
        }

        const { data: viewData, error: viewError } = await queryView;
        if (!viewError && Array.isArray(viewData) && viewData.length > 0) {
          // Filtra outliers absurdos (preço de acessório/capinha não pode contaminar produto caro)
          const dadosValidos = viewData.filter((r) => {
            const pMed = parseFloat(r.preco_medio_dia) || parseFloat(r.menor_preco_dia) || 0;
            if (precoAtual > 50 && (pMed < precoAtual * 0.35 || pMed > precoAtual * 3.0)) {
              return false;
            }
            return true;
          });

          if (dadosValidos.length > 0) {
            pontosEvolucao = dadosValidos.map((r) => ({
              ...r,
              data_registro: r.dia_referencia || r.data_registro,
            }));
          }
        }
      } catch (eView) {
        console.warn('Erro ao consultar view_evolucao_precos_diaria:', eView);
      }

      // 2. Se não encontrou ou precisa de mais detalhes, busca diretamente em historico_precos
      try {
        let queryHist = supabase
          .from('historico_precos')
          .select('*')
          .order('dia_referencia', { ascending: true })
          .limit(60);

        if (cleanTitle.length >= 10) {
          const prefixo = cleanTitle.slice(0, 40);
          if (cleanUrl.length > 15) {
            queryHist = queryHist.or(`produto_nome.ilike.%${prefixo}%,url_produto.ilike.%${cleanUrl.slice(-30)}%`);
          } else {
            queryHist = queryHist.ilike('produto_nome', `%${prefixo}%`);
          }
        } else if (cleanUrl.length > 15) {
          queryHist = queryHist.ilike('url_produto', `%${cleanUrl.slice(-30)}%`);
        }

        const { data: histData, error: histError } = await queryHist;

        if (!histError && Array.isArray(histData) && histData.length > 0) {
          // Filtra outliers de acessórios
          const histValidos = histData.filter((row) => {
            const p = parseFloat(row.preco) || 0;
            if (p <= 5.0) return false;
            if (precoAtual > 50 && (p < precoAtual * 0.35 || p > precoAtual * 3.0)) {
              return false;
            }
            return true;
          });

          // Se não havia dados da view, monta agrupamento diário
          if (pontosEvolucao.length === 0 && histValidos.length > 0) {
            const agrupadoPorData = {};
            histValidos.forEach((row) => {
              const dt = row.dia_referencia || (row.data_coleta ? row.data_coleta.split('T')[0] : (row.created_at ? row.created_at.split('T')[0] : 'Hoje'));
              const preco = parseFloat(row.preco) || 0;

              if (!agrupadoPorData[dt]) {
                agrupadoPorData[dt] = {
                  data_registro: dt,
                  menor_preco_dia: preco,
                  maior_preco_dia: preco,
                  soma_precos: preco,
                  total_ofertas_dia: 1,
                  melhor_loja_dia: row.loja,
                  url_melhor_oferta: row.url_produto || row.url,
                };
              } else {
                const ag = agrupadoPorData[dt];
                if (preco < ag.menor_preco_dia) {
                  ag.menor_preco_dia = preco;
                  ag.melhor_loja_dia = row.loja;
                  ag.url_melhor_oferta = row.url_produto || row.url;
                }
                if (preco > ag.maior_preco_dia) {
                  ag.maior_preco_dia = preco;
                }
                ag.soma_precos += preco;
                ag.total_ofertas_dia += 1;
              }
            });

            pontosEvolucao = Object.keys(agrupadoPorData)
              .sort()
              .map((dt) => {
                const ag = agrupadoPorData[dt];
                return {
                  data_registro: dt,
                  menor_preco_dia: ag.menor_preco_dia,
                  maior_preco_dia: ag.maior_preco_dia,
                  preco_medio_dia: ag.soma_precos / ag.total_ofertas_dia,
                  total_ofertas_dia: ag.total_ofertas_dia,
                  melhor_loja_dia: ag.melhor_loja_dia,
                  url_melhor_oferta: ag.url_melhor_oferta,
                };
              });
          }

          // Agrupa as melhores ofertas atuais por loja para o Comparativo
          const lojasMap = {};
          histValidos.forEach((row) => {
            const loja = row.loja || 'Loja Parceira';
            const preco = parseFloat(row.preco) || 0;

            if (!lojasMap[loja] || preco < lojasMap[loja].preco) {
              lojasMap[loja] = {
                loja,
                preco,
                url: row.url_produto || row.url,
                data_registro: row.dia_referencia || (row.data_coleta ? row.data_coleta.split('T')[0] : 'Hoje'),
                titulo: row.titulo_anuncio || row.titulo || row.produto_nome,
              };
            }
          });
          ofertasLojas = Object.values(lojasMap).sort((a, b) => a.preco - b.preco);
        }
      } catch (eHist) {
        console.warn('Erro ao consultar historico_precos:', eHist);
      }

      // Se nenhum ponto histórico foi retornado, cria o ponto de referência com o preço real atual
      if (precoAtual > 0 && pontosEvolucao.length === 0) {
        const hojeIso = new Date().toISOString().split('T')[0];
        pontosEvolucao.push({
          data_registro: hojeIso,
          menor_preco_dia: precoAtual,
          maior_preco_dia: precoAtual,
          preco_medio_dia: precoAtual,
          total_ofertas_dia: 1,
          melhor_loja_dia: item?.loja || 'AchôAI',
          url_melhor_oferta: item?.url || item?.url_produto,
        });
      }

      setHistoryPoints(pontosEvolucao);
      setStoreOffers(ofertasLojas);
      if (pontosEvolucao.length > 0) {
        setSelectedPointIndex(pontosEvolucao.length - 1);
      }
    } catch (err) {
      console.error('Erro geral ao carregar histórico de preços:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cálculo das 4 Métricas e Termômetro
  const stats = useMemo(() => {
    const precoAtual = parseFloat(item?.preco || item?.price) || 0;

    if (!historyPoints || historyPoints.length === 0) {
      return {
        menor: precoAtual,
        maior: precoAtual,
        media: precoAtual,
        atual: precoAtual,
        menorLoja: item?.loja || 'Esta Loja',
        menorData: 'Hoje',
        termometro: {
          status: 'NOVO_NO_RADAR',
          label: 'Rastreio em Início',
          cor: '#0284C7',
          bg: '#E0F2FE',
          borda: '#BAE6FD',
          icone: 'sparkles',
          descricao: 'Produto catalogado recentemente. Histórico em formação.',
        },
      };
    }

    let menor = Infinity;
    let maior = -Infinity;
    let somaMedias = 0;
    let menorLoja = item?.loja || '';
    let menorData = '';

    historyPoints.forEach((p) => {
      const pMenor = parseFloat(p.menor_preco_dia) || 0;
      const pMaior = parseFloat(p.maior_preco_dia || p.menor_preco_dia) || 0;
      const pMedio = parseFloat(p.preco_medio_dia || p.menor_preco_dia) || 0;

      if (pMenor > 0 && pMenor < menor) {
        menor = pMenor;
        menorLoja = p.melhor_loja_dia || menorLoja;
        menorData = p.data_registro;
      }
      if (pMaior > maior) {
        maior = pMaior;
      }
      somaMedias += pMedio;
    });

    const media = historyPoints.length > 0 ? somaMedias / historyPoints.length : precoAtual;
    if (menor === Infinity) menor = precoAtual;
    if (maior === -Infinity) maior = precoAtual;

    // Lógica do Termômetro
    let termometro = {
      status: 'PRECO_NORMAL',
      label: 'Preço na Média',
      cor: '#D97706',
      bg: '#FEF3C7',
      borda: '#FDE68A',
      icone: 'swap-horizontal',
      descricao: 'Valor dentro do padrão médio histórico monitorado.',
    };

    if (precoAtual <= menor * 1.01) {
      termometro = {
        status: 'EXCELENTE_MOMENTO',
        label: 'Excelente Momento para Comprar!',
        cor: '#16A34A',
        bg: '#DCFCE7',
        borda: '#86EFAC',
        icone: 'flame',
        descricao: 'Este é o menor valor já registrado pela nossa plataforma!',
      };
    } else if (media > 0 && precoAtual < media * 0.96) {
      const economiaPct = Math.round(((media - precoAtual) / media) * 100);
      termometro = {
        status: 'BOM_MOMENTO',
        label: `Bom Momento (${economiaPct}% abaixo da média)`,
        cor: '#2563EB',
        bg: '#DBEAFE',
        borda: '#93C5FD',
        icone: 'trending-down',
        descricao: `Preço consideravelmente mais em conta do que a média dos últimos 30 dias.`,
      };
    } else if (media > 0 && precoAtual > media * 1.06) {
      termometro = {
        status: 'PRECO_ALTO',
        label: 'Preço Acima da Média',
        cor: '#DC2626',
        bg: '#FEE2E2',
        borda: '#FCA5A5',
        icone: 'trending-up',
        descricao: 'Preço mais elevado que o habitual. Vale a pena esperar uma queda.',
      };
    }

    return {
      menor,
      maior,
      media,
      atual: precoAtual,
      menorLoja,
      menorData: formatarDataLabel(menorData),
      termometro,
    };
  }, [historyPoints, item]);

  // Cálculo da escala do gráfico
  const chartScale = useMemo(() => {
    if (!historyPoints || historyPoints.length === 0) return { min: 0, max: 100 };
    let min = Infinity;
    let max = -Infinity;
    historyPoints.forEach((p) => {
      const v = parseFloat(p.menor_preco_dia) || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    });
    if (min === Infinity) min = 0;
    if (max === -Infinity || max === min) max = min + 50;
    const padding = (max - min) * 0.2 || 20;
    return {
      min: Math.max(0, min - padding),
      max: max + padding,
    };
  }, [historyPoints]);

  const precoAtualFormatado = formatarMoeda(item?.preco || item?.price);
  const lojaAtual = item?.loja || 'Loja Oficial';
  const temHistoricoSuficiente = historyPoints.length >= 2;

  if (!showModal) return null;

  return (
    <Modal
      visible={showModal}
      transparent={true}
      statusBarTranslucent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        {/* Backdrop animado cobrindo 100% da tela (inclusive header) com fade nativo */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        </Animated.View>

        {/* Painel Inferior Deslizante */}
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
          {/* Puxador Superior */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          {/* Cabeçalho do Modal */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBox}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="stats-chart" size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Histórico de Preços</Text>
                <Text style={styles.headerSubtitle}>Monitoramento contínuo do AchôAI</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.closeBtn} 
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Conteúdo Rolável */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Card Resumo do Produto Selecionado */}
            <View style={styles.productSummaryCard}>
              <View style={styles.productThumbBox}>
                {imageSource && !imgError ? (
                  <Image
                    source={imageSource}
                    style={styles.productThumb}
                    resizeMode="contain"
                    onError={handleImageError}
                  />
                ) : (
                  <StoreLogoBadge storeKey={lojaAtual} size={36} />
                )}
              </View>
              <View style={styles.productInfoBox}>
                <Text style={styles.productTitle} numberOfLines={2}>
                  {item?.titulo || item?.title || 'Produto Monitorado'}
                </Text>
                <View style={styles.productStorePriceRow}>
                  <View style={styles.storeBadgeBox}>
                    <StoreLogoBadge storeKey={lojaAtual} size={15} style={{ marginRight: 4 }} />
                    <Text style={styles.storeNameText}>{lojaAtual}</Text>
                  </View>
                  <Text style={styles.currentPriceText}>{precoAtualFormatado}</Text>
                </View>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.loadingText}>Verificando histórico de preços no banco de dados...</Text>
              </View>
            ) : !temHistoricoSuficiente ? (
              /* Estado Educativo: Menos de 2 registros coletados */
              <View style={styles.novoRadarBox}>
                <View style={styles.novoRadarIconPill}>
                  <Ionicons name="sparkles" size={24} color="#0284C7" />
                </View>
                <Text style={styles.novoRadarTitle}>Histórico em Construção!</Text>
                <Text style={styles.novoRadarDesc}>
                  Este produto foi adicionado recentemente ao nosso radar de monitoramento.
                  Nossos robôs estão catalogando as oscilações diárias deste anúncio para montar o gráfico temporal e o termômetro completo de oportunidade nos próximos dias.
                </Text>

                <View style={styles.novoRadarInfoCard}>
                  <View style={styles.novoRadarInfoRow}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" style={{ marginRight: 6 }} />
                    <Text style={styles.novoRadarInfoText}>Primeiro preço catalogado: <Text style={{ fontWeight: '700' }}>{precoAtualFormatado}</Text></Text>
                  </View>
                  <View style={[styles.novoRadarInfoRow, { marginTop: 6 }]}>
                    <Ionicons name="time-outline" size={16} color="#2563EB" style={{ marginRight: 6 }} />
                    <Text style={styles.novoRadarInfoText}>Varreduras automáticas ativas a cada 1 hora.</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.novoRadarCloseBtn} onPress={handleClose} activeOpacity={0.8}>
                  <Text style={styles.novoRadarCloseBtnText}>Entendido, continuar acompanhando</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Estado Completo: Histórico disponível com Gráfico e Termômetro */
              <>
                {/* Termômetro de Oportunidade */}
                <View style={[styles.thermometerCard, { backgroundColor: stats.termometro.bg, borderColor: stats.termometro.borda }]}>
                  <View style={styles.thermometerHeader}>
                    <View style={[styles.thermometerIconCircle, { backgroundColor: stats.termometro.cor }]}>
                      <Ionicons name={stats.termometro.icone} size={15} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.thermometerTitle, { color: stats.termometro.cor }]}>
                      {stats.termometro.label}
                    </Text>
                  </View>
                  <Text style={styles.thermometerDesc}>{stats.termometro.descricao}</Text>
                </View>

                {/* 4 Cards de Métricas (Grid 2x2) */}
                <View style={styles.metricsGrid}>
                  {/* Card 1: Menor Preço */}
                  <View style={[styles.metricCard, { borderLeftColor: '#16A34A' }]}>
                    <View style={styles.metricHeaderRow}>
                      <Ionicons name="arrow-down-circle" size={14} color="#16A34A" />
                      <Text style={styles.metricLabel}>Menor Preço</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: '#16A34A' }]}>
                      {formatarMoeda(stats.menor)}
                    </Text>
                    <Text style={styles.metricSubtext} numberOfLines={1}>
                      {stats.menorLoja} {stats.menorData ? `• ${stats.menorData}` : ''}
                    </Text>
                  </View>

                  {/* Card 2: Média dos 30 Dias */}
                  <View style={[styles.metricCard, { borderLeftColor: '#2563EB' }]}>
                    <View style={styles.metricHeaderRow}>
                      <Ionicons name="analytics" size={14} color="#2563EB" />
                      <Text style={styles.metricLabel}>Média Registrada</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: '#2563EB' }]}>
                      {formatarMoeda(stats.media)}
                    </Text>
                    <Text style={styles.metricSubtext}>Média dos últimos dias</Text>
                  </View>

                  {/* Card 3: Preço Atual */}
                  <View style={[styles.metricCard, { borderLeftColor: '#FF5722' }]}>
                    <View style={styles.metricHeaderRow}>
                      <Ionicons name="pricetag" size={14} color="#FF5722" />
                      <Text style={styles.metricLabel}>Preço Atual</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: '#0F172A' }]}>
                      {formatarMoeda(stats.atual)}
                    </Text>
                    <Text style={styles.metricSubtext} numberOfLines={1}>
                      Na loja {lojaAtual}
                    </Text>
                  </View>

                  {/* Card 4: Maior Preço */}
                  <View style={[styles.metricCard, { borderLeftColor: '#EF4444' }]}>
                    <View style={styles.metricHeaderRow}>
                      <Ionicons name="arrow-up-circle" size={14} color="#EF4444" />
                      <Text style={styles.metricLabel}>Maior Preço</Text>
                    </View>
                    <Text style={[styles.metricValue, { color: '#DC2626' }]}>
                      {formatarMoeda(stats.maior)}
                    </Text>
                    <Text style={styles.metricSubtext}>Pico observado</Text>
                  </View>
                </View>

                {/* Gráfico de Evolução Temporal Interativo */}
                <View style={styles.chartContainer}>
                  <View style={styles.chartHeader}>
                    <View>
                      <Text style={styles.chartTitle}>Evolução de Preço</Text>
                      <Text style={styles.chartSubtitle}>Toque em qualquer data para inspecionar</Text>
                    </View>
                    {selectedPointIndex !== null && historyPoints[selectedPointIndex] && (
                      <View style={styles.chartBadgeSelected}>
                        <Text style={styles.chartBadgeSelectedText}>
                          {formatarMoeda(historyPoints[selectedPointIndex].menor_preco_dia)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Área do Gráfico */}
                  <View style={styles.chartPlotArea}>
                    {/* Linha guia de média pontilhada */}
                    <View style={styles.chartGuideLine} />

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chartScrollArea}
                    >
                      {historyPoints.map((ponto, idx) => {
                        const precoDia = parseFloat(ponto.menor_preco_dia) || 0;
                        const percentHeight = Math.min(
                          100,
                          Math.max(
                            18,
                            ((precoDia - chartScale.min) / (chartScale.max - chartScale.min)) * 100
                          )
                        );
                        const isSelected = selectedPointIndex === idx;
                        const isMenorGeral = precoDia <= stats.menor * 1.005;

                        return (
                          <TouchableOpacity
                            key={`point-${idx}-${ponto.data_registro}`}
                            style={styles.chartBarCol}
                            activeOpacity={0.7}
                            onPress={() => {
                              try { Vibration.vibrate(15); } catch (e) {}
                              setSelectedPointIndex(idx);
                            }}
                          >
                            {/* Valor flutuante no ponto selecionado */}
                            {isSelected && (
                              <View style={styles.floatingPricePill}>
                                <Text style={styles.floatingPricePillText}>
                                  {formatarMoeda(precoDia)}
                                </Text>
                                <Text style={styles.floatingPricePillSub}>
                                  {ponto.melhor_loja_dia || 'Loja'}
                                </Text>
                              </View>
                            )}

                            {/* Linha / Haste Vertical */}
                            <View style={styles.chartBarStemBox}>
                              <View
                                style={[
                                  styles.chartBarStem,
                                  { height: `${percentHeight}%` },
                                  isSelected && styles.chartBarStemActive,
                                  isMenorGeral && styles.chartBarStemLowest,
                                ]}
                              >
                                {/* Ponto no topo da haste */}
                                <View
                                  style={[
                                    styles.chartNodeDot,
                                    isSelected && styles.chartNodeDotActive,
                                    isMenorGeral && styles.chartNodeDotLowest,
                                  ]}
                                />
                              </View>
                            </View>

                            {/* Label da Data */}
                            <Text
                              style={[
                                styles.chartDateLabel,
                                isSelected && styles.chartDateLabelActive,
                              ]}
                            >
                              {formatarDataLabel(ponto.data_registro)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={styles.chartFooterLegend}>
                    <View style={styles.chartLegendItem}>
                      <View style={[styles.chartLegendDot, { backgroundColor: '#16A34A' }]} />
                      <Text style={styles.chartLegendText}>Menor Preço</Text>
                    </View>
                    <View style={styles.chartLegendItem}>
                      <View style={[styles.chartLegendDot, { backgroundColor: '#2563EB' }]} />
                      <Text style={styles.chartLegendText}>Registros Anteriores</Text>
                    </View>
                  </View>
                </View>

                {/* Comparativo de Preços entre Lojas */}
                {storeOffers.length > 0 && (
                  <View style={styles.storeCompareSection}>
                    <View style={styles.storeCompareHeader}>
                      <View style={styles.storeCompareIconBox}>
                        <Ionicons name="storefront" size={16} color="#0F172A" />
                      </View>
                      <View>
                        <Text style={styles.storeCompareTitle}>Comparativo entre Lojas</Text>
                        <Text style={styles.storeCompareSubtitle}>Ofertas registradas para este modelo</Text>
                      </View>
                    </View>

                    {storeOffers.map((oferta, idx) => {
                      const isLojaAtual = (oferta.loja || '').toLowerCase() === lojaAtual.toLowerCase();
                      const isMaisBarata = idx === 0 && oferta.preco < stats.atual;
                      const diff = oferta.preco - stats.atual;

                      return (
                        <View key={`store-${idx}-${oferta.loja}`} style={styles.storeRowCard}>
                          <View style={styles.storeRowLeft}>
                            <StoreLogoBadge storeKey={oferta.loja} size={26} style={{ marginRight: 8 }} />
                            <View>
                              <View style={styles.storeNameBadgeRow}>
                                <Text style={styles.storeRowName}>{oferta.loja}</Text>
                                {isLojaAtual && (
                                  <View style={styles.lojaAtualBadge}>
                                    <Text style={styles.lojaAtualBadgeText}>OFERTA ATUAL</Text>
                                  </View>
                                )}
                                {isMaisBarata && (
                                  <View style={styles.maisBarataBadge}>
                                    <Text style={styles.maisBarataBadgeText}>MAIS BARATO</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.storeRowDate}>Visto em {formatarDataLabel(oferta.data_registro)}</Text>
                            </View>
                          </View>

                          <View style={styles.storeRowRight}>
                            <Text style={styles.storeRowPrice}>{formatarMoeda(oferta.preco)}</Text>
                            {diff !== 0 && !isLojaAtual && (
                              <Text style={[styles.storeRowDiff, { color: diff < 0 ? '#16A34A' : '#64748B' }]}>
                                {diff < 0 ? `- ${formatarMoeda(Math.abs(diff))}` : `+ ${formatarMoeda(diff)}`}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Nota de rodapé da inteligência */}
                <View style={styles.footerDisclaimerBox}>
                  <Ionicons name="shield-checkmark" size={14} color="#64748B" style={{ marginRight: 6 }} />
                  <Text style={styles.footerDisclaimerText}>
                    O AchôAI audita e compara valores automaticamente para garantir que você nunca pague mais caro.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    minHeight: SCREEN_HEIGHT * 0.45,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },
  productSummaryCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginBottom: 14,
  },
  productThumbBox: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productThumb: {
    width: 48,
    height: 48,
  },
  productInfoBox: {
    flex: 1,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 18,
    marginBottom: 4,
  },
  productStorePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeNameText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  currentPriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF5722',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 12,
    fontWeight: '500',
  },
  novoRadarBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginVertical: 10,
  },
  novoRadarIconPill: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  novoRadarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0369A1',
    marginBottom: 6,
    textAlign: 'center',
  },
  novoRadarDesc: {
    fontSize: 12.5,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  novoRadarInfoCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    marginBottom: 16,
  },
  novoRadarInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  novoRadarInfoText: {
    fontSize: 12,
    color: '#1E293B',
  },
  novoRadarCloseBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  novoRadarCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  thermometerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  thermometerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  thermometerIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  thermometerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  thermometerDesc: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    padding: 10,
    marginBottom: 10,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 5,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  metricSubtext: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  chartSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  chartBadgeSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chartBadgeSelectedText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  chartPlotArea: {
    height: 140,
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    position: 'relative',
    marginBottom: 8,
  },
  chartGuideLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  chartScrollArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    minWidth: '100%',
    justifyContent: 'space-around',
  },
  chartBarCol: {
    alignItems: 'center',
    marginHorizontal: 8,
    height: 120,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  floatingPricePill: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    zIndex: 10,
    minWidth: 60,
  },
  floatingPricePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  floatingPricePillSub: {
    fontSize: 8,
    color: '#94A3B8',
  },
  chartBarStemBox: {
    width: 24,
    height: 85,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBarStem: {
    width: 4,
    backgroundColor: '#BFDBFE',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  chartBarStemActive: {
    backgroundColor: '#2563EB',
    width: 5,
  },
  chartBarStemLowest: {
    backgroundColor: '#86EFAC',
  },
  chartNodeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: -5,
  },
  chartNodeDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF5722',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: -6,
  },
  chartNodeDotLowest: {
    backgroundColor: '#16A34A',
  },
  chartDateLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '600',
  },
  chartDateLabelActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  chartFooterLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  chartLegendText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
  },
  storeCompareSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  storeCompareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  storeCompareIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  storeCompareTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  storeCompareSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  storeRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 8,
  },
  storeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storeNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeRowName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  lojaAtualBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
  },
  lojaAtualBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#2563EB',
  },
  maisBarataBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
  },
  maisBarataBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#16A34A',
  },
  storeRowDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  storeRowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  storeRowPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  storeRowDiff: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
  },
  footerDisclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  footerDisclaimerText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 15,
    flexShrink: 1,
  },
});
