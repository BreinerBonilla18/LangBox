<script setup>
import { computed } from 'vue'
import { CloudUpload } from '@lucide/vue'
import BaseModal from './BaseModal.vue'

const props = defineProps({
  words: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['claim', 'clear'])

// Solo se muestran los primeros chips: más de 20 ruido visual en un modal.
const PREVIEW_LIMIT = 20

const previewWords = computed(() => props.words.slice(0, PREVIEW_LIMIT))
const hiddenCount = computed(() => Math.max(props.words.length - PREVIEW_LIMIT, 0))
</script>

<template>
  <BaseModal
    title="Palabras guardadas en este dispositivo"
    tone="indigo"
    :dismissible="false"
  >
    <template #icon>
      <CloudUpload class="w-8 h-8 text-indigo-500" />
    </template>

    <p>
      Encontramos
      <span class="text-slate-200 font-semibold">{{ words.length }}</span>
      {{ words.length === 1 ? 'palabra guardada' : 'palabras guardadas' }} aquí que todavía no
      están vinculadas a una cuenta. ¿Qué prefieres hacer?
    </p>

    <div class="max-h-36 overflow-y-auto flex flex-wrap gap-2 p-2">
      <span
        v-for="word in previewWords"
        :key="word.id"
        class="bg-zinc-800/80 border border-zinc-700/60 text-slate-300 text-xs px-2.5 py-1 rounded-md tracking-wide"
      >
        {{ word.word }}
      </span>
      <span
        v-if="hiddenCount > 0"
        class="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-md font-medium"
      >
        +{{ hiddenCount }} palabras más...
      </span>
    </div>

    <template #actions>
      <div class="flex items-center gap-3 w-full">
        <button
          type="button"
          class="flex-1 bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-4 py-3 rounded-xl transition-colors text-sm cursor-pointer border border-zinc-700/50"
          @click="emit('clear')"
        >
          Limpiar
        </button>
        <button
          type="button"
          class="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-4 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 text-sm cursor-pointer"
          @click="emit('claim')"
        >
          Sincronizar
        </button>
      </div>
    </template>
  </BaseModal>
</template>
