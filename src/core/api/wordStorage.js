import { db } from '../db/database'

/**
 * Guarda o actualiza una palabra completa con sus datos léxicos y métricas SRS
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
 * Obtiene todas las palabras pendientes de repaso para la fecha actual o anterior
 */
export async function getWordsForReviewToday() {
  const today = new Date().toISOString().slice(0, 10)
  
  // Busca las palabras cuya Próxima Fecha de Revisión (nrd) sea menor o igual a hoy
  return await db.words
    .where('nrd')
    .le(today)
    .toArray()
}

/**
 * Obtiene todas las palabras guardadas en el baúl
 */
export async function getAllVaultWords() {
  return await db.words.toArray()
}

/**
 * Elimina una palabra por su ID
 */
export async function deleteWordFromVault(id) {
  await db.words.delete(id)
}