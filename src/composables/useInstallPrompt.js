import { ref, computed } from 'vue'

// Estado compartido a nivel de módulo: el evento `beforeinstallprompt` solo se
// dispara una vez por visita y desde `main.js`, así que capturarlo en el
// componente que lo pinta podría perderlo si ese componente no estaba montado.
const deferredPrompt = ref(null)
const isInstalled = ref(false)
const isIOS = ref(false)

let listenersRegistered = false

// iOS Safari no implementa `beforeinstallprompt`: la única forma de instalar es
// "Compartir -> Añadir a pantalla de inicio", así que ahí se guía con instrucciones.
function detectIOS() {
  if (typeof navigator === 'undefined') return false
  const isIosDevice = /iP(hone|ad|od)/.test(navigator.userAgent)
  const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
  return isIosDevice && isSafari
}

// `display-mode: standalone` cubre Chrome/Android y PWA en escritorio;
// `navigator.standalone` es el equivalente histórico en iOS.
function detectStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches === true ||
    window.navigator.standalone === true
  )
}

// La app puede pasar a standalone sin disparar `appinstalled`: al instalar desde
// el menú del navegador se abre en su propia ventana y este documento nunca se
// vuelve a Visible. El propio `display-mode` es el aviso, si se le escucha.
function watchDisplayMode() {
  if (typeof window === 'undefined' || !window.matchMedia) return

  for (const query of ['(display-mode: standalone)', '(display-mode: fullscreen)']) {
    window.matchMedia(query).addEventListener('change', () => {
      isInstalled.value = detectStandalone()
    })
  }
}

/**
 * @function registerInstallListeners
 * @description Registra los eventos de instalación una única vez a nivel de
 * módulo. Se invoca desde `main.js` para que la oportunidad de instalar no
 * dependa de qué ruta se cargue primero ni de si HomeView llegó a montarse.
 * @returns {void}
 */
function registerInstallListeners() {
  if (listenersRegistered || typeof window === 'undefined') return
  listenersRegistered = true

  window.addEventListener('beforeinstallprompt', event => {
    // Sin preventDefault, Chrome muestra su propia barra y la nuestra compite.
    event.preventDefault()
    deferredPrompt.value = event
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    isInstalled.value = true
  })

  // Al volver a la pestaña tras instalar, el modo de visualización ya cambia.
  // Es la única señal fiable en navegadores que no disparan `appinstalled`.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      isInstalled.value = detectStandalone()
    }
  })

  watchDisplayMode()

  isIOS.value = detectIOS()
  isInstalled.value = detectStandalone()
}

/**
 * @function initInstallPrompt
 * @description Punto de entrada para enganchar los eventos antes de que se
 * monte la aplicación. Es idempotente: `useInstallPrompt` puede invocarlo
 * también sin duplicar ningún listener.
 * @returns {void}
 */
export function initInstallPrompt() {
  registerInstallListeners()
}

/**
 * @function useInstallPrompt
 * @description Expone el estado de instalación de la PWA y el disparador del
 * diálogo nativo "Instalar app".
 * @returns {Object}
 */
export function useInstallPrompt() {
  registerInstallListeners()

  isIOS.value = isIOS.value || detectIOS()
  isInstalled.value = isInstalled.value || detectStandalone()

  const canPrompt = computed(() => deferredPrompt.value !== null)

  // `canPrompt` es falso en iOS aunque la app se pueda instalar a mano: allí se
  // muestran instrucciones en lugar de un botón que no haría nada.
  const needsManualInstall = computed(
    () => !isInstalled.value && !canPrompt.value && isIOS.value
  )

  // Chromium recuerda que esta app se instaló alguna vez y deja de emitir
  // `beforeinstallprompt` aunque el usuario la haya desinstalado. El evento se
  // puede dar por perdido para siempre, así que el botón se mantiene visible y
  // cae en el menú del propio navegador ("⋮ -> Instalar aplicación"), que sigue
  // funcionando y además es un único clic.
  const needsBrowserMenu = computed(
    () => !isInstalled.value && !canPrompt.value && !isIOS.value
  )

  /**
   * @function promptInstall
   * @description Lanza el diálogo nativo de instalación del navegador.
   * @returns {Promise<'accepted'|'dismissed'|'unavailable'>}
   */
  async function promptInstall() {
    if (!deferredPrompt.value) return 'unavailable'

    await deferredPrompt.value.prompt()
    const choice = await deferredPrompt.value.userChoice

    // El evento solo se emite una vez: si el usuario lo descarta se limpia, para
    // no reabrir un diálogo que el navegador ya da por cerrado. El botón no
    // desaparece por ello, pasa a la vía manual.
    deferredPrompt.value = null
    if (choice.outcome === 'accepted') isInstalled.value = true

    return choice.outcome
  }

  return {
    isInstalled,
    isIOS,
    canPrompt,
    needsManualInstall,
    needsBrowserMenu,
    promptInstall
  }
}