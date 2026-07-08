import 'server-only'
import { getDataStore } from './data/store'
import type { CXRUser } from './types'

/**
 * CRUD de usuarios. Fachada sobre el DataStore activo (SQLite o Firestore):
 * toda lectura/escritura de usuarios pasa por aquí.
 */

export function getUsers(): Promise<CXRUser[]> {
  return getDataStore().getUsers()
}

export function getUserByUsername(username: string): Promise<CXRUser | null> {
  return getDataStore().getUserByUsername(username)
}

export function getUserById(id: string): Promise<CXRUser | null> {
  return getDataStore().getUserById(id)
}

export function createUser(user: CXRUser): Promise<void> {
  return getDataStore().createUser(user)
}

export function updateUser(
  id: string,
  fields: Partial<Pick<CXRUser, 'name' | 'cmp' | 'specialty' | 'active' | 'password'>>,
): Promise<CXRUser | null> {
  return getDataStore().updateUser(id, fields)
}

export function deleteUser(id: string): Promise<boolean> {
  return getDataStore().deleteUser(id)
}
