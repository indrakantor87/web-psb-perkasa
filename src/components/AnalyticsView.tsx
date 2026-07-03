'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Plus, X, TrendingUp, Eye, ThumbsUp, MessageCircle, Share2, Bookmark, MousePointerClick, Users } from 'lucide-react'
import { clsx } from 'clsx'

interface AnalyticsData {
  id: number
  contentId: number | null
  content: { id: number; title: string } | null
  campaignId: number | null
  campaign: { id: number; name: string } | null
  platform: string
  date: string
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  followersGain: number
  createdAt: string
}

interface AnalyticsSummary {
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  followersGain: number
}

interface AnalyticsViewProps {
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

const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'WEBSITE']

export function AnalyticsView({ userRole, initialDivision = 'ALL' }: AnalyticsViewProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('ALL')
  const [division, setDivision] = useState(initialDivision)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    contentId: '',
    campaignId: '',
    platform: 'INSTAGRAM',
    date: '',
    reach: '',
    impressions: '',
    likes: '',
    comments: '',
    shares: '',
    saves: '',
    clicks: '',
    followersGain: ''
  })

  useEffect(() => {
    const d = getDivisionFromUrl()
    if (d && d !== division) setDivision(d)
  }, [division])

  const roleUpper = (userRole || '').toUpperCase()
  const isAdmin = roleUpper === 'ADMIN'
  const isCreator = roleUpper === 'CREATOR_DIGITAL' || isAdmin
  const canEdit = isCreator

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (platformFilter !== 'ALL') params.set('platform', platformFilter)

      const res = await fetch(`/api/content-analytics?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setAnalytics(data.analytics)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [platformFilter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const data = {
        ...formData,
        contentId: formData.contentId || null,
        campaignId: formData.campaignId || null,
        reach: parseInt(formData.reach) || 0,
        impressions: parseInt(formData.impressions) || 0,
        likes: parseInt(formData.likes) || 0,
        comments: parseInt(formData.comments) || 0,
        shares: parseInt(formData.shares) || 0,
        saves: parseInt(formData.saves) || 0,
        clicks: parseInt(formData.clicks) || 0,
        followersGain: parseInt(formData.followersGain) || 0
      }

      const res = await fetch('/api/content-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        await fetchAnalytics()
        setIsModalOpen(false)
        setFormData({
          contentId: '',
          campaignId: '',
          platform: 'INSTAGRAM',
          date: '',
          reach: '',
          impressions: '',
          likes: '',
          comments: '',
          shares: '',
          saves: '',
          clicks: '',
          followersGain: ''
        })
      }
    } catch (error) {
      console.error('Error submitting analytics:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const StatCard = ({ icon: Icon, label, value, color = 'text-gray-900 dark:text-white' }: { icon: any; label: string; value: number; color?: string }) => (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-700">
          <Icon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={clsx('text-2xl font-bold', color)}>{value.toLocaleString('id-ID')}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Lihat performa konten dan campaign</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
            Tambah Data
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-1">
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="w-full md:w-64 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-white"
        >
          <option value="ALL">Semua Platform</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Eye} label="Reach" value={summary.reach} />
          <StatCard icon={TrendingUp} label="Impressions" value={summary.impressions} />
          <StatCard icon={ThumbsUp} label="Likes" value={summary.likes} color="text-blue-600 dark:text-blue-400" />
          <StatCard icon={MessageCircle} label="Comments" value={summary.comments} color="text-purple-600 dark:text-purple-400" />
          <StatCard icon={Share2} label="Shares" value={summary.shares} color="text-green-600 dark:text-green-400" />
          <StatCard icon={Bookmark} label="Saves" value={summary.saves} color="text-amber-600 dark:text-amber-400" />
          <StatCard icon={MousePointerClick} label="Clicks" value={summary.clicks} color="text-red-600 dark:text-red-400" />
          <StatCard icon={Users} label="Followers Gain" value={summary.followersGain} color="text-indigo-600 dark:text-indigo-400" />
        </div>
      )}

      {/* Analytics List */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : analytics.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Belum ada data analytics</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Platform</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Konten/Campaign</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Reach</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Impressions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Likes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Comments</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Shares</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {analytics.map((data) => (
                  <tr key={data.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {format(new Date(data.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{data.platform}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {data.content?.title || data.campaign?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{data.reach.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{data.impressions.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{data.likes.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{data.comments.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{data.shares.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{data.clicks.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tambah Data Analytics</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Konten (Opsional)</label>
                  <input
                    type="number"
                    value={formData.contentId}
                    onChange={(e) => setFormData({ ...formData, contentId: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
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
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reach</label>
                  <input
                    type="number"
                    value={formData.reach}
                    onChange={(e) => setFormData({ ...formData, reach: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Impressions</label>
                  <input
                    type="number"
                    value={formData.impressions}
                    onChange={(e) => setFormData({ ...formData, impressions: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Likes</label>
                  <input
                    type="number"
                    value={formData.likes}
                    onChange={(e) => setFormData({ ...formData, likes: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Comments</label>
                  <input
                    type="number"
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shares</label>
                  <input
                    type="number"
                    value={formData.shares}
                    onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Saves</label>
                  <input
                    type="number"
                    value={formData.saves}
                    onChange={(e) => setFormData({ ...formData, saves: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clicks</label>
                  <input
                    type="number"
                    value={formData.clicks}
                    onChange={(e) => setFormData({ ...formData, clicks: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Followers Gain</label>
                  <input
                    type="number"
                    value={formData.followersGain}
                    onChange={(e) => setFormData({ ...formData, followersGain: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-white dark:focus:border-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
