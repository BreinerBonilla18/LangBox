import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../core/api/supabaseClient'
import { pullWordsFromCloud } from '../core/api/syncService'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const session = ref(null)
  const isLoading = ref(true)

  // Inicializa la sesión y escucha cambios de estado (login, logout, refresh)
  const initAuth = async () => {
    isLoading.value = true

    // Obtener sesión actual
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user || null

    if (user.value) {
      pullWordsFromCloud().catch(console.error)
    }

    // Escuchar eventos de cambio de autenticación
    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user || null

      if (newSession?.user) {
        // Al iniciar sesión, sincroniza las palabras guardadas en la nube a Dexie.js
        await pullWordsFromCloud().catch(console.error)
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