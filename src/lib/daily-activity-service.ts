import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { JAKARTA_OFFSET_MS } from '@/lib/jakarta-time'
import {
  DAILY_ACTIVITY_EXECUTION_STATUSES,
  DAILY_ACTIVITY_APPROVAL_STATUSES,
  type DailyActivityApprovalStatus,
  type DailyActivityExecutionStatus,
  type DailyActivityPlanningLevel,
  type DailyActivityPriorityLevel,
  getDailyActivityLevelRank,
  isDailyActivityApproverLevel,
  isDailyActivityExecutionStatus,
  isDailyActivityPriorityLevel,
  isValidDailyActivityDivision,
  isValidDailyActivitySubdivision,
  normalizeDailyActivityDivisionName,
  normalizeDailyActivityPlanningLevel,
  resolveDefaultDailyActivitySubdivision,
} from '@/lib/daily-activity-org'
import { ensureDailyActivityTables } from '@/lib/daily-activity-schema'
import type { SessionUser } from '@/lib/auth'
import { isAdminRole, normalizeRole } from '@/lib/access'

export type DailyActivityScope = {
  userId: number
  userName: string
  role: string
  division: string
  subdivision: string | null
  planningLevel: DailyActivityPlanningLevel
  /** ADMIN/DEVELOPER dapat melihat & menyetujui seluruh divisi. */
  isAdmin: boolean
  /** True bila level user termasuk LEADER/SPV/MANAGER. */
  isApprover: boolean
  profileSaved: boolean
}

export type DailyActivityItemDto = {
  id: number
  code: string
  activityDate: string
  dateKey: string
  ownerUserId: number | null
  ownerName: string
  division: string
  subdivision: string | null
  planningLevel: DailyActivityPlanningLevel
  title: string
  detail: string | null
  location: string | null
  target: string | null
  priorityLevel: DailyActivityPriorityLevel
  executionStatus: DailyActivityExecutionStatus
  progressPercent: number
  planNote: string | null
  resultNote: string | null
  obstacleNote: string | null
  closedAt: string | null
  approvalStatus: DailyActivityApprovalStatus
  approvalNote: string | null
  approvedByName: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export type DailyActivityPerformanceRow = {
  key: string
  label: string
  total: number
  planned: number
  done: number
  pending: number
  cancel: number
  progressAvg: number
}

export type DailyActivityCalendarDay = {
  dateKey: string
  total: number
  done: number
  pending: number
}

export type DailyActivitySummary = {
  total: number
  planned: number
  done: number
  pending: number
  cancel: number
  approvalPending: number
  approvalApproved: number
  approvalRejected: number
  progressAvg: number
}

export type DailyActivityProfileDto = {
  userId: number
  userName: string
  division: string
  subdivision: string | null
  planningLevel: DailyActivityPlanningLevel
  approverUserId: number | null
  updatedAt: string | null
}

export type DailyActivityUserOption = {
  id: number
  name: string
  division: string | null
  role: string
}

export type DailyActivityPageData = {
  scope: DailyActivityScope
  items: DailyActivityItemDto[]
  summary: DailyActivitySummary
  performance: {
    daily: DailyActivityPerformanceRow[]
    weekly: DailyActivityPerformanceRow[]
    monthly: DailyActivityPerformanceRow[]
  }
  calendar: DailyActivityCalendarDay[]
  approvalQueue: DailyActivityItemDto[]
  profile: DailyActivityProfileDto
  users: DailyActivityUserOption[]
}

export type DailyActivityFilters = {
  from?: string | null
  to?: string | null
  division?: string | null
  subdivision?: string | null
  ownerName?: string | null
  executionStatus?: string | null
  approvalStatus?: string | null
  priorityLevel?: string | null
  keyword?: string | null
  scope?: 'all' | 'mine' | 'team' | null
}

export type DailyActivityPlanInput = {
  activityDate: string
  title: string
  detail?: string | null
  location?: string | null
  target?: string | null
  priorityLevel?: string | null
  division?: string | null
  subdivision?: string | null
}

export type DailyActivityCloseInput = {
  executionStatus: string
  progressPercent?: number | null
  resultNote?: string | null
  obstacleNote?: string | null
  submitApproval?: boolean
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toJakartaDateKey(value: Date) {
  const shifted = new Date(value.getTime() + JAKARTA_OFFSET_MS)
  return shifted.toISOString().slice(0, 10)
}

function jakartaStartOfDay(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map((part) => Number(part))
  return new Date(Date.UTC(y, m - 1, d) - JAKARTA_OFFSET_MS)
}

function jakartaEndOfDayExclusive(dateKey: string) {
  const start = jakartaStartOfDay(dateKey)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function clampProgress(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function normalizeDateKey(value?: string | null) {
  const raw = String(value ?? '').trim()
  if (DATE_KEY_PATTERN.test(raw)) return raw
  if (raw) {
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return toJakartaDateKey(parsed)
  }
  return toJakartaDateKey(new Date())
}

function startOfIsoWeek(dateKey: string) {
  const date = jakartaStartOfDay(dateKey)
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS)
  const dow = shifted.getUTCDay()
  const diff = (dow + 6) % 7 // Senin sebagai awal minggu
  shifted.setUTCDate(shifted.getUTCDate() - diff)
  return shifted.toISOString().slice(0, 10)
}

type DailyActivityRow = Prisma.DailyActivityItemGetPayload<Record<string, never>>

function toItemDto(row: DailyActivityRow): DailyActivityItemDto {
  return {
    id: row.id,
    code: row.code,
    activityDate: row.activityDate.toISOString(),
    dateKey: toJakartaDateKey(row.activityDate),
    ownerUserId: row.ownerUserId ?? null,
    ownerName: row.ownerName,
    division: row.division,
    subdivision: row.subdivision ?? null,
    planningLevel: normalizeDailyActivityPlanningLevel(row.planningLevel),
    title: row.title,
    detail: row.detail ?? null,
    location: row.location ?? null,
    target: row.target ?? null,
    priorityLevel: isDailyActivityPriorityLevel(row.priorityLevel) ? row.priorityLevel : 'MEDIUM',
    executionStatus: isDailyActivityExecutionStatus(row.executionStatus) ? row.executionStatus : 'PLANNED',
    progressPercent: row.progressPercent ?? 0,
    planNote: row.planNote ?? null,
    resultNote: row.resultNote ?? null,
    obstacleNote: row.obstacleNote ?? null,
    closedAt: toIso(row.closedAt),
    approvalStatus: (DAILY_ACTIVITY_APPROVAL_STATUSES as readonly string[]).includes(row.approvalStatus)
      ? (row.approvalStatus as DailyActivityApprovalStatus)
      : 'NONE',
    approvalNote: row.approvalNote ?? null,
    approvedByName: row.approvedByName ?? null,
    approvedAt: toIso(row.approvedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Level default diturunkan dari role PSB bila user belum menyimpan profil Daily Activity. */
function deriveDefaultPlanningLevel(role?: string | null): DailyActivityPlanningLevel {
  const roleUpper = normalizeRole(role)
  if (isAdminRole(roleUpper)) return 'MANAGER'
  if (roleUpper === 'HR') return 'SPV'
  return 'STAFF'
}

export async function resolveDailyActivityScope(user: SessionUser): Promise<DailyActivityScope> {
  await ensureDailyActivityTables()

  const profile = await prisma.dailyActivityProfile.findUnique({ where: { userId: user.id } })

  const division = normalizeDailyActivityDivisionName(profile?.division ?? user.division ?? null)
  const planningLevel = profile
    ? normalizeDailyActivityPlanningLevel(profile.planningLevel)
    : deriveDefaultPlanningLevel(user.role)

  return {
    userId: user.id,
    userName: user.name,
    role: user.role,
    division,
    subdivision: profile?.subdivision ?? null,
    planningLevel,
    isAdmin: isAdminRole(user.role),
    isApprover: isDailyActivityApproverLevel(planningLevel),
    profileSaved: Boolean(profile),
  }
}

export function canEditDailyActivityItem(scope: DailyActivityScope, item: DailyActivityItemDto) {
  if (scope.isAdmin) return true
  if (item.ownerUserId === scope.userId) return true
  return false
}

/**
 * Atasan (LEADER/SPV/MANAGER) dapat menyetujui aktivitas anggota divisi yang
 * levelnya lebih rendah. ADMIN/DEVELOPER menjadi override seluruh divisi.
 */
export function canApproveDailyActivityItem(scope: DailyActivityScope, item: DailyActivityItemDto) {
  if (item.approvalStatus !== 'PENDING') return false
  if (scope.isAdmin) return true
  if (!scope.isApprover) return false
  if (item.ownerUserId === scope.userId) return false
  if (item.division !== scope.division) return false
  return getDailyActivityLevelRank(item.planningLevel) < getDailyActivityLevelRank(scope.planningLevel)
}

/**
 * Role yang dapat melihat Daily Activity seluruh divisi (untuk keperluan
 * laporan manajemen). General Affair (sub divisi Legal) mengelola
 * rekap aktivitas harian lintas divisi.
 */
function isDailyActivityAllDivisionsRole(role?: string | null): boolean {
  const roleUpper = normalizeRole(role)
  if (isAdminRole(roleUpper)) return true
  if (roleUpper === 'GENERAL_AFFAIR') return true
  return false
}

function buildVisibilityWhere(scope: DailyActivityScope, scopeFilter?: string | null): Prisma.DailyActivityItemWhereInput {
  const mode = (scopeFilter ?? 'all').toLowerCase()

  if (mode === 'mine') return { ownerUserId: scope.userId }

  if (isDailyActivityAllDivisionsRole(scope.role)) return {}

  if (mode === 'team' || scope.isApprover) {
    return {
      OR: [{ ownerUserId: scope.userId }, { division: scope.division }],
    }
  }

  return { ownerUserId: scope.userId }
}

function buildFilterWhere(filters: DailyActivityFilters): Prisma.DailyActivityItemWhereInput {
  const where: Prisma.DailyActivityItemWhereInput = {}

  const from = filters.from ? normalizeDateKey(filters.from) : null
  const to = filters.to ? normalizeDateKey(filters.to) : null

  if (from || to) {
    const range: Prisma.DateTimeFilter = {}
    if (from) range.gte = jakartaStartOfDay(from)
    if (to) range.lt = jakartaEndOfDayExclusive(to)
    where.activityDate = range
  }

  if (filters.division && isValidDailyActivityDivision(filters.division)) {
    where.division = String(filters.division).trim()
  }
  if (filters.subdivision && String(filters.subdivision).trim()) {
    where.subdivision = { equals: String(filters.subdivision).trim(), mode: 'insensitive' }
  }
  if (filters.ownerName && String(filters.ownerName).trim()) {
    where.ownerName = { contains: String(filters.ownerName).trim(), mode: 'insensitive' }
  }
  if (filters.executionStatus && isDailyActivityExecutionStatus(filters.executionStatus)) {
    where.executionStatus = String(filters.executionStatus).trim().toUpperCase()
  }
  if (filters.approvalStatus && (DAILY_ACTIVITY_APPROVAL_STATUSES as readonly string[]).includes(filters.approvalStatus.toUpperCase())) {
    where.approvalStatus = filters.approvalStatus.toUpperCase()
  }
  if (filters.priorityLevel && isDailyActivityPriorityLevel(filters.priorityLevel)) {
    where.priorityLevel = String(filters.priorityLevel).trim().toUpperCase()
  }
  if (filters.keyword && String(filters.keyword).trim()) {
    const keyword = String(filters.keyword).trim()
    where.OR = [
      { title: { contains: keyword, mode: 'insensitive' } },
      { detail: { contains: keyword, mode: 'insensitive' } },
      { location: { contains: keyword, mode: 'insensitive' } },
      { code: { contains: keyword, mode: 'insensitive' } },
    ]
  }

  return where
}

function combineWhere(
  ...parts: Prisma.DailyActivityItemWhereInput[]
): Prisma.DailyActivityItemWhereInput {
  const clauses = parts.filter((part) => Object.keys(part).length > 0)
  if (clauses.length === 0) return {}
  if (clauses.length === 1) return clauses[0]
  return { AND: clauses }
}

function buildSummary(items: DailyActivityItemDto[]): DailyActivitySummary {
  const summary: DailyActivitySummary = {
    total: items.length,
    planned: 0,
    done: 0,
    pending: 0,
    cancel: 0,
    approvalPending: 0,
    approvalApproved: 0,
    approvalRejected: 0,
    progressAvg: 0,
  }

  let progressTotal = 0
  for (const item of items) {
    if (item.executionStatus === 'PLANNED') summary.planned += 1
    else if (item.executionStatus === 'DONE') summary.done += 1
    else if (item.executionStatus === 'PENDING') summary.pending += 1
    else if (item.executionStatus === 'CANCEL') summary.cancel += 1

    if (item.approvalStatus === 'PENDING') summary.approvalPending += 1
    else if (item.approvalStatus === 'APPROVED') summary.approvalApproved += 1
    else if (item.approvalStatus === 'REJECTED') summary.approvalRejected += 1

    progressTotal += item.progressPercent
  }

  summary.progressAvg = items.length ? Math.round(progressTotal / items.length) : 0
  return summary
}

function buildPerformance(items: DailyActivityItemDto[]) {
  const daily = new Map<string, DailyActivityPerformanceRow>()
  const weekly = new Map<string, DailyActivityPerformanceRow>()
  const monthly = new Map<string, DailyActivityPerformanceRow>()

  const register = (
    bucket: Map<string, DailyActivityPerformanceRow>,
    key: string,
    label: string,
    item: DailyActivityItemDto
  ) => {
    const row = bucket.get(key) ?? {
      key,
      label,
      total: 0,
      planned: 0,
      done: 0,
      pending: 0,
      cancel: 0,
      progressAvg: 0,
    }
    row.total += 1
    if (item.executionStatus === 'PLANNED') row.planned += 1
    else if (item.executionStatus === 'DONE') row.done += 1
    else if (item.executionStatus === 'PENDING') row.pending += 1
    else if (item.executionStatus === 'CANCEL') row.cancel += 1
    row.progressAvg += item.progressPercent
    bucket.set(key, row)
  }

  for (const item of items) {
    register(daily, item.dateKey, item.dateKey, item)
    const weekKey = startOfIsoWeek(item.dateKey)
    register(weekly, weekKey, `Minggu ${weekKey}`, item)
    const monthKey = item.dateKey.slice(0, 7)
    register(monthly, monthKey, monthKey, item)
  }

  const finalize = (bucket: Map<string, DailyActivityPerformanceRow>) =>
    Array.from(bucket.values())
      .map((row) => ({ ...row, progressAvg: row.total ? Math.round(row.progressAvg / row.total) : 0 }))
      .sort((a, b) => (a.key < b.key ? 1 : -1))

  return {
    daily: finalize(daily),
    weekly: finalize(weekly),
    monthly: finalize(monthly),
  }
}

function buildCalendar(items: DailyActivityItemDto[]): DailyActivityCalendarDay[] {
  const bucket = new Map<string, DailyActivityCalendarDay>()
  for (const item of items) {
    const day = bucket.get(item.dateKey) ?? { dateKey: item.dateKey, total: 0, done: 0, pending: 0 }
    day.total += 1
    if (item.executionStatus === 'DONE') day.done += 1
    else if (item.executionStatus !== 'CANCEL') day.pending += 1
    bucket.set(item.dateKey, day)
  }
  return Array.from(bucket.values()).sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
}

async function resolveProfileDto(scope: DailyActivityScope): Promise<DailyActivityProfileDto> {
  const profile = await prisma.dailyActivityProfile.findUnique({ where: { userId: scope.userId } })
  return {
    userId: scope.userId,
    userName: scope.userName,
    division: scope.division,
    subdivision: scope.subdivision,
    planningLevel: scope.planningLevel,
    approverUserId: profile?.approverUserId ?? null,
    updatedAt: toIso(profile?.updatedAt ?? null),
  }
}

export async function getDailyActivityPageData(
  user: SessionUser,
  filters: DailyActivityFilters = {}
): Promise<DailyActivityPageData> {
  const scope = await resolveDailyActivityScope(user)
  const where = combineWhere(buildVisibilityWhere(scope, filters.scope), buildFilterWhere(filters))

  const rows = await prisma.dailyActivityItem.findMany({
    where,
    orderBy: [{ activityDate: 'desc' }, { id: 'desc' }],
    take: 500,
  })

  const items = rows.map(toItemDto)

  const queueWhere: Prisma.DailyActivityItemWhereInput = scope.isAdmin
    ? { approvalStatus: 'PENDING' }
    : scope.isApprover
      ? { approvalStatus: 'PENDING', division: scope.division, NOT: { ownerUserId: scope.userId } }
      : { approvalStatus: 'PENDING', ownerUserId: -1 }

  const queueRows = await prisma.dailyActivityItem.findMany({
    where: queueWhere,
    orderBy: [{ activityDate: 'desc' }, { id: 'desc' }],
    take: 100,
  })

  const users = await prisma.user.findMany({
    select: { id: true, name: true, division: true, role: true },
    orderBy: { name: 'asc' },
    take: 300,
  })

  return {
    scope,
    items,
    summary: buildSummary(items),
    performance: buildPerformance(items),
    calendar: buildCalendar(items),
    approvalQueue: queueRows.map(toItemDto).filter((item) => canApproveDailyActivityItem(scope, item)),
    profile: await resolveProfileDto(scope),
    users,
  }
}

async function generateDailyActivityCode(activityDate: Date) {
  const shifted = new Date(activityDate.getTime() + JAKARTA_OFFSET_MS)
  const prefix = `DA-${shifted.getUTCFullYear()}${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-`

  const rows = await prisma.$queryRawUnsafe<Array<{ maxSuffix: number | null }>>(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '^DA-[0-9]{6}-', ''), '')::int), 0) AS "maxSuffix"
     FROM psb_daily_activity_items
     WHERE code LIKE $1`,
    `${prefix}%`
  )

  const next = Number(rows?.[0]?.maxSuffix ?? 0) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

export async function createDailyActivityItems(
  user: SessionUser,
  inputs: DailyActivityPlanInput[]
): Promise<DailyActivityItemDto[]> {
  const scope = await resolveDailyActivityScope(user)
  const created: DailyActivityItemDto[] = []

  for (const input of inputs) {
    const title = String(input.title ?? '').trim()
    if (!title) continue

    const activityDate = jakartaStartOfDay(normalizeDateKey(input.activityDate))
    const division = scope.isAdmin && isValidDailyActivityDivision(input.division)
      ? normalizeDailyActivityDivisionName(input.division)
      : scope.division

    const subdivision = scope.isAdmin && isValidDailyActivitySubdivision(division, input.subdivision)
      ? String(input.subdivision).trim()
      : scope.subdivision && isValidDailyActivitySubdivision(division, scope.subdivision)
        ? scope.subdivision
        : resolveDefaultDailyActivitySubdivision(division)

    let row: DailyActivityRow | null = null
    for (let attempt = 0; attempt < 5 && !row; attempt += 1) {
      const code = await generateDailyActivityCode(activityDate)
      try {
        row = await prisma.dailyActivityItem.create({
          data: {
            code,
            activityDate,
            ownerUserId: scope.userId,
            ownerName: scope.userName,
            division,
            subdivision,
            planningLevel: scope.planningLevel,
            title,
            detail: input.detail ? String(input.detail).trim() : null,
            location: input.location ? String(input.location).trim() : null,
            target: input.target ? String(input.target).trim() : null,
            priorityLevel: isDailyActivityPriorityLevel(input.priorityLevel)
              ? String(input.priorityLevel).trim().toUpperCase()
              : 'MEDIUM',
            executionStatus: 'PLANNED',
            progressPercent: 0,
            approvalStatus: 'NONE',
            createdById: scope.userId,
          },
        })
      } catch (error) {
        if (attempt === 4) throw error
      }
    }

    if (row) created.push(toItemDto(row))
  }

  return created
}

export async function closeDailyActivityItem(
  user: SessionUser,
  id: number,
  input: DailyActivityCloseInput
): Promise<DailyActivityItemDto> {
  const scope = await resolveDailyActivityScope(user)
  const existing = await prisma.dailyActivityItem.findUnique({ where: { id } })
  if (!existing) throw new Error('Aktivitas tidak ditemukan')

  const current = toItemDto(existing)
  if (!canEditDailyActivityItem(scope, current)) throw new Error('Tidak berhak mengubah aktivitas ini')

  const executionStatus: DailyActivityExecutionStatus = isDailyActivityExecutionStatus(input.executionStatus)
    ? (String(input.executionStatus).trim().toUpperCase() as DailyActivityExecutionStatus)
    : 'DONE'

  const progressPercent =
    executionStatus === 'DONE'
      ? 100
      : executionStatus === 'PLANNED'
        ? 0
        : clampProgress(input.progressPercent ?? current.progressPercent)

  const submitApproval = Boolean(input.submitApproval)
  const shouldResetApproval = executionStatus === 'PLANNED' || executionStatus === 'CANCEL'

  const updated = await prisma.dailyActivityItem.update({
    where: { id },
    data: {
      executionStatus,
      progressPercent,
      resultNote: input.resultNote !== undefined ? (input.resultNote ? String(input.resultNote).trim() : null) : existing.resultNote,
      obstacleNote: input.obstacleNote !== undefined ? (input.obstacleNote ? String(input.obstacleNote).trim() : null) : existing.obstacleNote,
      closedAt: executionStatus === 'DONE' || executionStatus === 'CANCEL' ? new Date() : null,
      approvalStatus: shouldResetApproval
        ? 'NONE'
        : submitApproval && current.approvalStatus !== 'APPROVED'
          ? 'PENDING'
          : current.approvalStatus,
    },
  })

  return toItemDto(updated)
}

export type DailyActivityApprovalDecision = 'APPROVE' | 'REJECT'

export type DailyActivityApprovalResult = {
  approved: number
  rejected: number
  skipped: number
  items: DailyActivityItemDto[]
}

export async function reviewDailyActivityItems(
  user: SessionUser,
  ids: number[],
  decision: DailyActivityApprovalDecision,
  note?: string | null
): Promise<DailyActivityApprovalResult> {
  const scope = await resolveDailyActivityScope(user)
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id))))

  const result: DailyActivityApprovalResult = { approved: 0, rejected: 0, skipped: 0, items: [] }

  for (const id of uniqueIds) {
    const existing = await prisma.dailyActivityItem.findUnique({ where: { id } })
    if (!existing) {
      result.skipped += 1
      continue
    }

    const current = toItemDto(existing)
    if (!canApproveDailyActivityItem(scope, current)) {
      result.skipped += 1
      continue
    }

    const approvalStatus: DailyActivityApprovalStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'

    const updated = await prisma.dailyActivityItem.update({
      where: { id },
      data: {
        approvalStatus,
        approvalNote: note ? String(note).trim() : null,
        approvedByUserId: scope.userId,
        approvedByName: scope.userName,
        approvedAt: new Date(),
        progressPercent:
          approvalStatus === 'APPROVED' && current.executionStatus === 'DONE' ? 100 : current.progressPercent,
      },
    })

    if (approvalStatus === 'APPROVED') result.approved += 1
    else result.rejected += 1
    result.items.push(toItemDto(updated))
  }

  return result
}

export async function deleteDailyActivityItem(user: SessionUser, id: number) {
  const scope = await resolveDailyActivityScope(user)
  const existing = await prisma.dailyActivityItem.findUnique({ where: { id } })
  if (!existing) throw new Error('Aktivitas tidak ditemukan')

  const current = toItemDto(existing)
  if (!canEditDailyActivityItem(scope, current)) throw new Error('Tidak berhak menghapus aktivitas ini')

  await prisma.dailyActivityItem.delete({ where: { id } })
  return { id }
}

export async function saveDailyActivityProfile(
  user: SessionUser,
  input: { division?: string | null; subdivision?: string | null; planningLevel?: string | null; userId?: number | null }
) {
  const scope = await resolveDailyActivityScope(user)
  const targetUserId = scope.isAdmin && Number.isFinite(Number(input.userId)) ? Number(input.userId) : scope.userId

  const target = targetUserId === scope.userId
    ? { id: scope.userId, name: scope.userName }
    : await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, name: true } })

  if (!target) throw new Error('Pengguna tidak ditemukan')

  const division = normalizeDailyActivityDivisionName(input.division ?? scope.division)
  const subdivision = isValidDailyActivitySubdivision(division, input.subdivision)
    ? String(input.subdivision).trim()
    : resolveDefaultDailyActivitySubdivision(division)
  const planningLevel = normalizeDailyActivityPlanningLevel(input.planningLevel ?? scope.planningLevel)

  await prisma.dailyActivityProfile.upsert({
    where: { userId: target.id },
    create: {
      userId: target.id,
      userName: target.name,
      division,
      subdivision,
      planningLevel,
    },
    update: {
      userName: target.name,
      division,
      subdivision,
      planningLevel,
    },
  })

  const profile: DailyActivityProfileDto = {
    userId: target.id,
    userName: target.name,
    division,
    subdivision,
    planningLevel,
    approverUserId: null,
    updatedAt: new Date().toISOString(),
  }

  return profile
}

export type DailyActivityExportRow = {
  Kode: string
  Tanggal: string
  Nama: string
  Divisi: string
  Subdivisi: string
  Level: string
  Judul: string
  Prioritas: string
  Status: string
  Progres: string
  Approval: string
  Lokasi: string
  Target: string
  Hasil: string
  Kendala: string
  CatatanApproval: string
  DisetujuiOleh: string
}

export async function getDailyActivityExportRows(user: SessionUser, filters: DailyActivityFilters = {}) {
  const data = await getDailyActivityPageData(user, filters)
  return data.items.map<DailyActivityExportRow>((item) => ({
    Kode: item.code,
    Tanggal: item.dateKey,
    Nama: item.ownerName,
    Divisi: item.division,
    Subdivisi: item.subdivision ?? '',
    Level: item.planningLevel,
    Judul: item.title,
    Prioritas: item.priorityLevel,
    Status: item.executionStatus,
    Progres: `${item.progressPercent}%`,
    Approval: item.approvalStatus,
    Lokasi: item.location ?? '',
    Target: item.target ?? '',
    Hasil: item.resultNote ?? '',
    Kendala: item.obstacleNote ?? '',
    CatatanApproval: item.approvalNote ?? '',
    DisetujuiOleh: item.approvedByName ?? '',
  }))
}

export const DAILY_ACTIVITY_EXECUTION_STATUS_VALUES = DAILY_ACTIVITY_EXECUTION_STATUSES
export const DAILY_ACTIVITY_APPROVAL_STATUS_VALUES = DAILY_ACTIVITY_APPROVAL_STATUSES
