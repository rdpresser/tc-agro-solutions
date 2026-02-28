import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOnboardingStore } from '@/stores/onboarding.store';
import { useTheme } from '@/providers/theme-provider';

const steps = [
  { label: 'Property', icon: 'business' as const },
  { label: 'Plot', icon: 'leaf' as const },
  { label: 'Sensor', icon: 'hardware-chip' as const },
];

export function WizardBanner() {
  const { colors } = useTheme();
  const isWizardActive = useOnboardingStore((s) => s.isWizardActive);
  const wizardStep = useOnboardingStore((s) => s.wizardStep);
  const skipOnboarding = useOnboardingStore((s) => s.skipOnboarding);

  if (!isWizardActive) return null;

  return (
    <View style={{
      backgroundColor: colors.primary + '15',
      borderBottomWidth: 1,
      borderBottomColor: colors.primary + '30',
      paddingHorizontal: 16,
      paddingVertical: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
          Setup Wizard - Step {wizardStep}/3
        </Text>
        <TouchableOpacity onPress={async () => {
          await skipOnboarding();
        }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Skip setup</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {steps.map((step, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3;
          const isCompleted = stepNum < wizardStep;
          const isCurrent = stepNum === wizardStep;

          return (
            <React.Fragment key={step.label}>
              {i > 0 && (
                <View style={{
                  height: 2, flex: 1, maxWidth: 40,
                  backgroundColor: isCompleted ? colors.primary : colors.border,
                }} />
              )}
              <View style={{ alignItems: 'center', gap: 4 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: isCompleted ? colors.primary : isCurrent ? colors.primary : colors.border,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  ) : (
                    <Ionicons name={step.icon} size={18} color={isCurrent ? '#fff' : colors.textMuted} />
                  )}
                </View>
                <Text style={{
                  fontSize: 11, fontWeight: isCurrent ? '700' : '500',
                  color: isCurrent ? colors.primary : colors.textMuted,
                }}>
                  {step.label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}
