import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requiredKey = String(process.env.DB_UPDATE_KEY ?? '').trim()
  const { searchParams } = new URL(request.url)
  const key = String(searchParams.get('key') ?? '').trim()
  if (!requiredKey || key !== requiredKey) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 403 })
  }

  // Collect all env vars (mask secrets that are not database-related)
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue
    const lk = k.toLowerCase()
    // Show database-related vars fully; mask others that look like secrets
    const isDb = lk.includes('database') || lk.includes('db_') || lk.includes('postgres') || lk.includes('direct_url') || lk.includes('db_url') || lk.includes('db_host') || lk.includes('db_port') || lk.includes('db_user') || lk.includes('db_pass') || lk.includes('db_name')
    const isSecret = lk.includes('secret') || lk.includes('password') || lk.includes('token') || lk.includes('key') || lk.includes('jwt')
    if (isDb || !isSecret) {
      env[k] = v
    } else {
      env[k] = '***masked***'
    }
  }

  // Try to probe PostgreSQL on internal network
  const probes: { host: string; port: number; result: string }[] = []
  const hosts = ['10.0.1.1', '10.0.1.2', '10.0.1.3', '10.0.1.4', '10.0.1.5', '10.0.1.6', '10.0.1.7', '10.0.1.8', '10.0.1.9', '10.0.1.10', '10.0.1.11', '10.0.1.12', '10.0.1.13', '10.0.1.14', '10.0.1.15', 'localhost', 'postgres', 'postgresql', 'coolify-db', 'database']
  for (const host of hosts) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 1500)
      const r = await fetch(`http://${host}:5432`, { signal: controller.signal }).catch((e) => ({ error: e }))
      clearTimeout(timeout)
      // fetch to postgres port will fail but tells us if port is open
      probes.push({ host, port: 5432, result: r instanceof Error || 'error' in r ? String((r as any).error?.message || (r as any).error).substring(0, 100) : 'responded' })
    } catch (e: any) {
      probes.push({ host, port: 5432, result: String(e?.message || e).substring(0, 100) })
    }
  }

  return NextResponse.json({ env, probes })
}
