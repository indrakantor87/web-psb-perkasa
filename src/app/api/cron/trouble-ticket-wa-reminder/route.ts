'use server'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma as PrismaSql } from '@prisma/client'
import { jakartaNow } from '@/lib/jakarta-time'

const SLA_DAYS: Record<string, number> = { EMERGENCY: 2, MAJOR: 3, MINOR: 5, PREVENTIVE: 30 }

function normalizeTypeKey(type: unknown) {
  return String(type ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
}

function formatTypeLabel(type: unknown) {
  const t = normalizeTypeKey(type)
  if (!t) return '-'
  return t
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function normalizeWaNumber(input: string) {
  const digits = String(input || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

function formatRemaining(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days} hari ${hours} jam`
  if (hours > 0) return `${hours} jam ${minutes} menit`
  return `${minutes} menit`
}

async function ensureReminderTable() {
  await prisma.$executeRaw(PrismaSql.sql`
    CREATE TABLE IF NOT EXISTS trouble_ticket_wa_reminders (
      id SERIAL PRIMARY KEY,
      trouble_ticket_id INT NOT NULL,
      stage TEXT NOT NULL,
      to_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      attempts INT NOT NULL DEFAULT 0,
      last_error TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  await prisma.$executeRaw(PrismaSql.sql`
    CREATE UNIQUE INDEX IF NOT EXISTS trouble_ticket_wa_reminders_uniq
    ON trouble_ticket_wa_reminders (trouble_ticket_id, stage, to_number);
  `)
  await prisma.$executeRaw(PrismaSql.sql`
    CREATE INDEX IF NOT EXISTS trouble_ticket_wa_reminders_status_idx
    ON trouble_ticket_wa_reminders (status, updated_at);
  `)
}

async function getReminderRow(input: { troubleTicketId: number; stage: string; toNumber: string }) {
  const rows = await prisma.$queryRaw<Array<{ id: number; status: string; attempts: number; updated_at: Date }>>(PrismaSql.sql`
    SELECT id, status, attempts, updated_at
    FROM trouble_ticket_wa_reminders
    WHERE trouble_ticket_id = ${input.troubleTicketId}
      AND stage = ${input.stage}
      AND to_number = ${input.toNumber}
    LIMIT 1
  `)
  return rows[0] ?? null
}

async function insertReminderRow(input: { troubleTicketId: number; stage: string; toNumber: string }) {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>(PrismaSql.sql`
    INSERT INTO trouble_ticket_wa_reminders (trouble_ticket_id, stage, to_number)
    VALUES (${input.troubleTicketId}, ${input.stage}, ${input.toNumber})
    ON CONFLICT (trouble_ticket_id, stage, to_number) DO NOTHING
    RETURNING id
  `)
  return rows[0]?.id ?? null
}

async function markAttempt(id: number) {
  await prisma.$executeRaw(PrismaSql.sql`
    UPDATE trouble_ticket_wa_reminders
    SET status = 'PENDING',
        attempts = attempts + 1,
        updated_at = NOW(),
        last_error = NULL
    WHERE id = ${id}
  `)
}

async function markSent(id: number) {
  await prisma.$executeRaw(PrismaSql.sql`
    UPDATE trouble_ticket_wa_reminders
    SET status = 'SENT',
        sent_at = NOW(),
        updated_at = NOW(),
        last_error = NULL
    WHERE id = ${id}
  `)
}

async function markManual(id: number) {
  await prisma.$executeRaw(PrismaSql.sql`
    UPDATE trouble_ticket_wa_reminders
    SET status = 'MANUAL',
        updated_at = NOW(),
        last_error = NULL
    WHERE id = ${id}
  `)
}

async function markFailed(id: number, err: string) {
  await prisma.$executeRaw(PrismaSql.sql`
    UPDATE trouble_ticket_wa_reminders
    SET status = 'FAILED',
        updated_at = NOW(),
        last_error = ${err}
    WHERE id = ${id}
  `)
}

function createWaLink(toNumber: string, message: string) {
  const to = normalizeWaNumber(toNumber)
  const text = encodeURIComponent(message)
  return `https://wa.me/${to}?text=${text}`
}

async function sendWa(toNumber: string, message: string) {
  const url = process.env.WA_GATEWAY_URL
  if (!url) {
    throw new Error('WA_GATEWAY_URL belum di-set')
  }
  const token = process.env.WA_GATEWAY_TOKEN
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ to: toNumber, message }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`WA gateway error (${res.status}): ${text || res.statusText}`)
  }
}

export async function POST(req: Request) {
  const secret = process.env.TT_WA_CRON_SECRET
  const auth = req.headers.get('authorization') || ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureReminderTable()

  const now = jakartaNow()
  const nowMs = now.getTime()

  const recipientsRaw = (process.env.TT_WA_RECIPIENTS || '').split(',').map((x) => x.trim()).filter(Boolean)
  const recipients = recipientsRaw.map(normalizeWaNumber).filter(Boolean)
  if (!recipients.length) {
    return NextResponse.json({ error: 'TT_WA_RECIPIENTS kosong' }, { status: 400 })
  }

  const intervalMinutes = Math.max(1, Number(process.env.TT_WA_CRON_INTERVAL_MINUTES || 5))
  const windowMs = intervalMinutes * 60_000
  const cooldownMinutes = Math.max(1, Number(process.env.TT_WA_FAIL_COOLDOWN_MINUTES || 30))
  const cooldownMs = cooldownMinutes * 60_000

  const stages = [
    { key: 'T-24H', minutes: 24 * 60 },
    { key: 'T-6H', minutes: 6 * 60 },
    { key: 'T-1H', minutes: 60 },
    { key: 'T-15M', minutes: 15 },
  ]

  const openTickets = await prisma.troubleTicket.findMany({
    where: {
      status: 'OPEN',
      closedAt: null,
    },
    select: {
      id: true,
      ticketCode: true,
      periodMonth: true,
      periodYear: true,
      customerName: true,
      user: true,
      waNumber: true,
      type: true,
      openedAt: true,
      mapsUrl: true,
      problemCategory: true,
      resolutionAction: true,
    },
    orderBy: { openedAt: 'asc' },
    take: 5000,
  })

  let considered = 0
  let queued = 0
  let manual = 0
  let sent = 0
  let failed = 0
  const results: Array<{ ticketId: number; stage: string; to: string; status: 'SENT' | 'FAILED' | 'SKIPPED' | 'MANUAL'; error?: string; waLink?: string }> = []
  const hasGateway = Boolean(process.env.WA_GATEWAY_URL)

  for (const t of openTickets) {
    const typeKey = normalizeTypeKey(t.type)
    const slaDays = SLA_DAYS[typeKey] ?? 3
    const dueAtMs = new Date(t.openedAt).getTime() + slaDays * 24 * 60 * 60 * 1000
    const remainingMs = dueAtMs - nowMs

    for (const stage of stages) {
      const stageMs = stage.minutes * 60_000
      if (!(remainingMs <= stageMs && remainingMs > stageMs - windowMs)) continue

      considered += 1
      const label = t.ticketCode || String(t.id)
      const month = Number(t.periodMonth || 0)
      const year = Number(t.periodYear || 0)
      const period = month && year ? `${month.toString().padStart(2, '0')}/${year}` : '-'
      const msg = [
        `Reminder Trouble Ticket mendekati overdue (${stage.key})`,
        `ID: ${label}`,
        `Periode: ${period}`,
        `Nama: ${(t.customerName || '').trim() || '-'}`,
        `User: ${(t.user || '').trim() || '-'}`,
        `Type: ${formatTypeLabel(t.type)} (SLA ${slaDays} hari)`,
        `Sisa waktu: ${formatRemaining(remainingMs)}`,
        `Gangguan: ${(t.problemCategory || '').trim() || '-'}`,
        `Tindakan: ${(t.resolutionAction || '').trim() || '-'}`,
        `Maps: ${(t.mapsUrl || '').trim() || '-'}`,
        `Link: /trouble-ticket`,
      ].join('\n')

      for (const to of recipients) {
        const existing = await getReminderRow({ troubleTicketId: t.id, stage: stage.key, toNumber: to })
        if (existing?.status === 'SENT') {
          results.push({ ticketId: t.id, stage: stage.key, to, status: 'SKIPPED' })
          continue
        }
        if (existing && existing.status === 'FAILED') {
          const updatedAtMs = new Date(existing.updated_at).getTime()
          if (nowMs - updatedAtMs < cooldownMs) {
            results.push({ ticketId: t.id, stage: stage.key, to, status: 'SKIPPED' })
            continue
          }
        }

        let id = existing?.id ?? null
        if (!id) {
          id = await insertReminderRow({ troubleTicketId: t.id, stage: stage.key, toNumber: to })
        }
        if (!id) {
          const again = await getReminderRow({ troubleTicketId: t.id, stage: stage.key, toNumber: to })
          id = again?.id ?? null
        }
        if (!id) {
          results.push({ ticketId: t.id, stage: stage.key, to, status: 'FAILED', error: 'Tidak bisa membuat log reminder' })
          failed += 1
          continue
        }

        queued += 1
        await markAttempt(id)
        try {
          if (!hasGateway) {
            await markManual(id)
            results.push({ ticketId: t.id, stage: stage.key, to, status: 'MANUAL', waLink: createWaLink(to, msg) })
            manual += 1
          } else {
            await sendWa(to, msg)
            await markSent(id)
            results.push({ ticketId: t.id, stage: stage.key, to, status: 'SENT' })
            sent += 1
          }
        } catch (e: unknown) {
          const err = e instanceof Error ? e.message : String(e)
          await markFailed(id, err)
          results.push({ ticketId: t.id, stage: stage.key, to, status: 'FAILED', error: err })
          failed += 1
        }
      }
    }
  }

  return NextResponse.json({
    now: now.toISOString(),
    intervalMinutes,
    mode: hasGateway ? 'AUTO' : 'MANUAL',
    recipients: recipients.length,
    openTickets: openTickets.length,
    considered,
    queued,
    manual,
    sent,
    failed,
    results: results.slice(-200),
  })
}
