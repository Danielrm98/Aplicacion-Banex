import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/AuthContext'
import { puedeEscribir, usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { esErrorDeRed } from '../lib/colaRegistros'
import { agregarPerfilRacimoACola } from '../lib/colaPerfilRacimo'
import { DEFECTOS_POR_GRUPO_PERFIL_RACIMO, GRUPOS_PERFIL_RACIMO, NUMEROS_MUESTRA } from '../lib/catalogoPerfilRacimo'
import {
  eliminarPerfilRacimo,
  guardarPerfilRacimo,
  usePerfilesRacimo,
  type PerfilRacimoDefectoPayload,
  type PerfilRacimoMuestraPayload,
  type PerfilRacimoPayload,
} from '../lib/usePerfilesRacimo'
import SectionHeading from '../components/SectionHeading'
import type { PerfilRacimoEvaluacion } from '../types/perfilRacimo'

export default function PerfilRacimoPage() {
  const { perfil, fincas: fincasAsignadas } = usePerfil()
  const esOperador = perfil?.rol === 'operador'
  const esAdminLectura = perfil?.rol === 'admin_lectura'
  const { fincas: todasLasFincas } = useFincas()
  // El admin_lectura solo ve las fincas que se le asignaron (igual que un
  // operador), aunque internamente no sea uno.
  const fincasDisponibles =
    esOperador || esAdminLectura ? todasLasFincas.filter((f) => fincasAsignadas.includes(f.nombre)) : todasLasFincas
  const fincasOrdenadas = useMemo(
    () => [...fincasDisponibles].sort((a, b) => posicionFinca(a.nombre) - posicionFinca(b.nombre)),
    [fincasDisponibles],
  )
  const fincaUnicaOperador = esOperador && fincasAsignadas.length === 1 ? fincasAsignadas[0] : null

  const [fincaSeleccionada, setFincaSeleccionada] = useState('')

  useEffect(() => {
    if (fincaUnicaOperador) {
      if (fincaSeleccionada !== fincaUnicaOperador) setFincaSeleccionada(fincaUnicaOperador)
      return
    }
    if (fincasDisponibles.length === 0) return
    if (fincaSeleccionada && fincasDisponibles.some((f) => f.nombre === fincaSeleccionada)) return
    const guardada = obtenerFincaActual()
    if (guardada && fincasDisponibles.some((f) => f.nombre === guardada)) setFincaSeleccionada(guardada)
  }, [fincaUnicaOperador, fincasDisponibles, fincaSeleccionada])

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    guardarFincaActual(nombre)
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Perfil de racimos</h1>
      <p className="mb-6 text-sm text-gray-500">
        Muestreo de 10 racimos: peso, grados y defectos de cada uno, agrupados igual que el formato en papel.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Finca</span>
          <select
            value={fincaSeleccionada}
            disabled={!!fincaUnicaOperador}
            onChange={(e) => elegirFinca(e.target.value)}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {!fincaUnicaOperador && <option value="">Selecciona una finca</option>}
            {fincasOrdenadas.map((f) => (
              <option key={f.nombre} value={f.nombre}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!fincaSeleccionada ? (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      ) : (
        <FormularioPerfilRacimo key={fincaSeleccionada} finca={fincaSeleccionada} />
      )}
    </div>
  )
}

// ============================================================
// Datos por racimo: lo que escribe el operario (texto, para poder dejarlo
// en blanco sin pelear con inputs numéricos) y lo que se calcula solo.
// ============================================================
interface MuestraCampos {
  hora: string
  lote: string
  noRacimo: string
  edadCinta: string
  gradoSudbasal: string
  gradoApical: string
  noManos: string
  largoApical: string
  pesoFrutaPremium: string
  pesoFrutaCorta: string
  pesoMerma: string
  vastagoCorona: string
}

type CampoMuestra = keyof MuestraCampos
type CampoNumerico = Exclude<CampoMuestra, 'hora' | 'lote' | 'noRacimo' | 'edadCinta'>

function muestraVacia(): MuestraCampos {
  return {
    hora: '',
    lote: '',
    noRacimo: '',
    edadCinta: '',
    gradoSudbasal: '',
    gradoApical: '',
    noManos: '',
    largoApical: '',
    pesoFrutaPremium: '',
    pesoFrutaCorta: '',
    pesoMerma: '',
    vastagoCorona: '',
  }
}

function todasVacias(): Record<number, MuestraCampos> {
  const m: Record<number, MuestraCampos> = {}
  for (const n of NUMEROS_MUESTRA) m[n] = muestraVacia()
  return m
}

interface Computado {
  A: number | null
  B: number | null
  C: number | null
  D: number | null
  E: number | null
  F: number | null
  G: number | null
  ratioPremio: number | null
  ratioTotal: number | null
  ratioPotencial: number | null
}

function numeroDe(texto: string): number | null {
  const limpio = texto.trim()
  if (limpio === '') return null
  const n = Number(limpio)
  return Number.isNaN(n) ? null : n
}

function promedioDe(valores: (number | null)[]): number | null {
  const validos = valores.filter((v): v is number => v !== null)
  return validos.length > 0 ? validos.reduce((a, b) => a + b, 0) / validos.length : null
}

function formatoNum(v: number | null, decimales = 2): string {
  return v === null ? '—' : v.toLocaleString('es', { maximumFractionDigits: decimales })
}

/** E=A+B+C · F=E+D · G(%merma)=C/E*100 · ratio premio=A/E · ratio total=(A+B)/E · ratio potencial=E/F. */
function computar(m: MuestraCampos): Computado {
  const A = numeroDe(m.pesoFrutaPremium)
  const B = numeroDe(m.pesoFrutaCorta)
  const C = numeroDe(m.pesoMerma)
  const D = numeroDe(m.vastagoCorona)
  const E = A === null && B === null && C === null ? null : (A ?? 0) + (B ?? 0) + (C ?? 0)
  const F = E === null ? null : E + (D ?? 0)
  const G = E !== null && E > 0 && C !== null ? (C / E) * 100 : null
  const ratioPremio = E !== null && E > 0 && A !== null ? A / E : null
  const ratioTotal = E !== null && E > 0 && A !== null && B !== null ? (A + B) / E : null
  const ratioPotencial = F !== null && F > 0 && E !== null ? E / F : null
  return { A, B, C, D, E, F, G, ratioPremio, ratioTotal, ratioPotencial }
}

function claveDefecto(numero: number, grupo: string, defecto: string): string {
  return `${numero}::${grupo}::${defecto}`
}

function horaCorta(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
}

function FormularioPerfilRacimo({ finca }: { finca: string }) {
  const { session } = useAuth()
  const { perfil } = usePerfil()
  const escritura = puedeEscribir(perfil)
  const { evaluaciones, refetch } = usePerfilesRacimo(finca)

  const [fecha, setFecha] = useState(fechaLocalHoy())
  const [evaluacionIdActual, setEvaluacionIdActual] = useState<string | null>(null)
  const [muestras, setMuestras] = useState<Record<number, MuestraCampos>>(todasVacias)
  const [defectos, setDefectos] = useState<Record<string, number>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const semana = getIsoWeek(fecha)
  const evaluacionesHoy = evaluaciones.filter((e) => e.fecha === fechaLocalHoy()).length

  function nuevaEvaluacion(fechaStr: string = fecha) {
    setFecha(fechaStr)
    setEvaluacionIdActual(null)
    setMuestras(todasVacias())
    setDefectos({})
    setError(null)
    setMensajeExito(null)
  }

  function abrirEvaluacion(ev: PerfilRacimoEvaluacion) {
    setFecha(ev.fecha)
    setEvaluacionIdActual(ev.id)
    const nuevasMuestras = todasVacias()
    for (const m of ev.muestras) {
      nuevasMuestras[m.numero_muestra] = {
        hora: m.hora ?? '',
        lote: m.lote ?? '',
        noRacimo: m.no_racimo ?? '',
        edadCinta: m.edad_cinta ?? '',
        gradoSudbasal: m.grado_sudbasal !== null ? String(m.grado_sudbasal) : '',
        gradoApical: m.grado_apical !== null ? String(m.grado_apical) : '',
        noManos: m.no_manos !== null ? String(m.no_manos) : '',
        largoApical: m.largo_apical !== null ? String(m.largo_apical) : '',
        pesoFrutaPremium: m.peso_fruta_premium !== null ? String(m.peso_fruta_premium) : '',
        pesoFrutaCorta: m.peso_fruta_corta !== null ? String(m.peso_fruta_corta) : '',
        pesoMerma: m.peso_merma !== null ? String(m.peso_merma) : '',
        vastagoCorona: m.vastago_corona !== null ? String(m.vastago_corona) : '',
      }
    }
    setMuestras(nuevasMuestras)
    const nuevosDefectos: Record<string, number> = {}
    for (const d of ev.defectos) nuevosDefectos[claveDefecto(d.numero_muestra, d.grupo, d.defecto)] = d.cantidad
    setDefectos(nuevosDefectos)
    setError(null)
    setMensajeExito(null)
  }

  function actualizarCampo(numero: number, campo: CampoMuestra, valor: string) {
    setMuestras((prev) => ({ ...prev, [numero]: { ...prev[numero], [campo]: valor } }))
    setMensajeExito(null)
  }

  function defectoDe(numero: number, grupo: string, defecto: string) {
    return defectos[claveDefecto(numero, grupo, defecto)] ?? 0
  }

  function setDefecto(numero: number, grupo: string, defecto: string, valor: number) {
    setDefectos((prev) => ({ ...prev, [claveDefecto(numero, grupo, defecto)]: valor }))
    setMensajeExito(null)
  }

  function sumaDefecto(grupo: string, defecto: string) {
    return NUMEROS_MUESTRA.reduce((sum, n) => sum + defectoDe(n, grupo, defecto), 0)
  }

  const computados = useMemo(() => {
    const m: Record<number, Computado> = {}
    for (const n of NUMEROS_MUESTRA) m[n] = computar(muestras[n])
    return m
  }, [muestras])

  function promedioCampo(campo: CampoNumerico): number | null {
    return promedioDe(NUMEROS_MUESTRA.map((n) => numeroDe(muestras[n][campo])))
  }

  function promedioComputado(campo: keyof Computado): number | null {
    return promedioDe(NUMEROS_MUESTRA.map((n) => computados[n][campo]))
  }

  async function guardar() {
    setError(null)
    const user = session?.user
    if (!user) {
      setError('No hay sesión activa.')
      return
    }

    const muestrasPayload: PerfilRacimoMuestraPayload[] = NUMEROS_MUESTRA.map((n) => {
      const m = muestras[n]
      return {
        numeroMuestra: n,
        hora: m.hora.trim() || null,
        lote: m.lote.trim() || null,
        noRacimo: m.noRacimo.trim() || null,
        edadCinta: m.edadCinta.trim() || null,
        gradoSudbasal: numeroDe(m.gradoSudbasal),
        gradoApical: numeroDe(m.gradoApical),
        noManos: numeroDe(m.noManos),
        largoApical: numeroDe(m.largoApical),
        pesoFrutaPremium: numeroDe(m.pesoFrutaPremium),
        pesoFrutaCorta: numeroDe(m.pesoFrutaCorta),
        pesoMerma: numeroDe(m.pesoMerma),
        vastagoCorona: numeroDe(m.vastagoCorona),
      }
    })

    const defectosPayload: PerfilRacimoDefectoPayload[] = []
    for (const n of NUMEROS_MUESTRA) {
      for (const grupo of GRUPOS_PERFIL_RACIMO) {
        for (const defecto of DEFECTOS_POR_GRUPO_PERFIL_RACIMO[grupo]) {
          defectosPayload.push({ numeroMuestra: n, grupo, defecto, cantidad: defectoDe(n, grupo, defecto) })
        }
      }
    }

    const payload: PerfilRacimoPayload = {
      id: evaluacionIdActual ?? crypto.randomUUID(),
      userId: user.id,
      finca,
      fecha,
      semana,
      muestras: muestrasPayload,
      defectos: defectosPayload,
    }

    setGuardando(true)

    if (!navigator.onLine) {
      await agregarPerfilRacimoACola(payload)
      setGuardando(false)
      nuevaEvaluacion(fecha)
      setMensajeExito('Guardado sin conexión — se enviará solo cuando vuelva la señal.')
      return
    }

    try {
      await guardarPerfilRacimo(payload)
      nuevaEvaluacion(fecha)
      setMensajeExito('Perfil de racimo guardado. El formulario quedó listo para uno nuevo.')
      refetch()
    } catch (err) {
      if (esErrorDeRed(err)) {
        await agregarPerfilRacimoACola(payload)
        nuevaEvaluacion(fecha)
        setMensajeExito('Guardado sin conexión — se enviará solo cuando vuelva la señal.')
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      }
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este perfil de racimo? No se puede deshacer.')) return
    try {
      await eliminarPerfilRacimo(id)
      if (id === evaluacionIdActual) nuevaEvaluacion()
      refetch()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Fecha">
            <input
              type="date"
              value={fecha}
              max={fechaLocalHoy()}
              disabled={!escritura}
              onChange={(e) => nuevaEvaluacion(e.target.value)}
              className={`${inputClass} disabled:bg-gray-100`}
            />
          </Field>
          <Field label="Semana">
            <input type="text" disabled value={semana} className={`${inputClass} bg-gray-50`} />
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Llevas {evaluacionesHoy} perfil{evaluacionesHoy === 1 ? '' : 'es'} guardado{evaluacionesHoy === 1 ? '' : 's'} hoy para esta
            finca — se puede guardar más de uno el mismo día.
          </p>
          {escritura && (evaluacionIdActual || Object.keys(defectos).length > 0) && (
            <button type="button" onClick={() => nuevaEvaluacion()} className="text-xs font-medium text-banex-700 hover:underline">
              + Nuevo perfil
            </button>
          )}
        </div>
        {evaluacionIdActual && <p className="mt-1 text-xs text-banex-700">Editando un perfil ya guardado de esta finca y fecha.</p>}
      </div>

      <TablaPerfil
        muestras={muestras}
        computados={computados}
        defectos={defectos}
        escritura={escritura}
        actualizarCampo={actualizarCampo}
        promedioCampo={promedioCampo}
        promedioComputado={promedioComputado}
        defectoDe={defectoDe}
        setDefecto={setDefecto}
        sumaDefecto={sumaDefecto}
      />

      {escritura && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-banex-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : evaluacionIdActual ? 'Actualizar perfil' : 'Guardar perfil'}
          </button>
          {mensajeExito && <span className="text-sm text-green-700">{mensajeExito}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      )}

      {evaluaciones.length > 0 && (
        <div>
          <SectionHeading>Perfiles guardados</SectionHeading>
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="py-2 px-3 font-medium">Fecha</th>
                  <th className="py-2 px-3 font-medium">Hora</th>
                  <th className="py-2 px-3 font-medium">Semana</th>
                  <th className="py-2 px-3 font-medium">Racimos con datos</th>
                  <th className="py-2 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {evaluaciones.map((ev) => (
                  <tr key={ev.id} className={`border-b border-gray-100 ${ev.id === evaluacionIdActual ? 'bg-banex-50/60' : ''}`}>
                    <td className="py-1.5 px-3">{ev.fecha}</td>
                    <td className="py-1.5 px-3">{horaCorta(ev.created_at)}</td>
                    <td className="py-1.5 px-3">{ev.semana}</td>
                    <td className="py-1.5 px-3">{ev.muestras.length}</td>
                    <td className="py-1.5 px-3 text-right whitespace-nowrap">
                      <button onClick={() => abrirEvaluacion(ev)} className="text-xs font-medium text-banex-700 hover:underline">
                        Abrir
                      </button>
                      {escritura && (
                        <button onClick={() => eliminar(ev.id)} className="ml-3 text-xs font-medium text-red-600 hover:underline">
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:text-gray-500'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

// ============================================================
// Cuadrícula: una fila por campo/defecto, una columna por racimo (1-10) más
// el total/promedio — igual a como está impreso el formulario en papel.
// ============================================================
const celdaInputClass =
  'w-full min-w-0 rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-center text-xs text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-banex-500/20 disabled:bg-gray-100'

function Fila({
  etiqueta,
  negrita,
  celdas,
  total,
}: {
  etiqueta: string
  negrita?: boolean
  celdas: ReactNode[]
  total: ReactNode
}) {
  return (
    <tr className="border-b border-gray-100">
      <td
        className={`sticky left-0 z-[1] w-[170px] border-r border-gray-200 bg-white py-1 pr-2 pl-3 text-xs ${
          negrita ? 'font-semibold text-gray-900' : 'text-gray-600'
        }`}
      >
        {etiqueta}
      </td>
      {celdas.map((c, i) => (
        <td key={i} className="w-[64px] border-r border-gray-100 px-1 py-1 text-center">
          {c}
        </td>
      ))}
      <td className="w-[90px] bg-banex-50/50 px-1 py-1 text-center text-xs font-semibold text-banex-800">{total}</td>
    </tr>
  )
}

function FilaGrupo({ titulo }: { titulo: string }) {
  return (
    <tr>
      <td colSpan={NUMEROS_MUESTRA.length + 2} className="sticky left-0 border-y border-gray-200 bg-gray-100 py-1.5 pl-3 text-xs font-semibold text-gray-600">
        DEFECTOS DE {titulo}
      </td>
    </tr>
  )
}

function TablaPerfil({
  muestras,
  computados,
  defectos: _defectos,
  escritura,
  actualizarCampo,
  promedioCampo,
  promedioComputado,
  defectoDe,
  setDefecto,
  sumaDefecto,
}: {
  muestras: Record<number, MuestraCampos>
  computados: Record<number, Computado>
  defectos: Record<string, number>
  escritura: boolean
  actualizarCampo: (numero: number, campo: CampoMuestra, valor: string) => void
  promedioCampo: (campo: CampoNumerico) => number | null
  promedioComputado: (campo: keyof Computado) => number | null
  defectoDe: (numero: number, grupo: string, defecto: string) => number
  setDefecto: (numero: number, grupo: string, defecto: string, valor: number) => void
  sumaDefecto: (grupo: string, defecto: string) => number
}) {
  function filaTexto(etiqueta: string, campo: 'hora' | 'lote' | 'noRacimo' | 'edadCinta') {
    return (
      <Fila
        etiqueta={etiqueta}
        celdas={NUMEROS_MUESTRA.map((n) => (
          <input
            key={n}
            type="text"
            disabled={!escritura}
            value={muestras[n][campo]}
            onChange={(e) => actualizarCampo(n, campo, e.target.value)}
            className={celdaInputClass}
          />
        ))}
        total="—"
      />
    )
  }

  function filaNumero(etiqueta: string, campo: CampoNumerico, decimales = 2) {
    return (
      <Fila
        etiqueta={etiqueta}
        celdas={NUMEROS_MUESTRA.map((n) => (
          <input
            key={n}
            type="number"
            step="0.01"
            disabled={!escritura}
            value={muestras[n][campo]}
            onChange={(e) => actualizarCampo(n, campo, e.target.value)}
            className={celdaInputClass}
          />
        ))}
        total={formatoNum(promedioCampo(campo), decimales)}
      />
    )
  }

  function filaCalculada(etiqueta: string, campo: keyof Computado, decimales = 2) {
    return (
      <Fila
        etiqueta={etiqueta}
        negrita
        celdas={NUMEROS_MUESTRA.map((n) => (
          <span key={n} className="text-xs font-medium text-gray-700">
            {formatoNum(computados[n][campo], decimales)}
          </span>
        ))}
        total={formatoNum(promedioComputado(campo), decimales)}
      />
    )
  }

  function filaDefecto(grupo: string, defecto: string) {
    return (
      <Fila
        key={defecto}
        etiqueta={defecto}
        celdas={NUMEROS_MUESTRA.map((n) => (
          <input
            key={n}
            type="number"
            min={0}
            step="1"
            disabled={!escritura}
            value={defectoDe(n, grupo, defecto) || ''}
            onChange={(e) => setDefecto(n, grupo, defecto, Math.max(0, Number(e.target.value)))}
            className={celdaInputClass}
          />
        ))}
        total={String(sumaDefecto(grupo, defecto))}
      />
    )
  }

  return (
    <div>
      <SectionHeading>Mediciones por racimo</SectionHeading>
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="sticky left-0 z-[2] w-[170px] border-r border-gray-200 bg-gray-50 py-2 pr-2 pl-3 text-xs font-medium">Campo</th>
              {NUMEROS_MUESTRA.map((n) => (
                <th key={n} className="w-[64px] border-r border-gray-100 px-1 py-2 text-center text-xs font-medium">
                  {n}
                </th>
              ))}
              <th className="w-[90px] px-1 py-2 text-center text-xs font-medium">Total / Promedio</th>
            </tr>
          </thead>
          <tbody>
            {filaTexto('HORA', 'hora')}
            {filaTexto('LOTE', 'lote')}
            {filaTexto('No. DE RACIMO', 'noRacimo')}
            {filaTexto('EDAD/CINTA', 'edadCinta')}
            {filaNumero('GRADO SUDBASAL', 'gradoSudbasal')}
            {filaNumero('GRADO APICAL', 'gradoApical')}
            {filaNumero('No. DE MANOS', 'noManos', 0)}
            {filaNumero('LARGO APICAL', 'largoApical')}
            {filaNumero('A. PESO FRUTA PREMIUM', 'pesoFrutaPremium')}
            {filaNumero('B. PESO FRUTA CORTA', 'pesoFrutaCorta')}
            {filaNumero('C. PESO DE MERMA', 'pesoMerma')}
            {filaNumero('D. VASTAGO Y CORONA', 'vastagoCorona')}
            {filaCalculada('E. PESO NETO DE FRUTA (A+B+C)', 'E')}
            {filaCalculada('F. PESO TOTAL DE RACIMO (E+D)', 'F')}
            {filaCalculada('G. % DE MERMA (C/E*100)', 'G', 1)}
            {filaCalculada('H. RATIO PREMIO (A/E)', 'ratioPremio')}
            {filaCalculada('I. RATIO TOTAL (A+B/E)', 'ratioTotal')}
            {filaCalculada('RATIO POTENCIAL (E/F)', 'ratioPotencial')}

            {GRUPOS_PERFIL_RACIMO.map((grupo) => (
              <Fragment key={grupo}>
                <FilaGrupo titulo={grupo} />
                {DEFECTOS_POR_GRUPO_PERFIL_RACIMO[grupo].map((defecto) => filaDefecto(grupo, defecto))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
