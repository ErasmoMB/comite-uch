// Icono de la barra de pestañas, compartido por los 5 grupos de rutas.
//
// Antes cada layout definía su propio TabIcon que pintaba un carácter Unicode
// suelto (▤, ◔, ⌂…) como texto. Esos glifos geométricos no se leen como
// iconos —"◔" se ve como un gráfico de torta— y su forma depende de la fuente
// del sistema, así que cambiaban de un dispositivo a otro. Aquí se usan
// iconos reales de Ionicons (viene con Expo, vía `@expo/vector-icons`), que
// son vectoriales, consistentes y se tiñen con el color activo/inactivo.
import Ionicons from '@expo/vector-icons/Ionicons'

export type TabIconName =
  | 'inicio'
  | 'proyectos'
  | 'nuevo'
  | 'consultas'
  | 'perfil'
  | 'bandeja'
  | 'chat'
  | 'usuarios'
  | 'configuracion'
  | 'reportes'

const GLIFOS: Record<TabIconName, React.ComponentProps<typeof Ionicons>['name']> = {
  inicio: 'home-outline',
  proyectos: 'document-text-outline',
  nuevo: 'add-circle-outline',
  consultas: 'chatbubble-ellipses-outline',
  perfil: 'person-circle-outline',
  bandeja: 'file-tray-full-outline',
  chat: 'chatbubble-ellipses-outline',
  usuarios: 'people-outline',
  configuracion: 'settings-outline',
  reportes: 'bar-chart-outline',
}

export default function TabIcon({
  name,
  color,
  size = 24,
}: {
  name: TabIconName
  color: string
  size?: number
}) {
  return <Ionicons name={GLIFOS[name]} size={size} color={color} />
}
