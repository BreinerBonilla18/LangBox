<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Volume2, BookOpen, Sparkles, Brain, CheckCircle2, RotateCcw, Frown, Smile } from '@lucide/vue'
import { getWordsForReviewToday, saveWordToVault } from '../core/api/wordStorage'
import { syncWordToCloud } from '../core/api/syncService'

const router = useRouter()
const isLoading = ref(true)
const reviewQueue = ref([])
const currentIndex = ref(0)
const showAnswer = ref(false)
const isSessionComplete = ref(false)

// Función para volver al vocabulario
const handleGoBack = () => {
  router.push('/vocabulary')
}

const currentWord = computed(() => {
  if (reviewQueue.value.length === 0 || currentIndex.value >= reviewQueue.value.length) return null
  return reviewQueue.value[currentIndex.value]
})

// Función para pronunciar la palabra
const handleSpeak = (text) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }
}

// Función para revelar la respuesta
const revealAnswer = () => {
  showAnswer.value = true
}

// Función para calificar y aplicar SM-2 Spaced Repetition Algorithm
const handleRate = async (q) => {
  const word = currentWord.value
  if (!word) return

  let { r = 0, ef = 2.5, i = 1 } = word

  if (q < 3) {
    r = 0
    i = 1
  } else {
    if (r === 0) i = 1
    else if (r === 1) i = 6
    else i = Math.round(i * ef)
    r++
  }

  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (ef < 1.3) ef = 1.3

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + i)
  const nrd = nextDate.toISOString().slice(0, 10)

  // Actualizar palabras internamente
  const updatedWord = { ...word, r, ef, i, nrd }

  try {
    await saveWordToVault(updatedWord)
    await syncWordToCloud(updatedWord)
  } catch (error) {
    console.error('Error updating word:', error)
  }

  if (q < 3) {
    // Volver a encolar al final en caso de fallo
    reviewQueue.value.push(updatedWord)
  }

  // Ir al siguiente
  showAnswer.value = false
  currentIndex.value++

  if (currentIndex.value >= reviewQueue.value.length) {
    isSessionComplete.value = true
  }
}

// Función para cargar las palabras pendientes de repaso
const loadDueWords = async () => {
  try {
    const words = await getWordsForReviewToday()
    // Mezclar aleatoriamente el orden de las palabras
    reviewQueue.value = words.sort(() => Math.random() - 0.5)
    if (reviewQueue.value.length === 0) {
      isSessionComplete.value = true
    }
  } catch (error) {
    console.error('Error loading due words:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadDueWords()
})
</script>

<template>
  <div class="flex flex-col items-center px-4 min-h-screen pb-10">
    <div class="w-full max-w-2xl">
      <!-- Encabezado -->
      <div class="text-center mt-6 sm:mt-8 mb-6 relative">
        <h1 class="text-3xl sm:text-4xl font-bold text-slate-50 mb-2">Tarjetas de Repaso</h1>
        <p class="text-zinc-400 mb-6 sm:mb-8 text-sm sm:text-base" v-if="!isSessionComplete && !isLoading">
          Palabra {{ currentIndex + 1 }} de {{ reviewQueue.length }}
        </p>

        <!-- Barra de Progreso -->
        <div class="w-full bg-zinc-800 rounded-full h-1.5 mb-6" v-if="!isSessionComplete && !isLoading">
          <div class="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" :style="{ width: `${((currentIndex) / reviewQueue.length) * 100}%` }"></div>
        </div>
      </div>

      <!-- Estado de Carga -->
      <div v-if="isLoading" class="text-center py-16 space-y-4">
        <div class="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-zinc-400 tracking-wide">Preparando tu sesión de estudio...</p>
      </div>

      <!-- Estado de sesión completa -->
      <div v-else-if="isSessionComplete" class="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden group">
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500"></div>
        <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>
        
        <div class="w-20 h-20 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 transform group-hover:scale-110 transition-transform duration-500">
          <Sparkles class="w-10 h-10 text-indigo-400" />
        </div>
        <h2 class="text-2xl sm:text-3xl font-bold text-slate-50">¡Has terminado tus repasos!</h2>
        <p class="text-zinc-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
          Has completado todas las palabras para hoy. Vuelve mañana para seguir fortaleciendo tu vocabulario.
        </p>
        <button @click="handleGoBack" class="mt-8 mx-auto bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-6 py-3 rounded-xl transition-colors text-sm cursor-pointer flex items-center gap-2">
          Volver a mi Vocabulario
        </button>
      </div>

      <!-- Flashcard -->
      <div v-else-if="currentWord" class="space-y-6">
        <!-- Tarjeta frontal -->
        <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 sm:p-12 text-center shadow-lg relative min-h-[16rem] flex flex-col justify-center items-center group transition-all">
          <button @click="handleSpeak(currentWord.word)" class="absolute top-4 right-4 p-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors cursor-pointer" title="Pronunciar">
            <Volume2 class="w-6 h-6" />
          </button>
          <div class="space-y-4 w-full">
            <span v-if="currentWord.phonetic" class="text-indigo-400/90 font-mono tracking-widest text-sm inline-block px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20">
              {{ currentWord.phonetic }}
            </span>
            <h2 class="text-4xl sm:text-5xl font-bold text-slate-50 capitalize">{{ currentWord.word }}</h2>
          </div>
        </div>

        <!-- Botón mostrar respuesta -->
        <div v-if="!showAnswer" class="pt-4">
          <button @click="revealAnswer" class="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-6 py-4 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 text-lg cursor-pointer">
            Mostrar respuesta
          </button>
        </div>

        <!-- Tarjeta trasera (Respuesta) -->
        <div v-show="showAnswer" class="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
             <!-- Significados -->
             <div v-if="currentWord.meanings?.length" class="space-y-4">
                <h3 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen class="w-4 h-4" /> Meanings
                </h3>
                <div v-for="(meaning, index) in currentWord.meanings" :key="index"
                  class="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 sm:p-5 space-y-3">
                  <span class="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-md capitalize font-medium">
                    {{ meaning.part_of_speech }}
                  </span>
                  <p class="text-slate-200 text-sm leading-relaxed">
                    {{ meaning.definition_es }}
                  </p>
                  <div class="bg-zinc-900/50 p-3 sm:p-4 rounded-lg border border-zinc-800/60 space-y-1.5 relative group">
                    <p class="text-slate-100 text-sm leading-relaxed italic pr-8">"{{ meaning.example_en }}"</p>
                    <button @click.stop="handleSpeak(meaning.example_en)" class="absolute top-2 right-2 p-1.5 text-zinc-500 shrink-0 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all cursor-pointer" title="Pronunciar ejemplo">
                      <Volume2 class="w-4 h-4" />
                    </button>
                    <p class="text-zinc-500 text-xs sm:text-sm">{{ meaning.example_es }}</p>
                  </div>
                </div>
              </div>

              <!-- Mnemotecnia -->
              <div v-if="currentWord.mnemonics?.length" class="bg-zinc-950/60 border border-zinc-800 border-l-4 border-l-emerald-500 rounded-r-xl p-4 sm:p-5 space-y-3">
                <h3 class="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Brain class="w-4 h-4" /> Mnemotecnia
                </h3>
                <ul class="space-y-2 list-disc list-inside text-slate-300 text-sm leading-relaxed">
                  <li v-for="(m, i) in currentWord.mnemonics" :key="i">
                    {{ m }}
                  </li>
                </ul>
              </div>
          </div>

          <!-- Botones de Calificación -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <button @click="handleRate(1)" class="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer group gap-2">
              <RotateCcw class="w-6 h-6 text-rose-400 group-hover:scale-110 transition-transform" />
              <span class="text-rose-400 font-medium text-sm">Otra vez</span>
              <span class="text-zinc-500 text-xs text-center">Menos de 1m</span>
            </button>
            <button @click="handleRate(3)" class="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/10 rounded-xl transition-all cursor-pointer group gap-2">
              <Frown class="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
              <span class="text-amber-400 font-medium text-sm">Difícil</span>
              <span class="text-zinc-500 text-xs font-mono">1 d</span>
            </button>
            <button @click="handleRate(4)" class="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/10 rounded-xl transition-all cursor-pointer group gap-2">
              <CheckCircle2 class="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span class="text-emerald-400 font-medium text-sm">Bien</span>
              <span class="text-zinc-500 text-xs font-mono">4-6 d</span>
            </button>
            <button @click="handleRate(5)" class="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/10 rounded-xl transition-all cursor-pointer group gap-2">
              <Smile class="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
              <span class="text-blue-400 font-medium text-sm">Fácil</span>
              <span class="text-zinc-500 text-xs font-mono">10+ d</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
