'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'

interface ProfileAvatarFormProps {
  initialAvatar: string | null
  userInitial: string
}

export function ProfileAvatarForm({ initialAvatar, userInitial }: ProfileAvatarFormProps) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const displayAvatar = useMemo(() => {
    return previewUrl ?? initialAvatar
  }, [initialAvatar, previewUrl])

  const dispatchRefresh = () => {
    window.dispatchEvent(new CustomEvent('app:refresh'))
  }

  const onSave = async () => {
    if (!file) return
    setIsSaving(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      fd.append('mode', 'json')
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Gagal menyimpan foto profil')
        return
      }
      setFile(null)
      dispatchRefresh()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan foto profil')
    } finally {
      setIsSaving(false)
    }
  }

  const onRemove = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('action', 'remove')
      fd.append('mode', 'json')
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'Gagal menghapus foto profil')
        return
      }
      setFile(null)
      dispatchRefresh()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus foto profil')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      {displayAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayAvatar}
          alt="Foto profil"
          className="h-16 w-16 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 font-bold text-lg">
          {userInitial}
        </div>
      )}

      <div className="flex-1 space-y-3">
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:rounded-md file:border file:border-gray-300 dark:file:border-gray-600 file:bg-white dark:file:bg-gray-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 dark:file:text-gray-200 hover:file:bg-gray-50 dark:hover:file:bg-gray-600"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={isSaving}
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          {initialAvatar && !file && (
            <button
              type="button"
              onClick={onRemove}
              disabled={isSaving}
              className={clsx(
                'inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2',
                isSaving && 'opacity-70'
              )}
            >
              Hapus Foto
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!file || isSaving}
            className={clsx(
              'inline-flex justify-center rounded-md bg-gray-900 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white',
              (!file || isSaving) && 'opacity-70'
            )}
          >
            Simpan Foto
          </button>
        </div>
      </div>
    </div>
  )
}
