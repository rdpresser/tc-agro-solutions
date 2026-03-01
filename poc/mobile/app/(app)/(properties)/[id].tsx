import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView,
  Platform, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useProperty, useCreateProperty, useUpdateProperty } from '@/hooks/queries/use-properties';
import { useOwners } from '@/hooks/queries/use-owners';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useTheme } from '@/providers/theme-provider';
import { propertySchema, type PropertyFormData } from '@/lib/validation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { MapPicker } from '@/components/ui/MapPicker';
import { WizardBanner } from '@/components/onboarding/WizardBanner';

export default function PropertyFormScreen() {
  const { id, wizard } = useLocalSearchParams<{ id: string; wizard?: string }>();
  const isNew = id === 'new';
  const isWizardRoute = wizard === '1';
  const { colors } = useTheme();
  const isWizardActive = useOnboardingStore((s) => s.isWizardActive);
  const advanceToStep2 = useOnboardingStore((s) => s.advanceToStep2);

  const navigateBackToList = useCallback(() => {
    router.replace('/(app)/(properties)');
  }, []);

  // Auto-pop this screen when the wizard ends (skip or complete)
  // to clean up stale navigation state left by cross-tab router.replace
  const wizardActiveOnMount = useRef(isWizardActive && isNew);
  useEffect(() => {
    if ((wizardActiveOnMount.current || isWizardRoute) && !isWizardActive) {
      wizardActiveOnMount.current = false;
      navigateBackToList();
    }
  }, [isWizardActive, isWizardRoute, navigateBackToList]);

  const { data: property, isLoading } = useProperty(isNew ? '' : id);
  const { data: owners } = useOwners();
  const createMutation = useCreateProperty();
  const updateMutation = useUpdateProperty();

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: '', ownerId: '', address: '', city: '', state: '', country: 'Brazil', areaHectares: 0,
    },
  });

  const watchLat = watch('latitude');
  const watchLng = watch('longitude');

  useEffect(() => {
    if (property && !isNew) {
      reset({
        name: property.name,
        ownerId: property.ownerId || '',
        address: property.address || '',
        city: property.city,
        state: property.state,
        country: property.country,
        areaHectares: property.areaHectares,
        latitude: property.latitude,
        longitude: property.longitude,
      });
    }
  }, [property, isNew, reset]);

  const onSubmit = async (data: PropertyFormData) => {
    try {
      if (data.latitude == null || data.longitude == null) {
        Alert.alert('Location required', 'Choose a point on the map before saving.');
        return;
      }

      if (!data.address?.trim() || !data.city?.trim() || !data.state?.trim() || !data.country?.trim()) {
        Alert.alert('Address required', 'Tap map location and confirm to auto-fill address details.');
        return;
      }

      if (isNew) {
        const result = await createMutation.mutateAsync(data);
        if (isWizardActive && result?.id) {
          await advanceToStep2(result.id);
          router.replace({ pathname: '/(app)/(plots)/[id]', params: { id: 'new', wizard: '1' } });
          return;
        }
        Alert.alert('Success', 'Property created!', [
          { text: 'OK', onPress: navigateBackToList },
        ]);
      } else {
        await updateMutation.mutateAsync({ id, data: { ...data, id } });
        Alert.alert('Success', 'Property updated!', [
          { text: 'OK', onPress: navigateBackToList },
        ]);
      }
    } catch (error: any) {
      const apiError = error?.response?.data;
      const errorList = apiError?.errors || apiError?.Errors;
      let msg = 'Operation failed';
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
          || 'Operation failed';
      }
      Alert.alert('Error', msg);
    }
  };

  const handleMapLocation = (loc: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  }) => {
    const address = loc.address?.trim() || `Pin ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`;
    const city = loc.city?.trim() || 'Unknown city';
    const state = loc.state?.trim() || 'Unknown state';
    const country = loc.country?.trim() || 'Brazil';

    setValue('latitude', loc.latitude, { shouldValidate: true });
    setValue('longitude', loc.longitude, { shouldValidate: true });
    setValue('address', address, { shouldValidate: true });
    setValue('city', city, { shouldValidate: true });
    setValue('state', state, { shouldValidate: true });
    setValue('country', country, { shouldValidate: true });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) return <LoadingOverlay fullScreen />;

  const ownerOptions = (owners || []).map((o) => ({ value: o.id, label: o.name }));
  const watchAddress = watch('address');
  const watchCity = watch('city');
  const watchState = watch('state');
  const watchCountry = watch('country');

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <WizardBanner />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={navigateBackToList}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>
            {isNew ? 'New Property' : 'Edit Property'}
          </Text>
        </View>

        <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
          <View className="rounded-2xl p-4 shadow-sm mb-4" style={{ backgroundColor: colors.card }}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Property Name" placeholder="Farm name" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.name?.message} />
              )}
            />

            <Controller
              control={control}
              name="ownerId"
              render={({ field: { onChange, value } }) => (
                <Select label="Owner" options={ownerOptions} value={value} onChange={onChange} error={errors.ownerId?.message} placeholder="Select owner..." />
              )}
            />

            <Controller
              control={control}
              name="areaHectares"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Area (hectares)" placeholder="0" keyboardType="numeric" value={value ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : 0)} onBlur={onBlur} error={errors.areaHectares?.message} />
              )}
            />
          </View>

          {/* Address Section */}
          <View className="rounded-2xl p-4 shadow-sm mb-4" style={{ backgroundColor: colors.card }}>
            <Text className="text-base font-semibold mb-3" style={{ color: colors.text }}>Address</Text>
            <Text className="text-xs mb-2" style={{ color: colors.textMuted }}>
              Address is auto-filled from map selection.
            </Text>
            <Text className="text-sm mb-1" style={{ color: colors.text }}>
              {watchAddress || 'No address selected yet'}
            </Text>
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              {[watchCity, watchState, watchCountry].filter(Boolean).join(' - ') || 'City / State / Country'}
            </Text>
            {(errors.address || errors.city || errors.state || errors.country) && (
              <Text className="text-xs mt-2" style={{ color: colors.textSecondary }}>
                Confirm a location on the map to fill required address data.
              </Text>
            )}
          </View>

          {/* Location Section */}
          <View className="rounded-2xl p-4 shadow-sm mb-4" style={{ backgroundColor: colors.card }}>
            <Text className="text-base font-semibold mb-3" style={{ color: colors.text }}>Location</Text>

            <MapPicker
              latitude={watchLat}
              longitude={watchLng}
              onLocationSelect={handleMapLocation}
            />

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="latitude"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input label="Latitude" placeholder="-23.5505" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} onBlur={onBlur} />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="longitude"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input label="Longitude" placeholder="-46.6333" keyboardType="numeric" value={value != null ? String(value) : ''} onChangeText={(t) => onChange(t ? Number(t) : undefined)} onBlur={onBlur} />
                  )}
                />
              </View>
            </View>
          </View>

          <View className="mb-8">
            <Button
              title={isNew ? 'Create Property' : 'Update Property'}
              onPress={handleSubmit(onSubmit)}
              loading={isSaving}
              fullWidth
              size="lg"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
