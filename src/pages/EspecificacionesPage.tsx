import { useRef, useState } from 'react'
import { useReferencias } from '../lib/useReferencias'
import { usePerfil } from '../lib/usePerfil'
import { subirEspecificacionPdf, eliminarEspecificacionPdf, urlEspecificacionPdf } from '../lib/especificacionesPdf'
import type { Referencia } from '../types/produccion'

export default function EspecificacionesPage() {
  const { referencias, loading, error, refetch } = useReferencias()
  const { perfil } = usePerfil()
  const esAdmin = perfil?.rol === 'admin'
  const [busqueda, setBusqueda] = useState('')

  const referenciasFiltradas = referencias.filter((r) =>
    r.marca.toLowerCase().includes(busqueda.trim().toLowerCase()),
  )

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Especificaciones</h1>
      <p className="mb-4 text-sm text-gray-500">
        Hoja de especificaciones de fruta, empaque y paletizado por referencia.
      </p>

      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar referencia..."
        className="mb-4 w-full max-w-xs rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
      />

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600">{error}</p>
        ) : referencias.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Todavía no hay referencias en el catálogo.</p>
        ) : referenciasFiltradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Ninguna referencia coincide con "{busqueda}".</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-3 font-medium">Marca</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Especificación</th>
                  <th className="py-2 pr-3 font-medium">PDF</th>
                  {esAdmin && <th className="py-2 pr-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {referenciasFiltradas.map((r) => (
                  <FilaReferencia key={r.marca} referencia={r} esAdmin={esAdmin} onChanged={refetch} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function FilaReferencia({
  referencia,
  esAdmin,
  onChanged,
}: {
  referencia: Referencia
  esAdmin: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function verPdf() {
    if (!referencia.especificacion_pdf_path) return
    setErrorMsg(null)
    try {
      const url = await urlEspecificacionPdf(referencia.especificacion_pdf_path)
      window.open(url, '_blank')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo abrir el PDF.')
    }
  }

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type !== 'application/pdf') {
      setErrorMsg('Solo se aceptan archivos PDF.')
      return
    }
    setErrorMsg(null)
    setBusy(true)
    try {
      await subirEspecificacionPdf(referencia.marca, file)
      onChanged()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo subir el PDF.')
    } finally {
      setBusy(false)
    }
  }

  async function eliminar() {
    if (!referencia.especificacion_pdf_path) return
    if (!confirm(`¿Eliminar el PDF de especificaciones de "${referencia.marca}"?`)) return
    setErrorMsg(null)
    setBusy(true)
    try {
      await eliminarEspecificacionPdf(referencia.marca, referencia.especificacion_pdf_path)
      onChanged()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar el PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-1.5 pr-3 font-medium text-gray-900">{referencia.marca}</td>
      <td className="py-1.5 pr-3">{referencia.tipo_caja}</td>
      <td className="py-1.5 pr-3">{referencia.especificacion}</td>
      <td className="py-1.5 pr-3">
        {referencia.especificacion_pdf_path ? (
          <button
            onClick={verPdf}
            className="rounded-md border border-banex-200 bg-banex-50 px-2 py-1 text-xs font-medium text-banex-700 transition-colors hover:bg-banex-100"
          >
            Ver PDF
          </button>
        ) : (
          <span className="text-xs text-gray-400">Sin PDF</span>
        )}
        {errorMsg && <p className="mt-1 text-xs text-red-600">{errorMsg}</p>}
      </td>
      {esAdmin && (
        <td className="py-1.5 pr-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={subirArchivo} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700 disabled:opacity-50"
            >
              {referencia.especificacion_pdf_path ? 'Reemplazar' : 'Subir PDF'}
            </button>
            {referencia.especificacion_pdf_path && (
              <button
                onClick={eliminar}
                disabled={busy}
                className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}
