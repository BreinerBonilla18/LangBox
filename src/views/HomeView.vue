<script setup>
import { Search, Book, Brain } from '@lucide/vue'
import langboxLogo from '../assets/langbox.svg'
import { useRouter } from 'vue-router'
import { ref } from 'vue'

const router = useRouter()

const searchQuery = ref('')

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
  <div class="flex flex-col items-center justify-center px-4 min-h-screen">
    <div class="text-6xl flex flex-row items-center gap-3 mb-8">
      <div class="w-16 h-16"><img :src="langboxLogo" alt="LangBox Logo" /></div>
      <h1 class="text-slate-50 tracking-widest"><span class="text-indigo-500">Lang</span>Box</h1>
    </div>

    <!-- Search Input -->
    <div class="w-full max-w-2xl mb-8">
      <div class="relative flex gap-2">
        <Search class="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" />

        <input v-model="searchQuery" @keyup.enter="handleSearch" type="text" placeholder="Escribe una palabra..."
          class="w-full py-4 pl-12 pr-4 bg-zinc-900 border border-zinc-800 rounded-xl text-slate-50 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-500" />

        <button @click="handleSearch"
          class="bg-indigo-500 text-white px-4 py-2 rounded-xl cursor-pointer hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20">
          Buscar
        </button>
      </div>
    </div>

    <!-- Cards -->
    <div class="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="card in cards" :key="card.title"
        class="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-indigo-500/50 transition-all cursor-pointer group"
        @click="card.onClick">
        <div class="flex items-center gap-4 mb-3">
          <div
            class="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/30 transition-all">
            <component :is="card.icon" class="text-indigo-500 w-6 h-6" />
          </div>
          <h2 class="text-xl font-semibold text-slate-50">{{ card.title }}</h2>
        </div>
        <p class="text-zinc-400 text-sm">{{ card.description }}</p>
      </div>
    </div>
  </div>
</template>