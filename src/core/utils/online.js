/**
 * Utilidad de bajo nivel para consultar la conexión sin depender de Vue/Pinia.
 * Existe para que los servicios de datos (syncService) puedan cortocircuitar
 * sin importar el store y así evitar dependencias circulares.
 */

/**
 * @function isBrowserOnline
 * @description Indica si el navegador tiene interfaz de red. Ojo: `navigator.onLine`
 * es `true` en redes Wi-Fi captive o sin salida a internet, por lo que solo sirve
 * como descartado rápido. Para confirmar internet real, use el store de red.
 * @returns {boolean}
 */
export function isBrowserOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}