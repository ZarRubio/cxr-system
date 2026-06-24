/**
 * Ejecutar UNA sola vez para crear el usuario admin inicial:
 *   node scripts/setup-admin.mjs
 *
 * Crea data/users.json con el admin por defecto.
 * Credenciales iniciales: admin / hnal2026  (cambiar tras el primer login)
 */
import bcrypt from 'bcryptjs'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir   = join(__dirname, '..', 'data')
const usersPath = join(dataDir, 'users.json')

mkdirSync(dataDir, { recursive: true })

const password = 'hnal2026'
const hash     = await bcrypt.hash(password, 10)

const admin = {
  id:        'usr_admin',
  name:      'Administrador HNAL',
  username:  'admin',
  password:  hash,
  role:      'admin',
  cmp:       null,
  specialty: 'Administración del sistema',
  active:    true,
  createdAt: new Date().toISOString(),
}

writeFileSync(usersPath, JSON.stringify([admin], null, 2), 'utf-8')

console.log('✓ data/users.json creado.')
console.log('  Usuario:    admin')
console.log('  Contraseña: hnal2026')
console.log('  → Cambia la contraseña desde el panel /admin después del primer login.')
