# LangBox 📚

![LangBox](https://img.shields.io/badge/LangBox-Language_Learning-indigo?style=for-the-badge)
![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini-AI-8E75FF?style=for-the-badge&logo=google&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-offline--first-5A0FC8?style=for-the-badge)

> An offline-first language learning PWA that combines AI-powered word enrichment with spaced repetition, and keeps working with no internet at all.

## ✨ Features

- **🔍 AI-Powered Word Search**: Definitions in Spanish, IPA phonetics, B2-level examples with translations, synonyms and memory hooks, generated with Google Gemini
- **🧠 Spaced Repetition System**: A full SM-2 implementation that schedules your reviews and adapts the interval to how well you knew each word
- **🗣️ Pronunciation**: Native text-to-speech in the search results, your vocabulary and every flashcard
- **💾 Local Storage**: Persistent storage using IndexedDB via Dexie - your data stays on your device
- **📴 Works Offline**: Installable PWA with a service worker. The app boots, and your vocabulary and flashcards keep working, with no connection
- **🔄 Offline Sync Queue**: Changes made without internet are queued in IndexedDB and uploaded automatically once you are back online
- **☁️ Cloud Sync**: Optional synchronization with Supabase when logged in with a Google account
- **🔐 Secure Authentication**: Google OAuth via Supabase
- **🎨 Modern UI**: Clean, responsive design with Tailwind CSS

## 📴 Offline-first, how it works

This is the part that shapes every other decision in the codebase.

- **The app never waits for the network to boot.** The session and the cloud sync resolve in the background; if they fail, the app degrades to local-only instead of showing a blank screen.
- **Only word search needs internet**, because it is the only feature backed by a cloud AI. Without a connection it is disabled with an explicit notice rather than failing silently.
- **`navigator.onLine` is not trusted.** It reports `true` on captive Wi-Fi and on networks without DNS, so the network store probes the Supabase health endpoint every 30 seconds and treats *any* response, including 4xx and 5xx, as proof of connectivity.
- **The pending-ops queue survives restarts.** `pendingOps` uses a composite `[word_id+type]` key, so queueing the same change twice overwrites the previous operation instead of accumulating it — the freshest SRS state always wins.
- **The service worker precaches the whole build**, including the web font, and falls back to `index.html` for deep routes so reloading `/vocabulary` or `/flashcards` offline does not 404. Fonts and images are cached at runtime with `CacheFirst`.
- **Requests to Supabase and Gemini are deliberately not cached by the service worker.** They are plain `fetch` calls made from app code, and their outcome is decided by the network store and the sync queue.
- **Persistent storage is requested** via `navigator.storage.persist()`. In an offline-first app, losing IndexedDB to disk pressure would be unrecoverable.

## 🚀 Getting Started

### Prerequisites

- Node.js `^20.19.0 || >=22.12.0` (required by Vite 8)
- npm
- A Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BreinerBonilla18/LangBox.git
   cd LangBox
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   To get your API keys:
   - **Gemini API Key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and create a new API key
   - **Supabase Credentials**:
     - Create a free account at [supabase.com](https://supabase.com)
     - Create a new project
     - Go to Project Settings > API to get your URL and anon key
     - Enable Google OAuth in Authentication > Providers > Google

4. **Set up the Supabase database**

   Run the following SQL in your Supabase project's SQL Editor (SQL Editor > New Query) to create the table and its security policies:

   ```sql
   create table public.words (
     id text not null,
     user_id uuid references auth.users(id) on delete cascade not null,
     word text not null,
     phonetic text,
     meanings jsonb default '[]'::jsonb,
     mnemonics jsonb default '[]'::jsonb,
     synonyms jsonb default '[]'::jsonb,
     r integer default 0,
     ef numeric default 2.5,
     i integer default 1,
     nrd date not null,
     created_at timestamp with time zone default timezone('utc'::text, now()) not null,

     primary key (id, user_id)
   );

   alter table public.words enable row level security;

   create policy "Usuarios pueden ver sus propias palabras"
     on public.words for select
     using (auth.uid() = user_id);

   create policy "Usuarios pueden insertar sus propias palabras"
     on public.words for insert
     with check (auth.uid() = user_id);

   create policy "Usuarios pueden actualizar sus propias palabras"
     on public.words for update
     using (auth.uid() = user_id);

   create policy "Usuarios pueden eliminar sus propias palabras"
     on public.words for delete
     using (auth.uid() = user_id);
   ```

   The `r`, `ef`, `i` and `nrd` columns are the SM-2 state (repetitions, ease factor, interval, next review date).

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**

   Navigate to `http://localhost:5173`

## 📜 Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server with HMR. **The service worker is disabled here**, so the install button will not be offered |
| `npm run build` | Production build, including the service worker and the web app manifest |
| `npm run preview` | Serves the production build. **This is the only way to test the offline behaviour** |
| `npm run lint` | ESLint over the whole project |
| `npm run pwa:assets` | Regenerates the PWA icons from `public/langbox.svg` |

> Testing the install prompt or the offline mode requires `npm run build && npm run preview`. A cached service worker during development breaks HMR, which is why it is disabled in `devOptions`.

## 📖 Usage

### 1. Search for Words

- Use the search bar on the home page to look up English words
- Press Enter or click the Search button
- Read the definitions, IPA phonetics, examples with translations, synonyms and mnemonics, and hear the pronunciation

### 2. Save to Your Vocabulary

- Click "Guardar" to save words to your personal vocabulary
- Words are stored locally along with their SRS state
- If logged in with Google, words sync to the cloud

### 3. Practice with Flashcards

- The Flashcards section lists the words whose next review date has arrived
- Rate your recall and the SM-2 algorithm reschedules them: a failed answer resets the word to the first interval, a successful one grows it by the ease factor

### 4. Install the App

- On Chromium browsers an in-app button opens the native install dialog
- On iOS, Safari is the only browser that can install a PWA: tap the button for the *Share → Add to Home Screen* steps
- The button is hidden when you are offline or when the app is already installed

> If the button does not appear on Chrome/Edge, the browser has decided not to offer its install dialog for this site. Chromium remembers that an app was installed here before, even after you uninstall it, and stops firing `beforeinstallprompt`. You can always install from the browser menu: **⋮ → "Instalar aplicación"**.

## 🏗️ Project Structure

```
LangBox/
├── public/                      # Copied as-is on build
│   ├── langbox.svg              # Source logo for the icons
│   ├── pwa-*.png               # Generated app icons (64, 192, 512)
│   ├── maskable-icon-512x512.png
│   ├── apple-touch-icon-180x180.png
│   └── favicon.{ico,svg}, og-image.png
├── src/
│   ├── assets/                  # Assets imported from JS
│   ├── components/
│   │   └── NetworkBanner.vue    # Offline, reconnecting and pending-sync notices
│   ├── composables/
│   │   └── useInstallPrompt.js  # beforeinstallprompt / appinstalled
│   ├── core/
│   │   ├── api/
│   │   │   ├── aiService.js     # Gemini enrichment with model fallback
│   │   │   ├── syncService.js   # Cloud sync and SRS conflict resolution
│   │   │   └── wordStorage.js   # Local vault and queries
│   │   ├── db/
│   │   │   ├── database.js      # Dexie schema: words (v1), pendingOps (v2)
│   │   │   └── supabaseClient.js
│   │   ├── router/index.js
│   │   └── utils/
│   │       ├── online.js        # navigator.onLine, without Vue/Pinia
│   │       └── storage.js       # navigator.storage.persist()
│   ├── layouts/Layout.vue
│   ├── stores/
│   │   ├── authStore.js         # Google session, sync on login
│   │   └── networkStore.js      # Real connectivity probe
│   ├── views/
│   │   ├── HomeView.vue
│   │   ├── SearchView.vue
│   │   ├── VocabularyView.vue
│   │   ├── FlashcardsView.vue
│   │   └── NotFoundView.vue
│   ├── App.vue
│   ├── main.js                  # Entry point: registers install listeners
│   └── style.css
├── .env                         # Environment variables
├── index.html
├── package.json
├── vite.config.js               # Vue + Tailwind + VitePWA
├── pwa-assets.config.cjs        # Icon generation config
├── eslint.config.js
└── vercel.json                  # SPA rewrite + cache headers
```

## 🛠️ Technologies Used

- **Frontend Framework**: Vue 3 with Composition API
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS v4
- **Routing**: Vue Router 4
- **State Management**: Pinia
- **Local Database**: Dexie (IndexedDB wrapper)
- **PWA**: `vite-plugin-pwa` + Workbox (precache, `navigateFallback`, runtime caching)
- **Cloud Backend**: Supabase (PostgreSQL + Auth)
- **Authentication**: Google OAuth via Supabase
- **AI Integration**: Google Gemini API (`gemini-3.5-flash-lite`, with fallback to `gemini-3.5-flash` and `gemini-3.6-flash`)
- **Pronunciation**: Web Speech API (`speechSynthesis`)
- **Icons**: Lucide Vue
- **Language**: JavaScript (ES6+)

## ☁️ Deployment

Deployed on Vercel. `vercel.json` takes care of two things that a SPA with a service worker needs:

- **SPA rewrite**: every route is served `index.html`
- **No-cache on `/sw.js`, `/manifest.webmanifest` and `/index.html`**: a cached manifest or index would keep the browser on a stale build, and a cached service worker script would prevent updates from taking effect

## 🔄 Sync model

Cloud sync is optional and never overwrites good progress:

- On login the cloud is downloaded **before** anything is written
- Only words that do not exist yet in the cloud are inserted, using `ignoreDuplicates`
- The SRS state (`r`, `ef`, `i`, `nrd`) is written by a single dedicated path, so a device with stale data can never overwrite a newer review schedule
- Reviews made while the initial sync is still running wait for it, instead of computing a schedule from a stale local SRS
- **The offline queue wins over the cloud.** The login download skips words that still have queued operations, so an offline review is never rolled back — even if the access token expired while offline (the queue is stamped with its owner account instead of being dropped). The queue itself is drained by `startFlushScheduler`, which retries with backoff on `online`/`visibilitychange` rather than relying only on the observed offline→online transition (PWAs, iOS included, may never fire the `offline` event).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Google Gemini AI for providing the word enrichment API
- Vue.js and Tailwind CSS teams for amazing developer tools
- Workbox for powering the offline experience

## 📧 Contact

For questions, suggestions, or issues, please open an issue on GitHub.

---

Made with ❤️ for language learners worldwide