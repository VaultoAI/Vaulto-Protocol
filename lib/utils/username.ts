/**
 * Deterministic username generator based on wallet address
 * Format: Adjective + Noun + 2-digit number (e.g., "SwiftFox42")
 */

const ADJECTIVES = [
  "Swift",
  "Brave",
  "Cosmic",
  "Noble",
  "Lunar",
  "Solar",
  "Mystic",
  "Rapid",
  "Bold",
  "Wise",
  "Calm",
  "Vivid",
  "Prime",
  "Royal",
  "Epic",
  "Agile",
  "Quiet",
  "Lively",
  "Bright",
  "Keen",
  "Grand",
  "Lucky",
  "Clever",
  "Zesty",
  "Daring",
  "Serene",
  "Radiant",
  "Nimble",
  "Stellar",
  "Gleeful",
  "Witty",
  "Gentle",
];

const NOUNS = [
  "Fox",
  "Eagle",
  "Wolf",
  "Hawk",
  "Bear",
  "Lion",
  "Tiger",
  "Raven",
  "Falcon",
  "Otter",
  "Lynx",
  "Stag",
  "Owl",
  "Puma",
  "Viper",
  "Shark",
  "Crane",
  "Drake",
  "Moose",
  "Bison",
  "Koala",
  "Panda",
  "Rhino",
  "Whale",
  "Cobra",
  "Gecko",
  "Lemur",
  "Finch",
  "Heron",
  "Orca",
  "Panther",
  "Phoenix",
];

/**
 * Simple hash function to convert wallet address to a number
 */
function hashAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a deterministic username from a wallet address
 * @param address - The wallet address (e.g., "0x1234...")
 * @returns A username like "SwiftFox42"
 */
export function generateUsername(address: string): string {
  const hash = hashAddress(address);

  // Use different parts of the hash for each component
  const adjIndex = hash % ADJECTIVES.length;
  const nounIndex = Math.floor(hash / ADJECTIVES.length) % NOUNS.length;
  const number = Math.floor(hash / (ADJECTIVES.length * NOUNS.length)) % 100;

  const adjective = ADJECTIVES[adjIndex];
  const noun = NOUNS[nounIndex];
  const suffix = number.toString().padStart(2, "0");

  return `${adjective}${noun}${suffix}`;
}
