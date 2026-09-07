import { supabase } from '../api/supabaseClient'
import { db } from '../db/database'

/**
 * Sincroniza una palabra individual a la nube si hay sesión activa
 */
export async function syncWordToCloud(wordPayload) {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return // Si no hay usuario autenticado, opera solo localmente (Local-First)

  const payloadWithUser = {
    ...wordPayload,
    user_id: session.user.id
  }

  const { error } = await supabase
    .from('words')
    .upsert(payloadWithUser)

  if (error) {
    console.error('Error sincronizando con Supabase:', error)
  }
}


/**
 * Descarga las palabras de la nube y las fusiona con Dexie.js
 */
export async function pullWordsFromCloud() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const { data: cloudWords, error } = await supabase
    .from('words')
    .select('*')

  if (error) {
    console.error('Error descargando palabras de la nube:', error)
    return
  }

  if (cloudWords && cloudWords.length > 0) {
    // Guardamos las palabras en la IndexedDB local
    await db.words.bulkPut(cloudWords)
  }
}

/**
 * Descarga solo las palabras creadas/actualizadas desde la última sincronización
 *//* 
export async function pullWordsFromCloud(force = false) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const LAST_SYNC_KEY = `langbox_last_sync_${session.user.id}`
  const SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutos de margen sin llamadas
  
  const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY) || 0)
  const now = Date.now()

  // Evitamos llamadas innecesarias si se llamó recientemente
  if (!force && (now - lastSync) < SYNC_INTERVAL) {
    return
  }

  // Si tenemos una sincronización previa, traemos solo los cambios posteriores
  let query = supabase.from('words').select('*')
  
  if (lastSync > 0) {
    const lastSyncISO = new Date(lastSync).toISOString()
    query = query.gt('updated_at', lastSyncISO)
  }

  const { data: cloudWords, error } = await query

  if (error) {
    console.error('Error descargando palabras de la nube:', error)
    return
  }

  if (cloudWords && cloudWords.length > 0) {
    // Dexie sustituye o inserta según la PK de la palabra
    await db.words.bulkPut(cloudWords)
  } 

  // Guardamos la fecha del pull exitoso
  localStorage.setItem(LAST_SYNC_KEY, now.toString())
}*/