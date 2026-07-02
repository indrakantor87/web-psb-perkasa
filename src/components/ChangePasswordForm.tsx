'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function ChangePasswordForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Password confirmation does not match')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      setSuccess('Password changed successfully')
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div id="change-password-form" className="mt-4 max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:mt-6">
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <h3 className="flex items-center text-lg font-semibold leading-6 text-gray-900 dark:text-white">
          <Lock className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
          Ganti Password
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          Amankan akun anda dengan mengganti password secara berkala.
        </p>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 sm:px-6 sm:py-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/30 dark:text-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-600 dark:border-green-900/40 dark:bg-green-900/30 dark:text-green-200">
              {success}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Password Saat Ini
            </label>
            <div className="relative mt-1">
              <input
                type={showCurrent ? "text" : "password"}
                required
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                onClick={() => setShowCurrent(!showCurrent)}
              >
                {showCurrent ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Password Baru
            </label>
            <div className="relative mt-1">
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={6}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Konfirmasi Password Baru
            </label>
            <div className="relative mt-1">
              <input
                type={showConfirm ? "text" : "password"}
                required
                minLength={6}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-gray-700">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {loading ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
