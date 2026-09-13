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