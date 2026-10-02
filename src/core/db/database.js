import Dexie from 'dexie'

// Base de datos IndexedDB local
export const db = new Dexie('LangBoxDB')

// Tabla "words" y sus campos indexados (usando Dexie + IndexedDB).
// v1 - almacén principal del vocabulario.
db.version(1).stores({
  words: 'id, word, nrd, r, ef, i'
})

// v2 - Cola de operaciones pendientes de subir a la nube.
// La clave primaria compuesta `[word_id+type]` deduplica de forma natural:
// encolar dos veces el mismo cambio sobrescribe la operación anterior en lugar
// de acumularla, y por tanto siempre gana el estado más reciente del SRS.
db.version(2).stores({
  words: 'id, word, nrd, r, ef, i',
  pendingOps: '[word_id+type], created_at'
})