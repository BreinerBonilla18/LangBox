src/
├── assets/                 # Estilos globales, fuentes, imágenes
├── components/             # Componentes UI reutilizables e agnósticos del dominio
│   ├── ui/                 # Botones, modales, inputs, badges (Design System)
│   └── feedback/           # Loaders, toasts, alertas
├── config/                 # Constantes globales, variables de entorno
├── core/                   # Lógica central compartida entre módulos
│   ├── api/                # Cliente HTTP (Axios / Fetch wrapper)
│   ├── router/             # Configuración general de Vue Router
│   └── utils/              # Helpers puros (formateadores de fecha, fonética, etc.)
├── layouts/                # Plantillas principales (AppLayout, AuthLayout)
├── modules/                # 🚀 MÓDULOS DE DOMINIO (El corazón de la app)
│   ├── auth/               # Ejemplo: Módulo de Autenticación
│   ├── dictionary/         # Ejemplo: Búsqueda y guardado de palabras
│   │   ├── components/     # Componentes exclusivos de diccionario
│   │   ├── composables/    # useDictionary.ts, useAudioPronunciation.ts
│   │   ├── services/       # dictionaryApi.ts (integración con API externa)
│   │   ├── store/          # dictionaryStore.ts (Pinia)
│   │   ├── types/          # Interfaces y tipos de TypeScript
│   │   └── views/          # DictionaryView.vue
│   └── flashcards/         # Ejemplo: Sistema de repaso con repetición espaciada
│       ├── components/     # CardDeck.vue, RepetitionControls.vue
│       ├── composables/    # useSpacedRepetition.ts
│       ├── services/       # flashcardsApi.ts
│       ├── store/          # flashcardsStore.ts
│       └── views/          # FlashcardsStudyView.vue
├── views/                  # Vistas genéricas (HomeView, NotFoundView)
├── App.vue
└── main.ts