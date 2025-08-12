/**
 * Centralized image definitions and helper selectors for ticket/chat cards.
 * Keeping legacy global variable names (imageBase, imageSuffix, images) so
 * existing legacy code (sendToChat) continues to work without modification.
 */

const IMAGE_BASE = 'https://github.com/thinkle-iacs/chromebook-ticket-system/blob/main/icons/';
const IMAGE_SUFFIX = '?raw=true';
const IMAGES = {
  'screen': 'screen.png',
  'wet': 'wet.png',
  "won't turn on": 'no-on.png',
  'printer': 'printer.png',
  'keys': 'keyboard.png',
  'log-in': 'log-in.png',
  'camera and/or microphone': 'no-mic.png',
  'frame': 'frame.png',
};

// Expose legacy variable names for compatibility (GAS global scope).
var imageBase = IMAGE_BASE;
var imageSuffix = IMAGE_SUFFIX;
var images = IMAGES;

/**
 * Return a fully-qualified image URL for a given problem or description.
 * Tries exact key match first, then substring search (case-insensitive).
 * @param {string} problemOrDescription
 * @returns {string|undefined}
 */
function pickTicketImage(problemOrDescription) {
  if (!problemOrDescription) return undefined;
  const text = ('' + problemOrDescription).toLowerCase();
  // Exact key match first
  for (const key in IMAGES) {
    if (text === key.toLowerCase()) {
      return IMAGE_BASE + IMAGES[key] + IMAGE_SUFFIX;
    }
  }
  // Substring match fallback
  for (const key in IMAGES) {
    if (text.includes(key.toLowerCase())) {
      return IMAGE_BASE + IMAGES[key] + IMAGE_SUFFIX;
    }
  }
  return undefined;
}

/**
 * Convenience: attempt to derive an image from a responseMap.
 * Checks common fields for a problem indicator.
 * @param {Object} responseMap
 */
function pickTicketImageFromResponseMap(responseMap) {
  if (!responseMap) return undefined;
  const candidates = [
    'What is the problem with your chromebook?',
    'Problem Description',
    'Incident Description',
    'Computer Status'
  ];
  for (let field of candidates) {
    if (responseMap[field] && responseMap[field][0]) {
      const img = pickTicketImage(responseMap[field][0]);
      if (img) return img;
    }
  }
  // As a last resort, scan all values
  for (let k in responseMap) {
    const arr = responseMap[k];
    if (Array.isArray(arr)) {
      for (let v of arr) {
        const img = pickTicketImage(v);
        if (img) return img;
      }
    }
  }
  return undefined;
}

/**
 * For new Airtable-first flow: derive an image using a provided problem string
 * or (if absent) by scanning the description text.
 * @param {string} problem
 * @param {string} description
 */
function pickTicketImageForNewFlow(problem, description) {
  let img = pickTicketImage(problem);
  if (img) return img;
  return pickTicketImage(description);
}
