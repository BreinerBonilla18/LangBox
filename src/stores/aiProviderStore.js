import { PROVIDERS, getAvailableProviders } from '../core/api/aiService'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'langbox:aiProvider'

/**
 * @function useAiProviderStore
 * @description Fuente de verdad sobre qué proveedor de IA usa el buscador.
 * Persiste la elección del usuario y descarta de la lista a los proveedores
 * cuya clave no está configurada en `.env`.
 * @returns {Object} - Store del proveedor de IA
 */
export const useAiProviderStore = defineStore('aiProvider', () => {
  const availableProviders = getAvailableProviders()
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null

  const provider = ref(
    availableProviders.includes(stored) ? stored : availableProviders[0] || null
  )

  /**
   * @function providerName
   * @description Nombre visible del proveedor, para textos de la interfaz.
   * @param {string|null} value - 'gemini' | 'groq'
   * @returns {string}
   */
  const providerName = value => (value && PROVIDERS[value]?.label) || 'IA'

  const isGroq = computed(() => provider.value === 'groq')

  /**
   * @function setProvider
   * @description Cambia el proveedor activo y lo recuerda entre sesiones.
   * @param {string} value - 'gemini' | 'groq' | 'openrouter'
   * @returns {void}
   */
  const setProvider = value => {
    if (!availableProviders.includes(value)) return
    provider.value = value
    localStorage.setItem(STORAGE_KEY, value)
  }

  // Cadena de respaldo: los demás proveedores con clave configurada, en el
  // orden de `PROVIDERS`. La usa el buscador cuando el elegido falla.
  const fallbackProviders = computed(() =>
    availableProviders.filter(value => value !== provider.value)
  )

  const hasRedundancy = computed(() => availableProviders.length > 1)

  return {
    provider,
    availableProviders,
    fallbackProviders,
    hasRedundancy,
    providerName,
    isGroq,
    setProvider
  }
})