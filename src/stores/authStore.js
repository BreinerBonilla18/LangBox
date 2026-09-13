import { syncLocalWordsToCloudOnLogin } from '../core/api/syncService'
import { supabase } from '../core/db/supabaseClient'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * @function useAuthStore
 * @description Store para gestionar la autenticación de usuarios
 * @returns {Object} - Store de autenticación
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const session = ref(null)
  const isLoading = ref(true)

  // Bandera para evitar sincronizaciones repetidas durante la misma sesión de uso
  const isWordsSynced = ref(false)

  // Inicializa la sesión y escucha cambios de estado (login, logout, refresh)
  const initAuth = async () => {
    isLoading.value = true
    // Obtener sesión actual
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user || null

    // Sincronizar solo la primera vez que carga si hay usuario
    if (user.value && !isWordsSynced.value) {
      isWordsSynced.value = true
      syncLocalWordsToCloudOnLogin(user.value.id).catch(console.error)
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
        // Ejecuta la fusión de datos local -> nube -> local
        await syncLocalWordsToCloudOnLogin(newUser.id).catch(console.error)
      }
    })

    isLoading.value = false
  }

  // Iniciar sesión con Google OAuth
  const loginWithGoogle = async () => {
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
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    user.value = null
    session.value = null
  }

  return {
    user,
    session,
    isLoading,
    initAuth,
    loginWithGoogle,
    logout
  }
})