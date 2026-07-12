// src/components/DocumentoCard.tsx
import { useState } from 'react'
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatoDocumento, MAX_SIZE_MB } from '../lib/documentFormats'
import { plantillaUrl } from '../lib/http'
import { colors } from '../lib/theme'
import type { GuiaNombresDto, TipoDocumentoInfo } from '../types/api'

export interface DocEstado {
  cargado: boolean
  nombreArchivo?: string
  subiendo: boolean
  error?: string
}

export function GuiaNombresAlerta({ guia }: { guia: GuiaNombresDto }) {
  return (
    <View style={s.alerta}>
      <Text style={s.alertaTitulo}>📂 Nombre de los archivos (importante)</Text>
      <Text style={s.alertaTexto}>{guia.texto}</Text>
      <Pressable
        onPress={() =>
          Linking.openURL(plantillaUrl(guia.key, 'ver')).catch(() =>
            Alert.alert('No se pudo abrir el enlace'),
          )
        }
        hitSlop={6}
      >
        <Text style={s.link}>Ver guía</Text>
      </Pressable>
    </View>
  )
}

// Tarjeta de documento requerido: label, formato/peso, indicaciones
// colapsables, plantilla/guía (abre en el navegador vía Linking) y control de
// archivo. Igual que el frontend de referencia, el componente no sabe ni le
// importa qué hace `onFile`, solo refleja `estado` — pero la subida real
// (expo-document-picker) queda para una fase posterior, así que el control
// se muestra deshabilitado.
export function DocumentoCard({
  doc,
  estado,
  disabled,
  onFile,
}: {
  doc: TipoDocumentoInfo
  estado: DocEstado | undefined
  disabled?: boolean
  onFile?: (file: unknown) => void
}) {
  const [mostrarIndicaciones, setMostrarIndicaciones] = useState(false)
  const formato = formatoDocumento(doc.tipo)
  const cargado = !!estado?.cargado
  void onFile // TODO Fase posterior: expo-document-picker — invocar onFile con el archivo elegido.

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.label}>{doc.label}</Text>
        <View style={[s.badge, cargado ? s.badgeOn : s.badgeOff]}>
          <Text style={[s.badgeText, { color: cargado ? colors.success : colors.slate500 }]}>
            {cargado ? 'Cargado' : 'Pendiente'}
          </Text>
        </View>
      </View>

      <Text style={s.muted}>Formato: {formato.label} · Máx {MAX_SIZE_MB} MB</Text>

      {doc.indicaciones.length > 0 && (
        <View>
          <Pressable onPress={() => setMostrarIndicaciones(v => !v)} hitSlop={6}>
            <Text style={s.link}>{mostrarIndicaciones ? 'Ocultar indicaciones' : 'Ver indicaciones'}</Text>
          </Pressable>
          {mostrarIndicaciones && (
            <View style={s.indicaciones}>
              {doc.indicaciones.map(ind => (
                <Text key={ind} style={s.indicacionItem}>• {ind}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {doc.plantilla && (
        <Pressable
          onPress={() =>
            Linking.openURL(plantillaUrl(doc.plantilla!.key, doc.plantilla!.accion)).catch(() =>
              Alert.alert('No se pudo abrir el enlace'),
            )
          }
          hitSlop={6}
        >
          <Text style={s.link}>
            {doc.plantilla.accion === 'descargar' ? '⬇' : '👁'} {doc.plantilla.label}
          </Text>
        </Pressable>
      )}

      {cargado ? (
        <View style={s.archivoRow}>
          <Text style={s.archivoNombre} numberOfLines={1}>{estado?.nombreArchivo}</Text>
        </View>
      ) : (
        // TODO Fase posterior: expo-document-picker — habilitar selección y subida real de archivo.
        <View style={[s.uploadBtn, s.uploadDisabled]} pointerEvents={disabled ? 'none' : 'auto'}>
          <Text style={s.uploadText}>{estado?.subiendo ? 'Subiendo…' : 'Subir archivo'}</Text>
        </View>
      )}

      {!!estado?.error && <Text style={s.error}>{estado.error}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.lineSoft, padding: 14, gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  label: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 18, color: colors.ink },
  badge: { flexShrink: 0, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeOn: { backgroundColor: colors.successBg },
  badgeOff: { backgroundColor: colors.chipBg },
  badgeText: { fontSize: 12, fontWeight: '600' },
  muted: { fontSize: 12.5, color: colors.slate500 },
  link: { fontSize: 12.5, fontWeight: '600', color: colors.primary },
  indicaciones: { marginTop: 6, gap: 4 },
  indicacionItem: { fontSize: 12, lineHeight: 17, color: colors.slate500 },
  archivoRow: { backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9 },
  archivoNombre: { fontSize: 12.5, fontWeight: '500', color: colors.slate700 },
  uploadBtn: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  uploadDisabled: { opacity: 0.55 },
  uploadText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  error: { fontSize: 12.5, fontWeight: '500', color: colors.danger },
  alerta: { backgroundColor: colors.blue50, borderWidth: 1, borderColor: colors.blue100, borderRadius: 11, padding: 12, gap: 8 },
  alertaTitulo: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  alertaTexto: { fontSize: 12, lineHeight: 17, color: colors.slate700 },
})
