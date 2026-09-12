import React from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from './theme';

// =====================================================================
// 1. CARDS E SUPERFÍCIES
// =====================================================================

export const Surface = ({ children, style, elevated = false, active = false, glow = false }) => (
  <View style={[
    styles.surface,
    elevated && styles.surfaceElevated,
    active && styles.surfaceActive,
    glow && styles.surfaceGlow,
    style
  ]}>
    {children}
  </View>
);

// =====================================================================
// 2. BOTÕES PREMIUM
// =====================================================================

export const PrimaryButton = ({ 
  title, 
  onPress, 
  icon, 
  loading = false, 
  disabled = false, 
  variant = 'primary', // 'primary' | 'secondary' | 'danger'
  style,
  textStyle,
  size = 'md' // 'sm' | 'md' | 'lg'
}) => {
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';

  return (
    <TouchableOpacity 
      style={[
        styles.btnBase,
        size === 'sm' && styles.btnSm,
        size === 'lg' && styles.btnLg,
        isSecondary ? styles.btnSecondary : isDanger ? styles.btnDanger : styles.btnPrimary,
        (disabled || loading) && { opacity: 0.6 },
        style
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isSecondary ? THEME.primary : isDanger ? '#FFF' : '#000'} />
      ) : (
        <View style={styles.btnContent}>
          {icon && (
            <Ionicons 
              name={icon} 
              size={size === 'sm' ? 14 : size === 'lg' ? 20 : 17} 
              color={isSecondary ? THEME.primary : isDanger ? '#FFF' : '#000'} 
              style={{ marginRight: 7 }} 
            />
          )}
          <Text style={[
            styles.btnText,
            size === 'sm' && styles.btnTextSm,
            size === 'lg' && styles.btnTextLg,
            isSecondary ? styles.btnSecondaryText : isDanger ? styles.btnDangerText : styles.btnPrimaryText,
            textStyle
          ]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export const IconButton = ({ icon, onPress, color = THEME.textMuted, bg = THEME.cardBgElevated, size = 38, iconSize = 18, style }) => (
  <TouchableOpacity 
    style={[
      styles.iconBtn, 
      { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, 
      style
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons name={icon} size={iconSize} color={color} />
  </TouchableOpacity>
);

// =====================================================================
// 3. BADGES E CHIPS
// =====================================================================

export const StatusBadge = ({ status, pulse = false }) => {
  const isAtivo = status === 'ATIVO';
  const isProcessando = status === 'PROCESSANDO';
  
  let bg = THEME.cardBgElevated;
  let textColor = THEME.textSubtle;
  let dotColor = THEME.textSubtle;
  let label = 'PAUSADO';

  if (isAtivo) {
    bg = THEME.successBg;
    textColor = THEME.success;
    dotColor = THEME.success;
    label = 'ATIVO';
  } else if (isProcessando) {
    bg = THEME.primaryGlow;
    textColor = THEME.primary;
    dotColor = THEME.primary;
    label = 'VARRENDO';
  }

  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.statusBadgeText, { color: textColor }]}>{label}</Text>
    </View>
  );
};

export const PlatformBadge = ({ platformKey = 'OLX' }) => {
  const plat = THEME.platforms[platformKey] || THEME.platforms.OUTROS;
  return (
    <View style={[styles.platformBadge, { backgroundColor: plat.bg, borderColor: plat.border }]}>
      <Ionicons name={plat.icon} size={12} color={plat.color} style={{ marginRight: 4 }} />
      <Text style={[styles.platformBadgeText, { color: plat.color }]}>{plat.nome}</Text>
    </View>
  );
};

export const ShopeeOriginBadge = ({ origem = 'Nacional' }) => {
  const isNac = origem === 'Nacional';
  return (
    <View style={[
      styles.shopeeOriginBadge, 
      isNac ? styles.shopeeOriginBadgeNac : styles.shopeeOriginBadgeInter
    ]}>
      <Ionicons 
        name={isNac ? "flag-outline" : "globe-outline"} 
        size={10} 
        color={isNac ? "#10B981" : "#3B82F6"} 
        style={{ marginRight: 3 }} 
      />
      <Text style={[
        styles.shopeeOriginBadgeText,
        isNac ? styles.shopeeOriginBadgeTextNac : styles.shopeeOriginBadgeTextInter
      ]}>
        {origem}
      </Text>
    </View>
  );
};

export const ShopeeDiscountBadge = ({ discount }) => {
  if (!discount) return null;
  const discClean = String(discount).replace('-', '').replace('OFF', '').replace('off', '').trim();
  const label = `(-${discClean} OFF)`;
  return (
    <View style={styles.shopeeDiscountBadge}>
      <Ionicons name="pricetag" size={10} color="#EE4D2D" style={{ marginRight: 3 }} />
      <Text style={styles.shopeeDiscountBadgeText}>{label}</Text>
    </View>
  );
};

export const ShopeeRatingBadge = ({ score, vendidos }) => {
  if (!score && !vendidos) return null;
  return (
    <View style={styles.shopeeRatingBadge}>
      {score ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: vendidos ? 5 : 0 }}>
          <Ionicons name="star" size={10} color="#FFBB00" style={{ marginRight: 2 }} />
          <Text style={styles.shopeeRatingBadgeText}>{Number(score).toFixed(1)}</Text>
        </View>
      ) : null}
      {vendidos ? (
        <Text style={styles.shopeeSalesBadgeText}>{vendidos}</Text>
      ) : null}
    </View>
  );
};

export const parseShopeeInfo = (title = '', url = '') => {
  const isShopee = (url && url.toLowerCase().includes('shopee.com.br')) || title.includes('📍') || title.includes('OFF') || title.includes('off') || title.includes('⭐');
  let cleanTitle = title || '';
  let origem = null;
  let desconto = null;
  let score = null;
  let vendidos = null;

  // Extrair avaliação ⭐ x.x
  const starMatch = cleanTitle.match(/(?:•\s*)?(?:\[⭐\s*([1-5]\.[0-9])\]|⭐\s*([1-5]\.[0-9]))/);
  if (starMatch) {
    score = starMatch[1] || starMatch[2];
    cleanTitle = cleanTitle.replace(starMatch[0], '').trim();
  }

  // Extrair vendidos ex: • 20mil+ Vendido(s) ou [20mil+ Vendidos]
  const salesMatch = cleanTitle.match(/(?:•\s*)?(?:\[(\d+(?:[\.,]\d+)?\s*(?:mil|k)?\+?\s*vendido[s\(\)]*)\]|(\d+(?:[\.,]\d+)?\s*(?:mil|k)?\+?\s*vendido[s\(\)]*))/i);
  if (salesMatch) {
    vendidos = salesMatch[1] || salesMatch[2];
    cleanTitle = cleanTitle.replace(salesMatch[0], '').trim();
  }

  if (cleanTitle.includes('• 📍')) {
    const parts = cleanTitle.split('• 📍');
    cleanTitle = parts[0].trim();
    const locPart = parts[1] ? parts[1].trim() : '';
    if (locPart.toLowerCase().includes('internacional')) {
      origem = 'Internacional';
    } else {
      origem = 'Nacional';
    }
  } else if (cleanTitle.toLowerCase().includes('internacional')) {
    origem = 'Internacional';
  } else if (isShopee) {
    origem = 'Nacional';
  }

  // Desconto no formato "• -xx%" ou "• -xx% OFF" ou "(-xx% OFF)" ou "[-xx%OFF]"
  const discMatch = cleanTitle.match(/•?\s*(-?\d+%\s*OFF|-?\d+%\s*off|-?\d+%|\[-\d+%\s*OFF\])/i);
  if (discMatch) {
    const raw = discMatch[1].replace(/off/i, '').replace('-', '').replace('[', '').replace(']', '').trim();
    desconto = raw;
    cleanTitle = cleanTitle.replace(discMatch[0], '').trim();
  }

  cleanTitle = cleanTitle.replace(/\s*•\s*$/, '').trim();

  return { cleanTitle, origem, desconto, score, vendidos };
};

export const MLFullBadge = () => (
  <View style={styles.mlFullBadge}>
    <Ionicons name="flash" size={10} color="#00A650" style={{ marginRight: 3 }} />
    <Text style={styles.mlFullBadgeText}>FULL</Text>
  </View>
);

export const MLFreeShippingBadge = () => (
  <View style={styles.mlFreeShippingBadge}>
    <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
    <Text style={styles.mlFreeShippingBadgeText}>Frete Grátis</Text>
  </View>
);

export const MLDiscountBadge = ({ discount }) => {
  if (!discount) return null;
  const discClean = String(discount).replace('-', '').replace('OFF', '').replace('off', '').trim();
  const label = `(-${discClean} OFF)`;
  return (
    <View style={styles.mlDiscountBadge}>
      <Ionicons name="pricetag" size={10} color="#00A650" style={{ marginRight: 3 }} />
      <Text style={styles.mlDiscountBadgeText}>{label}</Text>
    </View>
  );
};

export const parseMLInfo = (title = '', url = '') => {
  const isML = (url && (url.toLowerCase().includes('mercadolivre.com') || url.toLowerCase().includes('mercadolivre.com.br'))) ||
               title.includes('FULL') || title.includes('Frete Grátis');
  let cleanTitle = title || '';
  let isFull = cleanTitle.includes('⚡ FULL') || cleanTitle.includes('[FULL]') || (url && url.includes('_Frete_Full'));
  let isFreteGratis = cleanTitle.includes('🚚 Frete Grátis') || cleanTitle.includes('[Frete Grátis]') || (url && url.includes('_CustoFrete_Gratis'));
  let desconto = null;
  let origem = null;
  let condicao = null;

  // Extrai desconto (% OFF)
  const discMatch = cleanTitle.match(/•?\s*(-?\d+%\s*OFF|-?\d+%\s*off|-?\d+%|\[-\d+%\s*OFF\])/i);
  if (discMatch) {
    const raw = discMatch[1].replace(/\[|\]/g, '').replace(/off/i, '').replace('-', '').trim();
    desconto = raw;
    cleanTitle = cleanTitle.replace(discMatch[0], '').trim();
  }

  // Remove tags estruturadas do título
  cleanTitle = cleanTitle
    .replace(/•\s*⚡\s*FULL/gi, '')
    .replace(/\[FULL\]/gi, '')
    .replace(/•\s*🚚\s*Frete\s*Grátis/gi, '')
    .replace(/\[Frete\s*Grátis\]/gi, '')
    .replace(/•\s*📍\s*Nacional/gi, '')
    .replace(/•\s*📍\s*Internacional/gi, '')
    .replace(/•\s*Novo/gi, '')
    .replace(/•\s*Usado/gi, '')
    .replace(/\s*•\s*$/, '')
    .replace(/^\s*•\s*/, '')
    .trim();

  return { cleanTitle, isFull, isFreteGratis, desconto, origem, condicao };
};

export const AmazonPrimeBadge = () => (
  <View style={styles.amzPrimeBadge}>
    <Ionicons name="cube" size={10} color="#00A8E1" style={{ marginRight: 3 }} />
    <Text style={styles.amzPrimeBadgeText}>Prime</Text>
  </View>
);

export const AmazonFreeShippingBadge = () => (
  <View style={styles.amzFreeShippingBadge}>
    <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
    <Text style={styles.amzFreeShippingBadgeText}>Frete Grátis</Text>
  </View>
);

export const AmazonDiscountBadge = ({ discount }) => {
  if (!discount) return null;
  const discClean = String(discount).replace('-', '').replace('OFF', '').replace('off', '').trim();
  const label = `(-${discClean} OFF)`;
  return (
    <View style={styles.amzDiscountBadge}>
      <Ionicons name="pricetag" size={10} color="#FF9900" style={{ marginRight: 3 }} />
      <Text style={styles.amzDiscountBadgeText}>{label}</Text>
    </View>
  );
};

export const parseAmazonInfo = (title = '', url = '') => {
  const isAmz = (url && (url.toLowerCase().includes('amazon.com.br') || url.toLowerCase().includes('amazon.com') || url.toLowerCase().includes('amzn.to'))) ||
                title.includes('Prime') || title.includes('Amazon');
  let cleanTitle = title || '';
  let isPrime = cleanTitle.includes('📦 Prime') || cleanTitle.includes('[Prime]');
  let isFreteGratis = isPrime || cleanTitle.includes('🚚 Frete Grátis') || cleanTitle.includes('[Frete Grátis]');
  let desconto = null;
  let score = null;
  let origem = null;
  let condicao = null;

  // Extrair avaliação ⭐ x.x ou ⭐ x
  const starMatch = cleanTitle.match(/(?:•\s*)?(?:\[⭐\s*([1-5](?:\.[0-9]+)?)\]|⭐\s*([1-5](?:\.[0-9]+)?))/);
  if (starMatch) {
    score = starMatch[1] || starMatch[2];
    cleanTitle = cleanTitle.replace(starMatch[0], '').trim();
  }

  // Extrai desconto (% OFF)
  const discMatch = cleanTitle.match(/•?\s*(-?\d+%\s*OFF|-?\d+%\s*off|-?\d+%|\[-\d+%\s*OFF\])/i);
  if (discMatch) {
    const raw = discMatch[1].replace(/\[|\]/g, '').replace(/off/i, '').replace('-', '').trim();
    desconto = raw;
    cleanTitle = cleanTitle.replace(discMatch[0], '').trim();
  }

  if (cleanTitle.includes('• 📍 Internacional') || cleanTitle.includes('[INTER]')) {
    origem = 'Internacional';
  } else if (cleanTitle.includes('• 📍 Nacional') || cleanTitle.includes('[NAC]')) {
    origem = 'Nacional';
  }

  if (cleanTitle.includes('• Usado')) {
    condicao = 'Usado';
  } else if (cleanTitle.includes('• Novo')) {
    condicao = 'Novo';
  }

  cleanTitle = cleanTitle
    .replace(/•\s*📦\s*Prime/gi, '')
    .replace(/\[Prime\]/gi, '')
    .replace(/•\s*🚚\s*Frete\s*Grátis/gi, '')
    .replace(/\[Frete\s*Grátis\]/gi, '')
    .replace(/•\s*📍\s*Nacional/gi, '')
    .replace(/\[NAC\]/gi, '')
    .replace(/•\s*📍\s*Internacional/gi, '')
    .replace(/\[INTER\]/gi, '')
    .replace(/•\s*Novo/gi, '')
    .replace(/•\s*Usado/gi, '')
    .replace(/\s*•\s*$/, '')
    .replace(/^\s*•\s*/, '')
    .trim();

  return { cleanTitle, isPrime, isFreteGratis, desconto, score, origem, condicao };
};

export const MagaluFullBadge = () => (
  <View style={styles.magaluFullBadge}>
    <Ionicons name="flash" size={10} color="#0086FF" style={{ marginRight: 3 }} />
    <Text style={styles.magaluFullBadgeText}>Full</Text>
  </View>
);

export const MagaluFreeShippingBadge = () => (
  <View style={styles.magaluFreeShippingBadge}>
    <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
    <Text style={styles.magaluFreeShippingBadgeText}>Frete Grátis</Text>
  </View>
);

export const MagaluDiscountBadge = ({ discount }) => {
  if (!discount) return null;
  const discClean = String(discount).replace('-', '').replace('OFF', '').replace('off', '').trim();
  const label = `(-${discClean} OFF)`;
  return (
    <View style={styles.magaluDiscountBadge}>
      <Ionicons name="pricetag" size={10} color="#0086FF" style={{ marginRight: 3 }} />
      <Text style={styles.magaluDiscountBadgeText}>{label}</Text>
    </View>
  );
};

export const parseMagaluInfo = (title = '', url = '') => {
  const isMagalu = (url && (url.toLowerCase().includes('magazineluiza.com.br') || url.toLowerCase().includes('magalu.com'))) ||
                   title.includes('Magalu') || title.includes('Magazine Luiza');
  let cleanTitle = title || '';
  let isFull = cleanTitle.includes('• ⚡ Full') || cleanTitle.includes('[Full]');
  let isFreteGratis = cleanTitle.includes('• 🚚 Frete Grátis') || cleanTitle.includes('[Frete Grátis]');
  let desconto = null;
  let score = null;
  let origem = null;

  // Extrair avaliação ⭐ x.x ou ⭐ x
  const starMatch = cleanTitle.match(/(?:•\s*)?(?:\[⭐\s*([1-5](?:\.[0-9]+)?)\]|⭐\s*([1-5](?:\.[0-9]+)?))/);
  if (starMatch) {
    score = starMatch[1] || starMatch[2];
    cleanTitle = cleanTitle.replace(starMatch[0], '').trim();
  }

  // Extrai desconto (% OFF)
  const discMatch = cleanTitle.match(/•?\s*(-?\d+%\s*OFF|-?\d+%\s*off|-?\d+%|\[-\d+%\s*OFF\])/i);
  if (discMatch) {
    const raw = discMatch[1].replace(/\[|\]/g, '').replace(/off/i, '').replace('-', '').trim();
    desconto = raw;
    cleanTitle = cleanTitle.replace(discMatch[0], '').trim();
  }

  if (cleanTitle.includes('• 📍 Internacional') || cleanTitle.includes('[INTER]')) {
    origem = 'Internacional';
  } else if (cleanTitle.includes('• 📍 Nacional') || cleanTitle.includes('[NAC]')) {
    origem = 'Nacional';
  }

  cleanTitle = cleanTitle
    .replace(/•\s*⚡\s*Full/gi, '')
    .replace(/\[Full\]/gi, '')
    .replace(/•\s*🚚\s*Frete\s*Grátis/gi, '')
    .replace(/\[Frete\s*Grátis\]/gi, '')
    .replace(/•\s*📍\s*Nacional/gi, '')
    .replace(/\[NAC\]/gi, '')
    .replace(/•\s*📍\s*Internacional/gi, '')
    .replace(/\[INTER\]/gi, '')
    .replace(/\s*•\s*$/, '')
    .replace(/^\s*•\s*/, '')
    .trim();

  return { cleanTitle, isFull, isFreteGratis, desconto, score, origem };
};

export const StrategyBadge = ({ text, color = THEME.textMuted }) => (
  <View style={styles.strategyBadge}>
    <Ionicons name="sparkles-outline" size={11} color={THEME.primary} style={{ marginRight: 4 }} />
    <Text style={[styles.strategyBadgeText, { color }]} numberOfLines={1}>{text}</Text>
  </View>
);

export const TierBadge = ({ tier = 'free', onPress, size = 'md', showCrown = true }) => {
  const isFree = tier === 'free';
  const isLite = tier === 'premium_lite';
  const isPremium = tier === 'premium';
  const isAdmin = tier === 'admin';

  let config = {
    label: 'FREE',
    icon: 'shield-outline',
    color: THEME.textMuted,
    bg: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.12)'
  };

  if (isLite) {
    config = {
      label: 'LITE 2D',
      icon: 'time',
      color: THEME.info,
      bg: THEME.infoBg,
      border: 'rgba(6, 182, 212, 0.35)'
    };
  } else if (isPremium) {
    config = {
      label: 'PREMIUM',
      icon: 'diamond',
      color: THEME.primary,
      bg: THEME.primaryGlow,
      border: 'rgba(255, 122, 0, 0.45)'
    };
  } else if (isAdmin) {
    config = {
      label: 'ADMIN',
      icon: 'key',
      color: '#C084FC',
      bg: 'rgba(168, 85, 247, 0.18)',
      border: 'rgba(168, 85, 247, 0.45)'
    };
  }

  const isSmall = size === 'sm';

  const content = (
    <View style={[
      styles.tierBadgeWrap,
      { backgroundColor: config.bg, borderColor: config.border },
      isSmall && styles.tierBadgeWrapSm
    ]}>
      <Ionicons 
        name={config.icon} 
        size={isSmall ? 10 : 12} 
        color={config.color} 
        style={{ marginRight: 4 }} 
      />
      <Text style={[
        styles.tierBadgeText, 
        { color: config.color },
        isSmall && styles.tierBadgeTextSm
      ]}>
        {config.label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
};


// =====================================================================
// 4. CABEÇALHOS E TÍTULOS
// =====================================================================

export const SectionHeader = ({ title, actionText, onAction, icon }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={styles.sectionTitleGroup}>
      {icon && <Ionicons name={icon} size={15} color={THEME.primary} style={{ marginRight: 6 }} />}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {actionText && onAction && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
        <Text style={styles.sectionLink}>{actionText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// =====================================================================
// 5. CAIXA DE MÉTRICAS (EXECUTIVE KPI)
// =====================================================================

export const MetricBox = ({ 
  icon, 
  value, 
  label, 
  sublabel, 
  color = THEME.primary, 
  bg = THEME.primaryGlow, 
  onPress,
  style 
}) => {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container 
      style={[styles.metricBoxWrapper, style]} 
      onPress={onPress} 
      activeOpacity={onPress ? 0.8 : 1}
    >
      <Surface style={styles.metricBoxSurface}>
        <View style={[styles.metricIconBadge, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text 
          style={styles.metricValue} 
          numberOfLines={1} 
          adjustsFontSizeToFit 
          minimumFontScale={0.7}
        >
          {value}
        </Text>
        <Text 
          style={styles.metricLabel} 
          numberOfLines={1} 
          adjustsFontSizeToFit 
          minimumFontScale={0.75}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text 
            style={styles.metricSublabel} 
            numberOfLines={1} 
            adjustsFontSizeToFit 
            minimumFontScale={0.75}
          >
            {sublabel}
          </Text>
        ) : null}
      </Surface>
    </Container>
  );
};

// =====================================================================
// 6. ESTILOS DO DESIGN SYSTEM
// =====================================================================

const styles = StyleSheet.create({
  surface: {
    backgroundColor: THEME.cardBg,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 16,
    marginBottom: 12
  },
  surfaceElevated: {
    backgroundColor: THEME.cardBgElevated,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  surfaceActive: {
    borderColor: THEME.cardBorderActive,
    backgroundColor: THEME.cardBgElevated
  },
  surfaceGlow: {
    borderColor: THEME.cardBorderActive,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4
  },

  // Botões
  btnBase: {
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20
  },
  btnSm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.sm
  },
  btnLg: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: THEME.radius.md
  },
  btnPrimary: {
    backgroundColor: THEME.primary,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  btnSecondary: {
    backgroundColor: THEME.cardBgElevated,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  btnDanger: {
    backgroundColor: THEME.dangerBg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)'
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnText: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.3
  },
  btnTextSm: {
    fontSize: 12
  },
  btnTextLg: {
    fontSize: 16
  },
  btnPrimaryText: {
    color: '#08090D'
  },
  btnSecondaryText: {
    color: THEME.text
  },
  btnDangerText: {
    color: THEME.danger
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },

  // Badges
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
    alignSelf: 'flex-start'
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  platformBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  shopeeOriginBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  shopeeOriginBadgeNac: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)'
  },
  shopeeOriginBadgeInter: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.35)'
  },
  shopeeOriginBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  shopeeOriginBadgeTextNac: {
    color: '#10B981'
  },
  shopeeOriginBadgeTextInter: {
    color: '#3B82F6'
  },
  shopeeDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(238, 77, 45, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(238, 77, 45, 0.4)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  shopeeDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EE4D2D',
    letterSpacing: 0.3
  },
  shopeeRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 187, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 187, 0, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  shopeeRatingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFBB00',
    letterSpacing: 0.3
  },
  shopeeSalesBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D1D5DB'
  },
  mlFullBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 166, 80, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 166, 80, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  mlFullBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00A650',
    letterSpacing: 0.3
  },
  mlFreeShippingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  mlFreeShippingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.3
  },
  mlDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 166, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 166, 80, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  mlDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00A650',
    letterSpacing: 0.3
  },
  amzPrimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 168, 225, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 168, 225, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  amzPrimeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00A8E1',
    letterSpacing: 0.3
  },
  amzFreeShippingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  amzFreeShippingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.3
  },
  amzDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 153, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 153, 0, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  amzDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF9900',
    letterSpacing: 0.3
  },
  magaluFullBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 134, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 134, 255, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  magaluFullBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0086FF',
    letterSpacing: 0.3
  },
  magaluFreeShippingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  magaluFreeShippingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.3
  },
  magaluDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 134, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 134, 255, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  magaluDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0086FF',
    letterSpacing: 0.3
  },
  strategyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  strategyBadgeText: {
    fontSize: 11,
    fontWeight: '500'
  },

  // Cabeçalhos
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textSecondary,
    letterSpacing: 1.1,
    textTransform: 'uppercase'
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.primary
  },

  // Caixa de Métrica
  metricBoxWrapper: {
    flex: 1,
    marginHorizontal: 3,
  },
  metricBoxSurface: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    width: '100%',
    minHeight: 110,
  },
  metricIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: 0.3,
    textAlign: 'center'
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    marginTop: 2,
    textAlign: 'center'
  },
  metricSublabel: {
    fontSize: 9,
    fontWeight: '600',
    color: THEME.textSubtle,
    marginTop: 2,
    textAlign: 'center'
  },

  // Tier Badge
  tierBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
    borderWidth: 1
  },
  tierBadgeWrapSm: {
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  tierBadgeTextSm: {
    fontSize: 9
  }
});

