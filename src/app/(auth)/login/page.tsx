'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Fingerprint, Lock, User } from 'lucide-react'

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'
const BIOMETRIC_USERNAME_KEY = 'biometric_username'
const BIOMETRIC_PASSWORD_KEY = 'biometric_password'
const BIOMETRIC_REMEMBER_ME_KEY = 'biometric_remember_me'

const LOGIN_HIGHLIGHTS = [
  'Pantau PSB, tiket, dan dismantle',
  'Catat aktivitas harian dan pemasaran',
  'Rekap laporan sesuai divisi Anda',
]

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-8 dark:bg-slate-950 sm:px-6">
      <div id="deploy-marker-20261110" data-deploy="v1.11.21-debug" style={{ display: 'none' }}></div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl dark:bg-blue-600/25" />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl dark:bg-sky-500/20" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/10" />
      </div>

      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/10 md:grid md:grid-cols-2">
        {/* Panel brand: hanya tampil di desktop */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 p-10 text-white md:flex">
          <div>
            <Image
              src="/logo.png"
              alt="Logo Perkasa Networks"
              width={180}
              height={60}
              className="h-auto w-44 drop-shadow-sm"
              priority
            />
            <h1 className="mt-10 text-3xl font-bold leading-tight">
              Kelola PSB, aktivitas, dan layanan dalam satu aplikasi.
            </h1>
            <p className="mt-4 max-w-sm text-sm text-blue-50/90">
              Masuk menggunakan akun yang terdaftar untuk mengakses dashboard, tiket, dan aktivitas harian tim Anda.
            </p>
          </div>

          <ul className="mt-10 space-y-3 text-sm text-blue-50/90">
            {LOGIN_HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Panel form */}
        <div className="p-6 sm:p-9">
          {/* Brand ringkas untuk mobile */}
          <div className="mb-8 flex flex-col items-center text-center md:hidden">
            <Image
              src="/logo.png"
              alt="Logo Perkasa Networks"
              width={200}
              height={70}
              className="h-auto w-52 drop-shadow-md"
              priority
            />
          </div>

          <div className="mb-6 hidden md:block">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Selamat datang kembali</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Masuk dengan akun Anda untuk melanjutkan.
            </p>
          </div>

          {canUseBiometric && biometricReady && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={loading || biometricLoading}
              className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Fingerprint className="h-5 w-5" />
              {biometricLoading ? 'Memverifikasi...' : 'Login dengan Finger/Pola'}
            </button>
          )}

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Username
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="Username terdaftar"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pl-10 text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pl-10 pr-11 text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-600 focus:outline-none dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label
                htmlFor="remember-me"
                className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
                />
                Ingat saya di perangkat ini
              </label>

              {canUseBiometric && (
                <label
                  htmlFor="enable-biometric"
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <input
                    id="enable-biometric"
                    type="checkbox"
                    checked={enableBiometric}
                    onChange={(e) => void handleEnableBiometricChange(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 accent-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
                  />
                  Aktifkan login Finger/Pola di perangkat ini
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
            >
              {loading ? 'Memproses...' : 'Login'}
              {!loading && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Hanya akun yang terdaftar dapat mengakses aplikasi ini.
          </p>
        </div>
      </div>
    </div>
  )
}
