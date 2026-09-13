<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const handleGoBack = () => {
  router.push('/')
}
</script>

<template>
  <div class="flex flex-col items-center justify-center px-4 min-h-screen">
    <div class="w-full max-w-2xl text-center">
      <h1 class="text-4xl font-bold text-slate-50">Tarjetas de Repaso</h1>
      <p class="text-zinc-400 my-4">¡Próximamente!</p>
      <button @click="handleGoBack"
        class="bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-5 py-3 rounded-xl transition-colors text-sm cursor-pointer">
        Volver
      </button>
    </div>
  </div>
</template>