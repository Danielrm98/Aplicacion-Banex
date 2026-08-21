import { useState } from 'react'
import ProductionForm from '../components/ProductionForm'
import ExportButtons from '../components/ExportButtons'
import { useProducciones } from '../lib/useProducciones'

export default function EntryPage() {
  const [savedCount, setSavedCount] = useState(0)
  const { registros } = useProducciones({})

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-lg font-semibold text-gray-900">Registrar producción</h1>
          <p className="text-sm text-gray-500">Captura los datos de un lote de cajas de banano.</p>
        </div>
        <ExportButtons registros={registros} />
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6">
        <ProductionForm onSaved={() => setSavedCount((c) => c + 1)} />
      </div>

      {savedCount > 0 && (
        <p className="mt-4 text-sm text-banex-700">
          Registro guardado ({savedCount} en esta sesión). Puedes verlo en el Historial.
        </p>
      )}
    </div>
  )
}
