// app/acerca.tsx
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Screen } from '../src/components/ui'
import { colors } from '../src/lib/theme'

const PILARES = [
  { titulo: 'Evaluar', detalle: 'Revisión ética de proyectos.' },
  { titulo: 'Dictaminar', detalle: 'Emisión de dictámenes.' },
  { titulo: 'Acompañar', detalle: 'Guía a investigadores.' },
]

const FAQS = [
  {
    q: '¿Quién puede postular?',
    a: 'Estudiantes de pregrado y posgrado, docentes investigadores, egresados e investigadores externos con proyectos vinculados a la UCH.',
  },
  {
    q: '¿Qué documentos necesito?',
    a: 'Proyecto de investigación, consentimiento informado, carta de presentación y boleta de pago. Según el estudio pueden pedirse instrumentos adicionales.',
  },
  {
    q: '¿Cuánto demora la evaluación?',
    a: 'La revisión administrativa toma de 3 a 5 días hábiles; la evaluación del comité, hasta 15 días hábiles desde la admisión del proyecto.',
  },
]

export default function Acerca() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [abierta, setAbierta] = useState<number | null>(null)

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))} style={s.backBtn} hitSlop={8}>
          <Text style={s.backText}>‹</Text>
        </Pressable>
        <View style={s.logoBox}><Text style={s.logoText}>UCH</Text></View>
        <Text style={s.h1}>Comité de Ética en Investigación</Text>
        <Text style={s.headerP}>Evaluamos y acompañamos los proyectos de investigación de la comunidad UCH bajo principios éticos.</Text>
      </View>

      <Screen>
        <View style={s.pilaresRow}>
          {PILARES.map(p => (
            <Card key={p.titulo} style={s.pilarCard}>
              <View style={s.pilarIcon} />
              <Text style={s.pilarTitulo}>{p.titulo}</Text>
              <Text style={s.pilarDetalle}>{p.detalle}</Text>
            </Card>
          ))}
        </View>

        <Text style={s.sectionTitle}>Preguntas frecuentes</Text>
        {FAQS.map((f, i) => (
          <Pressable key={f.q} onPress={() => setAbierta(abierta === i ? null : i)}>
            <Card style={s.faqCard}>
              <View style={s.faqHeader}>
                <Text style={s.faqQ}>{f.q}</Text>
                <Text style={s.faqToggle}>{abierta === i ? '−' : '+'}</Text>
              </View>
              {abierta === i && <Text style={s.faqA}>{f.a}</Text>}
            </Card>
          </Pressable>
        ))}

        <Button title="Acceder al sistema" onPress={() => router.replace('/login')} style={{ marginTop: 6 }} />
      </Screen>
    </View>
  )
}

const s = StyleSheet.create({
  header: { backgroundColor: colors.navy, paddingHorizontal: 20, paddingBottom: 26 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  backText: { color: '#fff', fontSize: 22, marginTop: -2 },
  logoBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  h1: { fontSize: 22, lineHeight: 28, color: '#fff', fontWeight: '700', marginBottom: 8 },
  headerP: { fontSize: 13.5, lineHeight: 21, color: 'rgba(255,255,255,0.85)' },
  pilaresRow: { flexDirection: 'row', gap: 10 },
  pilarCard: { flex: 1, padding: 13, gap: 3 },
  pilarIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.blue50, marginBottom: 5 },
  pilarTitulo: { fontSize: 13, fontWeight: '700', color: colors.ink },
  pilarDetalle: { fontSize: 11, lineHeight: 15, color: colors.slate500 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.navy, marginTop: 8 },
  faqCard: { gap: 0 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  faqQ: { fontSize: 13.5, fontWeight: '700', color: colors.ink, flex: 1 },
  faqToggle: { color: colors.slate400, fontSize: 18 },
  faqA: { fontSize: 13, lineHeight: 20, color: colors.slate500, marginTop: 8 },
})
