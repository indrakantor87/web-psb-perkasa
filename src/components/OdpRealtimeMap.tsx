'use client'

import { useEffect, useMemo, useRef } from 'react'
import { CircleMarker, LayersControl, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import type { OdpRow } from './OdpManager'

function MarkerWithRef({ r, isFocused }: { r: OdpRow; isFocused: boolean }) {
  const markerRef = useRef<L.CircleMarker>(null)

  useEffect(() => {
    if (isFocused && markerRef.current) {
      markerRef.current.openPopup()
    }
  }, [isFocused])

  const cap = Number(r.kapasitas ?? 8) || 8
  const used = Number(r.terpakai ?? 0) || 0
  const color = statusColor(cap, used)

  return (
    <CircleMarker ref={markerRef} center={[Number(r.latitude), Number(r.longitude)]} radius={isFocused ? 12 : 8} pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: isFocused ? 4 : 2 }}>
      <Popup>
        <div className="space-y-1 min-w-[150px]">
          <div className="text-sm font-bold">{r.nama_odp}</div>
          <div className="text-xs text-gray-500">{r.wilayah}</div>
          <div className="text-xs mt-2">
            <span className="font-semibold">Terpakai:</span> {used}/{cap}
          </div>
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

function MapController({ points, focusId, rows }: { points: Array<[number, number]>; focusId: number | null; rows: OdpRow[] }) {
  const map = useMap()
  
  useEffect(() => {
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
  }, [map, points, focusId, rows])

  return null
}

export default function OdpRealtimeMap({ rows, focusId }: { rows: OdpRow[]; focusId: number | null }) {
  const points = useMemo(() => rows.filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude)).map((r) => [Number(r.latitude), Number(r.longitude)] as [number, number]), [rows])
  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [-6.889, 110.905]
    const lat = points.reduce((a, b) => a + b[0], 0) / points.length
    const lng = points.reduce((a, b) => a + b[1], 0) / points.length
    return [lat, lng]
  }, [points])

  return (
    <div className="rounded-xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-800">
      <div className="h-[420px] w-full">
        <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full">
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satelit (Esri)">
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>
          <MapController points={points} focusId={focusId} rows={rows} />
          {rows
            .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
            .map((r) => (
              <MarkerWithRef key={r.id} r={r} isFocused={r.id === focusId} />
            ))}
        </MapContainer>
      </div>
    </div>
  )
}
