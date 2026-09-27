import 'server-only'
import type { CXRUser } from '@/lib/types'
import type { AnalysisFeedback, AnalysisRecord, EmailAlert, EmailDelivery, EmailRecipientRole } from './analysis'
import { sqliteStore } from './sqlite-store'

/**
 * Abstracción de persistencia del frontend.
 *
 * - `DATA_BACKEND=sqlite` (default): data/cxr.db — desarrollo y docker-compose.
 * - `DATA_BACKEND=firestore`: Firestore nativo vía REST — Cloud Run, donde el
 *   filesystem es efímero y SQLite pierde todo en cada reinicio.
 */

export interface DataStore {
  // Usuarios
  getUsers(): Promise<CXRUser[]>
  getUserByUsername(username: string): Promise<CXRUser | null>
  getUserById(id: string): Promise<CXRUser | null>
  createUser(user: CXRUser): Promise<void>
  updateUser(
    id: string,
    fields: Partial<Pick<CXRUser, 'name' | 'cmp' | 'specialty' | 'active' | 'password' | 'email'>>,
  ): Promise<CXRUser | null>
  deleteUser(id: string): Promise<boolean>

  // Historial de análisis
  createAnalysis(record: AnalysisRecord): Promise<void>
  setAnalysisNotes(id: string, notes: string): Promise<AnalysisRecord | null>
  claimEmailAlert(id: string, alert: EmailAlert): Promise<boolean>
  claimEmailRetry(id: string, role: EmailRecipientRole, now: Date): Promise<EmailAlert | null>
  setEmailAlert(id: string, alert: EmailAlert): Promise<void>
  setEmailDelivery(id: string, role: EmailRecipientRole, delivery: EmailDelivery): Promise<void>
  getAnalysis(id: string): Promise<AnalysisRecord | null>
  /** Últimos análisis (desc por fecha). Sin userId lista todos (vista admin). */
  listAnalyses(opts: { userId?: string; limit?: number }): Promise<AnalysisRecord[]>
  setAnalysisFeedback(id: string, feedback: AnalysisFeedback): Promise<AnalysisRecord | null>
}

export function getDataStore(): DataStore {
  if (process.env.DATA_BACKEND === 'firestore') {
    // Import perezoso: el módulo toca red/metadata server solo cuando se usa.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('./firestore-store') as typeof import('./firestore-store')).firestoreStore
  }
  return sqliteStore
}
