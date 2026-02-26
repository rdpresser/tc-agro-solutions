import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/theme-provider';

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>User Detail</Text>
      </View>
      <View className="flex-1 items-center justify-center px-4">
        <Ionicons name="person-circle-outline" size={80} color={colors.textMuted} />
        <Text className="text-lg mt-4" style={{ color: colors.text }}>User ID: {id}</Text>
        <Text className="text-sm mt-2" style={{ color: colors.textSecondary }}>
          Edit functionality available in admin panel
        </Text>
      </View>
    </SafeAreaView>
  );
}
