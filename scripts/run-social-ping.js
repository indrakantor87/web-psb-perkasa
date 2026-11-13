const appUrl = String(process.env.SOCIAL_PING_APP_URL ?? '').trim()
const secret = String(process.env.SOCIAL_PING_CRON_SECRET ?? '')

if (!appUrl) {
  throw new Error('SOCIAL_PING_APP_URL belum dikonfigurasi')
}
if (Buffer.byteLength(secret) < 32) {
  throw new Error('SOCIAL_PING_CRON_SECRET harus berisi minimal 32 byte')
}

const baseUrl = new URL(appUrl)
if (
  baseUrl.protocol !== 'https:' &&
  !['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)
) {
  throw new Error('SOCIAL_PING_APP_URL wajib memakai HTTPS')
}

const endpoint = new URL('/api/cron/social-ping', baseUrl)

async function run() {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    console.error(`Social ping request failed with HTTP ${response.status}`)
    process.exitCode = 1
    return
  }

  const result = await response.json()
  console.log(
    `Social ping complete: ${result.up}/${result.total} reachable, ${result.down} down at ${result.checkedAt}`,
  )
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Social ping request failed')
  process.exitCode = 1
})
