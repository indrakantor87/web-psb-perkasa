import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { isDismantleEligible } from '@/lib/isolation-suspend'
import { normalizeMarketingName } from '@/lib/marketing-users'
import { ensureIsolationColumnsOnce } from '@/lib/isolation-schema'
import {
  canAccessMenu,
  canDeleteIsolationRecords,
  canMutateIsolationRecords,
  canUseAdminIsolationDismantleScope,
} from '@/lib/access'
import { unauthorizedResponse } from '@/lib/access-server'

function getIsolationFetchErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'Koneksi database Isolir gagal. Periksa DATABASE_URL / DIRECT_URL atau kredensial database.'
  }

  const message = String(error instanceof Error ? error.message : error)
  if (message.includes('tenant/user') || message.includes('PrismaClientInitializationError')) {
    return 'Koneksi database Isolir gagal. Periksa DATABASE_URL / DIRECT_URL atau kredensial database.'
  }

  return 'Failed to fetch isolations'
}

function hasDismantleHistory(item: {
  ticketDismantle?: unknown
  closeNote?: unknown
  closePhoto?: unknown
  status?: unknown
}) {
  const ticket = String(item.ticketDismantle ?? '').trim()
  const closeNote = String(item.closeNote ?? '').trim()
  const closePhoto = String(item.closePhoto ?? '').trim()
  const status = String(item.status ?? '').trim().toUpperCase()
  return ticket !== '' || closeNote !== '' || closePhoto !== '' || status === 'CLOSED'
}

function normalizeDismantleKeyPart(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function buildDismantleIdentity(item: {
  id?: unknown
  userEmail?: unknown
  customerPhone?: unknown
  customerName?: unknown
  customerAddress?: unknown
  isArchived?: unknown
  ticketDismantle?: unknown
  closeNote?: unknown
  closePhoto?: unknown
  status?: unknown
}) {
  const archived = item.isArchived === true
  if (archived && hasDismantleHistory(item)) {
    return `archive:${typeof item.id === 'number' ? item.id : String(item.id ?? '')}`
  }

  const userEmail = normalizeDismantleKeyPart(item.userEmail)
  if (userEmail) return `user:${userEmail}`

  const phone = String(item.customerPhone ?? '').replace(/\D/g, '')
  if (phone) return `phone:${phone}`

  const name = normalizeDismantleKeyPart(item.customerName)
  const address = normalizeDismantleKeyPart(item.customerAddress)
  if (name && address) return `name-address:${name}|${address}`
  if (name) return `name:${name}`

  return ''
}

function compareDismantlePriority(a: { ticketDismantle?: unknown; isolationDate?: unknown; id?: unknown }, b: { ticketDismantle?: unknown; isolationDate?: unknown; id?: unknown }) {
  const aHasTicket = String(a.ticketDismantle ?? '').trim() !== ''
  const bHasTicket = String(b.ticketDismantle ?? '').trim() !== ''
  if (aHasTicket !== bHasTicket) return aHasTicket ? 1 : -1

  const aTime = new Date(String(a.isolationDate ?? '')).getTime()
  const bTime = new Date(String(b.isolationDate ?? '')).getTime()
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return aTime > bTime ? 1 : -1
  }

  const aId = typeof a.id === 'number' ? a.id : 0
  const bId = typeof b.id === 'number' ? b.id : 0
  if (aId !== bId) return aId > bId ? 1 : -1

  return 0
}

function normalizePriceNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return Number(value)
  const raw = String(value).trim()
  if (!raw) return null
  const cleaned = raw
    .replace(/rp/gi, '')
    .replace(/\s+/g, '')
    .replace(/[^\d.,-]/g, '')
  if (!cleaned) return null
  const hasComma = cleaned.includes(',')
  const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/\./g, '')
  const num = parseFloat(normalized)
  if (Number.isNaN(num) || !Number.isFinite(num)) return null
  return num
}

function parseSortableTime(value: unknown) {
  const time = new Date(String(value ?? '')).getTime()
  return Number.isFinite(time) ? time : null
}

function compareIsolationListOrder(
  a: { importBatchAt?: unknown; importRowOrder?: unknown; activeDate?: unknown; isolationDate?: unknown; id?: unknown },
  b: { importBatchAt?: unknown; importRowOrder?: unknown; activeDate?: unknown; isolationDate?: unknown; id?: unknown },
  preserveImportOrder: boolean
) {
  if (preserveImportOrder) {
    const aBatch = parseSortableTime(a.importBatchAt)
    const bBatch = parseSortableTime(b.importBatchAt)

    if (aBatch !== null && bBatch !== null) {
      if (aBatch !== bBatch) return bBatch - aBatch

      const aRow = typeof a.importRowOrder === 'number' ? a.importRowOrder : Number(a.importRowOrder ?? NaN)
      const bRow = typeof b.importRowOrder === 'number' ? b.importRowOrder : Number(b.importRowOrder ?? NaN)
      if (Number.isFinite(aRow) && Number.isFinite(bRow) && aRow !== bRow) {
        return aRow - bRow
      }
    } else if (aBatch !== null || bBatch !== null) {
      return aBatch !== null ? -1 : 1
    }
  }

  const aActive = parseSortableTime(a.activeDate)
  const bActive = parseSortableTime(b.activeDate)
  if (aActive !== null && bActive !== null && aActive !== bActive) return bActive - aActive
  if (aActive !== null || bActive !== null) return aActive !== null ? -1 : 1

  const aIsolation = parseSortableTime(a.isolationDate)
  const bIsolation = parseSortableTime(b.isolationDate)
  if (aIsolation !== null && bIsolation !== null && aIsolation !== bIsolation) return bIsolation - aIsolation
  if (aIsolation !== null || bIsolation !== null) return aIsolation !== null ? -1 : 1

  return (typeof b.id === 'number' ? b.id : 0) - (typeof a.id === 'number' ? a.id : 0)
}

function filterToLatestImportSnapshot<T extends { importBatchAt?: unknown }>(items: T[], enabled: boolean) {
  if (!enabled) return items

  const latestBatchTime = items.reduce<number | null>((current, item) => {
    const time = parseSortableTime(item.importBatchAt)
    if (time === null) return current
    if (current === null || time > current) return time
    return current
  }, null)

  if (latestBatchTime === null) return items

  return items.filter((item) => parseSortableTime(item.importBatchAt) === latestBatchTime)
}

function shouldStayInIsolationList(item: {
  status?: unknown
  ticketDismantle?: unknown
  isolationDate?: unknown
}) {
  const status = String(item.status ?? '').trim().toUpperCase()
  if (status !== 'OPEN') return true

  const hasTicket = String(item.ticketDismantle ?? '').trim() !== ''
  if (hasTicket) return false

  return !isDismantleEligible(item.isolationDate as string | Date | null | undefined)
}

function buildSmartDismantleRows(items: any[]) {
  const map = new Map<string, any>()
  const passthrough: any[] = []

  for (const item of items) {
    const key = buildDismantleIdentity(item)
    if (!key) {
      passthrough.push(item)
      continue
    }

    const existing = map.get(key)
    if (!existing || compareDismantlePriority(item, existing) > 0) {
      map.set(key, item)
    }
  }

  return [...map.values(), ...passthrough].sort((a, b) => {
    const aTime = new Date(String(a.isolationDate ?? '')).getTime()
    const bTime = new Date(String(b.isolationDate ?? '')).getTime()
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return bTime - aTime
    return (typeof b.id === 'number' ? b.id : 0) - (typeof a.id === 'number' ? a.id : 0)
  })
}

function buildLegacyIsolationWhere(params: {
  search: string | null
  radboox: string | null
  marketing: string | null
  status: string | null
  roleUpper: string
  userName?: string | null
  divisionFilter: string
}) {
  const where: any = {}
  const appendAnd = (clause: any) => {
    const current = where.AND
    const arr = Array.isArray(current) ? current : current ? [current] : []
    where.AND = [...arr, clause]
  }

  if (params.status && params.status.trim() !== '') {
    where.status = params.status.trim().toUpperCase()
  }
  if (params.search) {
    where.OR = [
      { customerName: { contains: params.search, mode: 'insensitive' } },
      { customerAddress: { contains: params.search, mode: 'insensitive' } },
      { customerPhone: { contains: params.search, mode: 'insensitive' } },
      { userEmail: { contains: params.search, mode: 'insensitive' } },
      { marketing: { contains: params.search, mode: 'insensitive' } },
    ]
  }
  if (params.radboox && params.radboox !== 'ALL') {
    where.radboox = params.radboox
  }
  if (params.marketing && params.marketing.trim() !== '') {
    const exactMarketingClause = buildExactMarketingClause(params.marketing)
    if (exactMarketingClause) {
      appendAnd(exactMarketingClause)
    }
  }

  const privilegedRoles = ['ADMIN', 'CS', 'ADMIN_CS', 'NOC', 'DISMANTLE']
  if (!privilegedRoles.includes(params.roleUpper)) {
    const ownMarketingClause = buildExactMarketingClause(params.userName)
    if (ownMarketingClause) {
      appendAnd(ownMarketingClause)
    }
  }

  if (canUseAdminIsolationDismantleScope(params.roleUpper)) {
    if (params.divisionFilter === 'CS_ADMIN' && !params.status) {
      where.status = 'OPEN'
    } else if (params.divisionFilter === 'NOC_TROUBLESHOOTS' && !params.status) {
      where.status = 'CLOSED'
    } else if (params.divisionFilter === 'PENJUALAN' || params.divisionFilter === 'CREATOR_DIGITAL') {
      appendAnd({ id: { lt: 0 } })
    }
  }

  return where
}

function buildExactMarketingClause(value: unknown) {
  const normalized = normalizeMarketingName(value)
  if (!normalized) return null

  return {
    marketing: {
      equals: normalized,
      mode: 'insensitive' as const,
    },
  }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canAccessMenu(session.user.role, 'isolir') && !canAccessMenu(session.user.role, 'dismantle')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureIsolationColumnsOnce()

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const radboox = searchParams.get('radboox')
  const marketing = searchParams.get('marketing')
  const status = searchParams.get('status')
  const ticketStatus = (searchParams.get('ticketStatus') ?? 'ALL').trim().toUpperCase()
  const dismantleEligible = (searchParams.get('dismantleEligible') ?? '').trim().toLowerCase() === 'true'
  const exportAll = (searchParams.get('export') ?? '').trim().toLowerCase() === 'all'
  const divisionParam = (searchParams.get('division') ?? 'ALL').trim().toUpperCase()
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
  const limit = (() => {
    const n = parseInt(searchParams.get('limit') || '25', 10)
    if (exportAll && Number.isFinite(n) && n > 0) return Math.min(n, 50000)
    if ([25, 50, 75, 100].includes(n)) return n
    return 25
  })()
  const roleUpper = (session.user.role || '').toUpperCase()
  const divisionFilter =
    canUseAdminIsolationDismantleScope(roleUpper) &&
    ['ALL', 'PENJUALAN', 'CS_ADMIN', 'NOC_TROUBLESHOOTS', 'CREATOR_DIGITAL'].includes(divisionParam)
      ? divisionParam
      : 'ALL'

  const where: any = {}
  const appendAnd = (clause: any) => {
    const current = where.AND
    const arr = Array.isArray(current) ? current : current ? [current] : []
    where.AND = [...arr, clause]
  }
  const archiveVisibilityClause =
    !dismantleEligible
      ? {
          OR: [{ isArchived: false }, { isArchived: null }],
        }
      : null

  if (status && status.trim() !== '') {
    where.status = { equals: status.trim().toUpperCase(), mode: 'insensitive' }
  }
  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { customerAddress: { contains: search, mode: 'insensitive' } },
      { customerPhone: { contains: search, mode: 'insensitive' } },
      { userEmail: { contains: search, mode: 'insensitive' } },
      { marketing: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (radboox && radboox !== 'ALL') {
    where.radboox = radboox
  }
  if (marketing && marketing.trim() !== '') {
    const exactMarketingClause = buildExactMarketingClause(marketing)
    if (exactMarketingClause) {
      appendAnd(exactMarketingClause)
    }
  }
  if (ticketStatus === 'WITH') {
    appendAnd({
      ticketDismantle: { not: null },
    })
    appendAnd({
      NOT: {
        ticketDismantle: '',
      },
    })
  } else if (ticketStatus === 'WITHOUT') {
    appendAnd({
      OR: [{ ticketDismantle: null }, { ticketDismantle: '' }],
    })
  }
  if (dismantleEligible && !status) {
    appendAnd({ status: { equals: 'OPEN', mode: 'insensitive' } })
  }
  if (archiveVisibilityClause) {
    appendAnd(archiveVisibilityClause)
  }
  // Role-based restriction: non-privileged users hanya melihat isolir milik dirinya
  const privilegedRoles = ['ADMIN', 'CS', 'ADMIN_CS', 'NOC', 'DISMANTLE']
  if (!privilegedRoles.includes(roleUpper)) {
    const ownMarketingClause = buildExactMarketingClause(session.user.name)
    if (ownMarketingClause) {
      appendAnd(ownMarketingClause)
    }
  }

  if (canUseAdminIsolationDismantleScope(roleUpper)) {
    if (divisionFilter === 'CS_ADMIN' && !status) {
      appendAnd({ status: { equals: 'OPEN', mode: 'insensitive' } })
    } else if (divisionFilter === 'NOC_TROUBLESHOOTS' && !status) {
      appendAnd({ status: { equals: 'CLOSED', mode: 'insensitive' } })
    } else if (divisionFilter === 'PENJUALAN' || divisionFilter === 'CREATOR_DIGITAL') {
      appendAnd({ id: { lt: 0 } })
    }
  }

  const isMissingColumn = (e: unknown, column: string) => {
    if (typeof e !== 'object' || !e) return false
    const anyErr = e as { code?: unknown; message?: unknown }
    const code = typeof anyErr.code === 'string' ? anyErr.code : ''
    const msg = typeof anyErr.message === 'string' ? anyErr.message : ''
    return code === 'P2022' && msg.toLowerCase().includes(column.toLowerCase())
  }

  try {
    const ticketSelect =
      dismantleEligible
        ? {
            ticketId: true,
            ticket: {
              select: {
                package: true,
                locationMap: true,
                description: true,
              },
            },
          }
        : {}

    const selectAll: any = {
      id: true,
      customerName: true,
      customerAddress: true,
      customerPhone: true,
      userEmail: true,
      activeDate: true,
      marketing: true,
      radboox: true,
      price: true,
      isolationDate: true,
      reason: true,
      status: true,
      restorationDate: true,
      closeNote: true,
      closePhoto: true,
      teknisi: true,
      ticketDismantle: true,
      isArchived: true,
      archivedAt: true,
      importBatchAt: true,
      importRowOrder: true,
      ...ticketSelect,
    }
    const selectNoPrice: any = {
      id: true,
      customerName: true,
      customerAddress: true,
      customerPhone: true,
      userEmail: true,
      activeDate: true,
      marketing: true,
      radboox: true,
      isolationDate: true,
      reason: true,
      status: true,
      restorationDate: true,
      closeNote: true,
      closePhoto: true,
      teknisi: true,
      ticketDismantle: true,
      isArchived: true,
      archivedAt: true,
      importBatchAt: true,
      importRowOrder: true,
      ...ticketSelect,
    }
    const selectNoClose: any = {
      ...selectAll,
    }
    delete selectNoClose.closeNote
    delete selectNoClose.closePhoto
    const selectNoPriceNoClose: any = {
      ...selectNoPrice,
    }
    delete selectNoPriceNoClose.closeNote
    delete selectNoPriceNoClose.closePhoto
    const selectNoArchive: any = {
      ...selectAll,
    }
    delete selectNoArchive.isArchived
    delete selectNoArchive.archivedAt
    const selectLegacy: any = {
      ...selectNoPriceNoClose,
    }
    delete selectLegacy.isArchived
    delete selectLegacy.archivedAt

    let isolationsRaw: any[]
    try {
      isolationsRaw = await (prisma as any).isolation.findMany({
        where,
        orderBy: [{ activeDate: 'desc' }, { isolationDate: 'desc' }, { id: 'desc' }],
        select: selectAll,
      })
    } catch (e) {
      const missingPrice = isMissingColumn(e, 'price')
      const missingCloseNote = isMissingColumn(e, 'closeNote')
      const missingClosePhoto = isMissingColumn(e, 'closePhoto')
      const missingIsArchived = isMissingColumn(e, 'isArchived')
      const missingArchivedAt = isMissingColumn(e, 'archivedAt')

      if (!missingPrice && !missingCloseNote && !missingClosePhoto && !missingIsArchived && !missingArchivedAt) throw e

      const whereFallback =
        missingIsArchived || missingArchivedAt
          ? {
              ...where,
              AND: Array.isArray(where.AND)
                ? where.AND.filter((clause: any) => clause !== archiveVisibilityClause)
                : where.AND === archiveVisibilityClause
                  ? undefined
                  : where.AND,
            }
          : where

      if (whereFallback.AND === undefined) {
        delete whereFallback.AND
      }

      const selectFallback =
        missingIsArchived || missingArchivedAt
          ? missingPrice || missingCloseNote || missingClosePhoto
            ? selectLegacy
            : selectNoArchive
          : missingPrice
            ? missingCloseNote || missingClosePhoto
              ? selectNoPriceNoClose
              : selectNoPrice
            : selectNoClose

      isolationsRaw = await (prisma as any).isolation.findMany({
        where: whereFallback,
        orderBy: [{ activeDate: 'desc' }, { isolationDate: 'desc' }, { id: 'desc' }],
        select: selectFallback,
      })

      isolationsRaw = isolationsRaw.map((x: any) => ({
        ...x,
        ...(missingPrice ? { price: null } : {}),
        ...(missingCloseNote ? { closeNote: null } : {}),
        ...(missingClosePhoto ? { closePhoto: null } : {}),
        ...(missingIsArchived ? { isArchived: false } : {}),
        ...(missingArchivedAt ? { archivedAt: null } : {}),
      }))
    }

    const filteredIsolations = dismantleEligible
      ? buildSmartDismantleRows(
          isolationsRaw.filter((item: any) => {
            if (item?.isArchived) return hasDismantleHistory(item)
            return isDismantleEligible(item.isolationDate)
          })
        )
      : divisionFilter === 'CS_ADMIN'
        ? isolationsRaw.filter((item: any) => shouldStayInIsolationList(item))
        : isolationsRaw

    const preferImportOrder = Boolean(radboox && radboox !== 'ALL')
    const snapshotIsolations = filterToLatestImportSnapshot(filteredIsolations, preferImportOrder)
    const orderedIsolations = [...snapshotIsolations].sort((a, b) =>
      compareIsolationListOrder(a, b, preferImportOrder)
    )

    const total = orderedIsolations.length
    const withTicketTotal = orderedIsolations.filter((item: any) => String(item?.ticketDismantle ?? '').trim() !== '').length
    const withoutTicketTotal = total - withTicketTotal
    const isolations = exportAll
      ? orderedIsolations
      : orderedIsolations.slice((page - 1) * limit, page * limit)

    const payload = {
      items: isolations.map((item: any) => ({ ...item, price: normalizePriceNumber(item?.price) })),
      total,
      ...(dismantleEligible ? { withTicketTotal, withoutTicketTotal } : {}),
      page,
      limit
    }
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (!dismantleEligible) {
      try {
        const legacyWhere = buildLegacyIsolationWhere({
          search,
          radboox,
          marketing,
          status,
          roleUpper,
          userName: session.user.name,
          divisionFilter,
        })

        const legacySelectBase = {
          id: true,
          customerName: true,
          customerAddress: true,
          customerPhone: true,
          userEmail: true,
          activeDate: true,
          marketing: true,
          radboox: true,
          price: true,
          isolationDate: true,
          reason: true,
          status: true,
          restorationDate: true,
          teknisi: true,
        }

        let total: number
        let items: any[]
        try {
          ;[total, items] = await Promise.all([
            prisma.isolation.count({ where: legacyWhere }),
            (prisma as any).isolation.findMany({
              where: legacyWhere,
              orderBy: [{ activeDate: 'desc' }, { isolationDate: 'desc' }, { id: 'desc' }],
              ...(exportAll ? {} : { skip: (page - 1) * limit, take: limit }),
              select: legacySelectBase,
            }),
          ])
        } catch {
          const legacySelectFallback = { ...legacySelectBase }
          delete (legacySelectFallback as any).price
          ;[total, items] = await Promise.all([
            prisma.isolation.count({ where: legacyWhere }),
            (prisma as any).isolation.findMany({
              where: legacyWhere,
              orderBy: [{ activeDate: 'desc' }, { isolationDate: 'desc' }, { id: 'desc' }],
              ...(exportAll ? {} : { skip: (page - 1) * limit, take: limit }),
              select: legacySelectFallback,
            }),
          ])
        }

        const payload = {
          items: items.map((item: any) => ({
            ...item,
            price: normalizePriceNumber(item?.price),
            ticketDismantle: null,
            closeNote: null,
            closePhoto: null,
            isArchived: false,
            archivedAt: null,
            ticketId: null,
            ticket: null,
          })),
          total,
          page,
          limit,
        }

        console.warn('GET /api/isolations fell back to legacy query path', error)
        return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
      } catch (legacyError) {
        console.error('Legacy isolation fallback failed:', legacyError)
      }
    }

    console.error('Failed to fetch isolations:', error)
    const errorMessage = getIsolationFetchErrorMessage(error)
    const httpStatus = errorMessage === 'Failed to fetch isolations' ? 500 : 503
    return NextResponse.json({ error: errorMessage }, { status: httpStatus })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canMutateIsolationRecords(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await ensureIsolationColumnsOnce()

  const isMissingPriceColumn = (e: unknown) => {
    if (typeof e !== 'object' || !e) return false
    const anyErr = e as { code?: unknown; message?: unknown }
    const code = typeof anyErr.code === 'string' ? anyErr.code : ''
    const msg = typeof anyErr.message === 'string' ? anyErr.message : ''
    return code === 'P2022' && msg.toLowerCase().includes('price')
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const customerName = String(body.customerName ?? '')
    const customerAddress = typeof body.customerAddress === 'string' ? body.customerAddress : undefined
    const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone : undefined
    const userEmail = typeof body.userEmail === 'string' ? body.userEmail : null
    const marketing = typeof body.marketing === 'string' ? body.marketing : null
    const reason = typeof body.reason === 'string' ? body.reason : undefined
    const teknisi = typeof body.teknisi === 'string' ? body.teknisi : undefined
    const radboox = typeof body.radboox === 'string' ? body.radboox : null
    const activeDate = body.activeDate ? new Date(String(body.activeDate)) : null
    const priceRaw = body.price
    const priceNum = normalizePriceNumber(priceRaw)
    const price = priceNum == null ? null : new Prisma.Decimal(priceNum)
    const ticketIdRaw = body.ticketId
    const ticketId = typeof ticketIdRaw === 'number' ? Math.trunc(ticketIdRaw) : typeof ticketIdRaw === 'string' ? parseInt(ticketIdRaw, 10) : null

    const createData = {
      customerName,
      customerAddress,
      customerPhone,
      userEmail,
      activeDate,
      marketing,
      radboox,
      price,
      reason,
      teknisi: teknisi || session.user.name,
      ticketId,
      status: 'OPEN',
    }

    let isolation: any
    try {
      isolation = await (prisma as any).isolation.create({ data: createData })
    } catch (e) {
      if (!isMissingPriceColumn(e)) throw e
      const dataNoPrice: any = { ...createData }
      delete dataNoPrice.price
      isolation = await (prisma as any).isolation.create({ data: dataNoPrice })
    }

    return NextResponse.json(isolation)
  } catch (error) {
    console.error('Failed to create isolation:', error)
    return NextResponse.json({ error: 'Failed to create isolation' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) return unauthorizedResponse()
  if (!canDeleteIsolationRecords(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    await ensureIsolationColumnsOnce()
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown; preserveDismantleHistory?: unknown }
    const idsRaw = body?.ids
    const preserveDismantleHistory = body?.preserveDismantleHistory === true
    const ids =
      Array.isArray(idsRaw)
        ? idsRaw.map((x) => (typeof x === 'number' ? x : typeof x === 'string' ? parseInt(x, 10) : NaN)).filter((n) => Number.isFinite(n)) as number[]
        : null

    if (preserveDismantleHistory) {
      const targets = await (prisma as any).isolation.findMany({
        where: ids && ids.length > 0 ? { id: { in: ids } } : undefined,
        select: {
          id: true,
          ticketDismantle: true,
          closeNote: true,
          closePhoto: true,
          status: true,
        },
      })

      const archivedIds = targets
        .filter((item: any) => hasDismantleHistory(item))
        .map((item: any) => Number(item.id))
        .filter((id: number) => Number.isFinite(id))
      const deletedIds = targets
        .filter((item: any) => !hasDismantleHistory(item))
        .map((item: any) => Number(item.id))
        .filter((id: number) => Number.isFinite(id))

      if (archivedIds.length > 0) {
        await (prisma as any).isolation.updateMany({
          where: { id: { in: archivedIds } },
          data: {
            isArchived: true,
            archivedAt: new Date(),
          },
        })
      }

      const deleted = deletedIds.length > 0
        ? await (prisma as any).isolation.deleteMany({ where: { id: { in: deletedIds } } })
        : { count: 0 }

      return NextResponse.json({
        success: true,
        count: archivedIds.length + deleted.count,
        archivedCount: archivedIds.length,
        deletedCount: deleted.count,
      })
    }

    const deleted = ids && ids.length > 0
      ? await (prisma as any).isolation.deleteMany({ where: { id: { in: ids } } })
      : await (prisma as any).isolation.deleteMany({})

    return NextResponse.json({ success: true, count: deleted.count })
  } catch (error) {
    console.error('Failed to bulk delete isolations:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
