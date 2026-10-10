<script setup>
import { ref, onBeforeUnmount } from 'vue'
import BaseModal from './BaseModal.vue'
import { copyToClipboard } from '../core/utils/share'
import { Share as ShareIcon, Copy, Check } from '@lucide/vue'

// Modal de compartir palabra: muestra la URL a copiar y ofrece, cuando el
// navegador lo soporta, el diálogo nativo del sistema operativo.

const props = defineProps({
  url: {
    type: String,
    required: true
  },
  word: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

const copied = ref(false)
let copyTimer = null

const canNativeShare =
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'

const handleCopy = async () => {
  try {
    await copyToClipboard(props.url)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Sin acción: no se marca como copiado y el usuario puede reintentar.
  }
}

const handleNativeShare = async () => {
  try {
    await navigator.share({
      title: 'LangBox',
      text: `Te comparto la palabra "${props.word}"`,
      url: props.url
    })
  } catch {
    // "AbortError" es el cierre normal del diálogo nativo; se ignora porque
    // el usuario siempre puede volver a copiar el enlace manualmente.
  }
}

onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <BaseModal title="Compartir palabra" tone="indigo" @close="emit('close')">
    <template #icon>
      <ShareIcon class="w-8 h-8 text-indigo-400" />
    </template>

    <p>
      Se enviará un enlace con la palabra
      <span class="text-slate-200 font-semibold uppercase">"{{ word }}"</span>.
      Quien lo abra verá la búsqueda con un aviso de que tú la compartiste.
    </p>

    <div
      class="bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-2.5 text-left"
    >
      <p class="text-xs text-slate-300 break-all select-all leading-relaxed">
        {{ url }}
      </p>
    </div>

    <template #actions>
      <div class="flex items-center gap-3 w-full">
        <button
          v-if="canNativeShare"
          @click="handleNativeShare"
          class="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-4 py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <ShareIcon class="w-4 h-4" />
          Compartir
        </button>
        <button
          @click="handleCopy"
          :class="
            canNativeShare
              ? 'flex-1 bg-zinc-800 hover:bg-zinc-700 text-slate-300 border border-zinc-700/50'
              : 'w-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
          "
          class="font-medium px-4 py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check v-if="copied" class="w-4 h-4 text-emerald-400" />
          <Copy v-else class="w-4 h-4" />
          {{ copied ? '¡Copiado!' : 'Copiar enlace' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>