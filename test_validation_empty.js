
const { z } = require('zod');

const ticketCreateSchema = z.object({
  customerName: z.string().min(1),
  birthDate: z.string().datetime().or(z.string()),
  locationMap: z.string().url().or(z.string().min(1)),
  package: z.string().min(1),
  marketingName: z.string().min(1).optional(),
  description: z.string().optional(),
  phoneNumber: z.string().min(10),
  fotoRumah: z.string().min(1),
  pengawalan: z.string().optional().nullable(),
  kmz: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
});

const testDataWithEmptyStringMarketing = {
  customerName: "Test Customer",
  birthDate: "2023-01-01",
  locationMap: "https://maps.google.com/test",
  package: "HOME LITE",
  marketingName: "",
  description: "",
  phoneNumber: "081234567890",
  fotoRumah: "data:image/jpeg;base64,abc",
  pengawalan: null,
  kmz: null,
  priority: null
};

try {
  console.log("Testing with empty string marketingName...");
  const result = ticketCreateSchema.parse(testDataWithEmptyStringMarketing);
  console.log("Validation successful with empty string marketingName");
} catch (e) {
  console.error("Validation failed with empty string marketingName:", e.errors);
}
