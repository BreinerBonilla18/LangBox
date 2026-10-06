/**
 * Longitud máxima de la consulta en caracteres. Coincide con el `maxlength`
 * del input, de modo que la restricción se nota mientras se escribe y no al
 * pulsar Buscar.
 */
export const MAX_QUERY_LENGTH = 40

/**
 * Máximo de palabras por consulta. Cinco es el punto en el que se aceptan casi
 * todos los idioms y expresiones ("a blessing in disguise", "back to square one")
 * sin dejar pasar una oración, que es justo lo que se quiere evitar.
 */
export const MAX_WORDS = 5

/**
 * Longitud mínima de cada palabra, con las excepciones de
 * {@link SINGLE_LETTER_ALLOWLIST}.
 */
const MIN_WORD_LENGTH = 2

/**
 * Palabras inglesas legítimas de una sola letra. Sin esta salvedad, la regla
 * de longitud mínima rechazaría dos palabras que sí existen y que el usuario
 * tiene derecho a consultar.
 */
const SINGLE_LETTER_ALLOWLIST = new Set(['a', 'i'])

/**
 * Caracteres admitidos: letras latinas (ASCII, latín extendido) y la
 * puntuación interna de las palabras, más el espacio.
 *
 * Se listan rangos explícitos en lugar de usar `\p{Script=Latin}` a propósito:
 * esa propiedad exige el flag `u`, y sin él el navegador no da error de
 * sintaxis, simplemente interpreta el texto de forma literal y el validador
 * rechazaría silenciosamente toda consulta válida. Con los rangos no hay
 * dependencia del motor ni comportamiento que interpretar.
 *
 * Al ser una lista positiva, todo lo demás cae por su cuenta: dígitos, símbolos,
 * emojis, saltos de línea y otros alfabetos (cirílico, árabe, japoneso...).
 */
const ALLOWED_CHARACTERS = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-ɏ'’\-. ]+$/

/** El mismo conjunto, pero exigiendo al menos una letra (rechaza "..." o "--"). */
const REQUIRES_LATIN_LETTER = /[A-Za-zÀ-ÖØ-öø-ÿĀ-ɏ]/

/** Puntuación que solo tiene sentido en los extremos de una palabra. */
const EDGE_PUNCTUATION = /^[\s'’\-.]+|[\s'’\-.]+$/g

/**
 * Mensajes para la interfaz, indexados por el motivo del rechazo. Se mantienen
 * aquí para que la lógica de validación no dependa de la capa de presentación.
 */
export const SEARCH_ERROR_MESSAGES = {
  empty: 'Escribe una palabra para buscar.',
  tooLong: `La búsqueda admite hasta ${MAX_QUERY_LENGTH} caracteres.`,
  tooManyWords: `Escribe una sola palabra o una expresión de hasta ${MAX_WORDS} palabras.`,
  invalidCharacters:
    'Solo se admiten letras. Quita los números, los símbolos y los acentos de otros idiomas.',
  noLetters: 'La búsqueda necesita al menos una letra.',
  tooShort: 'Esa palabra es demasiado corta. Revísala.'
}

/**
 * @function normalizeSearchQuery
 * @description Limpia la consulta antes de validarla: unifica la forma Unicode
 * (NFKC convierte los caracteres de ancho completo y los signos de puntuación
 * "tipográficos" a su equivalente ASCII), colapsa los espacios repetidos y
 * descarta la puntuación sobrante en los extremos.
 * @param {string} rawInput - Texto tal cual lo escribió el usuario.
 * @returns {string} La consulta normalizada, o cadena vacía si no hay entrada útil.
 */
export function normalizeSearchQuery(rawInput) {
  if (typeof rawInput !== 'string') return ''

  return rawInput
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCTUATION, '')
}

/**
 * @function validateSearchQuery
 * @description Decide si una consulta es apta para enviarse a la IA.
 * @param {string} rawInput - Texto tal cual lo escribió el usuario.
 * @returns {{ valid: boolean, value?: string, reason?: string }} Con `valid`
 * a `true` incluye `value` ya normalizada y lista para usar. Con `valid` a
 * `false` incluye `reason`, una clave de {@link SEARCH_ERROR_MESSAGES}.
 */
export function validateSearchQuery(rawInput) {
  const query = normalizeSearchQuery(rawInput)

  if (!query) return { valid: false, reason: 'empty' }
  if (query.length > MAX_QUERY_LENGTH) return { valid: false, reason: 'tooLong' }

  const words = query.split(' ')

  if (words.length > MAX_WORDS) return { valid: false, reason: 'tooManyWords' }
  if (!ALLOWED_CHARACTERS.test(query)) return { valid: false, reason: 'invalidCharacters' }
  if (!REQUIRES_LATIN_LETTER.test(query)) return { valid: false, reason: 'noLetters' }

  // Solo se admite una palabra suelta de un carácter, y solo si es "a" o "i"
  // (las dos palabras inglesas reales de una letra). Dentro de una frase, "a"
  // sigue siendo aceptable porque funciona como artículo: no convierte el texto
  // en una consulta sin sentido.
  const hasDisallowedShortWord = words.some(
    (word) => word.length < MIN_WORD_LENGTH && !SINGLE_LETTER_ALLOWLIST.has(word.toLowerCase())
  )

  if (hasDisallowedShortWord) return { valid: false, reason: 'tooShort' }

  return { valid: true, value: query }
}