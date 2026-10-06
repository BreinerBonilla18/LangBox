import { supabase } from '../db/supabaseClient'
import { db } from '../db/database'
import { isBrowserOnline } from '../utils/online'

// Columnas reales de la tabla 'words' en Supabase.
// Cualquier clave local que no esté aquí (por ejemplo 'is_deleted') nunca se envía.
const CLOUD_WORD_COLUMNS = [
  'id',
  'user_id',
  'word',
  'phonetic',
  'meanings',
  'mnemonics',
  'synonyms',
  'r',
  'ef',
  'i',
  'nrd',
  'created_at'
]

// Columnas que definen el estado del Sistema de Repetición Espaciada.
// En la nube son la fuente de verdad: el local NUNCA las sobrescribe durante una fusión.
const SRS_COLUMNS = ['r', 'ef', 'i', 'nrd']

// Valores por defecto del SRS para una palabra recién creada
const DEFAULT_SRS = { r: 0, ef: 2.5, i: 1 }

// Tipos de operación que pueden quedar encoladas mientras no hay conexión.
export const OP_UPSERT = 'upsert'
export const OP_DELETE = 'delete'

// Modo de un 'upsert' pendiente. Importa porque define si al vaciar la cola se
// respeta el SRS remoto: la nube siempre es la fuente de verdad del SRS, salvo
// que la operación nace de una revisión real hecha en ESTE dispositivo.
export const MODE_CONTENT = 'content' // Guarda el contenido sin pisar el SRS de la nube.
const MODE_SRS = 'srs' // Revisión real: el SRS local es lo que debe subir.

// Promesa de la sincronización de inicio en curso, para que ninguna escritura
// de SRS se antipegue a la descarga autoritativa de la nube.
let pendingSync = null

// Promesa del vaciado de la cola, para no lanzar dos volcados a la vez
// (pueden coincidir una reconexión y un evento de foco).
let pendingFlush = null

/**
 * @function todayISO
 * @description Devuelve la fecha de hoy en formato YYYY-MM-DD.
 * @returns {string}
 */
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * @function toNumber
 * @description Convierte a número de forma segura. 'ef' es `numeric` en Postgres,
 * por lo que Supabase puede devolverlo como string y rompería el cálculo SM-2.
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function toNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * @function sanitizeForCloud
 * @description Reduce un objeto local al conjunto exacto de columnas de la tabla
 * 'words', asigna el user_id de la sesión y coerciona los campos numéricos.
 * @param {object} word
 * @param {string} userId
 * @returns {object}
 */
function sanitizeForCloud(word, userId) {
  const clean = {}
  for (const key of CLOUD_WORD_COLUMNS) {
    const value = key === 'user_id' ? userId : word?.[key]
    if (value !== undefined && value !== null) clean[key] = value
  }
  if (clean.ef !== undefined) clean.ef = toNumber(clean.ef, DEFAULT_SRS.ef)
  if (clean.r !== undefined) clean.r = toNumber(clean.r, DEFAULT_SRS.r)
  if (clean.i !== undefined) clean.i = toNumber(clean.i, DEFAULT_SRS.i)
  return clean
}

/**
 * @function sanitizeForInsert
 * @description Igual que sanitizeForCloud pero completa las columnas NOT NULL con
 * los valores por defecto del SRS. Solo se usa en caminos de INSERCIÓN.
 * @param {object} word
 * @param {string} userId
 * @returns {object}
 */
function sanitizeForInsert(word, userId) {
  const clean = sanitizeForCloud(word, userId)
  clean.word = clean.word || word?.id
  clean.r = toNumber(clean.r, DEFAULT_SRS.r)
  clean.ef = toNumber(clean.ef, DEFAULT_SRS.ef)
  clean.i = toNumber(clean.i, DEFAULT_SRS.i)
  clean.nrd = clean.nrd || todayISO()
  clean.created_at = clean.created_at || new Date().toISOString()
  return clean
}

/**
 * @function sanitizeFromCloud
 * @description Normaliza una fila descargada de Supabase para escribirla en Dexie.
 * @param {object} row
 * @returns {object}
 */
function sanitizeFromCloud(row) {
  return {
    ...row,
    r: toNumber(row.r, DEFAULT_SRS.r),
    ef: toNumber(row.ef, DEFAULT_SRS.ef),
    i: toNumber(row.i, DEFAULT_SRS.i),
    nrd: row.nrd || todayISO()
  }
}

/**
 * @function readCloudSrs
 * @description Lee el estado SRS autoritativo de una palabra en la nube.
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<object|null>} Objeto con r/ef/i/nrd o null si no existe en la nube
 */
async function readCloudSrs(id, userId) {
  const { data, error } = await supabase
    .from('words')
    .select('r, ef, i, nrd')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error leyendo el SRS de la nube:', error)
    return null
  }

  if (!data) return null

  return {
    r: toNumber(data.r, DEFAULT_SRS.r),
    ef: toNumber(data.ef, DEFAULT_SRS.ef),
    i: toNumber(data.i, DEFAULT_SRS.i),
    nrd: data.nrd || todayISO()
  }
}

/**
 * @function performLoginSync
 * @description Fusión nube -> local. Descarga primero el estado de la nube y solo
 * después escribe en ella, y únicamente las palabras que aún no existen allí
 * (`ignoreDuplicates`), de modo que el SRS remoto jamás es sobrescrito.
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function performLoginSync(userId) {
  // Palabras guardadas actualmente en IndexedDB (Dexie)
  const localWords = await db.words.toArray()

  const activeWords = []
  const deletedWords = []

  localWords.forEach(word => {
    if (word.is_deleted) deletedWords.push(word)
    else activeWords.push(word)
  })

  // 1) Purgar en la nube las palabras con Soft-Delete (no toca el SRS del resto)
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

  // 2) Descargar la nube ANTES de escribir en ella: define qué es la fuente de verdad
  const { data: cloudWords, error: fetchError } = await supabase
    .from('words')
    .select('*')
    .eq('user_id', userId)

  if (fetchError) {
    console.error('Error al descargar palabras de la nube:', fetchError)
    return
  }

  const cloudRows = cloudWords || []
  const cloudIds = new Set(cloudRows.map(w => w.id))

  // 3) Solo viajan a la nube las palabras que aún no existen allí.
  //    `ignoreDuplicates` garantiza que si el registro aparece entre tanto,
  //    la nube no se modifica (y por tanto su SRS tampoco).
  const newWords = activeWords.filter(word => !cloudIds.has(word.id))
  let mergedRows = cloudRows

  if (newWords.length > 0) {
    const payload = newWords.map(word => sanitizeForInsert(word, userId))

    const { error: uploadError } = await supabase
      .from('words')
      .upsert(payload, { ignoreDuplicates: true })

    if (uploadError) {
      // Si falla la subida, esas palabras se quedan solo en local con su SRS intacto
      console.error('Error al subir palabras nuevas a Supabase:', uploadError)
    } else {
      mergedRows = [...cloudRows, ...payload]
    }
  }

  // 4) Volcar la nube sobre el vault local: aquí el SRS remoto pisa al local
  if (mergedRows.length > 0) {
    await db.words.bulkPut(mergedRows.map(sanitizeFromCloud))
  }
}

/**
 * @function syncLocalWordsToCloudOnLogin
 * @description Sincroniza el vault local con la nube al iniciar sesión.
 * La nube es la fuente de verdad del SRS: se fusiona primero nube -> local y
 * solo se envían a la nube las palabras que todavía no existen allí, de modo
 * que el progreso de repetición de otros dispositivos nunca se destruye.
 * Tras la fusión se vacía la cola offline, para que un avance de repaso hecho
 * sin conexión termine ganándole a la copia descargada de la nube.
 * @param {string} userId - UUID del usuario autenticado actual.
 * @returns {Promise<void>}
 */
export async function syncLocalWordsToCloudOnLogin(userId) {
  if (!userId) return

  // Sin red la fusión no puede ocurrir: el vault local queda intacto y la cola
  // se conservará hasta que `flushPendingOps` pueda ejecutarse.
  if (!isBrowserOnline()) return

  const sync = performLoginSync(userId)
  pendingSync = sync

  try {
    await sync
  } finally {
    if (pendingSync === sync) pendingSync = null
  }

  await flushPendingOps()
}

/**
 * @function waitForPendingSync
 * @description Espera a que termine la sincronización de inicio en curso.
 * Evita que una revisión guardada durante la descarga sea sobrescrita por
 * una nube más antigua o llegue a la nube con un SRS obsoleto.
 * @returns {Promise<void>}
 */
export async function waitForPendingSync() {
  if (!pendingSync) return
  try {
    await pendingSync
  } catch {
    // El fallo ya quedó registrado en consola; no debe bloquear la app
  }
}

/**
 * @function enqueuePendingOp
 * @description Encola una operación para subirla cuando vuelva la conexión.
 * Como la clave primaria de 'pendingOps' es `[word_id+type]`, encolar dos veces
 * la misma operación la SOBRESCRIBE: siempre gana el estado más reciente.
 * @param {string} type - OP_UPSERT u OP_DELETE
 * @param {string} wordId
 * @param {object} payload - Palabra local completa (solo para OP_UPSERT)
 * @param {string} mode - MODE_CONTENT o MODE_SRS (solo para OP_UPSERT)
 * @returns {Promise<void>}
 */
export async function enqueuePendingOp(type, wordId, payload, mode) {
  try {
    await db.pendingOps.put({
      word_id: wordId,
      type,
      mode: mode ?? MODE_SRS,
      payload: payload ? sanitizeForInsert(payload, 'pending') : null,
      created_at: new Date().toISOString()
    })
    console.log(`[sync] Operación "${type}" encolada para "${wordId}" (${mode ?? '-'}): sin conexión.`)
  } catch (error) {
    console.error('Error encolando operación pendiente:', error)
  }
}

/**
 * @function countPendingOps
 * @description Número de operaciones aún no subidas a la nube.
 * @returns {Promise<number>}
 */
export async function countPendingOps() {
  return await db.pendingOps.count()
}

/**
 * @function pushWordToCloud
 * @description Sube el contenido de una palabra preservando el SRS remoto:
 * la inserta si no existe en la nube y, si ya existe, solo actualiza el
 * significado, la fonética, los sinónimos y los mnemotecnios.
 * @param {string} userId
 * @param {object} payload - Palabra ya saneada para la nube
 * @returns {Promise<boolean>} `true` si la nube aceptó la escritura
 */
async function pushWordToCloud(userId, payload) {
  const cloudSrs = await readCloudSrs(payload.id, userId)

  if (!cloudSrs) {
    const { error } = await supabase.from('words').insert(payload)
    if (error) {
      console.error('Error al guardar la palabra en Supabase:', error)
      return false
    }
    return true
  }

  const { error } = await supabase
    .from('words')
    .update({
      word: payload.word,
      phonetic: payload.phonetic ?? null,
      meanings: payload.meanings ?? [],
      mnemonics: payload.mnemonics ?? [],
      synonyms: payload.synonyms ?? [],
      r: cloudSrs.r,
      ef: cloudSrs.ef,
      i: cloudSrs.i,
      nrd: cloudSrs.nrd
    })
    .eq('id', payload.id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error actualizando la palabra en Supabase:', error)
    return false
  }
  return true
}

/**
 * @function pushSrsToCloud
 * @description Escribe el estado SRS completo (r/ef/i/nrd) de una palabra.
 * @param {string} userId
 * @param {object} payload - Palabra ya saneada para la nube
 * @returns {Promise<boolean>} `true` si la nube aceptó la escritura
 */
async function pushSrsToCloud(userId, payload) {
  const { error } = await supabase.from('words').upsert(payload)
  if (error) {
    console.error('Error sincronizando con Supabase:', error)
    return false
  }
  return true
}

/**
 * @function pushDeleteToCloud
 * @description Elimina definitivamente la palabra en la nube y, si la nube lo
 * confirma, descarta también la lápida local (`is_deleted`) que la representaba.
 * @param {string} userId
 * @param {string} wordId
 * @returns {Promise<boolean>} `true` si la nube confirmó el borrado
 */
async function pushDeleteToCloud(userId, wordId) {
  const { error } = await supabase
    .from('words')
    .delete()
    .eq('id', wordId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error al eliminar palabra de Supabase:', error)
    return false
  }

  // La nube ya no la tiene: la lápida local cumplió su función.
  await db.words.delete(wordId).catch(err =>
    console.error('Error limpiando la lápida local tras el borrado en la nube:', err)
  )
  return true
}

/**
 * @function flushPendingOps
 * @description Vuelca en la nube todas las operaciones acumuladas durante el
 * periodo offline. Cada operación solo se descarta de la cola si la nube la
 * confirmó, de modo que un fallo intermedio nunca pierde cambios.
 * @returns {Promise<void>}
 */
export async function flushPendingOps() {
  if (pendingFlush) return pendingFlush
  if (!isBrowserOnline()) return

  const flush = (async () => {
    const ops = await db.pendingOps.toArray()
    if (ops.length === 0) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return // Sin sesión no hay a quién subirle los cambios.
    const userId = session.user.id

    let synced = 0

    for (const op of ops) {
      try {
        let ok = false

        if (op.type === OP_DELETE) {
          ok = await pushDeleteToCloud(userId, op.word_id)
        } else if (op.mode === MODE_CONTENT) {
          ok = await pushWordToCloud(userId, { ...op.payload, user_id: userId })
        } else {
          ok = await pushSrsToCloud(userId, { ...op.payload, user_id: userId })
        }

        if (ok) {
          await db.pendingOps.delete([op.word_id, op.type])
          synced += 1
        }
      } catch (error) {
        console.error(`Error vaciando la operación pendiente de "${op.word_id}":`, error)
        // Se detiene el volcado: si la red volvió a caerse, el resto tampoco pasa.
        break
      }
    }

    if (synced > 0) console.log(`[sync] ${synced} operación(es) pendiente(s) sincronizadas.`)
  })()

  pendingFlush = flush
  try {
    await flush
  } finally {
    if (pendingFlush === flush) pendingFlush = null
  }
}

/**
 * @function syncWordToCloud
 * @description Actualiza el progreso SRS de una palabra ya sincronizada en la nube.
 * Es la única vía que escribe `r/ef/i/nrd` sobre un registro existente, y solo
 * se usa tras una revisión real en las flashcards. Si no hay red, el avance se
 * encola para no perder el progreso de repaso.
 * @param {object} wordPayload - Palabra con su SRS ya calculado
 * @returns {Promise<void>}
 */
export async function syncWordToCloud(wordPayload) {
  // Nunca escribir SRS antes de que la nube haya descargado su estado autoritativo
  await waitForPendingSync()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) return // Si no hay usuario autenticado, opera solo localmente

  const payload = sanitizeForCloud(wordPayload, session.user.id)

  // Una actualización SRS incompleta reiniciaría la nube, así que se descarta
  if (SRS_COLUMNS.some(column => payload[column] === undefined)) {
    console.warn('SRS incompleto, se omite la subida para no reiniciar el progreso:', payload.id)
    return
  }

  if (!isBrowserOnline()) {
    await enqueuePendingOp(OP_UPSERT, payload.id, wordPayload, MODE_SRS)
    return
  }

  const ok = await pushSrsToCloud(session.user.id, payload)
  if (!ok) await enqueuePendingOp(OP_UPSERT, payload.id, wordPayload, MODE_SRS)
}

/**
 * @function syncNewWordToCloud
 * @description Inserta una palabra recién guardada sin alterar el SRS que ya exista
 * en la nube. Si la palabra ya está sincronizada desde otro dispositivo, solo se
 * actualiza el contenido (significado, fonética, sinónimos...) y se preserva
 * intacto su `r/ef/i/nrd`. Si no hay red, queda encolada con ese mismo criterio.
 * @param {object} wordPayload - Palabra guardada localmente
 * @returns {Promise<void>}
 */
export async function syncNewWordToCloud(wordPayload) {
  await waitForPendingSync()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) return // Si no hay usuario autenticado, opera solo localmente

  if (!isBrowserOnline()) {
    await enqueuePendingOp(OP_UPSERT, wordPayload.id, wordPayload, MODE_CONTENT)
    return
  }

  const payload = sanitizeForInsert(wordPayload, session.user.id)
  const ok = await pushWordToCloud(session.user.id, payload)
  if (!ok) await enqueuePendingOp(OP_UPSERT, payload.id, wordPayload, MODE_CONTENT)
}

/**
 * @function syncDeleteWordFromCloud
 * @description Remueve permanentemente una palabra de la base de datos central en la nube.
 * Solo afecta si el usuario cuenta con una sesión válida. Sin conexión, el borrado
 * se encola en lugar de descartarse en silencio.
 * @param {string} id - Identificador único de la palabra a eliminar
 * @returns {Promise<void>}
 */
export async function syncDeleteWordFromCloud(id) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return // Si no hay usuario autenticado, no hacer nada

  if (!isBrowserOnline()) {
    await enqueuePendingOp(OP_DELETE, id)
    return
  }

  const ok = await pushDeleteToCloud(session.user.id, id)
  if (!ok) await enqueuePendingOp(OP_DELETE, id)
}