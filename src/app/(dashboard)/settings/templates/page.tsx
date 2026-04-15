import { TemplateManager } from '@/components/TemplateManager'

export default function TemplatesPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">WhatsApp Template Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage WhatsApp message templates for quick responses.
        </p>
      </div>
      <TemplateManager />
    </div>
  )
}
