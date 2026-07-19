import fs from 'fs';
import csv from 'csv-parser';
import { logger } from '../utils/logger.js';
import { Contact, CSVReport, CSVValidationError } from '../types/index.js';

/**
 * Validates a phone number.
 * Formats expected: starts with '+', followed by country code and subscriber number (total 10-15 digits after '+').
 * Examples: +919876543210, +12025550143
 */
export const validatePhoneNumber = (phone: string): { isValid: boolean; reason?: string; cleanPhone?: string } => {
  if (!phone) return { isValid: false, reason: 'Phone number is empty' };
  
  // Strip all spaces, hyphens, brackets, and any non-numeric/non-plus character
  let cleanPhone = phone.replace(/[^\d+]/g, '');
  
  // If the number doesn't start with '+', check if it's all digits and prepend '+'
  if (!cleanPhone.startsWith('+')) {
    if (/^\d+$/.test(cleanPhone)) {
      cleanPhone = '+' + cleanPhone;
    } else {
      return { isValid: false, reason: 'Missing country code or leading "+"' };
    }
  }
  
  // Extract characters after '+'
  const digits = cleanPhone.slice(1);
  if (!/^\d+$/.test(digits)) {
    return { isValid: false, reason: 'Phone number must contain only numeric digits after "+"' };
  }
  
  if (digits.length < 10 || digits.length > 15) {
    return { isValid: false, reason: 'Phone number must be between 10 and 15 digits long' };
  }
  
  return { isValid: true, cleanPhone };
};

/**
 * Parses and validates CSV from path
 * @param filePath - Path to CSV file
 * @returns Validation report
 */
export const parseAndValidateCSV = (filePath: string): Promise<CSVReport> => {
  return new Promise((resolve, reject) => {
    const contacts: Contact[] = [];
    const errors: CSVValidationError[] = [];
    const seenPhones = new Set<string>();
    let rowNumber = 1; // 1-indexed (headers is row 1, data starts row 2)

    fs.createReadStream(filePath)
      .pipe(csv({
        // Convert headers to lowercase/trimmed to handle inconsistent casing
        mapHeaders: ({ header }) => header.trim().toLowerCase()
      }))
      .on('data', (row: any) => {
        rowNumber++;
        const rawName = row.name || '';
        const rawPhone = row.phone || '';
        
        const name = rawName.trim();
        const phone = rawPhone.trim();
        
        // Skip completely empty rows
        if (!name && !phone) {
          logger.warn(`Row ${rowNumber}: Empty row skipped`);
          return;
        }

        const rowErrors: string[] = [];
        
        if (!name) {
          rowErrors.push('Missing contact name');
        }
        
        const phoneValidation = validatePhoneNumber(phone);
        let cleanPhone = phone;
        
        if (!phoneValidation.isValid) {
          rowErrors.push(phoneValidation.reason || 'Invalid phone number format');
        } else {
          cleanPhone = phoneValidation.cleanPhone!;
        }

        let isDuplicate = false;
        if (phoneValidation.isValid) {
          if (seenPhones.has(cleanPhone)) {
            rowErrors.push('Duplicate phone number');
            isDuplicate = true;
          } else {
            seenPhones.add(cleanPhone);
          }
        }

        const status = rowErrors.length > 0 ? 'failed' : 'pending';
        const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const contact: Contact = {
          id: contactId,
          name,
          phone: cleanPhone,
          status,
          errorReason: rowErrors.length > 0 ? rowErrors.join(', ') : null,
          retries: 0,
          duration: null
        };

        contacts.push(contact);

        if (rowErrors.length > 0) {
          errors.push({
            row: rowNumber,
            name: name || '[Empty Name]',
            phone: phone || '[Empty Phone]',
            reasons: rowErrors
          });
        }
      })
      .on('end', () => {
        const totalRows = contacts.length;
        const validCount = contacts.filter(c => c.status === 'pending').length;
        const invalidCount = totalRows - validCount;
        const duplicateCount = errors.filter(e => e.reasons.includes('Duplicate phone number')).length;

        const report: CSVReport = {
          isValid: invalidCount === 0,
          totalRows,
          validCount,
          invalidCount,
          duplicateCount,
          contacts,
          errors
        };

        logger.info(`CSV parsing complete. Total: ${totalRows}, Valid: ${validCount}, Invalid: ${invalidCount}`);
        resolve(report);
      })
      .on('error', (err: any) => {
        logger.error(`Error parsing CSV file: ${err.message}`);
        reject(err);
      });
  });
};
