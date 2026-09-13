import { useAuthStore } from './stores/authStore'
import { createPinia } from 'pinia'
import router from './core/router'
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Inicializar verificación de autenticación
const authStore = useAuthStore()
authStore.initAuth().then(() => {
  app.mount('#app')
})