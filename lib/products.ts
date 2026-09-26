import type { Category } from '@/lib/validation'

// Shape returned to the frontend (camelCase, matches the original UI's
// Product type in app/page.tsx so the existing components didn't need
// to change field names).
export type Product = {
  id: number
  name: string
  brand: string
  category: Category | string
  price: number
  stock: number
  minStock: number
  image: string
  description: string
  createdAt: string
  updatedAt: string
}

// Raw shape of a row as stored in the `products` table (snake_case,
// matches supabase/schema.sql).
export type ProductRow = {
  id: number
  name: string
  brand: string
  category: string
  price: number | string
  stock: number
  min_stock: number
  image: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    price: Number(row.price),
    stock: row.stock,
    minStock: row.min_stock,
    image: row.image ?? '',
    description: row.description ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function stockStatus(product: Pick<Product, 'stock' | 'minStock'>): {
  label: 'Out of Stock' | 'Low Stock' | 'In Stock'
  kind: 'out' | 'low' | 'good'
} {
  if (product.stock === 0) return { label: 'Out of Stock', kind: 'out' }
  if (product.stock <= product.minStock) return { label: 'Low Stock', kind: 'low' }
  return { label: 'In Stock', kind: 'good' }
}
