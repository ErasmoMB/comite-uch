import { Navigate, Route, Routes } from 'react-router-dom'
import NotificationsSheet from './components/NotificationsSheet'
import RutaProtegida from './components/RutaProtegida'
import Acerca from './pages/Acerca'
import CambiarTitulo from './pages/CambiarTitulo'
import Consultas from './pages/Consultas'
import Dashboard from './pages/Dashboard'
import DetalleProyecto from './pages/DetalleProyecto'
import Login from './pages/Login'
import NuevoProyecto from './pages/NuevoProyecto'
import NuevoProyectoExito from './pages/NuevoProyectoExito'
import Perfil from './pages/Perfil'
import Proyectos from './pages/Proyectos'
import Recuperar from './pages/Recuperar'
import Registro from './pages/Registro'
import RegistroExito from './pages/RegistroExito'
import Reportes from './pages/Reportes'
import Subsanacion from './pages/Subsanacion'

import AdminConfiguracion from './pages/admin/Configuracion'
import AdminUsuarios from './pages/admin/Usuarios'
import CoordinadorAsignacion from './pages/coordinador/Asignacion'
import CoordinadorDashboard from './pages/coordinador/Dashboard'
import EvaluadorBandeja from './pages/evaluador/Bandeja'
import EvaluadorEvaluacion from './pages/evaluador/Evaluacion'
import SecretariaBandeja from './pages/secretaria/Bandeja'
import SecretariaChat from './pages/secretaria/Chat'
import SecretariaRevision from './pages/secretaria/Revision'

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/registro/exito" element={<RegistroExito />} />
        <Route path="/recuperar" element={<Recuperar />} />
        <Route path="/acerca" element={<Acerca />} />

        {/* Investigador / solicitante */}
        <Route path="/" element={<RutaProtegida roles={['estudiante_pregrado', 'estudiante_postgrado', 'investigador', 'estudiante']}><Dashboard /></RutaProtegida>} />
        <Route path="/proyectos" element={<RutaProtegida roles={['estudiante_pregrado', 'estudiante_postgrado', 'investigador', 'estudiante']}><Proyectos /></RutaProtegida>} />
        <Route path="/proyectos/:id" element={<RutaProtegida roles={['estudiante_pregrado', 'estudiante_postgrado', 'investigador', 'estudiante']}><DetalleProyecto /></RutaProtegida>} />
        <Route path="/proyectos/:id/subsanar" element={<RutaProtegida roles={['estudiante_pregrado', 'estudiante_postgrado', 'investigador', 'estudiante']}><Subsanacion /></RutaProtegida>} />
        <Route path="/proyectos/:id/titulo" element={<RutaProtegida roles={['estudiante_pregrado', 'estudiante_postgrado', 'investigador', 'estudiante']}><CambiarTitulo /></RutaProtegida>} />
        <Route path="/cambiar-titulo" element={<RutaProtegida roles={['estudiante_pregrado', 'estudiante_postgrado', 'investigador', 'estudiante']}><CambiarTitulo /></RutaProtegida>} />
        <Route path="/nuevo" element={<RutaProtegida roles={['estudiante_pregrado', 'estudiante_postgrado', 'investigador', 'estudiante']}><NuevoProyecto /></RutaProtegida>} />
        <Route path="/nuevo/exito" element={<RutaProtegida roles={['estudiante_pregrado', 'estudiante_postgrado', 'investigador', 'estudiante']}><NuevoProyectoExito /></RutaProtegida>} />
        <Route path="/consultas" element={<RutaProtegida roles={['estudiante_pregrado', 'estudiante_postgrado', 'investigador', 'estudiante']}><Consultas /></RutaProtegida>} />

        {/* Secretaría */}
        <Route path="/secretaria/bandeja" element={<RutaProtegida roles={['secretaria']}><SecretariaBandeja /></RutaProtegida>} />
        <Route path="/secretaria/revision/:id" element={<RutaProtegida roles={['secretaria']}><SecretariaRevision /></RutaProtegida>} />
        <Route path="/secretaria/chat" element={<RutaProtegida roles={['secretaria']}><SecretariaChat /></RutaProtegida>} />
        <Route path="/secretaria/perfil" element={<RutaProtegida roles={['secretaria']}><Perfil /></RutaProtegida>} />

        {/* Coordinador */}
        <Route path="/coordinador/dashboard" element={<RutaProtegida roles={['coordinador']}><CoordinadorDashboard /></RutaProtegida>} />
        <Route path="/coordinador/asignacion/:id" element={<RutaProtegida roles={['coordinador']}><CoordinadorAsignacion /></RutaProtegida>} />
        <Route path="/coordinador/perfil" element={<RutaProtegida roles={['coordinador']}><Perfil /></RutaProtegida>} />

        {/* Evaluador */}
        <Route path="/evaluador/bandeja" element={<RutaProtegida roles={['evaluador']}><EvaluadorBandeja /></RutaProtegida>} />
        <Route path="/evaluador/evaluacion/:id" element={<RutaProtegida roles={['evaluador']}><EvaluadorEvaluacion /></RutaProtegida>} />
        <Route path="/evaluador/perfil" element={<RutaProtegida roles={['evaluador']}><Perfil /></RutaProtegida>} />

        {/* Administrador */}
        <Route path="/admin/usuarios" element={<RutaProtegida roles={['administrador']}><AdminUsuarios /></RutaProtegida>} />
        <Route path="/admin/configuracion" element={<RutaProtegida roles={['administrador']}><AdminConfiguracion /></RutaProtegida>} />
        <Route path="/admin/reportes" element={<RutaProtegida roles={['administrador']}><Reportes scopeLabel="Administrador" /></RutaProtegida>} />
        <Route path="/admin/perfil" element={<RutaProtegida roles={['administrador']}><Perfil /></RutaProtegida>} />

        {/* Perfil del investigador (después de las rutas de otros roles para no chocar con /perfil de cada sub-shell) */}
        <Route path="/perfil" element={<RutaProtegida roles={['estudiante_pregrado', 'estudiante_postgrado', 'investigador', 'estudiante']}><Perfil /></RutaProtegida>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <div className="mobile-only">
        <NotificationsSheet />
      </div>
    </div>
  )
}
