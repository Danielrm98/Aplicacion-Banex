import { useEffect, useState } from 'react'
import ProductionForm from '../components/ProductionForm'
import ExportButtons from '../components/ExportButtons'
import ShareSummaryPanel from '../components/ShareSummaryPanel'
import FincaClimaPanel from '../components/FincaClimaPanel'
import { useProducciones } from '../lib/useProducciones'
import { useFincas } from '../lib/useFincas'
import { useClima } from '../lib/useClima'
import { usePerfil } from '../lib/usePerfil'
import { guardarFincaActual, obtenerFincaActual } from '../lib/fincaActual'
import { leerBorrador, borradorTieneDatos } from '../lib/borradorRegistro'
import { saludoSegunHora } from '../lib/saludo'
import type { RegistroResumenCompartir } from '../lib/shareSummary'
import type { Finca } from '../types/finca'

function fincaConBorradorPendiente(): string | null {
  const ultima = obtenerFincaActual()
  if (!ultima) return null
  const borrador = leerBorrador(ultima)
  return borrador && borradorTieneDatos(borrador) ? ultima : null
}

export default function EntryPage() {
  const { perfil, loading: loadingPerfil } = usePerfil()
  const esOperador = perfil?.rol === 'operador'

  // Si el navegador recargó la página (por ejemplo al volver de otra pestaña
  // en el celular) y había un registro sin guardar, vuelve directo a esa
  // finca en vez de mostrar el selector de nuevo.
  const [fincaSeleccionada, setFincaSeleccionada] = useState<string | null>(fincaConBorradorPendiente)
  const [savedCount, setSavedCount] = useState(0)
  const [ultimoPendienteSync, setUltimoPendienteSync] = useState(false)
  const [ultimoResumen, setUltimoResumen] = useState<RegistroResumenCompartir | null>(null)
  const { registros } = useProducciones({})
  const { fincas } = useFincas()

  const fincaActiva = esOperador ? (perfil?.finca ?? null) : fincaSeleccionada

  useEffect(() => {
    if (esOperador && perfil?.finca) guardarFincaActual(perfil.finca)
  }, [esOperador, perfil?.finca])

  function handleSaved(resumen: RegistroResumenCompartir, pendienteSync: boolean) {
    setSavedCount((c) => c + 1)
    setUltimoPendienteSync(pendienteSync)
    setUltimoResumen(resumen)
  }

  function elegirFinca(nombre: string) {
    setFincaSeleccionada(nombre)
    guardarFincaActual(nombre)
  }

  function volverAFincas() {
    setFincaSeleccionada(null)
    setUltimoResumen(null)
  }

  if (loadingPerfil) {
    return <p className="py-16 text-center text-sm text-gray-500">Cargando...</p>
  }

  if (esOperador && !perfil?.finca) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6">
        <p className="text-sm text-gray-500">
          Tu usuario todavía no tiene una finca asignada. Pídele al administrador que te la asigne en Catálogo →
          Usuarios.
        </p>
      </div>
    )
  }

  if (!fincaActiva) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">{saludoSegunHora()}</h1>
            <p className="text-sm text-gray-500">¿Qué finca deseas registrar?</p>
          </div>
          <ExportButtons registros={registros} />
        </div>

        {fincas.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Todavía no hay fincas en el catálogo. Agrega una en Catálogo → Fincas.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {fincas.map((finca) => (
              <FincaTile key={finca.nombre} finca={finca} onClick={() => elegirFinca(finca.nombre)} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!esOperador && (
            <button
              onClick={volverAFincas}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700"
            >
              ← Fincas
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-banex-900 sm:text-2xl">{fincaActiva}</h1>
            <p className="text-sm text-gray-500">Captura los datos de un lote de cajas de banano.</p>
          </div>
        </div>
        <ExportButtons registros={registros} />
      </div>

      <FincaClimaPanel finca={fincas.find((f) => f.nombre === fincaActiva) ?? null} />

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6">
        <ProductionForm finca={fincaActiva} onSaved={handleSaved} />
      </div>

      {ultimoResumen && (
        <div className="mt-6">
          <ShareSummaryPanel resumen={ultimoResumen} onClose={() => setUltimoResumen(null)} />
        </div>
      )}

      {savedCount > 0 &&
        (ultimoPendienteSync ? (
          <p className="mt-4 text-sm text-amber-700">
            📶 Sin conexión: el registro quedó guardado en el dispositivo y se enviará solo en cuanto vuelva la señal.
          </p>
        ) : (
          <p className="mt-4 text-sm text-banex-700">
            Registro guardado ({savedCount} en esta sesión). Puedes verlo en el Historial.
          </p>
        ))}
    </div>
  )
}

function FincaTile({ finca, onClick }: { finca: Finca; onClick: () => void }) {
  const tieneCoordenadas = finca.latitud != null && finca.longitud != null
  const { clima } = useClima(tieneCoordenadas ? finca.latitud : null, tieneCoordenadas ? finca.longitud : null)

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-start gap-2 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-banex-300 hover:shadow-md"
    >
      {clima && (
        <span className="absolute top-2 right-2 rounded-full bg-banex-50 px-2 py-0.5 text-xs font-medium text-banex-700">
          {Math.round(clima.actual.temperatura)}°
        </span>
      )}
      <span className="h-1.5 w-8 rounded-full bg-banana-500" />
      <span className="text-sm font-semibold text-banex-900">{finca.nombre}</span>
      <span className="text-xs text-gray-500">
        {finca.hectareas !== null ? `${finca.hectareas.toLocaleString('es')} ha` : 'Sin hectareaje'}
      </span>
    </button>
  )
}
