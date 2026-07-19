import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { Contact, AutomationSettings } from '../types/index.js';

const storageDir = 'storage';
const resumeStateFile = path.join(storageDir, 'resume_state.json');

export interface ResumeState {
  contacts: Contact[];
  currentIndex: number;
  settings: AutomationSettings;
  stats: {
    successCount: number;
    failedCount: number;
    completed: number;
  };
  timestamp?: number;
}

// Ensure directory exists
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

/**
 * Saves current execution progress to resume_state.json.
 */
export const saveResumeState = (state: ResumeState): void => {
  try {
    const data: ResumeState = {
      contacts: state.contacts || [],
      currentIndex: state.currentIndex || 0,
      settings: state.settings,
      stats: state.stats || { successCount: 0, failedCount: 0, completed: 0 },
      timestamp: Date.now()
    };
    fs.writeFileSync(resumeStateFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (error: any) {
    logger.error(`Failed to save resume state: ${error.message}`);
  }
};

/**
 * Loads previous resume state if it exists.
 * Returns null if no state exists.
 */
export const loadResumeState = (): ResumeState | null => {
  try {
    if (!fs.existsSync(resumeStateFile)) {
      return null;
    }
    const data = fs.readFileSync(resumeStateFile, 'utf8');
    const state = JSON.parse(data) as ResumeState;
    logger.info(`Resume state loaded: ${state.contacts.length} contacts, next index to process: ${state.currentIndex}`);
    return state;
  } catch (error: any) {
    logger.error(`Failed to load resume state: ${error.message}`);
    return null;
  }
};

/**
 * Clears the resume state file. Called upon successful run completion or user stop.
 */
export const clearResumeState = (): void => {
  try {
    if (fs.existsSync(resumeStateFile)) {
      fs.unlinkSync(resumeStateFile);
      logger.info('Resume state cleared');
    }
  } catch (error: any) {
    logger.error(`Failed to clear resume state: ${error.message}`);
  }
};

/**
 * Checks if a resume state is currently available on disk.
 */
export const hasResumeState = (): boolean => {
  return fs.existsSync(resumeStateFile);
};
