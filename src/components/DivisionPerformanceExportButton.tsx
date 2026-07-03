'use client'

import * as XLSX from 'xlsx'
import { Download } from 'lucide-react'

type ExportCell = string | number | null

type ExportSheet = {
  name: string
  rows: Record<string, ExportCell>[]
}

export function DivisionPerformanceExportButton({
  fileName,
  sheets,
}: {
  fileName: string
  sheets: ExportSheet[]
}) {
  const handleExport = () => {
    try {
      const workbook = XLSX.utils.book_new()

      for (const sheet of sheets) {
        const worksheet =
          sheet.rows.length > 0
            ? XLSX.utils.json_to_sheet(sheet.rows)
            : XLSX.utils.aoa_to_sheet([['Tidak ada data']])
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31))
      }

      XLSX.writeFile(workbook, fileName)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Gagal export Excel')
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
    >
      <Download className="h-4 w-4" />
      Export Excel
    </button>
  )
}
