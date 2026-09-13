<script setup>
import { getAllVaultWords, deleteWordFromVault } from '../core/api/wordStorage'
import { Trash2, ChevronDown, ChevronUp, BookOpen } from '@lucide/vue'
import { syncDeleteWordFromCloud } from '../core/api/syncService'
import { useRouter } from 'vue-router'
import { ref, onMounted } from 'vue'

const router = useRouter()

const expandedWords = ref(new Set())
const isLoading = ref(true)
const words = ref([])

const handleGoToFlashcards = () => router.push('/flashcards')
const handleGoBack = () => router.push('/')

// Función para alternar la expansión de una palabra
const handleToggleExpand = (wordId) => {
  if (expandedWords.value.has(wordId)) {
    expandedWords.value.delete(wordId)
  } else {
    expandedWords.value.add(wordId)
  }
}

// Función para eliminar una palabra
const handleDelete = async (wordId) => {
  try {
    await deleteWordFromVault(wordId)
    words.value = words.value.filter(word => word.id !== wordId)

    await syncDeleteWordFromCloud(wordId)
  } catch (error) {
    console.error('Error deleting word:', error)
  }
}

// Función para cargar las palabras
const handleLoadWords = async () => {
  try {
    words.value = await getAllVaultWords()
  } catch (error) {
    console.error('Error loading words:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  handleLoadWords()
})
</script>

<template>
  <div class="flex flex-col items-center px-4 min-h-screen">
    <div class="w-full max-w-2xl">
      <!-- Encabezado -->
      <div class="text-center mt-6 sm:mt-8 mb-6">
        <h1 class="text-3xl sm:text-4xl font-bold text-slate-50 mb-2">Vocabulario</h1>
        <p class="text-zinc-400 mb-6 sm:mb-8 text-sm sm:text-base">Tus palabras guardadas - {{ words.length }} total</p>
        <div class="pt-6 border-t border-zinc-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <button @click="handleGoBack"
            class="w-full sm:w-auto bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-5 py-3 rounded-xl transition-colors text-sm cursor-pointer">
            Agregar palabra
          </button>

          <button @click="handleGoToFlashcards"
            class="w-full sm:w-auto justify-center sm:justify-start bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-6 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 text-sm flex items-center gap-2 cursor-pointer">
            Iniciar repaso
          </button>
        </div>
      </div>

      <!-- Estado de Carga -->
      <div v-if="isLoading" class="text-center py-16 space-y-4">
        <div class="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin">
        </div>
        <p class="text-zinc-400 tracking-wide">Cargando tu vocabulario...</p>
      </div>

      <!-- Estado Vacío -->
      <div v-else-if="words.length === 0" class="text-center py-16 space-y-4">
        <div
          class="w-16 h-16 bg-zinc-900 bg-indigo-500/30 border border-zinc-800 transition-all group rounded-xl flex items-center justify-center mx-auto hover:border-indigo-500/50">
          <BookOpen class="text-zinc-600 w-8 h-8 group-hover:text-indigo-500 transition-all" />
        </div>
        <p class="text-zinc-400">Sin palabras guardadas aún. Empieza a buscar y guarda tu primera palabra!</p>
      </div>

      <!-- Lista de Palabras -->
      <div v-else class="space-y-4 mb-8">
        <div v-for="word in words" :key="word.id"
          class="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all hover:border-indigo-500/30">
          <!-- Card -->
          <div class=" p-3 sm:p-4 flex items-center justify-between cursor-pointer" @click="handleToggleExpand(word.id)">
            <div class="flex items-center gap-3 sm:gap-4 truncate">
              <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 truncate">
                <h2 class="text-lg sm:text-xl font-semibold text-slate-50 capitalize truncate">{{ word.word }}</h2>
                <span v-if="word.phonetic"
                  class="text-xs sm:text-sm text-indigo-400/90 tracking-wider bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded-md self-start sm:self-auto">
                  {{ word.phonetic }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1 sm:gap-2 shrink-0">
              <button @click.stop="handleDelete(word.id)"
                class="p-1.5 sm:p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                title="Delete word">
                <Trash2 class="w-4 h-4" />
              </button>
              <button
                class="p-1.5 sm:p-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer">
                <ChevronDown v-if="!expandedWords.has(word.id)" class="w-5 h-5" />
                <ChevronUp v-else class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Contenido expandible -->
          <div v-if="expandedWords.has(word.id)" class="border-t border-zinc-800 p-3 sm:p-4 space-y-3 sm:space-y-4">
            <!-- Significados -->
            <div v-if="word.meanings?.length" class="space-y-3">
              <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Meanings</h3>
              <div v-for="(meaning, index) in word.meanings" :key="index"
                class="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-3 sm:p-4 space-y-2">
                <span
                  class="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] sm:text-xs px-2 py-0.5 rounded-md capitalize">
                  {{ meaning.part_of_speech }}
                </span>
                <p class="text-slate-200 text-xs sm:text-sm leading-relaxed">
                  <strong class="text-slate-100 font-semibold">Definition:</strong> {{ meaning.definition_es }}
                </p>
                <div class="bg-zinc-900/50 p-2.5 sm:p-3 rounded-md border border-zinc-800/60 space-y-1">
                  <p class="text-slate-100 text-xs sm:text-sm leading-relaxed">"{{ meaning.example_en }}"</p>
                  <p class="text-zinc-400 text-[10px] sm:text-xs italic">{{ meaning.example_es }}</p>
                </div>
              </div>
            </div>

            <!-- Mnemotecnia -->
            <div v-if="word.mnemonics?.length"
              class="bg-zinc-950/60 border border-zinc-800 border-l-4 border-l-emerald-400 rounded-r-lg p-3 sm:p-4 space-y-2">
              <h3 class="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>💡</span> Mnemotecnia
              </h3>
              <ul class="space-y-1 list-disc list-inside text-slate-300 text-xs sm:text-sm leading-relaxed">
                <li v-for="(m, i) in word.mnemonics" :key="i">
                  {{ m }}
                </li>
              </ul>
            </div>

            <!-- Synonyms -->
            <div v-if="word.synonyms?.length" class="space-y-2">
              <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Sinonimos</span>
              <div class="flex flex-wrap gap-2">
                <span v-for="syn in word.synonyms" :key="syn"
                  class="bg-zinc-800/80 border border-zinc-700/60 text-slate-300 text-xs px-3 py-1.5 rounded-lg tracking-wide">
                  {{ syn }}
                </span>
              </div>
            </div>

            <!-- Sistema de repetición espaciada (SRS) -->
            <div class="pt-3 border-t border-zinc-800">
              <div class="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-zinc-500">
                <span>Repeticiones: {{ word.r }}</span>
                <span>Siguiente revisión: {{ word.nrd }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>