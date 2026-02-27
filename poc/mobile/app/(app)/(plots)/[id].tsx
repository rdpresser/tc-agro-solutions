import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { usePlot, useCreatePlot, useUpdatePlot } from '@/hooks/queries/use-plots';
import { useProperties, useProperty as usePropertyDetail } from '@/hooks/queries/use-properties';
import { useSensors } from '@/hooks/queries/use-sensors';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useTheme } from '@/providers/theme-provider';
import { plotSchema, type PlotFormData } from '@/lib/validation';
import { CROP_TYPES, IRRIGATION_TYPES } from '@/constants/crop-types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { DatePicker } from '@/components/ui/DatePicker';
import { WizardBanner } from '@/components/onboarding/WizardBanner';
import { getSensorIcon, SENSOR_STATUSES } from '@/constants/crop-types';
import type { Sensor } from '@/types';

export default function PlotFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { colors } = useTheme();
  const isWizardActive = useOnboardingStore((s) => s.isWizardActive);
  const wizardStep = useOnboardingStore((s) => s.wizardStep);
  const createdPropertyId = useOnboardingStore((s) => s.createdPropertyId);
  const advanceToStep3 = useOnboardingStore((s) => s.advanceToStep3);

  const { data: plot, isLoading } = usePlot(isNew ? '' : id);
  const { data: propertiesData } = useProperties({ pageSize: 100 });
  const { data: sensorsData } = useSensors(
    !isNew ? { plotId: id, pageSize: 50 } : undefined
  );
  const plotSensors = sensorsData?.items || [];
  const createMutation = useCreatePlot();
  const updateMutation = useUpdatePlot();

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<PlotFormData>({
    resolver: zodResolver(plotSchema),
    defaultValues: {
      name: '', propertyId: '', cropType: '', plantingDate: '',
      expectedHarvestDate: '', irrigationType: '', areaHectares: 0,
    },
  });
  const watchPropertyId = watch('propertyId');
  const selectedPropertyFromList = useMemo(
    () => (propertiesData?.items || []).find((p) => p.id === watchPropertyId),
    [propertiesData, watchPropertyId]
  );
  const { data: selectedPropertyDetail } = usePropertyDetail(watchPropertyId || '');

  useEffect(() => {
    if (plot && !isNew) {
      reset({
        name: plot.name,
        propertyId: plot.propertyId,
        cropType: plot.cropType,
        plantingDate: plot.plantingDate?.split('T')[0] || '',
        expectedHarvestDate: plot.expectedHarvestDate?.split('T')[0] || '',
        irrigationType: plot.irrigationType,
        areaHectares: plot.areaHectares,
        temperatureMin: plot.temperatureMin,
        temperatureMax: plot.temperatureMax,
        humidityMin: plot.humidityMin,
        humidityMax: plot.humidityMax,
        soilMoistureMin: plot.soilMoistureMin,
        soilMoistureMax: plot.soilMoistureMax,
      });
    }
  }, [plot, isNew, reset]);

  // Pre-fill propertyId when in wizard step 2
  useEffect(() => {
    if (isWizardActive && wizardStep === 2 && createdPropertyId && isNew) {
      setValue('propertyId', createdPropertyId, { shouldValidate: true });
    }
  }, [isWizardActive, wizardStep, createdPropertyId, isNew, setValue]);

  const onSubmit = async (data: PlotFormData) => {
    try {
      const ownerId = selectedPropertyFromList?.ownerId || selectedPropertyDetail?.ownerId;
      const payload = ownerId ? { ...data, ownerId } : data;

      if (isNew) {
        const result = await createMutation.mutateAsync(payload);
        if (isWizardActive && result?.id) {
          await advanceToStep3(result.id);
          router.replace({ pathname: '/(app)/(sensors)/[id]', params: { id: 'new' } });
          return;
        }
        Alert.alert('Success', 'Plot created!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await updateMutation.mutateAsync({ id, data });
        Alert.alert('Success', 'Plot updated!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      const apiError = error?.response?.data;
      const firstValidationError =
        Array.isArray(apiError?.errors) ? apiError.errors[0]?.message :
        Array.isArray(apiError?.Errors) ? apiError.Errors[0]?.Message :
        undefined;
      Alert.alert('Error', firstValidationError || apiError?.message || 'Operation failed');
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  if (!isNew && isLoading) return <LoadingOverlay fullScreen />;

  const propertyOptions = (propertiesData?.items || []).map((p) => ({ value: p.id, label: p.name }));
  const cropOptions = CROP_TYPES.map((c) => ({ value: c.value, label: `${c.icon} ${c.label}` }));
  const irrigationOptions = IRRIGATION_TYPES.map((i) => ({ value: i.value, label: i.label }));

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <WizardBanner />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>
            {isNew ? 'New Plot' : 'Edit Plot'}
          </Text>
        </View>

        <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
          <View className="rounded-2xl p-4 shadow-sm mb-4" style={{ backgroundColor: colors.card }}>
            <Controller control={control} name="name" render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Plot Name" placeholder="Plot name" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.name?.message} />
            )} />

            <View pointerEvents={isWizardActive && wizardStep === 2 ? 'none' : 'auto'} style={isWizardActive && wizardStep === 2 ? { opacity: 0.6 } : undefined}>
              <Controller control={control} name="propertyId" render={({ field: { onChange, value } }) => (
                <Select label={isWizardActive && wizardStep === 2 ? 'Property (auto-selected)' : 'Property'} options={propertyOptions} value={value} onChange={onChange} error={errors.propertyId?.message} />
              )} />
            </View>

            <Controller control={control} name="cropType" render={({ field: { onChange, value } }) => (
              <Select label="Crop Type" options={cropOptions} value={value} onChange={onChange} error={errors.cropType?.message} />
            )} />

            <Controller control={control} name="irrigationType" render={({ field: { onChange, value } }) => (
              <Select label="Irrigation" options={irrigationOptions} value={value} onChange={onChange} error={errors.irrigationType?.message} />
            )} />

            <Controller control={control} name="areaHectares" render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Area (ha)" keyboardType="numeric" value={value ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : 0)} onBlur={onBlur} error={errors.areaHectares?.message} />
            )} />

            <Controller control={control} name="plantingDate" render={({ field: { onChange, value } }) => (
              <DatePicker label="Planting Date" value={value} onChange={onChange} error={errors.plantingDate?.message} />
            )} />

            <Controller control={control} name="expectedHarvestDate" render={({ field: { onChange, value } }) => (
              <DatePicker label="Expected Harvest" value={value} onChange={onChange} error={errors.expectedHarvestDate?.message} />
            )} />
          </View>

          {/* Thresholds */}
          <View className="rounded-2xl p-4 shadow-sm mb-4" style={{ backgroundColor: colors.card }}>
            <Text className="text-base font-semibold mb-3" style={{ color: colors.text }}>Thresholds (Optional)</Text>
            <Text className="text-xs mb-3" style={{ color: colors.textMuted }}>
              Used to trigger alerts when incoming sensor readings are outside these limits.
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller control={control} name="temperatureMin" render={({ field: { onChange, value } }) => (
                  <Input label="Temp Min (°C)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} error={errors.temperatureMin?.message} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="temperatureMax" render={({ field: { onChange, value } }) => (
                  <Input label="Temp Max (°C)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} error={errors.temperatureMax?.message} />
                )} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller control={control} name="humidityMin" render={({ field: { onChange, value } }) => (
                  <Input label="Humidity Min (%)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} error={errors.humidityMin?.message} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="humidityMax" render={({ field: { onChange, value } }) => (
                  <Input label="Humidity Max (%)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} error={errors.humidityMax?.message} />
                )} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller control={control} name="soilMoistureMin" render={({ field: { onChange, value } }) => (
                  <Input label="Soil Min (%)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} error={errors.soilMoistureMin?.message} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="soilMoistureMax" render={({ field: { onChange, value } }) => (
                  <Input label="Soil Max (%)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} error={errors.soilMoistureMax?.message} />
                )} />
              </View>
            </View>
          </View>

          {/* Associated Sensors */}
          {!isNew && (
            <View className="rounded-2xl p-4 shadow-sm mb-4" style={{ backgroundColor: colors.card }}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-semibold" style={{ color: colors.text }}>
                  Associated Sensors ({plotSensors.length})
                </Text>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(app)/(sensors)/[id]', params: { id: 'new' } })}
                  className="flex-row items-center gap-1"
                >
                  <Ionicons name="add-circle-outline" size={18} color="#2d5016" />
                  <Text className="text-sm font-medium" style={{ color: '#2d5016' }}>Add</Text>
                </TouchableOpacity>
              </View>
              {plotSensors.length === 0 ? (
                <Text className="text-sm text-center py-3" style={{ color: colors.textMuted }}>
                  No sensors linked to this plot
                </Text>
              ) : (
                plotSensors.map((sensor: Sensor) => (
                  <TouchableOpacity
                    key={sensor.id}
                    onPress={() => router.push({ pathname: '/(app)/(sensors)/[id]', params: { id: sensor.id } })}
                    className="flex-row items-center gap-3 py-2.5"
                    style={{ borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
                  >
                    <Text className="text-lg">{getSensorIcon(sensor.type)}</Text>
                    <View className="flex-1">
                      <Text className="text-sm font-medium" style={{ color: colors.text }}>{sensor.label}</Text>
                      <Text className="text-xs" style={{ color: colors.textSecondary }}>{sensor.type}</Text>
                    </View>
                    <Badge
                      text={sensor.status}
                      variant={sensor.status === 'Active' ? 'success' : sensor.status === 'Faulty' ? 'danger' : 'secondary'}
                    />
                    {sensor.batteryLevel != null && (
                      <View className="flex-row items-center gap-1 ml-1">
                        <Ionicons
                          name={sensor.batteryLevel > 20 ? 'battery-half-outline' : 'battery-dead-outline'}
                          size={14}
                          color={sensor.batteryLevel > 20 ? colors.textMuted : '#dc3545'}
                        />
                        <Text className="text-xs" style={{ color: colors.textSecondary }}>{sensor.batteryLevel}%</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <View className="mb-8">
            <Button title={isNew ? 'Create Plot' : 'Update Plot'} onPress={handleSubmit(onSubmit)} loading={isSaving} fullWidth size="lg" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
