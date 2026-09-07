import { supabase } from '../api/supabaseClient'
import { db } from '../db/database'

/**
 * Fusiona y sube las palabras locales acumuladas sin sesión hacia Supabase post-login
 */
export async function syncLocalWordsToCloudOnLogin(userId) {
  if (!userId) return
debugger
  // Obtener todas las palabras guardadas actualmente en IndexedDB (Dexie)
  const localWords = await db.words.toArray()

  if (localWords.length > 0) {
    // Asignar el user_id de la sesión actual a los registros locales antes de subirlos
    const payload = localWords.map(word => ({
      ...word,
      user_id: userId
    }))

    // Subir a Supabase usando 'upsert'
    // 'upsert' inserta los nuevos registros y actualiza los existentes evitando duplicados por 'id'
    const { error: uploadError } = await supabase
      .from('words')
      .upsert(payload, { onConflict: 'id' })

    if (uploadError) {
      console.error('Error al subir palabras locales a Supabase:', uploadError)
      return
    }
  }

  // Descargar palabras que existan en la nube pero no en el cliente local
  const { data: cloudWords, error: fetchError } = await supabase
    .from('words')
    .select('*')
    .eq('user_id', userId)

  if (fetchError) {
    console.error('Error al descargar palabras de la nube:', fetchError)
    return
  }

  if (cloudWords && cloudWords.length > 0) {
    // bulkPut en Dexie sobrescribe o añade las palabras de la nube sin duplicar
    await db.words.bulkPut(cloudWords)
  }
}

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
 * Elimina una palabra de la nube si hay sesión activa
 */
export async function syncDeleteWordFromCloud(id) {
  debugger
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const { error } = await supabase
    .from('words')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)

  if (error) {
    console.error('Error al eliminar palabra de Supabase:', error)
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

