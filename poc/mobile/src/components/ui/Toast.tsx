import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, runOnJS } from 'react-native-reanimated';
import { useTheme } from '@/providers/theme-provider';
import type { Alert } from '@/types';

interface Props {
  alert: Alert | null;
  onDismiss: () => void;
  onPress?: () => void;
}

const severityColors: Record<string, string> = {
  critical: '#dc3545',
  high: '#dc3545',
  warning: '#ffc107',
  medium: '#fd7e14',
  low: '#17a2b8',
  info: '#17a2b8',
};

export function Toast({ alert, onDismiss, onPress }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-150);

  useEffect(() => {
    if (alert) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 120 });

      // Auto-dismiss after 5s
      const timer = setTimeout(() => {
        translateY.value = withSpring(-150, { damping: 15 }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        });
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      translateY.value = -150;
    }
  }, [alert?.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!alert) return null;

  const barColor = severityColors[alert.severity] || '#17a2b8';

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: insets.top + 4,
          left: 12,
          right: 12,
          zIndex: 9999,
        },
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          flexDirection: 'row',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        {/* Severity bar */}
        <View style={{ width: 4, backgroundColor: barColor }} />

        <View style={{ flex: 1, padding: 12, paddingLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name="warning" size={16} color={barColor} />
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                {alert.title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                translateY.value = withSpring(-150, { damping: 15 }, (finished) => {
                  if (finished) runOnJS(onDismiss)();
                });
              }}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
            {alert.message}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
