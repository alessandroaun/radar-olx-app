import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "react-native";
import { supabase } from "./supabase";

// =====================================================================
// AchôAI - Motor de Recomendações Dinâmico & Inteligente (100% Banco de Dados)
// =====================================================================

const STORAGE_KEYS = {
  USER_INTERESTS: "@achoai_device_user_interests_v9",
  STORE_INTERESTS: "@achoai_device_store_interests_v9",
  CACHED_RECS: "@achoai_cached_recommendations_v9",
  LAST_UPDATE: "@achoai_last_rec_update_timestamp_v9",
  FIRST_RUN_DONE: "@achoai_first_recommendation_sweep_done_v9",
  CACHED_PROMOS: "@achoai_home_promotions_v9",
  LAST_PROMO_UPDATE: "@achoai_home_promotions_timestamp_v9",
  FIRST_HOME_SWEEP: "@achoai_first_home_sweep_done_v9"
};

// Intervalo de renovação horária para promoções da Home (1 hora)
const CICLO_PROMOCOES_MS = 60 * 60 * 1000;

// Intervalo de renovação automatizada (6 horas)
const CICLO_ATUALIZACAO_MS = 6 * 60 * 60 * 1000;

// Lojas oficiais de varejo (OLX e Facebook EXCLUÍDOS permanentemente)
export const LOJAS_RECOMENDACOES = [
  "Mercado Livre",
  "Shopee",
  "Amazon",
  "Magalu",
  "KaBuM!",
  "Americanas",
  "Casas Bahia",
  "Fast Shop",
  "Carrefour",
  "SHEIN"
];

function roundPrice(val) { return Math.round(val * 100) / 100; }

/**
 * Regras Estritas de Frete Grátis por Plataforma:
 * - Shopee & SHEIN: Todos com "Frete Grátis c/ cupom"
 * - Mercado Livre: Full, Oferta Relâmpago ou Preço >= R$ 79 -> "Frete Grátis"
 * - Amazon: Prime ou Preço >= R$ 129 -> "Frete Grátis"
 * - Magalu, Casas Bahia, Fast Shop, Carrefour e KaBuM!: NÃO colocar frete grátis a menos que venha expressamente do scraping/API
 */
export function calcularFreteGratisInfo(loja = "", preco = 0, ribbon = "", titulo = "") {
  const l = (loja || "").toLowerCase();
  const p = parseFloat(preco) || 0;
  const textCheck = ((ribbon || "") + " " + (titulo || "")).toLowerCase();
  const explicitFrete = textCheck.includes("frete grátis") || textCheck.includes("frete gratis");

  // 1. Shopee e SHEIN: Todos os produtos com "Frete Grátis c/ cupom"
  if (l.includes("shopee") || l.includes("shein")) {
    return { temFreteGratis: true, freteLabel: "Frete Grátis c/ cupom", isCupom: true };
  }

  // 2. Mercado Livre: Full, Oferta Relâmpago ou preço >= 79
  if (l.includes("mercado") || l.includes("meli")) {
    if (explicitFrete || p >= 79.0 || textCheck.includes("full") || textCheck.includes("relâmpago") || textCheck.includes("relampago") || textCheck.includes("dia")) {
      return { temFreteGratis: true, freteLabel: "Frete Grátis", isCupom: false };
    }
    return { temFreteGratis: false, freteLabel: null, isCupom: false };
  }

  // 3. Amazon: Prime ou preço >= 129
  if (l.includes("amazon")) {
    if (explicitFrete || p >= 129.0 || textCheck.includes("prime")) {
      return { temFreteGratis: true, freteLabel: "Frete Grátis", isCupom: false };
    }
    return { temFreteGratis: false, freteLabel: null, isCupom: false };
  }

  // 4. Magalu, Casas Bahia, Fast Shop, Carrefour e KaBuM: SOMENTE se explicitamente vier do scraping
  if (explicitFrete) {
    return { temFreteGratis: true, freteLabel: "Frete Grátis", isCupom: false };
  }

  return { temFreteGratis: false, freteLabel: null, isCupom: false };
}

export function calcularFreteGratis(loja, preco, ribbon = "", titulo = "") {
  return calcularFreteGratisInfo(loja, preco, ribbon, titulo).temFreteGratis;
}

export function calcularParcelamento(preco) {
  const p = parseFloat(preco) || 0;
  if (p <= 0) return null;
  if (p < 30) return "no Pix ou Boleto";
  let parcelas = 10;
  if (p < 80) parcelas = 2;
  else if (p < 150) parcelas = 3;
  else if (p < 250) parcelas = 6;
  else if (p < 500) parcelas = 8;
  else parcelas = 10;

  const valorParcela = (p / parcelas).toFixed(2).replace('.', ',');
  return `no Pix ou em até ${parcelas}x de R$ ${valorParcela} sem juros`;
}
export class RecommendationEngine {
  /**
   * Registra interação do usuário com pesos calibrados de acordo com as regras de afinidade:
   * - Radar Criado = +20 (máxima intenção de compra)
   * - Favorito Marcado = +10 (forte afinidade de interesse)
   * - Busca Realizada = +6 (interesse ativo de busca)
   * - Clique em Oferta = +3 (curiosidade de navegação)
   * Também rastreia a loja interagida para dar peso à loja sem excluir as demais lojas.
   */
  static async registrarInteracao(termo, peso = 3, origem = 'clique', usuarioId = null, loja = null) {
    if (!termo || typeof termo !== "string") return;
    const clean = termo.trim().toLowerCase();
    if (clean.length < 3) return;

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_INTERESTS);
      const interesses = raw ? JSON.parse(raw) : {};

      const stopWords = ['para', 'com', 'sem', 'de', 'da', 'do', 'em', 'um', 'uma', 'kit', 'pro', 'original', 'novo', 'versao', 'global'];
      const palavras = clean.split(/[\s,.-]+/).filter(w => w.length >= 3 && !stopWords.includes(w));

      for (const p of palavras) {
        interesses[p] = (interesses[p] || 0) + peso;
      }

      await AsyncStorage.setItem(STORAGE_KEYS.USER_INTERESTS, JSON.stringify(interesses));

      // Se informou loja, registra afinidade por essa loja
      if (loja) {
        await this.registrarAfinidadeLoja(loja, peso);
      }

      // Sincronização não-bloqueante com a tabela usuario_interesses no Supabase
      const uId = usuarioId || (await AsyncStorage.getItem('@radar_device_id'));
      if (uId) {
        try {
          await supabase.from("usuario_interesses").upsert({
            usuario_id: uId,
            termo: clean.slice(0, 60),
            peso: peso,
            origem: origem,
            updated_at: new Date().toISOString()
          }, { onConflict: 'usuario_id,termo' });
          
          // Dispara ignição não-bloqueante no backend para o robô de recomendações
          this.solicitarVarreduraRecomendacoes(clean, uId).catch(() => {});
        } catch (eSupabase) {
          // Captura silenciosa caso a tabela ainda não tenha sido criada no Supabase
        }
      }
    } catch (e) {
      console.warn("[RecEngine] Erro ao registrar interesse:", e);
    }
  }

  static async registrarAfinidadeLoja(loja, peso = 5) {
    if (!loja || typeof loja !== "string") return;
    try {
      const lojaNorm = this.identificarLojaPorUrl(loja) || loja.trim();
      if (!lojaNorm || lojaNorm === "Loja Parceira") return;
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.STORE_INTERESTS);
      const storeMap = raw ? JSON.parse(raw) : {};
      storeMap[lojaNorm] = (storeMap[lojaNorm] || 0) + peso;
      await AsyncStorage.setItem(STORAGE_KEYS.STORE_INTERESTS, JSON.stringify(storeMap));
    } catch (e) {
      // Silencioso
    }
  }

  static async getTopLojas() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.STORE_INTERESTS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  // Atalhos semânticos calibrados por prioridade
  static async registrarRadar(termo, usuarioId = null, loja = null) {
    return this.registrarInteracao(termo, 20, 'radar', usuarioId, loja);
  }

  static async registrarPesquisaOuRadar(termo, usuarioId = null, loja = null) {
    return this.registrarInteracao(termo, 20, 'radar', usuarioId, loja);
  }

  static async registrarFavorito(termo, usuarioId = null, loja = null) {
    return this.registrarInteracao(termo, 10, 'favorito', usuarioId, loja);
  }

  static async registrarBusca(termo, usuarioId = null, loja = null) {
    return this.registrarInteracao(termo, 6, 'busca', usuarioId, loja);
  }

  static async registrarClique(termo, usuarioId = null, loja = null) {
    return this.registrarInteracao(termo, 3, 'clique', usuarioId, loja);
  }

  /**
   * Obtém as palavras de interesse com maior pontuação neste aparelho
   */
  static async getTopInteresses(limit = 12) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_INTERESTS);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  /**
   * Dispara sinal para o back-end realizar varredura de recomendações a cada 6 horas ou imediata
   */
  static async solicitarVarreduraRecomendacoes(termosPrioritarios = "", usuarioId = null) {
    try {
      const { data: monitores } = await supabase
        .from("monitores")
        .select("id")
        .eq("modo", "recomendacoes")
        .limit(1);

      if (monitores && monitores.length > 0) {
        const payload = { forcar_teste: true, ativo: true };
        const uId = usuarioId || (await AsyncStorage.getItem('@radar_device_id'));
        if (termosPrioritarios || uId) {
          payload.palavras = JSON.stringify({ termos: termosPrioritarios || "", usuario_id: uId || "" });
        }
        await supabase.from("monitores").update(payload).eq("id", monitores[0].id);
        console.log("[RecEngine] Varredura de recomendações disparada no backend via monitor:", monitores[0].id);
      }
    } catch (e) {
      console.warn("[RecEngine] Aviso ao solicitar varredura de recomendações:", e);
    }
  }

  static identificarLojaPorUrl(url = "") {
    const u = url.toLowerCase();
    if (u.includes("mercadolivre")) return "Mercado Livre";
    if (u.includes("shopee")) return "Shopee";
    if (u.includes("amazon")) return "Amazon";
    if (u.includes("magazineluiza") || u.includes("magalu")) return "Magalu";
    if (u.includes("kabum")) return "KaBuM!";
    if (u.includes("americanas")) return "Americanas";
    if (u.includes("casasbahia")) return "Casas Bahia";
    if (u.includes("fastshop")) return "Fast Shop";
    if (u.includes("carrefour")) return "Carrefour";
    if (u.includes("shein")) return "SHEIN";
    return "Loja Parceira";
  }

  static extrairDescontoPct(item) {
    if (item.desconto_pct) return Number(item.desconto_pct);
    const str = `${item.title || ""} ${item.desconto || ""}`;
    const match = str.match(/(\d+)\s*%\s*(?:off|desconto)/i) || str.match(/-\s*(\d+)\s*%/);
    if (match) return parseInt(match[1], 10);
    const seed = String(item.id || item.title || "");
    const hash = seed.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return 15 + (hash % 26);
  }

  static gerarUrlBuscaLoja(loja = "", termo = "") {
    const query = encodeURIComponent((termo || "").trim());
    const l = (loja || "").toLowerCase();
    if (l.includes("shopee")) return `https://shopee.com.br/search?keyword=${query}`;
    if (l.includes("mercado") || l.includes("meli")) return `https://lista.mercadolivre.com.br/${query}`;
    if (l.includes("amazon")) return `https://www.amazon.com.br/s?k=${query}`;
    if (l.includes("magalu") || l.includes("magazine")) return `https://www.magazineluiza.com.br/busca/${query}/`;
    if (l.includes("kabum")) return `https://www.kabum.com.br/busca/${query}`;
    if (l.includes("fast")) return `https://www.fastshop.com.br/web/s/${query}`;
    if (l.includes("casas") || l.includes("bahia")) return `https://www.casasbahia.com.br/${query}/b`;
    if (l.includes("americanas")) return `https://www.americanas.com.br/busca/${query}`;
    if (l.includes("carrefour")) return `https://www.carrefour.com.br/busca/${query}`;
    if (l.includes("shein")) return `https://br.shein.com/pdsearch/${query}`;
    return `https://www.google.com/search?q=${query}+comprar`;
  }

  /**
   * Carrega recomendações 100% DINÂMICAS DO BANCO DE DADOS (Supabase).
   * - Motivos Padronizados e Claros:
   *   "Indicado para você porque você rastreou por isso"
   *   "Indicado para você porque você pesquisou por isso"
   *   "Indicado para você porque você curtiu itens desse tipo"
   *   "Indicado para você porque você prefere esta loja"
   * - Sem produtos fixados no topo 1.
   * - Sem jargões de promoção (exclusivo para motivos de indicação).
   * - Diversificação total de lojas (Magalu, Mercado Livre, Shopee, Amazon, Casas Bahia, Carrefour, KaBuM!, SHEIN).
   * - Ponderação de afinidade por loja: a loja que o usuário mais interage ganha destaque, mantendo a grade completa.
   */
  static async carregarRecomendacoes(forceRefresh = false, usuarioId = null) {
    try {
      const now = Date.now();
      const lastUpdateRaw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_UPDATE);
      const lastUpdate = lastUpdateRaw ? parseInt(lastUpdateRaw, 10) : 0;
      const deveRenovarCiclo6h = (now - lastUpdate) >= CICLO_ATUALIZACAO_MS;

      if (deveRenovarCiclo6h) {
        this.solicitarVarreduraRecomendacoes();
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_UPDATE, String(now));
      }

      // 1. Tenta carregar do cache local primeiro para exibição imediata (0ms)
      if (!forceRefresh && !deveRenovarCiclo6h) {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_RECS);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }

      const uId = usuarioId || (await AsyncStorage.getItem('@radar_device_id'));

      // 2. Consulta os RADARES ATIVOS do usuário no Supabase
      let radaresUsuario = [];
      if (uId) {
        try {
          const { data: meusMonitores } = await supabase
            .from("monitores")
            .select("id, produto, palavras, nome, plataforma")
            .eq("usuario_id", uId)
            .not("modo", "in", '("promocoes","recomendacoes")');
          if (meusMonitores && meusMonitores.length > 0) {
            radaresUsuario = meusMonitores;
          }
        } catch (e) {
          console.warn("[RecEngine] Erro ao consultar monitores do usuário:", e);
        }
      }

      // 3. Monta o mapa de afinidade por termos (+20) e por lojas (+25)
      const interessesMap = await this.getTopInteresses();
      const storeInterestsMap = await this.getTopLojas();

      const radarKeywords = new Set();
      for (const radar of radaresUsuario) {
        const prod = (radar.produto || radar.nome || "").toLowerCase();
        const palavras = prod.split(/[\s,.-]+/).filter(w => w.length >= 3 && !['para', 'com', 'sem', 'de', 'da', 'do', 'pro', 'max', '1tb', '256gb', 'novo'].includes(w));
        for (const p of palavras) {
          radarKeywords.add(p);
          interessesMap[p] = (interessesMap[p] || 0) + 20;
        }

        // Extrai preferências de loja dos radares ativos
        const platStr = (radar.plataforma || "").toUpperCase();
        if (platStr.includes("SHOPEE")) storeInterestsMap["Shopee"] = (storeInterestsMap["Shopee"] || 0) + 25;
        if (platStr.includes("MERCADO") || platStr.includes("MELI")) storeInterestsMap["Mercado Livre"] = (storeInterestsMap["Mercado Livre"] || 0) + 25;
        if (platStr.includes("MAGALU")) storeInterestsMap["Magalu"] = (storeInterestsMap["Magalu"] || 0) + 25;
        if (platStr.includes("AMAZON")) storeInterestsMap["Amazon"] = (storeInterestsMap["Amazon"] || 0) + 25;
        if (platStr.includes("CASAS") || platStr.includes("BAHIA")) storeInterestsMap["Casas Bahia"] = (storeInterestsMap["Casas Bahia"] || 0) + 25;
        if (platStr.includes("KABUM")) storeInterestsMap["KaBuM!"] = (storeInterestsMap["KaBuM!"] || 0) + 25;
        if (platStr.includes("SHEIN")) storeInterestsMap["SHEIN"] = (storeInterestsMap["SHEIN"] || 0) + 25;
        if (platStr.includes("CARREFOUR")) storeInterestsMap["Carrefour"] = (storeInterestsMap["Carrefour"] || 0) + 25;
      }

      const termosInteresse = Object.keys(interessesMap);
      const temInteresses = termosInteresse.length > 0;

      // 4. Busca os produtos EXCLUSIVAMENTE deste usuário na tabela recomendacao_resultados:
      let resultadosRec = [];
      if (uId) {
        try {
          const { data: resRec, error: errRec } = await supabase
            .from("recomendacao_resultados")
            .select("*")
            .eq("usuario_id", uId)
            .not("imagem_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(400);
          if (!errRec && resRec) resultadosRec = resRec;
        } catch (eRec) {
          console.warn("[RecEngine] Aviso ao consultar recomendacao_resultados:", eRec);
        }
      }

      // B) Resultados gerados para os radares específicos do usuário
      const radarIds = radaresUsuario.map(r => r.id);
      let resultadosRadares = [];
      if (radarIds.length > 0) {
        try {
          const { data: resRadares } = await supabase
            .from("resultados")
            .select("*")
            .in("monitor_id", radarIds)
            .not("imagem_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(100);
          if (resRadares) resultadosRadares = resRadares;
        } catch (eRad) {
          console.warn("[RecEngine] Aviso ao consultar resultados dos radares:", eRad);
        }
      }

      const temRecomendacoesPersonalizadas = (resultadosRec.length > 0 || resultadosRadares.length > 0);
      let candidatos = [];

      if (temRecomendacoesPersonalizadas) {
        candidatos = [...resultadosRec, ...resultadosRadares];
      } else {
        // Usuário novo ou sem interações: exibe ~100 produtos da aba principal (resultados) de forma aleatória
        try {
          const { data: resPadrao } = await supabase
            .from("resultados")
            .select("*")
            .not("imagem_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(300);

          if (resPadrao && resPadrao.length > 0) {
            const retailOnly = resPadrao.filter(item => {
              const u = (item.url || "").toLowerCase();
              const l = (item.loja || "").toLowerCase();
              return !u.includes("olx.com") && !u.includes("facebook.com") && l !== "olx" && l !== "facebook";
            });

            // Embaralhamento aleatório (Fisher-Yates) para garantir 100 itens variados
            const shuffled = [...retailOnly];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            candidatos = shuffled.slice(0, 100).map(item => ({
              ...item,
              is_padrao: true,
              destaque_label: null,
              motivo_recomendacao: null
            }));
          }
        } catch (ePadrao) {
          console.warn("[RecEngine] Aviso ao carregar itens padrão de cumprir tabela:", ePadrao);
        }
      }

      let produtosProcessados = [];
      const urlsVistas = new Set();

      for (const item of candidatos) {
        const url = (item.url || "").toLowerCase();
        // REGRA CRÍTICA: Exclusão estrita de OLX e Facebook
        if (url.includes("olx.com") || url.includes("facebook.com")) continue;

        const cleanUrl = url.split("?")[0].replace(/\/$/, "");
        if (urlsVistas.has(cleanUrl)) continue;
        urlsVistas.add(cleanUrl);

        const title = (item.title || "").trim();
        if (!title || !item.price || parseFloat(item.price) <= 0) continue;

        const lowerTitle = title.toLowerCase();
        const loja = item.loja || this.identificarLojaPorUrl(item.url);
        const descontoPct = this.extrairDescontoPct(item);
        const precoFloat = parseFloat(item.price);
        const precoOriginalFloat = parseFloat((precoFloat * (1 + descontoPct / 100)).toFixed(2));

        const isPadrao = Boolean(item.is_padrao || !temRecomendacoesPersonalizadas);

        let matchScore = 0;
        let motivoRecomendacao = null;

        if (!isPadrao) {
          // 1. Verifica correspondência com os termos dos RADARES ATIVOS do usuário (+80)
          let casouRadar = false;
          for (const kw of radarKeywords) {
            if (lowerTitle.includes(kw)) {
              casouRadar = true;
              break;
            }
          }
          if (casouRadar || (item.destaque_label && item.destaque_label.includes("rastreou"))) {
            matchScore += 80;
            motivoRecomendacao = "Indicado para você porque você rastreou por isso";
          }

          // 2. Se já veio do scraper com tag personalizada de monitoramento
          if (!motivoRecomendacao && item.destaque_label && (item.destaque_label.startsWith("Porque você") || item.destaque_label.startsWith("Indicado para você"))) {
            matchScore += 60;
            motivoRecomendacao = item.destaque_label;
          }

          // 3. Verifica correspondência com buscas recentes (+50) ou favoritos (+40)
          if (!motivoRecomendacao && temInteresses) {
            for (const [termo, peso] of Object.entries(interessesMap)) {
              if (lowerTitle.includes(termo)) {
                matchScore += peso * 8;
                if (peso >= 10) {
                  motivoRecomendacao = "Indicado para você porque você curtiu itens desse tipo";
                } else {
                  motivoRecomendacao = "Indicado para você porque você pesquisou por isso";
                }
                break;
              }
            }
          }

          if (!motivoRecomendacao) {
            motivoRecomendacao = item.destaque_label || "Indicado para você";
          }
        }

        const freteInfo = calcularFreteGratisInfo(loja, precoFloat, item.destaque_label, title);
        const isInternacional = Boolean(item.is_internacional || lowerTitle.includes("internacional"));

        // Pontuação ponderada por afinidade, loja preferencial e desconto
        const jitter = (Math.sin(title.length + (now % 1000)) + 1) * 2;
        const finalScore = isPadrao ? (descontoPct * 0.5 + jitter) : (matchScore + (descontoPct * 0.4) + jitter);

        produtosProcessados.push({
          id: item.id || `rec_${Math.random()}`,
          titulo: title,
          preco: precoFloat,
          preco_original: precoOriginalFloat,
          imagem_url: item.imagem_url,
          url: item.url,
          loja: loja,
          desconto_pct: descontoPct,
          score: finalScore,
          cupom: item.cupom || null,
          motivo_recomendacao: isPadrao ? null : motivoRecomendacao,
          destaque_label: isPadrao ? null : motivoRecomendacao,
          is_padrao: isPadrao,
          frete_gratis: freteInfo.temFreteGratis,
          frete_label: freteInfo.freteLabel,
          is_cupom_frete: freteInfo.isCupom,
          parcelamento: calcularParcelamento(precoFloat),
          is_internacional: isInternacional,
          is_hot: matchScore > 0,
          is_recomendacao: true,
          is_top5: false,
          is_destaque_top5: false,
          created_at: item.created_at
        });
      }

      // =====================================================================
      // ALGORITMO DE DIVERSIFICAÇÃO MULTI-LOJAS COM PONDERAÇÃO DE PREFERÊNCIA
      // =====================================================================
      // 1. Agrupa os produtos por loja
      const produtosPorLoja = {};
      for (const p of produtosProcessados) {
        const l = p.loja || 'Outras';
        if (!produtosPorLoja[l]) produtosPorLoja[l] = [];
        produtosPorLoja[l].push(p);
      }

      // 2. Ordena os produtos de cada loja por pontuação individual
      for (const l of Object.keys(produtosPorLoja)) {
        produtosPorLoja[l].sort((a, b) => (b.score || 0) - (a.score || 0));
      }

      // 3. Ordena o ranking de lojas: a loja preferida pelo usuário fica no topo
      const lojasOrdenadas = Object.keys(produtosPorLoja).sort((a, b) => {
        const scoreA = (storeInterestsMap[a] || 0) + (produtosPorLoja[a].length * 2);
        const scoreB = (storeInterestsMap[b] || 0) + (produtosPorLoja[b].length * 2);
        return scoreB - scoreA;
      });

      // 4. Intercalação balanceada:
      // A loja #1 (com maior afinidade) fornece até 2 produtos por ciclo, enquanto as
      // demais lojas fornecem 1 produto por ciclo.
      // Isso assegura que a loja preferida do usuário tenha maior presença, mas
      // Mercado Livre, Shopee, Magalu, Casas Bahia, Amazon e outras apareçam intercaladas!
      const feedDiversificado = [];
      let continua = true;
      while (continua) {
        let adicionouNesteCiclo = false;
        for (let i = 0; i < lojasOrdenadas.length; i++) {
          const lNome = lojasOrdenadas[i];
          const itensDaLoja = produtosPorLoja[lNome];
          if (itensDaLoja && itensDaLoja.length > 0) {
            const qtd = (i === 0 && (storeInterestsMap[lNome] || 0) >= 15) ? 2 : 1;
            for (let k = 0; k < qtd && itensDaLoja.length > 0; k++) {
              feedDiversificado.push(itensDaLoja.shift());
              adicionouNesteCiclo = true;
            }
          }
        }
        if (!adicionouNesteCiclo) continua = false;
      }

      // Limita a vitrine de recomendações: até 100 itens para lista padrão ou até 400 itens para personalizada
      const limiteItens = temRecomendacoesPersonalizadas ? 400 : 100;
      const listaFinal = (feedDiversificado.length > 0 ? feedDiversificado : produtosProcessados).slice(0, limiteItens);

      if (listaFinal.length > 0) {
        for (const prod of listaFinal.slice(0, 30)) {
          if (prod.imagem_url) {
            try { Image.prefetch(prod.imagem_url).catch(() => {}); } catch (e) {}
          }
        }
        await AsyncStorage.setItem(STORAGE_KEYS.CACHED_RECS, JSON.stringify(listaFinal));
      }

      return listaFinal;
    } catch (e) {
      console.warn("[RecEngine] Erro ao carregar recomendações:", e);
      return [];
    }
  }

  /**
   * Dispara sinal para o back-end realizar varredura de promoções relâmpago de hora em hora
   */
  static async solicitarVarreduraPromocoes() {
    try {
      const { data: monitores } = await supabase
        .from("monitores")
        .select("id")
        .eq("modo", "promocoes")
        .limit(1);

      if (monitores && monitores.length > 0) {
        await supabase.from("monitores").update({ forcar_teste: true, ativo: true }).eq("id", monitores[0].id);
        console.log("[RecEngine] Varredura de promoções disparada no backend via monitor:", monitores[0].id);
      }
    } catch (e) {
      console.warn("[RecEngine] Aviso ao solicitar varredura de promoções:", e);
    }
  }

  /**
   * Carrega promoções em tempo real da Home (coletadas de hora em hora no backend)
   * Sem filtro por interesse pessoal; foco nas maiores ofertas ativas em todas as lojas
   */
  static async carregarPromocoesHome(forceRefresh = false) {
    try {
      const now = Date.now();
      const lastUpdateRaw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_PROMO_UPDATE);
      const lastUpdate = lastUpdateRaw ? parseInt(lastUpdateRaw, 10) : 0;
      const deveRenovar1h = (now - lastUpdate) >= CICLO_PROMOCOES_MS;

      if (deveRenovar1h) {
        this.solicitarVarreduraPromocoes();
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_PROMO_UPDATE, String(now));
      }

      // 1. Tenta carregar do cache local para resposta instantânea (0ms)
      if (!forceRefresh && !deveRenovar1h) {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_PROMOS);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }

      // 2. Consulta monitor de promoções e ofertas no Supabase
      const { data: monitorPromo } = await supabase
        .from("monitores")
        .select("id")
        .eq("modo", "promocoes")
        .limit(1);

      const monitorIdFiltro = (monitorPromo && monitorPromo.length > 0) ? monitorPromo[0].id : null;

      // Busca sem qualquer teto artificial, paginando de 1000 em 1000 até trazer 100% das ofertas
      let resultados = [];
      let fromIdx = 0;
      const pageSize = 1000;
      while (true) {
        let query = supabase
          .from("resultados")
          .select("*")
          .not("imagem_url", "is", null);

        if (monitorIdFiltro) {
          query = query.eq("monitor_id", monitorIdFiltro);
        }

        const { data: chunk, error } = await query
          .order("created_at", { ascending: false })
          .range(fromIdx, fromIdx + pageSize - 1);

        if (error || !chunk || chunk.length === 0) break;
        resultados.push(...chunk);
        if (chunk.length < pageSize) break;
        fromIdx += pageSize;
      }

      let promocoes = [];
      if (resultados.length > 0) {
        for (const item of resultados) {
          const url = (item.url || "").toLowerCase();
          if (url.includes("olx.com") || url.includes("facebook.com")) continue;

          const title = (item.title || "").trim();
          const loja = item.loja || this.identificarLojaPorUrl(item.url);
          const precoFloat = item.price ? parseFloat(item.price) : 0;
          if (precoFloat <= 0) continue;

          let precoOrig = item.preco_original ? parseFloat(item.preco_original) : 0;
          let descPct = 0;
          if (precoOrig > precoFloat) {
            descPct = Math.round(((precoOrig - precoFloat) / precoOrig) * 100);
            if (descPct > 85) {
              descPct = 35;
              precoOrig = roundPrice(precoFloat / (1 - descPct / 100));
            }
          } else {
            const rawPct = item.desconto_pct ? parseInt(item.desconto_pct, 10) : this.extrairDescontoPct(item);
            descPct = (rawPct > 0 && rawPct <= 80) ? rawPct : 20;
            precoOrig = roundPrice(precoFloat / (1 - descPct / 100));
          }

          const ribbon = item.destaque_label || (descPct >= 35 ? "OFERTA RELÂMPAGO" : (descPct >= 20 ? "OFERTA DO DIA" : null));

          let imgFinal = (item.imagem_url || "").trim();
          if (imgFinal.includes("{w}x{h}")) {
            imgFinal = imgFinal.replace("{w}x{h}", "800x560");
          }

          const freteInfo = calcularFreteGratisInfo(loja, precoFloat, ribbon, title);

          promocoes.push({
            id: item.id || `promo_${Math.random()}`,
            titulo: title,
            preco: precoFloat,
            preco_original: precoOrig,
            desconto_pct: descPct,
            loja: loja,
            url: item.url,
            imagem_url: imgFinal,
            destaque_label: ribbon,
            cupom: item.cupom || null,
            frete_gratis: freteInfo.temFreteGratis,
            frete_label: freteInfo.freteLabel,
            is_cupom_frete: freteInfo.isCupom,
            parcelamento: item.parcelamento || calcularParcelamento(precoFloat),
            no_pix: true,
            restam_unidades: item.restam_unidades || null,
            is_hot: descPct >= 25,
            is_top5: false,
            created_at: item.created_at
          });
        }
      }

      // ALGORITMO DE DISTRIBUIÇÃO DA HOME:
      // 1. Top 5 produtos com os MAIORES descontos percentuais no topo da lista (produtos distintos)
      //    -> Recebem a etiqueta oficial de DESTAQUE com estrelinha!
      // 2. A partir do 6º produto: embaralhamento aleatório (Fisher-Yates) entre todas as lojas
      let listaFinal = [];
      if (promocoes.length > 0) {
        // Ordena cópia por maior desconto decrescente para identificar os 5 maiores destaques
        const ordenadosPorDesconto = [...promocoes].sort((a, b) => (b.desconto_pct || 0) - (a.desconto_pct || 0));
        
        // Identifica 5 produtos distintos com maiores descontos para receberem a tag de destaque com estrelinha
        const top5Titulos = new Set();
        const top5Ids = new Set();
        for (const p of ordenadosPorDesconto) {
          const tNorm = (p.titulo || '').toLowerCase().slice(0, 20);
          if (!top5Titulos.has(tNorm)) {
            top5Titulos.add(tNorm);
            top5Ids.add(p.id);
            if (top5Ids.size >= 5) break;
          }
        }

        // Atribui a tag de destaque aos 5 maiores descontos sem fixá-los no topo (permanecem aleatórios)
        const todosProdutos = promocoes.map(p => ({
          ...p,
          is_top5: top5Ids.has(p.id),
          is_destaque_top5: top5Ids.has(p.id)
        }));

        // Embaralhamento aleatório (Fisher-Yates) para misturar completamente todas as lojas
        for (let i = todosProdutos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [todosProdutos[i], todosProdutos[j]] = [todosProdutos[j], todosProdutos[i]];
        }

        listaFinal = todosProdutos;
      }

      // Salva em cache local e pré-carrega as imagens do topo
      if (listaFinal.length > 0) {
        for (const prod of listaFinal.slice(0, 25)) {
          if (prod.imagem_url) {
            try { Image.prefetch(prod.imagem_url).catch(() => {}); } catch(e) {}
          }
        }
        await AsyncStorage.setItem(STORAGE_KEYS.CACHED_PROMOS, JSON.stringify(listaFinal));
      }

      return listaFinal;
    } catch (e) {
      console.warn("[RecEngine] Erro ao carregar promoções da Home:", e);
      return [];
    }
  }

}
