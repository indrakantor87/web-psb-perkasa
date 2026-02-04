'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function InputForm({ user }: { user?: { name: string; role: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user?.role === 'TEKNISI') {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center shadow-sm">
        <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
        <p className="mt-2 text-sm text-red-600">
          You do not have permission to create new PSB data.
        </p>
      </div>
    )
  }

  const [formData, setFormData] = useState({
    customerName: '',
    locationMap: '',
    package: 'HOME LITE',
    marketingName: user?.role === 'MARKETING' ? user.name : '',
    description: '',
    phoneNumber: '',
    birthDate: '',
  })
  const [fotoRumah, setFotoRumah] = useState<File | null>(null)

  const packages = [
    'HOME LITE',
    'HOME BASIC',
    'HOME STREAM',
    'HOME ENTERTAIN',
    'HOME SMALL',
    'HOME ADVAN',
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        setError('Format file harus .jpg, .jpeg, atau .png')
        e.target.value = '' // Reset input
        setFotoRumah(null)
        return
      }

      // Validate file size (3MB = 3 * 1024 * 1024 bytes)
      if (file.size > 3 * 1024 * 1024) {
        setError('Ukuran file maksimal 3MB')
        e.target.value = '' // Reset input
        setFotoRumah(null)
        return
      }

      setError('')
      setFotoRumah(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation: Check mandatory fields
    if (!formData.customerName || !formData.phoneNumber || !formData.package || !formData.marketingName || !formData.locationMap || !formData.birthDate) {
      setError('Mohon isi semua kolom wajib: Nama Pelanggan, Tanggal Lahir, No WA Aktif, Paket, Marketing, Link Maps')
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
        router.push('/list')
        router.refresh()
      } else {
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
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm">
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}
      
      <div className="grid gap-6 md:grid-cols-2">
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
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black dark:text-white"
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
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            No WA Aktif
          </label>
          <input
            type="text"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black dark:text-white"
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
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black dark:text-white"
          >
            {packages.map((pkg) => (
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
          <input
            type="text"
            name="marketingName"
            value={formData.marketingName}
            onChange={handleChange}
            required
            readOnly={user?.role === 'MARKETING'}
            className={`mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black dark:text-white ${
              user?.role === 'MARKETING' ? 'bg-gray-100 dark:bg-gray-600' : 'bg-white dark:bg-gray-700'
            }`}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Foto Rumah (Maks 3MB, .jpg/.jpeg/.png)
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              dark:file:bg-blue-900/30 dark:file:text-blue-300
              hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
          />
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
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black dark:text-white"
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
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black dark:text-white"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 md:w-auto"
        >
          {loading ? 'Menyimpan...' : 'Kirim'}
        </button>
      </div>
    </form>
  )
}
