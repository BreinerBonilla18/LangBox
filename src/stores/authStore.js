import { syncLocalWordsToCloudOnLogin } from '../core/api/syncService'
import { supabase } from '../core/db/supabaseClient'
import { useNetworkStore } from './networkStore'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * @function useAuthStore
 * @description Store para gestionar la autenticación de usuarios.
 * Ninguna de sus operaciones bloquea el arranque de la aplicación: la sesión se
 * lee del almacenamiento local y la red solo mejora el resultado.
 * @returns {Object} - Store de autenticación
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const session = ref(null)
  const isLoading = ref(true)

  // Bandera para evitar sincronizaciones repetidas durante la misma sesión de uso
  const isWordsSynced = ref(false)

  /**
   * @function runCloudSync
   * @description Ejecuta la fusión nube -> local y el vaciado de la cola offline,
   * reflejando el progreso en el store de red. Ante cualquier fallo se registra
   * y se abandona: el vault local es la fuente de verdad de la sesión offline.
   * @param {string} userId
   * @returns {Promise<void>}
   */
  const runCloudSync = async userId => {
    if (!userId) return

    const networkStore = useNetworkStore()

    if (!networkStore.isOnline) return

    networkStore.setSyncing(true)
    try {
      await syncLocalWordsToCloudOnLogin(userId)
      networkStore.lastSyncedAt = new Date()
    } catch (error) {
      console.error('Error en la sincronización de palabras con la nube:', error)
    } finally {
      networkStore.setSyncing(false)
    }
  }

  /**
   * @function initAuth
   * @description Restaura la sesión y engancha la sincronización con la red.
   * @returns {Promise<void>}
   */
  const initAuth = async () => {
    isLoading.value = true
    const networkStore = useNetworkStore()

    // Cuando vuelve la conexión hay que subir lo acumulado. Este es el único
    // punto que cablea la reconexión con la cola, para que el store de red no
    // tenga que depender del servicio de sincronización.
    networkStore.onReconnect(() => {
      if (user.value) runCloudSync(user.value.id)
    })

    // Obtener sesión actual. Supabase la resuelve desde el almacenamiento local,
    // por lo que no requiere red; un token caducado no dispara red aquí.
    const { data } = await supabase.auth.getSession().catch(error => {
      console.error('No se pudo leer la sesión guardada:', error)
      return { data: { session: null } }
    })

    session.value = data.session
    user.value = data.session?.user || null

    // Sincronizar solo la primera vez que carga si hay usuario. Se hace en
    // segundo plano: el SRS local ya está en IndexedDB y la app no depende de
    // esta llamada para funcionar.
    if (user.value && !isWordsSynced.value) {
      isWordsSynced.value = true
      await runCloudSync(user.value.id)
    }

    // Escuchar cambios de autenticación
    supabase.auth.onAuthStateChange(async (event, newSession) => {
      const newUser = newSession?.user || null
      session.value = newSession
      user.value = newUser

      if (!newUser) {
        // Si el usuario cierra sesión, reseteamos la bandera
        isWordsSynced.value = false
        return
      }

      // Si se dispara SIGNED_IN pero ya sincronizamos este usuario en esta sesión, lo ignoramos
      if (event === 'SIGNED_IN' && !isWordsSynced.value) {
        isWordsSynced.value = true
        await runCloudSync(newUser.id)
      }
    })

    isLoading.value = false
  }

  // Iniciar sesión con Google OAuth
  const loginWithGoogle = async () => {
    // El flujo OAuth es una redirección del navegador: sin red simplemente
    // dejaría al usuario en una pantalla de carga eterna.
    if (!useNetworkStore().isOnline) {
      throw new Error('Sin conexión a internet. Necesitas estar en línea para iniciar sesión.')
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) throw error
  }

  // Cerrar Sesión
  const logout = async () => {
    // El borrado de la sesión local es local; la revocación del refresh token en
    // la nube es lo único que necesita red, y puede quedar pendiente sin ello.
    await supabase.auth.signOut().catch(error => {
      console.error('No se pudo revocar la sesión en la nube:', error)
    })
    user.value = null
    session.value = null
  }

  return {
    user,
    session,
    isLoading,
    initAuth,
    loginWithGoogle,
    logout,
    runCloudSync
  }
})