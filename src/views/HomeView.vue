<script setup>
import { Search, Book, Brain, LogOut, Download, Share } from '@lucide/vue'
import { useAuthStore } from '../stores/authStore'
import { useNetworkStore } from '../stores/networkStore'
import { useInstallPrompt } from '../composables/useInstallPrompt'
import {
  MAX_QUERY_LENGTH,
  SEARCH_ERROR_MESSAGES,
  validateSearchQuery
} from '../core/utils/searchValidation'
import langboxLogo from '../assets/langbox.svg'
import googleIcon from '../assets/google.svg'
import { useRouter } from 'vue-router'
import { ref, computed, watch } from 'vue'

const authStore = useAuthStore()
const networkStore = useNetworkStore()
const { isInstalled, canPrompt, needsManualInstall, promptInstall } = useInstallPrompt()
const router = useRouter()

const searchQuery = ref('')
const showIosHelp = ref(false)

// Motivo por el que la última consulta fue rechazada, o `null` si es válida.
// Se guarda la clave del motivo, no el texto, para poder traducirlo desde el
// mapa del validador sin duplicar los textos en la plantilla.
const searchError = ref(null)

const searchErrorMessage = computed(() =>
  searchError.value ? SEARCH_ERROR_MESSAGES[searchError.value] : ''
)

// El buscador consulta la IA de Gemini, así que es la única función que
// depende de internet. Sin conexión se desactiva en lugar de fallar.
const searchDisabled = computed(() => !networkStore.isOnline)

const searchPlaceholder = computed(() =>
  searchDisabled.value ? 'Requiere conexión a internet...' : 'Escribe una palabra...'
)

// Estado real de la nube, en lugar del texto fijo "Sincronizado" que antes mentía.
const syncLabel = computed(() => {
  if (!networkStore.isOnline) return 'Sin conexión'
  if (networkStore.isSyncing) return 'Sincronizando...'
  if (networkStore.hasPendingSync) return 'Pendiente de subir'
  return 'Sincronizado'
})

const syncDotClass = computed(() => {
  if (!networkStore.isOnline) return 'bg-amber-400'
  if (networkStore.isSyncing || networkStore.hasPendingSync) return 'bg-amber-400'
  return 'bg-emerald-400'
})

// Llevar al usuario a la página de búsqueda cuando se realiza una búsqueda
const handleSearch = () => {
  // Guarda de seguridad: aunque el input esté deshabilitado, la tecla `Enter` o
  // un envío del formulario no deberían lanzar una consulta que va a fallar.
  if (searchDisabled.value) return

  // Cada consulta dispara una llamada a la IA, así que se descarta antes lo que
  // no puede devolver un resultado útil: oraciones largas, símbolos, emojis o
  // textos en otro idioma. Las expresiones y los idioms sí se permiten, por eso
  // el validador admite varias palabras en lugar de exigir una sola.
  const { valid, value, reason } = validateSearchQuery(searchQuery.value)

  if (!valid) {
    searchError.value = reason
    return
  }

  searchError.value = null

  const capitalizedQuery = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

  router.push({ name: 'search', params: { word: capitalizedQuery } })
}

// El aviso de error pertenece a la consulta que lo originó: en cuanto se edita,
// sigue siendo incorrecta y no hay motivo para alarmar otra vez.
watch(searchQuery, () => {
  searchError.value = null
})

const goToVocabulary = () => router.push('/vocabulary')
const goToFlashcards = () => router.push('/flashcards')

// Manejar inicio de sesión con Google
const handleGoogleLogin = async () => {
  if (!networkStore.isOnline) return

  try {
    await authStore.loginWithGoogle()
  } catch (error) {
    console.error('Error al iniciar sesión:', error)
  }
}

// Manejar cierre de sesión
const handleLogout = async () => {
  try {
    await authStore.logout()
  } catch (error) {
    console.error('Error al cerrar sesión:', error)
  }
}

// Instalar exige conexión: el diálogo del navegador solo se ofrece con el
// service worker registrado, y sin red no habría nada que instalar. Tampoco
// tiene sentido ofrecérselo a quien ya la tiene.
const showInstall = computed(
  () => networkStore.isOnline && !isInstalled.value && (canPrompt.value || needsManualInstall.value)
)

// iOS no ofrece diálogo de instalación, así que el botón abre las
// instrucciones en lugar de lanzar un diálogo que no existe.
const handleInstall = async () => {
  const outcome = await promptInstall()
  if (outcome === 'unavailable') showIosHelp.value = true
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

    <!-- Card de Autenticación en la esquina superior derecha -->
    <header class="absolute top-4 right-4 z-10">

      <!-- Loader mientras verifica sesión -->
      <div v-if="authStore.isLoading"
        class="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs text-zinc-400">
        <div class="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Cargando...</span>
      </div>

      <!-- Estado Autenticado -->
      <div v-else-if="authStore.user"
        class="flex items-center gap-3 bg-zinc-900/90 border border-zinc-800 p-1.5 pl-3 rounded-xl shadow-lg">
        <div class="flex items-center gap-2">
          <!-- Avatar de Google o Inicial -->
          <img v-if="authStore.user.user_metadata?.avatar_url && !imageError"
            :src="authStore.user.user_metadata.avatar_url" alt="User Avatar" referrerpolicy="no-referrer"
            @error="imageError = true" class="w-7 h-7 rounded-lg object-cover" />
          <div v-else
            class="w-7 h-7 bg-indigo-500/20 text-indigo-400 font-bold text-xs rounded-lg flex items-center justify-center">
            {{ (authStore.user.email || 'U')[0].toUpperCase() }}
          </div>

          <div class="flex flex-col text-left pr-1">
            <span class="text-xs font-medium text-slate-200 leading-tight max-w-30 sm:max-w-40 truncate">
              {{ authStore.user.user_metadata?.full_name || authStore.user.email }}
            </span>

            <span class="text-[10px] flex items-center gap-1" :class="networkStore.isOnline ? 'text-emerald-400' : 'text-amber-400'">
              <span class="w-1.5 h-1.5 rounded-full" :class="syncDotClass"></span> {{ syncLabel }}
            </span>
          </div>
        </div>

        <button @click="handleLogout" title="Cerrar Sesión"
          class="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-rose-400 p-2 rounded-lg transition-colors cursor-pointer">
          <LogOut class="w-4 h-4" />
        </button>
      </div>

      <!-- Estado No Autenticado (Botón Login con Google) -->
      <button v-else @click="handleGoogleLogin" :disabled="!networkStore.isOnline"
        :title="networkStore.isOnline ? 'Iniciar sesión con Google' : 'Iniciar sesión requiere conexión a internet'"
        class="flex items-center gap-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-slate-200 text-xs font-medium px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer hover:border-indigo-500/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-900 disabled:hover:border-zinc-800">
        <img :src="googleIcon" alt="Google" class="w-4 h-4" />
        <span>Entrar con Google</span>
      </button>

    </header>

    <!-- Logo y Título -->
    <div
      class="text-4xl mt-18 md:mt-0 sm:text-5xl md:text-6xl flex flex-col md:flex-row items-center gap-2 sm:gap-3 mb-6 md:mb-8">
      <div class="w-12 h-12 sm:w-16 sm:mb-0 md:h-16"><img :src="langboxLogo" alt="LangBox Logo" /></div>
      <h1 class="text-slate-50 tracking-widest"><span class="text-indigo-500">Lang</span>Box</h1>
    </div>

    <!-- Barra de búsqueda -->
    <div class="w-full max-w-2xl mb-3">
      <div class="relative flex gap-2">
        <Search
          class="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4 sm:w-5 sm:h-5" />

        <input v-model="searchQuery" @keyup.enter="handleSearch" type="text"
          :placeholder="searchPlaceholder" :disabled="searchDisabled"
          :maxlength="MAX_QUERY_LENGTH" :aria-invalid="!!searchError"
          :aria-describedby="searchError ? 'search-error' : undefined"
          class="w-full py-3 sm:py-4 pl-10 sm:pl-12 pr-3 sm:pr-4 bg-zinc-900 border rounded-xl text-sm sm:text-base text-slate-50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
          :class="searchError ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20' : 'border-zinc-800'" />

        <button @click="handleSearch" :disabled="searchDisabled"
          class="bg-indigo-500 text-white px-3 sm:px-4 py-2 rounded-xl cursor-pointer hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20 text-sm sm:text-base whitespace-nowrap disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:bg-zinc-800">
          Buscar
        </button>
      </div>

      <!-- Aviso explícito de por qué el buscador no responde -->
      <p v-if="searchDisabled" class="mt-2 text-xs text-amber-400/90 text-center sm:text-left">
        El buscador usa IA en la nube, así que necesita conexión. Tu vocabulario y tus tarjetas funcionan sin internet.
      </p>

      <!-- Motivo por el que la consulta se ha descartado sin gastar una llamada -->
      <p v-else-if="searchError" id="search-error" role="alert"
        class="mt-2 text-xs text-rose-400/90 text-center sm:text-left">
        {{ searchErrorMessage }}
      </p>
    </div>

    <!-- Cards -->
    <div class="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-8 md:mb-0">
      <div v-for="card in cards" :key="card.title"
        class="bg-zinc-900 border border-zinc-800 rounded-xl p-5 sm:p-6 hover:border-indigo-500/50 transition-all cursor-pointer group"
        @click="card.onClick">
        <div class="flex items-center gap-3 sm:gap-4 mb-3">
          <div
            class="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/30 transition-all">
            <component :is="card.icon" class="text-indigo-500 w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h2 class="text-lg sm:text-xl font-semibold text-slate-50">{{ card.title }}</h2>
        </div>
        <p class="text-zinc-400 text-xs sm:text-sm">{{ card.description }}</p>
      </div>
    </div>

    <!-- Instalación como app: es lo que habilita el arranque sin conexión.
         Solo se ofrece con red y si la app no está instalada ya, porque fuera de
         iOS no hay más vía que el diálogo nativo del navegador. -->
    <div class="w-full max-w-2xl mt-6 md:mt-8">
      <button v-if="showInstall" @click="handleInstall"
        class="w-full flex items-center justify-center gap-2 bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800 text-slate-300 text-xs sm:text-sm py-3 px-4 rounded-xl transition-colors cursor-pointer hover:border-indigo-500/40">
        <component :is="needsManualInstall ? Share : Download" class="w-4 h-4" />
        <span>{{ needsManualInstall ? 'Cómo instalar en iOS' : 'Instalar LangBox' }}</span>
      </button>

      <p v-else-if="isInstalled"
        class="text-center text-xs text-emerald-400/90">
        App instalada
      </p>

      <!-- iOS no ofrece diálogo de instalación: hay que explicar los pasos -->
      <div v-if="showIosHelp && needsManualInstall"
        class="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400 space-y-1.5">
        <p class="text-slate-300 font-medium text-sm">Añadir a pantalla de inicio</p>
        <p>1. Pulsa el botón de compartir (el cuadro con flecha hacia arriba) en la barra de Safari.</p>
        <p>2. Elige <span class="text-slate-300">«Añadir a pantalla de inicio»</span>.</p>
        <p>3. Confirma. LangBox se abrirá como app y seguirá funcionando sin internet.</p>
      </div>
    </div>

  </div>
</template>