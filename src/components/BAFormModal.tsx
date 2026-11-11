'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { X, Printer } from 'lucide-react'
import { parseLatLng, formatLatLng } from '@/lib/geo'

export interface BAFormData {
  orderSpk: string
  tanggal: string
  nama: string
  alamat: string
  whatsapp: string
  koordinat: string
  paketLayanan: string
  bandwidth: string
  serviceId: string
  statusPerangkat: string
  masaKontrak: string
  brandModelOnt: string
  serialNumber: string
  coverage: string
  teknisi: string
  salesMarketing: string
  panjangKabel: string
  redamanOptik: string
  speedDownload: string
  speedUpload: string
  statusKoneksi: string
  pemasanganKabel: string
  jalurKabel: string
  biayaInstalasi: string
  biayaBulanan: string
  totalPembayaran: string
  metodePembayaran: string
}

const EMPTY_BA: BAFormData = {
  orderSpk: `mdp.${new Date().getFullYear()}.`,
  tanggal: format(new Date(), 'EEEE, d MMMM yyyy', { locale: idLocale }),
  nama: '',
  alamat: '',
  whatsapp: '',
  koordinat: '',
  paketLayanan: '',
  bandwidth: '',
  serviceId: '',
  statusPerangkat: 'Pinjam Pakai (Milik Perkasa Networks)',
  masaKontrak: '6 Bulan Internet Aktif',
  brandModelOnt: '',
  serialNumber: '',
  coverage: '1 home (Tidak Boleh di Share)',
  teknisi: '',
  salesMarketing: '',
  panjangKabel: '',
  redamanOptik: '',
  speedDownload: '',
  speedUpload: '',
  statusKoneksi: '',
  pemasanganKabel: '',
  jalurKabel: '',
  biayaInstalasi: '-',
  biayaBulanan: '',
  totalPembayaran: '',
  metodePembayaran: '',
}

interface TicketLike {
  id: number
  customerName: string
  phoneNumber: string
  package: string
  marketingName: string
  teknisi?: string | null
  locationMap: string
  installedDate: string | null
  pembayaran?: string | null
  birthDate?: string | null
}

/**
 * Katalog paket layanan untuk auto-fill Bandwidth, Biaya Bulanan, dan Total Pembayaran.
 * `name` adalah nama paket yang cocok dengan field `package` pada tiket.
 */
const PACKAGE_CATALOG = [
  { name: 'HOME MINI', bandwidth: '25 Mbps', price: 'Rp. 110.000' },
  { name: 'HOME LITE', bandwidth: '30 Mbps', price: 'Rp. 125.000' },
  { name: 'HOME BASIC', bandwidth: '50 Mbps', price: 'Rp. 166.500' },
  { name: 'HOME STREAM', bandwidth: '75 Mbps', price: 'Rp. 200.000' },
  { name: 'HOME ENTERTAIN', bandwidth: '100 Mbps', price: 'Rp. 260.000' },
  { name: 'HOME SMART', bandwidth: '150 Mbps', price: 'Rp. 325.000' },
]

/**
 * Mencari paket dari katalog berdasarkan nama paket (case-insensitive, substring).
 */
function findPackage(packageName: string) {
  const needle = packageName.trim().toUpperCase()
  if (!needle) return null
  return (
    PACKAGE_CATALOG.find((p) => p.name === needle) ||
    PACKAGE_CATALOG.find((p) => needle.includes(p.name)) ||
    null
  )
}

/**
 * Membuat Service ID: 4 karakter awal nama (huruf kecil, non-alfanumerik dibuang)
 * + 4 digit tanggal lahir (DDMM), total 8 karakter, diakhiri @perkasa.net.id.
 * Contoh: nama "Andi", lahir 08 September => andi0809@perkasa.net.id
 */
function generateServiceId(name: string, birthDate: string | null | undefined): string {
  const namePart = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 4)
  let datePart = ''
  if (birthDate) {
    try {
      const d = new Date(birthDate)
      if (!Number.isNaN(d.getTime())) {
        const day = String(d.getUTCDate()).padStart(2, '0')
        const month = String(d.getUTCMonth() + 1).padStart(2, '0')
        datePart = day + month
      }
    } catch {
      // ignore
    }
  }
  return namePart + datePart + '@perkasa.net.id'
}

function buildInitialData(ticket: TicketLike): BAFormData {
  const data = { ...EMPTY_BA }
  data.nama = ticket.customerName || ''
  data.whatsapp = ticket.phoneNumber || ''
  data.paketLayanan = ticket.package || ''
  data.salesMarketing = ticket.marketingName || ''
  data.teknisi = ticket.teknisi || ''
  data.koordinat = ticket.locationMap || ''
  // Service ID otomatis dari nama + tanggal lahir (DDMM), diakhiri @perkasa.net.id
  data.serviceId = generateServiceId(ticket.customerName, ticket.birthDate)
  // Auto-fill Bandwidth, Biaya Bulanan, dan Total Pembayaran dari katalog paket
  const pkg = findPackage(ticket.package || '')
  if (pkg) {
    data.paketLayanan = pkg.name
    data.bandwidth = pkg.bandwidth
    data.biayaBulanan = pkg.price
    data.totalPembayaran = pkg.price
  }
  if (ticket.installedDate) {
    try {
      data.tanggal = format(new Date(ticket.installedDate), 'EEEE, d MMMM yyyy', { locale: idLocale })
    } catch {
      // ignore
    }
  }
  if (ticket.pembayaran) {
    data.metodePembayaran = ticket.pembayaran === 'TF' ? 'Transfer' : ticket.pembayaran
  }
  return data
}

interface BAFormModalProps {
  ticket: TicketLike
  onClose: () => void
}

const FALLBACK_HEADER = (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">MDP</div>
      <div className="leading-tight">
        <div className="text-lg font-extrabold text-blue-900">MEGA DATA PERKASA</div>
        <div className="text-[9px] tracking-widest text-gray-500">INTERNET SERVICE PROVIDER</div>
      </div>
    </div>
    <div className="text-right">
      <div className="text-base font-extrabold text-blue-700">#juaranyawifi</div>
      <div className="text-[10px] leading-tight text-gray-600">
        Lantai 2 Perum Kebun Bibit Buah 1 Blok A No 1 Rt IX Rw II<br />
        Sidokerto Pati - Jawa Tengah 59111<br />
        CS +62 812-5200-0220 SUPPORT +62 822-2550-0100<br />
        http://www.perkasa.net.id<br />
        info@perkasa.net.id
      </div>
    </div>
  </div>
)

function BAHeader({ error, onError }: { error: boolean; onError: () => void }) {
  return (
    <div className="mb-5 border-b border-gray-300 pb-3">
      {error ? (
        FALLBACK_HEADER
      ) : (
        <img
          src="/ba-header.png"
          alt="Kop Perkasa Networks"
          onError={onError}
          className="w-full"
        />
      )}
    </div>
  )
}

export function BAFormModal({ ticket, onClose }: BAFormModalProps) {
  const [data, setData] = useState<BAFormData>(() => buildInitialData(ticket))
  const [headerImgError, setHeaderImgError] = useState(false)
  const [asyncKoordinat, setAsyncKoordinat] = useState<{ lat: number; lng: number } | null>(null)

  const rawKoordinat = (data.koordinat ?? '').trim()

  // Parsing sinkron untuk URL yang sudah berisi koordinat (tidak perlu request).
  const directKoordinat = useMemo(() => {
    if (!rawKoordinat) return null
    const parsed = parseLatLng(rawKoordinat)
    return parsed ? { lat: parsed.latitude, lng: parsed.longitude } : null
  }, [rawKoordinat])

  // Jika short link, panggil endpoint untuk mengikuti redirect.
  useEffect(() => {
    if (!rawKoordinat || directKoordinat) return

    let cancelled = false
    fetch(`/api/geo/resolve?url=${encodeURIComponent(rawKoordinat)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
          setAsyncKoordinat({ lat: d.latitude, lng: d.longitude })
        } else {
          setAsyncKoordinat(null)
        }
      })
      .catch(() => {
        if (!cancelled) setAsyncKoordinat(null)
      })

    return () => {
      cancelled = true
    }
  }, [rawKoordinat, directKoordinat])

  const koordinat = rawKoordinat ? (directKoordinat ?? asyncKoordinat) : null

  const update = (key: keyof BAFormData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  // Saat paket layanan dipilih, otomatis isi Bandwidth, Biaya Bulanan, dan Total Pembayaran.
  const handlePackageChange = (packageName: string) => {
    const pkg = findPackage(packageName)
    setData((prev) => ({
      ...prev,
      paketLayanan: packageName,
      bandwidth: pkg ? pkg.bandwidth : prev.bandwidth,
      biayaBulanan: pkg ? pkg.price : prev.biayaBulanan,
      totalPembayaran: pkg ? pkg.price : prev.totalPembayaran,
    }))
  }

  const handlePrint = () => {
    window.print()
  }

  const field = (label: string, value: string, key: keyof BAFormData) => (
    <div className="mb-1.5 flex items-start">
      <span className="w-[180px] shrink-0 text-[13px] font-semibold text-gray-900">{label}</span>
      <span className="mr-1 shrink-0 text-[13px] text-gray-900">:</span>
      <input
        value={value}
        onChange={(e) => update(key, e.target.value)}
        className="ba-input min-w-0 flex-1 border-b border-dashed border-gray-400 bg-transparent text-[13px] text-gray-900 outline-none focus:border-blue-500"
      />
    </div>
  )

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="ba-modal-root">
      <style>{`
        @media print {
          html, body {
            margin: 0 !important; padding: 0 !important; background: #fff !important;
            height: auto !important; overflow: visible !important;
          }
          /* Sembunyikan SEMUA konten body kecuali modal BA */
          body > * { display: none !important; }
          body > .ba-modal-root { display: block !important; }
          .ba-modal-root {
            position: static !important;
            width: 100% !important;
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .ba-modal {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            backdrop-filter: none !important;
            z-index: auto !important;
          }
          .ba-no-print { display: none !important; }
          .ba-doc {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          .ba-page {
            page-break-after: always;
            break-after: page;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
          }
          .ba-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .ba-input { border: none !important; background: transparent !important; }
          select.ba-input { -webkit-appearance: none; appearance: none; }
          /* Checkbox tetap ditampilkan saat print (Status Koneksi, Pemasangan Kabel, Metode Pembayaran) */
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="ba-modal fixed inset-0 z-50 overflow-y-auto bg-gray-950/80 p-2 backdrop-blur-sm sm:p-4">
        {/* Toolbar */}
        <div className="ba-no-print sticky top-0 z-10 mb-3 flex items-center justify-between rounded-lg bg-white px-4 py-2 shadow-md">
          <h2 className="text-sm font-bold text-gray-800">Preview Berita Acara</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
            >
              <X size={14} />
              Tutup
            </button>
          </div>
        </div>

        {/* Document */}
        <div className="ba-doc mx-auto max-w-[800px] space-y-4">
        {/* PAGE 1 */}
        <div className="ba-page rounded-lg bg-white p-6 shadow-lg sm:p-8">
          <BAHeader error={headerImgError} onError={() => setHeaderImgError(true)} />

          <h1 className="mb-5 text-center text-sm font-bold uppercase text-gray-900">
            Berita Acara Aktivasi & Persetujuan Instalasi<br />
            Layanan Internet Perkasa Networks
          </h1>

          <h2 className="mb-2 text-[13px] font-bold uppercase text-gray-900">I. Data Pelanggan</h2>
          <div className="mb-4 pl-1">
            {field('NO ORDER / SPK', data.orderSpk, 'orderSpk')}
            <div className="mb-1.5 flex items-start">
              <span className="w-[180px] shrink-0 text-[13px] font-semibold text-gray-900">Pada hari ini</span>
              <span className="mr-1 shrink-0 text-[13px] text-gray-900">:</span>
              <input
                value={data.tanggal}
                onChange={(e) => update('tanggal', e.target.value)}
                className="ba-input min-w-0 flex-1 border-b border-dashed border-gray-400 bg-transparent text-[13px] text-gray-900 outline-none focus:border-blue-500"
              />
              <span className="ml-2 shrink-0 text-[13px] italic text-gray-900">telah dilakukan aktivasi internet kepada :</span>
            </div>
            {field('Nama', data.nama, 'nama')}
            {field('Alamat', data.alamat, 'alamat')}
            {field('Nomor WhatsApp', data.whatsapp, 'whatsapp')}
            {field('Titik Koordinat (Gmaps)', koordinat ? formatLatLng(koordinat.lat, koordinat.lng) : data.koordinat, 'koordinat')}
          </div>

          <h2 className="mb-2 text-[13px] font-bold uppercase text-gray-900">II. Detail Layanan & Perangkat</h2>
          <div className="mb-4 pl-1">
            <div className="mb-1.5 flex items-start">
              <span className="w-[180px] shrink-0 text-[13px] font-semibold text-gray-900">Paket Layanan</span>
              <span className="mr-1 shrink-0 text-[13px] text-gray-900">:</span>
              <select
                value={data.paketLayanan}
                onChange={(e) => handlePackageChange(e.target.value)}
                className="ba-input min-w-0 flex-1 border-b border-dashed border-gray-400 bg-transparent text-[13px] text-gray-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Pilih Paket --</option>
                {PACKAGE_CATALOG.map((pkg) => (
                  <option key={pkg.name} value={pkg.name}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </div>
            {field('Bandwidth', data.bandwidth, 'bandwidth')}
            {field('Service ID', data.serviceId, 'serviceId')}
            {field('Status Kepemilikan Perangkat', data.statusPerangkat, 'statusPerangkat')}
            {field('Masa Kontrak', data.masaKontrak, 'masaKontrak')}
            {field('Brand & Model ONT', data.brandModelOnt, 'brandModelOnt')}
            {field('Serial Number (SN)', data.serialNumber, 'serialNumber')}
            {field('Coverage', data.coverage, 'coverage')}
            {field('Teknisi', data.teknisi, 'teknisi')}
            {field('Sales Marketing', data.salesMarketing, 'salesMarketing')}
          </div>

          <h2 className="mb-2 text-[13px] font-bold uppercase text-gray-900">III. Laporan Hasil Aktivasi</h2>
          <div className="mb-4 pl-1">
            <div className="mb-1.5 flex items-center">
              <span className="w-[180px] shrink-0 text-[13px] font-semibold text-gray-900">Panjang Kabel DC</span>
              <span className="mr-1 shrink-0 text-[13px] text-gray-900">:</span>
              <input
                value={data.panjangKabel}
                onChange={(e) => update('panjangKabel', e.target.value)}
                className="ba-input w-24 border-b border-dashed border-gray-400 bg-transparent text-[13px] text-gray-900 outline-none focus:border-blue-500"
              />
              <span className="ml-1 text-[13px] text-gray-900">m</span>
            </div>
            <div className="mb-1.5 flex items-center">
              <span className="w-[180px] shrink-0 text-[13px] font-semibold text-gray-900">Redaman Optik (RX)</span>
              <span className="mr-1 shrink-0 text-[13px] text-gray-900">:</span>
              <input
                value={data.redamanOptik}
                onChange={(e) => update('redamanOptik', e.target.value)}
                className="ba-input w-24 border-b border-dashed border-gray-400 bg-transparent text-[13px] text-gray-900 outline-none focus:border-blue-500"
              />
              <span className="ml-1 text-[13px] text-gray-900">dBm</span>
              <span className="ml-2 text-[11px] italic text-rose-600">*Standar -18 s/d -25 dBm</span>
            </div>
            <div className="mb-1.5 flex items-center flex-wrap">
              <span className="w-[180px] shrink-0 text-[13px] font-semibold text-gray-900">Speedtest</span>
              <span className="mr-1 shrink-0 text-[13px] text-gray-900">:</span>
              <span className="text-[13px] text-gray-900">Download : </span>
              <input
                value={data.speedDownload}
                onChange={(e) => update('speedDownload', e.target.value)}
                className="ba-input w-16 border-b border-dashed border-gray-400 bg-transparent text-[13px] text-gray-900 outline-none focus:border-blue-500"
              />
              <span className="mx-1 text-[13px] text-gray-900">Mbps | Upload : </span>
              <input
                value={data.speedUpload}
                onChange={(e) => update('speedUpload', e.target.value)}
                className="ba-input w-16 border-b border-dashed border-gray-400 bg-transparent text-[13px] text-gray-900 outline-none focus:border-blue-500"
              />
              <span className="ml-1 text-[13px] text-gray-900">Mbps</span>
            </div>
            <div className="mb-1.5 flex items-center">
              <span className="w-[180px] shrink-0 text-[13px] font-semibold text-gray-900">Status Koneksi</span>
              <span className="mr-1 shrink-0 text-[13px] text-gray-900">:</span>
              <label className="mr-4 text-[13px] text-gray-900">
                <input
                  type="checkbox"
                  checked={data.statusKoneksi === 'Stabil'}
                  onChange={() => update('statusKoneksi', 'Stabil')}
                  className="mr-1"
                />
                Stabil
              </label>
              <label className="text-[13px] text-gray-900">
                <input
                  type="checkbox"
                  checked={data.statusKoneksi === 'Ada Kendala'}
                  onChange={() => update('statusKoneksi', 'Ada Kendala')}
                  className="mr-1"
                />
                Ada Kendala
              </label>
            </div>
            <div className="mb-1.5 flex items-center flex-wrap">
              <span className="w-[180px] shrink-0 text-[13px] font-semibold text-gray-900">Pemasangan Kabel</span>
              <span className="mr-1 shrink-0 text-[13px] text-gray-900">:</span>
              <label className="mr-4 text-[13px] text-gray-900">
                <input
                  type="checkbox"
                  checked={data.pemasanganKabel === 'Rapi'}
                  onChange={() => update('pemasanganKabel', 'Rapi')}
                  className="mr-1"
                />
                Rapi
              </label>
              <label className="mr-2 text-[13px] text-gray-900">
                <input
                  type="checkbox"
                  checked={data.pemasanganKabel === 'Jalur'}
                  onChange={() => update('pemasanganKabel', 'Jalur')}
                  className="mr-1"
                />
                Jalur Melalui :
              </label>
              <input
                value={data.jalurKabel}
                onChange={(e) => update('jalurKabel', e.target.value)}
                className="ba-input w-32 border-b border-dashed border-gray-400 bg-transparent text-[13px] text-gray-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <h2 className="mb-2 text-[13px] font-bold uppercase text-gray-900">IV. Rincian Biaya dan Pembayaran</h2>
          <div className="mb-4 pl-1">
            {field('Biaya Instalasi', data.biayaInstalasi, 'biayaInstalasi')}
            {field('Biaya Bulanan (+PPN)', data.biayaBulanan, 'biayaBulanan')}
            {field('Total Pembayaran Pertama', data.totalPembayaran, 'totalPembayaran')}
            <div className="mb-1.5 flex items-center flex-wrap">
              <span className="w-[180px] shrink-0 text-[13px] font-semibold text-gray-900">Metode Pembayaran</span>
              <span className="mr-1 shrink-0 text-[13px] text-gray-900">:</span>
              <label className="mr-4 text-[13px] text-gray-900">
                <input
                  type="checkbox"
                  checked={data.metodePembayaran === 'Transfer'}
                  onChange={() => update('metodePembayaran', 'Transfer')}
                  className="mr-1"
                />
                Transfer
              </label>
              <label className="text-[13px] text-gray-900">
                <input
                  type="checkbox"
                  checked={data.metodePembayaran === 'Sales/Teknisi Lapangan' || data.metodePembayaran === 'Cash'}
                  onChange={() => update('metodePembayaran', 'Sales/Teknisi Lapangan')}
                  className="mr-1"
                />
                Sales / Teknisi Lapangan
              </label>
            </div>
          </div>

          <p className="text-right text-[11px] italic text-rose-600">*Silakan tanda tangan pada lembar kedua {'>'} </p>
        </div>

        {/* PAGE 2 (Statis) */}
        <div className="ba-page rounded-lg bg-white p-6 shadow-lg sm:p-8">
          <div className="opacity-70">
            <BAHeader error={headerImgError} onError={() => setHeaderImgError(true)} />
          </div>

          <h2 className="mb-3 text-[13px] font-bold uppercase text-gray-900">V. Syarat dan Ketentuan</h2>
          <p className="mb-4 text-[13px] text-gray-900">Dengan menandatangani formulir ini, Pelanggan setuju bahwa :</p>

          <div className="space-y-3 pl-1">
            <div className="flex">
              <span className="w-[200px] shrink-0 text-[13px] font-bold text-gray-900">Hak Milik Perangkat</span>
              <span className="mr-1 text-[13px] text-gray-900">:</span>
              <span className="text-[13px] text-gray-900">
                Perangkat ONT/Modem yang dipinjamkan adalah milik <strong>PT. Mega Data Perkasa (Perkasa Networks)</strong> dan wajib dikembalikan jika berhenti berlangganan.
              </span>
            </div>
            <div className="flex">
              <span className="w-[200px] shrink-0 text-[13px] font-bold text-gray-900">Denda Penalty</span>
              <span className="mr-1 text-[13px] text-gray-900">:</span>
              <span className="text-[13px] text-gray-900">
                Pembatalan layanan sebelum masa kontrak berakhir (aktif selama 6 bulan) dikenakan denda sebesar <strong>Rp 500.000</strong>
              </span>
            </div>
            <div className="flex">
              <span className="w-[200px] shrink-0 text-[13px] font-bold text-gray-900">Larangan Penjualan Kembali</span>
              <span className="mr-1 text-[13px] text-gray-900">:</span>
              <span className="text-[13px] text-gray-900">
                Pelanggan dilarang keras menyebarluaskan atau menjual kembali layanan internet (RT/RW Net) tanpa izin resmi tertulis dari Perkasa Networks.
              </span>
            </div>
            <div className="flex">
              <span className="w-[200px] shrink-0 text-[13px] font-bold text-gray-900">Jatuh Tempo</span>
              <span className="mr-1 text-[13px] text-gray-900">:</span>
              <span className="text-[13px] text-gray-900">
                Pembayaran wajib dilakukan paling lambat di tanggal yang tertera pada notifikasi whatsapp setiap bulannya untuk menghindari isolir otomatis.
              </span>
            </div>
          </div>

          <table className="mt-6 w-full border-collapse border border-gray-900">
            <tbody>
              <tr>
                <td className="border border-gray-900 px-3 py-3 text-center text-[13px] text-gray-900">
                  Seberapa puaskah anda dengan pelayanan instalasi internet<br />dari Perkasa Networks ?
                </td>
                <td className="border border-gray-900 px-3 py-3 text-center text-[13px] font-bold text-gray-900">PUAS</td>
                <td className="border border-gray-900 px-3 py-3 text-center text-[13px] font-bold text-gray-900">KURANG</td>
                <td className="border border-gray-900 px-3 py-3 text-center text-[13px] font-bold text-gray-900">TIDAK</td>
              </tr>
              <tr>
                <td className="border border-gray-900" />
                <td className="border border-gray-900 px-3 py-6" />
                <td className="border border-gray-900 px-3 py-6" />
                <td className="border border-gray-900 px-3 py-6" />
              </tr>
            </tbody>
          </table>

          <p className="mt-6 text-[13px] text-gray-900">
            Demikian Berita Acara ini dibuat dalam rangkap 2 (dua) asli, yang sama bunyinya dan mempunyai kekuatan Hukum yang sama setelah ditanda tangani dan menjadi bagian dari Perjanjian Berlangganan Internet.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[13px] font-bold uppercase text-gray-900">Pelanggan</div>
              <div className="mt-16 text-[13px] text-gray-900">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
            </div>
            <div>
              <div className="text-[13px] font-bold uppercase text-gray-900">Teknisi Lapangan</div>
              <div className="mt-16 text-[13px] text-gray-900">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
            </div>
            <div>
              <div className="text-[13px] font-bold uppercase text-gray-900">Sales Marketing</div>
              <div className="mt-16 text-[13px] text-gray-900">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
    , document.body
  )
}
