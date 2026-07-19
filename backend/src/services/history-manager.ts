import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { CampaignHistoryItem, Contact } from '../types/index.js';

const storageDir = 'storage';
const historyIndexFile = path.join(storageDir, 'csv_history.json');
const campaignsDir = path.join(storageDir, 'campaigns');

// Ensure directories exist
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}
if (!fs.existsSync(campaignsDir)) {
  fs.mkdirSync(campaignsDir, { recursive: true });
}

/**
 * Loads all campaign history index entries.
 */
export const loadCampaignHistoryIndex = (): CampaignHistoryItem[] => {
  try {
    if (!fs.existsSync(historyIndexFile)) {
      return [];
    }
    const data = fs.readFileSync(historyIndexFile, 'utf8');
    return JSON.parse(data) as CampaignHistoryItem[];
  } catch (error: any) {
    logger.error(`Failed to load campaign history index: ${error.message}`);
    return [];
  }
};

/**
 * Saves a new campaign history item.
 */
export const saveCampaignToHistory = (
  filename: string,
  contacts: Contact[]
): CampaignHistoryItem | null => {
  try {
    const campaignId = `campaign_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const pending = contacts.filter((c) => c.status === 'pending').length;
    const sent = contacts.filter((c) => c.status === 'sent').length;
    const failed = contacts.filter((c) => c.status === 'failed').length;
    const skipped = contacts.filter((c) => c.status === 'skipped').length;

    // Save full campaign data (contacts) to its own file
    const campaignFilePath = path.join(campaignsDir, `${campaignId}.json`);
    fs.writeFileSync(campaignFilePath, JSON.stringify(contacts, null, 2), 'utf8');

    // Load index, append new item, and write back
    const index = loadCampaignHistoryIndex();
    const newItem: CampaignHistoryItem = {
      id: campaignId,
      timestamp,
      filename,
      total: contacts.length,
      success: sent,
      failed: failed,
      skipped: skipped
    };

    index.unshift(newItem); // put newest first
    // Limit index to last 20 entries
    const limitedIndex = index.slice(0, 20);

    // Clean up files for deleted index entries to prevent storage leak
    if (index.length > 20) {
      const removedItems = index.slice(20);
      for (const item of removedItems) {
        const itemFile = path.join(campaignsDir, `${item.id}.json`);
        if (fs.existsSync(itemFile)) {
          fs.unlinkSync(itemFile);
        }
      }
    }

    fs.writeFileSync(historyIndexFile, JSON.stringify(limitedIndex, null, 2), 'utf8');
    logger.info(`Campaign ${filename} saved to history as ${campaignId}`);
    return newItem;
  } catch (error: any) {
    logger.error(`Failed to save campaign to history: ${error.message}`);
    return null;
  }
};

/**
 * Loads the contact list for a specific campaign ID.
 */
export const loadCampaignContacts = (campaignId: string): Contact[] => {
  try {
    const campaignFilePath = path.join(campaignsDir, `${campaignId}.json`);
    if (!fs.existsSync(campaignFilePath)) {
      throw new Error('Campaign details file not found');
    }
    const data = fs.readFileSync(campaignFilePath, 'utf8');
    return JSON.parse(data) as Contact[];
  } catch (error: any) {
    logger.error(`Failed to load contacts for campaign ${campaignId}: ${error.message}`);
    return [];
  }
};
