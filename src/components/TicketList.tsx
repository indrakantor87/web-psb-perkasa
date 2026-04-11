'use client'

import { useState, useEffect, Fragment, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Upload } from 'lucide-react'

interface Ticket {
  id: number
  customerName: string
  birthDate?: string | null
  locationMap: string
  requestDate: string
  installedDate: string | null
  package: string
  marketingName: string
  teknisi?: string | null
  description: string | null
  phoneNumber: string
  fotoRumah?: string | null
  hasPhoto?: boolean
  pengawalan?: string | null
  kmz?: string | null
  priority?: string | null
  pembayaran?: string | null
  status: string
  closedBy?: { name: string } | null
}

interface TicketListProps {
  tickets: Ticket[]
  userRole: string
  initialPeriod: { month: number; year: number }
  initialStatus?: string
  initialMarketing?: string
  initialSearch?: string
  pagination?: {
    currentPage: number
    totalPages: number
    totalCount: number
    pageSize?: number
  }
  counts?: {
    OPEN: number
    ON_PROGRESS: number
    CLOSE: number
    PENDING: number
  }
  defaultTemplateContent?: string
}

export function TicketList({ tickets, userRole, initialPeriod, initialStatus, initialMarketing, initialSearch, pagination, counts, defaultTemplateContent = '' }: TicketListProps) {
  const router = useRouter()
  const isMarketing = userRole === 'MARKETING'
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const fileInputId = 'ticket-import-input'
  const [month, setMonth] = useState(initialPeriod.month)
  const [year, setYear] = useState(initialPeriod.year)
  const [status, setStatus] = useState((initialStatus || 'ALL').toUpperCase())
  const [marketing, setMarketing] = useState(initialMarketing || '')
  const [search, setSearch] = useState(initialSearch || '')
  const [kmzEdit, setKmzEdit] = useState<{ id: number; value: string } | null>(null)
  const [summaryTicket, setSummaryTicket] = useState<Ticket | null>(null)
  const [editTicket, setEditTicket] = useState<Ticket | null>(null)
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null)
  const [editFile, setEditFile] = useState<File | null>(null)
  
  // Use prop directly
  const defaultTemplate = defaultTemplateContent

  // Local state for tickets to support optimistic updates
  const [ticketsState, setTicketsState] = useState(tickets)

  const colSpan = userRole !== 'MARKETING' ? 16 : 15

  // Sync local state when props change
  useEffect(() => {
    setTicketsState(tickets)
  }, [tickets])
  
  // Pagination from props (Server Side)
  const currentPage = pagination?.currentPage || 1
  const totalPages = pagination?.totalPages || 1
  const totalCount = pagination?.totalCount || tickets.length

  const formatMessage = (template: string, ticket: Ticket) => {
    return template
      .replace(/{{name}}/g, ticket.customerName || '')
      .replace(/{{package}}/g, ticket.package || '')
      .replace(/{{marketing}}/g, ticket.marketingName || '')
      .replace(/{{phone}}/g, ticket.phoneNumber || '')
      .replace(/{{location}}/g, ticket.locationMap || '')
  }

  const handleFilter = useCallback(() => {
    const base = `/list?month=${month}&year=${year}`
    const statusPart = status === 'ALL' ? '' : `&status=${status}`
    const marketingPart = marketing.trim() ? `&marketing=${encodeURIComponent(marketing.trim())}` : ''
    const searchPart = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''
    const limitPart = pagination?.pageSize && pagination.pageSize !== 25 ? `&limit=${pagination.pageSize}` : ''
    const url = `${base}${statusPart}${marketingPart}${searchPart}${limitPart}`
    router.replace(url)
  }, [marketing, month, pagination?.pageSize, router, search, status, year])

  // Auto-filter when state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFilter()
    }, 500)
    return () => clearTimeout(timer)
  }, [handleFilter])

  const handleCloseTicket = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    // Safety check: Stop execution if user cancels confirmation
    if (!confirm('Are you sure you want to close this ticket?')) {
      return
    }

    const nowIso = new Date().toISOString()
    setTicketsState(prev => prev.map(t =>
      t.id === id ? { ...t, status: 'CLOSE', installedDate: nowIso } : t
    ))

    setLoadingId(id)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSE' }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        alert('Failed to close ticket')
        router.refresh()
      }
    } catch {
      alert('An error occurred while closing ticket')
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  const handleOnProgressTicket = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Optimistic update
    setTicketsState(prev => prev.map(t => 
      t.id === id ? { ...t, status: 'ON_PROGRESS' } : t
    ))

    setLoadingId(id)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ON_PROGRESS' }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        alert('Failed to change status to On Progress')
        router.refresh() // Revert
      }
    } catch {
      alert('An error occurred while changing status')
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  const handleReopenTicket = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Apakah Anda yakin ingin membuka kembali tiket ini?')) {
      return
    }

    // Optimistic update
    setTicketsState(prev => prev.map(t => 
      t.id === id ? { ...t, status: 'OPEN' } : t
    ))

    setLoadingId(id)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OPEN' }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        alert('Failed to reopen ticket')
        router.refresh() // Revert
      }
    } catch {
      alert('An error occurred while reopening ticket')
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  const handleUpdatePengawalan = async (id: number, value: string) => {
    const nextValue = value === '' ? null : value
    // Optimistic update
    setTicketsState(prev => prev.map(t => 
      t.id === id ? { ...t, pengawalan: nextValue } : t
    ))

    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pengawalan: nextValue }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        // Revert on failure
        alert('Failed to update pengawalan')
        router.refresh()
      }
    } catch {
      alert('Error updating pengawalan')
      router.refresh()
    }
  }

  const handleUpdatePembayaran = async (id: number, value: string) => {
    // Optimistic update
    setTicketsState(prev => prev.map(t => 
      t.id === id ? { ...t, pembayaran: value } : t
    ))

    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pembayaran: value }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        alert('Failed to update pembayaran')
        router.refresh()
      }
    } catch {
      alert('Error updating pembayaran')
      router.refresh()
    }
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const years = [2024, 2025, 2026, 2027]
  const packages = [
    'HOME LITE',
    'HOME BASIC',
    'HOME STREAM',
    'HOME ENTERTAIN',
    'HOME SMALL',
    'HOME ADVAN',
  ]

  const role = (userRole || '').toUpperCase()
  const canClose = ['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(role)
  const canEditKmz = ['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(role)
  const canDelete = ['ADMIN', 'CS', 'NOC'].includes(role)
  const canEditStatus = ['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(role)
  const canBulkDelete = ['ADMIN', 'CS', 'NOC'].includes(role)

  const normalizeStatus = (s: string) => s.toUpperCase().replace(/\s+/g, '_')

  const handleEditTicket = (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    // Find the ticket to edit
    const ticketToEdit = ticketsState.find(t => t.id === id)
    if (ticketToEdit) {
      setEditTicket(ticketToEdit)
      setEditFile(null)
    }
  }

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTicket) return

    setLoadingId(editTicket.id)
    try {
      // Optimistic update
      setTicketsState(prev => prev.map(t => 
        t.id === editTicket.id ? { ...t, ...editTicket } : t
      ))

      const formData = new FormData()
      formData.append('customerName', editTicket.customerName)
      if (editTicket.birthDate) formData.append('birthDate', editTicket.birthDate)
      formData.append('locationMap', editTicket.locationMap)
      formData.append('phoneNumber', editTicket.phoneNumber)
      formData.append('package', editTicket.package)
      formData.append('marketingName', editTicket.marketingName)
      formData.append('description', editTicket.description || '')
      if (editTicket.pengawalan) formData.append('pengawalan', editTicket.pengawalan)
      if (editTicket.kmz) formData.append('kmz', editTicket.kmz)
      if (editTicket.pembayaran) formData.append('pembayaran', editTicket.pembayaran)
      if (editTicket.teknisi) formData.append('teknisi', editTicket.teknisi)
      if (canEditStatus) formData.append('status', normalizeStatus(editTicket.status))
      
      // New fields
      if (editTicket.installedDate) formData.append('installedDate', editTicket.installedDate)
      if (editFile) formData.append('fotoRumah', editFile)

      const res = await fetch(`/api/tickets/${editTicket.id}`, {
        method: 'PUT',
        body: formData,
      })

      if (res.ok) {
        setEditTicket(null)
        setEditFile(null)
        router.refresh()
      } else {
        alert('Failed to update ticket')
        router.refresh() // Revert
      }
    } catch {
      alert('An error occurred during update')
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  const handleDeleteTicket = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    const isConfirmed = confirm('Apakah Anda yakin ingin menghapus data ini?')

    if (isConfirmed) {
      setLoadingId(id)
      try {
        const res = await fetch(`/api/tickets/${id}`, {
          method: 'DELETE',
        })

        if (res.ok) {
          router.refresh()
        } else {
          alert('Gagal menghapus data')
        }
      } catch {
        alert('Terjadi kesalahan saat menghapus data')
      } finally {
        setLoadingId(null)
      }
    }
  }

  const handleSaveKmz = async (id: number, value: string) => {
    // Optimistic update
    setTicketsState(prev => prev.map(t => 
      t.id === id ? { ...t, kmz: value } : t
    ))
    setKmzEdit(null)

    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kmz: value }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        alert('Gagal menyimpan KMZ')
        router.refresh()
      }
    } catch {
      alert('Error menyimpan KMZ')
      router.refresh()
    }
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const XLSX = await import('xlsx')

      // Fetch all data based on current filters
      const params = new URLSearchParams()
      params.set('month', month.toString())
      params.set('year', year.toString())
      params.set('all', '1')
      if (status !== 'ALL') params.set('status', status)
      if (marketing) params.set('marketing', marketing)
      if (search) params.set('search', search)

      const res = await fetch(`/api/tickets?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch data for export')
      const allTickets: Ticket[] = await res.json()

      const dataToExport = allTickets.map(ticket => ({
        'Nama Pelanggan': ticket.customerName,
        'Tanggal Lahir': ticket.birthDate ? format(new Date(ticket.birthDate), 'dd/MM/yyyy') : '-',
        'Maps Lokasi': ticket.locationMap,
        'Tgl Request': format(new Date(ticket.requestDate), 'dd/MM/yyyy'),
        'Tgl Terpasang': ticket.installedDate ? format(new Date(ticket.installedDate), 'dd/MM/yyyy') : '-',
        'Paket': ticket.package,
        'Marketing': ticket.marketingName,
        'Pengawalan': ticket.pengawalan || '-',
        'KMZ': ticket.kmz || '-',
        'Keterangan': ticket.description || '-',
        'Pembayaran': ticket.pembayaran || '-',
        'Status': ticket.status,
        'No HP': ticket.phoneNumber,
        'Ditutup Oleh': ticket.closedBy?.name || '-'
      }))

      const worksheet = XLSX.utils.json_to_sheet(dataToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets')
      XLSX.writeFile(workbook, `Tickets_Export_${format(new Date(), 'dd-MM-yyyy')}.xlsx`)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  // Pagination Logic
  const currentTickets = ticketsState
  const pageSize = pagination?.pageSize || 25

  // Standard descending numbering: Page 1 starts from totalCount (newest)
  // Example (totalCount: 50, pageSize: 25, page: 1): index 0 -> 50, index 1 -> 49...
  const startingNumber = totalCount - ((currentPage - 1) * pageSize)
  const indexOfFirstItem = (currentPage - 1) * pageSize
  const indexOfLastItem = indexOfFirstItem + currentTickets.length

  const handlePageChange = (newPage: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set('page', newPage.toString())
    router.replace(url.pathname + url.search)
  }

  const handleLimitChange = (newLimit: number) => {
    const base = `/list?month=${month}&year=${year}&page=1`
    const statusPart = status === 'ALL' ? '' : `&status=${status}`
    const marketingPart = marketing.trim() ? `&marketing=${encodeURIComponent(marketing.trim())}` : ''
    const searchPart = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''
    const limitPart = newLimit !== 25 ? `&limit=${newLimit}` : ''
    const url = `${base}${statusPart}${marketingPart}${searchPart}${limitPart}`
    router.replace(url)
  }

  const handleImportClick = () => {
    const el = document.getElementById(fileInputId) as HTMLInputElement | null
    el?.click()
  }

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    setImportError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/tickets/import', { method: 'POST', body: form })
      const data = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Gagal import')
      }
      alert(data.message || 'Import selesai')
      router.refresh()
    } catch (err: unknown) {
      console.error('Import error', err)
      const msg = err instanceof Error ? err.message : String(err)
      setImportError(msg || 'Gagal import')
      alert('Gagal import: ' + (msg || 'Unknown error'))
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  const handleBulkDelete = async () => {
    if (!canBulkDelete) return
    const text = prompt('Ketik HAPUS untuk konfirmasi hapus semua data sesuai filter saat ini:')
    if (text !== 'HAPUS') return
    setIsBulkDeleting(true)
    try {
      const res = await fetch('/api/tickets/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          year,
          status,
          marketing,
          search,
          confirmText: text,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert((data as { error?: string })?.error ?? 'Gagal menghapus data')
        return
      }
      setTicketsState([])
      router.refresh()
    } catch {
      alert('Terjadi kesalahan saat menghapus data')
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return (
    <div className="space-y-2">
      {userRole !== 'MARKETING' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <div className="rounded-md bg-red-600 dark:bg-red-700 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">
              Tiket Open : {counts?.OPEN ?? 0}
            </span>
          </div>
          <div className="rounded-md bg-blue-600 dark:bg-blue-700 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">
              Tiket On Progress : {counts?.ON_PROGRESS ?? 0}
            </span>
          </div>
          <div className="rounded-md bg-green-600 dark:bg-green-700 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">
              Tiket Closed : {counts?.CLOSE ?? 0}
            </span>
          </div>
          <div className="rounded-md bg-yellow-500 dark:bg-yellow-600 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">
              Tiket Pending : {counts?.PENDING ?? 0}
            </span>
          </div>
        </div>
      )}

      <div className="inline-flex flex-col space-y-1 rounded-lg bg-white dark:bg-gray-800 p-1.5 shadow-sm md:flex-row md:items-center md:space-y-0 md:space-x-4">
        <div className="flex w-full flex-col space-y-1 md:w-auto md:flex-row md:items-center md:space-y-0 md:space-x-4">
          <div className="flex flex-col">
            <span className="mb-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">Bulan</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-0.5 text-sm leading-tight text-black dark:text-white md:w-32"
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <span className="mb-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">Tahun</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-0.5 text-sm leading-tight text-black dark:text-white md:w-24"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <span className="mb-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-0.5 text-sm leading-tight text-black dark:text-white md:w-28"
            >
              <option value="ALL">Semua</option>
              <option value="OPEN">OPEN</option>
              <option value="ON_PROGRESS">ON PROGRESS</option>
              <option value="CLOSE">CLOSE</option>
              <option value="PENDING">PENDING</option>
            </select>
          </div>
          {userRole !== 'MARKETING' && (
            <div className="flex flex-col">
              <span className="mb-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">Nama Marketing</span>
              <input
                type="text"
                value={marketing}
                onChange={(e) => setMarketing(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-0.5 text-sm leading-tight text-black dark:text-white md:w-40"
                placeholder="Cari nama..."
              />
            </div>
          )}
          <div className="flex flex-col">
            <span className="mb-0.5 text-[11px] leading-none text-gray-500 dark:text-gray-400">Cari Tiket</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-0.5 text-sm leading-tight text-black dark:text-white md:w-48"
              placeholder="Nama, No Tiket..."
            />
          </div>
          <div className="flex items-end h-full pt-3 space-x-2">
            {userRole !== 'MARKETING' && (
              <>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportFileChange}
                />
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="w-full rounded-md bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700 md:w-auto disabled:opacity-60"
                  title="Import Excel (Admin/CS/NOC)"
                >
                  <span className="inline-flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    {isImporting ? 'Mengimpor...' : 'Import Excel'}
                  </span>
                </button>
              </>
            )}
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="w-full rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 md:w-auto disabled:opacity-60"
            >
              {isExporting ? 'Mengekspor...' : 'Ekspor ke Excel'}
            </button>
            {canBulkDelete && (
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="w-full rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 md:w-auto disabled:opacity-60"
                title="Hapus semua data sesuai filter"
              >
                {isBulkDeleting ? 'Menghapus...' : 'Hapus Semua'}
              </button>
            )}
          </div>
        </div>
      </div>

      {importError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {importError}
        </div>
      )}

      <div className="overflow-x-auto overflow-y-hidden rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        <table className="min-w-full border-collapse border border-gray-200 dark:border-gray-700">
          <thead className="hidden md:table-header-group bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">No</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Nama Pelanggan</th>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Tanggal Lahir</th>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Lokasi Maps</th>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Tanggal Request</th>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Tanggal Pasang</th>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Paket</th>
              {userRole !== 'MARKETING' && (
                <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Marketing</th>
              )}
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Foto Rumah</th>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Pengawalan</th>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">KMZ</th>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Pembayaran</th>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Keterangan</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Status</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Aksi</th>
              <th className="hidden md:table-cell px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">No WA Aktif</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 text-center divide-y divide-gray-100 dark:divide-gray-700">
            {currentTickets.map((ticket, index) => (
              <Fragment key={ticket.id}>
                <tr key={ticket.id} className={clsx("hover:bg-gray-50 dark:hover:bg-gray-700", !isMarketing && "transition-colors")}>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}
                        className="text-gray-500 hover:text-blue-600 dark:text-white dark:hover:text-blue-300 focus:outline-none"
                      >
                        {expandedTicketId === ticket.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <span>{startingNumber - index}</span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-3 py-3 text-left text-xs text-gray-900 dark:text-white max-w-[200px]">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setSummaryTicket(ticket)
                      }}
                      className="text-left text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline focus:outline-none line-clamp-2"
                    >
                      {ticket.customerName}
                    </button>
                  </td>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {ticket.birthDate ? format(new Date(ticket.birthDate), 'dd/MM/yyyy') : '-'}
                  </td>
                  <td className="hidden md:table-cell max-w-xs px-3 py-3 text-xs text-blue-600 dark:text-blue-400">
                    <a href={ticket.locationMap} target="_blank" rel="noreferrer" className="hover:underline">
                      Map Link
                    </a>
                  </td>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(ticket.requestDate), 'dd/MM/yyyy')}
                  </td>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {ticket.installedDate ? format(new Date(ticket.installedDate), 'dd/MM/yyyy') : '-'}
                  </td>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{ticket.package}</td>
                  {userRole !== 'MARKETING' && (
                    <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{ticket.marketingName}</td>
                  )}

                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-blue-600 dark:text-blue-400">
                    {ticket.hasPhoto || ticket.fotoRumah ? (
                      <a href={ticket.fotoRumah || `/api/tickets/${ticket.id}/photo`} target="_blank" rel="noreferrer" className="hover:underline">
                        View Photo
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-700 dark:text-gray-300 capitalize">
                    {ticket.pengawalan ? ticket.pengawalan : '-'}
                  </td>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-700 dark:text-gray-300">
                    {ticket.kmz || '-'}
                  </td>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-700 dark:text-gray-300">
                    {ticket.pembayaran || '-'}
                  </td>
                  <td className="hidden md:table-cell max-w-xs px-3 py-3 text-left text-xs text-gray-700 dark:text-gray-300" title={ticket.description || ''}>
                    <div className="line-clamp-3 whitespace-normal">
                      {ticket.description || '-'}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-3 py-3 text-xs">
                    <span className={clsx(
                      'inline-flex items-center justify-center text-center rounded-full px-2 py-0.5 font-semibold leading-tight',
                      ticket.status === 'ON_PROGRESS' ? 'text-[9px] whitespace-normal max-w-[70px]' : 'text-[10px] whitespace-nowrap',
                      ticket.status === 'OPEN' 
                        ? 'bg-red-600 text-gray-200 dark:bg-red-700' 
                        : ticket.status === 'ON_PROGRESS'
                          ? 'bg-blue-600 text-gray-200 dark:bg-blue-700'
                          : ticket.status === 'CLOSE' 
                            ? 'bg-green-600 text-gray-200 dark:bg-green-700' 
                            : ticket.status === 'PENDING'
                              ? 'bg-yellow-500 text-gray-200 dark:bg-yellow-600'
                              : 'bg-gray-200 text-gray-800'
                    )}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-700 dark:text-gray-300">
                    {ticket.status === 'CLOSE' && ticket.closedBy?.name
                      ? `oleh ${ticket.closedBy.name}`
                      : '-'}
                  </td>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-3 text-xs text-blue-600 dark:text-blue-400">
                    <a
                      href={`https://wa.me/${ticket.phoneNumber.replace(/^0/, '62').replace(/\D/g, '')}${defaultTemplate ? `?text=${encodeURIComponent(formatMessage(defaultTemplate, ticket))}` : ''}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {ticket.phoneNumber}
                    </a>
                  </td>
                  <td className="table-cell md:hidden px-3 py-3 text-left text-xs text-gray-900 dark:text-white">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}
                            className="text-gray-500 hover:text-blue-600 dark:text-white dark:hover:text-blue-300 focus:outline-none"
                          >
                            {expandedTicketId === ticket.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <span className="text-gray-500 dark:text-gray-400">{startingNumber - index}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setSummaryTicket(ticket) }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                        >
                          {ticket.customerName}
                        </button>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Tanggal Lahir:</span> {ticket.birthDate ? format(new Date(ticket.birthDate), 'dd/MM/yyyy') : '-'}
                      </div>
                      <div>
                        <a href={ticket.locationMap} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Link Maps</a>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Tanggal Request:</span> {format(new Date(ticket.requestDate), 'dd/MM/yyyy')}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Tanggal Pasang:</span> {ticket.installedDate ? format(new Date(ticket.installedDate), 'dd/MM/yyyy') : '-'}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Paket:</span> {ticket.package}
                      </div>
                      {userRole !== 'MARKETING' && (
                        <div className="text-gray-500 dark:text-gray-400">
                          <span className="font-medium">Marketing:</span> {ticket.marketingName}
                        </div>
                      )}
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Foto Rumah:</span>{' '}
                        {ticket.hasPhoto || ticket.fotoRumah ? (
                          <a href={ticket.fotoRumah || `/api/tickets/${ticket.id}/photo`} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Lihat Foto
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Keterangan:</span> <span className="text-gray-700 dark:text-gray-300">{ticket.description || '-'}</span>
                      </div>
                      <div>
                        <span className={clsx(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight',
                          ticket.status === 'OPEN' 
                            ? 'bg-red-600 text-gray-200 dark:bg-red-700' 
                            : ticket.status === 'ON_PROGRESS'
                              ? 'bg-blue-600 text-gray-200 dark:bg-blue-700'
                              : ticket.status === 'CLOSE' 
                                ? 'bg-green-600 text-gray-200 dark:bg-green-700' 
                                : ticket.status === 'PENDING'
                                  ? 'bg-yellow-500 text-gray-200 dark:bg-yellow-600'
                                  : 'bg-gray-200 text-gray-800'
                        )}>
                          {ticket.status}
                        </span>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Pengawalan:</span> {ticket.pengawalan ? ticket.pengawalan : '-'}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">KMZ:</span>{' '}
                        {ticket.kmz ? (
                          <a href={ticket.kmz} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                            Link
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Pembayaran:</span> {ticket.pembayaran || '-'}
                      </div>
                      <div>
                        <a
                          href={`https://wa.me/${ticket.phoneNumber.replace(/^0/, '62').replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {ticket.phoneNumber}
                        </a>
                      </div>
                    </div>
                  </td>
                </tr>
                {expandedTicketId === ticket.id && (
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td colSpan={colSpan} className="px-4 py-4 text-left">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Pengawalan</label>
                            {canClose ? (
                              <select
                                value={(ticket.pengawalan || '').toLowerCase()}
                                onChange={(e) => handleUpdatePengawalan(ticket.id, e.target.value)}
                                className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white text-xs py-1.5 focus:border-blue-500 focus:ring-blue-500"
                              >
                                <option value="">-</option>
                                <option value="tidak">Tidak</option>
                                <option value="onsite">Onsite</option>
                                <option value="onchat">Onchat</option>
                              </select>
                            ) : (
                              <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">{ticket.pengawalan ? ticket.pengawalan : '-'}</div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Pembayaran</label>
                            {userRole === 'MARKETING' ? (
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{ticket.pembayaran || '-'}</div>
                            ) : (
                              <select
                                value={ticket.pembayaran || ''}
                                onChange={(e) => handleUpdatePembayaran(ticket.id, e.target.value)}
                                className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white text-xs py-1.5 focus:border-blue-500 focus:ring-blue-500"
                              >
                                <option value="">- Pilih -</option>
                                <option value="Cash">Cash</option>
                                <option value="TF">TF</option>
                              </select>
                            )}
                          </div>
                        </div>

                        {userRole !== 'MARKETING' && (
                          <div className="space-y-3">
                            <div className="rounded-lg border border-gray-300 dark:border-gray-600 p-3 bg-white dark:bg-gray-700">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                                <div className="space-y-1">
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-300">KMZ</label>
                                </div>
                                {canEditKmz && (
                                  <div className="flex items-center justify-end gap-2">
                                    <input
                                      value={kmzEdit?.id === ticket.id ? kmzEdit.value : (ticket.kmz || '')}
                                      onChange={(e) => setKmzEdit({ id: ticket.id, value: e.target.value })}
                                      className="w-full md:w-auto flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white px-2 py-1 text-xs"
                                      placeholder="Enter/edit KMZ here"
                                    />
                                    <button
                                      onClick={() => handleSaveKmz(ticket.id, (kmzEdit?.id === ticket.id ? kmzEdit.value : (ticket.kmz || '')))}
                                      className="rounded bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-700"
                                    >
                                      Save
                                    </button>
                                    {kmzEdit?.id === ticket.id && (
                                      <button
                                        onClick={() => setKmzEdit(null)}
                                        className="rounded bg-gray-100 dark:bg-gray-600 px-2 py-1 text-[10px] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500"
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Action</label>
                          <div className="flex flex-wrap gap-3">
                            {userRole !== 'MARKETING' ? (
                              <>
                                {ticket.status !== 'OPEN' && canClose && (
                                  <button
                                    onClick={(e) => handleReopenTicket(e, ticket.id)}
                                    disabled={loadingId === ticket.id}
                                    className="rounded-md bg-red-50 text-red-600 px-3 py-2 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 border border-red-200"
                                  >
                                    Reopen
                                  </button>
                                )}

                                <button
                                  onClick={(e) => handleOnProgressTicket(e, ticket.id)}
                                  disabled={loadingId === ticket.id || !(['OPEN', 'PENDING'].includes(ticket.status) && canClose)}
                                  className="rounded-md bg-blue-50 text-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-100 disabled:opacity-50 border border-blue-200"
                                >
                                  Process
                                </button>
                                
                                <button
                                  onClick={(e) => handleCloseTicket(e, ticket.id)}
                                  disabled={loadingId === ticket.id || !(canClose && ['OPEN', 'ON_PROGRESS', 'PENDING'].includes(ticket.status))}
                                  className="rounded-md bg-green-50 text-green-600 px-3 py-2 text-xs font-semibold hover:bg-green-100 disabled:opacity-50 border border-green-200"
                                >
                                  Close
                                </button>

                                <button
                                  onClick={(e) => handleEditTicket(e, ticket.id)}
                                  className="rounded-md bg-gray-50 text-gray-700 px-3 py-2 text-xs font-semibold hover:bg-gray-100 border border-gray-200"
                                >
                                  Edit
                                </button>

                                {canDelete && (
                                  <button
                                    onClick={(e) => handleDeleteTicket(e, ticket.id)}
                                    disabled={loadingId === ticket.id}
                                    className="rounded-md bg-red-50 text-red-600 px-3 py-2 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 border border-red-200"
                                  >
                                    Delete
                                  </button>
                                )}
                              </>
                            ) : (
                              // Marketing View for Actions
                              ticket.status === 'CLOSE' && (
                                <div className="text-xs text-green-600 dark:text-green-400 font-medium px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-800">
                                  by {ticket.closedBy?.name}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {ticketsState.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="border border-gray-200 dark:border-gray-700 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 italic">
                  No data for this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between space-y-2 py-1 mt-1 md:flex-row md:space-y-0">
        <div className="flex items-center space-x-4">
          <div className="text-xs text-gray-700 dark:text-gray-300">
            Menampilkan <span className="font-medium">{ticketsState.length > 0 ? indexOfFirstItem + 1 : 0}</span> sampai{' '}
            <span className="font-medium">{Math.min(indexOfLastItem, totalCount)}</span> dari{' '}
            <span className="font-medium">{totalCount}</span> hasil
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
           <div className="flex items-center gap-2 mr-2">
            <span className="text-xs text-gray-700 dark:text-gray-300">Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="block rounded-md border-0 py-1 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 text-xs sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600 h-8"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
          </div>
           <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-1 py-1 text-gray-400 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 transition-colors"
              >
                <span className="sr-only">Previous</span>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              
               <span className="relative inline-flex items-center px-2 py-1 text-xs font-semibold text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 bg-white dark:bg-gray-800 focus:outline-offset-0">
                 {currentPage} / {totalPages}
               </span>

              <button
                onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-1 py-1 text-gray-400 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 transition-colors"
              >
                <span className="sr-only">Next</span>
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
           </nav>
        </div>
      </div>

      {summaryTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-all duration-300">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/5 transform transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Ticket Summary</h3>
              <button
                onClick={() => setSummaryTicket(null)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 text-sm font-sans text-gray-600 dark:text-gray-300">
                  <div className="space-y-2 leading-relaxed">
                    <div className="whitespace-pre-wrap" style={{ tabSize: '130px' }}>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Name</span>{'\t'}
                      <span className="font-medium text-gray-400 dark:text-gray-500">:</span> <span className="text-gray-900 dark:text-white">{summaryTicket.customerName}</span>
                    </div>
                    <div className="whitespace-pre-wrap" style={{ tabSize: '130px' }}>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Birth Date</span>{'\t'}
                      <span className="font-medium text-gray-400 dark:text-gray-500">:</span> <span className="text-gray-900 dark:text-white">{summaryTicket.birthDate ? format(new Date(summaryTicket.birthDate), 'dd/MM/yyyy') : '-'}</span>
                    </div>
                    <div className="whitespace-pre-wrap" style={{ tabSize: '130px' }}>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Location Map</span>{'\t'}
                      <span className="font-medium text-gray-400 dark:text-gray-500">:</span> <span className="text-gray-900 dark:text-white break-all">{summaryTicket.locationMap}</span>
                    </div>
                    <div className="whitespace-pre-wrap" style={{ tabSize: '130px' }}>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Phone Number</span>{'\t'}
                      <span className="font-medium text-gray-400 dark:text-gray-500">:</span> <span className="text-gray-900 dark:text-white">{summaryTicket.phoneNumber}</span>
                    </div>
                    <div className="whitespace-pre-wrap" style={{ tabSize: '130px' }}>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Package</span>{'\t'}
                      <span className="font-medium text-gray-400 dark:text-gray-500">:</span> <span className="text-gray-900 dark:text-white">{summaryTicket.package}</span>
                    </div>
                    <div className="whitespace-pre-wrap" style={{ tabSize: '130px' }}>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Marketing</span>{'\t'}
                      <span className="font-medium text-gray-400 dark:text-gray-500">:</span> <span className="text-gray-900 dark:text-white">{summaryTicket.marketingName}</span>
                    </div>
                  </div>
                </div>
            <div className="bg-gray-50/50 dark:bg-gray-900/50 px-6 py-4 sm:flex sm:flex-row-reverse rounded-b-2xl border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-lg bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all sm:w-auto"
                onClick={() => setSummaryTicket(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Ticket</h3>
              <button
                onClick={() => setEditTicket(null)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleUpdateTicket} className="flex-1 min-h-0 flex flex-col">
              <div className="p-6 space-y-4 overflow-y-auto min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={editTicket.customerName}
                    onChange={(e) => setEditTicket({ ...editTicket, customerName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editTicket.phoneNumber}
                    onChange={(e) => setEditTicket({ ...editTicket, phoneNumber: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Package</label>
                  <select
                    value={editTicket.package}
                    onChange={(e) => setEditTicket({ ...editTicket, package: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {packages.map(pkg => (
                      <option key={pkg} value={pkg}>{pkg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Marketing</label>
                  <input
                    type="text"
                    value={editTicket.marketingName}
                    onChange={(e) => setEditTicket({ ...editTicket, marketingName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Teknisi</label>
                  <input
                    type="text"
                    value={editTicket.teknisi || ''}
                    onChange={(e) => setEditTicket({ ...editTicket, teknisi: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nama teknisi..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Pembayaran</label>
                  <select
                    value={editTicket.pembayaran || ''}
                    onChange={(e) => setEditTicket({ ...editTicket, pembayaran: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">- Pilih -</option>
                    <option value="Cash">Cash</option>
                    <option value="TF">TF</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Location Map</label>
                  <input
                    type="text"
                    value={editTicket.locationMap}
                    onChange={(e) => setEditTicket({ ...editTicket, locationMap: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={editTicket.description || ''}
                    onChange={(e) => setEditTicket({ ...editTicket, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Installed Date</label>
                  <input
                    type="date"
                    value={editTicket.installedDate ? new Date(editTicket.installedDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditTicket({ ...editTicket, installedDate: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Update House Photo</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0]
                        if (file.size > 3 * 1024 * 1024) {
                          alert('Max file size 3MB')
                          e.target.value = ''
                          setEditFile(null)
                          return
                        }
                        setEditFile(file)
                      }
                    }}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-gray-300"
                  />
                  <p className="text-xs text-gray-500 mt-1">Max 3MB (.jpg, .png)</p>
                </div>
                
                {['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(role) && (
                    <div>
                     <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Pengawalan</label>
                     <select
                       value={(editTicket.pengawalan || 'tidak').toLowerCase()}
                       onChange={(e) => setEditTicket({ ...editTicket, pengawalan: e.target.value })}
                       className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                     >
                       <option value="tidak">No</option>
                       <option value="onsite">Onsite</option>
                       <option value="onchat">Onchat</option>
                     </select>
                   </div>
                 )}

                {['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(role) && (
                   <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">KMZ</label>
                    <input
                      type="text"
                      value={editTicket.kmz || ''}
                      onChange={(e) => setEditTicket({ ...editTicket, kmz: e.target.value })}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {canEditStatus && (
                   <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select
                      value={editTicket.status}
                      onChange={(e) => setEditTicket({ ...editTicket, status: normalizeStatus(e.target.value) })}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="ON_PROGRESS">ON PROGRESS</option>
                      <option value="CLOSE">CLOSE</option>
                      <option value="PENDING">PENDING</option>
                    </select>
                  </div>
                )}
              </div>
              </div>

              <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80">
                <button
                  type="button"
                  onClick={() => setEditTicket(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingId === editTicket.id}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingId === editTicket.id ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
