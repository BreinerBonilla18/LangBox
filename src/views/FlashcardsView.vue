<script setup>
import {
  Volume2,
  LoaderCircle,
  BookOpen,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Frown,
  Smile,
  AlertTriangle,
  ChevronLeft,
} from "@lucide/vue";
import {
  getWordsForReviewToday,
  saveWordToVault,
  getAllVaultWords,
  deleteWordFromVault,
} from "../core/api/wordStorage";
import {
  syncWordToCloud,
  syncDeleteWordFromCloud,
  waitForPendingSync,
} from "../core/api/syncService";
import { useSpeech } from "../composables/useSpeech";
import BaseModal from "../components/BaseModal.vue";
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const {
  speak,
  isDisabled: isSpeechDisabled,
  isLoadingFor,
  isSpeakingFor,
  speechLabelFor,
} = useSpeech();

// Claves de los botones de voz: solo el botón que lanzó la lectura pinta
// loader/pulso; el resto se queda en su aspecto deshabilitado.
const cardSpeechKey = "card";
const exampleSpeechKey = (index) => `example-${index}`;
const isLoading = ref(true);
const dueWords = ref([]);
const reviewQueue = ref([]);
const currentIndex = ref(0);
const showAnswer = ref(false);
const isSessionComplete = ref(false);
const isBatchComplete = ref(false);

// Tamaño del lote de repaso. 0 significa que aún no se elige: se muestra la
// pantalla de configuración con las opciones disponibles.
const batchSize = ref(0);
const currentBatch = ref(1);
const hasNoWords = ref(false);
const showMasteryModal = ref(false);
const wordToDecide = ref(null);

const totalBatches = computed(() =>
  batchSize.value > 0 && dueWords.value.length > 0
    ? Math.ceil(dueWords.value.length / batchSize.value)
    : 0
);

// Palabras que quedan para hoy una vez terminado el lote actual.
const remainingDue = computed(() =>
  Math.max(0, dueWords.value.length - currentBatch.value * batchSize.value)
);

// Opciones del selector de lote: los tamaños fijos solo cuando son menores al
// total (repasar 20 en un día de 8 no es batching) y siempre "Todas".
const batchOptions = computed(() => {
  const base = [10, 20, 50].filter((size) => size < dueWords.value.length);
  return [...base, dueWords.value.length];
});

// Función para volver al vocabulario
const handleGoBack = () => {
  router.push("/");
};

const currentWord = computed(() => {
  if (
    reviewQueue.value.length === 0 ||
    currentIndex.value >= reviewQueue.value.length
  )
    return null;
  return reviewQueue.value[currentIndex.value];
});

// Función para revelar la respuesta
const revealAnswer = () => {
  showAnswer.value = true;
};

// Función para ir al siguiente manual o automático
const advanceToNext = () => {
  showAnswer.value = false;
  currentIndex.value++;

  if (currentIndex.value >= reviewQueue.value.length) {
    // El lote terminó. Si aún quedan palabras pendientes hoy, el usuario pasa
    // por el intersticial de logro antes de empezar el siguiente lote; si el
    // lote cubría todo el día, la sesión está completa.
    if (currentBatch.value * batchSize.value >= dueWords.value.length) {
      isSessionComplete.value = true;
    } else {
      isBatchComplete.value = true;
    }
  }
};

// Función para calificar y aplicar SM-2 Spaced Repetition Algorithm
const handleRate = async (q) => {
  const word = currentWord.value;
  if (!word) return;

  // Si la sincronización inicial sigue descargando la nube, se espera: de lo
  // contrario esta revisión se calcularía sobre un SRS local desactualizado y
  // podría pisar el progreso que viene de otro dispositivo.
  await waitForPendingSync();

  let { r = 0, ef = 2.5, i = 1 } = word;

  if (q < 3) {
    r = 0;
    i = 1;
  } else {
    if (r === 0) i = 1;
    else if (r === 1) i = 6;
    else i = Math.round(i * ef);
    r++;
  }

  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < 1.3) ef = 1.3;

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + i);
  const nrd = nextDate.toISOString().slice(0, 10);

  // Actualizar palabras internamente
  const updatedWord = { ...word, r, ef, i, nrd };

  try {
    await saveWordToVault(updatedWord);
    await syncWordToCloud(updatedWord);
  } catch (error) {
    console.error("Error updating word:", error);
  }

  if (q < 3) {
    // Volver a encolar al final en caso de fallo
    reviewQueue.value.push(updatedWord);
  }

  // Comprobar si alcanzó 5 repasos
  if (updatedWord.r === 5) {
    wordToDecide.value = updatedWord;
    showMasteryModal.value = true;
  } else {
    advanceToNext();
  }
};

const handleKeepWord = () => {
  showMasteryModal.value = false;
  wordToDecide.value = null;
  advanceToNext();
};

const handleDeleteWord = async () => {
  if (wordToDecide.value) {
    const wordId = wordToDecide.value.id;
    try {
      await deleteWordFromVault(wordId);
      await syncDeleteWordFromCloud(wordId);
    } catch (error) {
      console.error("Error deleting mastered word:", error);
    }
  }
  showMasteryModal.value = false;
  wordToDecide.value = null;
  advanceToNext();
};

// Carga el slice del lote actual desde el total de palabras de hoy. Las fallidas
// (q < 3) se re-encolan dentro de este mismo lote, así que no se filtra por
// aquí: el lote solo termina cuando cada tarjeta se responde bien.
const loadNextBatch = () => {
  const offset = (currentBatch.value - 1) * batchSize.value;
  reviewQueue.value = dueWords.value.slice(offset, offset + batchSize.value);
  currentIndex.value = 0;
  showAnswer.value = false;
  isBatchComplete.value = false;
};

// Arranca la sesión con el tamaño de lote elegido en la pantalla de inicio.
const startSession = (size) => {
  batchSize.value = size;
  currentBatch.value = 1;
  loadNextBatch();
};

// Avanza al siguiente lote desde el intersticial de logro.
const startNextBatch = () => {
  currentBatch.value++;
  loadNextBatch();
};

// Función para cargar las palabras pendientes de repaso
const loadDueWords = async () => {
  try {
    const allWords = await getAllVaultWords();
    if (allWords.length === 0) {
      hasNoWords.value = true;
      isLoading.value = false;
      return;
    }

    const words = await getWordsForReviewToday();
    if (words.length === 0) {
      isSessionComplete.value = true;
      isLoading.value = false;
      return;
    }

    // Mezclar aleatoriamente el orden de las palabras. La cola real se arma por
    // lotes al elegir el tamaño, reutilizando este mismo arreglo barajado.
    dueWords.value = words.sort(() => Math.random() - 0.5);
  } catch (error) {
    console.error("Error loading due words:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadDueWords();
});
</script>

<template>
  <div class="flex flex-col items-center px-4 min-h-screen pb-10 relative">
    <button
      @click="handleGoBack"
      class="absolute left-0 top-0 m-4 p-2 bg-zinc-800 hover:bg-zinc-700 text-slate-300 rounded-xl transition-colors cursor-pointer flex items-center justify-center z-10"
      aria-label="Volver"
      title="Volver al inicio"
    >
      <ChevronLeft class="w-5 h-5" />
    </button>
    <div class="w-full max-w-2xl ">
      <!-- Encabezado -->
      <div class="text-center mt-6 sm:mt-8 mb-6">
        <h1
          class="text-3xl sm:text-4xl font-bold text-slate-50 mb-2 mt-15 sm:mt-0"
        >
          Tarjetas de Repaso
        </h1>
        <p
          class="text-zinc-400 mb-6 sm:mb-8 text-sm sm:text-base"
          v-if="
            !isSessionComplete &&
            !isLoading &&
            !hasNoWords &&
            batchSize > 0 &&
            !isBatchComplete
          "
        >
          Lote {{ currentBatch }} de {{ totalBatches }} · Palabra
          {{ currentIndex + 1 }} de {{ reviewQueue.length }}
        </p>

        <!-- Barra de Progreso -->
        <div
          class="w-full bg-zinc-800 rounded-full h-1.5 mb-6"
          v-if="
            !isSessionComplete &&
            !isLoading &&
            !hasNoWords &&
            batchSize > 0 &&
            !isBatchComplete
          "
        >
          <div
            class="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
            :style="{ width: `${(currentIndex / reviewQueue.length) * 100}%` }"
          ></div>
        </div>
      </div>

      <!-- Estado de Carga -->
      <div v-if="isLoading" class="text-center py-16 space-y-4">
        <div
          class="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"
        ></div>
        <p class="text-zinc-400 tracking-wide">
          Preparando tu sesión de estudio...
        </p>
      </div>

      <!-- Estado Sin Palabras -->
      <div
        v-else-if="hasNoWords"
        class="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden group"
      >
        <div
          class="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500"
        ></div>

        <div
          class="w-20 h-20 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 transform group-hover:scale-110 transition-transform duration-500"
        >
          <BookOpen class="w-10 h-10 text-indigo-400" />
        </div>
        <h2 class="text-2xl sm:text-3xl font-bold text-slate-50">
          ¡Aún no hay palabras!
        </h2>
        <p
          class="text-zinc-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed"
        >
          No tienes ninguna palabra en tu vocabulario. Añade algunas palabras
          primero para poder repasarlas.
        </p>
        <button
          @click="handleGoBack"
          class="mt-8 mx-auto bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-6 py-3 rounded-xl transition-colors text-sm cursor-pointer flex items-center gap-2"
        >
          Ir al Vocabulario
        </button>
      </div>

      <!-- Intersticial de logro entre lotes -->
      <div
        v-else-if="isBatchComplete"
        class="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden group"
      >
        <div
          class="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500"
        ></div>

        <div
          class="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 transform group-hover:scale-110 transition-transform duration-500"
        >
          <Sparkles class="w-10 h-10 text-emerald-400" />
        </div>
        <h2 class="text-2xl sm:text-3xl font-bold text-slate-50">
          ¡Lote {{ currentBatch }} completado!
        </h2>
        <p
          class="text-zinc-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed"
        >
          Repasaste {{ batchSize }} palabras de {{ dueWords.length }} que
          tocaban hoy
          <span v-if="remainingDue > 0">
            y quedan {{ remainingDue }} por delante
          </span>
          . ¡Sigue así!
        </p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            @click="startNextBatch"
            class="bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm cursor-pointer flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            Continuar lote ({{ remainingDue }} restantes)
          </button>
          <button
            @click="handleGoBack"
            class="bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-6 py-3 rounded-xl transition-colors text-sm cursor-pointer"
          >
            Volver al inicio
          </button>
        </div>
      </div>

      <!-- Estado de sesión completa -->
      <div
        v-else-if="isSessionComplete"
        class="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden group"
      >
        <div
          class="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500"
        ></div>
        <div
          class="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500"
        ></div>

        <div
          class="w-20 h-20 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 transform group-hover:scale-110 transition-transform duration-500"
        >
          <Sparkles class="w-10 h-10 text-indigo-400" />
        </div>
        <h2 class="text-2xl sm:text-3xl font-bold text-slate-50">
          ¡Has terminado tus repasos!
        </h2>
        <p
          class="text-zinc-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed"
        >
          Has completado todas las palabras para hoy. Vuelve mañana para seguir
          fortaleciendo tu vocabulario.
        </p>
        <span
          class="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs px-3 py-1.5 rounded-full"
        >
          {{ dueWords.length }} palabras repasadas hoy
        </span>
        <button
          @click="handleGoBack"
          class="mt-8 mx-auto bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-6 py-3 rounded-xl transition-colors text-sm cursor-pointer flex items-center gap-2"
        >
          Volver a mi Vocabulario
        </button>
      </div>

      <!-- Elección del tamaño del lote -->
      <div
        v-else-if="!batchSize"
        class="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-xl relative overflow-hidden group"
      >
        <div
          class="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500"
        ></div>

        <div
          class="w-20 h-20 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 transform group-hover:scale-110 transition-transform duration-500"
        >
          <BookOpen class="w-10 h-10 text-indigo-400" />
        </div>
        <h2 class="text-2xl sm:text-3xl font-bold text-slate-50">
          ¡Tienes {{ dueWords.length }} palabras para repasar!
        </h2>
        <p
          class="text-zinc-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed"
        >
          Elige cuántas palabras estudiar en esta tanda:
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md mx-auto">
          <button
            v-for="size in batchOptions"
            :key="size"
            @click="startSession(size)"
            class="bg-zinc-800 hover:bg-indigo-500 hover:text-white border border-zinc-700/50 text-slate-200 font-medium px-4 py-3 rounded-xl transition-colors text-sm cursor-pointer"
          >
            {{ size === dueWords.length ? "Todas" : size }}
          </button>
        </div>
        <p class="text-xs text-zinc-500">
          Las no repasadas hoy siguen disponibles mañana, con tu progreso intacto.
        </p>
      </div>

      <!-- Flashcard -->
      <div v-else-if="currentWord" class="space-y-6">
        <!-- Tarjeta frontal: clickeable para revelar la respuesta -->
        <div
          class="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 sm:p-12 text-center shadow-lg relative min-h-[16rem] flex flex-col justify-center items-center group transition-all"
          :class="
            !showAnswer &&
            'cursor-pointer hover:border-indigo-500/50 hover:bg-zinc-800/60 hover:shadow-xl hover:shadow-indigo-500/10'
          "
          :role="showAnswer ? undefined : 'button'"
          :tabindex="showAnswer ? -1 : 0"
          @click="revealAnswer"
          @keydown.enter.prevent="revealAnswer"
          @keydown.space.prevent="revealAnswer"
        >
          <button
            @click.stop="speak(currentWord.word, cardSpeechKey)"
            :disabled="isSpeechDisabled"
            :title="speechLabelFor(cardSpeechKey) || 'Pronunciar'"
            :aria-label="speechLabelFor(cardSpeechKey) || 'Pronunciar'"
            class="absolute top-4 right-4 p-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <LoaderCircle
              v-if="isLoadingFor(cardSpeechKey)"
              class="w-6 h-6 animate-spin"
            />
            <Volume2
              v-else
              class="w-6 h-6"
              :class="
                isSpeakingFor(cardSpeechKey) && 'text-indigo-400 animate-pulse'
              "
            />
          </button>
          <div class="space-y-4 w-full">
            <span
              v-if="currentWord.phonetic"
              class="text-indigo-400/90 font-mono tracking-widest text-sm inline-block px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20"
            >
              {{ currentWord.phonetic }}
            </span>
            <h2 class="text-4xl sm:text-5xl font-bold text-slate-50 capitalize">
              {{ currentWord.word }}
            </h2>
            <p
              v-if="!showAnswer"
              class="text-zinc-500 text-xs sm:text-sm tracking-wide pt-2"
            >
              Toca la tarjeta para ver la respuesta
            </p>
          </div>
        </div>

        <!-- Tarjeta trasera (Respuesta) -->
        <div
          v-show="showAnswer"
          class="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          <div
            class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden"
          >
            <!-- Significados -->
            <div v-if="currentWord.meanings?.length" class="space-y-4">
              <h3
                class="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2"
              >
                <BookOpen class="w-4 h-4" /> Meanings
              </h3>
              <div
                v-for="(meaning, index) in currentWord.meanings"
                :key="index"
                class="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4 sm:p-5 space-y-3"
              >
                <span
                  class="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-md capitalize font-medium"
                >
                  {{ meaning.part_of_speech }}
                </span>
                <p class="text-slate-200 text-sm leading-relaxed">
                  {{ meaning.definition_es }}
                </p>
                <div
                  class="bg-zinc-900/50 p-3 sm:p-4 rounded-lg border border-zinc-800/60 space-y-1.5 relative group"
                >
                  <p class="text-slate-100 text-sm leading-relaxed italic pr-8">
                    "{{ meaning.example_en }}"
                  </p>
                  <button
                    @click.stop="
                      speak(meaning.example_en, exampleSpeechKey(index))
                    "
                    :disabled="isSpeechDisabled"
                    :title="
                      speechLabelFor(exampleSpeechKey(index)) ||
                      'Pronunciar ejemplo'
                    "
                    :aria-label="
                      speechLabelFor(exampleSpeechKey(index)) ||
                      'Pronunciar ejemplo'
                    "
                    class="absolute top-2 right-2 p-1.5 text-zinc-500 shrink-0 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <LoaderCircle
                      v-if="isLoadingFor(exampleSpeechKey(index))"
                      class="w-4 h-4 animate-spin"
                    />
                    <Volume2
                      v-else
                      class="w-4 h-4"
                      :class="
                        isSpeakingFor(exampleSpeechKey(index)) &&
                        'text-indigo-400 animate-pulse'
                      "
                    />
                  </button>
                  <p class="text-zinc-500 text-xs sm:text-sm">
                    {{ meaning.example_es }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Botones de Calificación -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <button
              @click="handleRate(1)"
              class="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer group gap-2"
            >
              <RotateCcw
                class="w-6 h-6 text-rose-400 group-hover:scale-110 transition-transform"
              />
              <span class="text-rose-400 font-medium text-sm">Otra vez</span>
              <span class="text-zinc-500 text-xs text-center">Menos de 1m</span>
            </button>
            <button
              @click="handleRate(3)"
              class="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/10 rounded-xl transition-all cursor-pointer group gap-2"
            >
              <Frown
                class="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform"
              />
              <span class="text-amber-400 font-medium text-sm">Difícil</span>
              <span class="text-zinc-500 text-xs font-mono">1 d</span>
            </button>
            <button
              @click="handleRate(4)"
              class="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/10 rounded-xl transition-all cursor-pointer group gap-2"
            >
              <CheckCircle2
                class="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform"
              />
              <span class="text-emerald-400 font-medium text-sm">Bien</span>
              <span class="text-zinc-500 text-xs font-mono">4-6 d</span>
            </button>
            <button
              @click="handleRate(5)"
              class="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/10 rounded-xl transition-all cursor-pointer group gap-2"
            >
              <Smile
                class="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform"
              />
              <span class="text-blue-400 font-medium text-sm">Fácil</span>
              <span class="text-zinc-500 text-xs font-mono">10+ d</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Maestría de Palabra -->
    <BaseModal
      v-if="showMasteryModal"
      title="¡Palabra Dominada!"
      tone="amber"
      @close="handleKeepWord"
    >
      <template #icon>
        <AlertTriangle class="w-8 h-8 text-amber-500" />
      </template>

      <p>
        Has repasado
        <span class="text-slate-200 font-semibold uppercase"
          >"{{ wordToDecide?.word }}"</span
        >
        5 veces exitosamente. ¿Qué deseas hacer con esta palabra?
      </p>

      <template #actions>
        <div class="flex flex-col gap-3 w-full">
          <button
            @click="handleKeepWord"
            class="w-full bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-medium px-4 py-3 rounded-xl transition-colors text-sm cursor-pointer border border-zinc-700/50"
          >
            Conservar en mi lista
          </button>
          <button
            @click="handleDeleteWord"
            class="w-full bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-3 rounded-xl transition-colors shadow-lg shadow-red-500/20 text-sm cursor-pointer"
          >
            Eliminar palabra
          </button>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
