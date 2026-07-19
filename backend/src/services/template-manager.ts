import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

const storageDir = 'storage';
const templatesDir = path.join(storageDir, 'templates');

// Ensure directory exists
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

export interface SavedTemplate {
  name: string;
  template: string;
}

/**
 * Loads all saved templates from storage/templates/ folder.
 */
export const loadSavedTemplates = (): SavedTemplate[] => {
  try {
    const files = fs.readdirSync(templatesDir);
    const templates: SavedTemplate[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(templatesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        try {
          const parsed = JSON.parse(content);
          if (parsed.name && parsed.template) {
            templates.push(parsed);
          }
        } catch (parseErr: any) {
          logger.error(`Error parsing template file ${file}: ${parseErr.message}`);
        }
      }
    }
    return templates;
  } catch (error: any) {
    logger.error(`Failed to load saved templates: ${error.message}`);
    return [];
  }
};

/**
 * Saves a message template to storage/templates/ folder.
 */
export const saveMessageTemplate = (name: string, template: string): boolean => {
  try {
    const cleanName = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
    if (!cleanName) {
      throw new Error('Invalid template name');
    }
    const filePath = path.join(templatesDir, `${cleanName}.json`);
    const data: SavedTemplate = { name: cleanName, template };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    logger.info(`Message template saved: ${cleanName}`);
    return true;
  } catch (error: any) {
    logger.error(`Failed to save template: ${error.message}`);
    return false;
  }
};

/**
 * Deletes a template from disk.
 */
export const deleteMessageTemplate = (name: string): boolean => {
  try {
    const cleanName = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
    const filePath = path.join(templatesDir, `${cleanName}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Message template deleted: ${cleanName}`);
      return true;
    }
    return false;
  } catch (error: any) {
    logger.error(`Failed to delete template: ${error.message}`);
    return false;
  }
};
