import { ref, computed, onUnmounted } from 'vue'

/**
 * Margen que se le da al motor de voz para anunciar el inicio de la lectura.
 * `speak()` es asíncrono: devuelve antes de que suene nada, y la primera vez
 * puede tardar bastante más que las siguientes mientras el navegador carga la
 * lista de voces.
 */
const STARTUP_GRACE_MS = 1200

/**
 * Velocidad de lectura aproximada, en caracteres por segundo. Solo se usa para
 * estimar cuánto debería tardar el audio y tener una red de seguridad: si el
 * navegador nunca avisa de que terminó, el botón debe volver a estar usable.
 */
const CHARS_PER_SECOND = 13

const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

/**
 * @function useSpeech
 * @description Envuelve la API de síntesis de voz del navegador con un estado
 * que la interfaz puede representar. Resuelve tres cosas que el código anterior
 * dejaba sin cubrir:
 *
 * 1. **Clics repetidos.** `speak()` encola, no interrumpe, así que pulsar cinco
 *    veces seguidas hace que se lean las cinco. Aquí la segunda pulsación se
 *    ignora mientras haya una lectura en curso.
 * 2. **Botón bloqueado para siempre.** Hay navegadores que no emiten `onend`
 *    (Chromium interrumpe las lecturas largas a los ~15 s) o que emiten `onstart`
 *    con retraso. Sin vigilancia, el indicador se quedaría girando eternamente
 *    y el botón deshabilitado, que es justo la sensación de "no funciona".
 * 3. **Audio huérfano.** Al navegar a otra vista la lectura anterior seguía
 *    sonando en segundo plano; se cancela al desmontar.
 *
 * @returns {{ status: import('vue').Ref<'idle'|'loading'|'speaking'>, isBusy: import('vue').ComputedRef<boolean>, isLoading: import('vue').ComputedRef<boolean>, isSpeaking: import('vue').ComputedRef<boolean>, isSupported: boolean, isDisabled: import('vue').ComputedRef<boolean>, speechLabel: import('vue').ComputedRef<string>, speak: (text: string) => boolean, cancel: () => void }}
 */
export function useSpeech() {
  const status = ref('idle')

  // Referencia viva al utterance en curso. Chrome lo recoge si nada lo mantiene
  // referenciado y la lectura se corta a mitad.
  let activeUtterance = null
  let startupTimer = null
  let watchdogTimer = null

  const isBusy = computed(() => status.value !== 'idle')
  const isLoading = computed(() => status.value === 'loading')
  const isSpeaking = computed(() => status.value === 'speaking')

  // Un navegador sin síntesis no debe pintar un botón que no hace nada, así que
  // se marca como no utilizable en lugar de fingir que está todo bien.
  const isDisabled = computed(() => !isSupported || isBusy.value)

  const speechLabel = computed(() => {
    if (!isSupported) return 'Este navegador no admite lectura en voz alta'
    if (status.value === 'loading') return 'Preparando la lectura...'
    if (status.value === 'speaking') return 'Leyendo...'
    return ''
  })

  function clearTimers() {
    if (startupTimer) clearTimeout(startupTimer)
    if (watchdogTimer) clearTimeout(watchdogTimer)
    startupTimer = null
    watchdogTimer = null
  }

  /** Devuelve el control al usuario tanto si la lectura terminó como si se colgó. */
  function finish() {
    clearTimers()
    activeUtterance = null
    status.value = 'idle'
  }

  /**
   * @function speak
   * @description Lanza la lectura en voz alta de un texto.
   * @param {string} text - Texto a leer.
   * @returns {boolean} `false` si no se aceptó la petición, ya sea porque el
   * navegador no lo soporta, el texto está vacío o había una lectura en curso.
   */
  function speak(text) {
    if (!isSupported) return false
    if (typeof text !== 'string' || !text.trim()) return false

    // Ignorar el clic repetido en lugar de encolar otra lectura. Es lo que
    // evita que el usuario piense que el botón no responde.
    if (isBusy.value) return false

    const synth = window.speechSynthesis

    // Una cola interna atascada impide que la siguiente lectura suene. Cancelar
    // primero la deja limpia, pero solo si hay algo pendiente: en algunas
    // versiones de iOS un `cancel()` en vacío se traga el `speak()` siguiente.
    if (synth.speaking || synth.pending) synth.cancel()

    status.value = 'loading'

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'

    utterance.onstart = () => {
      status.value = 'speaking'
    }

    utterance.onend = finish
    utterance.onerror = finish

    activeUtterance = utterance

    // Si `onstart` no llega nunca, al menos se deja de mostrar la carga y se
    // pasa al estado de leyendo: el audio puede estar sonando sin que el
    // navegador lo confirme.
    startupTimer = setTimeout(() => {
      if (status.value === 'loading') status.value = 'speaking'
    }, STARTUP_GRACE_MS)

    // Red de seguridad final. `onend` no es fiable en todos los navegadores y,
    // sin este plazo, un fallo dejaría el botón inutilizable hasta recargar.
    watchdogTimer = setTimeout(finish, STARTUP_GRACE_MS + (text.length / CHARS_PER_SECOND) * 1000)

    synth.speak(utterance)

    return true
  }

  /** Corta la lectura en curso y libera el botón. */
  function cancel() {
    if (!isSupported) return

    // Desvincular los manejadores antes de cortar: `cancel()` provoca `onerror`
    // en varios navegadores, y un callback tardío podría alterar el estado de la
    // lectura siguiente, que ya habría empezado.
    if (activeUtterance) {
      activeUtterance.onstart = null
      activeUtterance.onend = null
      activeUtterance.onerror = null
    }

    finish()

    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel()
    }
  }

  // Sin esto, la voz seguiría sonando después de cambiar de vista.
  onUnmounted(cancel)

  return {
    status,
    isBusy,
    isLoading,
    isSpeaking,
    isSupported,
    isDisabled,
    speechLabel,
    speak,
    cancel
  }
}