'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import * as L from 'leaflet'

export type LatLngPoint = { latitude: number; longitude: number }

export type JalurRow = {
  id: number
  nama_jalur: string | null
  jenis: string
  warna: string
  path: LatLngPoint[]
  pop_id: number | null
  odc_id: number | null
  keterangan: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  splices?: SpliceRow[]
}

export type SpliceRow = {
  id: number
  nama: string
  latitude: number
  longitude: number
  keterangan: string | null
  jalur_id: number | null
  created_at: string
  updated_at: string
}

type PopRow = { id: number; nama_pop: string; lokasi: string | null }
type OdcRow = { id: number; nama_odc: string; pop_id: number | null; lokasi: string | null }
type OdpRow = { id: number; nama_odp: string; wilayah: string; lokasi: string; latitude: number | null; longitude: number | null }

type DrawMode = 'none' | 'jalur' | 'splice'

const DEFAULT_CENTER: [number, number] = [-6.75, 111.03]

// Warna default per jenis
const COLOR_BACKBONE = '#00ffff' // cyan
const COLOR_DISTRIBUSI = '#800080' // ungu
const COLOR_POP = '#ef4444' // merah
const COLOR_ODC = '#d93025' // merah Google Earth
const COLOR_ODP = '#34a853' // hijau Google Earth
const COLOR_SPLICE = '#facc15' // kuning

function makePinIcon(color: string): L.DivIcon {
  const html = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38" aria-hidden="true">
      <path d="M15 1.5C7.7 1.5 2 7.2 2 14.3c0 9.1 13 21.8 13 21.8s13-12.7 13-21.8C28 7.2 22.3 1.5 15 1.5Z" fill="${color}" stroke="#fff" stroke-width="2.5" />
      <circle cx="15" cy="14" r="4.5" fill="#fff" fill-opacity=".9" />
    </svg>`
  return L.divIcon({
    className: '',
    html,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    popupAnchor: [0, -34],
  })
}

function makeStarIcon(color: string): L.DivIcon {
  const html = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <path d="m14 2.2 3.5 7.2 7.9 1.1-5.7 5.6 1.4 7.9-7.1-3.7-7.1 3.7 1.4-7.9-5.7-5.6 7.9-1.1Z" fill="${color}" stroke="#3f3a20" stroke-width="1.8" stroke-linejoin="round" />
    </svg>`
  return L.divIcon({
    className: '',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  })
}

const odcPinIcon = makePinIcon(COLOR_ODC)
const odpPinIcon = makePinIcon(COLOR_ODP)
const spliceStarIcon = makeStarIcon(COLOR_SPLICE)

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

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [jRes, sRes, popRes, odcRes, odpRes] = await Promise.all([
        fetch('/api/jalur', { cache: 'no-store' }),
        fetch('/api/splice', { cache: 'no-store' }),
        fetch('/api/odp/pop', { cache: 'no-store' }),
        fetch('/api/odp/odc', { cache: 'no-store' }),
        fetch('/api/odp?all=1&map=1', { cache: 'no-store' }),
      ])
      const [jData, sData, popData, odcData, odpData] = await Promise.all([
        jRes.json().catch(() => []),
        sRes.json().catch(() => []),
        popRes.json().catch(() => []),
        odcRes.json().catch(() => []),
        odpRes.json().catch(() => []),
      ])
      if (Array.isArray(jData)) setJalur(jData)
      if (Array.isArray(sData)) setSplices(sData)
      if (Array.isArray(popData)) setPops(popData)
      if (Array.isArray(odcData)) setOdcs(odcData)
      if (Array.isArray(odpData)) setOdps(odpData)
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
      await fetchAll()
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
        await fetchAll()
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
        await fetchAll()
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
        await fetchAll()
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
        await fetchAll()
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

  if (loading) {
    return <div className={`flex ${compact ? 'h-[320px] sm:h-[400px]' : 'h-[600px]'} items-center justify-center text-gray-500`}>Memuat peta jalur...</div>
  }

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
          <span className="flex items-center gap-1">
            <svg className="h-4 w-3" viewBox="0 0 30 38" aria-hidden="true"><path d="M15 1.5C7.7 1.5 2 7.2 2 14.3c0 9.1 13 21.8 13 21.8s13-12.7 13-21.8C28 7.2 22.3 1.5 15 1.5Z" fill={COLOR_ODC} stroke="white" strokeWidth="2.5" /><circle cx="15" cy="14" r="4.5" fill="white" /></svg>
            ODC
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-4 w-3" viewBox="0 0 30 38" aria-hidden="true"><path d="M15 1.5C7.7 1.5 2 7.2 2 14.3c0 9.1 13 21.8 13 21.8s13-12.7 13-21.8C28 7.2 22.3 1.5 15 1.5Z" fill={COLOR_ODP} stroke="white" strokeWidth="2.5" /><circle cx="15" cy="14" r="4.5" fill="white" /></svg>
            ODP
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-4 w-4" viewBox="0 0 28 28" aria-hidden="true"><path d="m14 2.2 3.5 7.2 7.9 1.1-5.7 5.6 1.4 7.9-7.1-3.7-7.1 3.7 1.4-7.9-5.7-5.6 7.9-1.1Z" fill={COLOR_SPLICE} stroke="#3f3a20" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            Splice
          </span>
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
      <div className={`${compact ? 'h-[320px] sm:h-[400px]' : 'h-[600px]'} w-full overflow-hidden rounded-xl ring-1 ring-gray-200 dark:ring-gray-800`}>
        <MapContainer center={DEFAULT_CENTER} zoom={13} scrollWheelZoom className="h-full w-full" maxZoom={19} preferCanvas>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Satelit (Esri)">
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                maxNativeZoom={18}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Street (OSM)">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
                maxNativeZoom={19}
              />
            </LayersControl.BaseLayer>
            <LayersControl.Overlay checked name="Label Jalan">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                maxNativeZoom={18}
              />
            </LayersControl.Overlay>
          </LayersControl>

          <MapFitController bounds={bounds} />
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
                <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>{p.nama_pop}</Tooltip>
              </CircleMarker>
            )
          })}

          {/* ODC markers */}
          {odcs.map((o) => {
            const loc = parseLoc(o.lokasi)
            if (!loc) return null
            return (
              <Marker
                key={`odc-${o.id}`}
                position={[loc.latitude, loc.longitude]}
                icon={odcPinIcon}
              >
                <Popup>
                  <div className="min-w-[150px] space-y-1">
                    <div className="text-sm font-bold">{o.nama_odc}</div>
                    <div className="text-xs text-gray-500">ODC</div>
                  </div>
                </Popup>
                <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>{o.nama_odc}</Tooltip>
              </Marker>
            )
          })}

          {/* Splice markers */}
          {splices.map((s) => (
            <Marker
              key={`splice-${s.id}`}
              position={[s.latitude, s.longitude]}
              icon={spliceStarIcon}
            >
              <Popup>
                <div className="min-w-[150px] space-y-1">
                  <div className="text-sm font-bold">{s.nama}</div>
                  <div className="text-xs text-gray-500">Splice</div>
                  {s.keterangan && <div className="text-xs">{s.keterangan}</div>}
                  {canEdit && (
                    <button
                      onClick={() => deleteSplice(s.id)}
                      className="mt-1 rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                    >
                      Hapus Splice
                    </button>
                  )}
                </div>
              </Popup>
              <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>{s.nama}</Tooltip>
            </Marker>
          ))}

          {/* ODP markers */}
          {odps
            .filter((o) => Number.isFinite(o.latitude) && Number.isFinite(o.longitude))
            .map((o) => (
              <Marker
                key={`odp-${o.id}`}
                position={[o.latitude!, o.longitude!]}
                icon={odpPinIcon}
              >
                <Popup>
                  <div className="min-w-[150px] space-y-1">
                    <div className="text-sm font-bold">{o.nama_odp}</div>
                    <div className="text-xs text-gray-500">ODP • {o.wilayah}</div>
                    <div className="text-xs break-words">{o.lokasi}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
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
