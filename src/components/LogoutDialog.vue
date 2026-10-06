<script setup>
import { LogOut } from '@lucide/vue'
import BaseModal from './BaseModal.vue'

const emit = defineEmits(['keep', 'remove', 'cancel'])
</script>

<template>
  <BaseModal title="Cerrar sesión" tone="amber" @close="emit('cancel')">
    <template #icon>
      <LogOut class="w-8 h-8 text-amber-500" />
    </template>

    <p>¿Qué prefieres hacer con las palabras que tienes guardadas en este dispositivo?</p>

    <template #actions>
      <div class="flex flex-col gap-3 w-full">
        <button
          type="button"
          class="w-full bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-4 py-3 rounded-xl transition-colors text-sm cursor-pointer border border-zinc-700/50"
          @click="emit('keep')"
        >
          Conservar palabras localmente
        </button>
        <button
          type="button"
          class="w-full bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-3 rounded-xl transition-colors shadow-lg shadow-red-500/20 text-sm cursor-pointer"
          @click="emit('remove')"
        >
          Quitar palabras de este dispositivo
        </button>
        <p class="text-[11px] text-zinc-500 leading-relaxed">
          Si quitas las palabras, se restaurarán automáticamente al iniciar sesión nuevamente.
        </p>
        <button
          type="button"
          class="w-full text-zinc-500 hover:text-slate-300 text-xs transition-colors cursor-pointer py-1"
          @click="emit('cancel')"
        >
          Cancelar
        </button>
      </div>
    </template>
  </BaseModal>
</template>
