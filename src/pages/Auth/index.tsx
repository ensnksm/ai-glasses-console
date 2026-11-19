import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, Eye, EyeOff, FlaskConical, Glasses, KeyRound, LayoutDashboard, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import ThemeControl from '../../components/common/ThemeControl'
import { useAuth } from '../../services/auth'
import { normalizeUsername, validPasswordLength } from '../../services/authStorage'
import { DEMO_ADMIN_ID, demoPasswordFor, resolveLoginDestination } from '../../services/permissions'
import './auth.css'

function AuthFrame({ children }: { children: ReactNode }) {
  const ambientRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ambient = ambientRef.current
    if (!ambient) return
    const syncVisibility = () => { ambient.toggleAttribute('data-paused', document.hidden) }
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => document.removeEventListener('visibilitychange', syncVisibility)
  }, [])

  return (
    <div className="auth-screen">
      <header className="auth-top">
        <div className="auth-brand">
          <span className="brand-mark"><Glasses size={23} aria-hidden="true" /></span>
          <div><strong>AI Glasses</strong><span>智能眼镜管理平台</span></div>
        </div>
        <ThemeControl />
      </header>
      <main className="auth-main" id="main-content">
        <div className="auth-card">
          <section className="auth-content" aria-labelledby="auth-title">{children}</section>
          <aside className="auth-intro" aria-label="演示访问流程">
            <div ref={ambientRef} className="auth-ambient" aria-hidden="true" />
            <div className="auth-intro-tag"><FlaskConical size={14} aria-hidden="true" /> 本地演示</div>
            <p className="auth-intro-title">智能眼镜<br />管理工作台</p>
            <p className="auth-intro-copy">查看设备、追溯 AI 事件、审核识别结果。</p>
            <ol className="auth-steps">
              <li><span><UserRoundPlus size={16} aria-hidden="true" /></span><div><strong>提交注册申请</strong><small>为演示创建一个新账号</small></div></li>
              <li><span><ShieldCheck size={16} aria-hidden="true" /></span><div><strong>超级管理员审批</strong><small>批准申请并分配访问权限</small></div></li>
              <li><span><LayoutDashboard size={16} aria-hidden="true" /></span><div><strong>登录管理后台</strong><small>查看和操作已授权的模块</small></div></li>
            </ol>
          </aside>
        </div>
      </main>
      <footer className="auth-footer"><span>AI Glasses · UI 原型 V0.1</span><span>演示账号和权限数据仅存于当前浏览器</span></footer>
    </div>
  )
}

function AuthHeading({ title, description, label }: { title: string; description: string; label: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [title])
  return (
    <header className="auth-heading">
      <span>{label}</span>
      <h1 ref={heading} tabIndex={-1} id="auth-title">{title}</h1>
      <p>{description}</p>
    </header>
  )
}

function AuthMessage({ tone = 'notice', children }: { tone?: 'notice' | 'error'; children: ReactNode }) {
  return (
    <div className={`auth-message auth-message--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <CircleAlert size={16} aria-hidden="true" /><span>{children}</span>
    </div>
  )
}

type FieldName = 'username' | 'password' | 'confirmPassword'
type FieldErrors = Partial<Record<FieldName, string>>

function PasswordField({ name, value, label, autoComplete, error, onChange }: {
  name: 'password' | 'confirmPassword'; value: string; label: string; autoComplete: 'current-password' | 'new-password'; error?: string; onChange: (value: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const hintId = `${name}-hint`
  const hasHint = name === 'password'
  return (
    <div className="auth-field">
      <label htmlFor={`auth-${name}`}>{label}</label>
      <div className="auth-password">
        <input id={`auth-${name}`} className="field-input auth-input" name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required maxLength={64}
          value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error || hasHint ? hintId : undefined} />
        <button type="button" className="auth-reveal" aria-label={`${visible ? '隐藏' : '显示'}${label}`} onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>
      {(error || hasHint) && <span className={error ? 'auth-input-error' : 'auth-input-hint'} id={hintId}>{error ?? (autoComplete === 'new-password' ? '8–64 个字符。请勿使用真实密码。' : '请勿在演示环境中输入真实密码。')}</span>}
    </div>
  )
}

function CredentialsForm({ isRegister, initialUsername = '', onSubmit }: {
  isRegister: boolean; initialUsername?: string; onSubmit: (username: string, password: string) => Promise<void>
}) {
  const [username, setUsername] = useState(initialUsername)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [filledDemo, setFilledDemo] = useState(false)

  function updateField(name: FieldName, value: string) {
    if (name === 'username') setUsername(value)
    if (name === 'password') setPassword(value)
    if (name === 'confirmPassword') setConfirmPassword(value)
    setFieldErrors((previous) => ({ ...previous, [name]: undefined, ...(name === 'password' ? { confirmPassword: undefined } : {}) }))
    setError('')
    setFilledDemo(false)
  }

  function fillDemo() {
    setUsername(DEMO_ADMIN_ID)
    setPassword(demoPasswordFor(DEMO_ADMIN_ID))
    setFieldErrors({})
    setError('')
    setFilledDemo(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const normalizedUsername = normalizeUsername(username)
    const errors: FieldErrors = {}
    if (!username.trim()) errors.username = '请输入用户名。'
    else if (!normalizedUsername) errors.username = '用户名须为 3–24 个英文字母、数字、下划线或连字符。'
    if (!password) errors.password = '请输入演示口令。'
    else if (isRegister && !validPasswordLength(password)) errors.password = '演示口令须为 8–64 个字符。'
    if (isRegister && confirmPassword !== password) errors.confirmPassword = '两次输入的口令不一致。'
    setFieldErrors(errors)
    setError('')
    const firstInvalid = (Object.keys(errors) as FieldName[])[0]
    if (firstInvalid) {
      const field = event.currentTarget.elements.namedItem(firstInvalid)
      requestAnimationFrame(() => { if (field instanceof HTMLInputElement) field.focus() })
      return
    }

    if (!normalizedUsername) return
    setBusy(true)
    try {
      await onSubmit(normalizedUsername, password)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : '暂时无法完成操作，请重试。')
    } finally {
      setBusy(false)
    }
  }

  const usernameHint = fieldErrors.username ?? (isRegister ? '3–24 个字符，可用英文字母、数字、下划线和连字符。' : undefined)
  return (
    <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="auth-field">
        <label htmlFor="auth-username">用户名</label>
        <input id="auth-username" className="field-input auth-input" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required
          value={username} onChange={(event) => updateField('username', event.target.value)} aria-invalid={Boolean(fieldErrors.username)} aria-describedby={usernameHint ? 'auth-username-hint' : undefined} />
        {usernameHint && <span className={fieldErrors.username ? 'auth-input-error' : 'auth-input-hint'} id="auth-username-hint">{usernameHint}</span>}
      </div>
      <PasswordField name="password" label="演示口令" autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} error={fieldErrors.password} onChange={(value) => updateField('password', value)} />
      {isRegister && <PasswordField name="confirmPassword" label="确认演示口令" autoComplete="new-password" value={confirmPassword} error={fieldErrors.confirmPassword} onChange={(value) => updateField('confirmPassword', value)} />}
      {error && <AuthMessage tone="error">{error}</AuthMessage>}
      <button type="submit" className="button button--primary auth-submit" disabled={busy}>
        {isRegister ? (busy ? '正在提交…' : '提交注册申请') : (busy ? '正在登录…' : '登录')}
        {!busy && <ArrowRight size={16} aria-hidden="true" />}
      </button>
      {!isRegister && (
        <div className="auth-demo-row">
          <button type="button" className="button button--quiet auth-demo-button" onClick={fillDemo} disabled={busy}><KeyRound size={16} aria-hidden="true" />填入演示超管凭据</button>
          {filledDemo && <span role="status">已填入，点击登录进入后台</span>}
        </div>
      )}
    </form>
  )
}

interface ReturnState { from?: string; registeredUsername?: string }

function useReturnState(): ReturnState {
  const { state } = useLocation()
  const values = state as { from?: unknown; registeredUsername?: unknown } | null
  return {
    from: typeof values?.from === 'string' ? values.from : undefined,
    registeredUsername: typeof values?.registeredUsername === 'string' ? values.registeredUsername : undefined,
  }
}

export function LoginPage() {
  const { currentUser, sessionNotice, login } = useAuth()
  const returnState = useReturnState()
  if (currentUser) return <Navigate to={resolveLoginDestination(currentUser, returnState.from)} replace />

  return (
    <AuthFrame>
      <AuthHeading label="账户访问" title="登录后台" description="使用已启用的演示账号进入管理平台。" />
      {sessionNotice && <AuthMessage>{sessionNotice}</AuthMessage>}
      <CredentialsForm isRegister={false} initialUsername={returnState.registeredUsername} onSubmit={login} />
      <div className="auth-content-footer"><span>还没有账号？</span><Link to="/register" state={{ from: returnState.from }}>注册演示账号 <ArrowRight size={14} aria-hidden="true" /></Link></div>
    </AuthFrame>
  )
}

export function RegisterPage() {
  const { currentUser, sessionNotice, register } = useAuth()
  const { from } = useReturnState()
  const [registeredUsername, setRegisteredUsername] = useState('')
  if (currentUser) return <Navigate to={resolveLoginDestination(currentUser, from)} replace />

  async function submitRegistration(username: string, password: string) {
    const account = await register(username, password)
    setRegisteredUsername(account.username)
  }

  return (
    <AuthFrame>
      {registeredUsername ? (
        <>
          <span className="auth-success-icon"><CircleCheck size={25} aria-hidden="true" /></span>
          <AuthHeading label="等待审批" title="注册申请已提交" description={`账号 ${registeredUsername} 正等待超级管理员审批。获批后即可登录。`} />
          <Link className="button button--primary auth-submit" to="/login" state={{ from, registeredUsername }} replace><ArrowLeft size={16} aria-hidden="true" />返回登录</Link>
        </>
      ) : (
        <>
          <AuthHeading label="账户申请" title="注册演示账号" description="注册后需等待超级管理员审批并分配角色。" />
          {sessionNotice && <AuthMessage>{sessionNotice}</AuthMessage>}
          <CredentialsForm isRegister onSubmit={submitRegistration} />
          <div className="auth-content-footer"><span>已有账号？</span><Link to="/login" state={{ from }}><ArrowLeft size={14} aria-hidden="true" />返回登录</Link></div>
        </>
      )}
    </AuthFrame>
  )
}
