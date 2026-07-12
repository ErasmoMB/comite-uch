import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/shared'

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
  const navigate = useNavigate()
  const [abierta, setAbierta] = useState<number | null>(null)

  return (
    <>
    <div className="mobile-only-block screen-body">
      <div style={{ background: 'linear-gradient(150deg, #08204A, #0b57b7)', padding: '24px 20px 26px', color: '#fff' }}>
        <button
          onClick={() => navigate(-1)}
          aria-label="Volver"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(255,255,255,.15)',
            border: 'none',
            color: '#fff',
            fontSize: 22,
            cursor: 'pointer',
            marginBottom: 14,
            padding: '0 0 3px',
          }}
        >
          ‹
        </button>
        <img src="/uch.png" alt="UCH" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', marginBottom: 14 }} />
        <h1 style={{ fontSize: 22, lineHeight: 1.25, margin: '0 0 8px' }}>Comité de Ética en Investigación</h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, opacity: 0.85, margin: 0 }}>
          Evaluamos y acompañamos los proyectos de investigación de la comunidad UCH bajo principios éticos.
        </p>
      </div>

      <div style={{ padding: '18px 18px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {PILARES.map(p => (
            <div key={p.titulo} className="card" style={{ flex: 1, padding: '13px 12px' }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--blue-50)', marginBottom: 8 }} />
              <strong style={{ fontSize: 13, display: 'block', marginBottom: 3 }}>{p.titulo}</strong>
              <span style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--slate-500)' }}>{p.detalle}</span>
            </div>
          ))}
        </div>

        <h2 className="section-title" style={{ margin: '8px 0 0' }}>
          Preguntas frecuentes
        </h2>
        {FAQS.map((f, i) => (
          <div key={f.q} className="card" style={{ padding: '13px 14px', cursor: 'pointer' }} onClick={() => setAbierta(abierta === i ? null : i)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <strong style={{ fontSize: 13.5 }}>{f.q}</strong>
              <span style={{ color: 'var(--slate-400)', fontSize: 18, flex: 'none' }}>{abierta === i ? '−' : '+'}</span>
            </div>
            {abierta === i && (
              <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--slate-500)' }}>{f.a}</p>
            )}
          </div>
        ))}

        <button className="btn btn-primary" style={{ marginTop: 6 }} onClick={() => navigate('/login')}>
          Acceder al sistema
        </button>
      </div>
    </div>

    <div className="desktop-shell" style={{ flexDirection: 'column' }}>
      <header style={{ height: 64, flex: 'none', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
          <Logo size={30} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Comité de Ética · UCH</span>
        </div>
        <button className="d-btn-primary" onClick={() => navigate('/login')}>
          Acceder al sistema
        </button>
      </header>
      <div style={{ flex: 1, overflowY: 'auto', padding: '48px 64px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Comité de Ética en Investigación</div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-500)' }}>
            Evaluamos y acompañamos los proyectos de investigación de la comunidad UCH bajo principios de integridad,
            respeto y responsabilidad.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {PILARES.map(p => (
            <div key={p.titulo} className="card" style={{ flex: 1, padding: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--blue-50)', marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>{p.titulo}</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--slate-500)' }}>{p.detalle}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginTop: 6 }}>Preguntas frecuentes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((f, i) => (
            <div key={f.q} className="card" style={{ padding: '14px 18px', cursor: 'pointer' }} onClick={() => setAbierta(abierta === i ? null : i)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{f.q}</span>
                <span style={{ color: 'var(--slate-400)', fontSize: 18 }}>{abierta === i ? '−' : '+'}</span>
              </div>
              {abierta === i && <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--slate-500)' }}>{f.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  )
}
