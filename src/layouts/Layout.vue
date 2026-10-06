<script setup>
import NetworkBanner from '../components/NetworkBanner.vue'
import OrphanWordsModal from '../components/OrphanWordsModal.vue'
import LogoutDialog from '../components/LogoutDialog.vue'
import { useAuthStore } from '../stores/authStore'

const authStore = useAuthStore()
</script>

<template>
  <div class="min-h-screen bg-zinc-950">
    <NetworkBanner />
    <router-view /> <!-- Rutas de la aplicación -->

    <!-- Flujos de sesión: se montan aquí porque el redirect de OAuth puede
         aterrizar en cualquier ruta y el logout se dispara desde Home. -->
    <OrphanWordsModal
      v-if="authStore.isVaultPromptOpen"
      :words="authStore.orphanPreview"
      @claim="authStore.resolveVaultPrompt('claim')"
      @clear="authStore.resolveVaultPrompt('clear')"
    />
    <LogoutDialog
      v-if="authStore.isLogoutPromptOpen"
      @keep="authStore.resolveLogoutPrompt('keep')"
      @remove="authStore.resolveLogoutPrompt('remove')"
      @cancel="authStore.resolveLogoutPrompt('cancel')"
    />
  </div>
</template>
