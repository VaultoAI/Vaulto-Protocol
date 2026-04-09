/**
 * Vaulto API Configuration
 *
 * Centralized configuration for Vaulto API connectivity.
 * Provides validation, logging, and debug helpers.
 */

// Environment variable names
const ENV_TOKEN = "VAULTO_API_TOKEN";
const ENV_URL = "VAULTO_API_URL";
const ENV_URL_PUBLIC = "NEXT_PUBLIC_VAULTO_API_URL";

/**
 * Check if Vaulto API is fully configured
 */
export function isVaultoApiConfigured(): boolean {
  const hasToken = !!process.env[ENV_TOKEN];
  const hasUrl = !!(process.env[ENV_URL] || process.env[ENV_URL_PUBLIC]);
  return hasToken && hasUrl;
}

/**
 * Get the Vaulto API token
 * @throws Error if not configured (in dev mode only)
 * @returns Token string or empty string
 */
export function getVaultoApiToken(): string {
  const token = process.env[ENV_TOKEN] || "";
  return token;
}

/**
 * Check if Vaulto API token is configured
 */
export function isVaultoApiTokenConfigured(): boolean {
  return !!process.env[ENV_TOKEN];
}

/**
 * Get the Vaulto API base URL
 * @throws Error if not configured
 */
export function getVaultoApiUrl(): string {
  const url = process.env[ENV_URL] || process.env[ENV_URL_PUBLIC];
  if (!url) {
    throw new Error(
      `Vaulto API URL not configured. Set ${ENV_URL} or ${ENV_URL_PUBLIC} environment variable.`
    );
  }
  return url;
}

/**
 * Check if Vaulto API URL is configured
 */
export function isVaultoApiUrlConfigured(): boolean {
  return !!(process.env[ENV_URL] || process.env[ENV_URL_PUBLIC]);
}

/**
 * Get safe debug info about Vaulto API config (no secrets)
 */
export function getVaultoApiDebugInfo(): {
  tokenConfigured: boolean;
  tokenLength: number;
  urlConfigured: boolean;
  urlSource: string | null;
  urlLength: number;
} {
  const token = process.env[ENV_TOKEN] || "";
  const url = process.env[ENV_URL] || process.env[ENV_URL_PUBLIC] || "";
  const urlSource = process.env[ENV_URL]
    ? ENV_URL
    : process.env[ENV_URL_PUBLIC]
      ? ENV_URL_PUBLIC
      : null;

  return {
    tokenConfigured: !!token,
    tokenLength: token.length,
    urlConfigured: !!url,
    urlSource,
    urlLength: url.length,
  };
}

/**
 * Log Vaulto API config status (for startup/debugging)
 */
export function logVaultoApiConfigStatus(): void {
  const debug = getVaultoApiDebugInfo();
  const isConfigured = isVaultoApiConfigured();

  if (isConfigured) {
    console.log(
      `[Vaulto API] Configuration OK - Token: ${debug.tokenLength} chars, URL: ${debug.urlSource} (${debug.urlLength} chars)`
    );
  } else {
    const missing: string[] = [];
    if (!debug.tokenConfigured) {
      missing.push(ENV_TOKEN);
    }
    if (!debug.urlConfigured) {
      missing.push(`${ENV_URL} or ${ENV_URL_PUBLIC}`);
    }
    console.warn(
      `[Vaulto API] Configuration INCOMPLETE - Missing: ${missing.join(", ")}`
    );
  }
}

/**
 * Get a descriptive error message for missing config
 */
export function getVaultoApiConfigError(): string {
  const debug = getVaultoApiDebugInfo();
  const missing: string[] = [];

  if (!debug.tokenConfigured) {
    missing.push(ENV_TOKEN);
  }
  if (!debug.urlConfigured) {
    missing.push(`${ENV_URL} or ${ENV_URL_PUBLIC}`);
  }

  if (missing.length === 0) {
    return "";
  }

  return `Vaulto API not configured. Missing environment variable(s): ${missing.join(", ")}`;
}
