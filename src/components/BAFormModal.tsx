'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { X, Printer } from 'lucide-react'

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
  orderSpk: '',
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
}

function buildInitialData(ticket: TicketLike): BAFormData {
  const data = { ...EMPTY_BA }
  data.nama = ticket.customerName || ''
  data.whatsapp = ticket.phoneNumber || ''
  data.paketLayanan = ticket.package || ''
  data.salesMarketing = ticket.marketingName || ''
  data.teknisi = ticket.teknisi || ''
  data.koordinat = ticket.locationMap || ''
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

  const update = (key: keyof BAFormData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }))
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

  return (
    <div className="ba-modal fixed inset-0 z-50 overflow-y-auto bg-gray-950/80 p-2 backdrop-blur-sm sm:p-4">
      <style>{`
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          .ba-modal, .ba-modal * { visibility: visible; }
          .ba-modal {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            backdrop-filter: none !important;
          }
          .ba-no-print { display: none !important; }
          .ba-doc { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
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
            page-break-after: auto;
            break-after: auto;
          }
          .ba-input { border: none !important; background: transparent !important; }
          input[type="checkbox"].ba-input, input[type="checkbox"] { -webkit-appearance: none; appearance: none; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

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
            {field('Titik Koordinat (Gmaps)', data.koordinat, 'koordinat')}
          </div>

          <h2 className="mb-2 text-[13px] font-bold uppercase text-gray-900">II. Detail Layanan & Perangkat</h2>
          <div className="mb-4 pl-1">
            {field('Paket Layanan', data.paketLayanan, 'paketLayanan')}
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
  )
}
