<script setup>
import { WifiOff, CloudUpload } from '@lucide/vue'
import { computed } from 'vue'
import { useNetworkStore } from '../stores/networkStore'

const networkStore = useNetworkStore()

// Sólo mostramos el contador de pendientes cuando hay algo real que subir.
const pendingLabel = computed(() => {
  const count = networkStore.pendingCount
  if (count === 1) return '1 cambio pendiente de sincronizar'
  return `${count} cambios pendientes de sincronizar`
})

const offlineHint = computed(() => {
  const isOffline = !networkStore.isOnline
  return isOffline && networkStore.pendingCount > 0 ? pendingLabel.value : ''
})
</script>

<template>
  <div aria-live="polite" class="fixed top-0 left-0 right-0 z-50 flex flex-col items-center gap-2 p-3 pointer-events-none">

    <!-- Reconexión: aviso transitorio de que todo vuelve a estar bien -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      leave-active-class="transition duration-500 ease-in"
      leave-to-class="opacity-0 -translate-y-2">
      <div v-if="networkStore.justReconnected"
        class="pointer-events-auto flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-xs font-medium text-emerald-300 backdrop-blur-md shadow-lg">
        <CloudUpload class="h-4 w-4" />
        <span>Conexión restablecida · sincronizando</span>
      </div>
    </Transition>

    <!-- Sin conexión: persistente, porque condiciona qué se puede hacer -->
    <div v-if="!networkStore.isOnline"
      class="pointer-events-auto flex w-full max-w-2xl items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300 backdrop-blur-md shadow-lg">
      <WifiOff class="mt-0.5 h-4 w-4 shrink-0" />
      <div class="flex flex-col gap-0.5 text-xs sm:text-sm">
        <span class="font-semibold">Sin conexión</span>
        <span class="text-amber-200/80">
          El buscador con IA está desactivado. Puedes seguir usando tu vocabulario y tus tarjetas.
        </span>
        <span v-if="offlineHint" class="text-amber-200/70">{{ offlineHint }}.</span>
      </div>
    </div>

  </div>
</template>