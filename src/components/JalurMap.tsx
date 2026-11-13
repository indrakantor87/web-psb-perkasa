'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import * as L from 'leaflet'
import type { KmlIconStyle } from '@/lib/kml'

// Marker digambar sebagai CircleMarker di canvas (preferCanvas) agar ringan seperti peta ODP.
const COLOR_ODC = '#ff007f'
const COLOR_ODP = '#10b981'
const COLOR_SPLICE = '#eab308'
const COLOR_POP = '#ef4444'
const COLOR_BACKBONE = '#00ffff'
const COLOR_DISTRIBUSI = '#800080'

// Zoom threshold: layer padat (ODP, splice) hanya dirender saat cukup dekat agar
// ratusan marker tidak menumpuk dan membebani render di zoom rendah.
const DENSE_LAYER_MIN_ZOOM = 14

export type LatLngPoint = { latitude: number; longitude: number }

export type JalurRow = {
  id: number
  nama_jalur: string | null
  jenis: string
  warna: string
  path: LatLngPoint[]
  keterangan: string | null
}

export type SpliceRow = {
  id: number
  nama: string
  latitude: number
  longitude: number
  keterangan: string | null
  jalur_id: number | null
  kml_icon_style?: KmlIconStyle | null
}

type PopRow = { id: number; nama_pop: string; lokasi: string | null }
type OdcRow = { id: number; nama_odc: string; pop_id: number | null; lokasi: string | null }
type OdpRow = { id: number; nama_odp: string; wilayah: string; lokasi: string; latitude: number | null; longitude: number | null }

type DrawMode = 'none' | 'jalur' | 'splice'

const DEFAULT_CENTER: [number, number] = [-6.75, 111.03]

// Cache in-memory sisi klien: membuka ulang peta (atau pindah halaman lalu kembali)
// tidak perlu menarik ulang semua layer dari server.
const MAP_DATA_TTL = 60_000

type MapDataSnapshot = {
  jalur: JalurRow[]
  splices: SpliceRow[]
  pops: PopRow[]
  odcs: OdcRow[]
  odps: OdpRow[]
}

let mapDataCache: { at: number; data: MapDataSnapshot } | null = null

const drawPointIcon = L.divIcon({
  className: '',
  html: '<div style="width:10px;height:10px;border-radius:9999px;background:#3b82f6;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function MapFitController({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 })
      } catch {
        /* ignore */
      }
    }
  }, [bounds, map])
  return null
}

function SizeInvalidator() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(t)
  }, [map])
  return null
}

function DrawCollector({
  mode,
  onAddPoint,
  onAddSplice,
}: {
  mode: DrawMode
  onAddPoint: (p: LatLngPoint) => void
  onAddSplice: (p: LatLngPoint) => void
}) {
  useMapEvents({
    click: (e) => {
      if (mode === 'jalur') {
        onAddPoint({ latitude: e.latlng.lat, longitude: e.latlng.lng })
      } else if (mode === 'splice') {
        onAddSplice({ latitude: e.latlng.lat, longitude: e.latlng.lng })
      }
    },
  })
  return null
}

// Viewport culling: hanya marker di area layar (+margin) yang dirender, supaya ribuan titik
// tidak sekaligus menjadi ribuan node DOM.
const CULL_PADDING_RATIO = 0.25

function useVisibleBounds() {
  const map = useMap()
  const [bounds, setBounds] = useState<L.LatLngBounds>(() => map.getBounds())

  useEffect(() => {
    let frame = 0
    const update = () => {
      // moveend dan zoomend sering berpasangan; cukup satu render per frame.
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setBounds(map.getBounds()))
    }
    map.on('moveend', update)
    map.on('zoomend', update)
    map.on('resize', update)
    update()
    return () => {
      cancelAnimationFrame(frame)
      map.off('moveend', update)
      map.off('zoomend', update)
      map.off('resize', update)
    }
  }, [map])

  return bounds
}

function useZoomLevel() {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())

  useEffect(() => {
    const update = () => setZoom(map.getZoom())
    map.on('zoomend', update)
    return () => {
      map.off('zoomend', update)
    }
  }, [map])

  return zoom
}

function JalurMarkerLayer({
  odcs,
  splices,
  odps,
  canEdit,
  onDeleteSplice,
}: {
  odcs: OdcRow[]
  splices: SpliceRow[]
  odps: OdpRow[]
  canEdit: boolean
  onDeleteSplice: (id: number) => void
}) {
  const bounds = useVisibleBounds()
  const zoom = useZoomLevel()
  const showDense = zoom >= DENSE_LAYER_MIN_ZOOM

  // Saring marker yang berada di (atau dekat) viewport saat ini.
  const visible = useMemo(() => {
    const padded = bounds.pad(CULL_PADDING_RATIO)
    const sw = padded.getSouthWest()
    const ne = padded.getNorthEast()
    const inView = (lat: number, lng: number) => lat >= sw.lat && lat <= ne.lat && lng >= sw.lng && lng <= ne.lng

    return {
      odcs: odcs.filter((o) => {
        const loc = parseLoc(o.lokasi)
        return loc ? inView(loc.latitude, loc.longitude) : false
      }),
      splices: splices.filter((s) => inView(s.latitude, s.longitude)),
      odps: odps.filter(
        (o) => Number.isFinite(o.latitude) && Number.isFinite(o.longitude) && inView(o.latitude!, o.longitude!),
      ),
    }
  }, [bounds, odcs, splices, odps])

  const odcPopup = (row: OdcRow) => (
    <Popup>
      <div className="min-w-[150px] space-y-1">
        <div className="text-sm font-bold">{row.nama_odc}</div>
        <div className="text-xs text-gray-500">ODC</div>
      </div>
    </Popup>
  )

  const splicePopup = (row: SpliceRow) => (
    <Popup>
      <div className="min-w-[150px] space-y-1">
        <div className="text-sm font-bold">{row.nama}</div>
        <div className="text-xs text-gray-500">Splice</div>
        {row.keterangan && <div className="text-xs">{row.keterangan}</div>}
        {canEdit && (
          <button
            onClick={() => onDeleteSplice(row.id)}
            className="mt-1 rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
          >
            Hapus Splice
          </button>
        )}
      </div>
    </Popup>
  )

  const odpPopup = (row: OdpRow) => (
    <Popup>
      <div className="min-w-[150px] space-y-1">
        <div className="text-sm font-bold">{row.nama_odp}</div>
        <div className="text-xs text-gray-500">ODP • {row.wilayah}</div>
        <div className="text-xs break-words">{row.lokasi}</div>
      </div>
    </Popup>
  )

  // Ambil warna dari KML icon style bila ada (import KMZ), selain itu pakai default.
  const spliceColor = (s: SpliceRow) => {
    const c = s.kml_icon_style?.color
    if (c && /^#([0-9a-f]{6})$/i.test(c)) return c
    return COLOR_SPLICE
  }

  return (
    <>
      {/* ODC markers: jumlah sedikit, selalu tampil. */}
      {visible.odcs.map((o) => {
        const loc = parseLoc(o.lokasi)
        if (!loc) return null
        return (
          <CircleMarker
            key={`odc-${o.id}`}
            center={[loc.latitude, loc.longitude]}
            radius={9}
            pathOptions={{ color: COLOR_ODC, fillColor: COLOR_ODC, fillOpacity: 0.85, weight: 2 }}
          >
            {odcPopup(o)}
            <Tooltip direction="top" offset={[0, -8]} opacity={0.9} className="jalur-map-label">
              {o.nama_odc}
            </Tooltip>
          </CircleMarker>
        )
      })}

      {/* Splice markers: hanya tampil saat zoom cukup dekat. */}
      {showDense &&
        visible.splices.map((s) => (
          <CircleMarker
            key={`splice-${s.id}`}
            center={[s.latitude, s.longitude]}
            radius={6}
            pathOptions={{ color: spliceColor(s), fillColor: spliceColor(s), fillOpacity: 0.9, weight: 2 }}
          >
            {splicePopup(s)}
            <Tooltip direction="top" offset={[0, -6]} opacity={0.9} className="jalur-map-label">
              {s.nama}
            </Tooltip>
          </CircleMarker>
        ))}

      {/* ODP markers: hanya tampil saat zoom cukup dekat. */}
      {showDense &&
        visible.odps.map((o) => (
          <CircleMarker
            key={`odp-${o.id}`}
            center={[o.latitude!, o.longitude!]}
            radius={7}
            pathOptions={{ color: COLOR_ODP, fillColor: COLOR_ODP, fillOpacity: 0.85, weight: 2 }}
          >
            {odpPopup(o)}
          </CircleMarker>
        ))}
    </>
  )
}

export default function JalurMap({ canEdit, compact = false }: { canEdit: boolean; compact?: boolean }) {
  const [jalur, setJalur] = useState<JalurRow[]>([])
  const [splices, setSplices] = useState<SpliceRow[]>([])
  const [pops, setPops] = useState<PopRow[]>([])
  const [odcs, setOdcs] = useState<OdcRow[]>([])
  const [odps, setOdps] = useState<OdpRow[]>([])

  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const [drawPoints, setDrawPoints] = useState<LatLngPoint[]>([])
  const [jenisJalur, setJenisJalur] = useState<'BACKBONE' | 'DISTRIBUSI'>('DISTRIBUSI')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchAll = useCallback(async (force = false) => {
    // Pakai cache memori bila masih segar, kecuali dipaksa (setelah mutasi/import).
    if (!force && mapDataCache && Date.now() - mapDataCache.at < MAP_DATA_TTL) {
      const cached = mapDataCache.data
      setJalur(cached.jalur)
      setSplices(cached.splices)
      setPops(cached.pops)
      setOdcs(cached.odcs)
      setOdps(cached.odps)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const loadRows = async <T,>(url: string): Promise<T[]> => {
      const response = await fetch(url, { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || 'Gagal memuat data peta')
      }
      if (!Array.isArray(data)) {
        throw new Error('Format data peta tidak valid')
      }
      return data as T[]
    }

    try {
      const [jalurRes, spliceRes, popRes, odcRes, odpRes] = await Promise.allSettled([
        loadRows<JalurRow>('/api/jalur'),
        loadRows<SpliceRow>('/api/splice'),
        loadRows<PopRow>('/api/odp/pop'),
        loadRows<OdcRow>('/api/odp/odc'),
        loadRows<OdpRow>('/api/odp?all=1&map=1'),
      ])

      const jalurRows = jalurRes.status === 'fulfilled' ? jalurRes.value : null
      const spliceRows = spliceRes.status === 'fulfilled' ? spliceRes.value : null
      const popRows = popRes.status === 'fulfilled' ? popRes.value : null
      const odcRows = odcRes.status === 'fulfilled' ? odcRes.value : null
      const odpRows = odpRes.status === 'fulfilled' ? odpRes.value : null

      if (jalurRows) setJalur(jalurRows)
      if (spliceRows) setSplices(spliceRows)
      if (popRows) setPops(popRows)
      if (odcRows) setOdcs(odcRows)
      if (odpRows) setOdps(odpRows)

      if (!jalurRows || !spliceRows || !popRows || !odcRows || !odpRows) {
        const failed = [jalurRes, spliceRes, popRes, odcRes, odpRes].find((result) => result.status === 'rejected')
        throw (failed as PromiseRejectedResult | undefined)?.reason ?? new Error('Gagal memuat data peta')
      }

      mapDataCache = {
        at: Date.now(),
        data: { jalur: jalurRows, splices: spliceRows, pops: popRows, odcs: odcRows, odps: odpRows },
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const saveJalur = useCallback(async () => {
    if (drawPoints.length < 2) {
      alert('Jalur minimal 2 titik koordinat')
      return
    }
    const warna = jenisJalur === 'BACKBONE' ? COLOR_BACKBONE : COLOR_DISTRIBUSI
    try {
      const res = await fetch('/api/jalur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_jalur: null,
          jenis: jenisJalur,
          warna,
          path: drawPoints,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Gagal menyimpan jalur')
      }
      setDrawPoints([])
      setDrawMode('none')
      await fetchAll(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal menyimpan jalur')
    }
  }, [drawPoints, jenisJalur, fetchAll])

  const saveSplice = useCallback(
    async (p: LatLngPoint) => {
      const nama = prompt('Nama splice (mis. S3, S4):', 'S')
      if (!nama) return
      try {
        const res = await fetch('/api/splice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama: nama.trim(), latitude: p.latitude, longitude: p.longitude }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Gagal menyimpan splice')
        }
        setDrawMode('none')
        await fetchAll(true)
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Gagal menyimpan splice')
      }
    },
    [fetchAll],
  )

  const deleteJalur = useCallback(
    async (id: number) => {
      if (!confirm('Hapus jalur ini?')) return
      try {
        const res = await fetch(`/api/jalur/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Gagal menghapus jalur')
        await fetchAll(true)
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Gagal menghapus jalur')
      }
    },
    [fetchAll],
  )

  const deleteSplice = useCallback(
    async (id: number) => {
      if (!confirm('Hapus splice ini?')) return
      try {
        const res = await fetch(`/api/splice/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Gagal menghapus splice')
        await fetchAll(true)
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Gagal menghapus splice')
      }
    },
    [fetchAll],
  )

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await fetch('/api/jalur/import', { method: 'POST', body: formData })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Gagal import')
        alert(`Import berhasil: ${data.jalurCount} jalur, ${data.spliceCount} splice`)
        await fetchAll(true)
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Gagal import file')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [fetchAll],
  )

  const handleExport = useCallback(() => {
    window.location.href = '/api/jalur/export'
  }, [])

  // Bounds untuk auto-fit
  const allPoints = useMemo(() => {
    const pts: [number, number][] = []
    jalur.forEach((j) => j.path.forEach((p) => pts.push([p.latitude, p.longitude])))
    splices.forEach((s) => pts.push([s.latitude, s.longitude]))
    pops.forEach((p) => {
      const parsed = parseLoc(p.lokasi)
      if (parsed) pts.push([parsed.latitude, parsed.longitude])
    })
    odcs.forEach((o) => {
      const parsed = parseLoc(o.lokasi)
      if (parsed) pts.push([parsed.latitude, parsed.longitude])
    })
    odps.forEach((o) => {
      if (Number.isFinite(o.latitude) && Number.isFinite(o.longitude)) {
        pts.push([o.latitude!, o.longitude!])
      }
    })
    return pts
  }, [jalur, splices, pops, odcs, odps])

  const bounds = useMemo(() => {
    if (allPoints.length === 0) return null
    return L.latLngBounds(allPoints)
  }, [allPoints])

  const drawPositions = useMemo(() => drawPoints.map((p) => [p.latitude, p.longitude] as [number, number]), [drawPoints])
  const drawColor = jenisJalur === 'BACKBONE' ? COLOR_BACKBONE : COLOR_DISTRIBUSI

  return (
    <div className="space-y-3">
      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div>}

      {/* Toolbar */}
      <div className={`flex flex-wrap items-center gap-2 rounded-xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800 ${compact ? 'p-2' : 'p-3'}`}>
        {!compact && canEdit && (
          <>
            <button
              type="button"
              onClick={() => {
                setDrawMode(drawMode === 'jalur' ? 'none' : 'jalur')
                setDrawPoints([])
              }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                drawMode === 'jalur'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {drawMode === 'jalur' ? 'Batal Gambar' : 'Gambar Jalur'}
            </button>

            {drawMode === 'jalur' && (
              <>
                <select
                  value={jenisJalur}
                  onChange={(e) => setJenisJalur(e.target.value as 'BACKBONE' | 'DISTRIBUSI')}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="DISTRIBUSI">Distribusi (Ungu)</option>
                  <option value="BACKBONE">Backbone (Cyan)</option>
                </select>
                <button
                  type="button"
                  disabled={drawPoints.length < 2}
                  onClick={saveJalur}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Simpan ({drawPoints.length} titik)
                </button>
                <button
                  type="button"
                  onClick={() => setDrawPoints((p) => p.slice(0, -1))}
                  disabled={drawPoints.length === 0}
                  className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200"
                >
                  Undo
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setDrawMode(drawMode === 'splice' ? 'none' : 'splice')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                drawMode === 'splice'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {drawMode === 'splice' ? 'Batal Splice' : 'Tambah Splice'}
            </button>

            <label className="cursor-pointer rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
              Import KML/KMZ
              <input ref={fileInputRef} type="file" accept=".kml,.kmz" onChange={handleImport} className="hidden" />
            </label>
          </>
        )}

        {!compact && (
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
          >
            Export KML
          </button>
        )}

        <div className={`${compact ? 'ml-0' : 'ml-auto'} flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs`}>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_POP }}></span> POP</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_ODC }}></span> ODC</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_ODP }}></span> ODP</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_SPLICE }}></span> Splice</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-5" style={{ background: COLOR_BACKBONE }}></span> Backbone</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-5" style={{ background: COLOR_DISTRIBUSI }}></span> Distribusi</span>
        </div>
      </div>

      {drawMode !== 'none' && (
        <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-200">
          {drawMode === 'jalur'
            ? 'Klik pada peta untuk menambah titik jalur. Klik "Simpan" jika selesai.'
            : 'Klik pada peta untuk menambah titik splice.'}
        </div>
      )}

      {/* Map */}
      <div className={`relative ${compact ? 'h-[320px] sm:h-[400px]' : 'h-[600px]'} w-full overflow-hidden rounded-xl ring-1 ring-gray-200 dark:ring-gray-800`}>
        <MapContainer center={DEFAULT_CENTER} zoom={13} scrollWheelZoom className="h-full w-full" maxZoom={19} preferCanvas>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Street (OSM)">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
                maxNativeZoom={19}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satelit (Esri)">
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                maxNativeZoom={18}
              />
            </LayersControl.BaseLayer>
            <LayersControl.Overlay name="Label Jalan">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                maxNativeZoom={18}
              />
            </LayersControl.Overlay>
          </LayersControl>

          <MapFitController bounds={loading ? null : bounds} />
          <SizeInvalidator />
          <DrawCollector
            mode={drawMode}
            onAddPoint={(p) => setDrawPoints((prev) => [...prev, p])}
            onAddSplice={saveSplice}
          />

          {/* Jalur (polylines) */}
          {jalur.map((j) => (
            <Polyline
              key={j.id}
              positions={j.path.map((p) => [p.latitude, p.longitude] as [number, number])}
              pathOptions={{ color: j.warna, weight: 3, opacity: 0.9 }}
            >
              <Popup>
                <div className="min-w-[180px] space-y-1">
                  <div className="text-sm font-bold">{j.nama_jalur || `Jalur ${j.id}`}</div>
                  <div className="text-xs text-gray-500">{j.jenis} • {j.path.length} titik</div>
                  {j.keterangan && <div className="text-xs">{j.keterangan}</div>}
                  {canEdit && (
                    <button
                      onClick={() => deleteJalur(j.id)}
                      className="mt-1 rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                    >
                      Hapus Jalur
                    </button>
                  )}
                </div>
              </Popup>
              <Tooltip direction="center" className="jalur-map-label">
                {j.nama_jalur || `Jalur ${j.id}`}
              </Tooltip>
            </Polyline>
          ))}

          {/* Preview jalur yang sedang digambar */}
          {drawMode === 'jalur' && drawPoints.length > 0 && (
            <Polyline positions={drawPositions} pathOptions={{ color: drawColor, weight: 4, opacity: 0.7, dashArray: '6,6' }} />
          )}
          {drawMode === 'jalur' &&
            drawPoints.map((p, i) => (
              <Marker key={`draw-${i}`} position={[p.latitude, p.longitude]} icon={drawPointIcon} />
            ))}

          {/* POP markers */}
          {pops.map((p) => {
            const loc = parseLoc(p.lokasi)
            if (!loc) return null
            return (
              <CircleMarker
                key={`pop-${p.id}`}
                center={[loc.latitude, loc.longitude]}
                radius={10}
                pathOptions={{ color: COLOR_POP, fillColor: COLOR_POP, fillOpacity: 0.9, weight: 2 }}
              >
                <Popup>
                  <div className="min-w-[150px] space-y-1">
                    <div className="text-sm font-bold">{p.nama_pop}</div>
                    <div className="text-xs text-gray-500">POP</div>
                  </div>
                </Popup>
                <Tooltip
                  direction="top"
                  offset={[0, -10]}
                  opacity={0.9}
                  className="jalur-map-label"
                >
                  {p.nama_pop}
                </Tooltip>
              </CircleMarker>
            )
          })}

          <JalurMarkerLayer
            odcs={odcs}
            splices={splices}
            odps={odps}
            canEdit={canEdit}
            onDeleteSplice={deleteSplice}
          />
        </MapContainer>
        {loading && (
          <div
            role="status"
            className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-lg bg-white/90 px-3 py-2 text-xs font-medium text-gray-700 shadow dark:bg-gray-900/90 dark:text-gray-200"
          >
            Memuat data peta...
          </div>
        )}
      </div>
    </div>
  )
}

function parseLoc(loc: string | null): LatLngPoint | null {
  if (!loc) return null
  const m = loc.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { latitude: lat, longitude: lng }
}
