import React, { useEffect } from 'react';
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
import { useTheme } from '@/providers/theme-provider';
import { propertySchema, type PropertyFormData } from '@/lib/validation';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

export default function PropertyFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { colors } = useTheme();

  const { data: property, isLoading } = useProperty(isNew ? '' : id);
  const { data: owners } = useOwners();
  const createMutation = useCreateProperty();
  const updateMutation = useUpdateProperty();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: '', ownerId: '', city: '', state: '', country: 'Brazil', areaHectares: 0,
    },
  });

  useEffect(() => {
    if (property && !isNew) {
      reset({
        name: property.name,
        ownerId: property.ownerId || '',
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
      if (isNew) {
        await createMutation.mutateAsync(data);
        Alert.alert('Success', 'Property created!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await updateMutation.mutateAsync({ id, data: { ...data, id } });
        Alert.alert('Success', 'Property updated!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Operation failed');
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) return <LoadingOverlay fullScreen />;

  const ownerOptions = (owners || []).map((o) => ({ value: o.id, label: o.name }));

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>
            {isNew ? 'New Property' : 'Edit Property'}
          </Text>
        </View>

        <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Property Name"
                  placeholder="Farm name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.name?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="ownerId"
              render={({ field: { onChange, value } }) => (
                <Select
                  label="Owner"
                  options={ownerOptions}
                  value={value}
                  onChange={onChange}
                  error={errors.ownerId?.message}
                  placeholder="Select owner..."
                />
              )}
            />

            <Controller
              control={control}
              name="city"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="City"
                  placeholder="City"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.city?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="state"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="State"
                  placeholder="State"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.state?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="country"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Country"
                  placeholder="Country"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.country?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="areaHectares"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Area (hectares)"
                  placeholder="0"
                  keyboardType="numeric"
                  value={value ? String(value) : ''}
                  onChangeText={(t) => onChange(t ? Number(t) : 0)}
                  onBlur={onBlur}
                  error={errors.areaHectares?.message}
                />
              )}
            />

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="latitude"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Latitude"
                      placeholder="-23.5505"
                      keyboardType="numeric"
                      value={value != null ? String(value) : ''}
                      onChangeText={(t) => onChange(t ? Number(t) : undefined)}
                      onBlur={onBlur}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="longitude"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Longitude"
                      placeholder="-46.6333"
                      keyboardType="numeric"
                      value={value != null ? String(value) : ''}
                      onChangeText={(t) => onChange(t ? Number(t) : undefined)}
                      onBlur={onBlur}
                    />
                  )}
                />
              </View>
            </View>

            <View className="mt-2">
              <Button
                title={isNew ? 'Create Property' : 'Update Property'}
                onPress={handleSubmit(onSubmit)}
                loading={isSaving}
                fullWidth
                size="lg"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
