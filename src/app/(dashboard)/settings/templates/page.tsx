import { TemplateManager } from '@/components/TemplateManager'

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan Template WhatsApp</h1>
      </div>
      <TemplateManager />
    </div>
  )
}
