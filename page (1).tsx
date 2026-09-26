import { Zap } from 'lucide-react'
import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <div className="app-shell auth-shell dark">
      <div className="card auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark">
            <Zap />
          </div>
          <span>
            Electro<span>Hub</span>
          </span>
        </div>
        <p className="subtitle auth-subtitle">Sign in to your inventory workspace.</p>
        <LoginForm next={next && next.startsWith('/') ? next : '/'} />
      </div>
    </div>
  )
}
