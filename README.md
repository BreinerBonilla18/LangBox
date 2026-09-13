# LangBox 📚

![LangBox](https://img.shields.io/badge/LangBox-Language_Learning-indigo?style=for-the-badge)
![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Gemini-AI-8E75FF?style=for-the-badge&logo=google&logoColor=white)

> A smart language learning application that combines AI-powered word enrichment with spaced repetition for effective vocabulary building.

## ✨ Features

- **🔍 AI-Powered Word Search**: Get comprehensive word definitions, examples, phonetics, and mnemonics using Google Gemini AI
- **📚 Vocabulary Management**: Save and organize your words with expandable cards showing detailed information
- **🧠 Spaced Repetition System**: Built-in SRS algorithm to optimize learning retention (coming soon)
- **💾 Local Storage**: Persistent storage using IndexedDB via Dexie - your data stays on your device
- **☁️ Cloud Sync**: Automatic synchronization with Supabase when logged in with Google account
- **🔐 Secure Authentication**: Google OAuth integration via Supabase for secure user authentication
- **🎨 Modern UI**: Clean, responsive design with Tailwind CSS

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/langbox.git
   cd langbox
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
   - **Gemini API Key**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey) and create a new API key
   - **Supabase Credentials**: 
     - Create a free account at [supabase.com](https://supabase.com)
     - Create a new project
     - Go to Project Settings > API to get your URL and anon key
     - Enable Google OAuth in Authentication > Providers > Google

4. **Set up Supabase Database**
   Run the following SQL in your Supabase project's SQL Editor (SQL Editor > New Query) to create the necessary tables and security policies:
   
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

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## 📖 Usage

### 1. Search for Words
- Use the search bar on the home page to look up English words
- Press Enter or click the Search button
- View comprehensive information including definitions, examples, phonetics, and mnemonics

### 2. Save to Your Vocabulary
- Click "Guardar" to save words to your personal vocabulary
- Words are automatically stored locally with SRS metrics for optimized learning
- If logged in with Google, words sync automatically to Supabase cloud storage

### 3. Manage Your Vocabulary
- Navigate to the Vocabulary section to see all saved words
- Expand cards to view detailed information
- Delete words you no longer need

### 4. Practice with Flashcards
- Use the Flashcards section to review words due for practice
- The SRS algorithm schedules reviews based on your performance

## 🏗️ Project Structure

```
langbox/
├── src/
│   ├── assets/          # Static assets (images, logos)
│   ├── core/
│   │   ├── api/         # API services (AI, storage, sync)
│   │   ├── db/          # Database configuration (Dexie, Supabase)
│   │   └── router/      # Vue Router configuration
│   ├── layouts/         # Layout components
│   ├── stores/          # Pinia stores (auth, state management)
│   ├── views/           # Page components
│   │   ├── HomeView.vue
│   │   ├── SearchView.vue
│   │   ├── VocabularyView.vue
│   │   ├── FlashcardsView.vue
│   │   └── NotFoundView.vue
│   ├── App.vue          # Root component
│   ├── main.js          # Application entry point
│   └── style.css        # Global styles
├── .env                 # Environment variables
├── index.html           # HTML template
├── package.json         # Dependencies
└── vite.config.js       # Vite configuration
```

## 🛠️ Technologies Used

- **Frontend Framework**: Vue 3 with Composition API
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **Routing**: Vue Router 4
- **State Management**: Pinia
- **Local Database**: Dexie (IndexedDB wrapper)
- **Cloud Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Authentication**: Google OAuth via Supabase
- **AI Integration**: Google Gemini API
- **Icons**: Lucide Vue
- **Language**: JavaScript (ES6+)

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

## 📧 Contact

For questions, suggestions, or issues, please open an issue on GitHub.

---

Made with ❤️ for language learners worldwide
