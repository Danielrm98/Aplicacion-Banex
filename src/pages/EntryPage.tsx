import { useState } from 'react'
import ProductionForm from '../components/ProductionForm'

export default function EntryPage() {
  const [savedCount, setSavedCount] = useState(0)

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-gray-900">Registrar producción</h1>
      <p className="mb-6 text-sm text-gray-500">Captura los datos de un lote de cajas de banano.</p>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
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
