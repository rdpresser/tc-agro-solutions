import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useSensor, useSensorReadings, useCreateSensor, useChangeSensorStatus } from '@/hooks/queries/use-sensors';
import { usePlots } from '@/hooks/queries/use-plots';
import { useOwners } from '@/hooks/queries/use-owners';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useAuthStore } from '@/stores/auth.store';
import { useOwnerScope } from '@/hooks/use-owner-scope';
import { useDashboardOwnerFilterStore } from '@/stores/dashboard-owner-filter.store';
import { useTheme } from '@/providers/theme-provider';
import { sensorSchema, type SensorFormData } from '@/lib/validation';
import { SENSOR_TYPES, SENSOR_STATUSES, getSensorIcon } from '@/constants/crop-types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { WizardBanner } from '@/components/onboarding/WizardBanner';
import { CelebrationModal } from '@/components/onboarding/CelebrationModal';
import { formatDateTime, formatTemperature, formatPercentage, getTemperatureColor, getHumidityColor, getSoilMoistureColor } from '@/lib/format';

export default function SensorDetailScreen() {
  const { id, wizard } = useLocalSearchParams<{ id: string; wizard?: string }>();
  const isNew = id === 'new';
  const isWizardRoute = wizard === '1';
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const ownerScopeId = useOwnerScope();
  const dashboardOwnerId = useDashboardOwnerFilterStore((s) => s.selectedOwnerId);
  const setDashboardOwnerId = useDashboardOwnerFilterStore((s) => s.setSelectedOwnerId);
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const isWizardActive = useOnboardingStore((s) => s.isWizardActive);
  const wizardStep = useOnboardingStore((s) => s.wizardStep);
  const createdPlotId = useOnboardingStore((s) => s.createdPlotId);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const [showCelebration, setShowCelebration] = useState(false);

  const navigateBackToList = React.useCallback(() => {
    router.replace('/(app)/(sensors)');
  }, []);

  // Auto-pop this screen when the wizard ends (skip or complete)
  // to clean up stale navigation state left by cross-tab router.replace.
  // Guard against showCelebration so we don't pop during the celebration modal.
  const wizardActiveOnMount = useRef(isWizardActive && isNew);
  useEffect(() => {
    if ((wizardActiveOnMount.current || isWizardRoute) && !isWizardActive && !showCelebration) {
      wizardActiveOnMount.current = false;
      navigateBackToList();
    }
  }, [isWizardActive, isWizardRoute, showCelebration, navigateBackToList]);

  const { data: sensor, isLoading } = useSensor(isNew ? '' : id);
  const { data: readings } = useSensorReadings(isNew ? '' : id);
  const { data: owners = [] } = useOwners();
  const { data: plotsData } = usePlots({
    pageSize: 100,
    ...(isAdmin && selectedOwnerId ? { ownerId: selectedOwnerId } : {}),
  });
  const createMutation = useCreateSensor();
  const changeStatusMutation = useChangeSensorStatus();

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<SensorFormData>({
    resolver: zodResolver(sensorSchema),
    defaultValues: { label: '', type: '', plotId: '' },
  });

  // Pre-fill plotId when in wizard step 3
  useEffect(() => {
    if (isWizardActive && wizardStep === 3 && createdPlotId && isNew) {
      setValue('plotId', createdPlotId, { shouldValidate: true });
    }
  }, [isWizardActive, wizardStep, createdPlotId, isNew, setValue]);

  useEffect(() => {
    if (!isNew) return;
    if (isAdmin) {
      if (dashboardOwnerId) {
        setSelectedOwnerId(dashboardOwnerId);
        return;
      }

      const fallbackOwnerId = owners?.[0]?.id;
      if (fallbackOwnerId) {
        setSelectedOwnerId(fallbackOwnerId);
        setDashboardOwnerId(fallbackOwnerId);
      }
      return;
    }

    if (ownerScopeId) {
      setSelectedOwnerId(ownerScopeId);
    }
  }, [isNew, isAdmin, dashboardOwnerId, ownerScopeId, owners, setDashboardOwnerId]);

  useEffect(() => {
    if (!isNew) return;
    setValue('plotId', '', { shouldValidate: true });
  }, [selectedOwnerId, isNew, setValue]);

  const onSubmit = async (data: SensorFormData) => {
    try {
      if (isAdmin && !selectedOwnerId) {
        Alert.alert('Owner required', 'Select an owner to create a sensor as admin.');
        return;
      }

      const payload = {
        ...data,
        ...(selectedOwnerId ? { ownerId: selectedOwnerId } : {}),
      };

      await createMutation.mutateAsync(payload);
      if (isWizardActive) {
        await completeOnboarding();
        setShowCelebration(true);
        return;
      }
      Alert.alert('Success', 'Sensor created!', [
        { text: 'OK', onPress: navigateBackToList },
      ]);
    } catch (error: any) {
      const apiError = error?.response?.data;
      const errorList = apiError?.errors || apiError?.Errors;
      let msg = 'Failed to create sensor';
      if (Array.isArray(errorList) && errorList.length > 0) {
        msg = errorList
          .map((e: any) => e?.reason || e?.Reason || e?.message || e?.Message || e?.name || 'Unknown error')
          .join('\n');
      } else {
        msg = apiError?.message || apiError?.Message
          || apiError?.detail || apiError?.Detail
          || apiError?.title || apiError?.Title
          || (typeof apiError === 'string' ? apiError : null)
          || error?.message
          || 'Failed to create sensor';
      }
      Alert.alert('Error', msg);
    }
  };

  const ownerOptions = owners.map((o) => ({ value: o.id, label: `${o.name}${o.email ? ` - ${o.email}` : ''}` }));
  const plotOptions = (plotsData?.items || []).map((p) => ({ value: p.id, label: `${p.name} (${p.propertyName})` }));

  if (!isNew && isLoading) return <LoadingOverlay fullScreen />;

  // New sensor form
  if (isNew) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <WizardBanner />
        <CelebrationModal
          visible={showCelebration}
          onGoToDashboard={() => {
            setShowCelebration(false);
            router.replace('/(app)/(dashboard)');
          }}
        />
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
            <TouchableOpacity onPress={navigateBackToList}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text className="text-xl font-bold" style={{ color: colors.text }}>New Sensor</Text>
          </View>
          <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
            <View className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: colors.card }}>
              {isAdmin && (
                <Select
                  label="Owner"
                  options={ownerOptions}
                  value={selectedOwnerId}
                  onChange={(nextOwnerId) => {
                    setSelectedOwnerId(nextOwnerId);
                    setDashboardOwnerId(nextOwnerId || null);
                  }}
                  placeholder="Select owner..."
                />
              )}

              <Controller control={control} name="label" render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Label" placeholder="Sensor label" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.label?.message} />
              )} />
              <Controller control={control} name="type" render={({ field: { onChange, value } }) => (
                <Select label="Type" options={SENSOR_TYPES.map((s) => ({ value: s.value, label: `${s.icon} ${s.label}` }))} value={value} onChange={onChange} error={errors.type?.message} />
              )} />
              <View pointerEvents={isWizardActive && wizardStep === 3 ? 'none' : 'auto'} style={isWizardActive && wizardStep === 3 ? { opacity: 0.6 } : undefined}>
                <Controller control={control} name="plotId" render={({ field: { onChange, value } }) => (
                  <Select label={isWizardActive && wizardStep === 3 ? 'Plot (auto-selected)' : 'Plot'} options={plotOptions} value={value} onChange={onChange} error={errors.plotId?.message} />
                )} />
              </View>
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
        <TouchableOpacity onPress={navigateBackToList}>
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

      <View className="px-4 mb-3">
        <Button
          title="Change Status"
          variant="outline"
          fullWidth
          onPress={() => {
            if (!sensor?.id) return;
            const options = SENSOR_STATUSES.filter((s) => s.value !== sensor.status);
            Alert.alert(
              'Change Sensor Status',
              `Select new status for ${sensor.label}`,
              [
                ...options.map((status) => ({
                  text: status.label,
                  onPress: () => {
                    changeStatusMutation.mutate(
                      { id: sensor.id, data: { newStatus: status.value } },
                      {
                        onSuccess: () => Alert.alert('Success', 'Sensor status updated.'),
                        onError: () => Alert.alert('Error', 'Failed to update sensor status.'),
                      }
                    );
                  },
                })),
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          disabled={changeStatusMutation.isPending}
        />
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Sensor Info */}
        <Card className="mb-4">
          <Text className="font-semibold mb-2" style={{ color: colors.text }}>Sensor Info</Text>
          <View className="gap-2">
            <InfoRow label="Type" value={`${getSensorIcon(sensor?.type || '')} ${sensor?.type || '-'}`} />
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
            <Text className="text-center py-4" style={{ color: colors.textMuted }}>
              No readings yet for this sensor
            </Text>
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
                  <Text className="font-semibold" style={{ color: getTemperatureColor(r.temperature) }}>{formatTemperature(r.temperature)}</Text>
                </View>
                <View>
                  <Text className="text-xs" style={{ color: colors.textMuted }}>Humidity</Text>
                  <Text className="font-semibold" style={{ color: getHumidityColor(r.humidity) }}>{formatPercentage(r.humidity)}</Text>
                </View>
                <View>
                  <Text className="text-xs" style={{ color: colors.textMuted }}>Soil</Text>
                  <Text className="font-semibold" style={{ color: getSoilMoistureColor(r.soilMoisture) }}>{formatPercentage(r.soilMoisture)}</Text>
                </View>
                <View>
                  <Text className="text-xs" style={{ color: colors.textMuted }}>Rain</Text>
                  <Text className="font-semibold" style={{ color: colors.textSecondary }}>{r.rainfall?.toFixed(1)} mm</Text>
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
  const { colors } = useTheme();

  return (
    <View className="flex-row justify-between">
      <Text className="text-sm" style={{ color: colors.textMuted }}>{label}</Text>
      <Text className="text-sm font-medium" style={{ color: colors.text }}>{value}</Text>
    </View>
  );
}
