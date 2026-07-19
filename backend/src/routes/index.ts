import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseAndValidateCSV } from '../services/csv-validator.js';
import { loadSettings, saveSettings, isValidSettings } from '../services/storage.js';
import { hasResumeState, loadResumeState, clearResumeState } from '../services/state-manager.js';
import { 
  loadSavedTemplates, 
  saveMessageTemplate, 
  deleteMessageTemplate 
} from '../services/template-manager.js';
import { 
  loadCampaignHistoryIndex, 
  loadCampaignContacts, 
  saveCampaignToHistory 
} from '../services/history-manager.js';
import { logger, logEmitter } from '../utils/logger.js';
import { 
  startAutomation, 
  pauseAutomation, 
  resumeAutomation, 
  stopAutomation, 
  getAutomationProgress,
  automationEvents,
  connectWhatsApp
} from '../services/automation.js';

const router = express.Router();

// Setup Multer for CSV uploads
const uploadDir = 'storage/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `upload_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  }
});

// CSV Upload Endpoint
router.post('/csv/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    logger.info(`Received CSV file: ${req.file.originalname}`);
    const report = await parseAndValidateCSV(req.file.path);
    
    // Save successfully parsed campaign in history
    saveCampaignToHistory(req.file.originalname, report.contacts);

    // Cleanup physical temp file after parsing
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error(`Failed to delete temp file: ${err.message}`);
    });

    res.json(report);
  } catch (error: any) {
    logger.error(`CSV upload parsing failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to process CSV file' });
  }
});

// Settings Endpoints
router.get('/settings', (req: Request, res: Response) => {
  res.json(loadSettings());
});

router.post('/settings', (req: Request, res: Response) => {
  const newSettings = req.body;
  if (!newSettings) {
    return res.status(400).json({ error: 'Invalid settings body' });
  }
  const success = saveSettings(newSettings);
  if (success) {
    res.json({ success: true, settings: newSettings });
  } else {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Backup settings (Download JSON file)
router.get('/settings/backup', (req: Request, res: Response) => {
  const settings = loadSettings();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=whatsapp_settings_backup.json');
  res.send(JSON.stringify(settings, null, 2));
});

// Restore settings
router.post('/settings/restore', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file uploaded' });
    }
    const rawData = fs.readFileSync(req.file.path, 'utf8');
    const settings = JSON.parse(rawData);
    
    // Clean up temporary file
    fs.unlinkSync(req.file.path);

    if (!isValidSettings(settings)) {
      return res.status(400).json({ error: 'Invalid configuration file structure' });
    }

    saveSettings(settings);
    res.json({ success: true, settings });
  } catch (error: any) {
    logger.error(`Settings restore failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to restore settings configuration' });
  }
});

// Saved Template Endpoints
router.get('/templates', (req: Request, res: Response) => {
  res.json(loadSavedTemplates());
});

router.post('/templates', (req: Request, res: Response) => {
  const { name, template } = req.body;
  if (!name || !template) {
    return res.status(400).json({ error: 'Name and template content are required' });
  }
  const success = saveMessageTemplate(name, template);
  if (success) {
    res.json({ success: true, name });
  } else {
    res.status(500).json({ error: 'Failed to save template string' });
  }
});

router.delete('/templates/:name', (req: Request, res: Response) => {
  const name = req.params.name;
  const success = deleteMessageTemplate(name);
  if (success) {
    res.json({ success: true, name });
  } else {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Campaign History Endpoints
router.get('/history', (req: Request, res: Response) => {
  res.json(loadCampaignHistoryIndex());
});

router.get('/history/:id', (req: Request, res: Response) => {
  const campaignId = req.params.id;
  const contacts = loadCampaignContacts(campaignId);
  res.json(contacts);
});

// Automation Endpoints
router.post('/automation/start', async (req: Request, res: Response) => {
  const { contacts, settings } = req.body;
  if (!contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: 'Invalid contacts list' });
  }
  
  try {
    // Clear any previous crash states when initiating a clean new run
    clearResumeState();
    
    // Fire-and-forget start, status is pushed via SSE
    startAutomation(contacts, settings || loadSettings());
    res.json({ success: true, message: 'Automation engine initiated' });
  } catch (error: any) {
    logger.error(`Failed to start automation: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

router.post('/automation/connect', async (req: Request, res: Response) => {
  const { settings } = req.body;
  try {
    // Fire-and-forget background connection check
    connectWhatsApp(settings || loadSettings());
    res.json({ success: true, message: 'Automation connection verification initiated' });
  } catch (error: any) {
    logger.error(`Failed to initiate WhatsApp connection: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

router.post('/automation/pause', (req: Request, res: Response) => {
  pauseAutomation();
  res.json({ success: true, message: 'Automation paused' });
});

router.post('/automation/resume', (req: Request, res: Response) => {
  try {
    const hasResume = hasResumeState();
    
    if (hasResume && getAutomationProgress().status === 'idle') {
      const savedState = loadResumeState();
      if (savedState) {
        startAutomation(savedState.contacts, savedState.settings, savedState.currentIndex);
        res.json({ success: true, message: 'Automation resumed from crash state' });
      } else {
        res.status(400).json({ error: 'No valid crash state file loaded' });
      }
    } else {
      resumeAutomation();
      res.json({ success: true, message: 'Automation resumed' });
    }
  } catch (error: any) {
    logger.error(`Failed to resume automation: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

router.post('/automation/stop', (req: Request, res: Response) => {
  stopAutomation();
  res.json({ success: true, message: 'Automation stopped' });
});

// Check if resume state exists
router.get('/automation/resume-state', (req: Request, res: Response) => {
  res.json({
    hasResumeState: hasResumeState(),
    state: loadResumeState()
  });
});

// Downloads Reports
router.get('/reports/download/:type', (req: Request, res: Response) => {
  const type = req.params.type;
  let filePath: string;

  if (type === 'sent') {
    filePath = path.resolve('reports/sent.csv');
  } else if (type === 'failed') {
    filePath = path.resolve('reports/failed.csv');
  } else if (type === 'summary') {
    filePath = path.resolve('reports/summary.json');
  } else if (type === 'logs') {
    filePath = path.resolve('logs/logs.txt');
  } else {
    return res.status(404).json({ error: 'File type not found' });
  }

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'Report file does not exist yet' });
  }
});

// Server-Sent Events (SSE) Progress and Log stream
router.get('/automation/status/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial progress status immediately on connect
  res.write(`data: ${JSON.stringify({ type: 'status', data: getAutomationProgress() })}\n\n`);

  // Handler for automation status updates
  const onStatusUpdate = (progress: any) => {
    res.write(`data: ${JSON.stringify({ type: 'status', data: progress })}\n\n`);
  };

  // Handler for Winston log events
  const onLog = (logObj: any) => {
    res.write(`data: ${JSON.stringify({ type: 'log', data: logObj })}\n\n`);
  };

  automationEvents.on('status', onStatusUpdate);
  logEmitter.on('log', onLog);

  // Keep connection alive with periodic pings
  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    automationEvents.off('status', onStatusUpdate);
    logEmitter.off('log', onLog);
    res.end();
  });
});

export default router;
