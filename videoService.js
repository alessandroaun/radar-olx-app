import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const STORAGE_KEYS = {
  CACHED_VIDEOS: "@achoai_cached_videos_feed_v11",
  LIKED_VIDEOS: "@achoai_liked_videos_ids_v11",
  LAST_UPDATE: "@achoai_videos_last_update_v11"
};

// Set em memória para evitar contabilizar visualização duplicada do mesmo vídeo na mesma sessão
const visualizadosNestaSessao = new Set();

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Organiza o feed de forma intercalada perfeita:
 * 2 vídeos da Shopee seguidos de 1 vídeo do Mercado Livre (2 Shopee -> 1 ML -> 2 Shopee -> 1 ML...),
 * garantindo aleatoriedade interna e ZERO vídeos duplicados.
 */
function organizarFeedIntercalado(lista, idsExistentes = new Set(), urlsExistentes = new Set()) {
  if (!Array.isArray(lista) || lista.length === 0) return [];

  const shopeeVideos = [];
  const mlVideos = [];
  const seenIds = new Set(idsExistentes);
  const seenUrls = new Set(urlsExistentes);

  for (const item of lista) {
    if (!item) continue;
    const vId = item.id != null ? item.id : item.post_id;
    const vUrl = (item.video_url || '').trim();

    // Deduplicação estrita: ignora se ID ou URL já foram adicionados
    if (vId && seenIds.has(vId)) continue;
    if (vUrl && seenUrls.has(vUrl)) continue;

    if (vId) seenIds.add(vId);
    if (vUrl) seenUrls.add(vUrl);

    const plat = (item.plataforma || '').toLowerCase();
    const url = (item.produto_url || item.video_url || '').toLowerCase();
    const isML = plat.includes('mercado') || url.includes('mercadolivre') || (item.post_id || '').startsWith('ml_');

    if (isML) {
      mlVideos.push(item);
    } else {
      shopeeVideos.push(item);
    }
  }

  // Embaralha de forma independente cada grupo para garantir aleatoriedade
  const shopeeShuffled = shuffleArray(shopeeVideos);
  const mlShuffled = shuffleArray(mlVideos);

  if (mlShuffled.length === 0) return shopeeShuffled;
  if (shopeeShuffled.length === 0) return mlShuffled;

  const resultado = [];
  let idxShopee = 0;
  let idxML = 0;

  // Intercala com rigor: 2 Shopee -> 1 Mercado Livre -> 2 Shopee -> 1 Mercado Livre...
  while (idxShopee < shopeeShuffled.length || idxML < mlShuffled.length) {
    // 1º da Shopee
    if (idxShopee < shopeeShuffled.length) {
      resultado.push(shopeeShuffled[idxShopee++]);
    }
    // 2º da Shopee
    if (idxShopee < shopeeShuffled.length) {
      resultado.push(shopeeShuffled[idxShopee++]);
    }
    // 1º do Mercado Livre
    if (idxML < mlShuffled.length) {
      resultado.push(mlShuffled[idxML++]);
    }
  }

  return resultado;
}

export class VideoService {
  static shopeeOffset = 0;
  static mlOffset = 0;
  static idsExibidos = new Set();
  static urlsExibidas = new Set();

  /**
   * Reseta o cursor de paginação (usado no pull-to-refresh)
   */
  static resetarPaginacao() {
    VideoService.shopeeOffset = 0;
    VideoService.mlOffset = 0;
    VideoService.idsExibidos.clear();
    VideoService.urlsExibidas.clear();
  }

  /**
   * Obtém vídeos salvos em cache para inicialização ultrarrápida (0ms)
   */
  static async obterCacheInicial() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_VIDEOS);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return [];
  }

  /**
   * Carrega lote paginado do Supabase com proporção exata de 2 Shopee : 1 Mercado Livre.
   * Totalmente contínuo: nunca para de carregar ao rolar a tela, sem duplicatas.
   */
  static async carregarLoteVideos({
    tamanhoShopee = 30,
    tamanhoML = 15,
    isInitial = false
  } = {}) {
    if (isInitial) {
      VideoService.resetarPaginacao();
    }

    try {
      const sStart = VideoService.shopeeOffset;
      const sEnd = sStart + tamanhoShopee - 1;
      const mStart = VideoService.mlOffset;
      const mEnd = mStart + tamanhoML - 1;

      // Busca simultânea no Supabase das duas plataformas para manter proporção 2:1 exata
      const [shopeeRes, mlRes] = await Promise.all([
        supabase
          .from("videos_feed")
          .select("*")
          .eq("ativo", true)
          .neq("plataforma", "Mercado Livre")
          .order("created_at", { ascending: false })
          .range(sStart, sEnd),
        supabase
          .from("videos_feed")
          .select("*")
          .eq("ativo", true)
          .eq("plataforma", "Mercado Livre")
          .order("created_at", { ascending: false })
          .range(mStart, mEnd)
      ]);

      let listaShopee = shopeeRes.data || [];
      let listaML = mlRes.data || [];

      // Se acabaram os vídeos da Shopee a partir do offset atual, faz loop contínuo do início
      if (listaShopee.length === 0 && sStart > 0) {
        VideoService.shopeeOffset = 0;
        const retryShopee = await supabase
          .from("videos_feed")
          .select("*")
          .eq("ativo", true)
          .neq("plataforma", "Mercado Livre")
          .order("created_at", { ascending: false })
          .range(0, tamanhoShopee - 1);
        listaShopee = retryShopee.data || [];
        VideoService.shopeeOffset = listaShopee.length;
      } else {
        VideoService.shopeeOffset += listaShopee.length;
      }

      // Se acabaram os vídeos do Mercado Livre a partir do offset atual, faz loop contínuo do início
      if (listaML.length === 0 && mStart > 0) {
        VideoService.mlOffset = 0;
        const retryML = await supabase
          .from("videos_feed")
          .select("*")
          .eq("ativo", true)
          .eq("plataforma", "Mercado Livre")
          .order("created_at", { ascending: false })
          .range(0, tamanhoML - 1);
        listaML = retryML.data || [];
        VideoService.mlOffset = listaML.length;
      } else {
        VideoService.mlOffset += listaML.length;
      }

      // Filtra duplicatas globais da sessão antes de intercalar
      const shopeeNaoVistos = listaShopee.filter(
        v => !VideoService.idsExibidos.has(v.id) && (!v.video_url || !VideoService.urlsExibidas.has(v.video_url))
      );
      const mlNaoVistos = listaML.filter(
        v => !VideoService.idsExibidos.has(v.id) && (!v.video_url || !VideoService.urlsExibidas.has(v.video_url))
      );

      // Embaralha cada plataforma separadamente
      const shopeeShuffled = shuffleArray(shopeeNaoVistos.length > 0 ? shopeeNaoVistos : listaShopee);
      const mlShuffled = shuffleArray(mlNaoVistos.length > 0 ? mlNaoVistos : listaML);

      // Intercala 2 Shopee : 1 Mercado Livre
      const loteIntercalado = [];
      let idxS = 0;
      let idxM = 0;

      while (idxS < shopeeShuffled.length || idxM < mlShuffled.length) {
        if (idxS < shopeeShuffled.length) {
          const item = shopeeShuffled[idxS++];
          if (!VideoService.idsExibidos.has(item.id)) {
            VideoService.idsExibidos.add(item.id);
            if (item.video_url) VideoService.urlsExibidas.add(item.video_url);
            loteIntercalado.push(item);
          }
        }
        if (idxS < shopeeShuffled.length) {
          const item = shopeeShuffled[idxS++];
          if (!VideoService.idsExibidos.has(item.id)) {
            VideoService.idsExibidos.add(item.id);
            if (item.video_url) VideoService.urlsExibidas.add(item.video_url);
            loteIntercalado.push(item);
          }
        }
        if (idxM < mlShuffled.length) {
          const item = mlShuffled[idxM++];
          if (!VideoService.idsExibidos.has(item.id)) {
            VideoService.idsExibidos.add(item.id);
            if (item.video_url) VideoService.urlsExibidas.add(item.video_url);
            loteIntercalado.push(item);
          }
        }
      }

      // Persiste cache leve para inicialização imediata
      if (isInitial && loteIntercalado.length > 0) {
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.CACHED_VIDEOS, JSON.stringify(loteIntercalado.slice(0, 30)));
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_UPDATE, String(Date.now()));
        } catch (_) {}
      }

      return loteIntercalado;
    } catch (e) {
      console.warn("[VideoService] Erro ao carregar lote de vídeos:", e);
      return [];
    }
  }

  /**
   * Método de compatibilidade: carrega o lote inicial do feed
   */
  static async carregarVideos(forceRefresh = false) {
    return VideoService.carregarLoteVideos({ isInitial: true });
  }

  /**
   * Obtém o conjunto de IDs de vídeos que este aparelho já curtiu
   */
  static async getVideosCurtidosIds() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.LIKED_VIDEOS);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  /**
   * Incrementa contagem de visualização atômica no Supabase
   */
  static async incrementarVisualizacao(videoId) {
    if (!videoId || visualizadosNestaSessao.has(videoId)) return;
    visualizadosNestaSessao.add(videoId);

    try {
      await supabase.rpc("incrementar_views_video", { video_id: videoId });
    } catch (e) {
      // Falha silenciosa para não travar a UI
    }
  }

  /**
   * Alterna curtida (like/unlike) com persistência local e atualização atômica no Supabase
   */
  static async alternarLike(videoId, likesAtual = 0) {
    try {
      const likedIds = await this.getVideosCurtidosIds();
      const jaCurtiu = likedIds.has(videoId);

      let delta = 1;
      let novoLiked = true;

      if (jaCurtiu) {
        likedIds.delete(videoId);
        delta = -1;
        novoLiked = false;
      } else {
        likedIds.add(videoId);
        delta = 1;
        novoLiked = true;
      }

      // Persiste no aparelho
      await AsyncStorage.setItem(STORAGE_KEYS.LIKED_VIDEOS, JSON.stringify([...likedIds]));

      // Atualiza no Supabase via RPC atômica
      let novoTotalLikes = Math.max(0, likesAtual + delta);
      try {
        const { data: resRpc, error: errRpc } = await supabase.rpc("alterar_likes_video", {
          video_id: videoId,
          delta: delta
        });
        if (!errRpc && typeof resRpc === "number") {
          novoTotalLikes = resRpc;
        }
      } catch (eRpc) {
        supabase.from("videos_feed").update({ likes_count: novoTotalLikes }).eq("id", videoId).catch(() => {});
      }

      return {
        liked: novoLiked,
        novoTotalLikes: novoTotalLikes
      };
    } catch (e) {
      console.warn("[VideoService] Erro ao alternar like:", e);
      return { liked: false, novoTotalLikes: likesAtual };
    }
  }
}

export default VideoService;
