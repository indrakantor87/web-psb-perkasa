'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Search, Plus, X, Edit3, Trash2, Phone, Mail, MessageSquare, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'

interface DigitalLead {
  id: number
  name: string
  phone: string
  email: string | null
  source: string
  campaignId: number | null
  campaign: { id: number; name: string } | null
  message: string | null
  status: string
  notes: string | null
  convertedToTicketId: number | null
  convertedToTicket: { id: number; customerName: string } | null
  createdById: number | null
  createdBy: { id: number; name: string; username: string } | null
  createdAt: string
  updatedAt: string
}

interface DigitalLeadViewProps {
  userRole: string
  initialDivision?: 'ALL' | 'PENJUALAN' | 'CS_ADMIN' | 'NOC_TROUBLESHOOTS' | 'CREATOR_DIGITAL'
}

function getDivisionFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get('division')
    if (raw === 'ALL' || raw === 'PENJUALAN' || raw === 'CS_ADMIN' || raw === 'NOC_TROUBLESHOOTS' || raw === 'CREATOR_DIGITAL') {
      return raw
    }
  } catch {}
  return null
}

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']
const SOURCES = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'WEBSITE', 'REFERENSI']

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CONTACTED: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  QUALIFIED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  CONVERTED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  LOST: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  INSTAGRAM: <div className="h-4 w-4 rounded bg-gradient-to-r from-purple-500 to-pink-500" />,
  FACEBOOK: <div className="h-4 w-4 rounded bg-blue-600" />,
  TIKTOK: <div className="h-4 w-4 rounded bg-black" />,
  WEBSITE: <div className="h-4 w-4 rounded bg-green-600" />,
  REFERENSI: <div className="h-4 w-4 rounded bg-orange-500" />
}

export function DigitalLeadView({ userRole, initialDivision = 'ALL' }: DigitalLeadViewProps) {
  const [leads, setLeads] = useState<DigitalLead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [division, setDivision] = useState(initialDivision)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'INSTAGRAM',
    campaignId: '',
    message: '',
    status: 'NEW',
    notes: '',
    convertedToTicketId: ''
  })

  useEffect(() => {
    const d = getDivisionFromUrl()
    if (d && d !== division) setDivision(d)
  }, [division])

  const roleUpper = (userRole || '').toUpperCase()
  const isAdmin = roleUpper === 'ADMIN'
  const isCreator = roleUpper === 'CREATOR_DIGITAL' || isAdmin
  const isSales = roleUpper === 'PENJUALAN' || isAdmin
  const canEdit = isCreator || isSales
  const canDelete = isCreator || isAdmin

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter)

      const res = await fetch(`/api/digital-leads?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLeads(data)
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [statusFilter, sourceFilter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const data = {
        ...formData,
        campaignId: formData.campaignId || null,
        convertedToTicketId: formData.convertedToTicketId || null
      }

      const url = editId ? `/api/digital-leads/${editId}` : '/api/digital-leads'
      const method = editId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        await fetchLeads()
        setIsModalOpen(false)
        setEditId(null)
        setFormData({
          name: '',
          phone: '',
          email: '',
          source: 'INSTAGRAM',
          campaignId: '',
          message: '',
          status: 'NEW',
          notes: '',
          convertedToTicketId: ''
        })
      }
    } catch (error) {
      console.error('Error submitting lead:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (lead: DigitalLead) => {
    setEditId(lead.id)
    setFormData({
      name: lead.name,
      phone: lead.phone,
      email: lead.email || '',
      source: lead.source,
      campaignId: lead.campaignId?.toString() || '',
      message: lead.message || '',
      status: lead.status,
      notes: lead.notes || '',
      convertedToTicketId: lead.convertedToTicketId?.toString() || ''
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus lead ini?')) return
    try {
      const res = await fetch(`/api/digital-leads/${id}`, { method: 'DELETE' })
      if (res.ok) await fetchLeads()
    } catch (error) {
      console.error('Error deleting lead:', error)
    }
  }

  const filteredLeads = leads.filter(lead =>
    lead.name.toLowerCase().includes(search.toLowerCase()) ||
    lead.phone.toLowerCase().includes(search.toLowerCase()) ||
    (lead.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (lead.message?.toLowerCase() || '').includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Digital Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kelola leads dari channel digital</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
            Tambah Lead
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-white"
        >
          <option value="ALL">Semua Status</option>
          {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-white"
        >
          <option value="ALL">Semua Sumber</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Leads List */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Belum ada lead</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {SOURCE_ICONS[lead.source]}
                        <h3 className="font-semibold text-gray-900 dark:text-white">{lead.name}</h3>
                      </div>
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[lead.status])}>
                        {lead.status}
                      </span>
                      {lead.campaign && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {lead.campaign.name}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300 mb-2">
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                        <Phone className="h-4 w-4" />
                        {lead.phone}
                      </a>
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
                          <Mail className="h-4 w-4" />
                          {lead.email}
                        </a>
                      )}
                    </div>
                    {lead.message && (
                      <div className="mb-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <MessageSquare className="h-3 w-3" />
                          Pesan:
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                          {lead.message}
                        </p>
                      </div>
                    )}
                    {lead.notes && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Catatan: {lead.notes}</p>
                    )}
                    {lead.convertedToTicket && (
                      <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                        <ExternalLink className="h-4 w-4" />
                        Sudah dikonversi ke PSB #{lead.convertedToTicket.id}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {format(new Date(lead.createdAt), 'dd/MM/yyyy HH:mm')}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(lead)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-gray-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editId ? 'Edit Lead' : 'Tambah Lead'}
              </h2>
              <button
                onClick={() => { setIsModalOpen(false); setEditId(null); }}
                className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No. HP</label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email (Opsional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sumber</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  >
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  >
                    {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Campaign (Opsional)</label>
                <input
                  type="number"
                  value={formData.campaignId}
                  onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pesan</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Ticket PSB (jika dikonversi)</label>
                <input
                  type="number"
                  value={formData.convertedToTicketId}
                  onChange={(e) => setFormData({ ...formData, convertedToTicketId: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditId(null); }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  {isSubmitting ? 'Simpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
