import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { AutomationSettings } from '../types/index.js';

const storageDir = 'storage';
const settingsFile = path.join(storageDir, 'settings.json');

const DEFAULT_SETTINGS: AutomationSettings = {
  websiteUrl: 'https://YOUR-WEDDING-LINK.com',
  delayMin: 5,
  delayMax: 10,
  batchSize: 20,
  batchDelayMin: 60,
  batchDelayMax: 120,
  retryCount: 3,
  pauseDuration: 10,
  theme: 'dark',
  messageTemplate: 'Hi {{name}} 😊\n\nWe are delighted to invite you to our wedding.\n\nPlease visit our Wedding Invitation\n\nhttps://YOUR-WEDDING-LINK.com\n\nYour presence would mean a lot to us.\n\nThank you ❤️',
  testMode: false,
  dryRunMode: false,
  debugMode: false
};

// Ensure storage directory exists
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

/**
 * Loads settings from the local JSON file.
 * Falls back to default settings if file doesn't exist or is corrupted.
 */
export const loadSettings = (): AutomationSettings => {
  try {
    if (!fs.existsSync(settingsFile)) {
      saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const data = fs.readFileSync(settingsFile, 'utf8');
    const settings = JSON.parse(data);
    // Ensure all default settings properties exist (forward compatibility)
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error: any) {
    logger.error(`Failed to load settings: ${error.message}`);
    return DEFAULT_SETTINGS;
  }
};

/**
 * Saves settings to the local JSON file.
 * @param settings - Settings object to persist
 */
export const saveSettings = (settings: AutomationSettings): boolean => {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
    logger.info('Application settings saved successfully');
    return true;
  } catch (error: any) {
    logger.error(`Failed to save settings: ${error.message}`);
    return false;
  }
};

/**
 * Validates whether an uploaded settings object contains the required fields.
 */
export const isValidSettings = (settings: any): settings is AutomationSettings => {
  if (!settings || typeof settings !== 'object') return false;
  const requiredKeys = ['delayMin', 'delayMax', 'batchSize', 'retryCount', 'messageTemplate'];
  return requiredKeys.every(key => key in settings);
};
