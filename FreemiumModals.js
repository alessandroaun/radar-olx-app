import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, 
  Dimensions, Animated, Easing, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from './theme';
import { PrimaryButton, Surface } from './components';
import { TIERS, TIER_LIMITS } from './tierService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// =====================================================================
// 1. CADEADO / LOCK OVERLAY (FROSTED GLASS EFFECT)
// =====================================================================

export const LockOverlay = ({ 
  title = "Recurso Exclusivo Premium", 
  subtitle = "Desbloqueie o acesso completo para visualizar este recurso em tempo real.", 
  onUnlock,
  buttonText = "Desbloquear com Premium",
  compact = false,
  style
}) => {
  return (
    <View style={[styles.lockOverlayContainer, compact && styles.lockOverlayCompact, style]}>
      <View style={styles.lockIconCircle}>
        <Ionicons name="lock-closed" size={compact ? 16 : 24} color="#08090D" />
      </View>
      <Text style={[styles.lockOverlayTitle, compact && styles.lockOverlayTitleCompact]}>
        {title}
      </Text>
      {!compact && (
        <Text style={styles.lockOverlaySub}>
          {subtitle}
        </Text>
      )}
      {onUnlock && (
        <TouchableOpacity 
          style={[styles.btnLockUnlock, compact && styles.btnLockUnlockCompact]}
          onPress={onUnlock}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={compact ? 12 : 14} color="#08090D" style={{ marginRight: 5 }} />
          <Text style={[styles.btnLockUnlockText, compact && styles.btnLockUnlockTextCompact]}>
            {buttonText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// =====================================================================
// 2. LOCK BADGE (TAG COMPACTA DE CADEADO)
// =====================================================================

export const LockBadge = ({ text = "PREMIUM", onPress }) => {
  const content = (
    <View style={styles.lockBadgeWrap}>
      <Ionicons name="lock-closed" size={10} color={THEME.primary} style={{ marginRight: 4 }} />
      <Text style={styles.lockBadgeText}>{text}</Text>
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
// 3. MODAL DE COMPARAÇÃO SAAS (FREEMIUM MODAL)
// =====================================================================

export const FreemiumModal = ({ 
  visible, 
  onClose, 
  onActivateTrial, 
  onSubscribe, 
  trialEligibility = { canActivate: true },
  activatingTrial = false,
  subscribing = false 
}) => {
  const features = [
    {
      name: "Radares Ativos",
      free: "1 Radar",
      premium: "Até 5 Simultâneos",
      icon: "radio-outline"
    },
    {
      name: "Plataformas",
      free: "OLX, Zoom, Buscapé",
      premium: "Todas",
      icon: "globe-outline"
    },
    {
      name: "Varrer por Preço",
      free: "Bloqueado 🔒",
      premium: "Liberado",
      icon: "pricetag-outline"
    },
    {
      name: "Frequência de Varredura",
      free: "A cada 3 horas",
      premium: "Rápida (15 min)",
      icon: "timer-outline"
    },
    {
      name: "Botão 'Varrer'",
      free: "a cada 60 min",
      premium: "Ilimitada sem espera",
      icon: "flash-outline"
    },
    {
      name: "Notificações que levam ao anúncio",
      free: "Não",
      premium: "Clicou abre direto na loja",
      icon: "open-outline"
    },
    {
      name: "Sincronização em Nuvem",
      free: "Apenas neste celular",
      premium: "Multi-aparelhos",
      icon: "cloud-outline"
    },
    {
      name: "Histórico de Varreduras",
      free: "Bloqueado 🔒",
      premium: "Ao vivo em tempo real",
      icon: "hardware-chip-outline"
    }
  ];

  const canTrial = trialEligibility?.canActivate;

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      transparent={true} 
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.freemiumCardContainer}>
          {/* HEADER COM GLOW */}
          <View style={styles.freemiumHeader}>
            <View style={styles.proCrownBadge}>
              <Ionicons name="sparkles" size={15} color={THEME.primary} style={{ marginRight: 5 }} />
              <Text style={styles.proCrownText}>PLANOS & BENEFÍCIOS</Text>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.btnCloseHeader}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={20} color={THEME.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.freemiumHeadline}>
            Eleve suas buscas com o <Text style={{ color: THEME.primary }}>AchôAI</Text>
          </Text>
          <Text style={styles.freemiumSub}>
            Monitore até 5 produtos simultâneos com varreduras rápidas e capture ofertas antes de todo mundo.
          </Text>

          {/* CABEÇALHO DA TABELA COMPARATIVA */}
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderColName}>RECURSO</Text>
            <Text style={styles.tableHeaderColFree}>FREE</Text>
            <View style={styles.tableHeaderColPrem}>
              <Ionicons name="sparkles" size={11} color={THEME.primary} style={{ marginRight: 3 }} />
              <Text style={styles.tableHeaderColPremText}>PREMIUM</Text>
            </View>
          </View>

          {/* TABELA COMPARATIVA DIRETA COM SCROLL */}
          <ScrollView 
            showsVerticalScrollIndicator={false} 
            style={styles.tableScrollView}
            contentContainerStyle={{ paddingBottom: 6 }}
          >
            <View style={styles.tableContainer}>
              {features.map((f, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}>
                  <View style={styles.tableColName}>
                    <Ionicons name={f.icon} size={14} color={THEME.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.tableNameText} numberOfLines={2}>{f.name}</Text>
                  </View>
                  <View style={styles.tableColFree}>
                    <Text style={styles.tableFreeText}>{f.free}</Text>
                  </View>
                  <View style={styles.tableColPrem}>
                    <Text style={styles.tablePremText}>{f.premium}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* FOOTER: DOIS BOTÕES LADO A LADO */}
          <View style={styles.freemiumDualActionRow}>
            {/* BOTÃO ESQUERDO: TESTE GRÁTIS (2 DIAS) - MENOR */}
            <TouchableOpacity 
              style={[
                styles.btnTrialSide,
                !canTrial && styles.btnTrialSideDisabled
              ]}
              onPress={onActivateTrial}
              disabled={activatingTrial || !canTrial}
              activeOpacity={0.8}
            >
              {activatingTrial ? (
                <ActivityIndicator size="small" color={THEME.info} />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <View style={styles.trialSideBadgeRow}>
                    <Ionicons 
                      name="time" 
                      size={12} 
                      color={canTrial ? THEME.info : THEME.textSubtle} 
                    />
                    <Text style={[
                      styles.trialSideBadgeText,
                      !canTrial && { color: THEME.textSubtle }
                    ]}>
                      {canTrial ? '2 DIAS TRIAL' : 'UTILIZADO'}
                    </Text>
                  </View>
                  <Text style={[
                    styles.btnTrialSideTitle,
                    !canTrial && { color: THEME.textSubtle }
                  ]}>
                    {canTrial ? 'Teste Grátis' : 'Já Usado'}
                  </Text>
                  <Text style={styles.btnTrialSideSub}>
                    {canTrial ? 'R$ 0,00' : 'Esgotado'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* BOTÃO DIREITO: ASSINAR PREMIUM (R$ 39,90/MÊS) - MAIOR E CHAMATIVO */}
            <TouchableOpacity 
              style={styles.btnSubscribeSide}
              onPress={onSubscribe}
              disabled={subscribing}
              activeOpacity={0.85}
            >
              {subscribing ? (
                <ActivityIndicator size="small" color="#08090D" />
              ) : (
                <View style={styles.subscribeSideContent}>
                  <View style={styles.subscribeSideTitleRow}>
                    <Ionicons name="diamond" size={15} color="#08090D" style={{ marginRight: 6 }} />
                    <Text style={styles.btnSubscribeSideTitle}>Assinar Premium</Text>
                  </View>
                  <Text style={styles.btnSubscribeSidePrice}>
                    R$ 39,90<Text style={styles.btnSubscribeSidePeriod}>/mês</Text>
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// =====================================================================
// 4. MODAL COMEMORATIVO (CELEBRATION ANIMATION)
// =====================================================================

export const CelebrationModal = ({ visible, onClose, durationDays = 30 }) => {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
    } else {
      scaleAnim.setValue(0.3);
      rotateAnim.setValue(0);
    }
  }, [visible]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-25deg', '0deg']
  });

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Animated.View style={[styles.celebrationCard, { transform: [{ scale: scaleAnim }, { rotate: spin }] }]}>
          {/* PARTICULAS / CONFETIS SIMULADOS */}
          <View style={styles.confettiContainer}>
            <View style={[styles.confettiDot, { top: 15, left: 25, backgroundColor: THEME.primary }]} />
            <View style={[styles.confettiDot, { top: 25, right: 30, backgroundColor: THEME.success }]} />
            <View style={[styles.confettiDot, { top: 70, left: 15, backgroundColor: THEME.info }]} />
            <View style={[styles.confettiDot, { top: 60, right: 20, backgroundColor: '#EC4899' }]} />
            <View style={[styles.confettiDot, { bottom: 40, left: 35, backgroundColor: '#EAB308' }]} />
            <View style={[styles.confettiDot, { bottom: 30, right: 40, backgroundColor: THEME.primary }]} />
          </View>

          <View style={styles.celebrationIconWrap}>
            <Ionicons name="trophy" size={46} color={THEME.primary} />
          </View>

          <Text style={styles.celebrationTitle}>🎉 Parabéns!</Text>
          <Text style={styles.celebrationSubTitle}>Você agora é AchôAI Premium</Text>
          
          <Text style={styles.celebrationBody}>
            Sua assinatura de <Text style={{ color: THEME.primary, fontWeight: 'bold' }}>{durationDays} dias</Text> foi ativada com sucesso!
            {'\n\n'}
            Agora você tem até 5 radares simultâneos, varreduras rápidas, acesso direto às ofertas e sincronização completa em nuvem.
          </Text>

          <PrimaryButton 
            title="Começar a Aproveitar"
            icon="rocket"
            onPress={onClose}
            size="lg"
            style={{ width: '100%', marginTop: 20 }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

// =====================================================================
// 5. MODAL DE FIM DO TESTE GRÁTIS (TRIAL EXPIRED MODAL)
// =====================================================================

export const TrialExpiredModal = ({ visible, onSubscribe, onContinueFree }) => {
  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onContinueFree}>
      <View style={styles.modalBackdrop}>
        <View style={styles.trialExpiredCard}>
          <View style={styles.trialExpiredIconWrap}>
            <Ionicons name="time-outline" size={38} color={THEME.warning} />
          </View>

          <Text style={styles.trialExpiredTitle}>Seu Teste de 2 Dias Encerrou</Text>
          <Text style={styles.trialExpiredBody}>
            Esperamos que você tenha aproveitado o poder total do robô AchôAI!
            {'\n\n'}
            Seu plano voltou para o modo <Text style={{ color: THEME.text, fontWeight: 'bold' }}>Free</Text>. Mantivemos seu principal radar ativo e pausamos os excedentes para sua segurança.
            {'\n\n'}
            Para continuar com até 5 radares simultâneos, todas as plataformas e varreduras sem espera, assine o plano Premium:
          </Text>

          <View style={styles.priceHighlightBox}>
            <Text style={styles.priceHighlightSmall}>Apenas</Text>
            <Text style={styles.priceHighlightBig}>R$ 39,90 <Text style={{ fontSize: 13, color: THEME.textMuted }}>/ mês</Text></Text>
          </View>

          <PrimaryButton 
            title="Assinar Premium por R$ 39,90"
            icon="diamond-outline"
            onPress={onSubscribe}
            style={{ width: '100%', marginTop: 14 }}
          />

          <TouchableOpacity 
            style={styles.btnDismissFree}
            onPress={onContinueFree}
            activeOpacity={0.7}
          >
            <Text style={styles.btnDismissFreeText}>Continuar com Recursos Básicos do Free</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// =====================================================================
// 6. MODAL DE RENOVAÇÃO (RENEWAL MODAL <= 5 DIAS)
// =====================================================================

export const RenewalModal = ({ visible, remainingDays, onRenew, onDismiss }) => {
  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onDismiss}>
      <View style={styles.modalBackdrop}>
        <View style={styles.renewalCard}>
          <View style={styles.renewalHeaderRow}>
            <View style={styles.renewalBadgeAlert}>
              <Ionicons name="alert-circle" size={14} color={THEME.warning} style={{ marginRight: 4 }} />
              <Text style={styles.renewalBadgeAlertText}>EXPIRANDO EM BREVE</Text>
            </View>
            <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.renewalTitle}>
            Sua assinatura Premium expira em <Text style={{ color: THEME.warning }}>{remainingDays} dias</Text>
          </Text>

          <Text style={styles.renewalBody}>
            Renove agora para não interromper o monitoramento dos seus 5 radares e garantir o envio instantâneo das ofertas.
          </Text>

          <PrimaryButton 
            title="Renovar Assinatura (R$ 39,90)"
            icon="refresh"
            onPress={onRenew}
            style={{ width: '100%', marginTop: 16 }}
          />

          <TouchableOpacity onPress={onDismiss} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ color: THEME.textSubtle, fontSize: 12 }}>Lembrar Mais Tarde</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// =====================================================================
// 7. MODAL DETALHE DE ANÚNCIO INTERNO (PARA USUÁRIOS FREE)
// =====================================================================

export const AdDetailModal = ({ visible, item, onClose, onUnlock }) => {
  if (!item) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.adDetailCard}>
          <View style={styles.rowBetween}>
            <View style={styles.robotTag}>
              <Ionicons name="shield-checkmark" size={14} color={THEME.success} style={{ marginRight: 4 }} />
              <Text style={styles.robotTagText}>Anúncio Capturado</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={THEME.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.adDetailTitle} numberOfLines={3}>{item.title}</Text>

          <View style={styles.adDetailMetaRow}>
            <Text style={styles.adDetailPrice}>
              {item.price !== null ? `R$ ${Number(item.price).toFixed(2)}` : 'Sob Consulta'}
            </Text>
            <Text style={styles.adDetailDate}>
              {new Date(item.created_at || Date.now()).toLocaleTimeString()} • Hoje
            </Text>
          </View>

          {/* ÁREA BLOQUEADA DO LINK EXTERNO */}
          <Surface style={styles.adLockedLinkSurface}>
            <View style={styles.lockIconSmall}>
              <Ionicons name="lock-closed" size={18} color={THEME.primary} />
            </View>
            <Text style={styles.adLockedHeading}>Link Direto Protegido</Text>
            <Text style={styles.adLockedExplanation}>
              No plano Free, a abertura de links diretos para a loja parceira é restrita. Faça upgrade para o plano Premium para abrir links de ofertas instantaneamente com 1 toque.
            </Text>
            
            <PrimaryButton 
              title="Desbloquear Links com Premium"
              icon="sparkles"
              onPress={() => {
                onClose();
                if (onUnlock) onUnlock();
              }}
              style={{ width: '100%', marginTop: 14 }}
            />
          </Surface>
        </View>
      </View>
    </Modal>
  );
};

// =====================================================================
// ESTILOS DO SISTEMA FREEMIUM
// =====================================================================

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  // Lock Overlay
  lockOverlayContainer: {
    backgroundColor: 'rgba(8, 9, 13, 0.92)',
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.35)',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4
  },
  lockOverlayCompact: {
    padding: 12,
    marginVertical: 2
  },
  lockIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4
  },
  lockOverlayTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: THEME.text,
    textAlign: 'center',
    marginBottom: 4
  },
  lockOverlayTitleCompact: {
    fontSize: 12,
    marginBottom: 2
  },
  lockOverlaySub: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 10,
    lineHeight: 17
  },
  btnLockUnlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: THEME.radius.sm
  },
  btnLockUnlockCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4
  },
  btnLockUnlockText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#08090D'
  },
  btnLockUnlockTextCompact: {
    fontSize: 11
  },

  // Lock Badge
  lockBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 122, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.4)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs
  },
  lockBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.primary,
    letterSpacing: 0.4
  },

  // Freemium Modal
  freemiumCardContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.84,
    backgroundColor: THEME.bgSecondary,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.35)',
    padding: 18,
    display: 'flex'
  },
  freemiumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  proCrownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primaryGlow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.3)'
  },
  proCrownText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.primary,
    letterSpacing: 0.8
  },
  btnCloseHeader: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  freemiumHeadline: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: 0.2,
    marginBottom: 4
  },
  freemiumSub: {
    fontSize: 12,
    color: THEME.textMuted,
    lineHeight: 16,
    marginBottom: 12
  },

  // Cabeçalho da Tabela
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: THEME.radius.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)'
  },
  tableHeaderColName: {
    flex: 1.2,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSubtle,
    letterSpacing: 0.5
  },
  tableHeaderColFree: {
    flex: 0.9,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textSubtle,
    textAlign: 'center',
    letterSpacing: 0.5
  },
  tableHeaderColPrem: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tableHeaderColPremText: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.primary,
    letterSpacing: 0.5
  },
  tableScrollView: {
    flex: 1,
    marginBottom: 4
  },

  // Dual Action Footer
  freemiumDualActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)'
  },
  btnTrialSide: {
    flex: 0.38,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: THEME.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52
  },
  btnTrialSideDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    opacity: 0.6
  },
  trialSideBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1
  },
  trialSideBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: THEME.info,
    marginLeft: 3,
    letterSpacing: 0.3
  },
  btnTrialSideTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.text,
    textAlign: 'center'
  },
  btnTrialSideSub: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.textSubtle,
    marginTop: 1
  },
  btnSubscribeSide: {
    flex: 0.62,
    backgroundColor: THEME.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6
  },
  subscribeSideContent: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  subscribeSideTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  btnSubscribeSideTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#08090D',
    letterSpacing: 0.2
  },
  btnSubscribeSidePrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#08090D',
    marginTop: 1
  },
  btnSubscribeSidePeriod: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2b2b2b'
  },

  // Tabela Comparativa
  tableContainer: {
    backgroundColor: THEME.cardBg,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    overflow: 'hidden',
    marginBottom: 14
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)'
  },
  tableRowEven: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)'
  },
  tableColName: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center'
  },
  tableNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.text
  },
  tableColFree: {
    flex: 0.9,
    alignItems: 'center',
    paddingHorizontal: 4
  },
  tableFreeText: {
    fontSize: 10,
    color: THEME.textSubtle,
    textAlign: 'center'
  },
  tableColPrem: {
    flex: 1.1,
    alignItems: 'center',
    paddingHorizontal: 4
  },
  tablePremText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: THEME.primary,
    textAlign: 'center'
  },

  // Plan Cards
  plansContainer: {
    paddingBottom: 10
  },
  planCard: {
    padding: 16,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    marginBottom: 14,
    backgroundColor: THEME.cardBg
  },
  planCardFeatured: {
    borderColor: THEME.primary,
    backgroundColor: THEME.cardBgElevated,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4
  },
  featuredRibbon: {
    alignSelf: 'flex-start',
    backgroundColor: THEME.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
    marginBottom: 8
  },
  featuredRibbonText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#08090D',
    letterSpacing: 0.5
  },
  planCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  planBadgeLite: {
    alignSelf: 'flex-start',
    backgroundColor: THEME.infoBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
    marginBottom: 4
  },
  planBadgeLiteText: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.info
  },
  planBadgePrem: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: THEME.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: THEME.radius.xs,
    marginBottom: 4
  },
  planBadgePremText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#08090D'
  },
  planCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.text
  },
  planCardPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.text,
    marginTop: 2
  },
  planCardPeriod: {
    fontSize: 12,
    fontWeight: 'normal',
    color: THEME.textMuted
  },
  planIconCircleLite: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.infoBg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  planIconCirclePrem: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: THEME.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.3)'
  },
  planCardDesc: {
    fontSize: 12,
    color: THEME.textMuted,
    lineHeight: 17,
    marginBottom: 12
  },
  planBulletList: {
    marginBottom: 14
  },
  planBulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  planBulletText: {
    fontSize: 11,
    color: THEME.textSecondary
  },
  btnActivateTrial: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.info,
    paddingVertical: 12,
    borderRadius: THEME.radius.md
  },
  btnActivateTrialText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#08090D'
  },
  trialUsedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 10,
    borderRadius: THEME.radius.sm
  },
  trialUsedBannerText: {
    fontSize: 11,
    color: THEME.textSubtle,
    flex: 1
  },
  btnSubscribePrem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  btnSubscribePremText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#08090D'
  },
  freemiumFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)'
  },
  btnFooterTrial: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: THEME.radius.md,
    marginRight: 8
  },
  btnFooterTrialText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.text
  },
  btnFooterSubscribe: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    borderRadius: THEME.radius.md
  },
  btnFooterSubscribeText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#08090D'
  },

  // Celebration Modal
  celebrationCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.bgSecondary,
    borderRadius: THEME.radius.xl,
    borderWidth: 2,
    borderColor: THEME.primary,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden'
  },
  confettiContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0
  },
  confettiDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4
  },
  celebrationIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.primaryGlowStrong,
    borderWidth: 2,
    borderColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.text,
    marginBottom: 4
  },
  celebrationSubTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.primary,
    marginBottom: 12
  },
  celebrationBody: {
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 18
  },

  // Trial Expired
  trialExpiredCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.bgSecondary,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    padding: 24,
    alignItems: 'center'
  },
  trialExpiredIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  trialExpiredTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.text,
    textAlign: 'center',
    marginBottom: 10
  },
  trialExpiredBody: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 17
  },
  priceHighlightBox: {
    backgroundColor: 'rgba(255, 122, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 0, 0.3)',
    borderRadius: THEME.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginVertical: 12,
    width: '100%'
  },
  priceHighlightSmall: {
    fontSize: 10,
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  priceHighlightBig: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.primary
  },
  btnDismissFree: {
    marginTop: 12,
    paddingVertical: 6
  },
  btnDismissFreeText: {
    fontSize: 12,
    color: THEME.textSubtle
  },

  // Renewal Modal
  renewalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.bgSecondary,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    padding: 20
  },
  renewalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  renewalBadgeAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs
  },
  renewalBadgeAlertText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.warning
  },
  renewalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 8
  },
  renewalBody: {
    fontSize: 12,
    color: THEME.textMuted,
    lineHeight: 17
  },

  // Ad Detail Modal (Free)
  adDetailCard: {
    width: '100%',
    backgroundColor: THEME.bgSecondary,
    borderRadius: THEME.radius.xl,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 20
  },
  robotTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs
  },
  robotTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.success
  },
  adDetailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.text,
    marginVertical: 12,
    lineHeight: 22
  },
  adDetailMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  adDetailPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.primary
  },
  adDetailDate: {
    fontSize: 12,
    color: THEME.textMuted
  },
  adLockedLinkSurface: {
    backgroundColor: 'rgba(8, 9, 13, 0.9)',
    borderColor: 'rgba(255, 122, 0, 0.35)',
    borderWidth: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: THEME.radius.lg
  },
  lockIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  adLockedHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME.text,
    marginBottom: 4
  },
  adLockedExplanation: {
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 16
  }
});
