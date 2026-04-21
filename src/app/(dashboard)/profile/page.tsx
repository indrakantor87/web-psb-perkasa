import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ChangePasswordForm from '@/components/ChangePasswordForm'
import { prisma } from '@/lib/prisma'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = session.user
  let avatar: string | null = null
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatar: true },
    })
    avatar = dbUser?.avatar ?? null
  } catch {
    avatar = null
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
      
      <div className="max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Foto Profil</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Upload foto profil (JPG/PNG/WEBP, maks 2MB).
          </p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-4">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt="Foto profil"
                className="h-16 w-16 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold text-lg">
                {user?.name?.charAt(0)}
              </div>
            )}

            <div className="flex-1">
              <form action="/api/profile/avatar" method="post" encType="multipart/form-data" className="space-y-3">
                <input
                  type="file"
                  name="avatar"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 dark:file:bg-gray-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600"
                  required
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Simpan Foto
                  </button>
                </div>
              </form>
              {avatar && (
                <form action="/api/profile/avatar" method="post" className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    name="action"
                    value="remove"
                    className="inline-flex justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Hapus Foto
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">User Information</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Your account details.</p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700">
          <dl>
            <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{user.name}</dd>
            </div>
            <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{user.username}</dd>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Password</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2 flex items-center justify-between">
                <span>********</span>
                <a href="#change-password-form" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium">
                  Change
                </a>
              </dd>
            </div>
            <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{user.role}</dd>
            </div>
          </dl>
        </div>
      </div>
      
      <ChangePasswordForm />
    </div>
  )
}
