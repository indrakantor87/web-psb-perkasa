'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Ticket {
  id: number
  customerName: string
  birthDate?: string | null
  locationMap: string
  requestDate: string
  installedDate: string | null
  package: string
  marketingName: string
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

interface Priority {
  id: number
  name: string
  color: string
}

interface TicketListProps {
  tickets: Ticket[]
  userRole: string
  initialPeriod: { month: number; year: number }
  initialStatus?: string
  initialMarketing?: string
  pagination?: {
    currentPage: number
    totalPages: number
    totalCount: number
  }
  counts?: {
    OPEN: number
    ON_PROGRESS: number
    CLOSE: number
    PENDING: number
  }
}

export function TicketList({ tickets, userRole, initialPeriod, initialStatus, initialMarketing, pagination, counts }: TicketListProps) {
  const router = useRouter()
  const isMarketing = userRole === 'MARKETING'
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [month, setMonth] = useState(initialPeriod.month)
  const [year, setYear] = useState(initialPeriod.year)
  const [status, setStatus] = useState((initialStatus || 'ALL').toUpperCase())
  const [marketing, setMarketing] = useState(initialMarketing || '')
  const [kmzEdit, setKmzEdit] = useState<{ id: number; value: string } | null>(null)
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [activeActionId, setActiveActionId] = useState<number | null>(null)
  const [summaryTicket, setSummaryTicket] = useState<Ticket | null>(null)
  const [editTicket, setEditTicket] = useState<Ticket | null>(null)
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null)
  // Local state for tickets to support optimistic updates
  const [ticketsState, setTicketsState] = useState(tickets)
  const colSpan = userRole !== 'MARKETING' ? 17 : 16

  // Sync local state when props change
  useEffect(() => {
    setTicketsState(tickets)
  }, [tickets])
  
  // Pagination from props (Server Side)
  const currentPage = pagination?.currentPage || 1
  const totalPages = pagination?.totalPages || 1
  const totalCount = pagination?.totalCount || tickets.length

  useEffect(() => {
    const fetchPriorities = async () => {
      try {
        const res = await fetch('/api/priorities')
        if (res.ok) {
          const data = await res.json()
          setPriorities(data)
        }
      } catch (error) {
        console.error('Failed to fetch priorities', error)
      }
    }
    fetchPriorities()
  }, [])

  const getPriorityColor = (priorityName: string | null | undefined) => {
    if (!priorityName) return 'bg-gray-200 text-gray-800'
    const found = priorities.find(p => p.name === priorityName)
    return found ? found.color : 'bg-gray-200 text-gray-800'
  }

  const handleFilter = () => {
    const base = `/list?month=${month}&year=${year}`
    const statusPart = status === 'ALL' ? '' : `&status=${status}`
    const marketingPart = marketing.trim() ? `&marketing=${encodeURIComponent(marketing.trim())}` : ''
    const url = `${base}${statusPart}${marketingPart}`
    router.push(url)
  }

  const handleCloseTicket = async (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    // Safety check: Stop execution if user cancels confirmation
    if (!confirm('Apakah Anda yakin ingin menutup tiket ini?')) {
      return
    }

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
        alert('Gagal menutup tiket')
      }
    } catch (error) {
      alert('Terjadi kesalahan saat menutup tiket')
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
        alert('Gagal mengubah status ke On Progress')
        router.refresh() // Revert
      }
    } catch (error) {
      alert('Terjadi kesalahan saat mengubah status')
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  const handleUpdatePengawalan = async (id: number, value: string) => {
    // Optimistic update
    setTicketsState(prev => prev.map(t => 
      t.id === id ? { ...t, pengawalan: value } : t
    ))

    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pengawalan: value }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        // Revert on failure
        alert('Failed to update pengawalan')
        router.refresh()
      }
    } catch (error) {
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
    } catch (error) {
      alert('Error updating pembayaran')
      router.refresh()
    }
  }

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
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

  const canClose = ['ADMIN', 'CS', 'NOC'].includes(userRole)
  const canEditKmz = ['ADMIN', 'CS', 'NOC'].includes(userRole)
  const canEditPriority = ['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(userRole)
  const canDelete = ['ADMIN', 'CS', 'NOC'].includes(userRole)

  const handleEditTicket = (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    // Find the ticket to edit
    const ticketToEdit = ticketsState.find(t => t.id === id)
    if (ticketToEdit) {
      setEditTicket(ticketToEdit)
    }
    setActiveActionId(null)
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

      const res = await fetch(`/api/tickets/${editTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: editTicket.customerName,
          birthDate: editTicket.birthDate,
          locationMap: editTicket.locationMap,
          phoneNumber: editTicket.phoneNumber,
          package: editTicket.package,
          marketingName: editTicket.marketingName,
          description: editTicket.description,
          status: editTicket.status,
          pengawalan: editTicket.pengawalan,
          kmz: editTicket.kmz,
          priority: editTicket.priority
        }),
      })

      if (res.ok) {
        setEditTicket(null)
        router.refresh()
      } else {
        alert('Gagal mengupdate tiket')
        router.refresh() // Revert
      }
    } catch (error) {
      alert('Terjadi kesalahan saat update')
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
      } catch (error) {
        alert('Terjadi kesalahan saat menghapus data')
      } finally {
        setLoadingId(null)
      }
    }
  }

  const handleStartEditKmz = (id: number, currentValue?: string | null) => {
    setKmzEdit({ id, value: currentValue || '' })
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
    } catch (e) {
      alert('Error menyimpan KMZ')
      router.refresh()
    }
  }

  const handleUpdatePriority = async (id: number, value: string) => {
    // Determine status based on priority value
    // If priority is selected -> PENDING
    // If priority is reset (empty) -> OPEN
    const newStatus = value ? 'PENDING' : 'OPEN'

    // Optimistic update
    setTicketsState(prev => prev.map(t => 
      t.id === id ? { ...t, priority: value, status: newStatus } : t
    ))

    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: value || null, status: newStatus }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        alert('Gagal mengubah prioritas')
        router.refresh()
      }
    } catch (error) {
      alert('Error mengubah prioritas')
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
      if (status !== 'ALL') params.set('status', status)
      if (marketing) params.set('marketing', marketing)

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
        'Prioritas': ticket.priority || '-',
        'Keterangan': ticket.description || '-',
        'Pembayaran': ticket.pembayaran || '-',
        'Status': ticket.status,
        'No HP': ticket.phoneNumber,
        'Closed By': ticket.closedBy?.name || '-'
      }))

      const worksheet = XLSX.utils.json_to_sheet(dataToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets')
      XLSX.writeFile(workbook, `Tickets_Export_${format(new Date(), 'dd-MM-yyyy')}.xlsx`)
    } catch (error) {
      console.error('Export error:', error)
      alert('Gagal mengexport data. Silakan coba lagi.')
    } finally {
      setIsExporting(false)
    }
  }

  // Pagination Logic
  const currentTickets = ticketsState
  const indexOfFirstItem = (currentPage - 1) * 20
  const indexOfLastItem = indexOfFirstItem + currentTickets.length

  const handlePageChange = (newPage: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set('page', newPage.toString())
    router.push(url.pathname + url.search)
  }

  return (
    <div className="space-y-2">
      {userRole !== 'MARKETING' && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <div className="rounded-md bg-red-600 dark:bg-red-700 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">
              Ticket Open : {counts?.OPEN ?? 0}
            </span>
          </div>
          <div className="rounded-md bg-blue-600 dark:bg-blue-700 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">
              Ticket On Progress : {counts?.ON_PROGRESS ?? 0}
            </span>
          </div>
          <div className="rounded-md bg-green-600 dark:bg-green-700 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">
              Ticket Close : {counts?.CLOSE ?? 0}
            </span>
          </div>
          <div className="rounded-md bg-yellow-500 dark:bg-yellow-600 px-3 py-1 shadow-sm text-center">
            <span className="text-xs font-bold text-white">
              Ticket Pending : {counts?.PENDING ?? 0}
            </span>
          </div>
        </div>
      )}

      <div className="inline-flex flex-col space-y-1 rounded-lg bg-white dark:bg-gray-800 p-1.5 shadow-sm md:flex-row md:items-center md:space-y-0 md:space-x-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 ml-2 whitespace-nowrap">Filter:</h2>
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
                placeholder="Cari nama…"
              />
            </div>
          )}
          <div className="flex items-end h-full pt-3 space-x-2">
            <button
              onClick={handleFilter}
              className="w-full rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 md:w-auto"
            >
              Terapkan
            </button>
            <button
              onClick={handleExportExcel}
              className="w-full rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 md:w-auto"
            >
              Export Excel
            </button>
          </div>
        </div>
      </div>


      <div className="overflow-x-auto overflow-y-hidden rounded-lg bg-white dark:bg-gray-800 shadow-sm">
        <table className="min-w-full border-collapse border border-gray-200 dark:border-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700 hidden sm:table-header-group">
            <tr>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">No</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Nama Pelanggan</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Tanggal Lahir</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Maps Lokasi</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Tgl Request</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Tgl Terpasang</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Paket</th>
              {userRole !== 'MARKETING' && (
                <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Marketing</th>
              )}
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Foto Rumah</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Pengawalan</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">KMZ</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Pembayaran</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Keterangan</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Prioritas</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Status</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">Action</th>
              <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">No HP</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 text-center divide-y divide-gray-100 dark:divide-gray-700">
            {currentTickets.map((ticket, index) => (
              <Fragment key={ticket.id}>
                <tr key={ticket.id} className={clsx("hover:bg-gray-50 dark:hover:bg-gray-700", !isMarketing && "transition-colors")}>
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}
                        className="text-gray-500 hover:text-blue-600 dark:text-white dark:hover:text-blue-300 focus:outline-none"
                      >
                        {expandedTicketId === ticket.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <span>{indexOfFirstItem + index + 1}</span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-left text-xs text-gray-900 dark:text-white">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setSummaryTicket(ticket)
                      }}
                      className="text-left text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline focus:outline-none"
                    >
                      {ticket.customerName}
                    </button>
                  </td>
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {ticket.birthDate ? format(new Date(ticket.birthDate), 'dd/MM/yyyy') : '-'}
                  </td>
                  <td className="hidden sm:table-cell max-w-xs px-3 py-3 text-xs text-blue-600 dark:text-blue-400">
                    <a href={ticket.locationMap} target="_blank" rel="noreferrer" className="hover:underline">
                      Link Map
                    </a>
                  </td>
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(ticket.requestDate), 'dd/MM/yyyy')}
                  </td>
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {ticket.installedDate ? format(new Date(ticket.installedDate), 'dd/MM/yyyy') : '-'}
                  </td>
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{ticket.package}</td>
                  {userRole !== 'MARKETING' && (
                    <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{ticket.marketingName}</td>
                  )}

                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-blue-600 dark:text-blue-400">
                    {ticket.hasPhoto || ticket.fotoRumah ? (
                      <a href={ticket.fotoRumah || `/api/tickets/${ticket.id}/photo`} target="_blank" rel="noreferrer" className="hover:underline">
                        Lihat Foto
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-700 dark:text-gray-300 capitalize">
                    {ticket.pengawalan || '-'}
                  </td>
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-700 dark:text-gray-300">
                    {ticket.kmz || '-'}
                  </td>
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-700 dark:text-gray-300">
                    {ticket.pembayaran || '-'}
                  </td>
                  <td className="hidden sm:table-cell max-w-xs px-3 py-3 text-left text-xs text-gray-700 dark:text-gray-300" title={ticket.description || ''}>
                    <div className="line-clamp-3 whitespace-normal">
                      {ticket.description || '-'}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-3 text-xs">
                    {ticket.priority ? (
                      <span className={clsx('inline-flex items-center justify-center text-center whitespace-normal max-w-[120px] rounded-full px-2 py-0.5 text-[9px] leading-tight', getPriorityColor(ticket.priority))}>
                        {ticket.priority}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-3 py-3 text-xs">
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
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-gray-700 dark:text-gray-300">
                    {ticket.status === 'CLOSE' && ticket.closedBy?.name
                      ? `by ${ticket.closedBy.name}`
                      : '-'}
                  </td>
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 py-3 text-xs text-blue-600 dark:text-blue-400">
                    <a
                      href={`https://wa.me/${ticket.phoneNumber.replace(/^0/, '62').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {ticket.phoneNumber}
                    </a>
                  </td>
                  <td className="sm:hidden px-3 py-3 text-left text-xs text-gray-900 dark:text-white">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}
                            className="text-gray-500 hover:text-blue-600 dark:text-white dark:hover:text-blue-300 focus:outline-none"
                          >
                            {expandedTicketId === ticket.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <span className="text-gray-500 dark:text-gray-400">{indexOfFirstItem + index + 1}</span>
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
                        <a href={ticket.locationMap} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Link Map</a>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Tgl Request:</span> {format(new Date(ticket.requestDate), 'dd/MM/yyyy')}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        <span className="font-medium">Tgl Terpasang:</span> {ticket.installedDate ? format(new Date(ticket.installedDate), 'dd/MM/yyyy') : '-'}
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
                        <span className="font-medium">Foto:</span>{' '}
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
                        <span className="font-medium">Pengawalan:</span> {ticket.pengawalan || '-'}
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
                        <span className="font-medium">Prioritas:</span> {ticket.priority || '-'}
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
                                value={(ticket.pengawalan || 'tidak').toLowerCase()}
                                onChange={(e) => handleUpdatePengawalan(ticket.id, e.target.value)}
                                className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white text-xs py-1.5 focus:border-blue-500 focus:ring-blue-500"
                              >
                                <option value="tidak">Tidak</option>
                                <option value="onsite">Onsite</option>
                                <option value="onchat">Onchat</option>
                              </select>
                            ) : (
                              <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">{ticket.pengawalan || '-'}</div>
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
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Prioritas</label>
                              {canEditPriority ? (
                                <select
                                  value={ticket.priority || ''}
                                  onChange={(e) => handleUpdatePriority(ticket.id, e.target.value)}
                                  className="w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-black dark:text-white text-xs py-1.5 focus:border-blue-500 focus:ring-blue-500"
                                >
                                  <option value="">- Pilih -</option>
                                  {priorities.length > 0 ? priorities.map((p) => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                  )) : (
                                    <>
                                      <option value="LOW">LOW</option>
                                      <option value="MEDIUM">MEDIUM</option>
                                      <option value="HIGH">HIGH</option>
                                    </>
                                  )}
                                </select>
                              ) : (
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {ticket.priority ? (
                                    <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-xs', getPriorityColor(ticket.priority))}>
                                      {ticket.priority}
                                    </span>
                                  ) : '-'}
                                </div>
                              )}
                            </div>
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
                                      placeholder="Isi/ubah KMZ di sini"
                                    />
                                    <button
                                      onClick={() => handleSaveKmz(ticket.id, (kmzEdit?.id === ticket.id ? kmzEdit.value : (ticket.kmz || '')))}
                                      className="rounded bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-700"
                                    >
                                      Simpan
                                    </button>
                                    {kmzEdit?.id === ticket.id && (
                                      <button
                                        onClick={() => setKmzEdit(null)}
                                        className="rounded bg-gray-100 dark:bg-gray-600 px-2 py-1 text-[10px] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500"
                                      >
                                        Batal
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
                                <button
                                  onClick={(e) => handleOnProgressTicket(e, ticket.id)}
                                  disabled={loadingId === ticket.id || !(['OPEN', 'PENDING'].includes(ticket.status) && canClose)}
                                  className="rounded-md bg-blue-50 text-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-100 disabled:opacity-50 border border-blue-200"
                                >
                                  Set On Progress
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
                                    Hapus
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
                <td colSpan={20} className="border border-gray-200 dark:border-gray-700 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 italic">
                  Tidak ada data untuk periode ini
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between space-y-2 py-1 mt-1 md:flex-row md:space-y-0">
        <div className="text-xs text-gray-700 dark:text-gray-300">
          Menampilkan <span className="font-medium">{ticketsState.length > 0 ? indexOfFirstItem + 1 : 0}</span> sampai{' '}
          <span className="font-medium">{Math.min(indexOfLastItem, totalCount)}</span> dari{' '}
          <span className="font-medium">{totalCount}</span> hasil
        </div>
        
        <div className="flex items-center space-x-2">
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
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Ringkasan Ticket</h3>
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
                      <span className="font-medium text-gray-500 dark:text-gray-400">Nama</span>{'\t'}
                      <span className="font-medium text-gray-400 dark:text-gray-500">:</span> <span className="text-gray-900 dark:text-white">{summaryTicket.customerName}</span>
                    </div>
                    <div className="whitespace-pre-wrap" style={{ tabSize: '130px' }}>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Tanggal Lahir</span>{'\t'}
                      <span className="font-medium text-gray-400 dark:text-gray-500">:</span> <span className="text-gray-900 dark:text-white">{summaryTicket.birthDate ? format(new Date(summaryTicket.birthDate), 'dd/MM/yyyy') : '-'}</span>
                    </div>
                    <div className="whitespace-pre-wrap" style={{ tabSize: '130px' }}>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Maps Lokasi</span>{'\t'}
                      <span className="font-medium text-gray-400 dark:text-gray-500">:</span> <span className="text-gray-900 dark:text-white break-all">{summaryTicket.locationMap}</span>
                    </div>
                    <div className="whitespace-pre-wrap" style={{ tabSize: '130px' }}>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Nomor HP</span>{'\t'}
                      <span className="font-medium text-gray-400 dark:text-gray-500">:</span> <span className="text-gray-900 dark:text-white">{summaryTicket.phoneNumber}</span>
                    </div>
                    <div className="whitespace-pre-wrap" style={{ tabSize: '130px' }}>
                      <span className="font-medium text-gray-500 dark:text-gray-400">Paket</span>{'\t'}
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
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-xl ring-1 ring-gray-200 dark:ring-gray-700">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Tiket</h3>
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
            
            <form onSubmit={handleUpdateTicket} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Pelanggan</label>
                  <input
                    type="text"
                    value={editTicket.customerName}
                    onChange={(e) => setEditTicket({ ...editTicket, customerName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nomor HP</label>
                  <input
                    type="text"
                    value={editTicket.phoneNumber}
                    onChange={(e) => setEditTicket({ ...editTicket, phoneNumber: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Paket</label>
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
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Link Maps</label>
                  <input
                    type="text"
                    value={editTicket.locationMap}
                    onChange={(e) => setEditTicket({ ...editTicket, locationMap: e.target.value })}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan</label>
                  <textarea
                    value={editTicket.description || ''}
                    onChange={(e) => setEditTicket({ ...editTicket, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {['ADMIN', 'CS', 'NOC', 'TEKNISI'].includes(userRole) && (
                   <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Prioritas</label>
                    <select
                      value={editTicket.priority || ''}
                      onChange={(e) => setEditTicket({ ...editTicket, priority: e.target.value })}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">- Pilih -</option>
                      {priorities.map((p) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {['ADMIN', 'CS', 'NOC'].includes(userRole) && (
                    <div>
                     <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Pengawalan</label>
                     <select
                       value={(editTicket.pengawalan || 'tidak').toLowerCase()}
                       onChange={(e) => setEditTicket({ ...editTicket, pengawalan: e.target.value })}
                       className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                     >
                       <option value="tidak">Tidak</option>
                       <option value="onsite">Onsite</option>
                       <option value="onchat">Onchat</option>
                     </select>
                   </div>
                 )}

                {['ADMIN', 'CS', 'NOC'].includes(userRole) && (
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

                {['ADMIN', 'CS', 'NOC'].includes(userRole) && (
                   <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select
                      value={editTicket.status}
                      onChange={(e) => setEditTicket({ ...editTicket, status: e.target.value })}
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

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setEditTicket(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingId === editTicket.id}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingId === editTicket.id ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
