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

export const StrategyBadge = ({ text, color = THEME.textMuted }) => (
  <View style={styles.strategyBadge}>
    <Ionicons name="sparkles-outline" size={11} color={THEME.primary} style={{ marginRight: 4 }} />
    <Text style={[styles.strategyBadgeText, { color }]} numberOfLines={1}>{text}</Text>
  </View>
);

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

export const MetricBox = ({ icon, value, label, sublabel, color = THEME.primary, bg = THEME.primaryGlow }) => (
  <Surface style={styles.metricBox}>
    <View style={[styles.metricIconBadge, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={19} color={color} />
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
    {sublabel && <Text style={styles.metricSublabel} numberOfLines={1}>{sublabel}</Text>}
  </Surface>
);

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
  metricBox: {
    flex: 1,
    marginHorizontal: 4,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0
  },
  metricIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: 0.5
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textMuted,
    marginTop: 2,
    textAlign: 'center'
  },
  metricSublabel: {
    fontSize: 9,
    color: THEME.textSubtle,
    marginTop: 2,
    textAlign: 'center'
  }
});
