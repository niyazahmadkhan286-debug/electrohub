import { z } from 'zod'

// Single source of truth for valid categories - used by the DB check
// constraint (supabase/schema.sql), the API validation below, and the
// frontend's category icon map / filter dropdowns.
export const CATEGORIES = [
  'Smartphones',
  'Laptops',
  'Headphones',
  'Monitors',
  'Cameras',
  'Gaming',
  'TVs',
  'Accessories',
] as const

export type Category = (typeof CATEGORIES)[number]

const trimmedNonEmpty = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(200, `${label} must be 200 characters or fewer`)

export const productInputSchema = z.object({
  name: trimmedNonEmpty('Product name'),
  brand: trimmedNonEmpty('Brand'),
  category: z.enum(CATEGORIES, {
    errorMap: () => ({ message: `Category must be one of: ${CATEGORIES.join(', ')}` }),
  }),
  price: z.coerce
    .number({ invalid_type_error: 'Price must be a number' })
    .finite('Price must be a number')
    .nonnegative('Price cannot be negative'),
  stock: z.coerce
    .number({ invalid_type_error: 'Stock must be a whole number' })
    .int('Stock must be a whole number')
    .nonnegative('Stock cannot be negative'),
  minStock: z.coerce
    .number({ invalid_type_error: 'Minimum stock must be a whole number' })
    .int('Minimum stock must be a whole number')
    .nonnegative('Minimum stock cannot be negative')
    .default(5),
  image: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined)),
  description: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined)),
})

// Every field optional, but at least one must be present - used for PATCH.
export const productUpdateSchema = productInputSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'No fields provided to update' },
)

export type ProductInput = z.infer<typeof productInputSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>

const CATEGORY_FILTER_OPTIONS = ['All categories', ...CATEGORIES] as const
const STOCK_FILTER_OPTIONS = ['All stock', 'In stock', 'Low stock', 'Out of stock'] as const
const SORT_OPTIONS = ['Newest first', 'Price: high to low', 'Stock: low to high'] as const

export const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.enum(CATEGORY_FILTER_OPTIONS).optional().default('All categories'),
  stock: z.enum(STOCK_FILTER_OPTIONS).optional().default('All stock'),
  sort: z.enum(SORT_OPTIONS).optional().default('Newest first'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
})
