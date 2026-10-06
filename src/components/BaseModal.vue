<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  tone: {
    type: String,
    default: 'zinc',
    validator: value => ['zinc', 'indigo', 'amber', 'red', 'emerald'].includes(value)
  },
  // Con `dismissible: false` el fondo y la tecla Escape no cierran el modal:
  // se usa cuando la decisión es obligatoria (Caso 1 del login).
  dismissible: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close'])

// Los colores se escriben completos para que Tailwind los detecte al escanear el código.
const toneClasses = {
  zinc: 'bg-zinc-500/10 border-zinc-500/20',
  indigo: 'bg-indigo-500/10 border-indigo-500/20',
  amber: 'bg-amber-500/10 border-amber-500/20',
  red: 'bg-red-500/10 border-red-500/20',
  emerald: 'bg-emerald-500/10 border-emerald-500/20'
}

const iconWellClass = computed(() => toneClasses[props.tone] || toneClasses.zinc)

const requestClose = () => {
  if (props.dismissible) emit('close')
}

const onKeydown = event => {
  if (event.key === 'Escape') requestClose()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-md" @click="requestClose"></div>
    <div
      class="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 sm:p-8 w-full max-w-md relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
    >
      <div class="flex flex-col items-center text-center space-y-4">
        <div class="w-16 h-16 rounded-full flex items-center justify-center border" :class="iconWellClass">
          <slot name="icon"></slot>
        </div>
        <h2 class="text-xl font-bold text-slate-50">{{ title }}</h2>
        <div class="text-zinc-400 text-sm w-full space-y-3">
          <slot></slot>
        </div>
        <div class="w-full pt-4">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>
  </div>
</template>
