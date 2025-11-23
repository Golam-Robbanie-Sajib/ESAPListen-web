/**
 * Detects urgency/importance in event titles and descriptions
 */

export interface UrgencyResult {
  isUrgent: boolean;
  level: 'high' | 'medium' | 'low';
  keywords: string[];
}

const URGENT_KEYWORDS = {
  high: ['urgent', 'asap', 'critical', 'emergency', 'immediately', 'now', 'today'],
  medium: ['important', 'priority', 'soon', 'needed', 'required', 'deadline'],
  low: ['fyi', 'info', 'note', 'optional']
};

export function detectUrgency(text: string): UrgencyResult {
  if (!text) {
    return { isUrgent: false, level: 'low', keywords: [] };
  }

  const lowerText = text.toLowerCase();
  const foundKeywords: string[] = [];
  let level: 'high' | 'medium' | 'low' = 'low';

  // Check high priority keywords first
  for (const keyword of URGENT_KEYWORDS.high) {
    if (lowerText.includes(keyword)) {
      foundKeywords.push(keyword);
      level = 'high';
    }
  }

  // If no high priority, check medium
  if (level !== 'high') {
    for (const keyword of URGENT_KEYWORDS.medium) {
      if (lowerText.includes(keyword)) {
        foundKeywords.push(keyword);
        level = 'medium';
      }
    }
  }

  const isUrgent = level === 'high' || level === 'medium';

  return {
    isUrgent,
    level,
    keywords: foundKeywords
  };
}

export function getUrgencyStyles(level: 'high' | 'medium' | 'low') {
  switch (level) {
    case 'high':
      return {
        border: 'border-red-500',
        bg: 'bg-red-50 dark:bg-red-900/20',
        cardBg: 'bg-red-100 dark:bg-red-900/50',
        badge: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
        text: 'text-red-700 dark:text-red-300',
        icon: '🔴'
      };
    case 'medium':
      return {
        border: 'border-orange-500',
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        cardBg: 'bg-orange-50 dark:bg-orange-900/30',
        badge: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
        text: 'text-orange-700 dark:text-orange-300',
        icon: '🟠'
      };
    default:
      return {
        border: 'border-indigo-500',
        bg: '',
        cardBg: '',
        badge: '',
        text: '',
        icon: ''
      };
  }
}
