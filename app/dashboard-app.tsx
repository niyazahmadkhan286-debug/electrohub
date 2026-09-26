'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Boxes,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  DollarSign,
  Ellipsis,
  Headphones,
  LayoutDashboard,
  Laptop,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  Smartphone,
  Sun,
  Tablet,
  Trash2,
  Tv,
  X,
  Zap,
} from 'lucide-react'
import { signOut } from './login/actions'
import type { Product } from '@/lib/products'
import { stockStatus } from '@/lib/products'
import { CATEGORIES } from '@/lib/validation'

type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  let body: ApiResponse<T>
  try {
    body = await res.json()
  } catch {
    throw new Error('The server returned an unexpected response. Please try again.')
  }
  if (!body.success) throw new Error(body.error)
  return body.data
}

type DashboardStats = {
  totalProducts: number
  totalCategories: number
  lowStockCount: number
  outOfStockCount: number
  inventoryValue: number
  categoryDistribution: { category: string; count: number; percent: number }[]
  recentlyAdded: Product[]
  lowStockProducts: Product[]
  trend: { month: string; label: string; value: number }[]
}

type ProductsPage = { products: Product[]; total: number; page: number; pageSize: number }

const categoryIcons: Record<string, typeof Smartphone> = {
  Smartphones: Smartphone,
  Laptops: Laptop,
  Headphones,
  Monitors: Monitor,
  Cameras: Camera,
  Gaming: Tablet,
  TVs: Tv,
  Accessories: Boxes,
}

const EMPTY_PRODUCT = {
  id: 0,
  name: '',
  brand: '',
  category: CATEGORIES[0] as string,
  price: 0,
  stock: 0,
  minStock: 5,
  image: '',
  description: '',
}

type EditingProduct = typeof EMPTY_PRODUCT | Product

const PAGE_SIZE = 8

export function DashboardApp({ userEmail }: { userEmail: string }) {
  const [active, setActive] = useState('Dashboard')
  const [dark, setDark] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selected, setSelected] = useState<Product | null>(null)
  const [editing, setEditing] = useState<EditingProduct | null>(null)
  const [toast, setToast] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Dashboard stats (used by the Dashboard and Categories tabs)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')

  // Products tab: server-side search/filter/sort/pagination
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const [stockFilter, setStockFilter] = useState('All stock')
  const [sort, setSort] = useState('Newest first')
  const [page, setPage] = useState(1)
  const [productsPage, setProductsPage] = useState<ProductsPage | null>(null)
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')

  // Inventory tab: full stock list
  const [inventory, setInventory] = useState<Product[] | null>(null)
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [inventoryError, setInventoryError] = useState('')

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError('')
    try {
      const data = await apiFetch<DashboardStats>('/api/dashboard')
      setStats(data)
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true)
    setInventoryError('')
    try {
      const data = await apiFetch<ProductsPage>('/api/products?pageSize=200&sort=Newest%20first')
      setInventory(data.products)
    } catch (err) {
      setInventoryError(err instanceof Error ? err.message : 'Failed to load inventory')
    } finally {
      setInventoryLoading(false)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    setProductsError('')
    try {
      const params = new URLSearchParams({
        q: debouncedQuery,
        category,
        stock: stockFilter,
        sort,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      const data = await apiFetch<ProductsPage>(`/api/products?${params.toString()}`)
      setProductsPage(data)
    } catch (err) {
      setProductsError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setProductsLoading(false)
    }
  }, [debouncedQuery, category, stockFilter, sort, page])

  const refreshAll = useCallback(() => {
    loadStats()
    loadInventory()
    loadProducts()
  }, [loadStats, loadInventory, loadProducts])

  // Debounce the search box so it doesn't hit the API on every keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(id)
  }, [query])

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, category, stockFilter, sort])

  useEffect(() => {
    loadStats()
    loadInventory()
  }, [loadStats, loadInventory])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const form = new FormData(event.currentTarget)
    const payload = {
      name: String(form.get('name') ?? ''),
      brand: String(form.get('brand') ?? ''),
      category: String(form.get('category') ?? ''),
      price: Number(form.get('price')),
      stock: Number(form.get('stock')),
      minStock: Number(form.get('minStock')),
      image: String(form.get('image') ?? ''),
      description: String(form.get('description') ?? ''),
    }

    setSaving(true)
    try {
      const isEdit = editing !== null && 'createdAt' in editing
      if (isEdit) {
        await apiFetch(`/api/products/${(editing as Product).id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        notify('Product updated successfully')
      } else {
        await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(payload) })
        notify('Product added successfully')
      }
      setEditing(null)
      refreshAll()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save product')
    } finally {
      setSaving(false)
    }
  }

  async function removeProduct(id: number) {
    try {
      await apiFetch(`/api/products/${id}`, { method: 'DELETE' })
      setSelected(null)
      notify('Product removed')
      refreshAll()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete product')
    }
  }

  return (
    <div className={dark ? 'app-shell dark' : 'app-shell light'}>
      <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark">
            <Zap />
          </div>
          <span>
            Electro<span>Hub</span>
          </span>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X />
          </button>
        </div>
        <div className="workspace">
          <div className="workspace-icon">EH</div>
          <div>
            <strong>ElectroHub HQ</strong>
            <small>Inventory workspace</small>
          </div>
          <ChevronDown />
        </div>
        <nav>
          <p className="nav-label">Workspace</p>
          {(
            [
              ['Dashboard', LayoutDashboard],
              ['Products', Package],
              ['Categories', Boxes],
              ['Inventory', BarChart3],
            ] as const
          ).map(([label, Icon]) => (
            <button
              key={label}
              className={active === label ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                setActive(label)
                setSidebarOpen(false)
              }}
            >
              <Icon />
              {label}
            </button>
          ))}
          <p className="nav-label">Support</p>
          <button className="nav-item">
            <CircleHelp />
            Help center
          </button>
          <button className="nav-item">
            <Settings />
            Settings
          </button>
          <button className="nav-item signout" onClick={() => signOut()}>
            <LogOut />
            Log out
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="theme-toggle" onClick={() => setDark(!dark)}>
            {dark ? <Sun /> : <Moon />}
            <span>{dark ? 'Light mode' : 'Dark mode'}</span>
            <span className="toggle-dot" />
          </button>
          <div className="profile">
            <div className="avatar">{userEmail.slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{userEmail}</strong>
              <small>Administrator</small>
            </div>
            <Ellipsis />
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight />
            <strong>{active}</strong>
          </div>
          <div className="top-actions">
            <button className="icon-button">
              <Bell />
              <i />
            </button>
            <div className="top-avatar">{userEmail.slice(0, 2).toUpperCase()}</div>
          </div>
        </header>
        <div className="page-content">
          {active === 'Dashboard' && (
            <Dashboard
              stats={stats}
              loading={statsLoading}
              error={statsError}
              onRetry={loadStats}
              onAdd={() => setEditing(EMPTY_PRODUCT)}
              onSelect={setSelected}
            />
          )}
          {active === 'Products' && (
            <Products
              page={productsPage}
              loading={productsLoading}
              error={productsError}
              onRetry={loadProducts}
              query={query}
              setQuery={setQuery}
              category={category}
              setCategory={setCategory}
              stockFilter={stockFilter}
              setStockFilter={setStockFilter}
              sort={sort}
              setSort={setSort}
              pageIndex={page}
              setPageIndex={setPage}
              onAdd={() => setEditing(EMPTY_PRODUCT)}
              onSelect={setSelected}
              onEdit={setEditing}
              onDelete={removeProduct}
            />
          )}
          {active === 'Categories' && (
            <Categories
              stats={stats}
              loading={statsLoading}
              error={statsError}
              onRetry={loadStats}
              onSelectCategory={(c) => {
                setCategory(c)
                setActive('Products')
              }}
            />
          )}
          {active === 'Inventory' && (
            <Inventory
              products={inventory}
              loading={inventoryLoading}
              error={inventoryError}
              onRetry={loadInventory}
              totalValue={stats?.inventoryValue ?? 0}
              lowStockCount={stats?.lowStockCount ?? 0}
              outOfStockCount={stats?.outOfStockCount ?? 0}
              onSelect={setSelected}
            />
          )}
        </div>
      </main>
      {selected && (
        <Detail
          product={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected)
            setSelected(null)
          }}
          onDelete={() => removeProduct(selected.id)}
        />
      )}
      {editing && (
        <ProductForm
          product={editing}
          error={formError}
          saving={saving}
          onClose={() => {
            setEditing(null)
            setFormError('')
          }}
          onSave={saveProduct}
        />
      )}
      {toast && (
        <div className="toast">
          <Check />
          {toast}
        </div>
      )}
    </div>
  )
}

function StateMessage({
  loading,
  error,
  onRetry,
  empty,
}: {
  loading: boolean
  error: string
  onRetry: () => void
  empty?: boolean
}) {
  if (loading) {
    return (
      <div className="state-message">
        <div className="spinner" />
        <strong>Loading…</strong>
      </div>
    )
  }
  if (error) {
    return (
      <div className="state-message error">
        <AlertTriangle />
        <strong>Something went wrong</strong>
        <p>{error}</p>
        <button className="outline-button" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }
  if (empty) {
    return (
      <div className="state-message">
        <Package />
        <strong>No products yet</strong>
        <p>Add your first product to get started.</p>
      </div>
    )
  }
  return null
}

function Dashboard({
  stats,
  loading,
  error,
  onRetry,
  onAdd,
  onSelect,
}: {
  stats: DashboardStats | null
  loading: boolean
  error: string
  onRetry: () => void
  onAdd: () => void
  onSelect: (p: Product) => void
}) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (loading || error || !stats) {
    return (
      <>
        <div className="welcome-row">
          <div>
            <p className="eyebrow">{today}</p>
            <h1>
              Good morning <span>✦</span>
            </h1>
            <p className="subtitle">Here&apos;s what&apos;s happening with your electronics inventory.</p>
          </div>
          <button className="primary-button" onClick={onAdd}>
            <Plus /> Add product
          </button>
        </div>
        <StateMessage loading={loading} error={error} onRetry={onRetry} />
      </>
    )
  }

  const maxTrend = Math.max(1, ...stats.trend.map((t) => t.value))

  return (
    <>
      <div className="welcome-row">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>
            Good morning <span>✦</span>
          </h1>
          <p className="subtitle">Here&apos;s what&apos;s happening with your electronics inventory.</p>
        </div>
        <button className="primary-button" onClick={onAdd}>
          <Plus /> Add product
        </button>
      </div>
      <div className="stats-grid">
        <Stat icon={Package} label="Total products" value={stats.totalProducts.toString()} />
        <Stat icon={Boxes} label="Categories" value={stats.totalCategories.toString()} />
        <Stat icon={Archive} label="Low stock" value={stats.lowStockCount.toString().padStart(2, '0')} alert />
        <Stat icon={DollarSign} label="Inventory value" value={`$${(stats.inventoryValue / 1000).toFixed(1)}k`} />
      </div>
      <div className="dashboard-grid">
        <section className="card overview-card">
          <div className="card-heading">
            <div>
              <h2>Inventory overview</h2>
              <p>Cumulative inventory value by month added</p>
            </div>
          </div>
          <div className="chart">
            <div className="chart-y">
              <span>${Math.round(maxTrend / 1000)}k</span>
              <span>${Math.round((maxTrend * 0.75) / 1000)}k</span>
              <span>${Math.round((maxTrend * 0.5) / 1000)}k</span>
              <span>${Math.round((maxTrend * 0.25) / 1000)}k</span>
              <span>0</span>
            </div>
            <div className="chart-body">
              <div className="chart-lines">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="bars">
                {stats.trend.map((t) => (
                  <div className="bar-col" key={t.month}>
                    <div className="bar" style={{ height: `${Math.max(4, (t.value / maxTrend) * 100)}%` }} />
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="card distribution">
          <div className="card-heading">
            <div>
              <h2>Category distribution</h2>
              <p>Products by category</p>
            </div>
          </div>
          <div className="donut-wrap">
            <div className="donut" style={{ background: donutGradient(stats.categoryDistribution) }}>
              <div>
                <strong>{stats.totalProducts}</strong>
                <small>Products</small>
              </div>
            </div>
            <div className="legend">
              {stats.categoryDistribution.length === 0 && <span>No products yet</span>}
              {stats.categoryDistribution.slice(0, 4).map((c, i) => (
                <div key={c.category}>
                  <i className={['purple', 'blue', 'pink', 'gray'][i % 4]} />
                  <span>{c.category}</span>
                  <strong>{c.percent}%</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="lower-grid">
        <section className="card recent-card">
          <CardTitle title="Recently added" />
          <div className="product-list">
            {stats.recentlyAdded.length === 0 && <p className="subtitle">No products yet.</p>}
            {stats.recentlyAdded.map((p) => (
              <ProductRow key={p.id} product={p} onClick={() => onSelect(p)} />
            ))}
          </div>
        </section>
        <section className="card recent-card">
          <CardTitle title="Low stock products" />
          <div className="product-list">
            {stats.lowStockProducts.length === 0 && <p className="subtitle">Everything is well stocked.</p>}
            {stats.lowStockProducts.map((p) => (
              <ProductRow key={p.id} product={p} onClick={() => onSelect(p)} />
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function donutGradient(distribution: { category: string; percent: number }[]) {
  const colors = ['#8269ef', '#5e9ff3', '#ea78a2', '#3b3d4a', '#58bf8d', '#e5a147', '#4ca5ed', '#e47b9f']
  if (distribution.length === 0) return 'var(--surface-2)'
  let acc = 0
  const stops = distribution.map((c, i) => {
    const start = acc
    acc += c.percent
    return `${colors[i % colors.length]} ${start}% ${acc}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}

function Stat({
  icon: Icon,
  label,
  value,
  alert = false,
}: {
  icon: typeof Package
  label: string
  value: string
  alert?: boolean
}) {
  return (
    <div className="stat-card">
      <div className={alert ? 'stat-icon alert' : 'stat-icon'}>
        <Icon />
      </div>
      <div className="stat-meta">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function CardTitle({ title }: { title: string }) {
  return (
    <div className="card-heading">
      <div>
        <h2>{title}</h2>
        <p>Latest updates from your catalog</p>
      </div>
    </div>
  )
}

function ProductRow({ product, onClick }: { product: Product; onClick: () => void }) {
  const status = stockStatus(product)
  return (
    <button className="product-row" onClick={onClick}>
      <img src={product.image || '/placeholder.jpg'} alt="" />
      <span>
        <strong>{product.name}</strong>
        <small>
          {product.brand} · {product.category}
        </small>
      </span>
      <b className="row-price">${product.price.toLocaleString()}</b>
      <span className={`status ${status.kind}`}>{status.label}</span>
    </button>
  )
}

function Products({
  page,
  loading,
  error,
  onRetry,
  query,
  setQuery,
  category,
  setCategory,
  stockFilter,
  setStockFilter,
  sort,
  setSort,
  pageIndex,
  setPageIndex,
  onAdd,
  onSelect,
  onEdit,
  onDelete,
}: {
  page: ProductsPage | null
  loading: boolean
  error: string
  onRetry: () => void
  query: string
  setQuery: (v: string) => void
  category: string
  setCategory: (v: string) => void
  stockFilter: string
  setStockFilter: (v: string) => void
  sort: string
  setSort: (v: string) => void
  pageIndex: number
  setPageIndex: (updater: (n: number) => number) => void
  onAdd: () => void
  onSelect: (p: Product) => void
  onEdit: (p: Product) => void
  onDelete: (id: number) => void
}) {
  const products = page?.products ?? []
  const total = page?.total ?? 0
  const pageSize = page?.pageSize ?? PAGE_SIZE
  const from = total === 0 ? 0 : (pageIndex - 1) * pageSize + 1
  const to = Math.min(total, pageIndex * pageSize)

  return (
    <>
      <div className="welcome-row">
        <div>
          <p className="eyebrow">Catalog management</p>
          <h1>Products</h1>
          <p className="subtitle">Manage your electronics inventory in one place.</p>
        </div>
        <button className="primary-button" onClick={onAdd}>
          <Plus /> Add product
        </button>
      </div>
      <div className="toolbar card">
        <div className="search-wrap">
          <Search />
          <input placeholder="Search products..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
          <option>All stock</option>
          <option>In stock</option>
          <option>Low stock</option>
          <option>Out of stock</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option>Newest first</option>
          <option>Price: high to low</option>
          <option>Stock: low to high</option>
        </select>
      </div>
      <section className="card table-card">
        <div className="table-heading">
          <div>
            <h2>
              All products <span>{total}</span>
            </h2>
            <p>Keep track of your catalog and inventory levels.</p>
          </div>
        </div>
        {(loading || error || products.length === 0) && (
          <StateMessage loading={loading} error={error} onRetry={onRetry} empty={products.length === 0} />
        )}
        {!loading && !error && products.length > 0 && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const status = stockStatus(p)
                    return (
                      <tr key={p.id}>
                        <td>
                          <button className="table-product" onClick={() => onSelect(p)}>
                            <img src={p.image || '/placeholder.jpg'} alt="" />
                            <span>
                              <strong>{p.name}</strong>
                              <small>ID: EH-{String(p.id).padStart(4, '0')}</small>
                            </span>
                          </button>
                        </td>
                        <td>{p.brand}</td>
                        <td>
                          <span className="category-pill">{p.category}</span>
                        </td>
                        <td>
                          <strong>${p.price.toLocaleString()}</strong>
                        </td>
                        <td>{p.stock} units</td>
                        <td>
                          <span className={`status ${status.kind}`}>{status.label}</span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button onClick={() => onEdit(p)} aria-label="Edit">
                              <Pencil />
                            </button>
                            <button onClick={() => onDelete(p.id)} aria-label="Delete">
                              <Trash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Showing {from}–{to} of {total} products
              </span>
              <div>
                <button disabled={pageIndex <= 1} onClick={() => setPageIndex((n) => Math.max(1, n - 1))}>
                  <ChevronLeft />
                </button>
                <button className="current">{pageIndex}</button>
                <button disabled={to >= total} onClick={() => setPageIndex((n) => n + 1)}>
                  <ChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  )
}

function Categories({
  stats,
  loading,
  error,
  onRetry,
  onSelectCategory,
}: {
  stats: DashboardStats | null
  loading: boolean
  error: string
  onRetry: () => void
  onSelectCategory: (c: string) => void
}) {
  const counts = new Map(stats?.categoryDistribution.map((c) => [c.category, c.count]) ?? [])

  return (
    <>
      <div className="welcome-row">
        <div>
          <p className="eyebrow">Catalog structure</p>
          <h1>Categories</h1>
          <p className="subtitle">Organize your products into clear, discoverable groups.</p>
        </div>
      </div>
      {(loading || error) && <StateMessage loading={loading} error={error} onRetry={onRetry} />}
      {!loading && !error && (
        <div className="category-grid">
          {CATEGORIES.map((name, i) => {
            const Icon = categoryIcons[name]
            const count = counts.get(name) ?? 0
            return (
              <div className="category-card card" key={name}>
                <div className={`category-icon icon-${i % 5}`}>
                  <Icon />
                </div>
                <h2>{name}</h2>
                <p>{count} products</p>
                <button className="outline-button" onClick={() => onSelectCategory(name)}>
                  View products <ChevronRight />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Inventory({
  products,
  loading,
  error,
  onRetry,
  totalValue,
  lowStockCount,
  outOfStockCount,
  onSelect,
}: {
  products: Product[] | null
  loading: boolean
  error: string
  onRetry: () => void
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
  onSelect: (p: Product) => void
}) {
  const list = products ?? []
  const totalUnits = list.reduce((a, p) => a + p.stock, 0)

  return (
    <>
      <div className="welcome-row">
        <div>
          <p className="eyebrow">Stock control</p>
          <h1>Inventory</h1>
          <p className="subtitle">Monitor stock levels and keep your catalog moving.</p>
        </div>
      </div>
      <div className="stats-grid">
        <Stat icon={Boxes} label="Total units" value={totalUnits.toString()} />
        <Stat icon={Archive} label="Low stock" value={lowStockCount.toString().padStart(2, '0')} alert />
        <Stat icon={X} label="Out of stock" value={outOfStockCount.toString().padStart(2, '0')} alert />
        <Stat icon={DollarSign} label="Inventory value" value={`$${(totalValue / 1000).toFixed(1)}k`} />
      </div>
      <section className="card table-card inventory-list">
        <div className="table-heading">
          <div>
            <h2>Stock overview</h2>
            <p>Detailed inventory levels by product.</p>
          </div>
        </div>
        {(loading || error || list.length === 0) && (
          <StateMessage loading={loading} error={error} onRetry={onRetry} empty={list.length === 0} />
        )}
        {!loading && !error && list.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Current stock</th>
                  <th>Minimum stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const status = stockStatus(p)
                  return (
                    <tr key={p.id} onClick={() => onSelect(p)}>
                      <td>
                        <button className="table-product">
                          <img src={p.image || '/placeholder.jpg'} alt="" />
                          <span>
                            <strong>{p.name}</strong>
                            <small>{p.brand}</small>
                          </span>
                        </button>
                      </td>
                      <td>{p.category}</td>
                      <td>
                        <div className="stock-progress">
                          <span>
                            <i style={{ width: `${Math.min(100, p.stock * 2.5)}%` }} />
                          </span>
                          <b>{p.stock}</b>
                        </div>
                      </td>
                      <td>{p.minStock} units</td>
                      <td>
                        <span className={`status ${status.kind}`}>{status.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Detail({
  product,
  onClose,
  onEdit,
  onDelete,
}: {
  product: Product
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const status = stockStatus(product)
  return (
    <div className="overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose}>
          <X />
        </button>
        <img className="detail-image" src={product.image || '/placeholder.jpg'} alt={product.name} />
        <div className="detail-content">
          <span className={`status ${status.kind}`}>{status.label}</span>
          <p className="eyebrow">
            {product.category} · EH-{String(product.id).padStart(4, '0')}
          </p>
          <h2>{product.name}</h2>
          <p className="detail-brand">{product.brand}</p>
          <div className="detail-price">
            ${product.price.toLocaleString()} <small>USD</small>
          </div>
          <p className="detail-description">{product.description}</p>
          <div className="detail-stats">
            <div>
              <small>Available stock</small>
              <strong>{product.stock} units</strong>
            </div>
            <div>
              <small>Minimum stock</small>
              <strong>{product.minStock} units</strong>
            </div>
          </div>
          <div className="detail-actions">
            <button className="primary-button" onClick={onEdit}>
              <Pencil /> Edit product
            </button>
            <button className="danger-button" onClick={onDelete}>
              <Trash2 />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductForm({
  product,
  error,
  saving,
  onClose,
  onSave,
}: {
  product: EditingProduct
  error: string
  saving: boolean
  onClose: () => void
  onSave: (e: React.FormEvent<HTMLFormElement>) => void
}) {
  const isEdit = 'createdAt' in product
  return (
    <div className="overlay" onClick={onClose}>
      <div className="form-panel" onClick={(e) => e.stopPropagation()}>
        <div className="form-header">
          <div>
            <p className="eyebrow">Catalog management</p>
            <h2>{isEdit ? 'Edit product' : 'Add product'}</h2>
          </div>
          <button className="panel-close" onClick={onClose}>
            <X />
          </button>
        </div>
        <form onSubmit={onSave}>
          {error && <p className="auth-error">{error}</p>}
          <div className="form-grid">
            <label>
              Product name
              <input name="name" required defaultValue={product.name} placeholder="e.g. iPhone 15 Pro" />
            </label>
            <label>
              Brand
              <input name="brand" required defaultValue={product.brand} placeholder="e.g. Apple" />
            </label>
            <label>
              Category
              <select name="category" defaultValue={product.category}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Price
              <input name="price" type="number" min="0" step="0.01" required defaultValue={product.price} />
            </label>
            <label>
              Stock
              <input name="stock" type="number" min="0" step="1" required defaultValue={product.stock} />
            </label>
            <label>
              Minimum stock
              <input name="minStock" type="number" min="0" step="1" required defaultValue={product.minStock} />
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              rows={4}
              defaultValue={product.description}
              placeholder="Add a short product description..."
            />
          </label>
          <label>
            Image URL
            <input name="image" defaultValue={product.image} placeholder="https://..." />
          </label>
          <div className="form-actions">
            <button type="button" className="outline-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              <Check /> {saving ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
