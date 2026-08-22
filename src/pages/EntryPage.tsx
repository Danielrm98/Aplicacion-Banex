import { useState } from 'react'
import ProductionForm from '../components/ProductionForm'
import ExportButtons from '../components/ExportButtons'
import ShareSummaryPanel from '../components/ShareSummaryPanel'
import FincaClimaPanel from '../components/FincaClimaPanel'
import { useProducciones } from '../lib/useProducciones'
import { useFincas } from '../lib/useFincas'
import { FINCAS } from '../lib/fincas'
import type { RegistroResumenCompartir } from '../lib/shareSummary'

export default function EntryPage() {
  const [fincaSeleccionada, setFincaSeleccionada] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)
  const [ultimoResumen, setUltimoResumen] = useState<RegistroResumenCompartir | null>(null)
  const { registros } = useProducciones({})
  const { fincas } = useFincas()

  function handleSaved(resumen: RegistroResumenCompartir) {
    setSavedCount((c) => c + 1)
    setUltimoResumen(resumen)
  }

  function volverAFincas() {
    setFincaSeleccionada(null)
    setUltimoResumen(null)
  }

  if (!fincaSeleccionada) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Registrar producción</h1>
            <p className="text-sm text-gray-500">Selecciona la finca para registrar el día.</p>
          </div>
          <ExportButtons registros={registros} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {FINCAS.map((nombre) => (
            <FincaTile
              key={nombre}
              nombre={nombre}
              hectareas={fincas.find((f) => f.nombre === nombre)?.hectareas ?? null}
              onClick={() => setFincaSeleccionada(nombre)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={volverAFincas}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700"
          >
            ← Fincas
          </button>
          <div>
            <h1 className="text-xl font-bold text-banex-900 sm:text-2xl">{fincaSeleccionada}</h1>
            <p className="text-sm text-gray-500">Captura los datos de un lote de cajas de banano.</p>
          </div>
        </div>
        <ExportButtons registros={registros} />
      </div>

      <FincaClimaPanel finca={fincas.find((f) => f.nombre === fincaSeleccionada) ?? null} />

      {ultimoResumen && (
        <div className="mb-6">
          <ShareSummaryPanel resumen={ultimoResumen} onClose={() => setUltimoResumen(null)} />
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6">
        <ProductionForm finca={fincaSeleccionada} onSaved={handleSaved} />
      </div>

      {savedCount > 0 && (
        <p className="mt-4 text-sm text-banex-700">
          Registro guardado ({savedCount} en esta sesión). Puedes verlo en el Historial.
        </p>
      )}
    </div>
  )
}

function FincaTile({
  nombre,
  hectareas,
  onClick,
}: {
  nombre: string
  hectareas: number | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-banex-300 hover:shadow-md"
    >
      <span className="h-1.5 w-8 rounded-full bg-banana-500" />
      <span className="text-sm font-semibold text-banex-900">{nombre}</span>
      <span className="text-xs text-gray-500">{hectareas !== null ? `${hectareas.toLocaleString('es')} ha` : 'Sin hectareaje'}</span>
    </button>
  )
}
