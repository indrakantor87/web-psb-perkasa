'use client'

import { useEffect, useState } from 'react'

const FALLBACK_PACKAGES = ['HOME LITE', 'HOME BASIC', 'HOME STREAM', 'HOME ENTERTAIN', 'HOME SMALL', 'HOME ADVAN']
export type DivisionFilter = 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'

export type InputFormProps = {
  user?: { name: string; role: string }
  initialDivision?: DivisionFilter
}

function getDivisionFromUrl(): DivisionFilter | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('division')
    if (
      raw === 'ALL' ||
      raw === 'PENJUALAN' ||
      raw === 'CS_ADMIN' ||
      raw === 'NOC_TROUBLESHOOTS' ||
      raw === 'CREATOR_DIGITAL'
    ) {
      return raw
    }
  } catch {}

  return null
}

export function InputForm({
  user,
  initialDivision = 'ALL',
}: InputFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [division, setDivision] = useState<DivisionFilter>(initialDivision)
  const roleUpper = (user?.role || '').toUpperCase()
  const isAdmin = roleUpper === 'ADMIN'
  const isPenjualanFocus = !isAdmin || division === 'ALL' || division === 'PENJUALAN'
  const divisionDescriptions: Record<DivisionFilter, string> = {
    ALL: 'Modul Input PSB saat ini merepresentasikan operasional Penjualan, jadi admin masih memakai formulir utama ini untuk input pelanggan baru.',
    PENJUALAN: 'Formulir aktif untuk input PSB baru dari divisi Penjualan.',
    CS_ADMIN: 'Belum ada relasi langsung antara CS & Admin CS dan modul Input PSB, jadi tampilan ini masih placeholder.',
    NOC_TROUBLESHOOTS: 'Belum ada relasi langsung antara NOC & Troubleshoots dan modul Input PSB, jadi tampilan ini masih placeholder.',
    CREATOR_DIGITAL: 'Belum ada relasi langsung antara Creator Digital dan modul Input PSB, jadi tampilan ini masih placeholder.',
  }

  const [formData, setFormData] = useState({
    customerName: '',
    locationMap: '',
    package: 'HOME LITE',
    marketingName: roleUpper === 'MARKETING' ? user?.name ?? '' : '',
    description: '',
    phoneNumber: '',
    birthDate: '',
  })
  const [fotoRumah, setFotoRumah] = useState<File | null>(null)

  const [packageOptions, setPackageOptions] = useState<string[]>(FALLBACK_PACKAGES)

  useEffect(() => {
    const urlDivision = getDivisionFromUrl()
    if (urlDivision) {
      setDivision(urlDivision)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/packages')
        if (!res.ok) throw new Error('Failed to fetch packages')
        const data = (await res.json()) as Array<{ name?: string }>
        const names = data.map((p) => p.name).filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        if (!mounted) return
        if (names.length > 0) {
          setPackageOptions(names)
          setFormData((prev) => ({
            ...prev,
            package: names.includes(prev.package) ? prev.package : names[0],
          }))
        }
      } catch {
        if (!mounted) return
        setPackageOptions(FALLBACK_PACKAGES)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  if (roleUpper === 'TEKNISI') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Akses Ditolak</h3>
        <p className="mt-2 text-sm">Akun teknisi tidak memiliki akses untuk membuat data PSB baru.</p>
      </div>
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    // Sanitasi input nomor WA: hanya angka
    if (name === 'phoneNumber') {
      const digitsOnly = value.replace(/\D/g, '')
      const capped = digitsOnly.slice(0, 13)
      setFormData((prev) => ({ ...prev, [name]: capped }))
      return
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
        setError('Format file harus .jpg, .jpeg, .png, atau .webp')
        e.target.value = '' // Reset input
        setFotoRumah(null)
        return
      }

      // Validate file size (Input limit increased to 10MB because we will compress it)
      if (file.size > 10 * 1024 * 1024) {
        setError('Ukuran file maksimal 10MB')
        e.target.value = '' // Reset input
        setFotoRumah(null)
        return
      }

      try {
        // Show loading state implicitly via text or separate state if needed
        // For now we just set error to empty or a status message?
        // Let's use setError temporarily for status or add a new state
        // But to keep it simple, we just process it.
        
        const compressed = await compressImage(file)
        
        // Final check on compressed size (should be < 2MB usually)
        if (compressed.size > 3 * 1024 * 1024) {
             setError('Ukuran file setelah kompresi masih > 3MB. Silakan pilih foto lain.')
             e.target.value = ''
             setFotoRumah(null)
             return
        }

        setError('')
        setFotoRumah(compressed)
      } catch (err) {
        console.error('Compression error:', err)
        setError('Gagal memproses gambar. Silakan coba lagi.')
        e.target.value = ''
        setFotoRumah(null)
      }
    }
  }

  const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    let digits = text.replace(/\D/g, '')
    if (digits.startsWith('62')) {
      digits = '0' + digits.slice(2)
    }
    const capped = digits.slice(0, 13)
    setFormData(prev => ({ ...prev, phoneNumber: capped }))
  }

  // Helper to compress image
  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target?.result as string
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          const MAX_WIDTH = 1280
          const MAX_HEIGHT = 1280

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Canvas to Blob failed'))
              return
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          }, 'image/jpeg', 0.7) // 0.7 quality
        }
        img.onerror = (error) => reject(error)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation: Check mandatory fields
    if (!formData.customerName || !formData.phoneNumber || !formData.package || !formData.marketingName || !formData.locationMap || !formData.birthDate) {
      setError('Mohon isi semua kolom wajib: Nama Pelanggan, Tanggal Lahir, No WA Aktif, Paket, Marketing, Link Maps')
      return
    }

    // Validasi nomor WA: harus diawali 08, 10–13 digit, hanya angka
    const waPattern = /^08\d{8,11}$/
    if (!waPattern.test(formData.phoneNumber)) {
      setError('Format Nomor WA tidak valid. Gunakan angka saja, diawali 08, 10–13 digit. Contoh: 085865555005')
      return
    }

    if (!fotoRumah) {
      setError('Mohon upload Foto Rumah')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = new FormData()
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value)
      })
      if (fotoRumah) {
        data.append('fotoRumah', fotoRumah)
      }

      const res = await fetch('/api/tickets', {
        method: 'POST',
        body: data,
      })

      if (res.ok) {
        // Use hard navigation to prevent router hang and ensure fresh data
        window.location.href = '/list'
      } else {
        setLoading(false)
        const data = await res.json()
        if (data.details && data.details.fieldErrors) {
          const messages = Object.entries(data.details.fieldErrors)
            .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
            .join('; ')
          setError(`${data.error}: ${messages}`)
        } else {
          setError(data.error || 'Failed to submit')
        }
      }
    } catch {
      setLoading(false)
      setError('An error occurred')
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {isAdmin && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="grid gap-3 md:grid-cols-[220px,1fr] md:items-end">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Divisi
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value as DivisionFilter)}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="ALL">Semua Divisi</option>
                <option value="PENJUALAN">Penjualan</option>
                <option value="CS_ADMIN">CS & Admin CS</option>
                <option value="NOC_TROUBLESHOOTS">NOC & Troubleshoots</option>
                <option value="CREATOR_DIGITAL">Creator Digital</option>
              </select>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {divisionDescriptions[division]}
            </div>
          </div>
        </div>
      )}

      {isPenjualanFocus ? (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Input Data PSB</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Isi data pelanggan baru secara singkat dan rapi.</p>
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}
          
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nama Pelanggan
          </label>
          <input
            type="text"
            name="customerName"
            value={formData.customerName}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tanggal Lahir
          </label>
          <input
            type="date"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            No WA Aktif
          </label>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            onPaste={handlePhonePaste}
            required
            pattern="^08\d{8,11}$"
            inputMode="numeric"
            placeholder="08xxxxxxxxxx"
            maxLength={13}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Paket
          </label>
          <select
            name="package"
            value={formData.package}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {packageOptions.map((pkg) => (
              <option key={pkg} value={pkg}>
                {pkg}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Marketing
          </label>
          {roleUpper === 'MARKETING' ? (
            <input
              type="text"
              name="marketingName"
              value={formData.marketingName}
              onChange={handleChange}
              required
              readOnly
              autoComplete="off"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-600 dark:text-white"
            />
          ) : (
            <input
              type="text"
              name="marketingName"
              value={formData.marketingName}
              onChange={handleChange}
              required
              autoComplete="off"
              placeholder="Masukkan nama marketing"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          )}
          {roleUpper !== 'MARKETING' && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Untuk role selain `MARKETING`, kolom ini bisa diisi manual.
            </p>
          )}
        </div>

        <div className="md:col-span-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-900">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Foto Rumah (Max 10MB - Otomatis Dikompres)
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
            className="mt-2 block w-full text-sm text-gray-500 dark:text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border file:border-gray-300 dark:file:border-gray-600
              file:text-sm file:font-semibold
              file:bg-white file:text-gray-700
              dark:file:bg-gray-800 dark:file:text-gray-200
              hover:file:bg-gray-50 dark:hover:file:bg-gray-700"
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Foto akan dikompres otomatis sebelum dikirim.</p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Link Google Maps
          </label>
          <input
            type="text"
            name="locationMap"
            value={formData.locationMap}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="https://maps.google.com/..."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Deskripsi (Opsional)
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-black focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

          <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-gray-700">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white md:w-auto"
            >
              {loading ? 'Menyimpan...' : 'Kirim'}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Input PSB Belum Tersedia untuk Divisi Ini</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Saat ini input pelanggan baru masih dicatat melalui alur divisi Penjualan. Pilih `Semua Divisi` atau `Penjualan` untuk memakai formulir PSB.
          </p>
        </div>
      )}
    </div>
  )
}
