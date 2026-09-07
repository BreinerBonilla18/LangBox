<script setup>
import { enrichWordWithGemini } from "../core/api/aiService"
import { saveWordToVault } from '../core/api/wordStorage'
import { syncWordToCloud } from '../core/api/syncService'
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const props = defineProps({
  word: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['save-word', 'go-back'])

const isLoading = ref(true)
const errorMessage = ref('')

const wordData = ref(null)

const fetchWordData = async (wordToSearch) => {
  if (!wordToSearch) return

  isLoading.value = true
  errorMessage.value = ''
  wordData.value = null

  try {
    const data = await enrichWordWithGemini(wordToSearch)
    wordData.value = data
  } catch (error) {
    console.error('Error fetching word details:', error)
    errorMessage.value = 'No se pudo obtener la información de la palabra. Intenta de nuevo.'
  } finally {
    isLoading.value = false
  }
}

const handleSave = async () => {
  if (!wordData.value) return

  const today = new Date().toISOString().slice(0, 10)
  const rawData = JSON.parse(JSON.stringify(wordData.value))
  const wordPayload = {
    id: props.word.toLowerCase().trim(),
    word: rawData.word || props.word,
    phonetic: rawData.phonetic || '',
    meanings: rawData.meanings || [],
    mnemonics: rawData.mnemonics || [],
    synonyms: rawData.synonyms || [],
    r: 0,              // repeticiones
    ef: 2.5,           // factor de facilidad
    i: 1,              // intervalo (días)
    nrd: today         // fecha de próxima revisión
  }
  try {
    await saveWordToVault(wordPayload)
    syncWordToCloud(wordPayload).catch(console.error)
    router.push('/vocabulary')
  } catch (err) {
    errorMessage.value = 'No se pudo guardar la palabra en la base de datos local.'
  }
}

const handleGoBack = () => {
 router.push('/')
}

// Al montarse el componente, realiza la búsqueda
onMounted(() => {
  fetchWordData(props.word)
})

// Si la palabra cambia en la URL o prop, vuelve a consultar
watch(() => props.word, (newWord) => {
  fetchWordData(newWord)
})
</script>

<template>
  <div class="flex flex-col items-center justify-center px-4 py-8 min-h-screen">
    <div class="w-full max-w-2xl">
    
    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-16 space-y-4">
      <div class="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-zinc-400 tracking-wide">Consultando significados de "{{ props.word }}" con IA...</p>
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
      
      <header class="border-b border-zinc-800 pb-4 flex items-baseline justify-between gap-4">
        <div>
          <span class="text-xs font-semibold text-indigo-400 uppercase tracking-widest block mb-1">Palabra Consultada</span>
          <h1 class="text-4xl font-bold text-slate-50 tracking-study capitalize">
            {{ wordData.word }}
          </h1>
        </div>
        <span v-if="wordData.phonetic" class="font-mono text-lg text-indigo-400/90 tracking-wider bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg">
          {{ wordData.phonetic }}
        </span>
      </header>

      <section class="space-y-4">
        <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Significados y Ejemplos</h2>
        
        <div 
          v-for="(meaning, index) in wordData.meanings" 
          :key="index" 
          class="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-3"
        >
          <span class="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-2.5 py-0.5 rounded-md font-mono capitalize">
            {{ meaning.part_of_speech }}
          </span>

          <p class="text-slate-200 text-base leading-relaxed">
            <strong class="text-slate-100 font-semibold">Definición:</strong> {{ meaning.definition_es }}
          </p>
          
          <div class="bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80 space-y-1">
            <p class="text-slate-100 font-medium leading-relaxed">"{{ meaning.example_en }}"</p>
            <p class="text-zinc-400 text-sm italic">{{ meaning.example_es }}</p>
          </div>
        </div>
      </section>

      <section v-if="wordData.mnemonics?.length" class="bg-zinc-900/80 border-l-4 border-emerald-400 border-y border-r border-zinc-800 rounded-r-xl p-5 space-y-2">
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
            class="bg-zinc-800/80 border border-zinc-700/60 text-slate-300 text-xs px-3 py-1.5 rounded-lg font-mono tracking-wide"
          >
            {{ syn }}
          </span>
        </div>
      </section>

      <footer class="pt-6 border-t border-zinc-800 flex items-center justify-between gap-4">
        <button
          @click="handleGoBack"
          class="bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-5 py-3 rounded-xl transition-colors text-sm cursor-pointer"
        >
          Volver
        </button>

        <button
          @click="handleSave"
          class="bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 text-sm flex items-center gap-2 cursor-pointer"
        >
          Guardar
        </button>
      </footer>

    </div>
    </div>
  </div>
</template>