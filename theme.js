// =====================================================================
// AchôAI - Design System Tokens: Edição Oportunidade & Agilidade (2026)
// =====================================================================

export const THEME = {
  // Paleta Base Clara & Neutra
  bg: '#F8FAFC',               // Slate 50 — fundo neutro suave, visual limpo
  bgSecondary: '#F1F5F9',      // Slate 100 — para barras superiores, fundos secundários e divisores
  cardBg: '#FFFFFF',           // Branco puro para destaque de produtos e cartões
  cardBgElevated: '#FFFFFF',   // Branco puro elevado
  cardBgHover: '#F8FAFC',      // Estado pressionado
  cardBorder: '#E2E8F0',       // Borda sutil translúcida clara (Slate 200)
  cardBorderActive: '#FF5722',  // Borda ativa com destaque laranja
  cardBorderGlow: 'rgba(255, 87, 34, 0.18)',

  // Cor Primária AchôAI (Laranja Energético - Ação e Destaque)
  primary: '#FF5722',
  primaryHover: '#E64A19',
  primaryDark: '#D84315',
  primaryGlow: 'rgba(255, 87, 34, 0.12)',
  primaryGlowStrong: 'rgba(255, 87, 34, 0.25)',

  // Cor Secundária / Suporte (Teal / Verde-Petróleo - Segurança na Compra)
  secondary: '#0D9488',
  secondaryHover: '#0F766E',
  secondaryBg: 'rgba(13, 148, 136, 0.10)',
  secondaryBorder: 'rgba(13, 148, 136, 0.30)',

  // Cores Semânticas
  success: '#16A34A',          // Verde claro vibrante (% de desconto, economia e preço baixo)
  successBg: 'rgba(22, 163, 74, 0.12)',
  successGlow: 'rgba(22, 163, 74, 0.25)',
  warning: '#F59E0B',          // Âmbar quente (alertas)
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',           // Coral (erros, exclusões)
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  info: '#0284C7',             // Azul moderno para informações
  infoBg: 'rgba(2, 132, 199, 0.10)',

  // Marcas das 10 Plataformas Homologadas (+ Classificados para Radar)
  platforms: {
    MERCADO_LIVRE: {
      nome: 'Mercado Livre',
      sigla: 'ML',
      color: '#D97706',        // Amarelo Dourado
      bg: 'rgba(217, 119, 6, 0.12)',
      border: 'rgba(217, 119, 6, 0.35)',
      icon: 'cube-outline',
      logoUrl: 'https://http2.mlstatic.com/frontend-assets/ui-navigation/5.22.8/mercadolibre/logo__small.png'
    },
    SHOPEE: {
      nome: 'Shopee',
      sigla: 'Shopee',
      color: '#EE4D2D',        // Laranja Shopee
      bg: 'rgba(238, 77, 45, 0.12)',
      border: 'rgba(238, 77, 45, 0.35)',
      icon: 'bag-handle-outline',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Shopee_logo.svg/300px-Shopee_logo.svg.png'
    },
    AMAZON: {
      nome: 'Amazon',
      sigla: 'Amazon',
      color: '#EA580C',        // Âmbar/Laranja Amazon
      bg: 'rgba(234, 88, 12, 0.12)',
      border: 'rgba(234, 88, 12, 0.35)',
      icon: 'cart-outline',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg'
    },
    MAGALU: {
      nome: 'Magalu',
      sigla: 'Magalu',
      color: '#0086FF',        // Azul Magalu
      bg: 'rgba(0, 134, 255, 0.12)',
      border: 'rgba(0, 134, 255, 0.35)',
      icon: 'bag-handle-outline',
      logoUrl: 'https://logodownload.org/wp-content/uploads/2014/06/magalu-logo-1.png'
    },
    KABUM: {
      nome: 'KaBuM!',
      sigla: 'KaBuM',
      color: '#FF6500',        // Laranja KaBuM
      bg: 'rgba(255, 101, 0, 0.12)',
      border: 'rgba(255, 101, 0, 0.35)',
      icon: 'hardware-chip-outline',
      logoUrl: 'https://logodownload.org/wp-content/uploads/2017/11/kabum-logo.png'
    },
    AMERICANAS: {
      nome: 'Americanas',
      sigla: 'Americanas',
      color: '#E60014',        // Vermelho Americanas
      bg: 'rgba(230, 0, 20, 0.12)',
      border: 'rgba(230, 0, 20, 0.35)',
      icon: 'storefront-outline',
      logoUrl: 'https://logodownload.org/wp-content/uploads/2014/07/americanas-logo-1.png'
    },
    CASASBAHIA: {
      nome: 'Casas Bahia',
      sigla: 'Casas Bahia',
      color: '#002B7F',        // Azul Casas Bahia
      bg: 'rgba(0, 43, 127, 0.12)',
      border: 'rgba(0, 43, 127, 0.35)',
      icon: 'home-outline',
      logoUrl: 'https://logodownload.org/wp-content/uploads/2014/05/casas-bahia-logo-1.png'
    },
    FASTSHOP: {
      nome: 'Fast Shop',
      sigla: 'Fast Shop',
      color: '#E30613',        // Vermelho Fast Shop
      bg: 'rgba(227, 6, 19, 0.12)',
      border: 'rgba(227, 6, 19, 0.35)',
      icon: 'flash-outline',
      logoUrl: 'https://logodownload.org/wp-content/uploads/2019/07/fast-shop-logo-0.png'
    },
    CARREFOUR: {
      nome: 'Carrefour',
      sigla: 'Carrefour',
      color: '#004F9F',        // Azul Carrefour
      bg: 'rgba(0, 79, 159, 0.12)',
      border: 'rgba(0, 79, 159, 0.35)',
      icon: 'cart-outline',
      logoUrl: 'https://logodownload.org/wp-content/uploads/2014/09/carrefour-logo-0.png'
    },
    SHEIN: {
      nome: 'SHEIN',
      sigla: 'SHEIN',
      color: '#0F172A',        // Preto elegante SHEIN
      bg: 'rgba(15, 23, 42, 0.08)',
      border: 'rgba(15, 23, 42, 0.30)',
      icon: 'shirt-outline',
      logoUrl: 'https://logodownload.org/wp-content/uploads/2021/04/shein-logo-0.png'
    },
    OLX: {
      nome: 'OLX',
      sigla: 'OLX',
      color: '#7C3AED',        // Roxo OLX
      bg: 'rgba(124, 58, 237, 0.12)',
      border: 'rgba(124, 58, 237, 0.35)',
      icon: 'pricetag-outline',
      logoUrl: 'https://logodownload.org/wp-content/uploads/2014/10/olx-logo-1.png'
    },
    FACEBOOK: {
      nome: 'Facebook',
      sigla: 'Facebook',
      color: '#1877F2',        // Azul Facebook
      bg: 'rgba(24, 119, 242, 0.12)',
      border: 'rgba(24, 119, 242, 0.35)',
      icon: 'logo-facebook',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg'
    }
  },

  // Tipografia & Escala de Textos (Contraste limpo)
  text: '#0F172A',             // Slate 900 — Azul/Grafite escuro para leitura nítida
  textSecondary: '#334155',    // Slate 700 — Descrições
  textMuted: '#64748B',        // Slate 500 — Legendas e metadados
  textSubtle: '#94A3B8',       // Slate 400 — Placeholders e ícones inativos

  // Sombras E-commerce
  shadow: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#FF5722',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 6,
    }
  },

  // Geometria & Bordas
  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    pill: 999
  }
};
