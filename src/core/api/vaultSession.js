import { db } from '../db/database'
import { enqueuePendingOp, OP_UPSERT, MODE_CONTENT } from './syncService'

/**
 * @function classifyVault
 * @description Clasifica las palabras locales frente a la cuenta que acaba de
 * iniciar sesión. No usa índices: el vocabulario local es de una sola persona
 * y un recorrido completo es suficiente.
 * - orphans: palabras sin `user_id` (creadas en modo invitado o huérfanas).
 * - foreign: palabras con el `user_id` de otra cuenta (multiusuario).
 * - mine: palabras que ya pertenecen a esta cuenta.
 * @param {string} userId - UUID del usuario autenticado actual.
 * @returns {Promise<{orphans: Array<object>, foreign: Array<object>, mine: Array<object>}>}
 */
export async function classifyVault(userId) {
  const words = await db.words.toArray()

  const orphans = []
  const foreign = []
  const mine = []

  for (const word of words) {
    if (!word.user_id) {
      if (!word.is_deleted) orphans.push(word)
    } else if (word.user_id === userId) {
      mine.push(word)
    } else {
      foreign.push(word)
    }
  }

  return { orphans, foreign, mine }
}

/**
 * @function claimOrphans
 * @description Vincula las palabras huérfanas a la cuenta actual y encola una
 * operación de inserción por cada una, de modo que suban a la nube aunque la
 * red caiga justo después de la decisión del usuario.
 * @param {string} userId - UUID del usuario autenticado actual.
 * @returns {Promise<number>} Cantidad de palabras reclamadas.
 */
export async function claimOrphans(userId) {
  const { orphans } = await classifyVault(userId)
  if (orphans.length === 0) return 0

  await db.words.bulkUpdate(
    orphans.map(word => ({ key: word.id, changes: { user_id: userId } }))
  )

  for (const word of orphans) {
    await enqueuePendingOp(OP_UPSERT, word.id, { ...word, user_id: userId }, MODE_CONTENT)
  }

  return orphans.length
}

/**
 * @function removeOrphans
 * @description Elimina únicamente las palabras locales sin `user_id`. Es un
 * hard delete: al no tener cuenta asociada nunca llegaron a la nube.
 * @returns {Promise<number>} Cantidad de palabras eliminadas.
 */
export async function removeOrphans() {
  const words = await db.words.toArray()
  const ids = words.filter(word => !word.user_id).map(word => word.id)
  if (ids.length === 0) return 0

  await db.words.bulkDelete(ids)
  return ids.length
}

/**
 * @function purgeForeignWords
 * @description Purga automática del Caso 3: elimina de Dexie las palabras de
 * otras cuentas y descarta también las operaciones pendientes que las
 * referencien (o que ya no apunten a ninguna palabra local), para que la cola
 * no se suba con la sesión del usuario actual.
 * @param {string} userId - UUID del usuario autenticado actual.
 * @returns {Promise<number>} Cantidad de palabras purgadas.
 */
export async function purgeForeignWords(userId) {
  const words = await db.words.toArray()
  const foreignIds = new Set(
    words.filter(word => word.user_id && word.user_id !== userId).map(word => word.id)
  )
  if (foreignIds.size === 0) return 0

  await db.words.bulkDelete([...foreignIds])

  // Toda operación que ya no tiene palabra local detrás pertenece al dueño
  // anterior: se descarta para no reescribirla con la sesión actual.
  const remainingIds = new Set(words.filter(word => !foreignIds.has(word.id)).map(word => word.id))
  const ops = await db.pendingOps.toArray()
  const staleOps = ops.filter(op => !remainingIds.has(op.word_id))
  if (staleOps.length > 0) {
    await db.pendingOps.bulkDelete(staleOps.map(op => [op.word_id, op.type]))
  }

  return foreignIds.size
}

/**
 * @function hasUserWords
 * @description Indica si la cuenta tiene palabras visibles en este dispositivo.
 * Si no tiene ninguna, el logout no tiene nada que preguntar y sale directo.
 * @param {string} userId - UUID del usuario autenticado actual.
 * @returns {Promise<boolean>}
 */
export async function hasUserWords(userId) {
  const words = await db.words.toArray()
  return words.some(word => word.user_id === userId && !word.is_deleted)
}

/**
 * @function clearUserLocalData
 * @description Opción B del logout: elimina del dispositivo las palabras del
 * usuario que se va y vacía la cola de pendientes. Las palabras sin cuenta
 * (modo invitado) no se tocan.
 * @param {string} userId - UUID del usuario que cierra sesión.
 * @returns {Promise<number>} Cantidad de palabras eliminadas.
 */
export async function clearUserLocalData(userId) {
  const words = await db.words.toArray()
  const ids = words.filter(word => word.user_id === userId).map(word => word.id)

  if (ids.length > 0) await db.words.bulkDelete(ids)
  await db.pendingOps.clear()

  return ids.length
}
