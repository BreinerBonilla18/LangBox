// Tiempo máximo por intento antes de abortar y pasar al siguiente modelo.
// Sin límite, una petición colgada retrasaría el fallback al otro proveedor.
const REQUEST_TIMEOUT = 30000

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash'
]
const GROQ_MODEL = 'openai/gpt-oss-120b'
// `openrouter/free` es el router de modelos gratuitos de OpenRouter: elige él
// mismo un modelo de su catálogo :free compatible con lo que pide el request
// (aquí, modo JSON).
const OPENROUTER_MODEL = 'openrouter/free'

/**
 * Proveedores de IA disponibles. Todos hablan el protocolo `/chat/completions`
 * compatible con OpenAI, así que comparten el mismo formato de petición.
 */
export const PROVIDERS = {
  gemini: {
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: GEMINI_MODELS,
    getApiKey: () => import.meta.env.VITE_GEMINI_API_KEY
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [GROQ_MODEL],
    getApiKey: () => import.meta.env.VITE_GROQ_API_KEY
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [OPENROUTER_MODEL],
    getApiKey: () => import.meta.env.VITE_OPENROUTER_API_KEY
  }
}

/**
 * @function getAvailableProviders
 * @description Devuelve la lista de proveedores cuya clave está configurada en
 * `.env`. Un proveedor sin clave no puede atenderse y se descarta del selector.
 * @returns {string[]}
 */
export function getAvailableProviders() {
  return Object.keys(PROVIDERS).filter(provider => PROVIDERS[provider].getApiKey())
}

/**
 * @function getFallbackProviders
 * @description Devuelve los proveedores que pueden hacer de plan B cuando el
 * elegido se cae por saturación o error, en orden de prioridad de config.
 * @param {string} provider - 'gemini' | 'groq' | 'openrouter'
 * @returns {string[]}
 */
export function getFallbackProviders(provider) {
  return Object.keys(PROVIDERS).filter(key => key !== provider)
}

/**
 * @function buildStrictPrompt
 * @description Construye el prompt del lexicógrafo pidiendo JSON puro.
 * @param {string} word - La palabra a enriquecer
 * @returns {string}
 */
function buildStrictPrompt(word) {
  return `
    You are an expert lexicographer and AI assistant for BoxLang, a language learning app.
    Analyze the English word: "${word}".

    Return a JSON object that supports multiple meanings/senses if the word is polysemous (has multiple distinct meanings or grammatical roles like noun, verb, adjective).
    If the word has only one common meaning, return just 1 item in the "meanings" array.

    Strictly adhere to this JSON structure:
    {
      "word": "${word}",
      "phonetic": "IPA phonetic transcription (e.g. /ræʃ/)",
      "meanings": [
        {
          "part_of_speech": "noun | verb | adjective | adverb | etc.",
          "definition_es": "Clear and concise definition in Spanish for this specific sense",
          "example_en": "A natural B2-level English example sentence illustrating this specific sense",
          "example_es": "Spanish translation of the example sentence"
        }
      ],
      "mnemonics": [
        "A memorable association, visual connection, or trick in Spanish to remember the word or its different meanings"
      ],
      "synonyms": ["synonym1", "synonym2", "synonym3"]
    }

    Rules:
    1. "meanings" must be an array of 1 to 3 of the most relevant/common senses.
    2. "mnemonics" must be an array of string(s) with helpful memory hooks in Spanish.
    3. Return ONLY valid raw JSON without Markdown backticks.
  `
}

/**
 * @function requestChatCompletions
 * @description Un solo intento contra un modelo del proveedor. Aborta si supera
 * el tiempo máximo para no bloquear la cadena de reintentos.
 * @param {Object} config - Config del proveedor de `PROVIDERS`
 * @param {string} model - Modelo a consultar
 * @param {string} prompt - Prompt construido
 * @returns {Promise<Object>} - JSON de la palabra enriquecida
 */
async function requestChatCompletions(config, model, prompt) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.getApiKey()}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You only answer with valid JSON objects.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    })

    if (response.ok) {
      const data = await response.json()
      const rawText = data.choices?.[0]?.message?.content
      if (!rawText) {
        throw new Error(`${config.label} devolvió una respuesta vacía`)
      }
      return JSON.parse(rawText)
    }

    const errorJson = await response.json().catch(() => ({}))
    throw new Error(`Error ${response.status}: ${errorJson.error?.message || 'Servidor no disponible'}`)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @function enrichWordWithAI
 * @description Enriquece una palabra consultando al proveedor indicado. Si un
 * modelo falla (por saturación, `429`, `503` o red), el loop probó los demás antes de
 * rendirse. No elige el proveedor por sí mismo: eso lo hace la capa de vista.
 * @param {string} word - La palabra a enriquecer
 * @param {string} provider - 'gemini' | 'groq'
 * @returns {Promise<Object>} - Los datos de la palabra enriquecida
 */
export async function enrichWordWithAI(word, provider) {
  const config = PROVIDERS[provider]

  if (!config) {
    throw new Error(`Proveedor de IA desconocido: ${provider}`)
  }

  if (!config.getApiKey()) {
    throw new Error(`Falta la API Key de ${config.label} en .env`)
  }

  const prompt = buildStrictPrompt(word)
  let lastError = null

  for (const model of config.models) {
    try {
      return await requestChatCompletions(config, model, prompt)
    } catch (err) {
      console.warn(`[${config.label} API] Falló el modelo ${model}:`, err)
      lastError = err
    }
  }

  throw lastError || new Error(`No se pudo conectar con ningún modelo de ${config.label}.`)
}