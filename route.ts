import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fail, fromDbError, ok } from '@/lib/api-response'
import { rowToProduct, type ProductRow } from '@/lib/products'
import { listQuerySchema, productInputSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('You must be signed in to do that', 401)

  const parsedQuery = listQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  )
  if (!parsedQuery.success) {
    return fail(parsedQuery.error.issues[0]?.message ?? 'Invalid query parameters', 400)
  }
  const { q, category, stock, sort, page, pageSize } = parsedQuery.data

  let query = supabase.from('products').select('*', { count: 'exact' })

  if (q) {
    // Escape characters that are meaningful to ILIKE (%, _) and to
    // PostgREST's `or()` filter syntax (,()) so user input can't alter
    // the query structure.
    const escaped = q.replace(/[%_,()]/g, (match: string) => `\\${match}`)
    query = query.or(`name.ilike.%${escaped}%,brand.ilike.%${escaped}%`)
  }
  if (category !== 'All categories') {
    query = query.eq('category', category)
  }
  // `status` is a generated column (see supabase/schema.sql) derived from
  // stock vs min_stock, so this comparison happens in Postgres, not by
  // comparing two columns through PostgREST (which isn't supported).
  if (stock === 'Out of stock') {
    query = query.eq('status', 'out')
  } else if (stock === 'Low stock') {
    query = query.eq('status', 'low')
  } else if (stock === 'In stock') {
    query = query.eq('status', 'good')
  }

  if (sort === 'Price: high to low') {
    query = query.order('price', { ascending: false })
  } else if (sort === 'Stock: low to high') {
    query = query.order('stock', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) return fromDbError(error)

  return ok({
    products: (data as ProductRow[]).map(rowToProduct),
    total: count ?? 0,
    page,
    pageSize,
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('You must be signed in to do that', 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('Request body must be valid JSON', 400)
  }

  const parsed = productInputSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Invalid product data', 422)
  }
  const input = parsed.data

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: input.name,
      brand: input.brand,
      category: input.category,
      price: input.price,
      stock: input.stock,
      min_stock: input.minStock,
      image: input.image ?? null,
      description: input.description ?? null,
    })
    .select('*')
    .single()

  if (error) return fromDbError(error)

  return ok(rowToProduct(data as ProductRow), 201)
}
