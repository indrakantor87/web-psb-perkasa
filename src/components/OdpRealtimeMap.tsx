'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, LayersControl, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import * as L from 'leaflet'
import type { OdpRow } from './OdpManager'

function toRad(v: number) {
  return (v * Math.PI) / 180
}

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const sa = Math.sin(dLat / 2)
  const sb = Math.sin(dLng / 2)
  const h = sa * sa + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sb * sb
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

type LatLngPoint = { latitude: number; longitude: number }

function MarkerWithRef({
  r,
  isFocused,
  searchPoint,
  routeEnabled,
  onMeasure,
}: {
  r: OdpRow
  isFocused: boolean
  searchPoint: { latitude: number; longitude: number } | null
  routeEnabled: boolean
  onMeasure: (id: number) => void
}) {
  const markerRef = useRef<L.CircleMarker>(null)

  useEffect(() => {
    if (isFocused && markerRef.current) {
      markerRef.current.openPopup()
    }
  }, [isFocused])

  const cap = Number(r.kapasitas ?? 8) || 8
  const used = Number(r.terpakai ?? 0) || 0
  const color = statusColor(cap, used)
  const d =
    routeEnabled && searchPoint && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
      ? distanceM(Number(searchPoint.latitude), Number(searchPoint.longitude), Number(r.latitude), Number(r.longitude))
      : null

  return (
    <CircleMarker
      ref={markerRef}
      center={[Number(r.latitude), Number(r.longitude)]}
      radius={isFocused ? 12 : 8}
      pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: isFocused ? 4 : 2 }}
      eventHandlers={{
        click: () => {
          if (routeEnabled) onMeasure(r.id)
        },
      }}
    >
      <Popup>
        <div className="space-y-1 min-w-[150px]">
          <div className="text-sm font-bold">{r.nama_odp}</div>
          <div className="text-xs text-gray-500">{r.wilayah}</div>
          <div className="text-xs mt-2">
            <span className="font-semibold">Terpakai:</span> {used}/{cap}
          </div>
          {d !== null && (
            <div className="text-xs">
              <span className="font-semibold">Jarak ke tujuan:</span> {Math.round(d)} m
            </div>
          )}
          <div className="text-xs break-words">{r.lokasi}</div>
          <div className="text-[10px] text-gray-400 mt-1">
            {r.latitude}, {r.longitude}
          </div>
        </div>
      </Popup>
    </CircleMarker>
  )
}

function statusColor(kapasitas: number, terpakai: number) {
  const cap = Math.max(1, Number(kapasitas) || 8)
  const used = Math.max(0, Number(terpakai) || 0)
  const ratio = used / cap
  if (used >= cap) return '#ef4444'
  if (ratio > 0.5) return '#f59e0b'
  return '#10b981'
}

function MapController({
  points,
  focusId,
  rows,
  searchPoint,
}: {
  points: Array<[number, number]>
  focusId: number | null
  rows: OdpRow[]
  searchPoint: { latitude: number; longitude: number } | null
}) {
  const map = useMap()
  
  useEffect(() => {
    if (searchPoint && Number.isFinite(searchPoint.latitude) && Number.isFinite(searchPoint.longitude)) {
      map.flyTo([Number(searchPoint.latitude), Number(searchPoint.longitude)], 16, { duration: 1.2 })
      return
    }
    if (focusId) {
      const target = rows.find(r => r.id === focusId)
      if (target && Number.isFinite(target.latitude) && Number.isFinite(target.longitude)) {
        map.flyTo([Number(target.latitude), Number(target.longitude)], 18, { duration: 1.5 })
        return
      }
    }
    
    if (points.length === 0) return
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [map, points, focusId, rows, searchPoint])

  return null
}

function SizeInvalidator({ invalidateKey }: { invalidateKey: string }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize()
    }, 50)
    return () => clearTimeout(t)
  }, [invalidateKey, map])
  return null
}

function RouteCollector({
  enabled,
  onAddPoint,
}: {
  enabled: boolean
  onAddPoint: (p: LatLngPoint) => void
}) {
  useMapEvents({
    click: (e) => {
      if (!enabled) return
      onAddPoint({ latitude: e.latlng.lat, longitude: e.latlng.lng })
    },
  })
  return null
}

const routePointIcon = L.divIcon({
  className: '',
  html: '<div style="width:10px;height:10px;border-radius:9999px;background:#3b82f6;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

export default function OdpRealtimeMap({
  rows,
  focusId,
  searchPoint,
  heightClass = 'h-[420px]',
  invalidateKey = 'default',
}: {
  rows: OdpRow[]
  focusId: number | null
  searchPoint: { latitude: number; longitude: number } | null
  heightClass?: string
  invalidateKey?: string
}) {
  const [measureId, setMeasureId] = useState<number | null>(null)
  const [routeEnabled, setRouteEnabled] = useState(false)
  const [routePoints, setRoutePoints] = useState<LatLngPoint[]>([])
  const points = useMemo(() => rows.filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude)).map((r) => [Number(r.latitude), Number(r.longitude)] as [number, number]), [rows])
  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [-6.889, 110.905]
    const lat = points.reduce((a, b) => a + b[0], 0) / points.length
    const lng = points.reduce((a, b) => a + b[1], 0) / points.length
    return [lat, lng]
  }, [points])

  const measured = useMemo(() => {
    if (!measureId) return null
    const r = rows.find((x) => x.id === measureId) || null
    if (!r) return null
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return null
    return r
  }, [measureId, rows])

  const routePositions = useMemo(() => {
    if (!routeEnabled || !measured || !searchPoint) return null
    const start: [number, number] = [Number(measured.latitude), Number(measured.longitude)]
    const end: [number, number] = [Number(searchPoint.latitude), Number(searchPoint.longitude)]
    const mid = routePoints.map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number])
    return [start, ...mid, end]
  }, [measured, routeEnabled, routePoints, searchPoint])

  const routeDistance = useMemo(() => {
    if (!routePositions) return null
    let total = 0
    for (let i = 1; i < routePositions.length; i++) {
      const a = routePositions[i - 1]
      const b = routePositions[i]
      total += distanceM(a[0], a[1], b[0], b[1])
    }
    return total
  }, [routePositions])

  const canRouteMeasure = routeEnabled && !!measured && !!searchPoint

  const removeRoutePointAt = (idx: number) => {
    setRoutePoints((prev) => prev.filter((_, i) => i !== idx))
  }

  const moveRoutePointAt = (idx: number, p: LatLngPoint) => {
    setRoutePoints((prev) => prev.map((x, i) => (i === idx ? p : x)))
  }

  return (
    <div className="relative rounded-xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-800">
      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-3 rounded-xl bg-white/95 px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900/95 dark:text-gray-100 dark:ring-gray-800 md:bottom-auto md:left-14 md:right-auto md:top-3 md:gap-2 md:rounded-lg md:px-2 md:py-1 md:text-xs">
        <button
          type="button"
          onClick={() => setRouteEnabled((v) => !v)}
          className="rounded px-3 py-2 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 md:px-2 md:py-1"
        >
          {routeEnabled ? 'Mode Rute: ON' : 'Mode Rute: OFF'}
        </button>
        <button
          type="button"
          disabled={!routeEnabled || routePoints.length === 0}
          onClick={() => setRoutePoints((prev) => prev.slice(0, -1))}
          className="rounded px-3 py-2 font-semibold hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-800 md:px-2 md:py-1"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!routeEnabled || routePoints.length === 0}
          onClick={() => setRoutePoints([])}
          className="rounded px-3 py-2 font-semibold hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-800 md:px-2 md:py-1"
        >
          Reset
        </button>
        <div className="ml-1 rounded-lg bg-blue-50 px-3 py-2 text-[14px] font-bold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:ring-blue-900/40 md:rounded md:px-2 md:py-1 md:text-[12px]">
          Jarak: {routeDistance !== null ? `${Math.round(routeDistance)} m` : '-'}
        </div>
        {routeEnabled && !measured && (
          <div className="text-[12px] font-medium text-gray-600 dark:text-gray-300 md:text-[11px]">
            Klik ODP untuk mulai ukur
          </div>
        )}
      </div>
      <div className={`${heightClass} w-full`}>
        <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full" maxZoom={22}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                detectRetina
                maxZoom={23}
                maxNativeZoom={19}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satelit (Esri)">
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                detectRetina
                maxZoom={23}
                maxNativeZoom={19}
              />
            </LayersControl.BaseLayer>
          </LayersControl>
          <MapController points={points} focusId={focusId} rows={rows} searchPoint={searchPoint} />
          <SizeInvalidator invalidateKey={invalidateKey} />
          <RouteCollector
            enabled={canRouteMeasure}
            onAddPoint={(p) => {
              setRoutePoints((prev) => [...prev, p])
            }}
          />
          {searchPoint && Number.isFinite(searchPoint.latitude) && Number.isFinite(searchPoint.longitude) && (
            <CircleMarker
              center={[Number(searchPoint.latitude), Number(searchPoint.longitude)]}
              radius={10}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.35, weight: 3 }}
            >
              <Popup>
                <div className="space-y-1 min-w-[150px]">
                  <div className="text-sm font-bold">Lokasi Pencarian</div>
                  <div className="text-[10px] text-gray-500">
                    {Number(searchPoint.latitude).toFixed(6)}, {Number(searchPoint.longitude).toFixed(6)}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )}
          {routePositions && (
            <Polyline
              positions={routePositions}
              pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.9 }}
            >
              {routeDistance !== null && (
                <Tooltip direction="top" sticky opacity={0.95}>
                  {Math.round(routeDistance)} m
                </Tooltip>
              )}
            </Polyline>
          )}
          {canRouteMeasure &&
            routePoints.map((p, idx) => (
              <Marker
                key={`${idx}-${p.latitude}-${p.longitude}`}
                position={[Number(p.latitude), Number(p.longitude)]}
                draggable
                icon={routePointIcon}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target as unknown as { getLatLng: () => { lat: number; lng: number } }
                    const ll = marker.getLatLng()
                    moveRoutePointAt(idx, { latitude: ll.lat, longitude: ll.lng })
                  },
                  contextmenu: () => removeRoutePointAt(idx),
                }}
              />
            ))}
          {rows
            .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
            .map((r) => (
              <MarkerWithRef
                key={r.id}
                r={r}
                isFocused={r.id === focusId}
                searchPoint={searchPoint}
                routeEnabled={routeEnabled}
                onMeasure={(id) => {
                  setMeasureId(id)
                  if (routeEnabled) setRoutePoints([])
                }}
              />
            ))}
        </MapContainer>
      </div>
    </div>
  )
}
