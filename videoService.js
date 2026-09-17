import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const STORAGE_KEYS = {
  CACHED_VIDEOS: "@achoai_cached_videos_feed_v10",
  LIKED_VIDEOS: "@achoai_liked_videos_ids_v10",
  LAST_UPDATE: "@achoai_videos_last_update_v10"
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

export class VideoService {
  /**
   * Carrega os vídeos ativos da tabela videos_feed no Supabase de forma randomizada/aleatória
   */
  static async carregarVideos(forceRefresh = false) {
    try {
      if (!forceRefresh) {
        try {
          const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_VIDEOS);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return shuffleArray(parsed);
            }
          }
        } catch (_) {}
      }

      const { data, error } = await supabase
        .from("videos_feed")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) {
        console.warn("[VideoService] Erro ao carregar vídeos:", error);
        return [];
      }

      const lista = data || [];
      if (lista.length > 0) {
        // Salva apenas uma fatia leve de inicialização rápida (máx 40 vídeos) em cache local
        // para nunca exceder o limite de armazenamento do SQLite no Android
        try {
          const fatiaLeve = lista.slice(0, 40);
          await AsyncStorage.setItem(STORAGE_KEYS.CACHED_VIDEOS, JSON.stringify(fatiaLeve));
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_UPDATE, String(Date.now()));
        } catch (cacheErr) {
          console.warn("[VideoService] Falha não-bloqueante ao salvar cache de vídeos:", cacheErr);
          try { await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_VIDEOS); } catch (_) {}
        }
      }
      return shuffleArray(lista);
    } catch (e) {
      console.warn("[VideoService] Exceção ao consultar vídeos:", e);
      return [];
    }
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
