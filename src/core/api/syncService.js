import { supabase } from '../db/supabaseClient'
import { db } from '../db/database'

/**
 * @function syncLocalWordsToCloudOnLogin
 * @description Sincroniza la IndexedDB local (Dexie) hacia la nube (Supabase) cuando el usuario inicia sesión. 
 * Clasifica las palabras en eliminadas (Soft Delete) y activas, purga los fantasmas, inserta/actualiza 
 * datos nuevos y, finalmente, descarga la información más reciente desde la nube.
 * @param {string} userId - UUID del usuario autenticado actual.
 * @returns {Promise<void>}
 */
export async function syncLocalWordsToCloudOnLogin(userId) {
  if (!userId) return
  // Obtener todas las palabras guardadas actualmente en IndexedDB (Dexie)
  const localWords = await db.words.toArray()

  const activeWords = []
  const deletedWords = []

  // Clasificar las palabras en activas y eliminadas
  localWords.forEach(word => {
    if (word.is_deleted) deletedWords.push(word)
    else activeWords.push(word)
  })

  // Purgar en la nube las palabras con Soft-Delete
  if (deletedWords.length > 0) {
    const deletedIds = deletedWords.map(w => w.id)
    const { error: delError } = await supabase
      .from('words')
      .delete()
      .in('id', deletedIds)
      .eq('user_id', userId)

    if (delError) {
      console.error('Error purgando palabras borradas de la nube:', delError)
    } else {
      // Si el borrado en la nube fue exitoso, aplicamos Hard Delete local
      await db.words.bulkDelete(deletedIds)
    }
  }

  // Sincronizar (Upsert) palabras activas
  if (activeWords.length > 0) {
    // Asignar el user_id de la sesión actual a los registros locales y purificarlos
    const payload = activeWords.map(word => {
      const sanitized = { ...word, user_id: userId }
      
      // Si created_at es nulo o vacío por alguna razón al guardarse, generamos uno local
      if (!sanitized.created_at) {
        sanitized.created_at = new Date().toISOString()
      }

      return sanitized
    })

    // Subir a Supabase usando 'upsert'
    // 'upsert' inserta los nuevos registros y actualiza los existentes evitando duplicados por 'id'
    const { error: uploadError } = await supabase
      .from('words')
      .upsert(payload)

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
 * @function syncWordToCloud
 * @description Inserta o actualiza una única palabra de forma individual hacia Supabase,
 * bajo la condición de que exista una sesión activa.
 * @param {object} wordPayload - Objeto de palabra o tarjeta de estudio generada en local
 * @returns {Promise<void>}
 */
export async function syncWordToCloud(wordPayload) {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return // Si no hay usuario autenticado, opera solo localmente

  // Asignar el user_id de la sesión actual al payload
  const payloadWithUser = {
    ...wordPayload,
    user_id: session.user.id
  }

  // Subir la palabra a Supabase usando 'upsert'
  const { error } = await supabase
    .from('words')
    .upsert(payloadWithUser)

  if (error) {
    console.error('Error sincronizando con Supabase:', error)
  }
}

/**
 * @function syncDeleteWordFromCloud
 * @description Remueve permanentemente una palabra de la base de datos central en la nube.
 * Solo afecta si el usuario cuenta con una sesión válida.
 * @param {string} id - Identificador único de la palabra a eliminar
 * @returns {Promise<void>}
 */
export async function syncDeleteWordFromCloud(id) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return // Si no hay usuario autenticado, no hacer nada

  // Eliminar la palabra de Supabase
  const { error } = await supabase 
    .from('words')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)

  if (error) {
    console.error('Error al eliminar palabra de Supabase:', error)
  }
}