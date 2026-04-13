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
                reject(new Error('Canvas to Blob failed'))
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
      img.onerror = (error: unknown) => reject(error)
    }
    reader.onerror = (error: unknown) => reject(error)
  })
}

export function TroubleTicketCloseForm({ ticketId }: { ticketId: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState<TroubleTicketDetail | null>(null)
  const [closeNotes, setCloseNotes] = useState('')
  const [resolutionAction, setResolutionAction] = useState('')
  const [resolutionOptions, setResolutionOptions] = useState<string[]>([...DEFAULT_RESOLUTION_ACTIONS])
  const [files, setFiles] = useState<File[]>([])

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
        setResolutionAction(String(row.resolutionAction ?? '').trim())
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
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(f.type)) {
        setError('Format foto harus .jpg, .jpeg, .png, atau .webp')
        return
      }
      if (f.size > 10 * 1024 * 1024) {
        setError('Ukuran foto maksimal 10MB')
        return
      }
    }

    setSaving(true)
    try {
      const compressed: File[] = []
      for (const f of incoming) {
        compressed.push(await compressImage(f))
      }
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
    if (!resolutionAction.trim()) {
      setError('Tindakan wajib dipilih')
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
      formData.set('resolutionAction', resolutionAction.trim())
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
    <div className="rounded-lg bg-black text-white border border-gray-800 p-4 space-y-4">
      <div className="text-lg font-bold">Close Ticket</div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
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
          <select
            value={resolutionAction}
            onChange={(e) => setResolutionAction(e.target.value)}
            disabled={saving}
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Pilih...</option>
            {resolutionOptions.map((x) => (
              <option key={x} value={x}>
                {formatTypeLabel(x)}
              </option>
            ))}
          </select>
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
            {files.map((f, idx) => {
              const url = URL.createObjectURL(f)
              return (
                <div key={`${f.name}-${idx}`} className="rounded-md bg-gray-900 border border-gray-800 overflow-hidden">
                  <NextImage
                    src={url}
                    alt={f.name}
                    width={400}
                    height={200}
                    unoptimized
                    className="h-24 w-full object-cover"
                    onLoad={() => URL.revokeObjectURL(url)}
                  />
                  <button
                    type="button"
                    onClick={() => removeFileAt(idx)}
                    className="w-full px-2 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/20"
                  >
                    Hapus
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
  )
}
