import { seedAccounts } from '../mocks/accounts'
import { ACCOUNT_STATUS_LABELS, BUSINESS_PERMISSIONS, DEMO_ADMIN_ID, ORDINARY_ROLES } from './permissions'
import type { Account } from './permissions'

type Credential = { salt: string; verifier: string }
export type StoredAccount = Account & { credential: Credential; sessionVersion: number }

export interface AuditLog {
  id: string
  at: string
  actor: string
  target: string
  action: string
  summary: string
}

export interface AuthStore {
  version: 1
  accounts: StoredAccount[]
  logs: AuditLog[]
}

export type DemoSession = { accountId: string; version: number }
export const AUTH_STORE_KEY = 'aig-demo-accounts-v1'
const sessionKey = 'aig-demo-session-v1'
const storageError = '无法使用浏览器存储，请检查当前站点的存储设置。'
const usernamePattern = /^[a-zA-Z0-9_-]{3,24}$/
const hexSalt = /^[0-9a-f]{32}$/
const hexVerifier = /^[0-9a-f]{64}$/
const iterations = 120_000

export function normalizeUsername(value: string) {
  const trimmed = value.trim()
  return usernamePattern.test(trimmed) ? trimmed.toLowerCase() : null
}

export const validPasswordLength = (value: string) => value.length >= 8 && value.length <= 64

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function deriveVerifier(password: string, salt: string) {
  if (!window.crypto?.subtle) throw new Error('当前页面无法校验演示口令，请使用本机启动地址。')
  const saltBytes = Uint8Array.from(salt.match(/../g) ?? [], (hex) => Number.parseInt(hex, 16))
  const material = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await window.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, material, 256)
  return toHex(new Uint8Array(bits))
}

export async function createCredential(password: string): Promise<Credential> {
  const salt = toHex(window.crypto.getRandomValues(new Uint8Array(16)))
  return { salt, verifier: await deriveVerifier(password, salt) }
}

export async function matchesCredential(password: string, credential: Credential) {
  return validPasswordLength(password) && (await deriveVerifier(password, credential.salt)) === credential.verifier
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStoredAccount(value: unknown): value is StoredAccount {
  if (!isRecord(value) || typeof value.id !== 'string' || normalizeUsername(value.id) !== value.id) return false
  if (value.id === DEMO_ADMIN_ID ? value.role !== 'superadmin' || value.status !== 'active' : !ORDINARY_ROLES.some(role => role === value.role)) return false
  return typeof value.status === 'string' && Object.hasOwn(ACCOUNT_STATUS_LABELS, value.status)
    && typeof value.createdAt === 'string' && Number.isSafeInteger(value.sessionVersion) && Number(value.sessionVersion) >= 0
    && isRecord(value.overrides) && Object.entries(value.overrides).every(([key, setting]) =>
      BUSINESS_PERMISSIONS.some(permission => permission.id === key) && (setting === 'allow' || setting === 'deny'))
    && isRecord(value.credential) && typeof value.credential.salt === 'string' && hexSalt.test(value.credential.salt)
    && typeof value.credential.verifier === 'string' && hexVerifier.test(value.credential.verifier)
}

function isLog(value: unknown): value is AuditLog {
  return isRecord(value) && ['id', 'at', 'actor', 'target', 'action', 'summary'].every(key => typeof value[key] === 'string')
}

export function readAuthStore(): AuthStore {
  let raw: string | null
  try { raw = window.localStorage.getItem(AUTH_STORE_KEY) } catch { throw new Error(storageError) }
  if (raw === null) return { version: 1, accounts: seedAccounts, logs: [] }
  try {
    const value: unknown = JSON.parse(raw)
    if (isRecord(value) && value.version === 1 && Array.isArray(value.accounts) && value.accounts.every(isStoredAccount)
      && value.accounts.some(account => account.id === DEMO_ADMIN_ID)
      && new Set(value.accounts.map(account => account.id)).size === value.accounts.length
      && Array.isArray(value.logs) && value.logs.every(isLog)) {
      return { version: 1, accounts: value.accounts, logs: value.logs }
    }
  } catch { /* An invalid store should not replace the user's existing data. */ }
  throw new Error('本地演示账号数据无法读取。可使用新的浏览器配置文件继续演示。')
}

export function writeAuthStore(store: AuthStore) {
  try { window.localStorage.setItem(AUTH_STORE_KEY, JSON.stringify(store)) } catch { throw new Error(storageError) }
}

export function readSession(): DemoSession | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(sessionKey) ?? 'null')
    if (isRecord(value) && typeof value.accountId === 'string' && typeof value.version === 'number' && Number.isSafeInteger(value.version)) {
      return { accountId: value.accountId, version: value.version }
    }
  } catch { /* Without a readable session the user remains signed out. */ }
  return null
}

export function writeSession(session: DemoSession | null) {
  try {
    if (session) window.sessionStorage.setItem(sessionKey, JSON.stringify(session))
    else window.sessionStorage.removeItem(sessionKey)
  } catch { throw new Error(storageError) }
}

export function getSessionAccount(store: AuthStore | null, session: DemoSession | null) {
  return store?.accounts.find(account => account.id === session?.accountId && account.status === 'active' && account.sessionVersion === session.version) ?? null
}
