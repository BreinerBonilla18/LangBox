// Cliente de Supabase para sincronización en la nube
import { createClient } from '@supabase/supabase-js'

// URL de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// Clave anónima de Supabase
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validar que las credenciales estén presentes
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan las credenciales de Supabase en .env')
}

// Crear cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Copia de la key que supabase-js calcula por defecto para la sesión:
// `sb-<primer segmento del host>-auth-token`. Se replica aquí para leerla sin
// exponer internos del cliente.
function authStorageKey() {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  } catch {
    return null
  }
}

/**
 * @function getStoredUserId
 * @description Devuelve el id del usuario de la sesión guardada leyendo el
 * almacén crudo. `supabase.auth.getSession()` devuelve `null` cuando el access
 * token caducó y no hay red para refrescarlo, pero `auth-js` conserva la sesión
 * en storage en ese caso: sin esta lectura directa, una revisión hecha offline
 * con el token expirado parecería de invitado y se perdería sin encolarse.
 * @returns {string|null} UUID del usuario recordado o null (invitado real)
 */
export function getStoredUserId() {
  try {
    const key = authStorageKey()
    const raw = key ? localStorage.getItem(key) : null
    if (!raw) return null

    const parsed = JSON.parse(raw)
    return parsed?.user?.id ?? null
  } catch {
    return null
  }
}