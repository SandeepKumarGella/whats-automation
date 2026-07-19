import axios from 'axios';
import { Contact, AutomationSettings, CSVReport, CSVValidationError, CampaignHistoryItem, SavedTemplate } from '../types/index';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

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

    let cleanPhone = phone.replace(/[^\d+]/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (/^\d+$/.test(cleanPhone)) cleanPhone = '+' + cleanPhone;
      else rowErrors.push('Missing country code or leading "+"');
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
    const response = await apiClient.get<AutomationSettings>('/settings');
    return response.data;
  },

  saveSettings: async (settings: AutomationSettings): Promise<{ success: boolean; settings: AutomationSettings }> => {
    const response = await apiClient.post<{ success: boolean; settings: AutomationSettings }>('/settings', settings);
    return response.data;
  },

  backupSettingsUrl: () => `${API_BASE}/settings/backup`,

  restoreSettings: async (file: File): Promise<{ success: boolean; settings: AutomationSettings }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post<{ success: boolean; settings: AutomationSettings }>(
      `${API_BASE}/settings/restore`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
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
        timeout: 5000
      });
      return response.data;
    } catch (err) {
      console.warn('Backend API upload unreachable or blocked. Parsing CSV client-side...', err);
      return await parseCSVClientSide(file);
    }
  },

  // Campaign History endpoints
  getCampaignHistoryIndex: async (): Promise<CampaignHistoryItem[]> => {
    const response = await apiClient.get<CampaignHistoryItem[]>('/history');
    return response.data;
  },

  getCampaignContacts: async (campaignId: string): Promise<Contact[]> => {
    const response = await apiClient.get<Contact[]>(`/history/${campaignId}`);
    return response.data;
  },

  // Automation controls
  startAutomation: async (contacts: Contact[], settings: AutomationSettings): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/automation/start', { contacts, settings });
    return response.data;
  },

  pauseAutomation: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/automation/pause');
    return response.data;
  },

  resumeAutomation: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/automation/resume');
    return response.data;
  },

  stopAutomation: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/automation/stop');
    return response.data;
  },

  connectAutomation: async (settings?: AutomationSettings): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/automation/connect', { settings });
    return response.data;
  },

  getResumeState: async (): Promise<{ hasResumeState: boolean; state: any }> => {
    const response = await apiClient.get<{ hasResumeState: boolean; state: any }>('/automation/resume-state');
    return response.data;
  },

  // Template Library Endpoints
  getSavedTemplates: async (): Promise<SavedTemplate[]> => {
    const response = await apiClient.get<SavedTemplate[]>('/templates');
    return response.data;
  },

  saveTemplate: async (name: string, template: string): Promise<{ success: boolean; name: string }> => {
    const response = await apiClient.post<{ success: boolean; name: string }>('/templates', { name, template });
    return response.data;
  },

  deleteTemplate: async (name: string): Promise<{ success: boolean; name: string }> => {
    const response = await apiClient.delete<{ success: boolean; name: string }>(`/templates/${name}`);
    return response.data;
  },

  // Report downloads helper url
  downloadReportUrl: (type: 'sent' | 'failed' | 'summary' | 'logs') => `${API_BASE}/reports/download/${type}`
};
