'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Search, Plus, X, Edit3, Trash2, Calendar, CheckCircle2, Clock, FileText } from 'lucide-react'
import { clsx } from 'clsx'

interface ContentItem {
  id: number
  title: string
  content: string | null
  contentType: string
  platform: string
  status: string
  publishDate: string | null
  creatorId: number | null
  creator: { id: number; name: string; username: string } | null
  notes: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface ContentCalendarViewProps {
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

const CONTENT_TYPES = ['POST', 'REEL', 'VIDEO', 'STORY', 'CAROUSEL']
const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'WEBSITE']
const STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED']

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: 'bg-gradient-to-r from-purple-500 to-pink-500',
  FACEBOOK: 'bg-blue-600',
  TIKTOK: 'bg-black',
  YOUTUBE: 'bg-red-600',
  WEBSITE: 'bg-green-600'
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  SCHEDULED: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  PUBLISHED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
}

export function ContentCalendarView({ userRole, initialDivision = 'ALL' }: ContentCalendarViewProps) {
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [platformFilter, setPlatformFilter] = useState('ALL')
  const [division, setDivision] = useState(initialDivision)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    contentType: 'POST',
    platform: 'INSTAGRAM',
    status: 'DRAFT',
    publishDate: '',
    notes: '',
    tags: ''
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

  const fetchContent = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (platformFilter !== 'ALL') params.set('platform', platformFilter)

      const res = await fetch(`/api/content-calendar?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setContentItems(data)
      }
    } catch (error) {
      console.error('Error fetching content:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContent()
  }, [statusFilter, platformFilter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      const data = { ...formData, tags: tagsArray }

      const url = editId ? `/api/content-calendar/${editId}` : '/api/content-calendar'
      const method = editId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        await fetchContent()
        setIsModalOpen(false)
        setEditId(null)
        setFormData({
          title: '',
          content: '',
          contentType: 'POST',
          platform: 'INSTAGRAM',
          status: 'DRAFT',
          publishDate: '',
          notes: '',
          tags: ''
        })
      }
    } catch (error) {
      console.error('Error submitting content:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (item: ContentItem) => {
    setEditId(item.id)
    setFormData({
      title: item.title,
      content: item.content || '',
      contentType: item.contentType,
      platform: item.platform,
      status: item.status,
      publishDate: item.publishDate ? format(new Date(item.publishDate), "yyyy-MM-dd'T'HH:mm") : '',
      notes: item.notes || '',
      tags: item.tags.join(', ')
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus konten ini?')) return
    try {
      const res = await fetch(`/api/content-calendar/${id}`, { method: 'DELETE' })
      if (res.ok) await fetchContent()
    } catch (error) {
      console.error('Error deleting content:', error)
    }
  }

  const filteredContent = contentItems.filter(item =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    (item.content?.toLowerCase() || '').includes(search.toLowerCase()) ||
    item.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kelola jadwal dan konten marketing digital</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
            Tambah Konten
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari konten..."
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
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-white"
        >
          <option value="ALL">Semua Platform</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Content List */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : filteredContent.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Belum ada konten</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredContent.map((item) => (
              <div key={item.id} className="p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', PLATFORM_COLORS[item.platform], 'text-white')}>
                        {item.platform}
                      </span>
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[item.status])}>
                        {item.status === 'PUBLISHED' && <CheckCircle2 className="h-3 w-3" />}
                        {item.status === 'SCHEDULED' && <Clock className="h-3 w-3" />}
                        {item.status === 'DRAFT' && <FileText className="h-3 w-3" />}
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{item.contentType}</p>
                    {item.content && <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{item.content}</p>}
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {item.tags.map(tag => (
                          <span key={tag} className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.publishDate && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(item.publishDate), 'dd/MM/yyyy HH:mm')}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(item.id)}
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
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 dark:bg-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editId ? 'Edit Konten' : 'Tambah Konten'}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe Konten</label>
                  <select
                    value={formData.contentType}
                    onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  >
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platform</label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  >
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Konten</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Publish</label>
                  <input
                    type="datetime-local"
                    value={formData.publishDate}
                    onChange={(e) => setFormData({ ...formData, publishDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (pisahkan dengan koma)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="promo, paket1, psb"
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
