import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
})

export const ticketCreateSchema = z.object({
  customerName: z.string().min(1),
  birthDate: z.string().min(1, 'Tanggal Lahir harus diisi'), // Accept any non-empty string (e.g. YYYY-MM-DD)
  locationMap: z.string().url().or(z.string().min(1)), // Loose validation for map link
  package: z.string().min(1),
  marketingName: z.string().min(1).optional(), // Can be optional if user is Marketing
  teknisi: z.string().optional().nullable(),
  description: z.string().optional(),
  phoneNumber: z
    .string()
    .regex(/^08\d{8,11}$/, 'Nomor WA harus diawali 08, hanya angka, 10–13 digit (contoh: 085865555005)'),
  fotoRumah: z.string().optional().nullable(), // Base64 string
  pengawalan: z.string().optional().nullable(),
  kmz: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'Password minimal 6 karakter'),
})

export const userCreateSchema = z.object({
  name: z.string().min(1, 'Nama harus diisi'),
  username: z.string().min(3, 'Username minimal 3 karakter'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['ADMIN', 'CS', 'NOC', 'MARKETING', 'TEKNISI']),
})

export const userUpdateSchema = z.object({
  id: z.number(),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})
