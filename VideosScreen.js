import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Linking,
  Share,
  Animated,
  ActivityIndicator,
  StatusBar,
  Platform
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { VideoService } from './videoService';
import { formatarUrlAfiliado } from './affiliateUtils';
import { RecommendationEngine } from './recommendationService';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

// Janela deslizante de pré-carregamento dos vídeos em standby (Zero delay na troca)
const PRELOAD_AHEAD = 4;
const PRELOAD_BEHIND = 1;

// CSS com fundo transparente (evita tela preta) e oculta 100% dos spinners/emojis/botões do YouTube
const VERTICAL_PLAYER_CSS = [
  'html, body { width: 100vw !important; height: 100vh !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: transparent !important; }',
  '.container { position: absolute !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; padding-bottom: 0 !important; margin: 0 !important; overflow: hidden !important; background: transparent !important; }',
  '.video, iframe, #player { position: absolute !important; top: -8% !important; left: -25% !important; width: 150vw !important; height: 116vh !important; border: none !important; background: transparent !important; }',
  '.ytp-chrome-top, .ytp-show-cards-title, .ytp-watermark, .ytp-pause-overlay, .ytp-expand-pause-overlay, .ytp-large-play-button, .ytp-cued-thumbnail-overlay, .ytp-button.ytp-shorts-play-button, .ytp-spinner, .ytp-spinner-container, .ytp-bezel, .ytp-bezel-text, .ytp-bezel-icon, .ytp-contextmenu { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }'
].join(' ');

/**
 * Constrói o script injetado no WebView do YouTube.
 * - Suporta inicialização em standby (pré-carregado) ou reprodução ativa imediata.
 * - Conecta eventos entre Android (document) e iOS (window).
 * - Elimina qualquer spinner ou emoji de carregamento visual.
 */
function buildInjectedScript(isMuted, isActive) {
  return `
    (function() {
      window.__achoMuted = ${isMuted ? 'true' : 'false'};
      window.__isCurrentActive = ${isActive ? 'true' : 'false'};
      window.__userPaused = false;

      // 1. Estilização vertical imersiva 9:16 com fundo transparente
      function applyVerticalStyles() {
        var existing = document.getElementById('acho-vertical-style');
        if (existing) return;
        var style = document.createElement('style');
        style.id = 'acho-vertical-style';
        style.type = 'text/css';
        style.innerHTML = ${JSON.stringify(VERTICAL_PLAYER_CSS)};
        if (document.head) {
          document.head.appendChild(style);
        }
      }
      applyVerticalStyles();
      document.addEventListener('DOMContentLoaded', applyVerticalStyles);
      window.addEventListener('load', applyVerticalStyles);
      setTimeout(applyVerticalStyles, 150);
      setTimeout(applyVerticalStyles, 600);

      // 2. Ponte de comunicação unificada para Android (document) e iOS (window)
      function handleBridgeMessage(e) {
        if (!e || !e.data) return;
        try {
          var msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (window.player && typeof window.player.playVideo === 'function') {
            if (msg.eventName === 'playVideo') {
              window.__isCurrentActive = true;
              window.__userPaused = false;
              if (!window.__achoMuted) {
                try { window.player.unMute(); } catch(uErr) {}
                try { window.player.setVolume(100); } catch(vErr) {}
              }
              window.player.playVideo();
            } else if (msg.eventName === 'pauseVideo') {
              window.__isCurrentActive = false;
              window.player.pauseVideo();
            } else if (msg.eventName === 'unMuteVideo') {
              window.__achoMuted = false;
              try { window.player.unMute(); } catch(uErr) {}
              try { window.player.setVolume(100); } catch(vErr) {}
            } else if (msg.eventName === 'muteVideo') {
              window.__achoMuted = true;
              try { window.player.mute(); } catch(mErr) {}
            }
          }
        } catch(err) {}

        if (window.dispatchEvent && e.target !== window) {
          try {
            window.dispatchEvent(new MessageEvent('message', { data: e.data }));
          } catch(ex) {}
        }
      }

      document.addEventListener('message', handleBridgeMessage);
      window.addEventListener('message', handleBridgeMessage);

      // 3. Watchdog de Autoplay Imediato com Áudio e Loop Contínuo
      var tries = 0;
      var timer = setInterval(function() {
        tries++;
        if (window.player && typeof window.player.getPlayerState === 'function') {
          try {
            var state = window.player.getPlayerState();
            // Só reproduz se estiver marcado como o vídeo ATIVO e não pausado pelo usuário
            if (window.__isCurrentActive && !window.__userPaused && (state === -1 || state === 5 || (state === 2 && tries < 15))) {
              if (!window.__achoMuted) {
                try { window.player.unMute(); } catch(e1) {}
                try { window.player.setVolume(100); } catch(e2) {}
              } else {
                try { window.player.mute(); } catch(e3) {}
              }
              window.player.playVideo();
            } else if (window.__isCurrentActive && state === 0) {
              // Fim do vídeo: loop instantâneo estilo Shorts / Reels
              window.player.seekTo(0);
              window.player.playVideo();
            }
          } catch(e) {}
        }

        if (tries > 60) {
          clearInterval(timer);
        }
      }, 250);
    })();
    true;
  `;
}

/**
 * Extrai o ID de 11 caracteres do YouTube Shorts ou vídeo
 */
function extrairYoutubeId(item) {
  if (item?.youtube_id && item.youtube_id.length === 11) {
    return item.youtube_id;
  }
  const url = item?.video_url || '';
  const match = url.match(/(?:shorts\/|v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// =====================================================================
// COMPONENTE ITEM INDIVIDUAL DE VÍDEO VERTICAL (9:16)
// =====================================================================
function VideoFeedItem({
  item,
  index,
  isActive,
  isMounted,
  isScreenFocused,
  isLiked,
  onToggleLike,
  itemHeight,
  isMuted,
  onToggleMute,
}) {
  const insets = useSafeAreaInsets();
  const [userPaused, setUserPaused] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef(0);
  const playerRef = useRef(null);

  const youtubeId = extrairYoutubeId(item);

  // Reseta estado de pausa quando o usuário rola para outro vídeo
  useEffect(() => {
    if (!isActive) {
      setUserPaused(false);
    }
  }, [isActive]);

  // Incrementa contagem de visualizações atômica quando o vídeo entra em reprodução ativa
  useEffect(() => {
    if (isActive && isScreenFocused && item?.id) {
      VideoService.incrementarVisualizacao(item.id);
    }
  }, [isActive, isScreenFocused, item?.id]);

  // Script injetado atualizado dinamicamente para o vídeo ativo ou pré-carregado
  const injectedScript = useMemo(
    () => buildInjectedScript(isMuted, isActive && isScreenFocused),
    [isMuted, isActive, isScreenFocused]
  );

  // Animação de coração pulsante esmaecido estilo Instagram
  const dispararAnimacaoCoracao = () => {
    setShowHeartAnim(true);
    heartScale.setValue(0.3);
    heartOpacity.setValue(1);

    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1.35,
        friction: 3,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowHeartAnim(false);
    });
  };

  const handleAbrirProduto = async () => {
    if (!item || !item.produto_url) {
      console.warn('[VideosScreen] Produto sem URL disponível');
      return;
    }
    // Registra clique multi-sinal em oferta (peso 3)
    RecommendationEngine.registrarCliqueOferta(item.produto_titulo || item.titulo, null, item.plataforma);

    const rawUrl = String(item.produto_url).trim();
    const finalUrl = formatarUrlAfiliado(rawUrl);

    try {
      const canOpen = await Linking.canOpenURL(finalUrl);
      if (canOpen) {
        await Linking.openURL(finalUrl);
      } else {
        await WebBrowser.openBrowserAsync(finalUrl);
      }
    } catch (err) {
      try {
        await WebBrowser.openBrowserAsync(finalUrl);
      } catch (e2) {
        console.error('[VideosScreen] Erro ao abrir URL do produto:', e2);
      }
    }
  };

  // Tratamento de Toques:
  // - Double tap: Curte + Vibra com Haptics + Anima Coração + Abre o Produto Imediatamente
  // - Single tap: Pausa ou Despausa a reprodução
  const handleTap = () => {
    const now = Date.now();
    const tempoDecorrido = now - lastTapRef.current;

    if (tempoDecorrido < 350) {
      // Double tap
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {}

      if (!isLiked) {
        onToggleLike(item.id);
      }
      dispararAnimacaoCoracao();
      handleAbrirProduto();
    } else {
      // Single tap: alterna play/pause
      setUserPaused((prev) => !prev);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
    }
    lastTapRef.current = now;
  };

  const handleBotaoMudo = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    onToggleMute();
  };

  const handleCompartilhar = async () => {
    try {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
      const msg = `Olha esse achadinho que encontrei no AchôAI: ${item.produto_titulo}\\nConfira aqui: ${item.produto_url}`;
      await Share.share({
        title: item.produto_titulo,
        message: msg,
        url: item.produto_url
      });
    } catch (e) {}
  };

  const handleBotaoCurtir = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    onToggleLike(item.id);
  };

  const isShopee = (item.plataforma || '').toLowerCase().includes('shopee');
  const corPlataforma = isShopee ? '#EE4D2D' : '#FFE600';
  const corTextoPlataforma = isShopee ? '#FFFFFF' : '#2D3277';

  return (
    <View style={[styles.itemContainer, { height: itemHeight }]}>
      {/* 1. CAMADA DE VÍDEO VERTICAL 9:16 COM PRÉ-CARREGAMENTO INTELIGENTE E THUMBNAIL */}
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={StyleSheet.absoluteFill}>
          {/* Thumbnail estática imediata pré-carregada em cache (Garante zero tela preta) */}
          <Image
            source={{ uri: item.thumb_url || item.produto_imagem }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          {/* Player YouTube: Mantido montado na janela deslizante (Ativo ou Pré-carregado em standby) */}
          {isMounted && youtubeId ? (
            <View style={styles.videoCropWrapper} pointerEvents="none">
              <YoutubePlayer
                ref={playerRef}
                height={itemHeight}
                width={WINDOW_WIDTH}
                play={isActive && isScreenFocused && !userPaused}
                videoId={youtubeId}
                mute={isMuted}
                forceAndroidAutoplay={false}
                initialPlayerParams={{
                  controls: false,
                  modestbranding: true,
                  rel: false,
                  loop: true,
                  preventFullScreen: true,
                  iv_load_policy: 3,
                }}
                webViewStyle={{ backgroundColor: 'transparent' }}
                webViewProps={{
                  pointerEvents: 'none',
                  androidLayerType: 'hardware',
                  mediaPlaybackRequiresUserAction: false,
                  allowsInlineMediaPlayback: true,
                  domStorageEnabled: true,
                  javaScriptEnabled: true,
                  mixedContentMode: 'always',
                  injectedJavaScriptBeforeContentLoaded: injectedScript,
                  injectedJavaScript: injectedScript,
                }}
                onChangeState={(state) => {
                  if (state === 'ended') {
                    playerRef.current?.seekTo(0, true);
                  }
                }}
              />
            </View>
          ) : null}

          {/* Indicador de Pausa: Exibe APENAS o botão Play sutil no centro quando pausado pelo usuário */}
          {userPaused && (
            <View style={styles.pauseOverlayCenter} pointerEvents="none">
              <View style={styles.pauseCircle}>
                <Ionicons name="play" size={46} color="#FFFFFF" style={{ marginLeft: 4 }} />
              </View>
            </View>
          )}

          {/* Animação do Coração Pulsante Esmaecido estilo Instagram */}
          {showHeartAnim && (
            <View style={styles.heartAnimContainer} pointerEvents="none">
              <Animated.View
                style={[
                  styles.heartBubble,
                  {
                    transform: [{ scale: heartScale }],
                    opacity: heartOpacity,
                  },
                ]}
              >
                <Ionicons name="heart" size={96} color="#FF2D55" />
              </Animated.View>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* 2. TOP COVER BAR: BARRA NATIVA PRETA COM LOGO CENTRALIZADA ARTÍSTICA ACHÔDINHOS */}
      <View
        style={[
          styles.topCoverBar,
          { height: insets.top + 54, paddingTop: insets.top + 2 }
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.topSideEmpty} />

        <View style={styles.appBrandContainer}>
          <Ionicons name="sparkles" size={16} color="#FF5722" style={{ marginRight: 6 }} />
          <Text style={styles.appBrandTitle}>Achôdinhos</Text>
          <View style={styles.liveDot} />
        </View>

        <View style={[styles.badgeLojaMini, { backgroundColor: corPlataforma }]}>
          <Text style={[styles.badgeLojaMiniText, { color: corTextoPlataforma }]}>
            {item.plataforma || 'Shopee'}
          </Text>
        </View>
      </View>

      {/* 3. BARRA LATERAL DIREITA DE AÇÕES (CURTIR, COMPARTILHAR, MUDO) */}
      <View style={[styles.rightSideBar, { bottom: insets.bottom + 155 }]} pointerEvents="box-none">
        {/* Selo Oficial da Plataforma */}
        <View style={[styles.platformBadgeWrap, { borderColor: corPlataforma }]}>
          <Ionicons
            name={isShopee ? "bag-handle" : "cart"}
            size={22}
            color={corPlataforma}
          />
        </View>

        {/* Botão de Curtir com Contador iniciando rigorosamente em 0 */}
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={handleBotaoCurtir}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={34}
            color={isLiked ? "#FF2D55" : "#FFFFFF"}
          />
          <Text style={styles.actionText}>
            {Number(item.likes_count || 0) > 0 ? (
              Number(item.likes_count) >= 1000 ? `${(Number(item.likes_count) / 1000).toFixed(1)}k` : item.likes_count
            ) : 'Curtir'}
          </Text>
        </TouchableOpacity>

        {/* Visualizações em Tempo Real */}
        <View style={styles.actionButton}>
          <Ionicons name="eye-outline" size={28} color="#FFFFFF" />
          <Text style={styles.actionText}>
            {Number(item.visualizacoes || 0) >= 1000
              ? `${(Number(item.visualizacoes) / 1000).toFixed(1)}k`
              : (item.visualizacoes || 0)}
          </Text>
        </View>

        {/* Botão de Compartilhar */}
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={handleCompartilhar}
        >
          <Ionicons name="share-social-outline" size={30} color="#FFFFFF" />
          <Text style={styles.actionText}>Compartilhar</Text>
        </TouchableOpacity>

        {/* Botão de Mudo / Som com Estado Global Persistente */}
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={handleBotaoMudo}
        >
          <Ionicons
            name={isMuted ? "volume-mute-outline" : "volume-high-outline"}
            size={28}
            color={isMuted ? "#EF4444" : "#10B981"}
          />
          <Text style={styles.actionText}>{isMuted ? 'Mudo' : 'Som'}</Text>
        </TouchableOpacity>
      </View>

      {/* 4. CARD FLUTUANTE DE PRODUTO NO RODAPÉ COM REDIRECIONAMENTO DIRETO */}
      <View style={[styles.bottomContainer, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <View style={styles.authorRow}>
          <Ionicons name="sparkles" size={14} color="#F59E0B" style={{ marginRight: 5 }} />
          <Text style={styles.authorName} numberOfLines={1}>
            Achadinho Exclusivo • {item.plataforma || 'Shopee'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.productCard}
          activeOpacity={0.9}
          onPress={handleAbrirProduto}
        >
          <Image
            source={{ uri: item.produto_imagem || item.thumb_url }}
            style={styles.productThumb}
            resizeMode="cover"
          />

          <View style={styles.productInfo}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.produto_titulo}
            </Text>

            <View style={styles.priceRow}>
              <Text style={styles.productPrice}>
                {item.produto_preco > 0
                  ? `R$ ${item.produto_preco.toFixed(2).replace('.', ',')}`
                  : 'Ver Preço'}
              </Text>

              {item.produto_desconto_pct > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{item.produto_desconto_pct}% OFF</Text>
                </View>
              )}
            </View>

            <View style={styles.badgesRow}>
              {item.frete_gratis ? (
                <View style={styles.freeShippingBadge}>
                  <Ionicons name="flash" size={11} color="#00A650" />
                  <Text style={styles.freeShippingText}>
                    {isShopee ? 'Frete Grátis disponível' : 'Frete Grátis'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.storeNameText}>{item.plataforma}</Text>
              )}
            </View>
          </View>

          {/* Botão de Ver Produto */}
          <TouchableOpacity
            style={[styles.buyBtn, { backgroundColor: isShopee ? '#EE4D2D' : '#2D3277' }]}
            activeOpacity={0.7}
            onPress={handleAbrirProduto}
          >
            <Text style={styles.buyBtnText}>Comprar</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =====================================================================
// TELA PRINCIPAL DO FEED DE VÍDEOS (ACHÔDINHOS REELS / TIKTOK)
// =====================================================================
export default function VideosScreen({ navigation }) {
  const isFocused = useIsFocused();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [likedVideoIds, setLikedVideoIds] = useState(new Set());
  const [containerHeight, setContainerHeight] = useState(WINDOW_HEIGHT);

  // ESTADO GLOBAL DE SOM: Inicia LIGADO (false = desmutado) e persiste por todas as rolagens!
  const [isGlobalMuted, setIsGlobalMuted] = useState(false);
  const handleToggleGlobalMute = useCallback(() => {
    setIsGlobalMuted((prev) => !prev);
  }, []);

  const flatListRef = useRef(null);

  // Carrega vídeos de forma randomizada e curtidas do usuário
  const carregarFeed = useCallback(async (force = false) => {
    try {
      if (force) setRefreshing(true);
      const [listaVideos, idsCurtidos] = await Promise.all([
        VideoService.carregarVideos(force),
        VideoService.getVideosCurtidosIds()
      ]);
      setVideos(listaVideos);
      setLikedVideoIds(idsCurtidos);
    } catch (e) {
      console.warn('[VideosScreen] Erro ao carregar feed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregarFeed(false);
  }, [carregarFeed]);

  // Pré-aquecimento das thumbnails dos primeiros 15 vídeos na memória nativa
  useEffect(() => {
    if (Array.isArray(videos) && videos.length > 0) {
      videos.slice(0, 15).forEach((v) => {
        const img = v.thumb_url || v.produto_imagem;
        if (img) {
          Image.prefetch(img).catch(() => {});
        }
      });
    }
  }, [videos]);

  // Alterna like com persistência
  const handleToggleLike = async (videoId) => {
    setLikedVideoIds((prev) => {
      const next = new Set(prev);
      const isAlready = next.has(videoId);
      if (isAlready) next.delete(videoId);
      else next.add(videoId);
      return next;
    });

    setVideos((prevVideos) =>
      prevVideos.map((v) => {
        if (v.id === videoId) {
          const ja = likedVideoIds.has(videoId);
          return {
            ...v,
            likes_count: Math.max(0, (v.likes_count || 0) + (ja ? -1 : 1))
          };
        }
        return v;
      })
    );

    const videoAtual = videos.find((v) => v.id === videoId);
    await VideoService.alternarLike(videoId, videoAtual?.likes_count || 0);

    // Registra sinal de interesse multi-sinal por vídeo curtido (peso 4)
    if (!likedVideoIds.has(videoId)) {
      const termoInteresse = videoAtual?.produto_titulo || videoAtual?.titulo || '';
      if (termoInteresse) {
        RecommendationEngine.registrarVideoLike(termoInteresse, null, videoAtual?.plataforma);
      }
    }
  };

  // Gerenciamento de visibilidade por rolagem (Viewability)
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      const firstVisible = viewableItems[0];
      if (firstVisible && typeof firstVisible.index === 'number') {
        setActiveVideoIndex(firstVisible.index);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 65,
  }).current;

  const getItemLayout = useCallback(
    (_, index) => ({
      length: containerHeight,
      offset: containerHeight * index,
      index,
    }),
    [containerHeight]
  );

  return (
    <View
      style={styles.screen}
      onLayout={(e) => {
        const { height } = e.nativeEvent.layout;
        if (height > 0 && height !== containerHeight) {
          setContainerHeight(height);
        }
      }}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#EE4D2D" />
          <Text style={styles.loadingText}>Carregando Achôdinhos...</Text>
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="videocam-off-outline" size={56} color="#64748B" />
          <Text style={styles.emptyTitle}>Nenhum vídeo disponível no momento</Text>
          <Text style={styles.emptySubtitle}>Puxe para baixo para atualizar</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => carregarFeed(true)}>
            <Text style={styles.retryBtnText}>Atualizar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={videos}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <VideoFeedItem
              item={item}
              index={index}
              isActive={index === activeVideoIndex}
              isMounted={index >= activeVideoIndex - PRELOAD_BEHIND && index <= activeVideoIndex + PRELOAD_AHEAD}
              isScreenFocused={isFocused}
              isLiked={likedVideoIds.has(item.id)}
              onToggleLike={handleToggleLike}
              itemHeight={containerHeight}
              isMuted={isGlobalMuted}
              onToggleMute={handleToggleGlobalMute}
            />
          )}
          pagingEnabled={false}
          snapToInterval={containerHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum={true}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={getItemLayout}
          refreshing={refreshing}
          onRefresh={() => carregarFeed(true)}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={9}
          removeClippedSubviews={false}
        />
      )}
    </View>
  );
}

// =====================================================================
// ESTILOS
// =====================================================================
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  itemContainer: {
    width: WINDOW_WIDTH,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  videoCropWrapper: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: '#EE4D2D',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  pauseOverlayCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 95,
  },
  pauseCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  heartAnimContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  heartBubble: {
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  topCoverBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    zIndex: 100,
    elevation: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSideEmpty: {
    width: 65,
  },
  appBrandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginLeft: 8,
  },
  appBrandTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  badgeLojaMini: {
    minWidth: 65,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeLojaMiniText: {
    fontSize: 11,
    fontWeight: '800',
  },
  rightSideBar: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 16,
    zIndex: 30,
  },
  platformBadgeWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 4,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 100,
    elevation: 30,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 35,
  },
  productThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  productInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 17,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  discountBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  freeShippingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  freeShippingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00A650',
  },
  storeNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 2,
  },
  buyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
});
