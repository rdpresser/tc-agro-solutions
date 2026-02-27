import React, { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';

interface Props {
  visible: boolean;
  onGoToDashboard: () => void;
}

export function CelebrationModal({ visible, onGoToDashboard }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 8, stiffness: 100 });
      opacity.value = withDelay(300, withSpring(1));
    } else {
      scale.value = 0;
      opacity.value = 0;
    }
  }, [visible]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 24,
          padding: 32,
          alignItems: 'center',
          width: '100%',
          maxWidth: 340,
        }}>
          <Animated.View style={[{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: '#27AE60' + '20',
            justifyContent: 'center', alignItems: 'center',
            marginBottom: 24,
          }, checkStyle]}>
            <Ionicons name="checkmark-circle" size={64} color="#27AE60" />
          </Animated.View>

          <Animated.View style={[{ alignItems: 'center' }, textStyle]}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
              You're all set!
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
              Your farm is configured. You can now monitor sensors, view dashboards, and receive alerts.
            </Text>
          </Animated.View>

          <TouchableOpacity
            onPress={onGoToDashboard}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 14,
              paddingHorizontal: 32,
              borderRadius: 12,
              width: '100%',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
