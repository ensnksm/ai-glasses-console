import { DEMO_ADMIN_ID } from '../services/permissions'
import type { StoredAccount } from '../services/authStorage'

// Verifiers for the public, built-in demo passwords documented in README.
export const seedAccounts: StoredAccount[] = ([
  { id: DEMO_ADMIN_ID, role: 'superadmin', status: 'active', credential: { salt: '791af7490b06abdba760ec2970e5c6fb', verifier: '7eda42a7e48f619d0d34c5c66099a61ef1c61292a9cd23e0d04f7e8341aa4660' } },
  { id: 'analyst01', role: 'analyst', status: 'active', credential: { salt: '7fef0f289ca6a60bf70cce8fb3bf0366', verifier: '6eedd4fa5d82d9ccbec36251649c2fd871379ec20edff3f374de7504b6b179a5' } },
  { id: 'reviewer01', role: 'reviewer', status: 'active', credential: { salt: '99abee3eb3f74f3ec004b8a40c825f8b', verifier: 'a858fe603413e47053b0a765c48383a60470653dd27e0dd038ebeca588d12893' } },
  { id: 'viewer01', role: 'viewer', status: 'disabled', credential: { salt: '0f1cdafb9874785043f7538a4288ffa6', verifier: '9e92828c276244c94e1e99cd3215e3421071682ddd49a36ce5597d0a5b84e765' } },
] satisfies Array<Pick<StoredAccount, 'id' | 'role' | 'status' | 'credential'>>)
  .map((account) => ({ ...account, sessionVersion: 0, createdAt: '', overrides: {} }))
