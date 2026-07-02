'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Fingerprint } from 'lucide-react'

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'
const BIOMETRIC_USERNAME_KEY = 'biometric_username'
const BIOMETRIC_PASSWORD_KEY = 'biometric_password'
const BIOMETRIC_REMEMBER_ME_KEY = 'biometric_remember_me'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [enableBiometric, setEnableBiometric] = useState(false)
  const [isNative, setIsNative] = useState(false)
  const [biometricSupported, setBiometricSupported] = useState(false)
  const [biometricReady, setBiometricReady] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        const native = Capacitor.isNativePlatform()
        if (!mounted) return
        setIsNative(native)
        if (!native) return

        const [{ SecureStoragePlugin }, { BiometricAuth }] = await Promise.all([
          import('capacitor-secure-storage-plugin'),
          import('@aparajita/capacitor-biometric-auth'),
        ])

        const info = await BiometricAuth.checkBiometry()
        if (!mounted) return

        const supported = Boolean(info.isAvailable || info.deviceIsSecure)
        setBiometricSupported(supported)

        const enabled = await SecureStoragePlugin.get({ key: BIOMETRIC_ENABLED_KEY })
          .then((r) => r.value === '1')
          .catch(() => false)

        setBiometricReady(enabled)
        setEnableBiometric(enabled)
      } catch {
        if (!mounted) return
        setIsNative(false)
        setBiometricSupported(false)
        setBiometricReady(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  const canUseBiometric = useMemo(() => isNative && biometricSupported, [biometricSupported, isNative])

  const handleEnableBiometricChange = async (checked: boolean) => {
    setEnableBiometric(checked)
    if (!canUseBiometric) return

    if (!checked) {
      try {
        const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin')
        await SecureStoragePlugin.remove({ key: BIOMETRIC_USERNAME_KEY }).catch(() => {})
        await SecureStoragePlugin.remove({ key: BIOMETRIC_PASSWORD_KEY }).catch(() => {})
        await SecureStoragePlugin.remove({ key: BIOMETRIC_REMEMBER_ME_KEY }).catch(() => {})
        await SecureStoragePlugin.set({ key: BIOMETRIC_ENABLED_KEY, value: '0' }).catch(() => {})
      } finally {
        setBiometricReady(false)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, rememberMe }),
      })

      if (res.ok) {
        if (canUseBiometric && enableBiometric) {
          try {
            const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin')
            await SecureStoragePlugin.set({ key: BIOMETRIC_USERNAME_KEY, value: username })
            await SecureStoragePlugin.set({ key: BIOMETRIC_PASSWORD_KEY, value: password })
            await SecureStoragePlugin.set({ key: BIOMETRIC_REMEMBER_ME_KEY, value: rememberMe ? '1' : '0' })
            await SecureStoragePlugin.set({ key: BIOMETRIC_ENABLED_KEY, value: '1' })
            setBiometricReady(true)
          } catch {}
        }
        router.push('/')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.message || 'Login failed')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleBiometricLogin = async () => {
    if (!canUseBiometric) return
    setBiometricLoading(true)
    setError('')

    try {
      const [{ SecureStoragePlugin }, { BiometricAuth, AndroidBiometryStrength }] = await Promise.all([
        import('capacitor-secure-storage-plugin'),
        import('@aparajita/capacitor-biometric-auth'),
      ])

      const enabled = await SecureStoragePlugin.get({ key: BIOMETRIC_ENABLED_KEY })
        .then((r) => r.value === '1')
        .catch(() => false)
      if (!enabled) {
        setError('Login Finger/Pola belum diaktifkan. Login manual dulu, lalu aktifkan.')
        return
      }

      await BiometricAuth.authenticate({
        reason: 'Masuk ke akun Anda',
        cancelTitle: 'Batal',
        allowDeviceCredential: true,
        androidTitle: 'Login',
        androidSubtitle: 'Gunakan sidik jari / pola / PIN',
        androidConfirmationRequired: false,
        androidBiometryStrength: AndroidBiometryStrength.weak,
      })

      const savedUsername = await SecureStoragePlugin.get({ key: BIOMETRIC_USERNAME_KEY }).then((r) => r.value)
      const savedPassword = await SecureStoragePlugin.get({ key: BIOMETRIC_PASSWORD_KEY }).then((r) => r.value)
      const savedRememberMe = await SecureStoragePlugin.get({ key: BIOMETRIC_REMEMBER_ME_KEY })
        .then((r) => r.value === '1')
        .catch(() => false)

      if (!savedUsername || !savedPassword) {
        setError('Data login Finger/Pola tidak ditemukan. Login manual dulu, lalu aktifkan lagi.')
        return
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: savedUsername, password: savedPassword, rememberMe: savedRememberMe }),
      })

      if (res.ok) {
        router.push('/')
        router.refresh()
        return
      }

      const data = await res.json().catch(() => ({}))
      setError(data.message || 'Login Finger/Pola gagal. Silakan login manual lalu aktifkan lagi.')
    } catch {
      setError('Login Finger/Pola dibatalkan atau gagal.')
    } finally {
      setBiometricLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800 dark:text-white">
          PERKASA NETWORKS
        </h1>
        <h2 className="mb-6 text-center text-lg text-gray-600 dark:text-gray-400">
          #juaranyawifi
        </h2>

        {canUseBiometric && biometricReady && (
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={loading || biometricLoading}
            className="mb-4 w-full rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:ring-offset-2 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Fingerprint className="h-5 w-5" />
              {biometricLoading ? 'Memverifikasi...' : 'Login dengan Finger/Pola'}
            </span>
          </button>
        )}
        
        {error && (
          <div className="mb-4 rounded bg-red-100 dark:bg-red-950 p-3 text-sm text-red-600 dark:text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black dark:text-white"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 pr-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black dark:text-white"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Remember me
            </label>
          </div>

          {canUseBiometric && (
            <div className="flex items-center">
              <input
                id="enable-biometric"
                type="checkbox"
                checked={enableBiometric}
                onChange={(e) => void handleEnableBiometricChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <label htmlFor="enable-biometric" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Aktifkan login Finger/Pola di perangkat ini
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
