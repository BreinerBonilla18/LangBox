// Lista de modelos ordenados por preferencia para fallback automático
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash'
]

export async function enrichWordWithGemini(word) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('Falta la API Key de Gemini en .env.local')
  }

  const prompt = `
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

  let lastError = null

  // Intentamos con cada modelo de la lista en orden hasta que uno responda exitosamente
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
        return JSON.parse(rawText)
      }

      // Si devuelve 503 u otro error de servidor, registramos el aviso e intentamos el siguiente modelo
      const errorJson = await response.json().catch(() => ({}))
      console.warn(`[Gemini API] Falló el modelo ${model} con status ${response.status}:`, errorJson)
      lastError = new Error(`Error ${response.status}: ${errorJson.error?.message || 'Servidor no disponible'}`)

    } catch (err) {
      console.warn(`[Gemini API] Error de red probando con ${model}:`, err)
      lastError = err
    }
  }

  // Si todos los modelos de la lista fallaron
  throw lastError || new Error('No se pudo conectar con ningún modelo de Gemini disponible.')
}