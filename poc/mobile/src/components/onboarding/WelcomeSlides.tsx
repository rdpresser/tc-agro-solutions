import React, { useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Dimensions, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';

const { width } = Dimensions.get('window');

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  description: string;
}

const slides: Slide[] = [
  {
    icon: 'leaf',
    color: '#2d5016',
    title: 'Welcome to TC Agro',
    description: 'Your smart agriculture platform. Monitor crops, manage sensors, and receive real-time alerts to keep your farm healthy.',
  },
  {
    icon: 'business',
    color: '#6b4423',
    title: 'Properties',
    description: 'Start by registering your farm properties. Each property represents a physical location you manage.',
  },
  {
    icon: 'grid',
    color: '#27AE60',
    title: 'Plots & Crops',
    description: 'Divide properties into plots. Assign crop types, irrigation methods, and set threshold alerts for each one.',
  },
  {
    icon: 'hardware-chip',
    color: '#17a2b8',
    title: 'Sensors',
    description: 'Link IoT sensors to your plots. Monitor temperature, humidity, soil moisture, and rainfall in real-time.',
  },
  {
    icon: 'notifications',
    color: '#dc3545',
    title: 'Alerts',
    description: 'Get instant notifications when sensor readings cross your defined thresholds. Never miss a critical event.',
  },
];

interface Props {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function WelcomeSlides({ visible, onComplete, onSkip }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLastSlide = activeIndex === slides.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    }
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        {/* Skip */}
        <TouchableOpacity
          onPress={onSkip}
          style={{ position: 'absolute', top: insets.top + 12, right: 20, zIndex: 10 }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600' }}>Skip</Text>
        </TouchableOpacity>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={{ width, flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
              <View style={{
                width: 120, height: 120, borderRadius: 60,
                backgroundColor: item.color + '20',
                justifyContent: 'center', alignItems: 'center', marginBottom: 32,
              }}>
                <Ionicons name={item.icon} size={56} color={item.color} />
              </View>
              <Text style={{ color: colors.text, fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>
                {item.title}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
                {item.description}
              </Text>
            </View>
          )}
        />

        {/* Dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 24 }}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === activeIndex ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === activeIndex ? colors.primary : colors.border,
                marginHorizontal: 4,
              }}
            />
          ))}
        </View>

        {/* Button */}
        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
          <TouchableOpacity
            onPress={handleNext}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
              {isLastSlide ? "Let's set up your farm!" : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
