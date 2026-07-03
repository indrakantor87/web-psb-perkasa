'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Search, Plus, X, Edit3, Trash2, Calendar, Target, DollarSign } from 'lucide-react'
import { clsx } from 'clsx'

interface Campaign {
  id: number
  name: string
  description: string | null
  startDate: string
  endDate: string | null
  budget: number | null
  status: string
  objectives: string[]
  platforms: string[]
  createdById: number | null
  createdBy: { id: number; name: string; username: string } | null
  createdAt: string
  updatedAt: string
}

interface CampaignViewProps {
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

const CAMPAIGN_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED']
const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'WEBSITE']

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PAUSED: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  COMPLETED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
}

export function CampaignView({ userRole, initialDivision = 'ALL' }: CampaignViewProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [division, setDivision] = useState(initialDivision)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    budget: '',
    status: 'ACTIVE',
    objectives: '',
    platforms: [] as string[]
  })

  useEffect(() => {
    const d = getDivisionFromUrl()
    if (d && d !== division) setDivision(d)
  }, [division])

  const roleUpper = (userRole || '').toUpperCase()
  const isAdmin = roleUpper === 'ADMIN'
  const isCreator = roleUpper === 'CREATOR_DIGITAL' || isAdmin
  const canEdit = isCreator
  const canDelete = isCreator

  const fetchCampaigns = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)

      const res = await fetch(`/api/campaigns?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setCampaigns(data)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [statusFilter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const objectivesArray = formData.objectives.split('\n').map(o => o.trim()).filter(Boolean)
      const data = {
        ...formData,
        objectives: objectivesArray,
        budget: formData.budget ? parseFloat(formData.budget) : null
      }

      const url = editId ? `/api/campaigns/${editId}` : '/api/campaigns'
      const method = editId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        await fetchCampaigns()
        setIsModalOpen(false)
        setEditId(null)
        setFormData({
          name: '',
          description: '',
          startDate: '',
          endDate: '',
          budget: '',
          status: 'ACTIVE',
          objectives: '',
          platforms: []
        })
      }
    } catch (error) {
      console.error('Error submitting campaign:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (campaign: Campaign) => {
    setEditId(campaign.id)
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      startDate: format(new Date(campaign.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: campaign.endDate ? format(new Date(campaign.endDate), "yyyy-MM-dd'T'HH:mm") : '',
      budget: campaign.budget?.toString() || '',
      status: campaign.status,
      objectives: campaign.objectives.join('\n'),
      platforms: campaign.platforms
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus campaign ini?')) return
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      if (res.ok) await fetchCampaigns()
    } catch (error) {
      console.error('Error deleting campaign:', error)
    }
  }

  const filteredCampaigns = campaigns.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.description?.toLowerCase() || '').includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaign Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kelola campaign marketing digital</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
            Tambah Campaign
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari campaign..."
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
          {CAMPAIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Campaign List */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Belum ada campaign</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredCampaigns.map((campaign) => (
              <div key={campaign.id} className="p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{campaign.name}</h3>
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[campaign.status])}>
                        {campaign.status}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{campaign.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(campaign.startDate), 'dd/MM/yyyy')}
                        {campaign.endDate && ` - ${format(new Date(campaign.endDate), 'dd/MM/yyyy')}`}
                      </div>
                      {campaign.budget && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          Rp {campaign.budget.toLocaleString('id-ID')}
                        </div>
                      )}
                    </div>
                    {campaign.objectives.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tujuan:</p>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc list-inside">
                          {campaign.objectives.map((obj, idx) => (
                            <li key={idx}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {campaign.platforms.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {campaign.platforms.map(platform => (
                          <span key={platform} className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {platform}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(campaign)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(campaign.id)}
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
                {editId ? 'Edit Campaign' : 'Tambah Campaign'}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Campaign</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deskripsi</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Mulai</label>
                  <input
                    required
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Selesai</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budget (Opsional)</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  >
                    {CAMPAIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tujuan (satu per baris)</label>
                <textarea
                  value={formData.objectives}
                  onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                  rows={4}
                  placeholder="Tingkatkan awareness&#10;Dapatkan 100 leads&#10;Naikkan penjualan 20%"
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platform</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(platform => (
                    <label key={platform} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600">
                      <input
                        type="checkbox"
                        checked={formData.platforms.includes(platform)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, platforms: [...formData.platforms, platform] })
                          } else {
                            setFormData({ ...formData, platforms: formData.platforms.filter(p => p !== platform) })
                          }
                        }}
                        className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-800"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">{platform}</span>
                    </label>
                  ))}
                </div>
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
