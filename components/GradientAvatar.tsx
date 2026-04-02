/**
 * Gradient Avatar Component
 * SVG-based circular gradient avatar using wallet address for deterministic colors
 */

interface GradientAvatarProps {
  address: string;
  size?: number;
  className?: string;
}

// Possible gradient angles
const GRADIENT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

// Hue offsets for color harmony
const HUE_OFFSETS = [30, 45, 60, 120, 150, 180];

/**
 * Extract a number from hex address bytes at given position
 */
function getByteValue(address: string, byteIndex: number): number {
  // Remove 0x prefix if present
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  // Each byte is 2 hex characters
  const start = (byteIndex % (hex.length / 2)) * 2;
  const byteHex = hex.slice(start, start + 2);
  return parseInt(byteHex, 16) || 0;
}

/**
 * Simple hash for the whole address
 */
function hashAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function GradientAvatar({
  address,
  size = 32,
  className = "",
}: GradientAvatarProps) {
  // Generate deterministic colors from address
  const hash = hashAddress(address);

  // Primary color: Use first bytes for hue
  const primaryHue = (getByteValue(address, 0) + getByteValue(address, 1)) % 360;
  // Saturation: 65-90%
  const primarySaturation = 65 + (getByteValue(address, 2) % 26);
  // Lightness: 55-70%
  const primaryLightness = 55 + (getByteValue(address, 3) % 16);

  // Secondary color: Apply hue offset for color harmony
  const hueOffsetIndex = getByteValue(address, 4) % HUE_OFFSETS.length;
  const hueOffset = HUE_OFFSETS[hueOffsetIndex];
  const secondaryHue = (primaryHue + hueOffset) % 360;
  // Vary saturation and lightness slightly
  const secondarySaturation = 65 + (getByteValue(address, 5) % 26);
  const secondaryLightness = 55 + (getByteValue(address, 6) % 16);

  // Gradient angle
  const angleIndex = hash % GRADIENT_ANGLES.length;
  const angle = GRADIENT_ANGLES[angleIndex];

  // Convert angle to SVG gradient coordinates
  const angleRad = (angle * Math.PI) / 180;
  const x1 = 50 - Math.cos(angleRad) * 50;
  const y1 = 50 - Math.sin(angleRad) * 50;
  const x2 = 50 + Math.cos(angleRad) * 50;
  const y2 = 50 + Math.sin(angleRad) * 50;

  const primaryColor = `hsl(${primaryHue}, ${primarySaturation}%, ${primaryLightness}%)`;
  const secondaryColor = `hsl(${secondaryHue}, ${secondarySaturation}%, ${secondaryLightness}%)`;

  // Create unique gradient ID based on address
  const gradientId = `gradient-${address.slice(2, 10)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ borderRadius: "50%" }}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1={`${x1}%`}
          y1={`${y1}%`}
          x2={`${x2}%`}
          y2={`${y2}%`}
        >
          <stop offset="0%" stopColor={primaryColor} />
          <stop offset="100%" stopColor={secondaryColor} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
    </svg>
  );
}
