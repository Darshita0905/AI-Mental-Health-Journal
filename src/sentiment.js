import vader from 'vader-sentiment';

export function analyzeSentiment(text) {
  const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(text);
  return intensity.compound; // Value between -1 (very negative) and +1 (very positive)
}

export function classifyMood(score) {
  if (score === undefined || score === null) return 'unknown';
  if (score > 0.4) return 'happy';
  if (score < -0.2) return 'sad';
  return 'neutral';
}


 