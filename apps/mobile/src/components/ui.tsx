// src/components/ui.tsx
import type { ReactNode } from 'react'
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native'
import { colors, badgeColors } from '../lib/theme'
import { ESTADO_LABEL } from '../lib/mappers'
import type { EstadoProyecto } from '../data/types'

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  if (scroll) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={[s.screenContent, style]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    )
  }
  return <View style={[s.screen, s.screenContent, style]}>{children}</View>
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.slate400} {...props} style={[s.input, props.style]} />
}

export function TextArea(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.slate400} multiline {...props} style={[s.input, s.textarea, props.style]} />
}

type Variant = 'primary' | 'outline' | 'danger' | 'ghost'
export function Button({
  title, onPress, variant = 'primary', disabled, loading, style,
}: { title: string; onPress?: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [s.btn, btnVariant[variant], isDisabled && s.btnDisabled, pressed && s.btnPressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[s.btnText, variant === 'outline' || variant === 'ghost' ? s.btnTextDark : undefined]}>
          {title}
        </Text>
      )}
    </Pressable>
  )
}

export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{label}</Text>
    </View>
  )
}

export function StatusBadge({ estado }: { estado: EstadoProyecto }) {
  const c = badgeColors[estado]
  return <Badge label={ESTADO_LABEL[estado]} bg={c.bg} fg={c.fg} />
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return <Text style={s.errorText}>{children}</Text>
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={s.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={s.muted}>{label}</Text>
    </View>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={s.sectionTitle}>{children}</Text>
}

export function Logo({ size = 52 }: { size?: number }) {
  // Sin asset remoto: cuadrado navy con iniciales UCH (placeholder consistente).
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.32 }}>UCH</Text>
    </View>
  )
}

export function Stepper({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <View style={s.stepper}>
      {pasos.map((nombre, i) => (
        <View key={nombre} style={s.stepItem}>
          {i > 0 && <View style={[s.stepBar, i <= actual && { backgroundColor: colors.primary }]} />}
          <View style={[s.stepDot, i <= actual ? { backgroundColor: colors.primary } : { backgroundColor: colors.blue50 }]}>
            <Text style={[s.stepDotText, i <= actual ? { color: '#fff' } : { color: colors.slate400 }]}>{i < actual ? '✓' : i + 1}</Text>
          </View>
          <Text style={s.stepLabel}>{nombre}</Text>
        </View>
      ))}
    </View>
  )
}

const btnVariant: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  outline: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: colors.bg },
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.lineSoft, padding: 14 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.slate700 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnTextDark: { color: colors.primary },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '500' },
  loading: { padding: 20, alignItems: 'center', gap: 8 },
  muted: { color: colors.slate500, fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepBar: { width: 24, height: 2, backgroundColor: colors.line },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepDotText: { fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 11, color: colors.slate500, marginLeft: 4 },
})
