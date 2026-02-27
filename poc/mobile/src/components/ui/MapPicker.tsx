import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  ActivityIndicator, Platform,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/theme-provider';

interface MapPickerProps {
  latitude?: number;
  longitude?: number;
  onLocationSelect: (location: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  }) => void;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    road?: string;
    suburb?: string;
  };
}

const DEFAULT_REGION: Region = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function MapPicker({ latitude, longitude, onLocationSelect }: MapPickerProps) {
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const [visible, setVisible] = useState(false);
  const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(
    latitude && longitude ? { latitude, longitude } : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const initialRegion: Region = latitude && longitude
    ? { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : DEFAULT_REGION;

  const moveMapTo = useCallback((lat: number, lng: number) => {
    const region: Region = {
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    mapRef.current?.animateToRegion(region, 500);
  }, []);

  const focusOnCurrentLocation = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const Location = await import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationError('Permita o acesso à localização para centralizar o mapa.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = current.coords.latitude;
      const lng = current.coords.longitude;
      moveMapTo(lat, lng);

      if (!marker && !(latitude && longitude)) {
        setMarker({ latitude: lat, longitude: lng });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('ExpoLocation')) {
        setLocationError('Reabra o app com Expo Go ou rode npx expo run:ios para carregar o módulo de localização.');
      } else {
        setLocationError('Não foi possível obter sua localização no simulador. No iOS Simulator: Features > Location > Apple.');
      }
    } finally {
      setLocating(false);
    }
  }, [latitude, longitude, marker, moveMapTo]);

  useEffect(() => {
    if (!visible) return;

    if (latitude && longitude) {
      moveMapTo(latitude, longitude);
      return;
    }

    void focusOnCurrentLocation();
  }, [visible, latitude, longitude, moveMapTo, focusOnCurrentLocation]);

  const handleMapPress = useCallback((e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    setMarker(e.nativeEvent.coordinate);
    setResults([]);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`,
        { headers: { 'User-Agent': 'TCAgro-Mobile/1.0' } }
      );
      setResults(await res.json());
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const selectResult = useCallback((item: NominatimResult) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setMarker({ latitude: lat, longitude: lng });
    setResults([]);
    setSearchQuery('');
    mapRef.current?.animateToRegion({
      latitude: lat, longitude: lng,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
    }, 500);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!marker) return;
    // Reverse geocode
    let geo: { address?: string; city?: string; state?: string; country?: string } = {};
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${marker.latitude}&lon=${marker.longitude}`,
        { headers: { 'User-Agent': 'TCAgro-Mobile/1.0' } }
      );
      const data = await res.json();
      const addr = data.address || {};
      geo = {
        address: addr.road || addr.suburb || undefined,
        city: addr.city || addr.town || addr.village || undefined,
        state: addr.state || undefined,
        country: addr.country || undefined,
      };
    } catch {}
    onLocationSelect({ ...marker, ...geo });
    setVisible(false);
    setResults([]);
    setSearchQuery('');
  }, [marker, onLocationSelect]);

  const hasCoords = latitude != null && longitude != null;

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          setMapReady(false);
          setVisible(true);
        }}
        className="flex-row items-center gap-2 px-4 py-3 rounded-lg mb-3"
        style={{ backgroundColor: colors.primary + '18' }}
      >
        <Ionicons name="location-outline" size={20} color={colors.primary} />
        <Text className="text-sm font-medium" style={{ color: colors.primary }}>
          {hasCoords ? 'Change Location' : 'Pick on Map'}
        </Text>
        {hasCoords && (
          <Text className="text-xs ml-auto" style={{ color: colors.textMuted }}>
            {latitude!.toFixed(4)}, {longitude!.toFixed(4)}
          </Text>
        )}
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
          {/* Header */}
          <View
            className="px-4 flex-row items-center justify-between"
            style={{
              paddingTop: Platform.OS === 'ios' ? 56 : 16,
              paddingBottom: 12,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity onPress={() => { setVisible(false); setResults([]); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text className="text-lg font-semibold" style={{ color: colors.text }}>Select Location</Text>
            <TouchableOpacity onPress={handleConfirm} disabled={!marker}>
              <Text className="text-base font-semibold" style={{ color: marker ? colors.primary : colors.textMuted }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View className="px-4 py-2 flex-row gap-2" style={{ backgroundColor: colors.surface }}>
            <View
              className="flex-1 flex-row items-center rounded-lg px-3"
              style={{ backgroundColor: colors.background }}
            >
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                className="flex-1 py-2.5 px-2 text-sm"
                style={{ color: colors.text }}
                placeholder="Search address..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            <TouchableOpacity
              onPress={handleSearch}
              className="px-4 rounded-lg justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-white text-sm font-medium">Go</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { void focusOnCurrentLocation(); }}
              className="px-3 rounded-lg justify-center"
              style={{ backgroundColor: colors.primary + '22' }}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="locate" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>

          {locationError && (
            <View className="px-4 pb-2" style={{ backgroundColor: colors.surface }}>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {locationError}
              </Text>
            </View>
          )}

          {/* Search Results overlay */}
          {results.length > 0 && (
            <View className="absolute left-0 right-0 z-10 px-4" style={{ top: Platform.OS === 'ios' ? 156 : 116 }}>
              <View className="rounded-xl shadow-lg overflow-hidden" style={{ backgroundColor: colors.surface }}>
                {results.map((r, i) => (
                  <TouchableOpacity
                    key={`${r.lat}-${r.lon}-${i}`}
                    onPress={() => selectResult(r)}
                    className="px-4 py-3"
                    style={{ borderBottomWidth: i < results.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}
                  >
                    <View className="flex-row items-start gap-2">
                      <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                      <Text className="text-sm flex-1" style={{ color: colors.text }} numberOfLines={2}>
                        {r.display_name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Map */}
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={initialRegion}
            onPress={handleMapPress}
            onMapReady={() => setMapReady(true)}
            loadingEnabled
            showsUserLocation
            showsMyLocationButton
            userInterfaceStyle={isDark ? 'dark' : 'light'}
          >
            {marker && (
              <Marker
                coordinate={marker}
                draggable
                onDragEnd={(e) => setMarker(e.nativeEvent.coordinate)}
              />
            )}
          </MapView>

          {!mapReady && (
            <View
              className="absolute left-0 right-0 items-center justify-center"
              style={{ top: Platform.OS === 'ios' ? 150 : 110, bottom: marker ? 56 : 0 }}
              pointerEvents="none"
            >
              <View className="px-3 py-2 rounded-full flex-row items-center gap-2" style={{ backgroundColor: colors.surface }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-xs" style={{ color: colors.textSecondary }}>
                  Loading map...
                </Text>
              </View>
            </View>
          )}

          {/* Coordinates footer */}
          {marker && (
            <View
              className="px-4 py-3 flex-row items-center justify-center gap-2"
              style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <Ionicons name="location" size={16} color={colors.primary} />
              <Text className="text-sm" style={{ color: colors.text }}>
                {marker.latitude.toFixed(6)}, {marker.longitude.toFixed(6)}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}
