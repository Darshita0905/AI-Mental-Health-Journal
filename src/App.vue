<template>
   <div class="app-background">
    <div class="container">
    <h1>📘 Your Private Journal</h1>

    <!-- ✅ Daily Prompt Box -->
     <transition name="fade">
    <div v-if="dailyPrompt" class="prompt-box">
      <p>📝 {{ dailyPrompt }}</p>
    </div>
    </transition>

    <input type="date" v-model="date" />
    <textarea v-model="entry" rows="5" placeholder="How was your day?"></textarea>
    <button @click="saveToFirestore" :disabled="!userId">Save Entry</button>

    <div v-if="userId">
      <h2>🗂 Past Entries</h2>
      <ul>
        <transition-group name="fade" tag="ul">
        <li v-for="item in journalEntries" :key="item.id">
          <strong>{{ item.date }}</strong>: {{ item.text }}
          <br />
          <small>🧠 Mood:
            <span v-if="item.sentiment !== undefined">
              {{ classifyMood(item.sentiment) }} ({{ item.sentiment.toFixed(4) }})
            </span>
            <span v-else>
              Analyzing...
            </span>
          </small>
        </li>
        </transition-group>
      </ul>

      <transition name="fade">
      <div v-if="weeklySummary" class="weekly-summary">
        <h2>🧾 Weekly Mood Summary</h2>
        <p>Average mood score: {{ weeklySummary.averageSentiment.toFixed(2) }}</p>
        <p>😊 Most positive day: {{ weeklySummary.mostPositiveDay.date }}</p>
        <p>😞 Most challenging day: {{ weeklySummary.mostNegativeDay.date }}</p>
        <h4>🧠 Weekly Insight</h4>
        <p>{{ weeklySummary.insight }}</p>
      </div>
      </transition>

      <transition name="fade">
        <div class="mood-dashboard">
          <MoodDashboard />
        </div>
      </transition>
    </div>

    <div v-else>
      <p>🔒 Please wait... loading your private journal.</p>
    </div>
  </div>
  <footer class="privacy-disclaimer">
  🔒 Your journal is private and stored securely in your Firebase account. No entries are shared or accessed by anyone else.
</footer>

</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { db, auth } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { analyzeSentiment, classifyMood } from './sentiment';
import MoodDashboard from './components/MoodDashboard.vue';

const entry = ref('');
const date = ref('');
const journalEntries = ref([]);
const userId = ref(null);
const weeklySummary = ref(null);
const recentMoods = ref([]);
const dailyPrompt = ref('');

const saveToFirestore = async () => {
  if (!entry.value || !date.value || !userId.value) {
    console.log("Missing data - not saving");
    return;
  }

  try {
    const sentiment = analyzeSentiment(entry.value);
    console.log("Sentiment:", sentiment);

    await addDoc(collection(db, 'journalEntries'), {
      text: entry.value,
      date: date.value,
      createdAt: new Date(),
      userId: userId.value,
      sentiment: sentiment
    });

    entry.value = '';
    date.value = '';
    await loadEntries();
    await generateWeeklySummary(); // Refresh summary
  } catch (error) {
    console.error("Error saving entry:", error);
  }
};

const loadEntries = async () => {
  if (!userId.value) {
    console.log("User ID not set - skipping load");
    return;
  }

  try {
    const q = query(
      collection(db, 'journalEntries'),
      where('userId', '==', userId.value),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    journalEntries.value = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      journalEntries.value.push({ id: doc.id, ...data });
    });
  } catch (err) {
    console.error("Failed to load entries:", err);
  }
};

const generateWeeklySummary = async () => {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const q = query(
    collection(db, 'journalEntries'),
    where('userId', '==', userId.value),
    where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo))
  );

  const snapshot = await getDocs(q);
  const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (entries.length === 0) {
    weeklySummary.value = null;
    return;
  }

  const analyzed = entries.map(entry => ({
    ...entry,
    sentimentScore: analyzeSentiment(entry.text)
  }));

  const avg = analyzed.reduce((sum, e) => sum + e.sentimentScore, 0) / analyzed.length;
  const mostPos = analyzed.reduce((max, e) => e.sentimentScore > max.sentimentScore ? e : max, analyzed[0]);
  const mostNeg = analyzed.reduce((min, e) => e.sentimentScore < min.sentimentScore ? e : min, analyzed[0]);
  const trend = analyzed[analyzed.length - 1].sentimentScore - analyzed[0].sentimentScore;

  let insight = "";

  if (avg >= 0.5) {
    insight = trend > 0
      ? "🌟 You had a strong, positive week and things are looking even better toward the end!"
      : "😊 Overall a good week, even if a few moments felt off — keep holding on to the positive energy!";
  } else if (avg <= -0.5) {
    insight = trend < 0
      ? "💙 This week seems heavy. It's okay to feel down sometimes — be kind to yourself and take it one step at a time."
      : "😔 Things may have started tough, but you're ending on a slightly brighter note — that's strength!";
  } else {
    insight = trend > 0
      ? "📈 You’re showing signs of emotional recovery — keep nurturing yourself!"
      : "🌀 A mixed week. Maybe take a moment to reflect on what’s been on your mind lately.";
  }

  weeklySummary.value = {
    averageSentiment: avg,
    mostPositiveDay: mostPos,
    mostNegativeDay: mostNeg,
    entries: analyzed,
    insight
  };
};

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      userId.value = user.uid;
      await loadRecentMoods();
      await loadEntries();
      await generateWeeklySummary();
    } else {
      console.log("User not signed in");
    }
  });
});

// ✅ FIXED: convert sentiment scores to mood labels
async function loadRecentMoods() {
  const q = query(
    collection(db, 'journalEntries'),
    where('userId', '==', userId.value),
    orderBy('createdAt', 'desc'),
    limit(5)
  );

  const snapshot = await getDocs(q);
  const moods = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const score = data.sentiment;

    if (score !== undefined) {
      if (score >= 0.5) moods.push('happy');
      else if (score <= -0.5) moods.push('sad');
      else moods.push('neutral');
    }
  });

  recentMoods.value = moods;
  generatePromptFromMood(moods);
}

function generatePromptFromMood(moods) {
  if (!moods.length) {
    dailyPrompt.value = "How are you feeling today? Let's explore your thoughts.";
    return;
  }

  const moodCounts = { happy: 0, sad: 0, neutral: 0 };
  moods.forEach((m) => moodCounts[m]++);

  const mostCommonMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0][0];

  const prompts = {
    happy: "You've been feeling great lately! Want to write about what you're grateful for?",
    sad: "Things seem tough recently. Want to explore something that brings you comfort or joy?",
    neutral: "Feeling steady? Reflect on what gives you balance in your day.",
  };

  dailyPrompt.value = prompts[mostCommonMood] || "How are you feeling today?";
}


</script>

<style scoped>
.container {
  width: 100%;
  max-width: none;
  padding: 1rem;
  box-sizing: border-box;
  font-family: sans-serif;
}
textarea,
input[type='date'] {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem;
  font-size: 1rem;
}
button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  font-weight: bold;
  cursor: pointer;
}
ul {
  padding: 0;
  list-style: none;
}
li {
  background: #f0f0f0;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
}

.prompt-box {
  background-color: #f0f4ff;
  padding: 1rem;
  border-radius: 10px;
  margin-bottom: 1rem;
  font-style: italic;
  
}
/* Smooth fade transition */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
button {
  display: block;
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  font-weight: bold;
  cursor: pointer;
}

.app-background {
  background-color: #e0f7ff;
  min-height: 100vh;
  padding: 2rem;
  box-sizing: border-box;
}
h2 {
  margin-top: 2rem;
  margin-bottom: 1rem;
}

button {
  margin-top: 0.75rem;
  margin-bottom: 2rem; /* ✅ Space between Save Entry and Past Entries */
}

.weekly-summary {
  margin-top: 2rem;
}

.mood-dashboard {
  margin-top: 2rem;
}

.privacy-disclaimer {
  text-align: center;
  font-size: 0.85rem;
  padding: 1rem;
  color: #ffffff;
  background-color: #0077cc;
  position: fixed;
  bottom: 0;
  width: 100%;
  z-index: 1000;
}


</style>
<style>

html, body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}



</style>
