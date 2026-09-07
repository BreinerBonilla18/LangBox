<script setup>
import { Search, Book, Brain, LogOut } from '@lucide/vue'
import langboxLogo from '../assets/langbox.svg'
import { useRouter } from 'vue-router'
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { pullWordsFromCloud } from '../core/api/syncService'

const router = useRouter()
const authStore = useAuthStore()

const searchQuery = ref('')
const isSyncing = ref(false)

const syncData = async () => {
  if (!authStore.user || isSyncing.value) return
  try {
    isSyncing.value = true
    await pullWordsFromCloud()
  } catch (error) {
    console.error('Error sincronizando al inicio:', error)
  } finally {
    isSyncing.value = false
  }
}

// Ejecutar si el usuario entra a la vista y ya tiene sesión activa
onMounted(() => {
  if (authStore.user) {
    syncData()
  }
})

// Ejecutar de forma reactiva si el estado de auth cambia (p. ej. post-login)
watch(
  () => authStore.user,
  (newUser) => {
    if (newUser) {
      syncData()
    }
  }
)

const handleSearch = () => {
  const query = searchQuery.value.trim()
  if (!query) return

  router.push({ name: 'search', params: { word: query } })
}

const goToVocabulary = () => {
  router.push('/vocabulary')
}

const goToFlashcards = () => {
  router.push('/flashcards')
}

const handleGoogleLogin = async () => {
  try {
    await authStore.loginWithGoogle()
  } catch (error) {
    console.error('Error al iniciar sesión:', error)
  }
}

const handleLogout = async () => {
  try {
    await authStore.logout()
  } catch (error) {
    console.error('Error al cerrar sesión:', error)
  }
}

const cards = [
  {
    title: 'Vocabulario',
    description: 'Ver tus palabras guardadas',
    icon: Book,
    onClick: goToVocabulary
  },
  {
    title: 'Tarjetas',
    description: 'Practica con tarjetas interactivas',
    icon: Brain,
    onClick: goToFlashcards
  }
]
</script>

<template>
  <div class="relative flex flex-col items-center justify-center px-4 min-h-screen">
    
    <!-- Widget de Autenticación en la esquina superior derecha -->
    <header class="absolute top-4 right-4 z-10">
      
      <!-- Loader mientras verifica sesión -->
      <div v-if="authStore.isLoading" class="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs text-zinc-400">
        <div class="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Cargando...</span>
      </div>

      <!-- Estado Autenticado -->
      <div v-else-if="authStore.user" class="flex items-center gap-3 bg-zinc-900/90 border border-zinc-800 p-1.5 pl-3 rounded-xl shadow-lg">
        <div class="flex items-center gap-2">
          <!-- Avatar de Google o Inicial -->
          <img 
            v-if="authStore.user.user_metadata?.avatar_url" 
            :src="authStore.user.user_metadata.avatar_url" 
            alt="User Avatar" 
            class="w-7 h-7 rounded-lg object-cover"
          />
          <div v-else class="w-7 h-7 bg-indigo-500/20 text-indigo-400 font-bold text-xs rounded-lg flex items-center justify-center">
            {{ (authStore.user.email || 'U')[0].toUpperCase() }}
          </div>

          <div class="flex flex-col text-left pr-1">
            <span class="text-xs font-medium text-slate-200 leading-tight max-w-[120px] sm:max-w-[160px] truncate">
              {{ authStore.user.user_metadata?.full_name || authStore.user.email }}
            </span>
            
            <!-- Indicador dinámico de sincronización -->
            <span v-if="isSyncing" class="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span> Sincronizando...
            </span>
            <span v-else class="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Sincronizado
            </span>
          </div>
        </div>

        <button 
          @click="handleLogout"
          title="Cerrar Sesión"
          class="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-rose-400 p-2 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>

      <!-- Estado No Autenticado (Botón Login con Google) -->
      <button 
        v-else 
        @click="handleGoogleLogin"
        class="flex items-center gap-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-slate-200 text-xs font-medium px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer hover:border-indigo-500/40"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Entrar con Google</span>
      </button>

    </header>

    <!-- Logo & Title -->
    <div class="text-6xl flex flex-row items-center gap-3 mb-8">
      <div class="w-16 h-16"><img :src="langboxLogo" alt="LangBox Logo" /></div>
      <h1 class="text-slate-50 tracking-widest"><span class="text-indigo-500">Lang</span>Box</h1>
    </div>

    <!-- Search Input -->
    <div class="w-full max-w-2xl mb-8">
      <div class="relative flex gap-2">
        <Search class="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" />

        <input 
          v-model="searchQuery" 
          @keyup.enter="handleSearch" 
          type="text" 
          placeholder="Escribe una palabra..."
          class="w-full py-4 pl-12 pr-4 bg-zinc-900 border border-zinc-800 rounded-xl text-slate-50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-500" 
        />

        <button 
          @click="handleSearch"
          class="bg-indigo-500 text-white px-4 py-2 rounded-xl cursor-pointer hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20"
        >
          Buscar
        </button>
      </div>
    </div>

    <!-- Cards -->
    <div class="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
      <div 
        v-for="card in cards" 
        :key="card.title"
        class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-indigo-500/50 transition-all cursor-pointer group"
        @click="card.onClick"
      >
        <div class="flex items-center gap-4 mb-3">
          <div class="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/30 transition-all">
            <component :is="card.icon" class="text-indigo-500 w-6 h-6" />
          </div>
          <h2 class="text-xl font-semibold text-slate-50">{{ card.title }}</h2>
        </div>
        <p class="text-zinc-400 text-sm">{{ card.description }}</p>
      </div>
    </div>

  </div>
</template>