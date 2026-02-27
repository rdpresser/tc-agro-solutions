import React from 'react';
import { Stack } from 'expo-router';

export default function SensorsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="monitoring" />
    </Stack>
  );
}
