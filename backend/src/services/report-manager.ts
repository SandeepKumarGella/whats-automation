import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { Contact, AutomationProgress } from '../types/index.js';

const reportsDir = 'reports';
const sentFile = path.join(reportsDir, 'sent.csv');
const failedFile = path.join(reportsDir, 'failed.csv');
const summaryFile = path.join(reportsDir, 'summary.json');

// Ensure reports directory exists
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

/**
 * Initializes/resets the report files for a new run.
 * Creates the headers for CSV files.
 */
export const initReports = (): void => {
  try {
    const csvHeader = 'Time,Contact,Phone,Status,Reason,Retries,Duration(ms)\n';
    fs.writeFileSync(sentFile, csvHeader, 'utf8');
    fs.writeFileSync(failedFile, csvHeader, 'utf8');
    
    const initialSummary = {
      startTime: new Date().toISOString(),
      endTime: null,
      totalContacts: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      successRate: 0,
      contactsDetails: []
    };
    fs.writeFileSync(summaryFile, JSON.stringify(initialSummary, null, 2), 'utf8');
    logger.info('Report files initialized');
  } catch (error: any) {
    logger.error(`Failed to initialize reports: ${error.message}`);
  }
};

/**
 * Appends a row to the specified CSV report.
 */
const appendToCsv = (filePath: string, contact: Contact): void => {
  try {
    const time = new Date().toISOString();
    const name = contact.name.replace(/"/g, '""'); // escape double quotes
    const phone = contact.phone;
    const status = contact.status;
    const reason = (contact.errorReason || '').replace(/"/g, '""');
    const retries = contact.retries;
    const duration = contact.duration || 0;

    const row = `"${time}","${name}","${phone}","${status}","${reason}",${retries},${duration}\n`;
    fs.appendFileSync(filePath, row, 'utf8');
  } catch (error: any) {
    logger.error(`Failed to write to CSV ${filePath}: ${error.message}`);
  }
};

/**
 * Appends to sent.csv.
 */
export const logSentReport = (contact: Contact): void => {
  appendToCsv(sentFile, contact);
};

/**
 * Appends to failed.csv.
 */
export const logFailedReport = (contact: Contact): void => {
  appendToCsv(failedFile, contact);
};

/**
 * Compiles and writes the final summary.json file.
 */
export const writeFinalSummary = (stats: AutomationProgress, contacts: Contact[], startTime: number | null): void => {
  try {
    const summary = {
      startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
      endTime: new Date().toISOString(),
      totalContacts: stats.total || contacts.length,
      sentCount: stats.successCount || 0,
      failedCount: stats.failedCount || 0,
      skippedCount: contacts.filter(c => c.status === 'skipped').length,
      successRate: stats.successRate || 0,
      contactsDetails: contacts.map(c => ({
        name: c.name,
        phone: c.phone,
        status: c.status,
        errorReason: c.errorReason,
        retries: c.retries,
        duration: c.duration
      }))
    };
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), 'utf8');
    logger.info('Final summary report generated');
  } catch (error: any) {
    logger.error(`Failed to write final summary: ${error.message}`);
  }
};
