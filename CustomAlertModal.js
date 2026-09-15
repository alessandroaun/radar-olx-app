import React, { useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Modal, 
  Dimensions, Animated, Vibration, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from './theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Modal universal de alertas e confirmações estilizado para o AchôAI.
 * Substitui integralmente os Alert.alert brancos padrão do Android/iOS.
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
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;
  const iconPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Feedback tátil sofisticado
      try {
        if (type === 'radar_saved' || type === 'success') {
          Vibration.vibrate(Platform.OS === 'android' ? [0, 40, 30, 60] : 60);
        } else if (type === 'confirm_danger' || type === 'error') {
          Vibration.vibrate(Platform.OS === 'android' ? [0, 50, 40, 80] : 80);
        } else {
          Vibration.vibrate(40);
        }
      } catch (e) {}

      // Animação de entrada do card
      scaleAnim.setValue(0.75);
      opacityAnim.setValue(0);
      iconScaleAnim.setValue(0);
      iconPulseAnim.setValue(1);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 65,
          useNativeDriver: true
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true
        }),
        Animated.sequence([
          Animated.delay(80),
          Animated.spring(iconScaleAnim, {
            toValue: 1,
            friction: 5,
            tension: 70,
            useNativeDriver: true
          })
        ])
      ]).start(() => {
        // Pulso contínuo sutil para sucesso/radar_saved
        if (type === 'radar_saved' || type === 'success') {
          Animated.loop(
            Animated.sequence([
              Animated.timing(iconPulseAnim, {
                toValue: 1.12,
                duration: 900,
                useNativeDriver: true
              }),
              Animated.timing(iconPulseAnim, {
                toValue: 1.0,
                duration: 900,
                useNativeDriver: true
              })
            ])
          ).start();
        }
      });
    }
  }, [visible, type]);

  if (!visible) return null;

  // Configuração de cores e ícones conforme o tipo
  let iconName = icon;
  let iconColor = THEME.primary;
  let badgeBg = 'rgba(0, 230, 118, 0.14)';
  let borderColor = 'rgba(0, 230, 118, 0.3)';
  let isDanger = false;
  let hasTwoButtons = showCancel || type === 'confirm_danger' || type === 'confirm_warning';

  switch (type) {
    case 'radar_saved':
      iconName = icon || 'thumbs-up';
      iconColor = THEME.primary;
      badgeBg = 'rgba(0, 230, 118, 0.18)';
      borderColor = 'rgba(0, 230, 118, 0.4)';
      break;
    case 'success':
      iconName = icon || 'checkmark-circle';
      iconColor = THEME.primary;
      badgeBg = 'rgba(0, 230, 118, 0.15)';
      borderColor = 'rgba(0, 230, 118, 0.35)';
      break;
    case 'warning':
    case 'confirm_warning':
      iconName = icon || 'alert-circle';
      iconColor = THEME.warning;
      badgeBg = 'rgba(255, 179, 0, 0.15)';
      borderColor = 'rgba(255, 179, 0, 0.35)';
      break;
    case 'confirm_danger':
    case 'error':
      iconName = icon || (type === 'confirm_danger' ? 'trash-outline' : 'close-circle');
      iconColor = THEME.danger;
      badgeBg = 'rgba(255, 82, 82, 0.16)';
      borderColor = 'rgba(255, 82, 82, 0.35)';
      isDanger = true;
      break;
    case 'info':
    default:
      iconName = icon || 'sparkles';
      iconColor = THEME.info || '#3D8BFF';
      badgeBg = 'rgba(61, 139, 255, 0.15)';
      borderColor = 'rgba(61, 139, 255, 0.35)';
      break;
  }

  const handleConfirmPress = () => {
    if (onConfirm) onConfirm();
    if (onClose) onClose();
  };

  const handleCancelPress = () => {
    if (onCancel) onCancel();
    if (onClose) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleCancelPress}
    >
      <View style={styles.backdrop}>
        <Animated.View 
          style={[
            styles.cardContainer, 
            { borderColor },
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }
          ]}
        >
          {/* EFEITO GLOW DE FUNDO */}
          <View style={[styles.glowBackdrop, { backgroundColor: badgeBg }]} />

          {/* ÍCONE COM ANIMAÇÃO FLUIDA */}
          <Animated.View 
            style={[
              styles.iconWrapper, 
              { backgroundColor: badgeBg, borderColor },
              { transform: [{ scale: iconScaleAnim }] }
            ]}
          >
            <Animated.View style={{ transform: [{ scale: iconPulseAnim }] }}>
              <Ionicons name={iconName} size={38} color={iconColor} />
            </Animated.View>
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
                style={[styles.btnPrimary, isDanger && styles.btnDanger]}
                onPress={handleConfirmPress}
                activeOpacity={0.85}
              >
                <Text style={[styles.btnPrimaryText, isDanger && styles.btnDangerText]}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btnFull, isDanger && styles.btnDanger]}
              onPress={handleConfirmPress}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnPrimaryText, isDanger && styles.btnDangerText]}>
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardContainer: {
    width: Math.min(SCREEN_WIDTH - 40, 370),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: THEME.cardBorder,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  glowBackdrop: {
    position: 'absolute',
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.2,
  },
  iconWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  titleText: {
    fontSize: 19,
    fontWeight: '800',
    color: THEME.text,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  messageText: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
    gap: 12,
  },
  btnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  btnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnFull: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  btnDanger: {
    backgroundColor: THEME.danger,
    shadowColor: THEME.danger,
  },
  btnDangerText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
