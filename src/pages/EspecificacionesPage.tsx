import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useReferencias } from '../lib/useReferencias'
import { useEspecificacionesMarcas } from '../lib/useEspecificacionesMarcas'
import { usePerfil } from '../lib/usePerfil'
import {
  subirEspecificacionPdf,
  eliminarEspecificacionPdf,
  agregarEspecificacionMarca,
  eliminarEspecificacionMarca,
  urlEspecificacionPdf,
} from '../lib/especificacionesPdf'

interface FilaEspecificacion {
  marca: string
  tipo: string | null
  especificacion: string | null
  pdfPath: string | null
  esCatalogo: boolean
}

export default function EspecificacionesPage() {
  const { referencias, loading: loadingReferencias, error: errorReferencias, refetch: refetchReferencias } =
    useReferencias()
  const {
    especificaciones,
    loading: loadingExtra,
    error: errorExtra,
    refetch: refetchExtra,
  } = useEspecificacionesMarcas()
  const { perfil } = usePerfil()
  const esAdmin = perfil?.rol === 'admin'
  const [busqueda, setBusqueda] = useState('')
  const [mostrarAgregar, setMostrarAgregar] = useState(false)

  const loading = loadingReferencias || loadingExtra
  const error = errorReferencias ?? errorExtra

  const filas: FilaEspecificacion[] = [
    ...referencias.map((r) => ({
      marca: r.marca,
      tipo: r.tipo_caja,
      especificacion: r.especificacion,
      pdfPath: r.especificacion_pdf_path,
      esCatalogo: true,
    })),
    ...especificaciones.map((e) => ({
      marca: e.marca,
      tipo: null,
      especificacion: null,
      pdfPath: e.pdf_path,
      esCatalogo: false,
    })),
  ].sort((a, b) => a.marca.localeCompare(b.marca))

  const filasFiltradas = filas.filter((f) => f.marca.toLowerCase().includes(busqueda.trim().toLowerCase()))

  function marcaYaExiste(marca: string) {
    const m = marca.toUpperCase()
    return referencias.some((r) => r.marca.toUpperCase() === m) || especificaciones.some((e) => e.marca.toUpperCase() === m)
  }

  async function onChanged() {
    await Promise.all([refetchReferencias(), refetchExtra()])
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-banex-900 sm:text-2xl">Especificaciones</h1>
      <p className="mb-4 text-sm text-gray-500">
        Hoja de especificaciones de fruta, empaque y paletizado por referencia.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar referencia..."
          className="w-full max-w-xs rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
        />
        {esAdmin && (
          <button
            onClick={() => setMostrarAgregar((v) => !v)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-banex-300 hover:bg-banex-50 hover:text-banex-700"
          >
            {mostrarAgregar ? 'Cancelar' : '+ Agregar marca sin referencia'}
          </button>
        )}
      </div>

      {mostrarAgregar && esAdmin && (
        <AgregarMarcaForm
          marcaYaExiste={marcaYaExiste}
          onAgregado={async () => {
            await onChanged()
            setMostrarAgregar(false)
          }}
        />
      )}

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Cargando...</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600">{error}</p>
        ) : filas.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Todavía no hay especificaciones registradas.</p>
        ) : filasFiltradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Ninguna marca coincide con "{busqueda}".</p>
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
                {filasFiltradas.map((f) =>
                  f.esCatalogo ? (
                    <FilaEspecificacionRow
                      key={f.marca}
                      marca={f.marca}
                      tipo={f.tipo}
                      especificacion={f.especificacion}
                      pdfPath={f.pdfPath}
                      esAdmin={esAdmin}
                      onSubir={(marca, file) => subirEspecificacionPdf(marca, file)}
                      onEliminar={(marca, ruta) => eliminarEspecificacionPdf(marca, ruta)}
                      onChanged={onChanged}
                    />
                  ) : (
                    <FilaEspecificacionRow
                      key={f.marca}
                      marca={f.marca}
                      tipo={f.tipo}
                      especificacion={f.especificacion}
                      pdfPath={f.pdfPath}
                      esAdmin={esAdmin}
                      onSubir={(marca, file) => agregarEspecificacionMarca(marca, file)}
                      onEliminar={(marca, ruta) => eliminarEspecificacionMarca(marca, ruta)}
                      onChanged={onChanged}
                      eliminaFilaCompleta
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function AgregarMarcaForm({
  marcaYaExiste,
  onAgregado,
}: {
  marcaYaExiste: (marca: string) => boolean
  onAgregado: () => void
}) {
  const [marca, setMarca] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    const marcaLimpia = marca.trim().toUpperCase()
    if (!marcaLimpia) {
      setErrorMsg('Escribe el nombre de la marca.')
      return
    }
    if (marcaYaExiste(marcaLimpia)) {
      setErrorMsg(`"${marcaLimpia}" ya tiene una especificación o es una referencia del catálogo.`)
      return
    }
    if (!archivo) {
      setErrorMsg('Selecciona el archivo PDF.')
      return
    }
    if (archivo.type !== 'application/pdf') {
      setErrorMsg('Solo se aceptan archivos PDF.')
      return
    }

    setGuardando(true)
    try {
      await agregarEspecificacionMarca(marcaLimpia, archivo)
      onAgregado()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar la especificación.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-gray-100 bg-white shadow-sm p-4">
      <p className="mb-3 text-sm text-gray-500">
        Para marcas que aún no están registradas como referencia de producción — útil cuando la especificación
        cambia de versión sin que cambie la referencia.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Marca</span>
          <input
            type="text"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            placeholder="Ej. CLSMLRA"
            className="w-48 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-banex-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-banex-500/20"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Archivo PDF</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="block text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-banex-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-banex-700 hover:file:bg-banex-100"
          />
        </label>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-banex-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-banex-700 hover:shadow-md disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
      {errorMsg && <p className="mt-2 text-sm text-red-600">{errorMsg}</p>}
    </form>
  )
}

function FilaEspecificacionRow({
  marca,
  tipo,
  especificacion,
  pdfPath,
  esAdmin,
  onSubir,
  onEliminar,
  onChanged,
  eliminaFilaCompleta = false,
}: {
  marca: string
  tipo: string | null
  especificacion: string | null
  pdfPath: string | null
  esAdmin: boolean
  onSubir: (marca: string, file: File) => Promise<string>
  onEliminar: (marca: string, ruta: string) => Promise<void>
  onChanged: () => void
  eliminaFilaCompleta?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function verPdf() {
    if (!pdfPath) return
    setErrorMsg(null)
    try {
      const url = await urlEspecificacionPdf(pdfPath)
      window.open(url, '_blank')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo abrir el PDF.')
    }
  }

  async function subirArchivo(e: ChangeEvent<HTMLInputElement>) {
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
      await onSubir(marca, file)
      onChanged()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo subir el PDF.')
    } finally {
      setBusy(false)
    }
  }

  async function eliminar() {
    if (!pdfPath) return
    const mensaje = eliminaFilaCompleta
      ? `¿Eliminar la especificación de "${marca}"? Esto quita la marca de esta lista.`
      : `¿Eliminar el PDF de especificaciones de "${marca}"?`
    if (!confirm(mensaje)) return
    setErrorMsg(null)
    setBusy(true)
    try {
      await onEliminar(marca, pdfPath)
      onChanged()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo eliminar el PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="py-1.5 pr-3 font-medium text-gray-900">{marca}</td>
      <td className="py-1.5 pr-3">{tipo ?? '—'}</td>
      <td className="py-1.5 pr-3">{especificacion ?? '—'}</td>
      <td className="py-1.5 pr-3">
        {pdfPath ? (
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
              {pdfPath ? 'Reemplazar' : 'Subir PDF'}
            </button>
            {pdfPath && (
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
