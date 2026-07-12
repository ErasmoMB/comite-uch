import type { EstadoProyecto } from '../data/types'

export const colors = {
  navy: '#08204a',
  primary: '#0b57b7',
  accent: '#4c93eb',
  blue50: '#eaf5ff',
  blue100: '#cfe4fb',
  bg: '#f7f9fc',
  white: '#ffffff',
  ink: '#172033',
  slate700: '#344054',
  slate500: '#667085',
  slate400: '#98a2b3',
  line: '#d9e1ec',
  lineSoft: '#eef2f7',
  success: '#067647',
  successBg: '#ecfdf3',
  warn: '#b54708',
  warnBg: '#fef7ec',
  danger: '#d92d20',
  dangerBg: '#fef3f2',
  chipBg: '#f2f4f7',
} as const

// Colores de las badges de estado (equivalente a .badge-<estado> del CSS web).
export const badgeColors: Record<EstadoProyecto, { bg: string; fg: string }> = {
  borrador: { bg: colors.chipBg, fg: colors.slate500 },
  enviado: { bg: colors.blue50, fg: colors.primary },
  en_revision: { bg: colors.blue50, fg: colors.primary },
  subsanacion: { bg: colors.warnBg, fg: colors.warn },
  aprobado: { bg: colors.successBg, fg: colors.success },
  aprobado_observaciones: { bg: colors.successBg, fg: colors.success },
  no_aprobado: { bg: colors.dangerBg, fg: colors.danger },
  archivado: { bg: colors.chipBg, fg: colors.slate500 },
}
