import Dexie from 'dexie'

// Base de datos IndexedDB local
export const db = new Dexie('LangBoxDB')

// tabla "words" y sus campos indexados (usando Dexie + IndexedDB)
db.version(1).stores({
  words: 'id, word, nrd, r, ef, i'
})