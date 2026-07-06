'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import NextImage from 'next/image'

type TroubleTicketDetail = {
  id: number
  ticketCode: string | null
  customerName: string
  waNumber: string
  mapsUrl: string | null
  type?: string | null
  notes: string | null
  problemCategory?: string | null
  resolutionAction?: string | null
  resolutionActions?: string[] | null
  status: string
}

const DEFAULT_RESOLUTION_ACTIONS = [
  'GANTI ADAPTOR',
  'GANTI MODEM/ONT',
  'GANTI ROUTER',
  'GESER PERANGKAT',
  'RESET/REKONFIGURASI',
  'RE-TERMINASI KABEL',
  'GANTI PATCHCORD',
  'CLEANING KONEKTOR',
  'PINDAH PORT ODP',
  'PERBAIKI DROPCORE',
  'SPLICING ULANG',
  'LAINNYA',
] as const

function formatTypeLabel(type: unknown) {
  const t = String(type ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
  if (!t) return '-'
  return t
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function normalizeWaNumber(input: string) {
  const digits = (input || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  return digits
}

function compressImage(file: File) {
  return new Promise<File>((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new window.Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        const maxSide = 1600
        if (width > height) {
          if (width > maxSide) {
            height = Math.round(height * (maxSide / width))
            width = maxSide
          }
        } else {
          if (height > maxSide) {
            width = Math.round(width * (maxSide / height))
            height = maxSide
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        const tryQuality = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file)
                return
              }

              const targetBytes = 600 * 1024
              if (blob.size <= targetBytes || quality <= 0.4) {
                const out = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                })
                resolve(out)
                return
              }
              tryQuality(Math.max(0.4, quality - 0.1))
            },
            'image/jpeg',
            quality
          )
        }

        tryQuality(0.8)
      }
      img.onerror = () => resolve(file)
    }
    reader.onerror = () => resolve(file)
  })
}

export function TroubleTicketCloseForm({ ticketId }: { ticketId: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState<TroubleTicketDetail | null>(null)
  const [closeNotes, setCloseNotes] = useState('')
  const [resolutionActions, setResolutionActions] = useState<string[]>([])
  const [resolutionOptions, setResolutionOptions] = useState<string[]>([...DEFAULT_RESOLUTION_ACTIONS])
  const [actionQuery, setActionQuery] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const filePreviews = useMemo(
    () =>
      files.map((file, index) => ({
        key: `${file.name}-${index}-${file.lastModified}`,
        url: URL.createObjectURL(file),
        name: file.name,
      })),
    [files]
  )

  useEffect(() => {
    return () => {
      for (const preview of filePreviews) {
        URL.revokeObjectURL(preview.url)
      }
    }
  }, [filePreviews])

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/trouble-tickets/${ticketId}`, { signal: controller.signal })
        const data = (await res.json().catch(() => ({}))) as unknown
        if (!res.ok) {
          const msg = (data as { error?: string })?.error || 'Gagal memuat ticket'
          throw new Error(msg)
        }
        const row = data as TroubleTicketDetail
        setTicket(row)
        setCloseNotes('')
        const fromArray = Array.isArray(row.resolutionActions)
          ? row.resolutionActions.map((x) => String(x ?? '').trim()).filter(Boolean)
          : []
        const fromSingle = String(row.resolutionAction ?? '').trim()
        setResolutionActions(fromArray.length ? fromArray : (fromSingle ? [fromSingle] : []))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [ticketId])

  useEffect(() => {
    const controller = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/trouble-tickets/master?kind=RESOLUTION_ACTION', { signal: controller.signal })
        const data = (await res.json().catch(() => ({}))) as unknown
        if (!res.ok) return
        const rows = Array.isArray(data) ? (data as Array<{ value?: unknown }>) : []
        const values = rows
          .map((r) => String(r?.value ?? '').trim())
          .filter(Boolean)
        if (values.length) setResolutionOptions(values)
      } catch {}
    })()
    return () => controller.abort()
  }, [])

  const wa = useMemo(() => (ticket ? normalizeWaNumber(ticket.waNumber) : ''), [ticket])
  const filteredResolutionOptions = useMemo(() => {
    const q = actionQuery.trim().toLowerCase()
    const isLainnya = (x: string) => String(x ?? '').trim().toUpperCase() === 'LAINNYA'
    const base = q
      ? resolutionOptions.filter((x) => {
          const raw = String(x ?? '').trim().toLowerCase()
          const label = formatTypeLabel(x).trim().toLowerCase()
          return raw.includes(q) || label.includes(q)
        })
      : resolutionOptions
    const others = base.filter(isLainnya)
    const rest = base.filter((x) => !isLainnya(x))
    return [...rest, ...others]
  }, [actionQuery, resolutionOptions])

  const handleFileChange = async (picked: FileList | null) => {
    if (!picked) return
    setError('')

    const incoming = Array.from(picked)
    const combined = [...files, ...incoming]
    if (combined.length > 10) {
      setError('Maksimal 10 foto')
      return
    }

    for (const f of incoming) {
      if (f.size > 10 * 1024 * 1024) {
        setError('Ukuran foto maksimal 10MB')
        return
      }
    }

    setSaving(true)
    try {
      const compressed = await Promise.all(incoming.map((f) => compressImage(f)))
      setFiles((prev) => [...prev, ...compressed].slice(0, 10))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const removeFileAt = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (saving) return
    const pickedActions = resolutionActions.map((x) => String(x ?? '').trim()).filter(Boolean)
    if (pickedActions.length === 0) {
      setError('Tindakan wajib dipilih minimal 1')
      return
    }
    if (!closeNotes.trim()) {
      setError('Penanganan wajib diisi')
      return
    }
    if (files.length === 0) {
      setError('Upload minimal 1 foto penanganan')
      return
    }
    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      formData.set('closeNotes', closeNotes.trim())
      pickedActions.forEach((a) => formData.append('resolutionActions', a))
      files.forEach((f) => formData.append('photos', f))

      const res = await fetch(`/api/trouble-tickets/${ticketId}/close`, {
        method: 'POST',
        body: formData,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Gagal close ticket')
      router.push('/trouble-ticket')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="rounded-lg bg-black text-white px-4 py-6 text-center text-sm">Memuat...</div>
  }

  if (!ticket) {
    return <div className="rounded-lg bg-black text-white px-4 py-6 text-center text-sm">{error || 'Ticket tidak ditemukan'}</div>
  }

  return (
    <div className="relative rounded-lg bg-black text-white border border-gray-800 p-4">
      <div className="space-y-4 pb-28">
        <div className="text-lg font-bold">Close Ticket</div>

        {error && (
          <div className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-md bg-gray-900 px-3 py-2">
            <div className="text-xs text-gray-400">Nama Pelanggan</div>
            <div className="font-semibold">{ticket.customerName}</div>
          </div>
          <div className="rounded-md bg-gray-900 px-3 py-2">
            <div className="text-xs text-gray-400">No Ticket</div>
            <div className="font-semibold">{ticket.ticketCode || ticket.id}</div>
          </div>
          <div className="rounded-md bg-gray-900 px-3 py-2">
            <div className="text-xs text-gray-400">No WA</div>
            {wa ? (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noreferrer"
                className="break-words font-semibold text-blue-300 hover:underline"
              >
                {ticket.waNumber}
              </a>
            ) : (
              <div className="break-words font-semibold">{ticket.waNumber || '-'}</div>
            )}
          </div>
          <div className="rounded-md bg-gray-900 px-3 py-2">
            <div className="text-xs text-gray-400">Keterangan Ticket</div>
            <div className="break-words font-semibold">{formatTypeLabel(ticket.type)}</div>
            <div className="mt-1 break-words text-sm text-gray-200">{(ticket.notes || '').trim() || '-'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-md bg-gray-900 px-3 py-2">
            <div className="text-xs text-gray-400">Jenis Gangguan</div>
            <div className="break-words font-semibold">{(String(ticket.problemCategory ?? '').trim() || '-')}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold">Tindakan</div>
            <input
              value={actionQuery}
              onChange={(e) => setActionQuery(e.target.value)}
              disabled={saving}
              placeholder="Cari tindakan..."
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
            />
            <div className="max-h-56 overflow-y-auto rounded-md border border-gray-700 bg-gray-900 px-3 py-2">
              {filteredResolutionOptions.length === 0 ? (
                <div className="py-2 text-sm text-gray-400">Tidak ada data</div>
              ) : (
                <div className="space-y-2">
                  {filteredResolutionOptions.map((x) => {
                    const checked = resolutionActions.includes(x)
                    return (
                      <label key={x} className="flex items-center gap-2 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? Array.from(new Set([...resolutionActions, x]))
                              : resolutionActions.filter((v) => v !== x)
                            setResolutionActions(next)
                          }}
                        />
                        <span>{formatTypeLabel(x)}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="text-[11px] text-gray-400">
              {resolutionActions.length ? `Dipilih: ${resolutionActions.map((x) => formatTypeLabel(x)).join(', ')}` : 'Belum ada tindakan dipilih'}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Penanganan</div>
          <textarea
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
            className="w-full min-h-[120px] rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
            placeholder="Isi penanganan yang dilakukan di lokasi..."
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Upload Foto (maks 10, max 10MB / foto)</div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileChange(e.target.files)}
            disabled={saving}
            className="block w-full text-sm text-gray-200 file:mr-3 file:rounded-md file:border-0 file:bg-gray-200 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-900"
          />
          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {filePreviews.map((preview, idx) => {
                return (
                  <div key={preview.key} className="rounded-md bg-gray-900 border border-gray-800 overflow-hidden">
                    <NextImage
                      src={preview.url}
                      alt={preview.name}
                      width={400}
                      height={200}
                      unoptimized
                      className="h-24 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFileAt(idx)}
                      className="w-full px-2 py-2 text-xs font-semibold text-red-200 hover:bg-red-950"
                    >
                      Hapus
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className="sticky bottom-0 -mx-4 mt-4 border-t border-gray-800 bg-gray-950 px-4 py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex flex-col gap-2 md:flex-row md:justify-end">
          <button
            type="button"
            onClick={() => router.push('/trouble-ticket')}
            disabled={saving}
            className="rounded-md border border-gray-600 bg-gray-200 text-gray-900 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={clsx(
              'rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50',
              saving ? 'bg-gray-500' : 'bg-green-600 hover:bg-green-700'
            )}
          >
            {saving ? 'Menyimpan...' : 'Simpan Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
