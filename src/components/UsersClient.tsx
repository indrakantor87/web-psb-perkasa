'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Eye, EyeOff, KeyRound, Trash2, UserPlus, Shield } from 'lucide-react'
import { clsx } from 'clsx'

interface User {
  id: number
  name: string
  username: string
  role: string
  division?: string | null
  createdAt: string
}

interface UsersClientProps {
  currentUser: {
    role: string
    username: string
  }
}

const ROLE_OPTIONS = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'CS', label: 'Customer Service (CS)' },
  { value: 'ADMIN_CS', label: 'Admin CS' },
  { value: 'NOC', label: 'NOC' },
  { value: 'TEKNISI', label: 'Teknisi' },
  { value: 'TROUBLESHOOTS', label: 'Troubleshoots' },
  { value: 'CREATOR_DIGITAL', label: 'Creator Digital' },
] as const

const DIVISION_OPTIONS = [
  { value: 'ALL', label: 'Semua Division' },
  { value: 'PENJUALAN', label: 'Penjualan' },
  { value: 'CS_ADMIN', label: 'CS & Admin CS' },
  { value: 'NOC_TROUBLESHOOTS', label: 'NOC & Troubleshoots' },
  { value: 'CREATOR_DIGITAL', label: 'Creator Digital' },
] as const

function formatDivisionLabel(division?: string | null) {
  const normalized = String(division ?? '').trim().toUpperCase()
  const found = DIVISION_OPTIONS.find((option) => option.value === normalized)
  return found?.label ?? '-'
}

function mapRoleToDivision(role: string) {
  const roleUpper = String(role ?? '').trim().toUpperCase()
  if (roleUpper === 'MARKETING') return 'PENJUALAN'
  if (roleUpper === 'CS' || roleUpper === 'ADMIN_CS') return 'CS_ADMIN'
  if (roleUpper === 'NOC' || roleUpper === 'TROUBLESHOOTS' || roleUpper === 'TEKNISI') return 'NOC_TROUBLESHOOTS'
  if (roleUpper === 'CREATOR_DIGITAL') return 'CREATOR_DIGITAL'
  return ''
}

export function UsersClient({ currentUser }: UsersClientProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [users, setUsers] = useState<User[]>([])
  
  // Show/Hide Password state for Create User
  const [showCreatePassword, setShowCreatePassword] = useState(false)

  // Reset Password states
  const [resetPasswordId, setResetPasswordId] = useState<number | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  
  // Delete User states
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [divisionFilter, setDivisionFilter] = useState<(typeof DIVISION_OPTIONS)[number]['value']>('ALL')
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'MARKETING'
  })

  // Permissions
  const isAdmin = currentUser?.role === 'ADMIN'
  const canCreate = isAdmin
  const derivedDivision = mapRoleToDivision(formData.role)
  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return users.filter((user) => {
      const matchesDivision =
        divisionFilter === 'ALL' || String(user.division ?? '').trim().toUpperCase() === divisionFilter
      const matchesSearch =
        normalizedSearch.length === 0 ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.username.toLowerCase().includes(normalizedSearch) ||
        user.role.toLowerCase().includes(normalizedSearch)
      return matchesDivision && matchesSearch
    })
  }, [divisionFilter, searchTerm, users])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (err) {
      console.error('Failed to fetch users', err)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Pull to refresh support
  useEffect(() => {
    const handler = (ev: Event) => {
      const customEv = ev as CustomEvent
      if (customEv.detail && typeof customEv.detail.register === 'function') {
        customEv.detail.register(fetchUsers())
      } else {
        fetchUsers()
      }
    }
    window.addEventListener('app:refresh', handler)
    return () => window.removeEventListener('app:refresh', handler)
  }, [fetchUsers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCreate) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      let data: { error?: string }
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = (await res.json()) as { error?: string }
      } else {
        const text = await res.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to create user (${res.status})`)
      }

      setSuccess('User berhasil dibuat!')
      setFormData({
        name: '',
        username: '',
        password: '',
        role: 'MARKETING'
      })
      fetchUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenResetModal = (userId: number) => {
    setResetPasswordId(userId)
    setResetPasswordValue('')
    setShowResetPassword(false)
    setIsResetModalOpen(true)
    setError('')
    setSuccess('')
  }

  const handleCloseResetModal = () => {
    setIsResetModalOpen(false)
    setResetPasswordId(null)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetPasswordId) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resetPasswordId,
          password: resetPasswordValue
        }),
      })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setSuccess('Password berhasil direset!')
      handleCloseResetModal()
      fetchUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDeleteModal = (userId: number) => {
    setDeleteUserId(userId)
    setIsDeleteModalOpen(true)
    setError('')
    setSuccess('')
  }

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setDeleteUserId(null)
  }

  const handleDeleteUser = async () => {
    if (!deleteUserId) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/users?id=${deleteUserId}`, {
        method: 'DELETE',
      })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      setSuccess('User berhasil dihapus!')
      handleCloseDeleteModal()
      fetchUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Manajemen User</h1>
      </div>

      {/* Create User Form - Only for ADMIN */}
      {canCreate && (
        <div className="max-w-xl rounded-2xl bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Buat User Baru
          </h2>
          
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 p-3 sm:p-4 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/30 p-3 sm:p-4 text-sm text-green-700 dark:text-green-200">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm text-black dark:text-white"
                placeholder="Contoh: Budi Santoso"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm text-black dark:text-white"
                placeholder="username_login"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <div className="relative mt-1">
                <input
                  type={showCreatePassword ? 'text' : 'password'}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 pr-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm text-black dark:text-white"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                >
                  {showCreatePassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm text-black dark:text-white"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Division</label>
              <input
                type="text"
                value={derivedDivision || '-'}
                readOnly
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 px-3 py-2 shadow-sm sm:text-sm text-black dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Division diisi otomatis berdasarkan mapping role.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full sm:w-auto justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User List */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="mb-4 text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Daftar User
        </h2>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cari User</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nama, username, atau role"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm text-black dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filter Division</label>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value as (typeof DIVISION_OPTIONS)[number]['value'])}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm text-black dark:text-white"
            >
              {DIVISION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Full Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Username</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Division</th>
                {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {filteredUsers.map((user, index) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{index + 1}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{user.name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{user.username}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className={clsx(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      user.role === 'ADMIN' ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" :
                      user.role === 'TEKNISI' || user.role === 'TROUBLESHOOTS' ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" :
                      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    )}>
                      {user.role}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {formatDivisionLabel(user.division)}
                  </td>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleOpenResetModal(user.id)}
                          className="inline-flex items-center text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Reset Password"
                        >
                          <KeyRound className="h-4 w-4 mr-1" />
                          Reset
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(user.id)}
                          className="inline-flex items-center text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 sm:px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {filteredUsers.map((user) => (
            <div key={user.id} className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{user.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDivisionLabel(user.division)}</p>
                </div>
                <span className={clsx(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  user.role === 'ADMIN' ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" :
                  user.role === 'TEKNISI' ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" :
                  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                )}>
                  {user.role}
                </span>
              </div>
              
              {isAdmin && (
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                  <button
                    onClick={() => handleOpenResetModal(user.id)}
                    className="flex items-center text-sm text-blue-600 hover:text-blue-900 dark:text-blue-400"
                  >
                    <KeyRound className="h-4 w-4 mr-1" />
                    Reset
                  </button>
                  <button
                    onClick={() => handleOpenDeleteModal(user.id)}
                    className="flex items-center text-sm text-red-600 hover:text-red-900 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              No users found.
            </div>
          )}
        </div>
      </div>

      {/* Reset Password Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Reset Password</h3>
            <form onSubmit={handleResetPassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                <div className="relative mt-1">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 pr-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm text-black dark:text-white"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                  >
                    {showResetPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleCloseResetModal}
                  className="w-full sm:w-auto rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full sm:w-auto justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">Delete User Confirmation</h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                className="w-full sm:w-auto rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={loading}
                className="inline-flex w-full sm:w-auto justify-center rounded-md border border-transparent bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
