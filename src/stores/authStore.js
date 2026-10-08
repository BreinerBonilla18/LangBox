import { syncLocalWordsToCloudOnLogin } from '../core/api/syncService'
import { classifyVault, claimOrphans, removeOrphans, purgeForeignWords, clearUserLocalData, hasUserWords } from '../core/api/vaultSession'
import { supabase } from '../core/db/supabaseClient'
import { useNetworkStore } from './networkStore'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * @function useAuthStore
 * @description Store para gestionar la autenticación de usuarios y los flujos
 * de sesión sobre el vault local (Dexie). Ninguna de sus operaciones bloquea el
 * arranque de la aplicación: la sesión se lee del almacenamiento local y la red
 * solo mejora el resultado.
 * @returns {Object} - Store de autenticación
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const session = ref(null)
  const isLoading = ref(true)

  // Bandera para evitar sincronizaciones repetidas durante la misma sesión de uso
  const isWordsSynced = ref(false)

  // Mientras está activa, ninguna ruta de sincronización automática entra:
  // protege el vault hasta que el usuario resuelva el modal del Caso 1 o de logout.
  const isSyncSuspended = ref(false)

  // Modal del Caso 1: palabras huérfanas esperando decisión del usuario.
  const isVaultPromptOpen = ref(false)
  const orphanPreview = ref([])

  // Modal de confirmación de cierre de sesión.
  const isLogoutPromptOpen = ref(false)

  let vaultPromptResolver = null
  let logoutPromptResolver = null
  let sessionSyncTask = null

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
    if (isSyncSuspended.value) return

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
   * @function resolveVaultPrompt
   * @description Resuelve el modal del Caso 1 con la elegida por el usuario:
   * 'claim' vincula las huérfanas a la cuenta, 'clear' las elimina del equipo.
   * @param {string} action - 'claim' | 'clear'
   * @returns {void}
   */
  const resolveVaultPrompt = action => {
    const resolve = vaultPromptResolver
    vaultPromptResolver = null
    if (resolve) resolve(action)
  }

  /**
   * @function resolveLogoutPrompt
   * @description Resuelve el modal de logout: 'keep' conserva las palabras tal
   * como están, 'remove' limpia el dispositivo y 'cancel' aborta la salida.
   * @param {string} choice - 'keep' | 'remove' | 'cancel'
   * @returns {void}
   */
  const resolveLogoutPrompt = choice => {
    const resolve = logoutPromptResolver
    logoutPromptResolver = null
    if (resolve) resolve(choice)
  }

  /**
   * @function prepareVaultForUser
   * @description Aplica los casos del spec sobre el vault local antes de dejar
   * correr la sincronización: purga cuentas ajenas (Caso 3) y, si quedan
   * palabras sin cuenta (Caso 1), consulta al usuario antes de continuar.
   * @param {string} userId - UUID del usuario autenticado actual.
   * @returns {Promise<void>}
   */
  const prepareVaultForUser = async userId => {
    // Caso 3: purga automática de palabras de otras cuentas del mismo dispositivo.
    await purgeForeignWords(userId)

    const { orphans } = await classifyVault(userId)
    if (orphans.length === 0) return

    // Caso 1: se detiene toda sincronización hasta que el usuario decida.
    orphanPreview.value = orphans
    isVaultPromptOpen.value = true

    const action = await new Promise(resolve => {
      vaultPromptResolver = resolve
    })

    isVaultPromptOpen.value = false
    orphanPreview.value = []

    if (action === 'claim') {
      await claimOrphans(userId)
    } else if (action === 'clear') {
      await removeOrphans()
    }
    // Sin decisión no se hace nada: las huérfanas volverán a preguntarse en el próximo login.
  }

  /**
   * @function startSessionSync
   * @description Punto único de entrada de la sincronización de inicio de sesión.
   * Prepara el vault local (purga + modal del Caso 1 si hace falta) y solo
   * después deja correr la fusión bidireccional. Las llamadas duplicadas
   * (boot + evento SIGNED_IN) se unen a la misma ejecución.
   * @param {string} userId - UUID del usuario autenticado.
   * @returns {Promise<void>}
   */
  const startSessionSync = async userId => {
    if (!userId || isWordsSynced.value) return
    if (sessionSyncTask) return sessionSyncTask

    isWordsSynced.value = true
    sessionSyncTask = (async () => {
      isSyncSuspended.value = true
      try {
        await prepareVaultForUser(userId)
      } catch (error) {
        // Ante un fallo local no se sincroniza: subir el vault sin purgar
        // podría arrastrar palabras de otra cuenta a esta sesión.
        console.error('Error preparando el vault local para la sesión:', error)
        return
      } finally {
        isSyncSuspended.value = false
      }

      // La decisión del Caso 1 puede haber añadido operaciones a la cola:
      // el contador de "pendiente de subir" del Home debe reflejarlo ya.
      useNetworkStore().refreshPendingCount()

      await runCloudSync(userId)
    })()

    try {
      await sessionSyncTask
    } finally {
      sessionSyncTask = null
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
      await startSessionSync(user.value.id)
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

      // SIGNED_IN arranca la sincronización de la sesión. TOKEN_REFRESHED la
      // retoma si el arranque ocurrió offline con el token caducado: entonces
      // getSession() devolvió null y no hubo sincronización inicial, pero al
      // volver la red auth-js refresca el token sin cambiar de evento.
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !isWordsSynced.value) {
        await startSessionSync(newUser.id)
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
    // Antes de destruir la sesión se le pregunta al usuario qué hacer con las
    // palabras locales de la cuenta saliente, pero solo si tiene algo guardado:
    // sin palabras propias no hay nada que conservar ni quitar y el cierre es
    // inmediato. Mientras el modal está abierto no entra ninguna sincronización.
    if (user.value && (await hasUserWords(user.value.id))) {
      const userId = user.value.id
      isSyncSuspended.value = true
      isLogoutPromptOpen.value = true

      const choice = await new Promise(resolve => {
        logoutPromptResolver = resolve
      })

      isLogoutPromptOpen.value = false

      if (choice === 'cancel') {
        isSyncSuspended.value = false
        return
      }

      try {
        if (choice === 'remove') {
          await clearUserLocalData(userId)
        }
        // 'keep': las palabras conservan su vínculo con la cuenta y siguen
        // visibles para el modo invitado en este dispositivo.
      } catch (error) {
        console.error('Error limpiando los datos locales al cerrar sesión:', error)
      } finally {
        isSyncSuspended.value = false
        useNetworkStore().refreshPendingCount()
      }
    }

    // El borrado de la sesión local es local; la revocación del refresh token en
    // la nube es lo único que necesita red, y puede quedar pendiente sin ello.
    await supabase.auth.signOut().catch(error => {
      console.error('No se pudo revocar la sesión en la nube:', error)
    })
    user.value = null
    session.value = null
    isWordsSynced.value = false
  }

  return {
    user,
    session,
    isLoading,
    isVaultPromptOpen,
    orphanPreview,
    isLogoutPromptOpen,
    initAuth,
    loginWithGoogle,
    logout,
    runCloudSync,
    resolveVaultPrompt,
    resolveLogoutPrompt
  }
})
