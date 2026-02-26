import React, { useEffect } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { usePlot, useCreatePlot, useUpdatePlot } from '@/hooks/queries/use-plots';
import { useProperties } from '@/hooks/queries/use-properties';
import { useTheme } from '@/providers/theme-provider';
import { plotSchema, type PlotFormData } from '@/lib/validation';
import { CROP_TYPES, IRRIGATION_TYPES } from '@/constants/crop-types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

export default function PlotFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { colors } = useTheme();

  const { data: plot, isLoading } = usePlot(isNew ? '' : id);
  const { data: propertiesData } = useProperties({ pageSize: 100 });
  const createMutation = useCreatePlot();
  const updateMutation = useUpdatePlot();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<PlotFormData>({
    resolver: zodResolver(plotSchema),
    defaultValues: {
      name: '', propertyId: '', cropType: '', plantingDate: '',
      expectedHarvestDate: '', irrigationType: '', areaHectares: 0,
    },
  });

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

  const onSubmit = async (data: PlotFormData) => {
    try {
      if (isNew) {
        await createMutation.mutateAsync(data);
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
      Alert.alert('Error', error?.response?.data?.message || 'Operation failed');
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  if (!isNew && isLoading) return <LoadingOverlay fullScreen />;

  const propertyOptions = (propertiesData?.items || []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
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
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <Controller control={control} name="name" render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Plot Name" placeholder="Plot name" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.name?.message} />
            )} />

            <Controller control={control} name="propertyId" render={({ field: { onChange, value } }) => (
              <Select label="Property" options={propertyOptions} value={value} onChange={onChange} error={errors.propertyId?.message} />
            )} />

            <Controller control={control} name="cropType" render={({ field: { onChange, value } }) => (
              <Select label="Crop Type" options={CROP_TYPES as any} value={value} onChange={onChange} error={errors.cropType?.message} />
            )} />

            <Controller control={control} name="irrigationType" render={({ field: { onChange, value } }) => (
              <Select label="Irrigation" options={IRRIGATION_TYPES as any} value={value} onChange={onChange} error={errors.irrigationType?.message} />
            )} />

            <Controller control={control} name="areaHectares" render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Area (ha)" keyboardType="numeric" value={value ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : 0)} onBlur={onBlur} error={errors.areaHectares?.message} />
            )} />

            <Controller control={control} name="plantingDate" render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Planting Date" placeholder="YYYY-MM-DD" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.plantingDate?.message} />
            )} />

            <Controller control={control} name="expectedHarvestDate" render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Expected Harvest" placeholder="YYYY-MM-DD" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.expectedHarvestDate?.message} />
            )} />
          </View>

          {/* Thresholds */}
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <Text className="text-base font-semibold mb-3" style={{ color: colors.text }}>Thresholds (Optional)</Text>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller control={control} name="temperatureMin" render={({ field: { onChange, value } }) => (
                  <Input label="Temp Min (°C)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="temperatureMax" render={({ field: { onChange, value } }) => (
                  <Input label="Temp Max (°C)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} />
                )} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller control={control} name="humidityMin" render={({ field: { onChange, value } }) => (
                  <Input label="Humidity Min (%)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="humidityMax" render={({ field: { onChange, value } }) => (
                  <Input label="Humidity Max (%)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} />
                )} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller control={control} name="soilMoistureMin" render={({ field: { onChange, value } }) => (
                  <Input label="Soil Min (%)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="soilMoistureMax" render={({ field: { onChange, value } }) => (
                  <Input label="Soil Max (%)" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} />
                )} />
              </View>
            </View>
          </View>

          <View className="mb-8">
            <Button title={isNew ? 'Create Plot' : 'Update Plot'} onPress={handleSubmit(onSubmit)} loading={isSaving} fullWidth size="lg" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
