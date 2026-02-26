import React, { useEffect } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useSensor, useSensorReadings, useCreateSensor } from '@/hooks/queries/use-sensors';
import { usePlots } from '@/hooks/queries/use-plots';
import { useTheme } from '@/providers/theme-provider';
import { sensorSchema, type SensorFormData } from '@/lib/validation';
import { SENSOR_TYPES } from '@/constants/crop-types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { formatDateTime, formatTemperature, formatPercentage } from '@/lib/format';

export default function SensorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { colors } = useTheme();

  const { data: sensor, isLoading } = useSensor(isNew ? '' : id);
  const { data: readings } = useSensorReadings(isNew ? '' : id);
  const { data: plotsData } = usePlots({ pageSize: 100 });
  const createMutation = useCreateSensor();

  const { control, handleSubmit, formState: { errors } } = useForm<SensorFormData>({
    resolver: zodResolver(sensorSchema),
    defaultValues: { label: '', type: '', plotId: '' },
  });

  const onSubmit = async (data: SensorFormData) => {
    try {
      await createMutation.mutateAsync(data);
      Alert.alert('Success', 'Sensor created!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to create sensor');
    }
  };

  const plotOptions = (plotsData?.items || []).map((p) => ({ value: p.id, label: `${p.name} (${p.propertyName})` }));

  if (!isNew && isLoading) return <LoadingOverlay fullScreen />;

  // New sensor form
  if (isNew) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text className="text-xl font-bold" style={{ color: colors.text }}>New Sensor</Text>
          </View>
          <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
            <View className="bg-white rounded-2xl p-4 shadow-sm">
              <Controller control={control} name="label" render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Label" placeholder="Sensor label" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.label?.message} />
              )} />
              <Controller control={control} name="type" render={({ field: { onChange, value } }) => (
                <Select label="Type" options={SENSOR_TYPES as any} value={value} onChange={onChange} error={errors.type?.message} />
              )} />
              <Controller control={control} name="plotId" render={({ field: { onChange, value } }) => (
                <Select label="Plot" options={plotOptions} value={value} onChange={onChange} error={errors.plotId?.message} />
              )} />
              <View className="mt-2">
                <Button title="Create Sensor" onPress={handleSubmit(onSubmit)} loading={createMutation.isPending} fullWidth size="lg" />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Sensor detail view
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold flex-1" style={{ color: colors.text }}>
          {sensor?.label}
        </Text>
        <Badge
          text={sensor?.status || 'Unknown'}
          variant={sensor?.status === 'Active' ? 'success' : sensor?.status === 'Faulty' ? 'danger' : 'secondary'}
        />
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Sensor Info */}
        <Card className="mb-4">
          <Text className="font-semibold mb-2" style={{ color: colors.text }}>Sensor Info</Text>
          <View className="gap-2">
            <InfoRow label="Type" value={sensor?.type || '-'} />
            <InfoRow label="Plot" value={sensor?.plotName || '-'} />
            <InfoRow label="Property" value={sensor?.propertyName || '-'} />
            <InfoRow label="Installed" value={sensor?.installedAt ? formatDateTime(sensor.installedAt) : '-'} />
            {sensor?.batteryLevel != null && <InfoRow label="Battery" value={`${sensor.batteryLevel}%`} />}
          </View>
        </Card>

        {/* Recent Readings */}
        <Text className="text-lg font-semibold mb-3" style={{ color: colors.text }}>Recent Readings</Text>
        {(!readings || readings.length === 0) ? (
          <Card>
            <Text className="text-center py-4" style={{ color: colors.textMuted }}>No readings available</Text>
          </Card>
        ) : (
          readings.slice(0, 20).map((r, i) => (
            <Card key={`${r.timestamp}-${i}`} className="mb-2">
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs" style={{ color: colors.textMuted }}>{formatDateTime(r.timestamp)}</Text>
              </View>
              <View className="flex-row gap-4">
                <View>
                  <Text className="text-xs" style={{ color: colors.textMuted }}>Temp</Text>
                  <Text className="font-semibold" style={{ color: '#E74C3C' }}>{formatTemperature(r.temperature)}</Text>
                </View>
                <View>
                  <Text className="text-xs" style={{ color: colors.textMuted }}>Humidity</Text>
                  <Text className="font-semibold" style={{ color: '#3498DB' }}>{formatPercentage(r.humidity)}</Text>
                </View>
                <View>
                  <Text className="text-xs" style={{ color: colors.textMuted }}>Soil</Text>
                  <Text className="font-semibold" style={{ color: '#27AE60' }}>{formatPercentage(r.soilMoisture)}</Text>
                </View>
                <View>
                  <Text className="text-xs" style={{ color: colors.textMuted }}>Rain</Text>
                  <Text className="font-semibold" style={{ color: '#9B59B6' }}>{r.rainfall?.toFixed(1)} mm</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm font-medium text-gray-800">{value}</Text>
    </View>
  );
}
