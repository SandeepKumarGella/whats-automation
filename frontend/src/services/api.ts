import axios from 'axios';
import { Contact, AutomationSettings, CSVReport, CSVValidationError, CampaignHistoryItem, SavedTemplate } from '../types/index';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const DEFAULT_FALLBACK_SETTINGS: AutomationSettings = {
  websiteUrl: 'https://YOUR-WEDDING-LINK.com',
  delayMin: 5,
  delayMax: 10,
  batchSize: 20,
  batchDelayMin: 60,
  batchDelayMax: 120,
  retryCount: 3,
  pauseDuration: 10,
  theme: 'dark',
  messageTemplate: 'Hi {{name}} 😊\n\nWe are delighted to invite you to our wedding.\n\nPlease visit our Wedding Invitation\n\n{{websiteUrl}}\n\nYour presence would mean a lot to us.\n\nThank you ❤️',
  testMode: false,
  dryRunMode: false,
  debugMode: false
};

export const normalizePhoneNumber = (rawPhone: string): string => {
  if (!rawPhone) return '';

  let phone = rawPhone.trim().replace(/^["']|["']$/g, '');

  // 1. Remove non-printable / zero-width characters
  phone = phone.replace(/[\u200B-\u200D\uFEFF\u00A0\r\n\t]/g, '').trim();

  // 2. Handle Scientific Notation formats from Excel:
  if (/^[+\-]?\d+(\.\d+)?[eE][+\-]?\d+$/.test(phone)) {
    try {
      const num = Number(phone);
      if (!isNaN(num) && isFinite(num)) {
        phone = BigInt(Math.round(num)).toString();
      }
    } catch {
      // Ignore
    }
  }

  // Case B: Scientific Notation stripped of E/dot (e.g. "919398+11")
  const strippedSciMatch = phone.match(/^(\d+)\+(\d{1,2})$/);
  if (strippedSciMatch) {
    const baseDigits = strippedSciMatch[1];
    const exponent = parseInt(strippedSciMatch[2], 10);

    if (exponent >= baseDigits.length - 1) {
      const reconstructedNum = Number(`${baseDigits[0]}.${baseDigits.slice(1)}E+${exponent}`);
      if (!isNaN(reconstructedNum) && isFinite(reconstructedNum)) {
        phone = BigInt(Math.round(reconstructedNum)).toString();
      }
    }
  }

  // 3. Keep leading '+' if present
  const hasLeadingPlus = phone.startsWith('+');
  let digits = phone.replace(/[^\d]/g, '');

  if (hasLeadingPlus) {
    return '+' + digits;
  }

  return digits;
};

/**
 * Client-side CSV Parser Fallback
 * Ensures CSV validation works smoothly even if Vercel HTTPS mixed-content blocks http://localhost backend requests.
 */
const parseCSVClientSide = async (file: File): Promise<CSVReport> => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return {
      isValid: false,
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      contacts: [],
      errors: [{ row: 1, name: '', phone: '', reasons: ['CSV file is empty'] }]
    };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  const nameIdx = headers.findIndex((h) => h.includes('name'));
  const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('number') || h.includes('mobile'));

  const contacts: Contact[] = [];
  const errors: CSVValidationError[] = [];
  const seenPhones = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const rawName = nameIdx >= 0 ? cols[nameIdx] || '' : cols[0] || '';
    const rawPhone = phoneIdx >= 0 ? cols[phoneIdx] || '' : cols[1] || '';

    const name = rawName.trim();
    const phone = rawPhone.trim();

    if (!name && !phone) continue;

    const rowErrors: string[] = [];
    if (!name) rowErrors.push('Missing contact name');

    let cleanPhone = normalizePhoneNumber(phone);

    if (!cleanPhone.startsWith('+')) {
      if (/^\d+$/.test(cleanPhone)) {
        cleanPhone = '+' + cleanPhone;
      } else {
        rowErrors.push('Missing country code or leading "+"');
      }
    }

    const digits = cleanPhone.slice(1);
    if (!/^\d+$/.test(digits)) {
      rowErrors.push('Phone number must contain only numeric digits after "+"');
    } else if (digits.length < 10 || digits.length > 15) {
      rowErrors.push('Phone number must be between 10 and 15 digits long');
    }

    if (rowErrors.length === 0) {
      if (seenPhones.has(cleanPhone)) {
        rowErrors.push('Duplicate phone number');
      } else {
        seenPhones.add(cleanPhone);
      }
    }

    const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const status = rowErrors.length > 0 ? 'failed' : 'pending';

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
        row: i + 1,
        name: name || '[Empty Name]',
        phone: phone || '[Empty Phone]',
        reasons: rowErrors
      });
    }
  }

  const totalRows = contacts.length;
  const validCount = contacts.filter((c) => c.status === 'pending').length;
  const invalidCount = totalRows - validCount;
  const duplicateCount = errors.filter((e) => e.reasons.includes('Duplicate phone number')).length;

  return {
    isValid: invalidCount === 0,
    totalRows,
    validCount,
    invalidCount,
    duplicateCount,
    contacts,
    errors
  };
};

export const api = {
  // Settings endpoints
  getSettings: async (): Promise<AutomationSettings> => {
    try {
      const response = await apiClient.get<AutomationSettings>('/settings', { timeout: 3000 });
      return response.data;
    } catch (err) {
      console.warn('Backend settings endpoint unreachable. Falling back to local default settings.', err);
      const saved = localStorage.getItem('wa_local_settings');
      return saved ? JSON.parse(saved) : DEFAULT_FALLBACK_SETTINGS;
    }
  },

  saveSettings: async (settings: AutomationSettings): Promise<{ success: boolean; settings: AutomationSettings }> => {
    localStorage.setItem('wa_local_settings', JSON.stringify(settings));
    try {
      const response = await apiClient.post<{ success: boolean; settings: AutomationSettings }>('/settings', settings, { timeout: 3000 });
      return response.data;
    } catch (err) {
      console.warn('Backend settings endpoint unreachable. Saved to localStorage.', err);
      return { success: true, settings };
    }
  },

  backupSettingsUrl: () => `${API_BASE}/settings/backup`,

  restoreSettings: async (file: File): Promise<{ success: boolean; settings: AutomationSettings }> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post<{ success: boolean; settings: AutomationSettings }>(
        `${API_BASE}/settings/restore`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: 4000
        }
      );
      localStorage.setItem('wa_local_settings', JSON.stringify(response.data.settings));
      return response.data;
    } catch (err) {
      const text = await file.text();
      const settings = JSON.parse(text);
      localStorage.setItem('wa_local_settings', JSON.stringify(settings));
      return { success: true, settings };
    }
  },

  // CSV endpoints
  uploadCSV: async (file: File): Promise<CSVReport> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post<CSVReport>(`${API_BASE}/csv/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 4000
      });
      return response.data;
    } catch (err) {
      console.warn('Backend API upload unreachable or blocked. Parsing CSV client-side...', err);
      return await parseCSVClientSide(file);
    }
  },

  // Campaign History endpoints
  getCampaignHistoryIndex: async (): Promise<CampaignHistoryItem[]> => {
    try {
      const response = await apiClient.get<CampaignHistoryItem[]>('/history', { timeout: 3000 });
      return response.data;
    } catch (err) {
      console.warn('Backend history endpoint unreachable.', err);
      const local = localStorage.getItem('wa_local_history');
      return local ? JSON.parse(local) : [];
    }
  },

  getCampaignContacts: async (campaignId: string): Promise<Contact[]> => {
    try {
      const response = await apiClient.get<Contact[]>(`/history/${campaignId}`, { timeout: 3000 });
      return response.data;
    } catch (err) {
      return [];
    }
  },

  // Automation controls
  startAutomation: async (contacts: Contact[], settings: AutomationSettings): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>('/automation/start', { contacts, settings }, { timeout: 5000 });
      return response.data;
    } catch (err: any) {
      throw new Error('Backend engine disconnected. Please run the backend server locally on port 5000 or configure VITE_API_BASE.');
    }
  },

  pauseAutomation: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>('/automation/pause', {}, { timeout: 4000 });
      return response.data;
    } catch (err) {
      return { success: false, message: 'Backend engine unreachable' };
    }
  },

  resumeAutomation: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>('/automation/resume', {}, { timeout: 4000 });
      return response.data;
    } catch (err) {
      return { success: false, message: 'Backend engine unreachable' };
    }
  },

  stopAutomation: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>('/automation/stop', {}, { timeout: 4000 });
      return response.data;
    } catch (err) {
      return { success: false, message: 'Backend engine unreachable' };
    }
  },

  connectAutomation: async (settings?: AutomationSettings): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>('/automation/connect', { settings }, { timeout: 5000 });
      return response.data;
    } catch (err: any) {
      throw new Error('Backend engine unreachable on http://localhost:5000. Please start your local backend server.');
    }
  },

  getResumeState: async (): Promise<{ hasResumeState: boolean; state: any }> => {
    try {
      const response = await apiClient.get<{ hasResumeState: boolean; state: any }>('/automation/resume-state', { timeout: 3000 });
      return response.data;
    } catch (err) {
      return { hasResumeState: false, state: null };
    }
  },

  // Template Library Endpoints
  getSavedTemplates: async (): Promise<SavedTemplate[]> => {
    try {
      const response = await apiClient.get<SavedTemplate[]>('/templates', { timeout: 3000 });
      return response.data;
    } catch (err) {
      console.warn('Backend templates endpoint unreachable.', err);
      const local = localStorage.getItem('wa_local_templates');
      return local ? JSON.parse(local) : [
        {
          name: 'Wedding Invitation Default',
          template: 'Hi {{name}} 😊\n\nWe are delighted to invite you to our wedding.\n\nPlease visit our Wedding Invitation\n\n{{websiteUrl}}\n\nYour presence would mean a lot to us.\n\nThank you ❤️'
        }
      ];
    }
  },

  saveTemplate: async (name: string, template: string): Promise<{ success: boolean; name: string }> => {
    try {
      const response = await apiClient.post<{ success: boolean; name: string }>('/templates', { name, template }, { timeout: 3000 });
      return response.data;
    } catch (err) {
      const existing = localStorage.getItem('wa_local_templates');
      const templates: SavedTemplate[] = existing ? JSON.parse(existing) : [];
      const idx = templates.findIndex(t => t.name === name);
      if (idx >= 0) templates[idx].template = template;
      else templates.push({ name, template });
      localStorage.setItem('wa_local_templates', JSON.stringify(templates));
      return { success: true, name };
    }
  },

  deleteTemplate: async (name: string): Promise<{ success: boolean; name: string }> => {
    try {
      const response = await apiClient.delete<{ success: boolean; name: string }>(`/templates/${name}`, { timeout: 3000 });
      return response.data;
    } catch (err) {
      const existing = localStorage.getItem('wa_local_templates');
      if (existing) {
        const templates: SavedTemplate[] = JSON.parse(existing);
        const filtered = templates.filter(t => t.name !== name);
        localStorage.setItem('wa_local_templates', JSON.stringify(filtered));
      }
      return { success: true, name };
    }
  },

  // Report downloads helper url
  downloadReportUrl: (type: 'sent' | 'failed' | 'summary' | 'logs') => `${API_BASE}/reports/download/${type}`
};
