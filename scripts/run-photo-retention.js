const appUrl = String(process.env.PHOTO_RETENTION_APP_URL ?? '').trim()
const secret = String(process.env.PHOTO_RETENTION_CRON_SECRET ?? '')
const mode = String(process.env.PHOTO_RETENTION_MODE ?? 'dry-run').trim()

if (!appUrl) {
  throw new Error('PHOTO_RETENTION_APP_URL belum dikonfigurasi')
}
if (Buffer.byteLength(secret) < 32) {
  throw new Error('PHOTO_RETENTION_CRON_SECRET harus berisi minimal 32 byte')
}
if (mode !== 'dry-run' && mode !== 'delete') {
  throw new Error('PHOTO_RETENTION_MODE hanya boleh dry-run atau delete')
}

const baseUrl = new URL(appUrl)
if (
  baseUrl.protocol !== 'https:' &&
  !['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)
) {
  throw new Error('PHOTO_RETENTION_APP_URL wajib memakai HTTPS')
}

const endpoint = new URL('/api/cron/photo-retention', baseUrl)
endpoint.searchParams.set('mode', mode)

async function run() {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  })
  const result = await response.text()

  if (!response.ok) {
    console.error(`Photo retention request failed with HTTP ${response.status}`)
    if (result) console.error(result)
    process.exitCode = 1
    return
  }

  console.log(result)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Photo retention request failed')
  process.exitCode = 1
})
