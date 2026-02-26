import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingOverlay({ message = 'Loading...', fullScreen = false }: LoadingOverlayProps) {
  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#2d5016" />
        <Text className="text-gray-600 mt-3 text-base">{message}</Text>
      </View>
    );
  }

  return (
    <View className="items-center justify-center py-12">
      <ActivityIndicator size="large" color="#2d5016" />
      <Text className="text-gray-600 mt-3 text-base">{message}</Text>
    </View>
  );
}
