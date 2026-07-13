// src/lib/evaluadorCarga.ts
import type { EvaluacionDto, UserDto } from '../types/api'

// Carga pendiente REAL de cada evaluador: cuántas evaluaciones tiene asignadas
// ahora mismo SIN completar. Reemplaza al campo estático `cargaTrabajo` del
// usuario (lo pone el admin a mano al crear la cuenta y nunca se actualiza
// solo). Mismo criterio que la web (coordinador/Asignacion.tsx).
export function pendientesPorEvaluador(evaluaciones: EvaluacionDto[]): Record<number, number> {
  const pendientes: Record<number, number> = {}
  for (const e of evaluaciones) {
    if (!e.completa) pendientes[e.evaluadorId] = (pendientes[e.evaluadorId] ?? 0) + 1
  }
  return pendientes
}

// El menos cargado primero, para que sea el sugerido natural al asignar.
// La carga ausente cuenta como 0.
export function ordenarPorCarga(evaluadores: UserDto[], pendientes: Record<number, number>): UserDto[] {
  return [...evaluadores].sort((a, b) => (pendientes[a.id] ?? 0) - (pendientes[b.id] ?? 0))
}
