import { useAuthStore } from './stores/authStore'
import { useNetworkStore } from './stores/networkStore'
import { createPinia } from 'pinia'
import router from './core/router'
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { requestPersistentStorage } from './core/utils/storage'
import { initInstallPrompt } from './composables/useInstallPrompt'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// El estado de conexión debe existir ANTES del montaje: las vistas lo leen al
// renderizarse (por ejemplo, para desactivar el buscador).
useNetworkStore(pinia).init()

// `beforeinstallprompt` se emite una sola vez por visita y solo si el navegador
// decide ofrecer la instalación. Escucharlo aquí, antes de resolver la primera
// ruta, evita entrar por un enlace profundo y perdérselo.
initInstallPrompt()

// La app se monta siempre e inmediatamente. Todo el estado que vive en
// IndexedDB (vocabulario, flashcards, SRS) es local y no debe esperar a la red:
// si el arranque dependiera de Supabase, un arranque sin conexión dejaría la
// aplicación en una pantalla en blanco para siempre.
app.mount('#app')

// La sesión y la sincronización se resuelven en segundo plano. Un fallo aquí
// degrada la nube, nunca el funcionamiento local.
useAuthStore(pinia)
  .initAuth()
  .catch(error => console.error('Error inicializando la sesión de Supabase:', error))

// Sin esto, el navegador puede descartar el vocabulario guardado si el disco se
// llena. En una app offline-first la pérdida de IndexedDB es irrecuperable.
requestPersistentStorage()