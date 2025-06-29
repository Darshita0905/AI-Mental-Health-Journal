<template>
  <div class="dashboard">
    <h2>📈 Mood Trend</h2>
<div style="margin-bottom: 12px;">
  <label for="range">View mood trend for:</label>
  <select id="range" v-model="selectedRange">
    <option :value="7">Last 7 days</option>
    <option :value="14">Last 14 days</option>
    <option :value="30">Last 30 days</option>
  </select>
</div>

    <Line v-if="moodChartData" :data="moodChartData" :options="moodOptions" />
    <p v-else>No mood data available yet. Write some journal entries to see your mood trend!</p>

    <h2>📊 Word Usage</h2>
    <Bar v-if="wordChartData" :data="wordChartData" :options="wordOptions" />
     <p v-else>No word usage data yet. Start journaling to see which words you use most.</p>
  </div>
</template>

<script setup>


import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement
} from 'chart.js';
import { Line, Bar } from 'vue-chartjs';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ref, onMounted, watch } from 'vue';

const selectedRange = ref(7); // default to 7 days
const journalEntries = ref([]); // to store fetched entries

// Register Chart.js modules
ChartJS.register(Title, Tooltip, Legend, LineElement, BarElement, CategoryScale, LinearScale, PointElement);

// ✅ Step 1: Initialize chart data as null (important!)
const moodChartData = ref(null);
const wordChartData = ref(null);

// ✅ Step 2: Provide options for charts
const moodOptions = ref({
  responsive: true,
  plugins: {
    legend: { display: true }
  }
});

const wordOptions = ref({
  responsive: true,
  plugins: {
    legend: { display: true }
  }
});

// ✅ Step 3: Process Firestore data
const processJournalData = (entries) => {
  const moodLabels = [];
  const moodValues = [];
  const wordCounts = {};

  for (const entry of entries) {
    moodLabels.push(entry.date);
    moodValues.push(entry.sentiment ?? 0);

    const words = entry.text.toLowerCase().split(/\W+/);
    for (const word of words) {
      if (word.length < 3) continue;
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  }



  const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  wordChartData.value = {
    labels: sortedWords.map(w => w[0]),
    datasets: [{
      label: 'Word Frequency',
      data: sortedWords.map(w => w[1]),
      backgroundColor: ['green', 'orange', 'purple', 'red', 'blue']
    }]
  };
};
function generateMoodChart(entries, numberOfDays = 7) {
  const moodMap = {};
  for (const entry of entries) {
    moodMap[entry.date] = entry.sentiment ?? 0;
  }

  const moodLabels = [];
  const moodValues = [];
  const today = new Date();

  for (let i = numberOfDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    moodLabels.push(iso);
    moodValues.push(moodMap[iso] ?? 0);
  }

  moodChartData.value = {
    labels: moodLabels,
    datasets: [
      {
        label: "Mood (Happy = 1, Neutral = 0, Sad = -1)",
        data: moodValues,
        borderColor: "blue",
        backgroundColor: "lightblue",
        tension: 0.3,
      },
    ],
  };
}


// ✅ Step 4: Fetch entries on mount
import { onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const journalRef = collection(db, 'journalEntries');
  const q = query(journalRef, where('userId', '==', user.uid), orderBy('date'));
  const snapshot = await getDocs(q);
  const entries = snapshot.docs.map(doc => doc.data());

 if (entries.length > 0) {
  journalEntries.value = entries; // store globally
  generateMoodChart(journalEntries.value, selectedRange.value);
  processJournalData(journalEntries.value);
}else {
  moodChartData.value = null;
  wordChartData.value = null;
}

});

watch(selectedRange, (newVal) => {
  if (journalEntries.value.length > 0) {
    generateMoodChart(journalEntries.value, newVal);
  }
});


</script>
