// =====================================================================
// AchôAI - Design System Tokens (Edição 2026)
// =====================================================================

export const THEME = {
  // Paleta Base Obsidian & Carvão
  bg: '#08090D',               // Preto obsidiana profundo (canvas)
  bgSecondary: '#0E1118',      // Fundo para barras e seções secundárias
  cardBg: '#121622',           // Superfície de cartões padrão
  cardBgElevated: '#181E2E',   // Superfície ativa / cartões elevados
  cardBgHover: '#1D2436',      // Estado hover/pressionado
  cardBorder: 'rgba(255, 255, 255, 0.08)',       // Borda sutil translúcida
  cardBorderActive: 'rgba(255, 122, 0, 0.45)',  // Borda com halo laranja
  cardBorderGlow: 'rgba(255, 122, 0, 0.20)',

  // Cor Primária AchôAI (Electric Amber / Laranja Tecnológico)
  primary: '#FF7A00',
  primaryHover: '#FF8A1A',
  primaryDark: '#D96500',
  primaryGlow: 'rgba(255, 122, 0, 0.16)',
  primaryGlowStrong: 'rgba(255, 122, 0, 0.28)',

  // Cores Semânticas
  success: '#10B981',          // Verde esmeralda (oportunidades, online)
  successBg: 'rgba(16, 185, 129, 0.12)',
  successGlow: 'rgba(16, 185, 129, 0.25)',
  warning: '#F59E0B',          // Âmbar quente (alertas, margem de preço)
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',           // Coral moderno (erros, exclusão)
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  info: '#06B6D4',             // Ciano tecnológico (notícias, telemetria)
  infoBg: 'rgba(6, 182, 212, 0.12)',

  // Marcas de Plataforma
  platforms: {
    OLX: {
      nome: 'OLX',
      color: '#A855F7',        // Roxo moderno
      bg: 'rgba(168, 85, 247, 0.12)',
      border: 'rgba(168, 85, 247, 0.35)',
      icon: 'cart-outline'
    },
    ZOOM: {
      nome: 'Zoom',
      color: '#F59E0B',        // Âmbar
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.35)',
      icon: 'search-outline'
    },
    BUSCAPE: {
      nome: 'Buscapé',
      color: '#10B981',        // Verde esmeralda
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.35)',
      icon: 'pricetag-outline'
    },
    OUTROS: {
      nome: 'Web & Notícias',
      color: '#06B6D4',        // Ciano
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.35)',
      icon: 'globe-outline'
    }
  },

  // Tipografia & Escala de Textos
  text: '#FFFFFF',             // Branco puro para destaques
  textSecondary: '#E2E8F0',    // Cinza claro para textos de leitura
  textMuted: '#94A3B8',        // Cinza médio para legendas e datas
  textSubtle: '#64748B',       // Cinza escuro para placeholders e ícones inativos

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
