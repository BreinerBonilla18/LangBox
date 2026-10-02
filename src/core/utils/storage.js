/**
 * Gestión del almacenamiento persistente del navegador.
 *
 * En una app offline-first, IndexedDB no está garantizado: los navegadores pueden
 * liberar el almacenamiento de un sitio si el disco del dispositivo está lleno o
 * tras cierta inactividad. Sin `persist()`, el usuario puede perder su
 * vocabulario completo sin aviso. Una vez concedido, el navegador ya no lo revoca
 * automáticamente, así que basta con pedirlo una vez por sesión.
 */

/**
 * @function requestPersistentStorage
 * @description Solicita que el navegador marque este origen como almacenamiento
 * persistente. Es una petición: puede ser denegada sin consecuencias, por lo que
 * un fallo solo se registra en consola.
 * @returns {Promise<boolean>} `true` si el almacenamiento quedó persistido.
 */
export async function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false

  try {
    if (await navigator.storage.persisted()) return true
    const granted = await navigator.storage.persist()
    if (!granted) {
      console.warn(
        'El navegador no concedió almacenamiento persistente: el vocabulario guardado podría ser descartado automáticamente.'
      )
    }
    return granted
  } catch (error) {
    console.error('Error solicitando almacenamiento persistente:', error)
    return false
  }
}