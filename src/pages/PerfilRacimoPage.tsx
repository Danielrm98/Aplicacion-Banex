import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useDraftState } from '../lib/useDraftState'
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
import { COLORES_CINTA } from '../lib/cintaEmbolse'
import {
  eliminarPerfilRacimo,
  guardarPerfilRacimo,
  usePerfilesRacimo,
  type PerfilRacimoDefectoPayload,
  type PerfilRacimoMuestraPayload,
  type PerfilRacimoPayload,
} from '../lib/usePerfilesRacimo'
import { useResumenPerfilRacimo } from '../lib/useResumenPerfilRacimo'
import { computarRacimo, formatoNum, promedioDe, type ComputoRacimo } from '../lib/calculoPerfilRacimo'
import SectionHeading from '../components/SectionHeading'
import TabButton from '../components/TabButton'
import RatiosPorSemanaChart from '../components/charts/RatiosPorSemanaChart'
import SingleLineChart from '../components/charts/SingleLineChart'
import { chartColors } from '../components/charts/chartTheme'
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
  const [vista, setVista] = useState<'formulario' | 'resumen-lote'>('formulario')

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
        <>
          <div className="mb-4 flex gap-1 border-b border-gray-200">
            <TabButton active={vista === 'formulario'} onClick={() => setVista('formulario')}>
              Formulario
            </TabButton>
            <TabButton active={vista === 'resumen-lote'} onClick={() => setVista('resumen-lote')}>
              Resumen por lote
            </TabButton>
          </div>
          {vista === 'formulario' ? (
            <FormularioPerfilRacimo key={fincaSeleccionada} finca={fincaSeleccionada} />
          ) : (
            <ResumenPorLote key={fincaSeleccionada} finca={fincaSeleccionada} />
          )}
        </>
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
  cinta: string
  edadCinta: string
  gradoSudbasal: string
  gradoApical: string
  noManos: string
  largoApical: string
  pesoFrutaPremium: string
  pesoFrutaCorta: string
  vastagoCorona: string
}

type CampoMuestra = keyof MuestraCampos
type CampoNumerico = Exclude<CampoMuestra, 'hora' | 'lote' | 'noRacimo' | 'cinta' | 'edadCinta'>

function muestraVacia(): MuestraCampos {
  return {
    hora: '',
    lote: '',
    noRacimo: '',
    cinta: '',
    edadCinta: '',
    gradoSudbasal: '',
    gradoApical: '',
    noManos: '',
    largoApical: '',
    pesoFrutaPremium: '',
    pesoFrutaCorta: '',
    vastagoCorona: '',
  }
}

function todasVacias(): Record<number, MuestraCampos> {
  const m: Record<number, MuestraCampos> = {}
  for (const n of NUMEROS_MUESTRA) m[n] = muestraVacia()
  return m
}

function numeroDe(texto: string): number | null {
  const limpio = texto.trim()
  if (limpio === '') return null
  const n = Number(limpio)
  return Number.isNaN(n) ? null : n
}

// La cuadrícula en vivo también muestra C (peso de merma) como fila
// calculada, así que acá se guarda junto al resto de lo calculado — el
// resumen de evaluaciones guardadas y el resumen por lote no lo necesitan
// aparte, por eso ComputoRacimo (compartido) no lo incluye.
type ComputoFila = ComputoRacimo & { C: number }

/** Envuelve computarRacimo leyendo A, B y D del texto escrito por el
 * operario; C (peso de merma) ya no se escribe a mano, llega calculado
 * (suma de los pesos de cada defecto registrado para ese racimo). */
function computar(m: MuestraCampos, pesoMerma: number): ComputoFila {
  return { ...computarRacimo({
    A: numeroDe(m.pesoFrutaPremium),
    B: numeroDe(m.pesoFrutaCorta),
    C: pesoMerma,
    D: numeroDe(m.vastagoCorona),
  }), C: pesoMerma }
}

function claveDefecto(numero: number, grupo: string, defecto: string): string {
  return `${numero}::${grupo}::${defecto}`
}

function horaCorta(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
}

/** Promedio de los 10 racimos de una evaluación ya guardada: peso neto, %
 * merma y los tres ratios. */
function resumenEvaluacion(ev: PerfilRacimoEvaluacion) {
  const computos = ev.muestras.map((m) =>
    computarRacimo({
      A: m.peso_fruta_premium,
      B: m.peso_fruta_corta,
      C: m.peso_merma ?? 0,
      D: m.vastago_corona,
    }),
  )
  return {
    pesoNeto: promedioDe(computos.map((c) => c.E)),
    merma: promedioDe(computos.map((c) => c.G)),
    ratioPremio: promedioDe(computos.map((c) => c.ratioPremio)),
    ratioTotal: promedioDe(computos.map((c) => c.ratioTotal)),
    ratioPotencial: promedioDe(computos.map((c) => c.ratioPotencial)),
  }
}

function FormularioPerfilRacimo({ finca }: { finca: string }) {
  const { session } = useAuth()
  const { perfil } = usePerfil()
  const escritura = puedeEscribir(perfil)
  const { evaluaciones, refetch } = usePerfilesRacimo(finca)

  // Borrador autoguardado por finca: si el operario llena el primer racimo
  // y se pasa a otro menú (o el navegador recarga la página), la
  // información sigue ahí al volver — no hay que guardar de inmediato.
  const [fecha, setFecha] = useDraftState(`approban_borrador_perfil_racimo_fecha_${finca}`, fechaLocalHoy)
  const [evaluacionIdActual, setEvaluacionIdActual] = useDraftState<string | null>(
    `approban_borrador_perfil_racimo_id_${finca}`,
    null,
  )
  const [muestras, setMuestras] = useDraftState<Record<number, MuestraCampos>>(
    `approban_borrador_perfil_racimo_muestras_${finca}`,
    todasVacias,
  )
  const [defectos, setDefectos] = useDraftState<Record<string, number>>(`approban_borrador_perfil_racimo_defectos_${finca}`, {})
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
        cinta: m.cinta ?? '',
        edadCinta: m.edad_cinta ?? '',
        gradoSudbasal: m.grado_sudbasal !== null ? String(m.grado_sudbasal) : '',
        gradoApical: m.grado_apical !== null ? String(m.grado_apical) : '',
        noManos: m.no_manos !== null ? String(m.no_manos) : '',
        largoApical: m.largo_apical !== null ? String(m.largo_apical) : '',
        pesoFrutaPremium: m.peso_fruta_premium !== null ? String(m.peso_fruta_premium) : '',
        pesoFrutaCorta: m.peso_fruta_corta !== null ? String(m.peso_fruta_corta) : '',
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

  // El operario registra cada defecto en peso (no en cantidad), así que el
  // peso de merma de un racimo es la suma de todos sus defectos.
  function sumaPesoMermaDefectos(numero: number) {
    let suma = 0
    for (const grupo of GRUPOS_PERFIL_RACIMO) {
      for (const defecto of DEFECTOS_POR_GRUPO_PERFIL_RACIMO[grupo]) {
        suma += defectoDe(numero, grupo, defecto)
      }
    }
    return suma
  }

  const computados = useMemo(() => {
    const m: Record<number, ComputoFila> = {}
    for (const n of NUMEROS_MUESTRA) m[n] = computar(muestras[n], sumaPesoMermaDefectos(n))
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muestras, defectos])

  function promedioCampo(campo: CampoNumerico): number | null {
    return promedioDe(NUMEROS_MUESTRA.map((n) => numeroDe(muestras[n][campo])))
  }

  function promedioComputado(campo: keyof ComputoFila): number | null {
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
        cinta: m.cinta.trim() || null,
        edadCinta: m.edadCinta.trim() || null,
        gradoSudbasal: numeroDe(m.gradoSudbasal),
        gradoApical: numeroDe(m.gradoApical),
        noManos: numeroDe(m.noManos),
        largoApical: numeroDe(m.largoApical),
        pesoFrutaPremium: numeroDe(m.pesoFrutaPremium),
        pesoFrutaCorta: numeroDe(m.pesoFrutaCorta),
        // Ya no se escribe a mano: es la suma de los defectos de ese racimo.
        pesoMerma: sumaPesoMermaDefectos(n),
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
                  <th className="py-2 px-3 font-medium">Racimos</th>
                  <th className="py-2 px-3 text-right font-medium">Peso neto prom.</th>
                  <th className="py-2 px-3 text-right font-medium">% Merma prom.</th>
                  <th className="py-2 px-3 text-right font-medium">Ratio premio</th>
                  <th className="py-2 px-3 text-right font-medium">Ratio total</th>
                  <th className="py-2 px-3 text-right font-medium">Ratio potencial</th>
                  <th className="py-2 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {evaluaciones.map((ev) => {
                  const resumen = resumenEvaluacion(ev)
                  return (
                    <tr key={ev.id} className={`border-b border-gray-100 ${ev.id === evaluacionIdActual ? 'bg-banex-50/60' : ''}`}>
                      <td className="py-1.5 px-3">{ev.fecha}</td>
                      <td className="py-1.5 px-3">{horaCorta(ev.created_at)}</td>
                      <td className="py-1.5 px-3">{ev.semana}</td>
                      <td className="py-1.5 px-3">{ev.muestras.length}</td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(resumen.pesoNeto)}</td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(resumen.merma, 1)}</td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(resumen.ratioPremio)}</td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(resumen.ratioTotal)}</td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(resumen.ratioPotencial)}</td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Resumen por lote: toma TODAS las evaluaciones guardadas de un año (no
// solo las últimas, como el formulario) y las agrupa por el lote que
// escribió el operario en cada racimo — semana a semana.
// ============================================================
interface SemanaLote {
  semana: number
  racimos: number
  pesoNeto: number | null
  merma: number | null
  ratioPremio: number | null
  ratioTotal: number | null
  ratioPotencial: number | null
}

function ResumenPorLote({ finca }: { finca: string }) {
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const { evaluaciones, loading, error } = useResumenPerfilRacimo(finca, anio)

  // Una fila por racimo con lote lleno, con la semana de su evaluación y su
  // cómputo (E, G, ratios) ya resuelto.
  const todasLasMuestras = useMemo(() => {
    const filas: { semana: number; lote: string; computo: ComputoRacimo }[] = []
    for (const ev of evaluaciones) {
      for (const m of ev.muestras) {
        const lote = m.lote?.trim()
        if (!lote) continue
        const computo = computarRacimo({
          A: m.peso_fruta_premium,
          B: m.peso_fruta_corta,
          C: m.peso_merma ?? 0,
          D: m.vastago_corona,
        })
        filas.push({ semana: ev.semana, lote, computo })
      }
    }
    return filas
  }, [evaluaciones])

  // Defectos de cada racimo, con el lote de ese racimo (cruzando por número
  // de muestra dentro de la misma evaluación, ya que el defecto no guarda
  // el lote directamente).
  const todosLosDefectos = useMemo(() => {
    const filas: { lote: string; grupo: string; defecto: string; cantidad: number }[] = []
    for (const ev of evaluaciones) {
      const lotePorMuestra = new Map<number, string>()
      for (const m of ev.muestras) {
        const lote = m.lote?.trim()
        if (lote) lotePorMuestra.set(m.numero_muestra, lote)
      }
      for (const d of ev.defectos) {
        const lote = lotePorMuestra.get(d.numero_muestra)
        if (!lote) continue
        filas.push({ lote, grupo: d.grupo, defecto: d.defecto, cantidad: d.cantidad })
      }
    }
    return filas
  }, [evaluaciones])

  const lotesDisponibles = useMemo(
    () =>
      Array.from(new Set(todasLasMuestras.map((m) => m.lote))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [todasLasMuestras],
  )

  const [loteSeleccionado, setLoteSeleccionado] = useState('')

  useEffect(() => {
    if (loteSeleccionado && lotesDisponibles.includes(loteSeleccionado)) return
    setLoteSeleccionado(lotesDisponibles[0] ?? '')
  }, [lotesDisponibles, loteSeleccionado])

  const semanasDelLote = useMemo<SemanaLote[]>(() => {
    const filtradas = todasLasMuestras.filter((m) => m.lote === loteSeleccionado)
    const porSemana = new Map<number, ComputoRacimo[]>()
    for (const m of filtradas) {
      const arr = porSemana.get(m.semana) ?? []
      arr.push(m.computo)
      porSemana.set(m.semana, arr)
    }
    return Array.from(porSemana.entries())
      .map(([semana, computos]) => ({
        semana,
        racimos: computos.length,
        pesoNeto: promedioDe(computos.map((c) => c.E)),
        merma: promedioDe(computos.map((c) => c.G)),
        ratioPremio: promedioDe(computos.map((c) => c.ratioPremio)),
        ratioTotal: promedioDe(computos.map((c) => c.ratioTotal)),
        ratioPotencial: promedioDe(computos.map((c) => c.ratioPotencial)),
      }))
      .sort((a, b) => a.semana - b.semana)
  }, [todasLasMuestras, loteSeleccionado])

  const defectosDelLote = useMemo(() => {
    const filtrados = todosLosDefectos.filter((d) => d.lote === loteSeleccionado)
    const totalPeso = filtrados.reduce((sum, d) => sum + d.cantidad, 0)
    const porDefecto = new Map<string, { grupo: string; peso: number }>()
    for (const d of filtrados) {
      const acc = porDefecto.get(d.defecto) ?? { grupo: d.grupo, peso: 0 }
      acc.peso += d.cantidad
      porDefecto.set(d.defecto, acc)
    }
    return Array.from(porDefecto.entries())
      .map(([defecto, { grupo, peso }]) => ({
        defecto,
        grupo,
        peso,
        porcentaje: totalPeso > 0 ? (peso / totalPeso) * 100 : 0,
      }))
      .sort((a, b) => b.peso - a.peso)
  }, [todosLosDefectos, loteSeleccionado])

  const totalPesoMermaDelLote = defectosDelLote.reduce((sum, d) => sum + d.peso, 0)

  if (loading) return <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
  if (error) return <p className="py-8 text-center text-sm text-red-600">{error}</p>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Año</span>
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Lote</span>
          <select
            value={loteSeleccionado}
            onChange={(e) => setLoteSeleccionado(e.target.value)}
            disabled={lotesDisponibles.length === 0}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:opacity-60"
          >
            {lotesDisponibles.length === 0 && <option value="">Sin lotes registrados</option>}
            {lotesDisponibles.map((l) => (
              <option key={l} value={l}>
                Lote {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      {lotesDisponibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Todavía no hay ningún perfil guardado con el campo LOTE lleno en {anio}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
              <SectionHeading>Peso neto de racimo — semana a semana</SectionHeading>
              <SingleLineChart
                data={semanasDelLote}
                xKey="semana"
                yKey="pesoNeto"
                seriesName="Peso neto (kg)"
                color={chartColors.blue}
                xLabelFormatter={(v) => `S${v}`}
              />
            </div>
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
              <SectionHeading>% de merma — semana a semana</SectionHeading>
              <SingleLineChart
                data={semanasDelLote}
                xKey="semana"
                yKey="merma"
                seriesName="% Merma"
                color={chartColors.orange}
                xLabelFormatter={(v) => `S${v}`}
                valueFormatter={(v) => `${v.toFixed(1)}%`}
              />
            </div>
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
              <SectionHeading>Ratios — semana a semana</SectionHeading>
              <RatiosPorSemanaChart data={semanasDelLote} />
            </div>
          </div>

          <div>
            <SectionHeading>Lote {loteSeleccionado} por semana</SectionHeading>
            <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                    <th className="py-2 px-3 font-medium">Semana</th>
                    <th className="py-2 px-3 text-right font-medium">Racimos</th>
                    <th className="py-2 px-3 text-right font-medium">Peso neto prom.</th>
                    <th className="py-2 px-3 text-right font-medium">% Merma prom.</th>
                    <th className="py-2 px-3 text-right font-medium">Ratio premio</th>
                    <th className="py-2 px-3 text-right font-medium">Ratio total</th>
                    <th className="py-2 px-3 text-right font-medium">Ratio potencial</th>
                  </tr>
                </thead>
                <tbody>
                  {semanasDelLote.map((s) => (
                    <tr key={s.semana} className="border-b border-gray-100">
                      <td className="py-1.5 px-3">{s.semana}</td>
                      <td className="py-1.5 px-3 text-right">{s.racimos}</td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(s.pesoNeto)}</td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(s.merma, 1)}</td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(s.ratioPremio)}</td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(s.ratioTotal)}</td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(s.ratioPotencial)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <SectionHeading>
              Defectos del lote {loteSeleccionado} ({anio})
            </SectionHeading>
            <p className="mb-2 text-xs text-gray-500">
              Qué tanto representa cada defecto dentro del peso total de merma registrado en este lote.
            </p>
            {defectosDelLote.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">Este lote no tiene defectos registrados en {anio}.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 px-3 font-medium">Defecto</th>
                      <th className="py-2 px-3 font-medium">Grupo</th>
                      <th className="py-2 px-3 text-right font-medium">Peso</th>
                      <th className="py-2 px-3 text-right font-medium">% del lote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defectosDelLote.map((d) => (
                      <tr key={`${d.grupo}-${d.defecto}`} className="border-b border-gray-100 last:border-0">
                        <td className="py-1.5 px-3 text-gray-900">{d.defecto}</td>
                        <td className="py-1.5 px-3 text-gray-500">{d.grupo}</td>
                        <td className="py-1.5 px-3 text-right">{formatoNum(d.peso)}</td>
                        <td className="py-1.5 px-3 text-right font-medium text-banex-800">{formatoNum(d.porcentaje, 1)}%</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-banex-100 font-semibold text-banex-800">
                      <td className="py-1.5 px-3" colSpan={2}>
                        Total
                      </td>
                      <td className="py-1.5 px-3 text-right">{formatoNum(totalPesoMermaDelLote)}</td>
                      <td className="py-1.5 px-3 text-right">100,0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
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
  'w-full min-w-0 rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-center text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-banex-500/20 disabled:bg-gray-100'

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
        className={`sticky left-0 z-[1] w-[190px] border-r border-gray-200 bg-white py-1.5 pr-2 pl-3 text-xs ${
          negrita ? 'font-semibold text-gray-900' : 'text-gray-600'
        }`}
      >
        {etiqueta}
      </td>
      {celdas.map((c, i) => (
        <td key={i} className="w-[120px] border-r border-gray-100 px-1.5 py-1.5 text-center">
          {c}
        </td>
      ))}
      <td className="w-[130px] bg-banex-50/50 px-1.5 py-1.5 text-center text-sm font-semibold text-banex-800">{total}</td>
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
  computados: Record<number, ComputoFila>
  defectos: Record<string, number>
  escritura: boolean
  actualizarCampo: (numero: number, campo: CampoMuestra, valor: string) => void
  promedioCampo: (campo: CampoNumerico) => number | null
  promedioComputado: (campo: keyof ComputoFila) => number | null
  defectoDe: (numero: number, grupo: string, defecto: string) => number
  setDefecto: (numero: number, grupo: string, defecto: string, valor: number) => void
  sumaDefecto: (grupo: string, defecto: string) => number
}) {
  function filaHora() {
    return (
      <Fila
        etiqueta="HORA"
        celdas={NUMEROS_MUESTRA.map((n) => (
          <input
            key={n}
            type="time"
            disabled={!escritura}
            value={muestras[n].hora}
            onChange={(e) => actualizarCampo(n, 'hora', e.target.value)}
            className={celdaInputClass}
          />
        ))}
        total="—"
      />
    )
  }

  function filaTexto(etiqueta: string, campo: 'lote' | 'noRacimo' | 'edadCinta') {
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

  function filaCinta() {
    return (
      <Fila
        etiqueta="CINTA"
        celdas={NUMEROS_MUESTRA.map((n) => (
          <select
            key={n}
            disabled={!escritura}
            value={muestras[n].cinta}
            onChange={(e) => actualizarCampo(n, 'cinta', e.target.value)}
            className={celdaInputClass}
          >
            <option value=""></option>
            {COLORES_CINTA.map((color) => (
              <option key={color} value={color}>
                {color.charAt(0) + color.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
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

  function filaCalculada(etiqueta: string, campo: keyof ComputoFila, decimales = 2) {
    return (
      <Fila
        etiqueta={etiqueta}
        negrita
        celdas={NUMEROS_MUESTRA.map((n) => (
          <span key={n} className="text-sm font-medium text-gray-700">
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
            step="0.01"
            disabled={!escritura}
            value={defectoDe(n, grupo, defecto) || ''}
            onChange={(e) => setDefecto(n, grupo, defecto, Math.max(0, Number(e.target.value)))}
            className={celdaInputClass}
          />
        ))}
        total={formatoNum(sumaDefecto(grupo, defecto))}
      />
    )
  }

  return (
    <div>
      <SectionHeading>Mediciones por racimo</SectionHeading>
      <p className="mb-2 text-xs text-gray-500">
        Los defectos se registran en peso (no en cantidad): C. Peso de merma se calcula solo, sumando el peso de
        todos los defectos de cada racimo.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-[1520px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="sticky left-0 z-[2] w-[190px] border-r border-gray-200 bg-gray-50 py-2 pr-2 pl-3 text-xs font-medium">Campo</th>
              {NUMEROS_MUESTRA.map((n) => (
                <th key={n} className="w-[120px] border-r border-gray-100 px-1 py-2 text-center text-sm font-medium">
                  {n}
                </th>
              ))}
              <th className="w-[130px] px-1 py-2 text-center text-xs font-medium">Total / Promedio</th>
            </tr>
          </thead>
          <tbody>
            {filaHora()}
            {filaTexto('LOTE', 'lote')}
            {filaTexto('No. DE RACIMO', 'noRacimo')}
            {filaCinta()}
            {filaTexto('EDAD', 'edadCinta')}
            {filaNumero('GRADO SUDBASAL', 'gradoSudbasal')}
            {filaNumero('GRADO APICAL', 'gradoApical')}
            {filaNumero('No. DE MANOS', 'noManos', 0)}
            {filaNumero('LARGO APICAL', 'largoApical')}
            {filaNumero('A. PESO FRUTA PREMIUM', 'pesoFrutaPremium')}
            {filaNumero('B. PESO FRUTA CORTA', 'pesoFrutaCorta')}
            {filaCalculada('C. PESO DE MERMA (suma de defectos)', 'C')}
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
