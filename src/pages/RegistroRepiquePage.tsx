import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { domToBlob } from 'modern-screenshot'
import { BANEX_LOGO_URL } from '../lib/logo'
import { useAuth } from '../lib/AuthContext'
import { usePerfil } from '../lib/usePerfil'
import { useFincas } from '../lib/useFincas'
import { useLotes } from '../lib/useLotes'
import { useEmbolses } from '../lib/useEmbolses'
import { useRepiques } from '../lib/useRepiques'
import { anioEmbolsesDe } from '../lib/anioEmbolses'
import { colorCintaDe, semanaEmbolseDeEdad, ESTILO_CINTA } from '../lib/cintaEmbolse'
import { getIsoWeek } from '../lib/isoWeek'
import { fechaLocalHoy } from '../lib/fechaLocal'
import { obtenerFincaActual, guardarFincaActual } from '../lib/fincaActual'
import { posicionFinca } from '../lib/ordenFincas'
import { conLimite } from '../lib/promesaConLimite'
import { esErrorDeRed, LIMITE_ENVIO_MS } from '../lib/colaRegistros'
import { agregarRepiqueACola, enviarRepique } from '../lib/colaRepiques'
import { useRepiquesPendientes } from '../lib/useRepiquesPendientes'
import { useCensoPlantas } from '../lib/useCensoPlantas'
import { agregarCensoPlantasACola, enviarCensoPlantas } from '../lib/colaCensoPlantas'
import { useCensoPlantasPendientes } from '../lib/useCensoPlantasPendientes'
import { manejarFlechasCelda } from '../lib/navegacionGrid'
import type { RepiqueInput } from '../types/repique'
import type { CensoPlantasInput } from '../types/censoPlantas'
import type { Finca } from '../types/finca'
import type { Lote } from '../types/lote'

const SEMANAS = Array.from({ length: 53 }, (_, i) => i + 1)
// Edad 0 (recién embolsado) a 12, igual a como BANEX ya lo cuenta en sus
// propias planillas de repique.
const EDADES = Array.from({ length: 13 }, (_, i) => i)

export default function RegistroRepiquePage() {
  const { session } = useAuth()
  const { perfil, fincas: fincasAsignadas } = usePerfil()
  const esOperador = perfil?.rol === 'operador'
  const { fincas: todasLasFincas } = useFincas()
  const fincasDisponibles = esOperador
    ? todasLasFincas.filter((f) => fincasAsignadas.includes(f.nombre))
    : todasLasFincas
  const fincasOrdenadas = useMemo(
    () => [...fincasDisponibles].sort((a, b) => posicionFinca(a.nombre) - posicionFinca(b.nombre)),
    [fincasDisponibles],
  )
  const fincaUnicaOperador = esOperador && fincasAsignadas.length === 1 ? fincasAsignadas[0] : null

  const [semana, setSemana] = useState(() => getIsoWeek(fechaLocalHoy()))
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [fincaSeleccionada, setFincaSeleccionada] = useState<string>('')

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

  const { lotes, loading: loadingLotes } = useLotes()
  const anioEmbolses = anioEmbolsesDe(anio, semana)
  const { embolses, loading: loadingEmbolses } = useEmbolses({ anioEmbolses })
  const { repiques, loading: loadingRepiques, refetchSilencioso } = useRepiques({ anioEmbolses })
  const { pendientes, cargado: pendientesCargados, recargar: recargarPendientes } = useRepiquesPendientes()
  const { censo, loading: loadingCenso, refetchSilencioso: refetchCensoSilencioso } = useCensoPlantas({ anio })
  const { pendientes: pendientesCenso, cargado: pendientesCensoCargados, recargar: recargarPendientesCenso } = useCensoPlantasPendientes()

  const lotesFinca = useMemo(
    () => [...lotes.filter((l) => l.finca === fincaSeleccionada)].sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true })),
    [lotes, fincaSeleccionada],
  )

  const alGuardar = useCallback(() => {
    refetchSilencioso()
    recargarPendientes()
  }, [refetchSilencioso, recargarPendientes])

  const alGuardarCenso = useCallback(() => {
    refetchCensoSilencioso()
    recargarPendientesCenso()
  }, [refetchCensoSilencioso, recargarPendientesCenso])

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    guardarFincaActual(nombre)
  }

  const finca = fincasOrdenadas.find((f) => f.nombre === fincaSeleccionada) ?? null

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Registro de repique</h1>
      <p className="mb-6 text-sm text-gray-500">
        Reporta, por lote y por la edad (0 a 12 semanas) que tenían los racimos al momento del repique, cuántos se
        descartaron (viento, lluvia, problemas fisiológicos). Esto descuenta solo el inventario calculado en el menú
        Repiques — el conteo original de Embolses no se modifica. También se relaciona por lote la cantidad de
        plantas paridas, sin parir, y racimos repicados sin identificar de esta semana.
      </p>
      <p className="mb-6 text-xs text-gray-400">
        Cada semana guarda su propio registro: si vuelves a abrir una semana ya reportada, ves exactamente lo que se
        registró esa semana; una semana nueva aparece en blanco. El aviso de "disp." bajo cada casilla sí tiene en
        cuenta todo lo repicado en semanas anteriores para esa misma cinta, aunque haya caído en otra columna de edad.
      </p>
      <p className="mb-6 text-xs text-gray-400">
        Igual que en Registro de embolse: la edad 0 (recién embolsado) usa la cinta de la semana SIGUIENTE a la que
        elijas abajo, por eso el color de cada columna puede no coincidir con la semana que seleccionaste.
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

        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Semana en que se repica</span>
          <select
            value={semana}
            onChange={(e) => setSemana(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          >
            {SEMANAS.map((s) => (
              <option key={s} value={s}>
                Semana {s}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Año</span>
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>
      </div>

      {loadingLotes || loadingEmbolses || loadingRepiques || !pendientesCargados || loadingCenso || !pendientesCensoCargados ? (
        <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
      ) : !finca ? (
        <p className="py-8 text-center text-sm text-gray-500">Selecciona una finca.</p>
      ) : lotesFinca.length === 0 ? (
        <p className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          Esta finca todavía no tiene lotes. Créalos en Catálogo → Lotes.
        </p>
      ) : (
        <TablaRepique
          key={`${finca.nombre}-${anio}-${semana}`}
          finca={finca}
          lotes={lotesFinca}
          semana={semana}
          anio={anio}
          embolses={embolses}
          repiques={repiques}
          pendientes={pendientes}
          censo={censo}
          pendientesCenso={pendientesCenso}
          userId={session?.user.id ?? ''}
          onGuardado={alGuardar}
          onGuardadoCenso={alGuardarCenso}
        />
      )}
    </div>
  )
}

interface CeldaInfo {
  edad: number
  anioEmbolse: number
  semanaEmbolse: number
  color: ReturnType<typeof colorCintaDe>
}

function TablaRepique({
  finca,
  lotes,
  semana,
  anio,
  embolses,
  repiques,
  pendientes,
  censo,
  pendientesCenso,
  userId,
  onGuardado,
  onGuardadoCenso,
}: {
  finca: Finca
  lotes: Lote[]
  semana: number
  anio: number
  embolses: { lote_id: string; anio: number; semana: number; cantidad: number }[]
  repiques: {
    lote_id: string
    anio_reporte: number
    semana_reporte: number
    anio_embolse: number
    semana_embolse: number
    edad_semanas: number
    cantidad: number
  }[]
  pendientes: { payload: RepiqueInput }[]
  censo: { lote_id: string; anio: number; semana: number; paridas: number; sin_parir: number; sin_identificar: number }[]
  pendientesCenso: { payload: CensoPlantasInput }[]
  userId: string
  onGuardado: () => void
  onGuardadoCenso: () => void
}) {
  const columnas: CeldaInfo[] = useMemo(
    () =>
      EDADES.map((edad) => {
        const { anio: anioEmbolse, semana: semanaEmbolse } = semanaEmbolseDeEdad(anio, semana, edad)
        return { edad, anioEmbolse, semanaEmbolse, color: colorCintaDe(anioEmbolse, semanaEmbolse) }
      }),
    [anio, semana],
  )

  // Todo lo repicado de esa semana de embolse hasta ahora, sin importar en
  // qué semana de reporte se fue registrando cada parte (varias semanas de
  // reporte pueden tocar la misma cinta conforme envejece). Lo pendiente de
  // sincronizar reemplaza al valor del servidor para esa misma semana de
  // reporte + edad (es la misma celda, solo que todavía no llegó), no se
  // suma aparte.
  function totalBucket(loteId: string, anioEmbolse: number, semanaEmbolse: number): number {
    const mapa = new Map<string, number>()
    for (const r of repiques) {
      if (r.lote_id === loteId && r.anio_embolse === anioEmbolse && r.semana_embolse === semanaEmbolse) {
        mapa.set(`${r.anio_reporte}_${r.semana_reporte}_${r.edad_semanas}`, r.cantidad)
      }
    }
    for (const p of pendientes) {
      if (p.payload.lote_id === loteId && p.payload.anio_embolse === anioEmbolse && p.payload.semana_embolse === semanaEmbolse) {
        mapa.set(`${p.payload.anio_reporte}_${p.payload.semana_reporte}_${p.payload.edad_semanas}`, p.payload.cantidad)
      }
    }
    return [...mapa.values()].reduce((sum, v) => sum + v, 0)
  }

  function datosCelda(loteId: string, info: CeldaInfo) {
    const embolsado =
      embolses.find((e) => e.lote_id === loteId && e.anio === info.anioEmbolse && e.semana === info.semanaEmbolse)
        ?.cantidad ?? 0
    return { embolsado, repicadoAcumulado: totalBucket(loteId, info.anioEmbolse, info.semanaEmbolse) }
  }

  // Lo guardado específicamente para la semana de reporte que se está
  // viendo ahora mismo: si ya se reportó algo esta semana, se precarga
  // (igual a cualquier celda editable normal); si es una semana nueva,
  // todavía no hay fila y queda en blanco.
  function entradaEstaSemana(loteId: string, edad: number): number {
    const pendiente = pendientes.find(
      (p) =>
        p.payload.lote_id === loteId &&
        p.payload.anio_reporte === anio &&
        p.payload.semana_reporte === semana &&
        p.payload.edad_semanas === edad,
    )
    if (pendiente) return pendiente.payload.cantidad
    const servidor = repiques.find(
      (r) => r.lote_id === loteId && r.anio_reporte === anio && r.semana_reporte === semana && r.edad_semanas === edad,
    )
    return servidor?.cantidad ?? 0
  }

  function datosCensoCelda(loteId: string) {
    const servidor = censo.find((c) => c.lote_id === loteId && c.anio === anio && c.semana === semana)
    const pendiente = pendientesCenso.find(
      (p) => p.payload.lote_id === loteId && p.payload.anio === anio && p.payload.semana === semana,
    )?.payload
    return {
      paridas: pendiente?.paridas ?? servidor?.paridas ?? 0,
      sinParir: pendiente?.sin_parir ?? servidor?.sin_parir ?? 0,
      sinIdentificar: pendiente?.sin_identificar ?? servidor?.sin_identificar ?? 0,
    }
  }

  const COL_PARIDAS = EDADES.length
  const COL_SIN_PARIR = EDADES.length + 1
  const COL_SIN_IDENTIFICAR = EDADES.length + 2

  const [borrador, setBorrador] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {}
    for (const l of lotes) {
      for (const c of columnas) {
        const entrada = entradaEstaSemana(l.id, c.edad)
        inicial[`${l.id}_${c.edad}`] = entrada > 0 ? String(entrada) : ''
      }
      const { paridas, sinParir, sinIdentificar } = datosCensoCelda(l.id)
      inicial[`${l.id}_paridas`] = paridas > 0 ? String(paridas) : ''
      inicial[`${l.id}_sinparir`] = sinParir > 0 ? String(sinParir) : ''
      inicial[`${l.id}_sinidentificar`] = sinIdentificar > 0 ? String(sinIdentificar) : ''
    }
    return inicial
  })
  const [guardando, setGuardando] = useState<Set<string>>(new Set())
  const [conError, setConError] = useState<Record<string, string>>({})
  const capturaRef = useRef<HTMLDivElement>(null)
  const [compartiendo, setCompartiendo] = useState(false)
  const [errorCompartir, setErrorCompartir] = useState<string | null>(null)

  // navigator.share() exige llamarse dentro del mismo gesto del usuario (el
  // clic); generar la captura de pantalla toma más tiempo del que el
  // navegador considera "gesto activo" y el share termina fallando con
  // "Must be handling a user gesture...". Por eso la imagen se genera en
  // segundo plano (al abrir la tabla y después de cada guardado, con una
  // pequeña espera para no regenerarla con cada tecla) y el clic en
  // "Compartir" solo la usa — ya lista, el share se llama casi de inmediato.
  const [imagenLista, setImagenLista] = useState<{ blob: Blob; file: File } | null>(null)
  const regenerarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function generarImagen(): Promise<{ blob: Blob; file: File } | null> {
    if (!capturaRef.current) return null
    try {
      const { scrollWidth, scrollHeight } = capturaRef.current
      const blob = await domToBlob(capturaRef.current, {
        backgroundColor: '#ffffff',
        scale: 2.5,
        width: scrollWidth,
        height: scrollHeight,
        style: { width: `${scrollWidth}px`, maxWidth: 'none' },
      })
      const nombreArchivo = `repique_${finca.nombre}_semana${semana}_${anio}.png`.replace(/\s+/g, '_')
      const resultado = { blob, file: new File([blob], nombreArchivo, { type: 'image/png' }) }
      setImagenLista(resultado)
      return resultado
    } catch {
      return null
    }
  }

  function programarRegeneracion() {
    if (regenerarTimeoutRef.current) clearTimeout(regenerarTimeoutRef.current)
    regenerarTimeoutRef.current = setTimeout(generarImagen, 800)
  }

  useEffect(() => {
    generarImagen()
    return () => {
      if (regenerarTimeoutRef.current) clearTimeout(regenerarTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function valorDe(loteId: string, edad: number) {
    return borrador[`${loteId}_${edad}`] ?? ''
  }

  function valorParidasDe(loteId: string) {
    return borrador[`${loteId}_paridas`] ?? ''
  }

  function valorSinParirDe(loteId: string) {
    return borrador[`${loteId}_sinparir`] ?? ''
  }

  function valorSinIdentificarDe(loteId: string) {
    return borrador[`${loteId}_sinidentificar`] ?? ''
  }

  function totalPlantas(loteId: string) {
    return (
      (Number(valorParidasDe(loteId)) || 0) +
      (Number(valorSinParirDe(loteId)) || 0) +
      (Number(valorSinIdentificarDe(loteId)) || 0)
    )
  }

  // Solo lo que se ve en esta semana (la que se está reportando ahora
  // mismo, sea nueva o una ya reportada que se volvió a abrir) — no el
  // acumulado de todas las semanas de reporte que hayan tocado esa cinta.
  function totalLote(loteId: string) {
    return columnas.reduce((sum, c) => sum + (Number(valorDe(loteId, c.edad)) || 0), 0) + totalPlantas(loteId)
  }

  const totalGeneral = lotes.reduce((sum, l) => sum + totalLote(l.id), 0)
  const totalGeneralParidas = lotes.reduce((sum, l) => sum + (Number(valorParidasDe(l.id)) || 0), 0)
  const totalGeneralSinParir = lotes.reduce((sum, l) => sum + (Number(valorSinParirDe(l.id)) || 0), 0)
  const totalGeneralSinIdentificar = lotes.reduce((sum, l) => sum + (Number(valorSinIdentificarDe(l.id)) || 0), 0)
  const totalGeneralPlantas = totalGeneralParidas + totalGeneralSinParir + totalGeneralSinIdentificar

  async function guardarCelda(lote: Lote, info: CeldaInfo, valorTexto: string) {
    const clave = `${lote.id}_${info.edad}`
    const cantidad = valorTexto.trim() === '' ? 0 : Number(valorTexto)
    if (Number.isNaN(cantidad) || cantidad < 0) {
      setConError((prev) => ({ ...prev, [clave]: 'Cantidad inválida' }))
      return
    }
    if (cantidad === entradaEstaSemana(lote.id, info.edad)) return // sin cambios reales

    setGuardando((prev) => new Set(prev).add(clave))
    setConError((prev) => {
      const { [clave]: _quitado, ...resto } = prev
      return resto
    })

    const payload: RepiqueInput = {
      lote_id: lote.id,
      anio_reporte: anio,
      semana_reporte: semana,
      anio_embolse: info.anioEmbolse,
      semana_embolse: info.semanaEmbolse,
      edad_semanas: info.edad,
      cantidad,
      user_id: userId,
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await agregarRepiqueACola(payload)
      onGuardado()
      programarRegeneracion()
      setGuardando((prev) => {
        const siguiente = new Set(prev)
        siguiente.delete(clave)
        return siguiente
      })
      return
    }
    try {
      await conLimite(enviarRepique(payload), LIMITE_ENVIO_MS)
      onGuardado()
      programarRegeneracion()
    } catch (err) {
      if (esErrorDeRed(err)) {
        await agregarRepiqueACola(payload)
        onGuardado()
        programarRegeneracion()
      } else {
        setConError((prev) => ({ ...prev, [clave]: err instanceof Error ? err.message : 'No se pudo guardar' }))
      }
    } finally {
      setGuardando((prev) => {
        const siguiente = new Set(prev)
        siguiente.delete(clave)
        return siguiente
      })
    }
  }

  async function guardarCenso(lote: Lote, campo: 'paridas' | 'sin_parir' | 'sin_identificar', valorTexto: string) {
    const claveCampo = campo === 'paridas' ? 'paridas' : campo === 'sin_parir' ? 'sinparir' : 'sinidentificar'
    const clave = `${lote.id}_${claveCampo}`
    const valor = valorTexto.trim() === '' ? 0 : Number(valorTexto)
    if (Number.isNaN(valor) || valor < 0) {
      setConError((prev) => ({ ...prev, [clave]: 'Cantidad inválida' }))
      return
    }

    // Se manda el trío completo (paridas + sin parir + sin identificar),
    // tomando del borrador en pantalla los campos que no se acaban de
    // editar, para no pisarlos con lo último guardado si el operario ya
    // había cambiado algún otro campo y todavía no salía de esa casilla.
    const paridas = campo === 'paridas' ? valor : Number(valorParidasDe(lote.id)) || 0
    const sinParir = campo === 'sin_parir' ? valor : Number(valorSinParirDe(lote.id)) || 0
    const sinIdentificar = campo === 'sin_identificar' ? valor : Number(valorSinIdentificarDe(lote.id)) || 0
    const guardado = datosCensoCelda(lote.id)
    if (paridas === guardado.paridas && sinParir === guardado.sinParir && sinIdentificar === guardado.sinIdentificar) {
      return
    }

    setGuardando((prev) => new Set(prev).add(clave))
    setConError((prev) => {
      const { [clave]: _quitado, ...resto } = prev
      return resto
    })

    const payload: CensoPlantasInput = {
      lote_id: lote.id,
      anio,
      semana,
      paridas,
      sin_parir: sinParir,
      sin_identificar: sinIdentificar,
      user_id: userId,
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await agregarCensoPlantasACola(payload)
      onGuardadoCenso()
      programarRegeneracion()
      setGuardando((prev) => {
        const siguiente = new Set(prev)
        siguiente.delete(clave)
        return siguiente
      })
      return
    }
    try {
      await conLimite(enviarCensoPlantas(payload), LIMITE_ENVIO_MS)
      onGuardadoCenso()
      programarRegeneracion()
    } catch (err) {
      if (esErrorDeRed(err)) {
        await agregarCensoPlantasACola(payload)
        onGuardadoCenso()
        programarRegeneracion()
      } else {
        setConError((prev) => ({ ...prev, [clave]: err instanceof Error ? err.message : 'No se pudo guardar' }))
      }
    } finally {
      setGuardando((prev) => {
        const siguiente = new Set(prev)
        siguiente.delete(clave)
        return siguiente
      })
    }
  }

  function descargarImagen(lista: { blob: Blob; file: File }) {
    const url = URL.createObjectURL(lista.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = lista.file.name
    link.click()
    URL.revokeObjectURL(url)
  }

  async function compartirRepique() {
    setErrorCompartir(null)
    setCompartiendo(true)
    try {
      // Si ya está lista (lo normal, generada en segundo plano), el share se
      // llama de inmediato; si no, se genera ahora mismo (puede fallar el
      // share nativo por el gesto del usuario, y en ese caso se descarga).
      const lista = imagenLista ?? (await generarImagen())
      if (!lista) {
        setErrorCompartir('No se pudo generar la imagen.')
        return
      }
      const texto = `*REGISTRO DE REPIQUE*\n*FINCA:* ${finca.nombre}\n*SEMANA:* ${semana}/${anio}`
      if (navigator.canShare?.({ files: [lista.file] })) {
        try {
          await navigator.share({ files: [lista.file], title: 'Registro de repique', text: texto })
          return
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return // el usuario canceló, no es un error
          // El share nativo falló (por ejemplo, por el gesto del usuario si la
          // imagen se tuvo que generar justo ahora): se descarga en su lugar.
        }
      }
      descargarImagen(lista)
    } catch (err) {
      setErrorCompartir(err instanceof Error ? err.message : 'No se pudo generar la imagen.')
    } finally {
      setCompartiendo(false)
    }
  }

  function inputClass(clave: string) {
    const base =
      'w-full min-w-0 rounded-md border px-1 py-1 text-center text-xs text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-banex-500/20 disabled:opacity-50'
    return conError[clave]
      ? `${base} border-red-400 bg-red-50`
      : `${base} border-gray-200 bg-gray-50 focus:border-banex-500 focus:bg-white`
  }

  return (
    <div className="relative">
      <h2 className="mb-3 text-sm font-semibold text-banex-800">
        {finca.nombre}
        {finca.hectareas != null && <span className="ml-2 font-normal text-gray-500">{finca.hectareas.toLocaleString('es')} ha</span>} · Semana {semana}/{anio}
      </h2>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="border-collapse text-sm" style={{ width: `${160 + columnas.length * 72 + 4 * 92}px` }}>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="sticky left-0 z-10 w-[160px] border-r border-gray-200 bg-gray-50 py-2 pr-3 pl-4 font-medium">Lote</th>
              {columnas.map((c) => {
                const estilo = ESTILO_CINTA[c.color]
                return (
                  <th
                    key={c.edad}
                    className="w-[72px] border-r border-gray-100 px-1 py-1.5 text-center font-medium"
                    title={`Semana ${c.semanaEmbolse}/${c.anioEmbolse}`}
                  >
                    <div>Edad {c.edad}</div>
                    <div
                      className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: estilo.bg, color: estilo.texto }}
                    >
                      {c.color.charAt(0) + c.color.slice(1).toLowerCase()}
                    </div>
                  </th>
                )
              })}
              <th className="w-[92px] border-l-2 border-r border-banex-100 bg-green-50 px-2 py-2 text-center font-medium">
                Plantas paridas
              </th>
              <th className="w-[92px] border-r border-banex-100 bg-green-50 px-2 py-2 text-center font-medium">
                Plantas sin parir
              </th>
              <th className="w-[92px] border-r border-banex-100 bg-green-50 px-2 py-2 text-center font-medium">
                Sin identificar
              </th>
              <th className="w-[92px] border-r border-banex-100 bg-green-100 px-2 py-2 text-center font-medium">
                Total plantas
              </th>
              <th className="w-[90px] border-l-2 border-banex-100 bg-gray-100 px-2 py-2 text-center font-medium">Total lote</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map((l, fila) => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="sticky left-0 z-10 border-r border-gray-200 bg-white py-1.5 pr-3 pl-4 font-medium text-gray-900">
                  {l.nombre}
                </td>
                {columnas.map((c, columna) => {
                  const clave = `${l.id}_${c.edad}`
                  const { embolsado, repicadoAcumulado } = datosCelda(l.id, c)
                  const disponible = embolsado - repicadoAcumulado
                  return (
                    <td key={clave} className="border-r border-gray-100 p-0.5 text-center">
                      <input
                        type="number"
                        min={0}
                        value={valorDe(l.id, c.edad)}
                        onChange={(e) => setBorrador((prev) => ({ ...prev, [clave]: e.target.value }))}
                        onBlur={(e) => guardarCelda(l, c, e.target.value)}
                        onKeyDown={(e) => manejarFlechasCelda(e, fila, columna)}
                        data-fila={fila}
                        data-col={columna}
                        disabled={guardando.has(clave)}
                        title={conError[clave]}
                        className={inputClass(clave)}
                      />
                      <p className="mt-0.5 text-[10px] text-gray-400">{embolsado > 0 ? `disp. ${disponible}` : ''}</p>
                    </td>
                  )
                })}
                <td className="border-l-2 border-r border-banex-100 bg-green-50/40 p-0.5 text-center">
                  <input
                    type="number"
                    min={0}
                    value={valorParidasDe(l.id)}
                    onChange={(e) => setBorrador((prev) => ({ ...prev, [`${l.id}_paridas`]: e.target.value }))}
                    onBlur={(e) => guardarCenso(l, 'paridas', e.target.value)}
                    onKeyDown={(e) => manejarFlechasCelda(e, fila, COL_PARIDAS)}
                    data-fila={fila}
                    data-col={COL_PARIDAS}
                    disabled={guardando.has(`${l.id}_paridas`)}
                    title={conError[`${l.id}_paridas`]}
                    className={inputClass(`${l.id}_paridas`)}
                  />
                </td>
                <td className="border-r border-banex-100 bg-green-50/40 p-0.5 text-center">
                  <input
                    type="number"
                    min={0}
                    value={valorSinParirDe(l.id)}
                    onChange={(e) => setBorrador((prev) => ({ ...prev, [`${l.id}_sinparir`]: e.target.value }))}
                    onBlur={(e) => guardarCenso(l, 'sin_parir', e.target.value)}
                    onKeyDown={(e) => manejarFlechasCelda(e, fila, COL_SIN_PARIR)}
                    data-fila={fila}
                    data-col={COL_SIN_PARIR}
                    disabled={guardando.has(`${l.id}_sinparir`)}
                    title={conError[`${l.id}_sinparir`]}
                    className={inputClass(`${l.id}_sinparir`)}
                  />
                </td>
                <td className="border-r border-banex-100 bg-green-50/40 p-0.5 text-center">
                  <input
                    type="number"
                    min={0}
                    value={valorSinIdentificarDe(l.id)}
                    onChange={(e) => setBorrador((prev) => ({ ...prev, [`${l.id}_sinidentificar`]: e.target.value }))}
                    onBlur={(e) => guardarCenso(l, 'sin_identificar', e.target.value)}
                    onKeyDown={(e) => manejarFlechasCelda(e, fila, COL_SIN_IDENTIFICAR)}
                    data-fila={fila}
                    data-col={COL_SIN_IDENTIFICAR}
                    disabled={guardando.has(`${l.id}_sinidentificar`)}
                    title={conError[`${l.id}_sinidentificar`]}
                    className={inputClass(`${l.id}_sinidentificar`)}
                  />
                </td>
                <td className="border-r border-banex-100 bg-green-100/60 px-2 py-1.5 text-center font-semibold text-banex-800">
                  {totalPlantas(l.id).toLocaleString('es')}
                </td>
                <td className="border-l-2 border-banex-100 bg-banex-50/40 px-2 py-1.5 text-center font-semibold text-banex-800">
                  {totalLote(l.id).toLocaleString('es')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
              <td className="sticky left-0 z-10 border-r border-banex-100 bg-banex-50 py-1.5 pr-3 pl-4">TOTAL</td>
              {columnas.map((c) => (
                <td key={c.edad} className="border-r border-banex-50 px-1 py-1.5 text-center">
                  {lotes.reduce((sum, l) => sum + (Number(valorDe(l.id, c.edad)) || 0), 0).toLocaleString('es')}
                </td>
              ))}
              <td className="border-l-2 border-r border-banex-100 bg-green-100/60 px-2 py-1.5 text-center">
                {totalGeneralParidas.toLocaleString('es')}
              </td>
              <td className="border-r border-banex-100 bg-green-100/60 px-2 py-1.5 text-center">
                {totalGeneralSinParir.toLocaleString('es')}
              </td>
              <td className="border-r border-banex-100 bg-green-100/60 px-2 py-1.5 text-center">
                {totalGeneralSinIdentificar.toLocaleString('es')}
              </td>
              <td className="border-r border-banex-100 bg-green-200/60 px-2 py-1.5 text-center">
                {totalGeneralPlantas.toLocaleString('es')}
              </td>
              <td className="border-l-2 border-banex-100 bg-banex-100/60 px-2 py-1.5 text-center">
                {totalGeneral.toLocaleString('es')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {Object.entries(conError).length > 0 && <p className="mt-2 text-sm text-red-600">{Object.values(conError)[0]}</p>}

      <div className="mt-4">
        <button
          onClick={compartirRepique}
          disabled={compartiendo}
          className="rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1fb959] disabled:opacity-60"
        >
          {compartiendo ? 'Generando imagen...' : 'Compartir repique'}
        </button>
        {errorCompartir && <p className="mt-2 text-sm text-red-600">{errorCompartir}</p>}
      </div>

      <div className="pointer-events-none absolute top-0 -left-[9999px]">
        <div
          ref={capturaRef}
          className="rounded-lg bg-white p-8"
          style={{ width: `${820 + columnas.length * 96 + 4 * 120}px` }}
        >
          <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-4">
            <img src={BANEX_LOGO_URL} alt="BANEX S.A." className="h-16 w-16 shrink-0 rounded-md object-contain" />
            <div>
              <p className="text-2xl font-bold text-banex-900">ApproBan</p>
              <p className="text-lg text-gray-500">Registro de repique</p>
            </div>
          </div>
          <h2 className="mb-5 text-2xl font-semibold text-banex-800">
            {finca.nombre}
            {finca.hectareas != null && <span className="ml-3 text-xl font-normal text-gray-500">{finca.hectareas.toLocaleString('es')} ha</span>}
            <span className="ml-4 text-xl font-normal text-gray-600">Semana {semana}/{anio}</span>
          </h2>
          <table className="w-full border-collapse text-lg">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="py-3 pr-4 pl-5 font-medium">Lote</th>
                {columnas.map((c) => {
                  const estilo = ESTILO_CINTA[c.color]
                  return (
                    <th key={c.edad} className="px-1 py-3 text-center font-medium">
                      <div>Edad {c.edad}</div>
                      <div
                        className="mx-auto mt-1 inline-block rounded px-2 py-0.5 text-sm font-semibold"
                        style={{ backgroundColor: estilo.bg, color: estilo.texto }}
                      >
                        {c.color.charAt(0) + c.color.slice(1).toLowerCase()}
                      </div>
                    </th>
                  )
                })}
                <th className="px-3 py-3 text-center font-medium">Paridas</th>
                <th className="px-3 py-3 text-center font-medium">Sin parir</th>
                <th className="px-3 py-3 text-center font-medium">Sin identificar</th>
                <th className="px-3 py-3 text-center font-medium">Total plantas</th>
                <th className="px-3 py-3 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="py-3 pr-4 pl-5 font-medium text-gray-900">{l.nombre}</td>
                  {columnas.map((c) => (
                    <td key={c.edad} className="px-1 py-3 text-center">
                      {valorDe(l.id, c.edad) || '—'}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center">{valorParidasDe(l.id) || '—'}</td>
                  <td className="px-3 py-3 text-center">{valorSinParirDe(l.id) || '—'}</td>
                  <td className="px-3 py-3 text-center">{valorSinIdentificarDe(l.id) || '—'}</td>
                  <td className="px-3 py-3 text-center font-semibold text-banex-800">{totalPlantas(l.id).toLocaleString('es')}</td>
                  <td className="px-3 py-3 text-center font-semibold text-banex-800">{totalLote(l.id).toLocaleString('es')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-banex-100 bg-banex-50/50 font-semibold text-banex-800">
                <td className="py-3 pr-4 pl-5">TOTAL</td>
                {columnas.map((c) => (
                  <td key={c.edad} className="px-1 py-3 text-center">
                    {lotes.reduce((sum, l) => sum + (Number(valorDe(l.id, c.edad)) || 0), 0).toLocaleString('es')}
                  </td>
                ))}
                <td className="px-3 py-3 text-center">{totalGeneralParidas.toLocaleString('es')}</td>
                <td className="px-3 py-3 text-center">{totalGeneralSinParir.toLocaleString('es')}</td>
                <td className="px-3 py-3 text-center">{totalGeneralSinIdentificar.toLocaleString('es')}</td>
                <td className="px-3 py-3 text-center">{totalGeneralPlantas.toLocaleString('es')}</td>
                <td className="px-3 py-3 text-center">{totalGeneral.toLocaleString('es')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
