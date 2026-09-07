import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../core/api/supabaseClient'
import { pullWordsFromCloud, syncLocalWordsToCloudOnLogin } from '../core/api/syncService'

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
      pullWordsFromCloud().catch(console.error)
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

  // Iniciar sesión con Email y Contraseña
  const loginWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error
    return data
  }

  // Registrar usuario con Email y Contraseña
  const signUpWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    if (error) throw error
    return data
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
    loginWithEmail,
    signUpWithEmail,
    logout
  }
})