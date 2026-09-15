import React, { useState, useMemo, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions,
  Image, Animated, Vibration, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from './theme';
import { calcularFreteGratisInfo } from './recommendationService';

// =====================================================================
// HEADER PADRONIZADO E ENCAPSULADO PARA TODAS AS TELAS (AchôAI Top Bar)
// =====================================================================
export const AppTopHeader = ({ 
  user, 
  userProfile = null,
  onPressProfile = null,
  subtitle = null, 
  rightAction = null, 
  onOpenNotif, 
  onOpenSettings, 
  unreadCount = 0, 
  style 
}) => {
  const isLogged = Boolean(user);

  // Extrai o primeiro nome de forma limpa, sem qualquer nome fixo
  const nomeCompleto = userProfile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const primeiroNome = nomeCompleto 
    ? nomeCompleto.trim().split(' ')[0] 
    : (user?.email ? user.email.split('@')[0] : '');

  const fotoPerfil = userProfile?.photoUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  return (
    <View style={[styles.pechTopHeader, style]}>
      {/* Área do Usuário / Convite para Login */}
      <TouchableOpacity 
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}
        onPress={onPressProfile}
        activeOpacity={0.7}
      >
        <View style={styles.pechAvatarRing}>
          {fotoPerfil ? (
            <Image source={{ uri: fotoPerfil }} style={styles.pechAvatarImg} />
          ) : (
            <View style={styles.pechAvatarInner}>
              <Ionicons name={isLogged ? "person" : "person-add-outline"} size={16} color="#FF5722" />
            </View>
          )}
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          {isLogged ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.pechGreetingSub}>Olá, </Text>
                <Text style={styles.pechGreetingName} numberOfLines={1}>{primeiroNome}</Text>
                <Ionicons name="shield-checkmark" size={14} color="#16A34A" style={{ marginLeft: 4 }} />
              </View>
              {subtitle ? (
                <Text style={styles.pechGreetingSubline} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : (
                <Text style={styles.pechGreetingSubline} numberOfLines={1}>
                  Conta sincronizada
                </Text>
              )}
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.pechGreetingLoginTitle} numberOfLines={1}>
                  Entre ou crie sua conta
                </Text>
                <Ionicons name="sparkles" size={12} color="#FF5722" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.pechGreetingLoginSub} numberOfLines={1}>
                Sincronize seus radares em qualquer lugar ›
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>

      {/* Ações da Direita: Notificações & Configurações */}
      {rightAction ? (
        <View style={styles.pechHeaderRightAction}>
          {rightAction}
        </View>
      ) : (
        <View style={styles.pechHeaderRightActions}>
          {onOpenNotif && (
            <TouchableOpacity 
              style={styles.headerIconBtn} 
              onPress={onOpenNotif}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="notifications-outline" size={22} color="#0F172A" />
              {unreadCount > 0 && (
                <View style={styles.headerNotifBadge}>
                  <Text style={styles.headerNotifBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {onOpenSettings && (
            <TouchableOpacity 
              style={styles.headerIconBtn} 
              onPress={onOpenSettings}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="settings-outline" size={22} color="#0F172A" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

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

export const KabumFreeShippingBadge = () => (
  <View style={styles.kabumFreeShippingBadge}>
    <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
    <Text style={styles.kabumFreeShippingBadgeText}>Frete Grátis</Text>
  </View>
);

export const KabumDiscountBadge = ({ discount }) => {
  if (!discount) return null;
  const discClean = String(discount).replace('-', '').replace('OFF', '').replace('off', '').trim();
  const label = `(-${discClean} OFF)`;
  return (
    <View style={styles.kabumDiscountBadge}>
      <Ionicons name="pricetag" size={10} color="#FF6500" style={{ marginRight: 3 }} />
      <Text style={styles.kabumDiscountBadgeText}>{label}</Text>
    </View>
  );
};

export const parseKabumInfo = (title = '', url = '') => {
  let cleanTitle = title || '';
  let isFreteGratis = cleanTitle.includes('• 🚚 Frete Grátis') || cleanTitle.includes('[Frete Grátis]');
  let desconto = null;
  let score = null;

  const starMatch = cleanTitle.match(/(?:•\s*)?(?:\[⭐\s*([1-5](?:\.[0-9]+)?)\]|⭐\s*([1-5](?:\.[0-9]+)?))/);
  if (starMatch) {
    score = starMatch[1] || starMatch[2];
    cleanTitle = cleanTitle.replace(starMatch[0], '').trim();
  }

  const discMatch = cleanTitle.match(/•?\s*(-?\d+%\s*OFF|-?\d+%\s*off|-?\d+%|\[-\d+%\s*OFF\])/i);
  if (discMatch) {
    const raw = discMatch[1].replace(/\[|\]/g, '').replace(/off/i, '').replace('-', '').trim();
    desconto = raw;
    cleanTitle = cleanTitle.replace(discMatch[0], '').trim();
  }

  cleanTitle = cleanTitle
    .replace(/•\s*🚚\s*Frete\s*Grátis/gi, '')
    .replace(/\[Frete\s*Grátis\]/gi, '')
    .replace(/\s*•\s*$/, '')
    .replace(/^\s*•\s*/, '')
    .trim();

  return { cleanTitle, isFreteGratis, desconto, score };
};

export const AmericanasFastDeliveryBadge = () => (
  <View style={styles.ameFastBadge}>
    <Ionicons name="flash" size={10} color="#E60014" style={{ marginRight: 3 }} />
    <Text style={styles.ameFastBadgeText}>Entrega Rápida</Text>
  </View>
);

export const AmericanasFreeShippingBadge = () => (
  <View style={styles.ameFreeShippingBadge}>
    <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
    <Text style={styles.ameFreeShippingBadgeText}>Frete Grátis</Text>
  </View>
);

export const AmericanasDiscountBadge = ({ discount }) => {
  if (!discount) return null;
  const discClean = String(discount).replace('-', '').replace('OFF', '').replace('off', '').trim();
  const label = `(-${discClean} OFF)`;
  return (
    <View style={styles.ameDiscountBadge}>
      <Ionicons name="pricetag" size={10} color="#E60014" style={{ marginRight: 3 }} />
      <Text style={styles.ameDiscountBadgeText}>{label}</Text>
    </View>
  );
};

export const parseAmericanasInfo = (title = '', url = '') => {
  let cleanTitle = title || '';
  let isEntregaRapida = cleanTitle.includes('• ⚡ Entrega Rápida') || cleanTitle.includes('[Entrega Rápida]');
  let isFreteGratis = cleanTitle.includes('• 🚚 Frete Grátis') || cleanTitle.includes('[Frete Grátis]');
  let desconto = null;
  let score = null;

  const starMatch = cleanTitle.match(/(?:•\s*)?(?:\[⭐\s*([1-5](?:\.[0-9]+)?)\]|⭐\s*([1-5](?:\.[0-9]+)?))/);
  if (starMatch) {
    score = starMatch[1] || starMatch[2];
    cleanTitle = cleanTitle.replace(starMatch[0], '').trim();
  }

  const discMatch = cleanTitle.match(/•?\s*(-?\d+%\s*OFF|-?\d+%\s*off|-?\d+%|\[-\d+%\s*OFF\])/i);
  if (discMatch) {
    const raw = discMatch[1].replace(/\[|\]/g, '').replace(/off/i, '').replace('-', '').trim();
    desconto = raw;
    cleanTitle = cleanTitle.replace(discMatch[0], '').trim();
  }

  cleanTitle = cleanTitle
    .replace(/•\s*⚡\s*Entrega\s*Rápida/gi, '')
    .replace(/\[Entrega\s*Rápida\]/gi, '')
    .replace(/•\s*🚚\s*Frete\s*Grátis/gi, '')
    .replace(/\[Frete\s*Grátis\]/gi, '')
    .replace(/\s*•\s*$/, '')
    .replace(/^\s*•\s*/, '')
    .trim();

  return { cleanTitle, isEntregaRapida, isFreteGratis, desconto, score };
};

export const SheinBestSellerBadge = () => (
  <View style={styles.sheinBestSellerBadge}>
    <Ionicons name="flame" size={10} color="#F59E0B" style={{ marginRight: 3 }} />
    <Text style={styles.sheinBestSellerBadgeText}>Mais Vendidos</Text>
  </View>
);

export const SheinDiscountBadge = ({ discount }) => {
  if (!discount) return null;
  const discClean = String(discount).replace('-', '').replace('OFF', '').replace('off', '').trim();
  const label = `(-${discClean} OFF)`;
  return (
    <View style={styles.sheinDiscountBadge}>
      <Ionicons name="pricetag" size={10} color="#E2E8F0" style={{ marginRight: 3 }} />
      <Text style={styles.sheinDiscountBadgeText}>{label}</Text>
    </View>
  );
};

export const parseSheinInfo = (title = '', url = '') => {
  let cleanTitle = title || '';
  let origem = null;
  let isMaisVendidos = cleanTitle.includes('• 🔥 Mais Vendidos') || cleanTitle.includes('[Mais Vendidos]');
  let desconto = null;
  let score = null;

  if (cleanTitle.includes('• 📍 Internacional') || cleanTitle.includes('[INTER]')) {
    origem = 'Internacional';
  } else if (cleanTitle.includes('• 📍 Nacional') || cleanTitle.includes('[NAC]')) {
    origem = 'Nacional';
  }

  const starMatch = cleanTitle.match(/(?:•\s*)?(?:\[⭐\s*([1-5](?:\.[0-9]+)?)\]|⭐\s*([1-5](?:\.[0-9]+)?))/);
  if (starMatch) {
    score = starMatch[1] || starMatch[2];
    cleanTitle = cleanTitle.replace(starMatch[0], '').trim();
  }

  const discMatch = cleanTitle.match(/•?\s*(-?\d+%\s*OFF|-?\d+%\s*off|-?\d+%|\[-\d+%\s*OFF\])/i);
  if (discMatch) {
    const raw = discMatch[1].replace(/\[|\]/g, '').replace(/off/i, '').replace('-', '').trim();
    desconto = raw;
    cleanTitle = cleanTitle.replace(discMatch[0], '').trim();
  }

  cleanTitle = cleanTitle
    .replace(/•\s*📍\s*Nacional/gi, '')
    .replace(/\[NAC\]/gi, '')
    .replace(/•\s*📍\s*Internacional/gi, '')
    .replace(/\[INTER\]/gi, '')
    .replace(/•\s*🔥\s*Mais\s*Vendidos/gi, '')
    .replace(/\[Mais\s*Vendidos\]/gi, '')
    .replace(/\s*•\s*$/, '')
    .replace(/^\s*•\s*/, '')
    .trim();

  return { cleanTitle, origem, isMaisVendidos, desconto, score };
};

export const FastShopDiscountBadge = ({ discount }) => {
  if (!discount) return null;
  const discClean = String(discount).replace('-', '').replace('OFF', '').replace('off', '').trim();
  const label = `(-${discClean} OFF)`;
  return (
    <View style={styles.fastshopDiscountBadge}>
      <Ionicons name="pricetag" size={10} color="#E30613" style={{ marginRight: 3 }} />
      <Text style={styles.fastshopDiscountBadgeText}>{label}</Text>
    </View>
  );
};

export const parseFastShopInfo = (title = '', url = '') => {
  let cleanTitle = title || '';
  let desconto = null;
  let score = null;

  const starMatch = cleanTitle.match(/(?:•\s*)?(?:\[⭐\s*([1-5](?:\.[0-9]+)?)\]|⭐\s*([1-5](?:\.[0-9]+)?))/);
  if (starMatch) {
    score = starMatch[1] || starMatch[2];
    cleanTitle = cleanTitle.replace(starMatch[0], '').trim();
  }

  const discMatch = cleanTitle.match(/•?\s*(-?\d+%\s*OFF|-?\d+%\s*off|-?\d+%|\[-\d+%\s*OFF\])/i);
  if (discMatch) {
    const raw = discMatch[1].replace(/\[|\]/g, '').replace(/off/i, '').replace('-', '').trim();
    desconto = raw;
    cleanTitle = cleanTitle.replace(discMatch[0], '').trim();
  }

  cleanTitle = cleanTitle
    .replace(/\s*•\s*$/, '')
    .replace(/^\s*•\s*/, '')
    .trim();

  return { cleanTitle, desconto, score };
};

export const CarrefourFreeShippingBadge = () => (
  <View style={styles.carrefourFreeShippingBadge}>
    <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
    <Text style={styles.carrefourFreeShippingBadgeText}>Frete Grátis</Text>
  </View>
);

export const CarrefourInstallmentBadge = ({ parcelamento }) => {
  if (!parcelamento) return null;
  return (
    <View style={styles.carrefourInstallmentBadge}>
      <Ionicons name="card-outline" size={10} color="#60A5FA" style={{ marginRight: 3 }} />
      <Text style={styles.carrefourInstallmentBadgeText}>{parcelamento}</Text>
    </View>
  );
};

export const CarrefourDiscountBadge = ({ discount }) => {
  if (!discount) return null;
  const discClean = String(discount).replace('-', '').replace('OFF', '').replace('off', '').trim();
  const label = `(-${discClean} OFF)`;
  return (
    <View style={styles.carrefourDiscountBadge}>
      <Ionicons name="pricetag" size={10} color="#3B82F6" style={{ marginRight: 3 }} />
      <Text style={styles.carrefourDiscountBadgeText}>{label}</Text>
    </View>
  );
};

export const CarrefourBestSellerBadge = () => (
  <View style={styles.carrefourBestSellerBadge}>
    <Ionicons name="flame" size={10} color="#F59E0B" style={{ marginRight: 3 }} />
    <Text style={styles.carrefourBestSellerBadgeText}>Mais Vendidos</Text>
  </View>
);

export const parseCarrefourInfo = (title = '', url = '') => {
  let cleanTitle = title || '';
  let isFreteGratis = cleanTitle.includes('• 🚚 Frete Grátis') || cleanTitle.includes('[Frete Grátis]');
  let isMaisVendidos = cleanTitle.includes('• 🔥 Mais Vendidos') || cleanTitle.includes('[Mais Vendidos]');
  let parcelamento = null;
  let desconto = null;

  const parcMatch = cleanTitle.match(/(?:•\s*)?(?:\[💳\s*([^\]]+)\]|💳\s*([^•\n]+))/);
  if (parcMatch) {
    parcelamento = (parcMatch[1] || parcMatch[2]).trim();
    cleanTitle = cleanTitle.replace(parcMatch[0], '').trim();
  }

  const discMatch = cleanTitle.match(/•?\s*(-?\d+%\s*OFF|-?\d+%\s*off|-?\d+%|\[-\d+%\s*OFF\])/i);
  if (discMatch) {
    const raw = discMatch[1].replace(/\[|\]/g, '').replace(/off/i, '').replace('-', '').trim();
    desconto = raw;
    cleanTitle = cleanTitle.replace(discMatch[0], '').trim();
  }

  cleanTitle = cleanTitle
    .replace(/•\s*🚚\s*Frete\s*Grátis/gi, '')
    .replace(/\[Frete\s*Grátis\]/gi, '')
    .replace(/•\s*🔥\s*Mais\s*Vendidos/gi, '')
    .replace(/\[Mais\s*Vendidos\]/gi, '')
    .replace(/\s*•\s*$/, '')
    .replace(/^\s*•\s*/, '')
    .trim();

  return { cleanTitle, isFreteGratis, isMaisVendidos, parcelamento, desconto };
};

export const CasasBahiaFreeShippingBadge = () => (
  <View style={styles.casasbahiaFreeShippingBadge}>
    <Ionicons name="car-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
    <Text style={styles.casasbahiaFreeShippingBadgeText}>Frete Grátis</Text>
  </View>
);

export const CasasBahiaInstallmentBadge = ({ parcelamento }) => {
  if (!parcelamento) return null;
  return (
    <View style={styles.casasbahiaInstallmentBadge}>
      <Ionicons name="card-outline" size={10} color="#60A5FA" style={{ marginRight: 3 }} />
      <Text style={styles.casasbahiaInstallmentBadgeText}>{parcelamento}</Text>
    </View>
  );
};

export const CasasBahiaDiscountBadge = ({ discount }) => {
  if (!discount) return null;
  const discClean = String(discount).replace('-', '').replace('OFF', '').replace('off', '').trim();
  const label = `(-${discClean} OFF)`;
  return (
    <View style={styles.casasbahiaDiscountBadge}>
      <Ionicons name="pricetag" size={10} color="#60A5FA" style={{ marginRight: 3 }} />
      <Text style={styles.casasbahiaDiscountBadgeText}>{label}</Text>
    </View>
  );
};

export const CasasBahiaBestSellerBadge = () => (
  <View style={styles.casasbahiaBestSellerBadge}>
    <Ionicons name="flame" size={10} color="#F59E0B" style={{ marginRight: 3 }} />
    <Text style={styles.casasbahiaBestSellerBadgeText}>Mais Vendidos</Text>
  </View>
);

export const parseCasasBahiaInfo = (title = '', url = '') => {
  let cleanTitle = title || '';
  let isFreteGratis = cleanTitle.includes('• 🚚 Frete Grátis') || cleanTitle.includes('[Frete Grátis]');
  let isMaisVendidos = cleanTitle.includes('• 🔥 Mais Vendidos') || cleanTitle.includes('[Mais Vendidos]');
  let parcelamento = null;
  let desconto = null;

  const parcMatch = cleanTitle.match(/(?:•\s*)?(?:\[💳\s*([^\]]+)\]|💳\s*([^•\n]+))/);
  if (parcMatch) {
    parcelamento = (parcMatch[1] || parcMatch[2]).trim();
    cleanTitle = cleanTitle.replace(parcMatch[0], '').trim();
  }

  const discMatch = cleanTitle.match(/•?\s*(-?\d+%\s*OFF|-?\d+%\s*off|-?\d+%|\[-\d+%\s*OFF\])/i);
  if (discMatch) {
    const raw = discMatch[1].replace(/\[|\]/g, '').replace(/off/i, '').replace('-', '').trim();
    desconto = raw;
    cleanTitle = cleanTitle.replace(discMatch[0], '').trim();
  }

  cleanTitle = cleanTitle
    .replace(/•\s*🚚\s*Frete\s*Grátis/gi, '')
    .replace(/\[Frete\s*Grátis\]/gi, '')
    .replace(/•\s*🔥\s*Mais\s*Vendidos/gi, '')
    .replace(/\[Mais\s*Vendidos\]/gi, '')
    .replace(/\s*•\s*$/, '')
    .replace(/^\s*•\s*/, '')
    .trim();

  return { cleanTitle, isFreteGratis, isMaisVendidos, parcelamento, desconto };
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
// =====================================================================
// 5. COMPONENTES E-COMMERCE & RADAR INTELIGENTE (ESTILO PECHINCHOU 2026)
// =====================================================================

export const LOGOS_PLATAFORMAS = {
  MERCADO_LIVRE: require('./assets/logos/mercadolivre.png'),
  MERCADOLIVRE: require('./assets/logos/mercadolivre.png'),
  AMAZON: require('./assets/logos/amazon.png'),
  SHOPEE: require('./assets/logos/shopee.png'),
  MAGALU: require('./assets/logos/magalu.png'),
  MAGAZINELUIZA: require('./assets/logos/magalu.png'),
  KABUM: require('./assets/logos/kabum.png'),
  AMERICANAS: require('./assets/logos/americanas.png'),
  CASASBAHIA: require('./assets/logos/casasbahia.png'),
  CASAS_BAHIA: require('./assets/logos/casasbahia.png'),
  FASTSHOP: require('./assets/logos/fastshop.png'),
  FAST_SHOP: require('./assets/logos/fastshop.png'),
  CARREFOUR: require('./assets/logos/carrefour.png'),
  SHEIN: require('./assets/logos/shein.png'),
  OLX: require('./assets/logos/olx.png'),
  FACEBOOK: require('./assets/logos/facebook.png'),
  FACEBOOK_MARKETPLACE: require('./assets/logos/facebook.png'),
  PETZ: require('./assets/logos/petz.png'),
  SHOPTIME: require('./assets/logos/shoptime.png'),
};

export const StoreLogoBadge = ({ storeKey, size = 22, style }) => {
  const rawKey = (storeKey || '').toUpperCase().replace(/[\s!-]/g, '_');
  let source = LOGOS_PLATAFORMAS[rawKey];
  
  if (!source) {
    if (rawKey.includes('MERCADO') || rawKey.includes('MELI')) source = LOGOS_PLATAFORMAS.MERCADO_LIVRE;
    else if (rawKey.includes('AMAZON') || rawKey.includes('AMZN')) source = LOGOS_PLATAFORMAS.AMAZON;
    else if (rawKey.includes('SHOPEE') || rawKey.includes('SHP')) source = LOGOS_PLATAFORMAS.SHOPEE;
    else if (rawKey.includes('MAGALU') || rawKey.includes('MAGAZINE')) source = LOGOS_PLATAFORMAS.MAGALU;
    else if (rawKey.includes('KABUM')) source = LOGOS_PLATAFORMAS.KABUM;
    else if (rawKey.includes('AMERICANAS')) source = LOGOS_PLATAFORMAS.AMERICANAS;
    else if (rawKey.includes('CASAS') || rawKey.includes('BAHIA')) source = LOGOS_PLATAFORMAS.CASASBAHIA;
    else if (rawKey.includes('FAST')) source = LOGOS_PLATAFORMAS.FASTSHOP;
    else if (rawKey.includes('CARREFOUR')) source = LOGOS_PLATAFORMAS.CARREFOUR;
    else if (rawKey.includes('SHEIN')) source = LOGOS_PLATAFORMAS.SHEIN;
    else if (rawKey.includes('OLX')) source = LOGOS_PLATAFORMAS.OLX;
    else if (rawKey.includes('FACEBOOK') || rawKey.includes('MARKETPLACE') || rawKey.includes('FB')) source = LOGOS_PLATAFORMAS.FACEBOOK;
    else if (rawKey.includes('PETZ')) source = LOGOS_PLATAFORMAS.PETZ;
    else if (rawKey.includes('SHOPTIME')) source = LOGOS_PLATAFORMAS.SHOPTIME;
  }

  if (source) {
    return (
      <View style={[{ width: size, height: size, borderRadius: size * 0.28, overflow: 'hidden', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, style]}>
        <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name="storefront-outline" size={size * 0.6} color="#64748B" />
    </View>
  );
};

export const ProductDealCard = React.memo(({ 
  item, 
  onPress, 
  onToggleFavorite,
  style 
}) => {
  const [imgError, setImgError] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  const precoFormatado = item?.preco 
    ? `R$ ${parseFloat(item.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
    : 'Sob Consulta';

  const precoOrigFormatado = item?.preco_original 
    ? `R$ ${parseFloat(item.preco_original).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
    : null;

  const lojaNome = item?.loja || 'Loja Parceira';
  
  // Apenas os Top 5 produtos fixados no topo da Home exibem a etiqueta DESTAQUE com estrela
  // Na aba de recomendações, a etiqueta de destaque com estrela é TERMINANTEMENTE REMOVIDA
  const showDestaqueBadge = Boolean(item?.is_top5 || item?.is_destaque_top5) && !item?.is_recomendacao;

  // Condição de pagamento ou parcelamento (realista com juros zero / Pix)
  const condicaoPagamento = useMemo(() => {
    if (item?.parcelamento) return item.parcelamento;
    const p = parseFloat(item?.preco || item?.price) || 0;
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
  }, [item?.parcelamento, item?.preco, item?.price]);

  // Regra de Frete Grátis com suporte a "Frete Grátis c/ cupom" (Shopee / SHEIN)
  const freteInfo = useMemo(() => {
    if (item?.frete_label !== undefined && item?.frete_label !== null) {
      return { temFreteGratis: Boolean(item.frete_gratis), freteLabel: item.frete_label, isCupom: Boolean(item.is_cupom_frete) };
    }
    return calcularFreteGratisInfo(
      lojaNome, 
      item?.preco || item?.price, 
      item?.destaque_label, 
      item?.titulo || item?.title
    );
  }, [item?.frete_label, item?.frete_gratis, item?.is_cupom_frete, lojaNome, item?.preco, item?.price, item?.destaque_label, item?.titulo, item?.title]);

  const [useProxyFallback, setUseProxyFallback] = useState(false);

  useEffect(() => {
    setImgError(false);
    setUseProxyFallback(false);
  }, [item?.imagem_url, item?.image, item?.foto, item?.thumbnail]);

  // Configuração visual de jargões oficiais exclusivos por plataforma (SEM duplicação de desconto %)
  const ribbonConfig = useMemo(() => {
    if (item?.is_recomendacao) {
      return null;
    }

    let raw = (item?.destaque_label || '').trim();
    let upper = raw.toUpperCase();

    // Se o texto contiver porcentagem (ex: "43% OFF", "-15%"), "OFF", "DESCONTO" ou for vazio ou genérico,
    // NÃO exiba como ribbon para não duplicar o badge de desconto já presente ao lado do preço!
    const isDiscountOrGeneric = !raw || upper.includes('%') || upper.includes('OFF') || upper.includes('DESCONTO') || upper === 'OFERTA VERIFICADA' || upper === 'PESQUISA_INTELIGENTE';

    if (isDiscountOrGeneric) {
      // Aplica o jargão oficial exclusivo da loja
      const lojaUpper = (lojaNome || '').toUpperCase();
      if (lojaUpper.includes('AMAZON')) {
        return { icon: 'star', bg: '#EFF6FF', border: '#BAE6FD', text: '#0284C7', label: 'Prime' };
      }
      if (lojaUpper.includes('MERCADO LIVRE')) {
        return { icon: 'flash', bg: '#FEF08A', border: '#FDE047', text: '#854D0E', label: 'FULL' };
      }
      if (lojaUpper.includes('MAGALU') || lojaUpper.includes('MAGAZINE')) {
        return { icon: 'checkmark-done', bg: '#EFF6FF', border: '#DBEAFE', text: '#0284C7', label: 'Magalu Indica' };
      }
      if (lojaUpper.includes('SHOPEE')) {
        return { icon: 'star', bg: '#FFF7ED', border: '#FFEDD5', text: '#EA580C', label: 'Indicado Shopee' };
      }
      if (lojaUpper.includes('KABUM')) {
        return { icon: 'flash', bg: '#0F172A', border: '#334155', text: '#F8FAFC', label: 'Ninja KaBuM!' };
      }
      if (lojaUpper.includes('CASAS BAHIA')) {
        return { icon: 'ribbon', bg: '#EFF6FF', border: '#DBEAFE', text: '#1D4ED8', label: 'Oferta VIP' };
      }
      if (lojaUpper.includes('FAST SHOP')) {
        return { icon: 'star', bg: '#F8FAFC', border: '#E2E8F0', text: '#0F172A', label: 'Fast Prime' };
      }
      if (lojaUpper.includes('CARREFOUR')) {
        return { icon: 'trending-down', bg: '#FEF2F2', border: '#FEE2E2', text: '#DC2626', label: 'Preço Baixo' };
      }
      if (lojaUpper.includes('SHEIN')) {
        return { icon: 'sparkles', bg: '#FFF1F2', border: '#FFE4E6', text: '#E11D48', label: 'Tendência SHEIN' };
      }
      if (lojaUpper.includes('OLX') || lojaUpper.includes('FACEBOOK')) {
        return { icon: 'repeat', bg: '#F1F5F9', border: '#E2E8F0', text: '#475569', label: 'Seminovo' };
      }
      // Se não tem jargão aplicável, NÃO exibe nada!
      return null;
    }

    // Se já tiver um jargão explícito que NÃO seja desconto:
    if (upper.includes('NINJA')) {
      return { icon: 'flash', bg: '#0F172A', border: '#334155', text: '#F8FAFC', label: 'Ninja KaBuM!' };
    }
    if (upper.includes('FULL')) {
      return { icon: 'flash', bg: '#FEF08A', border: '#FDE047', text: '#854D0E', label: 'FULL' };
    }
    if (upper.includes('MAGALU INDICA')) {
      return { icon: 'checkmark-done', bg: '#EFF6FF', border: '#DBEAFE', text: '#0284C7', label: 'Magalu Indica' };
    }
    if (upper.includes('SHOPEE') || upper.includes('INDICADO SHOPEE')) {
      return { icon: 'star', bg: '#FFF7ED', border: '#FFEDD5', text: '#EA580C', label: 'Indicado Shopee' };
    }
    if (upper.includes('OFERTA VIP') || upper.includes('VIP')) {
      return { icon: 'ribbon', bg: '#EFF6FF', border: '#DBEAFE', text: '#1D4ED8', label: 'Oferta VIP' };
    }
    if (upper.includes('FAST PRIME')) {
      return { icon: 'star', bg: '#F8FAFC', border: '#E2E8F0', text: '#0F172A', label: 'Fast Prime' };
    }
    if (upper.includes('PREÇO BAIXO') || upper.includes('PRECO BAIXO')) {
      return { icon: 'trending-down', bg: '#FEF2F2', border: '#FEE2E2', text: '#DC2626', label: 'Preço Baixo' };
    }
    if (upper.includes('PRIME')) {
      return { icon: 'star', bg: '#EFF6FF', border: '#BAE6FD', text: '#0284C7', label: 'Prime' };
    }
    if (upper.includes('SHEIN') || upper.includes('TENDÊNCIA') || upper.includes('TENDENCIA')) {
      return { icon: 'sparkles', bg: '#FFF1F2', border: '#FFE4E6', text: '#E11D48', label: 'Tendência SHEIN' };
    }
    if (upper.includes('SEMINOVO') || upper.includes('USADO')) {
      return { icon: 'repeat', bg: '#F1F5F9', border: '#E2E8F0', text: '#475569', label: 'Seminovo' };
    }
    if (upper.includes('MAIS VENDIDO')) {
      return { icon: 'flame', bg: '#FEF3C7', border: '#FDE68A', text: '#D97706', label: 'Mais Vendido' };
    }

    return null;
  }, [item?.destaque_label, item?.is_recomendacao, lojaNome]);

  const imagemResolvida = useMemo(() => {
    let u = (item?.imagem_url || item?.image || item?.foto || item?.thumbnail || '').trim();
    if (!u) return null;
    if (u.startsWith('//')) {
      u = 'https:' + u;
    } else if (u.startsWith('http://')) {
      u = 'https://' + u.slice(7);
    }
    if (u.includes('{w}x{h}')) {
      u = u.replace('{w}x{h}', '800x560');
    }
    // Remove proxy do DuckDuckGo se já estiver embutido para permitir headers nativos
    if (u.includes('proxy.duckduckgo.com')) {
      try {
        const match = u.match(/[?&]u=([^&]+)/);
        if (match && match[1]) {
          u = decodeURIComponent(match[1]);
        }
      } catch (e) {}
    }
    return u;
  }, [item?.imagem_url, item?.image, item?.foto, item?.thumbnail]);

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
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile)'
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

  return (
    <TouchableOpacity 
      style={[styles.pechCardContainer, style]} 
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Topo do Card: Logo Loja + Nome + Verificado (100% Horizontal) */}
      <View style={styles.pechCardTopRow}>
        <View style={styles.pechCardStoreBox}>
          <StoreLogoBadge storeKey={lojaNome} size={20} style={{ marginRight: 6 }} />
          <Text style={styles.pechCardStoreName}>{lojaNome}</Text>
          <Ionicons name="checkmark-circle" size={14} color="#0F172A" style={{ marginLeft: 5 }} />
        </View>

        {ribbonConfig && !item?.is_recomendacao && (
          <View style={[styles.pechCardRibbonPill, { backgroundColor: ribbonConfig.bg, borderColor: ribbonConfig.border }]}>
            <Ionicons name={ribbonConfig.icon} size={10} color={ribbonConfig.text} style={{ marginRight: 3 }} />
            <Text style={[styles.pechCardRibbonPillText, { color: ribbonConfig.text }]}>{ribbonConfig.label}</Text>
          </View>
        )}
      </View>

      {/* Meio: Imagem na Esquerda, Detalhes na Direita */}
      <View style={styles.pechCardMiddleRow}>
        <View style={styles.pechCardImgBox}>
          {imageSource && !imgError ? (
            <Image 
              source={imageSource} 
              style={styles.pechCardImg} 
              resizeMode="contain" 
              onError={handleImageError}
            />
          ) : (
            <View style={styles.pechCardImgFallback}>
              <StoreLogoBadge storeKey={lojaNome} size={36} />
            </View>
          )}
        </View>

        <View style={styles.pechCardDetailsBox}>
          {/* Motivo Inteligente Padronizado (Ocultado em itens padrão/cumprir tabela) */}
          {item?.is_recomendacao && !item?.is_padrao && Boolean(item?.motivo_recomendacao || item?.destaque_label) && (
            <View style={styles.pechCardRecMotivePill}>
              <Ionicons name="sparkles" size={9} color="#E11D48" style={{ marginRight: 3, flexShrink: 0 }} />
              <Text 
                style={styles.pechCardRecMotiveText} 
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.65}
              >
                {item.motivo_recomendacao || item.destaque_label}
              </Text>
            </View>
          )}

          {showDestaqueBadge && (
            <View style={styles.pechCardDestaqueBadge}>
              <Ionicons name="star" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
              <Text style={styles.pechCardDestaqueBadgeText}>DESTAQUE</Text>
            </View>
          )}

          {(Boolean(item?.is_seminovo) || Boolean(item?.is_usado) || lojaNome === 'OLX' || lojaNome === 'Facebook Marketplace' || String(item?.destaque_label || '').includes('Seminovo')) && (
            <View style={styles.pechCardSeminovoBadge}>
              <Ionicons name="pricetag" size={10} color="#7C3AED" style={{ marginRight: 3 }} />
              <Text style={styles.pechCardSeminovoBadgeText}>Seminovo / Usado</Text>
            </View>
          )}

          <Text style={styles.pechCardTitle} numberOfLines={2}>
            {item?.titulo || 'Oferta Imperdível'}
          </Text>

          {item?.cupom && (
            <View style={styles.pechCardCouponPill}>
              <Ionicons name="ticket-outline" size={11} color="#E11D48" style={{ marginRight: 4 }} />
              <Text style={styles.pechCardCouponText}>{item.cupom}</Text>
            </View>
          )}

          {/* Linha do Preço: Preço Atual + Preço Cortado + Desconto % na DIREITA */}
          <View style={styles.pechCardPriceRow}>
            <Text style={styles.pechCardPrice}>{precoFormatado}</Text>
            {precoOrigFormatado && (
              <Text style={styles.pechCardOrigPrice}>{precoOrigFormatado}</Text>
            )}
            {item?.desconto_pct > 0 && (
              <View style={[styles.pechCardDiscountPill, { marginLeft: 6 }]}>
                <Text style={styles.pechCardDiscountText}>-{item.desconto_pct}%</Text>
              </View>
            )}
          </View>

          {/* Linha da Condição de Pagamento (sem juros / Pix) */}
          {condicaoPagamento && (
            <Text style={styles.pechCardPaymentCond} numberOfLines={1}>
              {condicaoPagamento}
            </Text>
          )}

          {item?.restam_unidades && (
            <Text style={styles.pechCardStockText} numberOfLines={1}>
              Restam apenas {item.restam_unidades} unid.
            </Text>
          )}

          {/* Linha de Benefícios: Frete Grátis com suporte a cupom */}
          {freteInfo.temFreteGratis && (
            <View style={styles.pechCardBenefitsRow}>
              <View style={styles.pechCardFreteRow}>
                <Ionicons 
                  name={freteInfo.isCupom ? "ticket-outline" : "car-outline"} 
                  size={11} 
                  color="#16A34A" 
                  style={{ marginRight: 3 }} 
                />
                <Text style={styles.pechCardFreteText}>{freteInfo.freteLabel}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Rodapé: Apenas Coração de Favorito + Botão Acessar Oferta */}
      <View style={styles.pechCardFooterRow}>
        <TouchableOpacity 
          style={styles.pechCardFavBtn}
          onPress={(e) => {
            e.stopPropagation();
            try { Vibration.vibrate(20); } catch(err) {}
            setIsFavorited(!isFavorited);
            if (onToggleFavorite) onToggleFavorite(item);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={isFavorited ? "heart" : "heart-outline"} 
            size={20} 
            color={isFavorited ? (item?.is_recomendacao ? "#E11D48" : "#FF5722") : "#94A3B8"} 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.pechCardVerMaisBtn, item?.is_recomendacao && { borderColor: '#FECDD3', backgroundColor: '#FFF1F2' }]}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={[styles.pechCardVerMaisBtnText, item?.is_recomendacao && { color: '#E11D48' }]}>
            {item?.is_recomendacao ? "Ver recomendação" : "Acessar oferta"}
          </Text>
          <Ionicons 
            name="chevron-forward" 
            size={13} 
            color={item?.is_recomendacao ? "#E11D48" : "#FF5722"} 
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

export const PlatformCircle = ({ 
  platformKey, 
  selected = false, 
  onToggle 
}) => {
  const plat = THEME.platforms[platformKey] || {
    nome: platformKey,
    sigla: platformKey,
    color: THEME.primary
  };

  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    try { Vibration.vibrate(25); } catch (e) {}
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.90, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true })
    ]).start();
    onToggle && onToggle();
  };

  return (
    <TouchableOpacity 
      style={styles.platformCircleItem} 
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <Animated.View style={[
        styles.platformCircleBubble,
        selected && styles.platformCircleBubbleSelected,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <StoreLogoBadge storeKey={platformKey} size={38} />

        {selected && (
          <View style={styles.platformCircleCheck}>
            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
          </View>
        )}
      </Animated.View>

      <Text 
        style={[styles.platformCircleLabel, selected && styles.platformCircleLabelSelected]} 
        numberOfLines={1}
      >
        {plat.sigla || plat.nome}
      </Text>
    </TouchableOpacity>
  );
};

export const PlatformBubble = PlatformCircle;

export const FrequencySelector = ({
  value = 15,
  onChange,
  lojaNome = 'Shopee'
}) => {
  const options = [
    { label: '15 min', value: 15, desc: 'Recomendado' },
    { label: '30 min', value: 30, desc: 'Rápido' },
    { label: '45 min', value: 45, desc: 'Equilibrado' },
    { label: '1 hora', value: 60, desc: 'Econômico' },
    { label: '6 horas', value: 360, desc: 'Periódico' },
    { label: '24 horas', value: 1440, desc: 'Diário' }
  ];

  return (
    <View style={styles.freqContainer}>
      <Text style={styles.freqHeaderTitle}>Frequência de Verificação</Text>
      <Text style={styles.freqHeaderSubtitle}>Escolha de quanto em quanto tempo o radar deve pesquisar novidades</Text>

      <View style={styles.freqGrid}>
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.freqCard,
                isSelected && styles.freqCardSelected
              ]}
              onPress={() => {
                try { Vibration.vibrate(20); } catch(e) {}
                onChange(opt.value);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.freqRadio, isSelected && styles.freqRadioSelected]}>
                {isSelected && <View style={styles.freqRadioInner} />}
              </View>
              <Text style={[styles.freqLabel, isSelected && styles.freqLabelSelected]}>{opt.label}</Text>
              <Text style={[styles.freqDesc, isSelected && styles.freqDescSelected]}>{opt.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.freqNoticeBox}>
        <Ionicons name="information-circle" size={20} color={THEME.primary} style={{ marginRight: 10, marginTop: 1 }} />
        <Text style={styles.freqNoticeText}>
          Fique tranquilo: caso a {lojaNome} não encontre novas ofertas nas verificações, você será avisado com total transparência e o radar continuará ativo.
        </Text>
      </View>
    </View>
  );
};

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
    color: '#FFFFFF'
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
  kabumFreeShippingBadge: {
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
  kabumFreeShippingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.3
  },
  kabumDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 101, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 101, 0, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  kabumDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6500',
    letterSpacing: 0.3
  },
  ameFastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(230, 0, 20, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(230, 0, 20, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  ameFastBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#E60014',
    letterSpacing: 0.3
  },
  ameFreeShippingBadge: {
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
  ameFreeShippingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.3
  },
  ameDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(230, 0, 20, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(230, 0, 20, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  ameDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E60014',
    letterSpacing: 0.3
  },
  sheinBestSellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  sheinBestSellerBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.3
  },
  sheinDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  sheinDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E2E8F0',
    letterSpacing: 0.3
  },
  fastshopDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(227, 6, 19, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(227, 6, 19, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  fastshopDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E30613',
    letterSpacing: 0.3
  },
  carrefourFreeShippingBadge: {
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
  carrefourFreeShippingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.3
  },
  carrefourInstallmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  carrefourInstallmentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA',
    letterSpacing: 0.3
  },
  carrefourDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 79, 159, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0, 79, 159, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  carrefourDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 0.3
  },
  carrefourBestSellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  carrefourBestSellerBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.3
  },
  casasbahiaFreeShippingBadge: {
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
  casasbahiaFreeShippingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.3
  },
  casasbahiaInstallmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  casasbahiaInstallmentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA',
    letterSpacing: 0.3
  },
  casasbahiaDiscountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 43, 127, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0, 43, 127, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  casasbahiaDiscountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#60A5FA',
    letterSpacing: 0.3
  },
  casasbahiaBestSellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    marginRight: 6
  },
  casasbahiaBestSellerBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#F59E0B',
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
  },

  // ProductDealCard
  productDealCard: {
    backgroundColor: THEME.cardBg,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: THEME.shadow.sm.shadowColor,
    shadowOffset: THEME.shadow.sm.shadowOffset,
    shadowOpacity: THEME.shadow.sm.shadowOpacity,
    shadowRadius: THEME.shadow.sm.shadowRadius,
    elevation: THEME.shadow.sm.elevation,
  },
  productDealImgContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  productDealImg: {
    width: '85%',
    height: '85%',
  },
  productDealImgPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  productDealHotBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  productDealHotBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginLeft: 4
  },
  productDealLojaBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    borderWidth: 1
  },
  productDealLojaBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  productDealBody: {
    padding: 14
  },
  productDealTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
    lineHeight: 20,
    marginBottom: 8
  },
  productDealPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  productDealPrecoOrig: {
    fontSize: 11,
    color: THEME.textSubtle,
    textDecorationLine: 'line-through',
    marginBottom: 2
  },
  productDealPreco: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.text
  },
  productDealDiscountTag: {
    backgroundColor: THEME.successBg,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.3)'
  },
  productDealDiscountTagText: {
    color: THEME.success,
    fontSize: 12,
    fontWeight: '900'
  },
  productDealTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10
  },
  productDealTagItem: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs
  },
  productDealTagItemText: {
    fontSize: 10,
    color: THEME.textSecondary,
    fontWeight: '600'
  },
  productDealActionRow: {
    marginTop: 4
  },
  productDealActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 9,
    borderRadius: THEME.radius.sm,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2
  },
  productDealActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    marginRight: 6
  },

  // PlatformBubble
  platformBubbleWrapper: {
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 6,
    width: 68
  },
  platformBubbleCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3
  },
  platformBubbleCircleSelected: {
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5
  },
  platformBubbleLogo: {
    width: 32,
    height: 32
  },
  platformBubbleCheckmark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: THEME.success,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  platformBubbleName: {
    fontSize: 11,
    color: THEME.textSecondary,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center'
  },
  platformBubbleNameSelected: {
    color: THEME.primary,
    fontWeight: '800'
  },

  // FrequencySelector
  freqContainer: {
    marginTop: 14,
    marginBottom: 8
  },
  freqHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 4
  },
  freqHeaderSubtitle: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 14
  },
  freqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14
  },
  freqCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: THEME.cardBorder,
    borderRadius: THEME.radius.md,
    padding: 12,
    alignItems: 'flex-start'
  },
  freqCardSelected: {
    borderColor: THEME.primary,
    backgroundColor: THEME.primaryGlow
  },
  freqRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: THEME.textSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  freqRadioSelected: {
    borderColor: THEME.primary
  },
  freqRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: THEME.primary
  },
  freqLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 2
  },
  freqLabelSelected: {
    color: THEME.primary
  },
  freqDesc: {
    fontSize: 10,
    color: THEME.textMuted,
    fontWeight: '500'
  },
  freqDescSelected: {
    color: THEME.primaryDark
  },
  freqNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.bgSecondary,
    padding: 12,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.cardBorder
  },
  freqNoticeText: {
    flex: 1,
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 17,
    fontWeight: '500'
  },

  // Estilos Pechinchou Card (Compactado Verticalmente)
  pechCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pechCardStoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pechCardTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pechCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  pechCardStoreName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  pechCardTimeAgo: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  pechCardRibbonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  pechCardRibbonPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EA580C',
    textTransform: 'uppercase',
  },
  pechCardMiddleRow: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingBottom: 4,
  },
  pechCardImgBox: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pechCardImg: {
    width: 90,
    height: 90,
  },
  pechCardImgFallback: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pechCardDetailsBox: {
    flex: 1,
    justifyContent: 'center',
  },
  pechCardRecMotivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginBottom: 4,
    maxWidth: '100%',
  },
  pechCardRecMotiveText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#E11D48',
    flexShrink: 1,
  },
  pechCardDestaqueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  pechCardDestaqueBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pechCardSeminovoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  pechCardSeminovoBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#7C3AED',
  },
  pechCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  pechCardCouponPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E11D48',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  pechCardCouponText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E11D48',
  },
  pechCardPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FF5722',
    letterSpacing: -0.5,
  },
  pechCardOrigPrice: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
  pechCardFreteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  pechCardFreteText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '700',
  },
  pechCardDiscountPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pechCardDiscountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
  },
  pechCardPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  pechCardPaymentCond: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  pechCardStockText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EA580C',
    marginTop: 1,
  },
  pechCardBenefitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    flexWrap: 'wrap',
  },
  pechCardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    marginTop: 1,
  },
  pechCardFavBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pechCardSocialPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pechCardSocialText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  pechCardVerMaisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pechCardVerMaisBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF5722',
    marginRight: 2,
  },

  // Platform Circles (Grid 3 Colunas responsivo e botões circulares maiores)
  platformCircleItem: {
    alignItems: 'center',
    width: '33.33%',
    marginBottom: 16,
  },
  platformCircleBubble: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  platformCircleBubbleSelected: {
    borderColor: '#FF5722',
    backgroundColor: '#FFF7ED',
    borderWidth: 2.5,
  },
  platformCircleCheck: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF5722',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  platformCircleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginTop: 6,
    textAlign: 'center',
  },
  platformCircleLabelSelected: {
    color: '#FF5722',
    fontWeight: '800',
  },

  // Shared AppTopHeader
  pechTopHeader: {
    paddingTop: Platform.OS === 'android' ? 44 : 52,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  pechAvatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#FF5722',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pechAvatarInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pechAvatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  pechGreetingLoginTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  pechGreetingLoginSub: {
    fontSize: 11,
    color: '#FF5722',
    fontWeight: '600',
    marginTop: 1,
  },
  pechGreetingSub: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  pechGreetingName: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '900',
  },
  pechGreetingSubline: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  pechHeaderRightAction: {
    marginLeft: 10,
  },
  pechHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerNotifBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF5722',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerNotifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

});