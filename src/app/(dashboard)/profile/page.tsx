import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ChangePasswordForm from '@/components/ChangePasswordForm'
import { prisma } from '@/lib/prisma'
import { ProfileAvatarForm } from '@/components/ProfileAvatarForm'

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
          <ProfileAvatarForm initialAvatar={avatar} userInitial={user?.name?.charAt(0) ?? 'U'} />
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
