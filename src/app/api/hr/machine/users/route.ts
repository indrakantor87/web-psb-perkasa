import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ensureMenuAccess } from '@/lib/access-server'
import { canConfigureFingerprintMachine } from '@/lib/access'
import {
  deleteMachineUser,
  MachineUserOperationError,
  updateMachineUserName,
} from '@/lib/hr-machine'
import { logSecurityEvent } from '@/lib/security-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getErrorResponse(error: unknown, fallback: string) {
  if (error instanceof MachineUserOperationError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'INVALID_UID' || error.code === 'CONFIRMATION_MISMATCH'
          ? 400
          : error.code === 'VERIFY_FAILED'
            ? 502
            : 409
    return NextResponse.json({ error: error.message }, { status })
  }

  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 502 })
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessError = ensureMenuAccess(session, 'hr')
  if (accessError) return accessError
  if (!canConfigureFingerprintMachine(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { uid?: unknown; name?: unknown }
  const uid = Number(body.uid)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!Number.isInteger(uid) || uid < 1 || uid > 3000) {
    return NextResponse.json({ error: 'UID mesin tidak valid.' }, { status: 400 })
  }
  if (!name || name.length > 24 || !/^[\x20-\x7E]+$/.test(name)) {
    return NextResponse.json(
      { error: 'Nama wajib 1-24 karakter ASCII agar sesuai format mesin.' },
      { status: 400 }
    )
  }

  const actor = { id: session.user.id, username: session.user.username, role: session.user.role }
  try {
    await logSecurityEvent({
      action: 'FINGERPRINT_USER_UPDATE',
      request,
      user: actor,
      meta: { uid, requestedName: name, outcome: 'REQUESTED' },
    })
  } catch (error) {
    console.error('Unable to record fingerprint user update intent', error)
    return NextResponse.json({ error: 'Pencatatan audit gagal; perubahan ke mesin tidak dijalankan.' }, { status: 500 })
  }

  let user: Awaited<ReturnType<typeof updateMachineUserName>>
  try {
    user = await updateMachineUserName(uid, name)
  } catch (error) {
    const errorCode = error instanceof MachineUserOperationError ? error.code : 'DEVICE_ERROR'
    await logSecurityEvent({
      action: 'FINGERPRINT_USER_UPDATE',
      request,
      user: actor,
      meta: { uid, outcome: 'FAILED', errorCode },
    }).catch(() => {})
    return getErrorResponse(error, 'Gagal mengubah nama user di mesin fingerprint.')
  }

  try {
    await logSecurityEvent({
      action: 'FINGERPRINT_USER_UPDATE',
      request,
      user: actor,
      meta: {
        uid: user.uid,
        fingerprintUserId: user.userId,
        oldName: user.oldName,
        newName: user.name,
        outcome: 'SUCCEEDED',
      },
    })
  } catch (error) {
    console.error('Unable to record successful fingerprint user update', error)
    return NextResponse.json(
      { error: 'Mesin merespons perubahan, tetapi audit akhir gagal dicatat. Muat ulang daftar untuk memeriksa status.' },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true, user: { uid: user.uid, userId: user.userId, name: user.name } })
}

export async function DELETE(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const accessError = ensureMenuAccess(session, 'hr')
  if (accessError) return accessError
  if (!canConfigureFingerprintMachine(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    uid?: unknown
    confirmationUserId?: unknown
  }
  const uid = Number(body.uid)
  const confirmationUserId = typeof body.confirmationUserId === 'string' ? body.confirmationUserId : ''
  if (!Number.isInteger(uid) || uid < 1 || uid > 3000) {
    return NextResponse.json({ error: 'UID mesin tidak valid.' }, { status: 400 })
  }
  if (!confirmationUserId) {
    return NextResponse.json({ error: 'Konfirmasi ID fingerprint wajib diisi.' }, { status: 400 })
  }

  const actor = { id: session.user.id, username: session.user.username, role: session.user.role }
  try {
    await logSecurityEvent({
      action: 'FINGERPRINT_USER_DELETE',
      request,
      user: actor,
      meta: { uid, outcome: 'REQUESTED' },
    })
  } catch (error) {
    console.error('Unable to record fingerprint user deletion intent', error)
    return NextResponse.json({ error: 'Pencatatan audit gagal; penghapusan ke mesin tidak dijalankan.' }, { status: 500 })
  }

  let user: Awaited<ReturnType<typeof deleteMachineUser>>
  try {
    user = await deleteMachineUser(uid, confirmationUserId)
  } catch (error) {
    const errorCode = error instanceof MachineUserOperationError ? error.code : 'DEVICE_ERROR'
    await logSecurityEvent({
      action: 'FINGERPRINT_USER_DELETE',
      request,
      user: actor,
      meta: { uid, outcome: 'FAILED', errorCode },
    }).catch(() => {})
    return getErrorResponse(error, 'Gagal menghapus user dari mesin fingerprint.')
  }

  try {
    await logSecurityEvent({
      action: 'FINGERPRINT_USER_DELETE',
      request,
      user: actor,
      meta: {
        uid: user.uid,
        fingerprintUserId: user.userId,
        deletedName: user.name,
        outcome: 'SUCCEEDED',
      },
    })
  } catch (error) {
    console.error('Unable to record successful fingerprint user deletion', error)
    return NextResponse.json(
      { error: 'User mungkin sudah terhapus, tetapi audit akhir gagal dicatat. Muat ulang daftar untuk memeriksa status.' },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true, user })
}
