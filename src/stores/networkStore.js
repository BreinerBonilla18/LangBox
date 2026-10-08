import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../core/db/database'

// Tiempo máximo que esperamos a la sonda antes de darla por fallida.
const PROBE_TIMEOUT = 5000

// Cada cuánto se revalida internet cuando la app sigue en primer plano.
// `navigator.onLine` puede seguir dando `true` mucho después de caerse internet.
const PROBE_INTERVAL = 30000

// Mínimo real entre sondas automáticas. El intervalo y el `visibilitychange`
// de enfocar la pestaña se solapan: sin este margen, cambiar de ventana
// disparaba una llamada idéntica a la que acababa de hacerse.
const PROBE_MIN_GAP = 15000

/**
 * @function probeInternet
 * @description Comprueba de verdad que hay salida a internet. `navigator.onLine`
 * solo indica que existe interfaz de red, y da `true` en redes Wi-Fi captive o
 * sin DNS. La sonda usa el endpoint de salud de Supabase con el `apikey` público
 * y trata CUALQUIER respuesta recibida —incluidas 4xx/5xx— como prueba de que
 * la red funciona: lo que interesa es que hubo conectividad.
 * @returns {Promise<boolean>}
 */
async function probeInternet() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) return true // Sin destino de sonda, no hay nada que comprobar.

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT)

  try {
    await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      cache: 'no-store',
      // Sin la cabecera `apikey` la pasarela responde 401 y el navegador deja
      // un error en consola por cada sonda; con ella responde 200 (JSON de versión).
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '' },
      signal: controller.signal
    })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @function useNetworkStore
 * @description Fuente de verdad única sobre la conectividad de la aplicación.
 * La consumen el aviso global, la desactivación del buscador, el bloqueo del
 * login OAuth y la sincronización diferida.
 * @returns {Object}
 */
export const useNetworkStore = defineStore('network', () => {
  // `navigator.onLine` como punto de partida para que el primer render sea correcto.
  const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  const isVerifying = ref(false)
  const isSyncing = ref(false)
  const lastSyncedAt = ref(null)
  const pendingCount = ref(0)

  // Marca de que Veníamos de una desconexión: dispara el aviso de "reconectado".
  const justReconnected = ref(false)

  // Suscriptores que se ejecutan al recuperar la conexión (p. ej. vaciar la cola).
  const reconnectHandlers = new Set()
  let probeTimer = null

  // Sonda en vuelco y marca de la última: evitan llamadas duplicadas cuando
  // el intervalo, el foco de ventana y el evento `online` coinciden.
  let probePromise = null
  let lastProbeAt = 0

  /**
   * @function hasPendingSync
   * @description Indica que hay cambios locales aún no subidos a la nube.
   * @returns {import('vue').ComputedRef<boolean>}
   */
  const hasPendingSync = computed(() => pendingCount.value > 0)

  /**
   * @function refreshPendingCount
   * @description Recalcula cuántas operaciones quedaron en la cola offline.
   * @returns {Promise<void>}
   */
  async function refreshPendingCount() {
    try {
      pendingCount.value = await db.pendingOps.count()
    } catch (error) {
      console.error('Error contando operaciones pendientes:', error)
    }
  }

  /**
   * @function applyOnlineState
   * @description Fija el estado de conexión y dispara los avisos y el vaciado
   * de la cola pendientes. Centraliza las transiciones para que ninguna otra
   * parte tenga que emitirlas.
   * @param {boolean} value
   * @returns {void}
   */
  function applyOnlineState(value) {
    const wasOffline = isOnline.value === false

    isOnline.value = value

    if (!value || !wasOffline) return

    // Pasamos de offline a online: hay trabajo pendiente y hay que avisar.
    justReconnected.value = true
    setTimeout(() => {
      justReconnected.value = false
    }, 3500)

    reconnectHandlers.forEach(handler => {
      try {
        handler()
      } catch (error) {
        console.error('Error en un suscriptor de reconexión:', error)
      }
    })
  }

  /**
   * @function verify
   * @description Reevalúa la conexión real. Solo se lanza la sonda si el
   * navegador reporta interfaz de red; si dice que no hay red, la respuesta es
   * definitivamente offline.
   * @returns {Promise<boolean>}
   */
  async function verify() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      applyOnlineState(false)
      return false
    }

    // Si ya hay una sonda en vuelco se reutiliza en lugar de lanzar otra:
    // `online` + intervalo + foco pueden solaparse y duplicar la llamada.
    if (probePromise) return probePromise

    isVerifying.value = true
    lastProbeAt = Date.now()
    probePromise = (async () => {
      const reachable = await probeInternet()
      applyOnlineState(reachable)
      return reachable
    })()

    try {
      return await probePromise
    } finally {
      probePromise = null
      isVerifying.value = false
    }
  }

  /**
   * @function scheduleProbes
   * @description Programa la revalidación periódica mientras la app está abierta.
   * @returns {void}
   */
  function scheduleProbes() {
    if (typeof window === 'undefined' || probeTimer !== null) return

    const tick = () => {
      // Solo sondeamos si la app tiene el foco: en segundo plano no gastamos red.
      if (document.visibilityState !== 'visible' || isSyncing.value) return
      // Enfocar la pestaña no debe re-sondear si acabamos de hacerlo: con el
      // margen mínimo, una ráfaga de cambios de ventana produce una sola llamada.
      if (Date.now() - lastProbeAt < PROBE_MIN_GAP) return
      verify()
    }

    probeTimer = setInterval(tick, PROBE_INTERVAL)
    document.addEventListener('visibilitychange', tick)
  }

  /**
   * @function init
   * @description Arranca el seguimiento de la conexión. Debe ejecutarse antes
   * del montaje de la app para que el primer render ya refleje el estado real.
   * @returns {void}
   */
  function init() {
    if (typeof window === 'undefined') return

    // `online` / `offline` cubren el cambio brusco (perder el Wi-Fi).
    window.addEventListener('offline', () => applyOnlineState(false))
    window.addEventListener('online', () => verify())

    refreshPendingCount()
    scheduleProbes()

    // Confirmación inicial con una sonda real: puede descubrir que hay
    // interfaz de red pero no internet (captive portal, VPN caída, airplane mode).
    verify()
  }

  /**
   * @function onReconnect
   * @description Registra un callback que se ejecuta cada vez que se recupera la
   * conexión. Lo usa la sincronización para vaciar la cola offline.
   * @param {Function} handler
   * @returns {Function} Función para cancelar la suscripción.
   */
  function onReconnect(handler) {
    reconnectHandlers.add(handler)
    return () => reconnectHandlers.delete(handler)
  }

  /**
   * @function setSyncing
   * @description Marca la sincronización en curso, para que las sondas
   * periódicas no la pisen y la interfaz pueda mostrar el progreso.
   * @param {boolean} value
   * @returns {void}
   */
  function setSyncing(value) {
    isSyncing.value = value
    if (!value) refreshPendingCount()
  }

  return {
    isOnline,
    isVerifying,
    isSyncing,
    lastSyncedAt,
    pendingCount,
    hasPendingSync,
    justReconnected,
    init,
    verify,
    onReconnect,
    setSyncing,
    refreshPendingCount
  }
})