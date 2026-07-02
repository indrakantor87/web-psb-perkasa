import { TemplateManager } from '@/components/TemplateManager'

export default function TemplatesPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Template WhatsApp</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Kelola template pesan agar balasan operasional lebih cepat dan seragam.
        </p>
      </div>
      <TemplateManager />
    </div>
  )
}
