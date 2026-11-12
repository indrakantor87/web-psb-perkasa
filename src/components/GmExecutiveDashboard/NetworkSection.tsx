'use client'

import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import type { GmDashboardData } from './useGmDashboard'

function statusColor(kapasitas: number, terpakai: number) {
  const cap = Math.max(1, kapasitas || 8)
  const used = Math.max(0, terpakai || 0)
  const ratio = used / cap
  if (used >= cap) return '#ef4444'
  if (ratio > 0.5) return '#f59e0b'
  return '#10b981'
}

export function NetworkSection({ network }: { network: GmDashboardData['network'] }) {
  const points = network.odpMapPoints || []
  const center: [number, number] = points.length
    ? [points.reduce((a, b) => a + b.latitude, 0) / points.length, points.reduce((a, b) => a + b.longitude, 0) / points.length]
    : [-6.75, 111.05] // Pati, Jawa Tengah

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Peta & Infrastruktur Jaringan</h3>
        <span className="text-[11px] text-slate-400">Wilayah Pati</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-lg overflow-hidden border border-slate-200">
          {points.length > 0 ? (
            <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {points.map((p) => {
                const color = statusColor(p.kapasitas, p.terpakai)
                return (
                  <CircleMarker
                    key={p.id}
                    center={[p.latitude, p.longitude]}
                    radius={7}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
                  >
                    <Popup>
                      <div className="text-xs">
                        <div className="font-bold">{p.name}</div>
                        <div className="text-slate-500">{p.wilayah}</div>
                        <div>Port: {p.terpakai}/{p.kapasitas}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-400 bg-slate-50">
              Belum ada data koordinat ODP
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="ODP Aktif" value={network.odpTotal} />
            <Stat label="POP" value={network.popCount} />
            <Stat label="Kapasitas Port" value={network.portCapacity} />
            <Stat label="Port Terpakai" value={network.portUsed} />
          </div>
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500">Utilisasi Port</span>
              <span className="text-xs font-bold text-slate-700">{network.portUtilization.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, network.portUtilization)}%` }} />
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500">Availability</span>
              <span className="text-xs font-bold text-slate-700">{network.availabilityPercent.toFixed(2)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
              <div className={`h-full rounded-full ${network.availabilityPercent >= 99 ? 'bg-emerald-500' : network.availabilityPercent >= 95 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, network.availabilityPercent)}%` }} />
            </div>
            {network.lastCheckedAt && (
              <div className="text-[10px] text-slate-400 mt-1">Cek terakhir: {new Date(network.lastCheckedAt).toLocaleString('id-ID')}</div>
            )}
          </div>
          {network.byPop.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {network.byPop.map((p) => (
                <div key={p.popId} className="flex items-center justify-between text-xs">
                  <span className="truncate text-slate-600">{p.popName}</span>
                  <span className={`font-semibold ${p.currentStatus === 'UP' ? 'text-emerald-600' : p.currentStatus === 'DOWN' ? 'text-red-600' : 'text-slate-400'}`}>
                    {p.currentStatus} {p.availabilityPercent.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 border border-slate-100 text-center">
      <div className="text-lg font-bold text-slate-800">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  )
}
