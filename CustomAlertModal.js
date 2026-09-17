import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Modal, 
  Dimensions, Animated, Vibration, Platform, Easing 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from './theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Modal universal de alertas e confirmações estilizado para o AchôAI.
 * Substitui integralmente os Alert.alert brancos padrão do Android/iOS.
 * Conta com design ultra-limpo (sem artefatos de polígono/hexágono) e animações suaves de entrada e saída.
 */
export const CustomAlertModal = ({ 
  visible, 
  title, 
  message, 
  type = 'info', // 'radar_saved' | 'success' | 'warning' | 'confirm_danger' | 'confirm_warning' | 'info' | 'error'
  icon,
  confirmText = 'Entendido',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  onClose,
  showCancel = false
}) => {
  const [showModal, setShowModal] = useState(visible);
  const isClosingRef = useRef(false);

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0.4)).current;
  const iconPulseAnim = useRef(new Animated.Value(1)).current;

  // Animação de ENTRADA e SAÍDA sincronizada
  useEffect(() => {
    scaleAnim.stopAnimation();
    fadeAnim.stopAnimation();
    iconScaleAnim.stopAnimation();
    iconPulseAnim.stopAnimation();

    if (visible) {
      isClosingRef.current = false;
      setShowModal(true);

      // Feedback tátil sofisticado
      try {
        if (type === 'radar_saved' || type === 'success') {
          Vibration.vibrate(Platform.OS === 'android' ? [0, 35, 25, 50] : 40);
        } else if (type === 'confirm_danger' || type === 'error') {
          Vibration.vibrate(Platform.OS === 'android' ? [0, 45, 30, 70] : 60);
        } else {
          Vibration.vibrate(30);
        }
      } catch (e) {}

      scaleAnim.setValue(0.85);
      fadeAnim.setValue(0);
      iconScaleAnim.setValue(0.4);
      iconPulseAnim.setValue(1);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 75,
          useNativeDriver: true
        }),
        Animated.sequence([
          Animated.delay(60),
          Animated.spring(iconScaleAnim, {
            toValue: 1,
            friction: 5,
            tension: 80,
            useNativeDriver: true
          })
        ])
      ]).start(() => {
        // Pulso sutil no ícone para sucesso/radar salvo
        if (type === 'radar_saved' || type === 'success') {
          Animated.loop(
            Animated.sequence([
              Animated.timing(iconPulseAnim, {
                toValue: 1.08,
                duration: 800,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true
              }),
              Animated.timing(iconPulseAnim, {
                toValue: 1.0,
                duration: 800,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true
              })
            ])
          ).start();
        }
      });
    } else if (showModal && !isClosingRef.current) {
      // Animação de saída acionada por mudança na prop visible
      animateExit(() => {
        setShowModal(false);
      });
    }
  }, [visible, type]);

  const animateExit = (callback) => {
    isClosingRef.current = true;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.88,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) {
        setShowModal(false);
        isClosingRef.current = false;
        if (callback) callback();
      }
    });
  };

  const handleConfirmPress = () => {
    if (isClosingRef.current) return;
    animateExit(() => {
      if (onConfirm) onConfirm();
      if (onClose) onClose();
    });
  };

  const handleCancelPress = () => {
    if (isClosingRef.current) return;
    animateExit(() => {
      if (onCancel) onCancel();
      if (onClose) onClose();
    });
  };

  if (!showModal) return null;

  // Configuração harmoniosa de cores e ícones conforme o tipo
  let iconName = icon;
  let iconColor = THEME.primary;
  let outerRingBg = '#FFF7ED';
  let innerBadgeBg = '#FFEDD5';
  let badgeBorder = '#FED7AA';
  let primaryBtnBg = THEME.primary;
  let primaryBtnTextColor = '#FFFFFF';
  let isDanger = false;
  let hasTwoButtons = showCancel || type === 'confirm_danger' || type === 'confirm_warning';

  switch (type) {
    case 'radar_saved':
      iconName = icon || 'checkmark-sharp';
      iconColor = '#FF5722';
      outerRingBg = '#FFF7ED';
      innerBadgeBg = '#FFEDD5';
      badgeBorder = '#FED7AA';
      primaryBtnBg = '#FF5722';
      break;

    case 'success':
      iconName = icon || 'checkmark-circle';
      iconColor = '#10B981';
      outerRingBg = '#ECFDF5';
      innerBadgeBg = '#D1FAE5';
      badgeBorder = '#A7F3D0';
      primaryBtnBg = '#10B981';
      break;

    case 'warning':
    case 'confirm_warning':
      iconName = icon || 'alert-circle';
      iconColor = '#F59E0B';
      outerRingBg = '#FFFBEB';
      innerBadgeBg = '#FEF3C7';
      badgeBorder = '#FDE68A';
      primaryBtnBg = '#F59E0B';
      break;

    case 'confirm_danger':
    case 'error':
      iconName = icon || (type === 'confirm_danger' ? 'trash-outline' : 'close-circle');
      iconColor = '#EF4444';
      outerRingBg = '#FEF2F2';
      innerBadgeBg = '#FEE2E2';
      badgeBorder = '#FECACA';
      primaryBtnBg = '#EF4444';
      isDanger = true;
      break;

    case 'info':
    default:
      iconName = icon || 'sparkles';
      iconColor = '#3B82F6';
      outerRingBg = '#EFF6FF';
      innerBadgeBg = '#DBEAFE';
      badgeBorder = '#BFDBFE';
      primaryBtnBg = '#3B82F6';
      break;
  }

  return (
    <Modal
      visible={showModal}
      transparent={true}
      animationType="none"
      onRequestClose={handleCancelPress}
    >
      <View style={styles.backdrop}>
        {/* Backdrop animado com fade suave */}
        <Animated.View style={[styles.backdropOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={handleCancelPress} 
          />
        </Animated.View>

        {/* Card do Alerta com Escala + Opacidade Suave */}
        <Animated.View 
          renderToHardwareTextureAndroid={true}
          style={[
            styles.cardContainer, 
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
          ]}
        >
          {/* Badge Circular Anti-aliased em Camadas (Sem artefatos de polígono/hexágono) */}
          <Animated.View 
            style={[
              styles.outerRing, 
              { backgroundColor: outerRingBg },
              { transform: [{ scale: iconScaleAnim }] }
            ]}
          >
            <View style={[styles.innerBadge, { backgroundColor: innerBadgeBg, borderColor: badgeBorder }]}>
              <Animated.View style={{ transform: [{ scale: iconPulseAnim }] }}>
                <Ionicons name={iconName} size={28} color={iconColor} />
              </Animated.View>
            </View>
          </Animated.View>

          {/* TÍTULO */}
          <Text style={styles.titleText}>{title}</Text>

          {/* MENSAGEM */}
          {message ? (
            <Text style={styles.messageText}>{message}</Text>
          ) : null}

          {/* BOTÕES DE AÇÃO */}
          {hasTwoButtons ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={handleCancelPress}
                activeOpacity={0.75}
              >
                <Text style={styles.btnSecondaryText}>{cancelText}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: primaryBtnBg }]}
                onPress={handleConfirmPress}
                activeOpacity={0.85}
              >
                <Text style={[styles.btnPrimaryText, { color: primaryBtnTextColor }]}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btnFull, { backgroundColor: primaryBtnBg }]}
              onPress={handleConfirmPress}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnPrimaryText, { color: primaryBtnTextColor }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
  },
  cardContainer: {
    width: Math.min(SCREEN_WIDTH - 44, 360),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
  },
  outerRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  innerBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  btnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  btnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  btnFull: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
