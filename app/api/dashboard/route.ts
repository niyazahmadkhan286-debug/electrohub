import { createClient } from '@/lib/supabase/server'
import { fail, fromDbError, ok } from '@/lib/api-response'
import { rowToProduct, type ProductRow } from '@/lib/products'

export const dynamic = 'force-dynamic'

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('You must be signed in to do that', 401)

  // Small-catalog assumption: pull every product once and compute all
  // dashboard numbers from it in a single round trip, instead of firing
  // one query per statistic. For a very large catalog this would be
  // better served by a Postgres view/materialized aggregate - flagged
  // in the project report.
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return fromDbError(error)

  const products = (data as ProductRow[]).map(rowToProduct)

  const totalProducts = products.length
  const inventoryValue = products.reduce((sum, p) => sum + p.price * p.stock, 0)
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock)
  const outOfStock = products.filter((p) => p.stock === 0)

  const categoryCounts = new Map<string, number>()
  for (const p of products) {
    categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1)
  }
  const categoryDistribution = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({
      category,
      count,
      percent: totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const recentlyAdded = [...products]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)

  const lowStockProducts = [...lowStock, ...outOfStock]
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 4)

  // Real (not fabricated) trend: cumulative inventory value, bucketed by
  // the month each product was added, for the last 6 months. Reflects
  // when stock actually entered the catalog rather than a made-up curve.
  const now = new Date()
  const months: { key: string; label: string }[] = []
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ key: monthKey(d), label: d.toLocaleString('en-US', { month: 'short' }) })
  }

  const trend = months.map(({ key, label }, index) => {
    const cutoff = new Date(now.getFullYear(), now.getMonth() - (5 - index) + 1, 1)
    const valueSoFar = products
      .filter((p) => new Date(p.createdAt) < cutoff)
      .reduce((sum, p) => sum + p.price * p.stock, 0)
    return { month: key, label, value: Math.round(valueSoFar) }
  })

  return ok({
    totalProducts,
    totalCategories: categoryDistribution.length,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    inventoryValue,
    categoryDistribution,
    recentlyAdded,
    lowStockProducts,
    trend,
  })
}
