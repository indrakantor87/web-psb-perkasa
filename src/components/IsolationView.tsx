'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Search, Plus, X, Ban, CheckCircle, Trash2, Upload } from 'lucide-react'
import { clsx } from 'clsx'

interface Isolation {
  id: number
  customerName: string
  customerAddress: string | null
  customerPhone: string | null
  userEmail?: string | null
  activeDate?: string | null
  marketing?: string | null
  isolationDate: string
  reason: string | null
  status: string
  restorationDate: string | null
  teknisi: string | null
  ticket?: {
    package: string
    locationMap: string
  }
}

interface IsolationViewProps {
  userRole: string
}

export function IsolationView({ userRole }: IsolationViewProps) {
  const [isolations, setIsolations] = useState<Isolation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Role Permissions
  const canEdit = ['ADMIN', 'CS', 'NOC'].includes(userRole)
  const canDelete = userRole === 'ADMIN'

  // Form State
  const [formData, setFormData] = useState({
    customerName: '',
    customerAddress: '',
    customerPhone: '',
    reason: '',
  })

  const fetchIsolations = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter !== 'ALL') params.append('status', statusFilter)
      
      const res = await fetch(`/api/isolations?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setIsolations(data)
      }
    } catch (error) {
      console.error('Failed to fetch isolations', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIsolations()
  }, [search, statusFilter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/isolations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      if (res.ok) {
        setIsModalOpen(false)
        setFormData({ customerName: '', customerAddress: '', customerPhone: '', reason: '' })
        fetchIsolations()
      } else {
        alert('Gagal menambahkan data isolir')
      }
    } catch (error) {
      console.error(error)
      alert('Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRestore = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin membuka isolir pelanggan ini?')) return

    try {
      const res = await fetch(`/api/isolations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' }),
      })
      
      if (res.ok) {
        fetchIsolations()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) return

    try {
      const res = await fetch(`/api/isolations/${id}`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
        fetchIsolations()
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleImportClick = () => {
    if (!fileInputRef.current) return
    fileInputRef.current.click()
  }

  const handleFileChange = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      setLoading(true)
      const res = await fetch('/api/isolations/import', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Import berhasil')
        fetchIsolations()
      } else {
        alert(data.error || 'Import gagal')
      }
    } catch (error) {
      console.error('Import isolir gagal', error)
      alert('Terjadi kesalahan saat import')
    } finally {
      setLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari Nama / User / No HP / Marketing..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="ALL">Semua Status</option>
            <option value="OPEN">Terisolir (Open)</option>
            <option value="CLOSED">Normal (Closed)</option>
          </select>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleImportClick}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium border border-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-500"
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Tambah Isolir
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="hidden md:table-header-group bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nama Pelanggan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">No. HP</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Active Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Keterangan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Marketing</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</td>
                </tr>
              ) : isolations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Tidak ada data ditemukan</td>
                </tr>
              ) : (
                isolations.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {item.customerName}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {item.userEmail || '-'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {item.customerPhone ? (
                        <a 
                          href={`https://wa.me/${item.customerPhone.replace(/^0/, '62').replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {item.customerPhone}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {item.activeDate ? format(new Date(item.activeDate), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={item.reason || ''}>
                      {item.reason || '-'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {item.marketing || '-'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        "px-2 py-1 text-xs font-semibold rounded-full",
                        item.status === 'OPEN' 
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      )}>
                        {item.status === 'OPEN' ? 'TERISOLIR' : 'NORMAL'}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {item.status === 'OPEN' && canEdit && (
                          <button
                            onClick={() => handleRestore(item.id)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            title="Buka Isolir"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Hapus Data"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Mobile View (Card Style) */}
                    <td className="table-cell md:hidden px-4 py-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{item.customerName}</div>
                            {item.userEmail && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.userEmail}</div>
                            )}
                          </div>
                          <span className={clsx(
                            "px-2 py-0.5 text-[10px] font-semibold rounded-full",
                            item.status === 'OPEN' 
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          )}>
                            {item.status === 'OPEN' ? 'TERISOLIR' : 'NORMAL'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <div>
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Kontak:</span>
                            {item.customerPhone ? (
                              <a 
                                href={`https://wa.me/${item.customerPhone.replace(/^0/, '62').replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {item.customerPhone}
                              </a>
                            ) : '-'}
                          </div>
                          <div>
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Active Date:</span>
                            {item.activeDate ? format(new Date(item.activeDate), 'dd/MM/yyyy') : '-'}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Alasan:</span>
                            {item.reason || '-'}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium block text-gray-700 dark:text-gray-300">Marketing:</span>
                            {item.marketing || '-'}
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                          {item.status === 'OPEN' && canEdit && (
                            <button
                              onClick={() => handleRestore(item.id)}
                              className="text-xs flex items-center gap-1 text-green-600 font-medium hover:text-green-700"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              Buka Isolir
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-xs flex items-center gap-1 text-red-500 font-medium hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Data Isolir</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Pelanggan</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alamat</label>
                <textarea
                  rows={2}
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No. Handphone / WA</label>
                <input
                  type="text"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alasan Isolir</label>
                <select
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">- Pilih Alasan -</option>
                  <option value="Telat Bayar">Telat Bayar</option>
                  <option value="Permintaan Pelanggan">Permintaan Pelanggan</option>
                  <option value="Pindah Rumah">Pindah Rumah</option>
                  <option value="Kerusakan Perangkat">Kerusakan Perangkat</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
