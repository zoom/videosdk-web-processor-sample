import { saveToStorage, loadFromStorage, clearFromStorage } from './util';

// Configuration type
export interface SessionConfig {
  webRTCAudio: string;
  webRTCVideo: string;
  coep: string;
  sdkVersion: string;
}

// Default configuration
export const DEFAULT_CONFIG: SessionConfig = {
  webRTCAudio: "auto",
  webRTCVideo: "auto",
  coep: "disable corp",
  sdkVersion: ""
};

// Storage key for configuration
export const CONFIG_STORAGE_KEY = 'zoom_session_config';

/**
 * Save configuration to localStorage
 * @param config Session configuration object
 */
export function saveConfigToStorage(config: SessionConfig): void {
  saveToStorage(CONFIG_STORAGE_KEY, config);
}

/**
 * Load configuration from localStorage
 * @returns Saved configuration or default config if none exists
 */
export function loadConfigFromStorage(): SessionConfig {
  return loadFromStorage(CONFIG_STORAGE_KEY, DEFAULT_CONFIG);
}

/**
 * Clear configuration from localStorage
 */
export function clearConfigFromStorage(): void {
  clearFromStorage(CONFIG_STORAGE_KEY);
}