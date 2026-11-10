import { prisma } from '@/lib/prisma'
import { ensureHrSchemaOnce } from '@/lib/hr-schema'

// Konstanta mengikuti porting dari finance (sync-machine.js) agar perilaku hasil sama.
export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
const DEFAULT_IP = '103.162.16.14'
const DEFAULT_PORT = 4370
const CONNECT_TIMEOUT_MS = 20000
const IN_PORT = 4000
const FETCH_TIMEOUT_MS = 60000
const WORK_MINUTES = 9 * 60
const BATCH_SIZE = 50

type ZkInstance = {
  createSocket(): Promise<void>
  disconnect(): Promise<void>
  getInfo(): Promise<{ logCounts?: number; logCapacity?: number; userCounts?: number }>
  getUsers(): Promise<unknown>
  getAttendances(): Promise<unknown>
  setUser(uid: number, userId: string, name: string, password: string, role: number, cardno: number): Promise<unknown>
  deleteUser(uid: number): Promise<unknown>
}

type ZkConstructor = new (ip: string, port: number, timeout?: number, inport?: number) => ZkInstance

export type MachineUser = { uid?: number; userId: string | number; name: string; canDelete?: boolean }

type RawMachineUser = Record<string, unknown> & {
  uid?: string | number
  userId?: string | number
  user_id?: string | number
  name?: string
  password?: string
  role?: string | number
  cardno?: string | number
}

export type MachineUserOperationErrorCode =
  | 'INVALID_UID'
  | 'NOT_FOUND'
  | 'UNSAFE_RECORD'
  | 'VERIFY_FAILED'
  | 'PROTECTED_ROLE'
  | 'ACTIVE_EMPLOYEE'
  | 'CONFIRMATION_MISMATCH'

export class MachineUserOperationError extends Error {
  constructor(public readonly code: MachineUserOperationErrorCode, message: string) {
    super(message)
    this.name = 'MachineUserOperationError'
  }
}

export type RawMachineLog = {
  deviceUserId?: string | number
  user_id?: string | number
  recordTime?: string | number | Date
  record_time?: string | number | Date
  /** Metode verifikasi (byte 26): 0 = fingerprint, 1 = password, 2 = rfid. */
  type?: number
  /** Jenis punch (byte 31): 0 = check-in (masuk), 1 = check-out (pulang). */
  state?: number
}

export type MachineConfig = { ip: string; port: number }

export type SyncResult = {
  processedCount: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  matchedUsers: number
  createdEmployees: number
  logCount: number
  reason?: string
}

let cachedZkCtor: ZkConstructor | null = null

async function loadZkLib(): Promise<ZkConstructor> {
  if (cachedZkCtor) return cachedZkCtor
  const mod = await import('zkteco-js')
  const candidate = (mod as { default?: unknown }).default ?? mod
  cachedZkCtor = candidate as ZkConstructor
  return cachedZkCtor
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function toDataArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>
  const data = asRecord(value).data
  return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []
}

export function normalizeUsers(value: unknown): MachineUser[] {
  const result: MachineUser[] = []
  for (const item of toDataArray(value)) {
    const uid = item.userId ?? item.user_id ?? item.uid
    if (uid === undefined || uid === null || uid === '') continue
    const name = typeof item.name === 'string' ? item.name : ''
    const deviceUid = Number(item.uid)
    result.push({
      ...(Number.isInteger(deviceUid) && deviceUid > 0 ? { uid: deviceUid } : {}),
      userId: uid as string | number,
      name,
      canDelete: Number(item.role) === 0,
    })
  }
  return result
}

export function normalizeLogs(value: unknown): RawMachineLog[] {
  const result: RawMachineLog[] = []
  for (const item of toDataArray(value)) {
    result.push(item as RawMachineLog)
  }
  return result
}

export function mapRawLogsToEmployeeFingerprints(
  rawLogs: RawMachineLog[],
  employees: Array<{ id: number; fingerprintId: string | null }>
) {
  const byFingerprint = new Map<string, number>()
  for (const employee of employees) {
    if (employee.fingerprintId) byFingerprint.set(String(employee.fingerprintId), employee.id)
  }

  const userMap = Object.create(null) as Record<string, number>
  for (const log of rawLogs) {
    const value = log.deviceUserId ?? log.user_id
    if (value === undefined || value === null || value === '') continue
    const machineUserId = String(value)
    const employeeId = byFingerprint.get(machineUserId)
    if (employeeId) userMap[machineUserId] = employeeId
  }
  return userMap
}

// zkteco-js membangun waktu mesin dengan new Date(y, m, d, H, M, S) memakai TZ server,
// sehingga bila container ber-TZ UTC jam dinding WIB bergeser +7 jam. Normalkan agar
// hasil selalu merepresentasikan jam dinding mesin sebagai WIB (UTC+7), terlepas dari TZ server.
const JAKARTA_OFFSET_MINUTES = 7 * 60

function toWibInstant(date: Date): Date {
  // getTimezoneOffset() = menit ke barat UTC; offset timur = negasinya.
  const serverOffsetMinutes = -date.getTimezoneOffset()
  const correctionMs = (serverOffsetMinutes - JAKARTA_OFFSET_MINUTES) * 60 * 1000
  return correctionMs === 0 ? date : new Date(date.getTime() + correctionMs)
}

function parseMachineTime(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toWibInstant(value)
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : toWibInstant(d)
  }
  const d = new Date(String(value).trim())
  return Number.isNaN(d.getTime()) ? null : toWibInstant(d)
}

// Mengikuti perhitungan lembur pada finance; hasil dikonversi ke menit.
function computeOvertimeMinutes(checkIn: Date, checkOut: Date): number {
  const inWIB = new Date(checkIn.getTime() + WIB_OFFSET_MS)
  let outWIB = new Date(checkOut.getTime() + WIB_OFFSET_MS)
  const inHour = inWIB.getUTCHours()

  if (outWIB.getTime() <= inWIB.getTime() && inHour >= 17) {
    outWIB = new Date(outWIB.getTime() + 24 * 60 * 60 * 1000)
  }

  const totalMinutes = Math.floor((outWIB.getTime() - inWIB.getTime()) / 60000)
  if (totalMinutes <= 0) return 0

  let overtime = 0
  if (inHour >= 17) {
    const regularEnd = new Date(inWIB.getTime() + WORK_MINUTES * 60000)
    if (outWIB.getTime() > regularEnd.getTime()) {
      overtime = Math.floor((outWIB.getTime() - regularEnd.getTime()) / 60000)
    }
  } else {
    const standardExit = new Date(inWIB)
    standardExit.setUTCHours(17, 0, 0, 0)
    if (outWIB.getTime() > standardExit.getTime()) {
      overtime = Math.floor((outWIB.getTime() - standardExit.getTime()) / 60000)
    }
  }

  if (overtime > totalMinutes) overtime = totalMinutes
  return overtime > 0 ? overtime : 0
}

export async function getMachineConfig(override?: Partial<MachineConfig>): Promise<MachineConfig> {
  await ensureHrSchemaOnce()
  let ip = ''
  let port = DEFAULT_PORT
  try {
    const setting = await prisma.hrMachineSetting.findFirst({ orderBy: { id: 'asc' } })
    if (setting?.machineIp) ip = setting.machineIp
    if (setting?.machinePort) port = setting.machinePort
  } catch {}

  const overrideIp = override?.ip?.trim()
  const overridePort = Number(override?.port)
  return {
    ip: overrideIp || ip || DEFAULT_IP,
    port: Number.isFinite(overridePort) && overridePort > 0 ? overridePort : port || DEFAULT_PORT,
  }
}

export async function saveMachineConfig(config: MachineConfig) {
  await ensureHrSchemaOnce()
  const ip = config.ip.trim()
  const port = Number(config.port) > 0 ? Number(config.port) : DEFAULT_PORT
  const existing = await prisma.hrMachineSetting.findFirst({ orderBy: { id: 'asc' } })
  if (existing) {
    return prisma.hrMachineSetting.update({
      where: { id: existing.id },
      data: { machineIp: ip, machinePort: port },
    })
  }
  return prisma.hrMachineSetting.create({ data: { machineIp: ip, machinePort: port } })
}

async function withMachine<T>(config: MachineConfig, handler: (zk: ZkInstance) => Promise<T>): Promise<T> {
  const ZKLib = await loadZkLib()
  const zk = new ZKLib(config.ip, config.port, CONNECT_TIMEOUT_MS, IN_PORT)
  try {
    await zk.createSocket()
    return await handler(zk)
  } finally {
    try {
      await zk.disconnect()
    } catch {}
  }
}

// Cek koneksi + info mesin (jumlah log/kapasitas/user).
export async function fetchMachineInfo(override?: Partial<MachineConfig>) {
  const config = await getMachineConfig(override)
  return withMachine(config, async (zk) => {
    let info: { logCounts?: number; logCapacity?: number; userCounts?: number } = {}
    try {
      info = await zk.getInfo()
    } catch {}
    const users = normalizeUsers(await zk.getUsers().catch(() => []))
    return {
      config,
      logCounts: Number(info?.logCounts ?? 0),
      logCapacity: Number(info?.logCapacity ?? 0),
      userCounts: Number(info?.userCounts ?? users.length),
      users,
    }
  })
}

function assertMachineUid(uid: number) {
  if (!Number.isInteger(uid) || uid < 1 || uid > 3000) {
    throw new MachineUserOperationError('INVALID_UID', 'UID mesin tidak valid.')
  }
}

function getSafeMachineUserId(user: RawMachineUser) {
  const userId = user.userId ?? user.user_id
  if (
    (typeof userId !== 'string' && typeof userId !== 'number') ||
    !String(userId) ||
    String(userId).length > 9 ||
    !/^[\x20-\x7E]+$/.test(String(userId))
  ) {
    throw new MachineUserOperationError(
      'UNSAFE_RECORD',
      'ID user mesin tidak valid; perubahan dibatalkan.'
    )
  }
  return String(userId)
}

function validateEditableMachineRecord(user: RawMachineUser) {
  const userId = getSafeMachineUserId(user)
  const password = user.password
  const role = Number(user.role)
  const cardno = Number(user.cardno)
  if (
    typeof password !== 'string' ||
    password.length > 8 ||
    !/^[\x00-\x7F]*$/.test(password) ||
    !Number.isInteger(role) ||
    role < 0 ||
    role > 65535 ||
    !Number.isInteger(cardno) ||
    cardno < 0 ||
    cardno > 65535
  ) {
    throw new MachineUserOperationError(
      'UNSAFE_RECORD',
      'Data user mesin tidak dapat dipertahankan dengan aman; perubahan dibatalkan.'
    )
  }
  return { userId, password, role, cardno }
}

export async function updateMachineUserName(uid: number, nextName: string) {
  assertMachineUid(uid)
  const name = nextName.trim()
  if (!name || name.length > 24 || !/^[\x20-\x7E]+$/.test(name)) {
    throw new MachineUserOperationError(
      'UNSAFE_RECORD',
      'Nama wajib 1-24 karakter ASCII agar sesuai format mesin.'
    )
  }

  const config = await getMachineConfig()
  return withMachine(config, async (zk) => {
    const users = toDataArray(await zk.getUsers()) as RawMachineUser[]
    const current = users.find((user) => Number(user.uid) === uid)
    if (!current) {
      throw new MachineUserOperationError('NOT_FOUND', 'User tidak ditemukan di mesin.')
    }

    const preserved = validateEditableMachineRecord(current)
    await zk.setUser(uid, preserved.userId, name, preserved.password, preserved.role, preserved.cardno)
    const updated = toDataArray(await zk.getUsers()) as RawMachineUser[]
    const verified = updated.find((user) => Number(user.uid) === uid)
    if (
      verified?.name !== name ||
      String(verified.userId ?? verified.user_id ?? '') !== preserved.userId ||
      String(verified.password ?? '') !== preserved.password ||
      Number(verified.role) !== preserved.role ||
      Number(verified.cardno) !== preserved.cardno
    ) {
      throw new MachineUserOperationError(
        'VERIFY_FAILED',
        'Mesin belum mengonfirmasi perubahan. Muat ulang daftar untuk memeriksa status user.'
      )
    }
    return {
      uid,
      userId: preserved.userId,
      oldName: typeof current.name === 'string' ? current.name : '',
      name,
    }
  })
}

export async function deleteMachineUser(uid: number, confirmationUserId: string) {
  assertMachineUid(uid)
  const config = await getMachineConfig()
  return withMachine(config, async (zk) => {
    const users = toDataArray(await zk.getUsers()) as RawMachineUser[]
    const current = users.find((user) => Number(user.uid) === uid)
    if (!current) {
      throw new MachineUserOperationError('NOT_FOUND', 'User tidak ditemukan di mesin.')
    }

    const userId = getSafeMachineUserId(current)
    if (confirmationUserId !== userId) {
      throw new MachineUserOperationError(
        'CONFIRMATION_MISMATCH',
        'Konfirmasi ID fingerprint tidak cocok.'
      )
    }
    if (Number(current.role) !== 0) {
      throw new MachineUserOperationError(
        'PROTECTED_ROLE',
        'User dengan hak khusus pada mesin tidak dapat dihapus dari web.'
      )
    }

    const activeEmployee = await prisma.employee.findFirst({
      where: { fingerprintId: userId, isActive: true },
      select: { id: true },
    })
    if (activeEmployee) {
      throw new MachineUserOperationError(
        'ACTIVE_EMPLOYEE',
        'User masih terhubung ke karyawan aktif. Nonaktifkan karyawan atau lepaskan ID Fingerprint terlebih dahulu.'
      )
    }

    await zk.deleteUser(uid)
    const remainingUsers = toDataArray(await zk.getUsers()) as RawMachineUser[]
    if (remainingUsers.some((user) => Number(user.uid) === uid)) {
      throw new MachineUserOperationError(
        'VERIFY_FAILED',
        'Mesin masih menampilkan user setelah perintah hapus. Muat ulang daftar untuk memeriksa status.'
      )
    }
    return {
      uid,
      userId,
      name: typeof current.name === 'string' ? current.name : '',
    }
  })
}

// Ambil log mentah dari mesin tanpa menyentuh database.
export async function fetchRawLogs(options?: Partial<MachineConfig> & { userIds?: Array<string | number> }): Promise<{
  config: MachineConfig
  data: RawMachineLog[]
}> {
  const config = await getMachineConfig(options)
  const filter = new Set((options?.userIds ?? []).map((id) => String(id)))

  return withMachine(config, async (zk) => {
    const raw = await Promise.race([
      zk.getAttendances(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Fetch timeout (${FETCH_TIMEOUT_MS}ms). Data terlalu besar?`)), FETCH_TIMEOUT_MS)
      ),
    ])
    let logs = normalizeLogs(raw)
    if (filter.size > 0) {
      logs = logs.filter((log) => {
        const uid = log.deviceUserId ?? log.user_id
        return uid !== undefined && uid !== null && filter.has(String(uid))
      })
    }
    return { config, data: logs }
  })
}

type TimelineEntry = { time: Date; type?: number; state?: number }

// Inti pemrosesan: mapping user mesin -> employee, grouping per tanggal WIB, dedup, dan simpan.
export async function importAttendanceLogs(
  rawLogs: RawMachineLog[],
  machineUsers: MachineUser[] = []
): Promise<SyncResult> {
  await ensureHrSchemaOnce()

  const employees = await prisma.employee.findMany({ select: { id: true, name: true, fingerprintId: true } })
  const byFingerprint = new Map<string, number>()
  const byName = new Map<string, number>()
  for (const emp of employees) {
    if (emp.fingerprintId) byFingerprint.set(String(emp.fingerprintId), emp.id)
    byName.set(emp.name.trim().toLowerCase(), emp.id)
  }

  const userMap = mapRawLogsToEmployeeFingerprints(rawLogs, employees)
  const fingerprintBackfill: Array<{ id: number; fingerprintId: string }> = []
  let createdEmployees = 0

  for (const user of machineUsers) {
    if (user.userId === undefined || user.userId === null || user.userId === '') continue
    const uid = String(user.userId)
    const name = (user.name || '').trim()

    const fpMatch = byFingerprint.get(uid)
    if (fpMatch) {
      userMap[uid] = fpMatch
      continue
    }

    if (!name) continue
    const nameMatch = byName.get(name.toLowerCase())
    if (nameMatch) {
      userMap[uid] = nameMatch
      fingerprintBackfill.push({ id: nameMatch, fingerprintId: uid })
      continue
    }

    try {
      const existing = await prisma.employee.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true, fingerprintId: true },
      })
      let empId = existing?.id
      if (!empId) {
        const created = await prisma.employee.create({ data: { name, fingerprintId: uid } })
        empId = created.id
        createdEmployees++
      } else if (!existing?.fingerprintId) {
        fingerprintBackfill.push({ id: empId, fingerprintId: uid })
      }
      userMap[uid] = empId
      byName.set(name.toLowerCase(), empId)
      byFingerprint.set(uid, empId)
    } catch {
      // Lewati user yang gagal dibuat, log terkait akan di-skip.
    }
  }

  for (const item of fingerprintBackfill) {
    try {
      await prisma.employee.update({
        where: { id: item.id },
        data: { fingerprintId: item.fingerprintId },
      })
    } catch {}
  }

  // Grouping: employeeId -> tanggal WIB -> timeline log
  const grouped = new Map<number, Map<string, TimelineEntry[]>>()
  for (const log of rawLogs) {
    const uid = log.deviceUserId ?? log.user_id
    if (uid === undefined || uid === null || uid === '') continue
    const employeeId = userMap[String(uid)]
    if (!employeeId) continue

    const dateObj = parseMachineTime(log.recordTime ?? log.record_time)
    if (!dateObj) continue

    const dateWIB = new Date(dateObj.getTime() + WIB_OFFSET_MS)
    const dateStr = dateWIB.toISOString().split('T')[0]

    let byDate = grouped.get(employeeId)
    if (!byDate) {
      byDate = new Map<string, TimelineEntry[]>()
      grouped.set(employeeId, byDate)
    }
    const list = byDate.get(dateStr) ?? []
    list.push({
      time: dateObj,
      type: typeof log.type === 'number' ? log.type : undefined,
      state: typeof log.state === 'number' ? log.state : undefined,
    })
    byDate.set(dateStr, list)
  }

  let processedCount = 0
  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0

  for (const [employeeId, byDate] of grouped) {
    const dateKeys = [...byDate.keys()].sort()
    if (dateKeys.length === 0) continue

    const minDate = new Date(`${dateKeys[0]}T00:00:00.000Z`)
    const maxDate = new Date(`${dateKeys[dateKeys.length - 1]}T23:59:59.999Z`)

    const existingList = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: minDate, lte: maxDate } },
      select: { id: true, date: true, checkIn: true, checkOut: true },
    })
    const existingMap = new Map<string, { id: number; date: Date; checkIn: Date | null; checkOut: Date | null }>()
    for (const ex of existingList) {
      existingMap.set(new Date(ex.date).toISOString().split('T')[0], ex)
    }

    let ops: Array<ReturnType<typeof prisma.attendance.update> | ReturnType<typeof prisma.attendance.create>> = []

    for (const dateStr of dateKeys) {
      const timeline = (byDate.get(dateStr) ?? []).slice().sort((a, b) => a.time.getTime() - b.time.getTime())

      // Dedup: buang log berdekatan (<5 menit) dengan jenis punch & verifikasi sama.
      const validLogs: TimelineEntry[] = []
      if (timeline.length > 0) {
        validLogs.push(timeline[0])
        for (let i = 1; i < timeline.length; i++) {
          const prev = validLogs[validLogs.length - 1]
          const curr = timeline[i]
          const diff = curr.time.getTime() - prev.time.getTime()
          const samePunch = prev.type === curr.type && prev.state === curr.state
          if (diff > 5 * 60 * 1000 || !samePunch) {
            validLogs.push(curr)
          } else {
            validLogs[validLogs.length - 1] = curr
          }
        }
      }

      let checkIn: Date | null = null
      let checkOut: Date | null = null

      if (validLogs.length === 1) {
        // Single tap selalu dianggap jam masuk (tidak mungkin check-out tanpa check-in).
        // Field `state` mesin tidak selalu reliabel untuk tap tunggal, jadi abaikan.
        checkIn = validLogs[0].time
      } else if (validLogs.length > 1) {
        // Jenis punch (0 = masuk, 1 = pulang) diutamakan dari field `state` (byte 31),
        // fallback ke `type` (byte 26) untuk perangkat yang meletakkannya di sana.
        const punchType = (entry: TimelineEntry): number | undefined => {
          if (typeof entry.state === 'number' && (entry.state === 0 || entry.state === 1)) return entry.state
          if (typeof entry.type === 'number' && (entry.type === 0 || entry.type === 1)) return entry.type
          return undefined
        }
        const inLog = validLogs.find((entry) => punchType(entry) === 0)
        if (inLog) checkIn = inLog.time
        const outLog = [...validLogs].reverse().find((entry) => punchType(entry) === 1)
        if (outLog) checkOut = outLog.time

        if (!checkIn && !checkOut) {
          checkIn = validLogs[0].time
          checkOut = validLogs[validLogs.length - 1].time
        } else if (checkIn && !checkOut) {
          const lastLog = validLogs[validLogs.length - 1]
          if (lastLog.time.getTime() !== checkIn.getTime()) {
            checkOut = lastLog.time
          }
        } else if (!checkIn && checkOut) {
          const firstLog = validLogs[0]
          if (firstLog.time.getTime() !== checkOut.getTime()) {
            checkIn = firstLog.time
          }
        }

        if (checkIn && checkOut && checkIn.getTime() === checkOut.getTime()) {
          checkOut = null
        }
      }

      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`)
      const existing = existingMap.get(dateStr)
      const hasLogs = validLogs.length > 0

      if (existing) {
        const finalCheckIn = hasLogs ? checkIn : existing.checkIn
        const finalCheckOut = hasLogs ? checkOut : existing.checkOut
        const updateData: { checkIn?: Date | null; checkOut?: Date | null; overtimeMinutes?: number } = {}

        if (hasLogs) {
          updateData.checkIn = checkIn
          updateData.checkOut = checkOut
        }
        if (finalCheckIn && finalCheckOut) {
          updateData.overtimeMinutes = computeOvertimeMinutes(finalCheckIn, finalCheckOut)
        }

        if (Object.keys(updateData).length > 0) {
          ops.push(prisma.attendance.update({ where: { id: existing.id }, data: updateData }))
          updatedCount++
        } else {
          skippedCount++
        }
      } else if (checkIn || checkOut) {
        const overtimeMinutes = checkIn && checkOut ? computeOvertimeMinutes(checkIn, checkOut) : 0
        ops.push(
          prisma.attendance.create({
            data: {
              employeeId,
              date: startOfDay,
              checkIn: checkIn ?? null,
              checkOut: checkOut ?? null,
              status: 'PRESENT',
              source: 'FINGERPRINT_MACHINE',
              overtimeMinutes,
            },
          })
        )
        createdCount++
      } else {
        skippedCount++
      }

      processedCount++

      if (ops.length >= BATCH_SIZE) {
        await prisma.$transaction(ops)
        ops = []
      }
    }

    if (ops.length > 0) {
      await prisma.$transaction(ops)
      ops = []
    }
  }

  return {
    processedCount,
    createdCount,
    updatedCount,
    skippedCount,
    matchedUsers: Object.keys(userMap).length,
    createdEmployees,
    logCount: rawLogs.length,
  }
}

// Tarik langsung dari mesin lalu simpan ke database.
export async function syncAttendanceFromMachine(options?: Partial<MachineConfig>): Promise<SyncResult> {
  const config = await getMachineConfig(options)
  const ZKLib = await loadZkLib()
  const zk = new ZKLib(config.ip, config.port, CONNECT_TIMEOUT_MS, IN_PORT)

  try {
    await zk.createSocket()

    let logCount = 0
    try {
      const info = await zk.getInfo()
      logCount = Number(info?.logCounts ?? 0)
    } catch {}

    const users = normalizeUsers(await zk.getUsers().catch(() => []))

    let logs: RawMachineLog[] = []
    try {
      const raw = await Promise.race([
        zk.getAttendances(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Fetch timeout (${FETCH_TIMEOUT_MS}ms). Data terlalu besar?`)), FETCH_TIMEOUT_MS)
        ),
      ])
      logs = normalizeLogs(raw)
    } catch (error) {
      if (logCount > 10000) {
        throw new Error(
          `Gagal mengambil data. Mesin memiliki ${logCount} log (terlalu banyak). Harap hapus log lama di mesin.`
        )
      }
      throw error
    }

    if (logs.length === 0) {
      return {
        processedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        matchedUsers: 0,
        createdEmployees: 0,
        logCount,
        reason: 'Tidak ada log di mesin',
      }
    }

    const result = await importAttendanceLogs(logs, users)
    return { ...result, logCount }
  } finally {
    try {
      await zk.disconnect()
    } catch {}
  }
}
