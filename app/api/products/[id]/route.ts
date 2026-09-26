import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fail, fromDbError, ok } from '@/lib/api-response'
import { rowToProduct, type ProductRow } from '@/lib/products'
import { productUpdateSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

function parseId(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = parseId(rawId)
  if (id === null) return fail('Invalid product id', 400)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('You must be signed in to do that', 401)

  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle()
  if (error) return fromDbError(error)
  if (!data) return fail('Product not found', 404)

  return ok(rowToProduct(data as ProductRow))
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = parseId(rawId)
  if (id === null) return fail('Invalid product id', 400)

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

  const parsed = productUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Invalid product data', 422)
  }
  const input = parsed.data

  const update: Record<string, unknown> = {}
  if (input.name !== undefined) update.name = input.name
  if (input.brand !== undefined) update.brand = input.brand
  if (input.category !== undefined) update.category = input.category
  if (input.price !== undefined) update.price = input.price
  if (input.stock !== undefined) update.stock = input.stock
  if (input.minStock !== undefined) update.min_stock = input.minStock
  if (input.image !== undefined) update.image = input.image ?? null
  if (input.description !== undefined) update.description = input.description ?? null

  const { data, error } = await supabase
    .from('products')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) return fromDbError(error)
  if (!data) return fail('Product not found', 404)

  return ok(rowToProduct(data as ProductRow))
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = parseId(rawId)
  if (id === null) return fail('Invalid product id', 400)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('You must be signed in to do that', 401)

  const { data, error } = await supabase.from('products').delete().eq('id', id).select('id').maybeSingle()
  if (error) return fromDbError(error)
  if (!data) return fail('Product not found', 404)

  return ok({ id })
}
