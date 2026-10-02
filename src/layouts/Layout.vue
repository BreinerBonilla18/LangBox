<script setup>
import NetworkBanner from '../components/NetworkBanner.vue'
</script>

<template>
  <div class="min-h-screen bg-zinc-950">
    <NetworkBanner />
    <router-view /> <!-- Rutas de la aplicación -->
  </div>
</template>