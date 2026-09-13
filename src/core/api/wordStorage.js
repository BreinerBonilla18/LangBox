import { db } from '../db/database'

/**
 * @function saveWordToVault
 * @description Convierte una palabra en un objeto plano
 * y la almacena o actualiza dentro de IndexedDB utilizando Dexie.
 * @param {object} wordPayload - Objeto de palabra o tarjeta
 * @returns {Promise<boolean>} Retorna true si guardó con éxito
 * @throws Lanzará error si falla la escritura local
 */
export async function saveWordToVault(wordPayload) {
  try {
    // Convierte el objeto Proxy de Vue a un objeto JavaScript totalmente plano
    const plainPayload = JSON.parse(JSON.stringify(wordPayload))
    await db.words.put(plainPayload)
    return true
  } catch (error) {
    console.error('Error guardando en IndexedDB con Dexie:', error)
    throw error
  }
}

/**
 * @function getWordsForReviewToday
 * @description Filtra la base de datos local para adquirir todas las palabras/tarjetas activas que 
 * necesiten ser repasadas hoy o que estén atrasadas en su revisión.
 * Utiliza el valor SRS 'nrd' (Next Review Date).
 * @returns {Promise<Array<object>>} Arreglo de palabras descartando aquellas con Soft-Delete
 */
export async function getWordsForReviewToday() {
  const today = new Date().toISOString().slice(0, 10)
  
  // Busca las palabras cuya Próxima Fecha de Revisión (nrd) sea menor o igual a hoy
  const words = await db.words
    .where('nrd')
    .le(today)
    .toArray()

  return words.filter(w => !w.is_deleted)
}

/**
 * @function getAllVaultWords
 * @description Obtiene el lote completo de palabras guardadas en IndexedDB.
 * Filtra automáticamente las palabras que poseen una bandera de borrado lógico (`is_deleted: true`).
 * @returns {Promise<Array<object>>} Arreglo de todas las palabras vivas locales
 */
export async function getAllVaultWords() {
  const allWords = await db.words.toArray()
  return allWords.filter(w => !w.is_deleted)
}

/**
 * @function deleteWordFromVault
 * @description Maneja la lógica integral de borrado local-first. Aplica un 'Hard Delete'
 * en palabras puramente anónimas u 'Soft Delete' en palabras previamente sincronizadas con
 * la nube para luego purgar.
 * @param {string} id - UUID de la tarjeta
 * @returns {Promise<void>}
 */
export async function deleteWordFromVault(id) {
  const word = await db.words.get(id)
  if (word) {
    if (!word.user_id) {
      // Si no tiene user_id, nunca tocó la nube (fue anónima pura). Podemos borrar duro.
      await db.words.delete(id)
    } else {
      // Si tiene user_id, vino de la nube. Marcamos soft delete para sincronizar después.
      await db.words.update(id, { is_deleted: true })
    }
  }
}