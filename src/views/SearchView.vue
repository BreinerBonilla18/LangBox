<script setup>
import { enrichWordWithAI } from "../core/api/aiService"
import { saveWordToVault, getWordFromVault } from '../core/api/wordStorage'
import { syncNewWordToCloud } from '../core/api/syncService'
import { useSpeech } from '../composables/useSpeech'
import { useNetworkStore } from '../stores/networkStore'
import { useAuthStore } from '../stores/authStore'
import { useAiProviderStore } from '../stores/aiProviderStore'
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Volume2, LoaderCircle, WifiOff, Info } from '@lucide/vue'
import geminiIcon from '../assets/gemini.svg'
import groqIcon from '../assets/groq.svg'
import openrouterIcon from '../assets/openrouter_dark.svg'

const router = useRouter()
const networkStore = useNetworkStore()
const authStore = useAuthStore()
const aiProviderStore = useAiProviderStore()
const { speak, isDisabled: isSpeechDisabled, isLoadingFor, isSpeakingFor, speechLabelFor } = useSpeech()

// Claves de los botones de voz: solo el botón que lanzó la lectura pinta
// loader/pulso; el resto se queda en su aspecto deshabilitado.
const headSpeechKey = 'head'
const exampleSpeechKey = (index) => `example-${index}`

// Iconos de los proveedores de IA, por clave de proveedor.
const providerIcons = {
  gemini: geminiIcon,
  groq: groqIcon,
  openrouter: openrouterIcon,
}

// Definir props
const props = defineProps({
  word: {
    type: String,
    required: true
  }
})

const errorMessage = ref('')
const isLoading = ref(true)

// `isFromCache` marca que lo que se muestra no viene de la IA sino de IndexedDB.
const isFromCache = ref(false)

const wordData = ref(null)

// Proveedor que finalmente respondió la consulta de IA y si fue vía fallback.
const sourceProvider = ref(null)
const usedFallback = ref(false)

const sourceIcon = computed(() => providerIcons[sourceProvider.value])

// Texto del aviso de origen: distingue el fallback automático del proveedor
// normal, para que el usuario sepa qué IA generó el resultado.
const sourceLabel = computed(() => {
  if (usedFallback.value) {
    return `${aiProviderStore.providerName(aiProviderStore.provider)} no respondió, se usó ${aiProviderStore.providerName(sourceProvider.value)}`
  }
  return `Generado con ${aiProviderStore.providerName(sourceProvider.value)}`
})

// La búsqueda va primero a la copia local y solo consulta a la IA si la palabra
// no está en el vocabulario. Así una palabra ya guardada no se vuelve a buscar,
// y sin conexión sigue funcionando con lo que hay en el dispositivo.
const fetchWordData = async (wordToSearch) => {
  if (!wordToSearch) return

  isLoading.value = true
  errorMessage.value = ''
  wordData.value = null
  isFromCache.value = false
  sourceProvider.value = null
  usedFallback.value = false

  const wordId = wordToSearch.toLowerCase().trim()

  // La copia local se consulta primero siempre, haya red o no. Si la palabra ya
  // está en el vocabulario no hay nada que averiguar: volver a preguntarle a la
  // IA gastaría cuota para regenerar unos datos que ya están guardados, y el
  // resultado podría además no coincidir con lo que el usuario está repasando.
  const localWord = await getWordFromVault(wordId).catch(() => undefined)

  if (localWord && !localWord.is_deleted) {
    wordData.value = localWord
    isFromCache.value = true
    isLoading.value = false
    return
  }

  if (!networkStore.isOnline) {
    errorMessage.value =
      'El buscador necesita conexión a internet y esta palabra todavía no está en tu vocabulario.'
    isLoading.value = false
    return
  }

  try {
    // Se prueba primero el proveedor elegido por el usuario y, si se cae por
    // saturación o error, se recorre la cadena de respaldo antes de rendirse.
    const provider = aiProviderStore.provider
    const fallbacks = aiProviderStore.fallbackProviders

    try {
      wordData.value = await enrichWordWithAI(wordToSearch, provider)
      sourceProvider.value = provider
      usedFallback.value = false
    } catch (primaryError) {
      let lastError = primaryError

      for (const fallback of fallbacks) {
        try {
          wordData.value = await enrichWordWithAI(wordToSearch, fallback)
          sourceProvider.value = fallback
          usedFallback.value = true
          break
        } catch (error) {
          lastError = error
        }
      }

      if (!wordData.value) throw lastError
    }
  } catch (error) {
    console.error('Error fetching word details:', error)
    errorMessage.value = 'No se pudo obtener la información de la palabra. Intenta de nuevo.'
  } finally {
    isLoading.value = false
  }
}

// Si lo que se muestra venía del vault local, la palabra ya está guardada y no
// hay nada que escribir: volver a guardarla solo generaría una subida inútil.
const saveButtonLabel = computed(() => (isFromCache.value ? 'Guardada' : 'Guardar'))

// Función para guardar la palabra
const handleSave = async () => {
  if (!wordData.value) return

  // Lo que se muestra ya venía del vault local: no hay nada nuevo que guardar
  // y volver a escribirlo solo generaría una subida innecesaria a la nube.
  if (isFromCache.value) {
    router.push('/vocabulary')
    return
  }

  const wordId = props.word.toLowerCase().trim()
  const rawData = JSON.parse(JSON.stringify(wordData.value))

  // Si la palabra ya existe en el vault, se conserva su progreso SRS:
  // volver a guardarla no debe reiniciar el historial de repaso.
  const existing = await getWordFromVault(wordId)
  const srs = existing
    ? {
        r: existing.r ?? 0,
        ef: existing.ef ?? 2.5,
        i: existing.i ?? 1,
        nrd: existing.nrd ?? new Date().toISOString().slice(0, 10)
      }
    : {
        r: 0,              // repeticiones
        ef: 2.5,           // factor de facilidad
        i: 1,              // intervalo (días)
        nrd: new Date().toISOString().slice(0, 10) // fecha de próxima revisión
      }

  const wordPayload = {
    id: wordId,
    word: rawData.word || props.word,
    phonetic: rawData.phonetic || '',
    meanings: rawData.meanings || [],
    mnemonics: rawData.mnemonics || [],
    synonyms: rawData.synonyms || [],
    // Se vincula a la cuenta activa en el momento de guardar. Si no hay
    // sesión, se conserva el vínculo previo para no desvincular una palabra
    // que ya pertenece a una cuenta.
    user_id: authStore.user?.id ?? existing?.user_id ?? null,
    ...srs
  }
  try {
    await saveWordToVault(wordPayload)
    syncNewWordToCloud(wordPayload).catch(console.error)
    router.push('/vocabulary')
  } catch {
    errorMessage.value = 'No se pudo guardar la palabra en la base de datos local.'
  }
}

const handleGoBack = () => router.push('/')

// Al montarse el componente, realiza la búsqueda
onMounted(() => {
  fetchWordData(props.word)
})

// Si la palabra cambia en la URL o prop, vuelve a consultar
watch(() => props.word, (newWord) => {
  fetchWordData(newWord)
})

// Al recuperar la conexión se reintenta solo lo que quedó bloqueado por estar
// offline, para que el usuario no tenga que recargar la página a mano.
watch(() => networkStore.isOnline, (online) => {
  if (online && errorMessage.value) fetchWordData(props.word)
})
</script>

<template>
  <div class="flex flex-col items-center justify-center px-4 py-8 min-h-screen">
    <div class="w-full max-w-2xl">
    
    <!-- Card de carga -->
    <div v-if="isLoading" class="text-center py-16 space-y-4">
      <div class="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-zinc-400 tracking-wide">
        Consultando significados de "{{ props.word }}" con
        {{ aiProviderStore.providerName(aiProviderStore.provider) }}...
      </p>
    </div>

     <!-- Pantalla de error -->
    <div v-else-if="errorMessage" class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center space-y-4">
      <p class="text-amber-400 font-medium">{{ errorMessage }}</p>
      <button 
        @click="handleGoBack"
        class="bg-zinc-800 hover:bg-zinc-700 text-slate-200 px-5 py-2 rounded-lg text-sm transition-colors cursor-pointer"
      >
        Volver atrás
      </button>
    </div>

    <!-- Contenido Principal -->
    <div v-else-if="wordData" class="space-y-6">

      <!-- Origen de los datos: lo que se ve nunca es la consulta de IA -->
      <div v-if="isFromCache"
        class="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs"
        :class="networkStore.isOnline
          ? 'border-zinc-800 bg-zinc-900 text-zinc-400'
          : 'border-amber-500/20 bg-amber-500/10 text-amber-300'">
        <component :is="networkStore.isOnline ? Info : WifiOff" class="mt-0.5 h-4 w-4 shrink-0" />
        <span v-if="networkStore.isOnline">
          Esta palabra ya está en tu vocabulario.
        </span>
        <span v-else>
          Estás sin conexión: se muestra la copia guardada en este dispositivo, no la consulta de IA.
        </span>
      </div>

      <!-- Qué IA generó el resultado cuando no vino del vault local -->
      <div v-if="!isFromCache && sourceProvider"
        class="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs w-fit"
        :class="usedFallback
          ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
          : 'border-zinc-800 bg-zinc-900 text-zinc-400'">
        <img :src="sourceIcon" :alt="aiProviderStore.providerName(sourceProvider)" class="h-4 w-4 shrink-0" />
        <span>{{ sourceLabel }}</span>
      </div>
      
      <!-- Palabra Consultada -->
      <header class="border-b border-zinc-800 pb-4 flex flex-col sm:flex-row items-start sm:items-baseline justify-between gap-3 sm:gap-4">
        <div>
          <span class="text-[10px] sm:text-xs font-semibold text-indigo-400 uppercase tracking-widest block mb-1">Palabra Consultada</span>
          <div class="flex items-center gap-3">
            <h1 class="text-3xl sm:text-4xl font-bold text-slate-50 tracking-study capitalize">
              {{ wordData.word }}
            </h1>
            <button @click.stop="speak(wordData.word, headSpeechKey)" :disabled="isSpeechDisabled"
              :title="speechLabelFor(headSpeechKey) || 'Pronunciar'" :aria-label="speechLabelFor(headSpeechKey) || 'Pronunciar'"
              class="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent">
              <LoaderCircle v-if="isLoadingFor(headSpeechKey)" class="w-6 h-6 animate-spin" />
              <Volume2 v-else class="w-6 h-6" :class="isSpeakingFor(headSpeechKey) && 'text-indigo-400 animate-pulse'" />
            </button>
          </div>
        </div>
        <span v-if="wordData.phonetic" class="text-sm sm:text-lg text-indigo-400/90 tracking-wider bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg">
          {{ wordData.phonetic }}
        </span>
      </header>

      <!-- Significados y Ejemplos -->
      <section class="space-y-4">
        <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Significados y Ejemplos</h2>
        
        <div 
          v-for="(meaning, index) in wordData.meanings" 
          :key="index" 
          class="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-3"
        >
          <span class="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-md capitalize">
            {{ meaning.part_of_speech }}
          </span>

          <p class="text-slate-200 text-sm sm:text-base leading-relaxed">
            <strong class="text-slate-100 font-semibold">Definición:</strong> {{ meaning.definition_es }}
          </p>
          
          <div class="bg-zinc-950/60 p-3 sm:p-4 rounded-lg border border-zinc-800/80 space-y-1">
            <div class="flex items-start justify-between gap-3">
              <p class="text-slate-100 font-medium leading-relaxed text-sm sm:text-base">"{{ meaning.example_en }}"</p>
              <button @click.stop="speak(meaning.example_en, exampleSpeechKey(index))" :disabled="isSpeechDisabled"
                :title="speechLabelFor(exampleSpeechKey(index)) || 'Pronunciar ejemplo'" :aria-label="speechLabelFor(exampleSpeechKey(index)) || 'Pronunciar ejemplo'"
                class="shrink-0 p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent">
                <LoaderCircle v-if="isLoadingFor(exampleSpeechKey(index))" class="w-4 h-4 animate-spin" />
                <Volume2 v-else class="w-4 h-4" :class="isSpeakingFor(exampleSpeechKey(index)) && 'text-indigo-400 animate-pulse'" />
              </button>
            </div>
            <p class="text-zinc-400 text-xs sm:text-sm italic">{{ meaning.example_es }}</p>
          </div>
        </div>
      </section>

      <!-- Mnemotecnia -->
      <section v-if="wordData.mnemonics?.length" class="bg-zinc-900/80 border-l-4 border-emerald-400 border-y border-r border-zinc-800 rounded-r-xl p-4 sm:p-5 space-y-2">
        <h3 class="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>💡</span> Mnemotecnia
        </h3>
        <ul class="space-y-1 list-disc list-inside text-slate-300 text-sm leading-relaxed">
          <li v-for="(m, i) in wordData.mnemonics" :key="i">
            {{ m }}
          </li>
        </ul>
      </section>

      <!-- Sinónimos -->
      <section v-if="wordData.synonyms?.length" class="space-y-2">
        <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Sinónimos</span>
        <div class="flex flex-wrap gap-2">
          <span 
            v-for="syn in wordData.synonyms" 
            :key="syn"
            class="bg-zinc-800/80 border border-zinc-700/60 text-slate-300 text-xs px-3 py-1.5 rounded-lg tracking-wide"
          >
            {{ syn }}
          </span>
        </div>
      </section>

      <!-- Botones -->
      <footer class="pt-6 border-t border-zinc-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <button
          @click="handleGoBack"
          class="w-full sm:w-auto bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-6 py-3 rounded-xl transition-colors text-sm cursor-pointer"
        >
          Volver
        </button>

        <button
          @click="handleSave"
          class="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 text-sm cursor-pointer"
        >
          {{ saveButtonLabel }}
        </button>
      </footer>

    </div>
    </div>
  </div>
</template>