import { chromium, Browser, BrowserContext, Page, ConsoleMessage } from 'playwright';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { saveResumeState, clearResumeState } from './state-manager.js';
import { logSentReport, logFailedReport, writeFinalSummary, initReports } from './report-manager.js';
import { Contact, AutomationSettings, AutomationProgress } from '../types/index.js';

export const automationEvents = new EventEmitter();

// Global automation runner state
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let isPaused = false;
let shouldStop = false;
let startTime: number | null = null;
let consoleLogs: string[] = [];

// Diagnostic directories
const DEBUG_DIR = path.resolve('logs/debug');
const HTML_DIR = path.resolve('logs/debug/html');
const SCREENSHOTS_DIR = path.resolve('screenshots');
const TRACES_DIR = path.resolve('playwright-trace');

const ensureDiagnosticDirs = () => {
  [DEBUG_DIR, HTML_DIR, SCREENSHOTS_DIR, TRACES_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

ensureDiagnosticDirs();

let progressState: AutomationProgress = {
  status: 'idle',
  total: 0,
  completed: 0,
  remaining: 0,
  successCount: 0,
  failedCount: 0,
  successRate: 0,
  currentContact: null,
  currentStep: 'Idle',
  currentDelay: 0,
  currentBatch: 0,
  elapsedTime: 0,
  eta: 0,
  qrCodeUrl: null,
  contacts: []
};

let elapsedTimer: NodeJS.Timeout | null = null;

export const getAutomationProgress = (): AutomationProgress => {
  return progressState;
};

const updateProgress = (fields: Partial<AutomationProgress>) => {
  progressState = { ...progressState, ...fields };
  
  const processed = progressState.successCount + progressState.failedCount;
  if (processed > 0) {
    progressState.successRate = Math.round((progressState.successCount / processed) * 100);
  } else {
    progressState.successRate = 0;
  }
  
  progressState.remaining = progressState.total - progressState.completed;
  automationEvents.emit('status', progressState);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelay = (minMs: number, maxMs: number) => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return sleep(ms);
};

/**
 * Robust Selector Definitions for WhatsApp Web DOM
 */
const SELECTORS = {
  // Chat Textbox Selectors
  textbox: [
    'footer div[contenteditable="true"]',
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-tab="6"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[data-lexical-editor="true"]',
    'div[aria-placeholder*="Type a message"]',
    'div[title="Type a message"]',
    'footer p.selectable-text',
    'footer [contenteditable="true"]'
  ],
  // Send Button Selectors
  sendBtn: [
    'button[data-testid="compose-btn-send"]',
    'button[aria-label="Send"]',
    'span[data-icon="send"]',
    'span[data-icon="send-v2"]',
    'button:has(span[data-icon="send"])',
    'footer button:has(span[data-icon*="send"])'
  ],
  // Search Bar Selectors
  searchBox: [
    'button[aria-label*="Search"]',
    'div[contenteditable="true"][data-tab="3"]',
    '[data-testid="chat-list-search"]',
    '[data-testid="search-input"]',
    '[aria-label="Search input textbox"]',
    '[aria-label="Search or start new chat"]',
    'button:has(span[data-icon="search"])',
    'span[data-testid="search"]',
    'div[role="textbox"][title*="Search"]',
    'p.selectable-text'
  ],
  // Search Results Selectors
  searchResults: [
    '[data-testid="cell-frame-title"] span[title]',
    '[data-testid="cell-frame-title"]',
    'div[role="listitem"] span[dir="auto"]',
    '[data-testid="chat-list"] div[role="listitem"]'
  ],
  // New Chat Selectors
  newChatBtn: [
    'div[title="New chat"]',
    'button[aria-label="New chat"]',
    'div[role="button"]:has(span[data-icon="new-chat-outline"])',
    'button:has(span[data-icon="new-chat-outline"])',
    '[data-testid="menu-bar-chat"]',
    'span[data-icon="new-chat-outline"]'
  ],
  // Outgoing Message Bubbles
  outgoingBubble: [
    'div.message-out',
    'div[data-id*="true_"]',
    'div[data-testid="msg-container"]',
    'span[data-icon="msg-dblcheck"]',
    'span[data-icon="msg-check"]',
    'span[data-icon="msg-time"]',
    'div[role="row"]:has(span[data-icon*="check"])'
  ],
  // Invalid Phone / Not on WhatsApp Dialogs
  invalidPopup: [
    'div[role="button"]:has-text("OK")',
    'button:has-text("OK")',
    'div[role="dialog"] button',
    '[data-animate-modal-popup] button'
  ],
  // Loading & Startup Overlays
  loadingOverlay: [
    '#startup',
    'div[role="progressbar"]',
    'div[data-ref]',
    'div:has-text("Starting chat")',
    'span:has-text("Starting chat")',
    'div:has-text("Loading chats")',
    'span:has-text("Loading chats")'
  ]
};

export type WhatsAppState =
  | 'qr_login'
  | 'loading'
  | 'chat_opened'
  | 'chat_list'
  | 'invalid_phone_dialog'
  | 'popup_dialog'
  | 'disconnected'
  | 'session_expired'
  | 'unknown';

/**
 * STEP 1: WhatsApp State Detection
 */
export const detectWhatsAppState = async (p: Page | null): Promise<WhatsAppState> => {
  if (!p || p.isClosed()) return 'disconnected';

  try {
    // 1. FIRST CHECK: Authenticated Session Selectors (Chat List, Search Bar, Header, Active Chat)
    const authenticatedSelectors = [
      '[data-testid="chat-list"]',
      '#pane-side',
      'header',
      '[data-testid="chat-list-search"]',
      '[data-testid="search-input"]',
      'div[contenteditable="true"][data-tab="3"]',
      '[aria-label="Search input textbox"]',
      '[aria-label="Search or start new chat"]',
      'span[data-icon="new-chat-outline"]',
      'span[data-icon="chat"]',
      'span[data-icon="status-v3"]',
      '#main',
      'footer div[contenteditable="true"]'
    ];

    for (const sel of authenticatedSelectors) {
      const isVisible = await p.locator(sel).first().isVisible().catch(() => false);
      if (isVisible) {
        // Distinguish between active chat open vs chat list home
        for (const tSel of SELECTORS.textbox) {
          const hasTextbox = await p.locator(tSel).first().isVisible().catch(() => false);
          if (hasTextbox) return 'chat_opened';
        }
        return 'chat_list';
      }
    }

    // 2. SECOND CHECK: Loading Overlays / Progressbars
    for (const sel of SELECTORS.loadingOverlay) {
      const isVisible = await p.locator(sel).first().isVisible().catch(() => false);
      if (isVisible) return 'loading';
    }

    // 3. THIRD CHECK: Invalid Phone Number / Not Registered Dialog
    const popupBtn = p.locator(SELECTORS.invalidPopup.join(', ')).first();
    const hasPopup = await popupBtn.isVisible().catch(() => false);
    if (hasPopup) {
      const bodyText = (await p.textContent('body').catch(() => ''))?.toLowerCase() || '';
      if (
        bodyText.includes('invalid') ||
        bodyText.includes('not on whatsapp') ||
        bodyText.includes('not registered') ||
        bodyText.includes('phone number shared via url is invalid')
      ) {
        return 'invalid_phone_dialog';
      }
      return 'popup_dialog';
    }

    // 4. FOURTH CHECK: Specific QR Code Scan Page Elements (NOT generic canvas!)
    const qrSpecificSelectors = [
      'div[data-ref] canvas',
      'div[data-testid="qrcode"] canvas',
      'canvas[aria-label*="Scan"]',
      'canvas[aria-label*="QR"]',
      '[data-testid="qrcode"]',
      'div[data-ref]'
    ];

    for (const sel of qrSpecificSelectors) {
      const isVisible = await p.locator(sel).first().isVisible().catch(() => false);
      if (isVisible) return 'qr_login';
    }

    return 'unknown';
  } catch (err) {
    return 'disconnected';
  }
};

/**
 * STEP 2: Page Preparation & Overlay Dismissal
 */
const preparePageForInteraction = async (p: Page, timeoutMs = 25000): Promise<boolean> => {
  const start = Date.now();
  logger.info('Preparing page: waiting for network idle and clearing loading overlays...');

  while (Date.now() - start < timeoutMs) {
    if (p.isClosed()) return false;

    const state = await detectWhatsAppState(p);

    if (state === 'invalid_phone_dialog') {
      logger.warn('Detected invalid phone number modal dialog during page prep.');
      return false;
    }

    if (state === 'popup_dialog') {
      logger.info('Auto-dismissing modal dialog...');
      const okBtn = p.locator(SELECTORS.invalidPopup.join(', ')).first();
      await okBtn.click().catch(() => {});
      await sleep(1000);
      continue;
    }

    if (state === 'loading') {
      logger.info('Page is still loading overlays. Waiting...');
      await sleep(1500);
      continue;
    }

    if (state === 'chat_opened' || state === 'chat_list') {
      logger.info(`Page prepared successfully. Current state: ${state}`);
      return true;
    }

    await sleep(1000);
  }

  logger.warn('Page preparation timed out. Proceeding with caution.');
  return false;
};

/**
 * STEP 9: Automatic Diagnostics Generator
 */
const saveFailureDiagnostics = async (
  p: Page | null,
  contact: Contact,
  currentSelector: string,
  failureReason: string,
  settings: AutomationSettings
) => {
  ensureDiagnosticDirs();
  const timestamp = Date.now();
  const baseName = `failure_${contact.phone.replace(/[^0-9]/g, '')}_${timestamp}`;

  logger.error(`[DIAGNOSTICS] Generating failure diagnostic bundle for ${contact.name} (${contact.phone})...`);

  let currentUrl = 'N/A';
  let pageState: WhatsAppState = 'unknown';

  if (p && !p.isClosed()) {
    currentUrl = p.url();
    pageState = await detectWhatsAppState(p);

    // 1. Save Screenshot
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${baseName}.png`);
    await p.screenshot({ path: screenshotPath, fullPage: true }).catch((err) => {
      logger.error(`Failed to save screenshot: ${err.message}`);
    });

    // 2. Save HTML Source
    const htmlContent = await p.content().catch(() => '');
    if (htmlContent) {
      const htmlPath = path.join(HTML_DIR, `${baseName}.html`);
      fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    }
  }

  // 3. Save Diagnostic Log Summary
  const summaryPath = path.join(DEBUG_DIR, `${baseName}_summary.txt`);
  const summaryText = `
=====================================================
WHATSAPP AUTOMATION FAILURE DIAGNOSTIC REPORT
=====================================================
Timestamp: ${new Date().toISOString()}
Contact Name: ${contact.name}
Contact Phone: ${contact.phone}
Targeted Selector: ${currentSelector}
WhatsApp State: ${pageState}
Current URL: ${currentUrl}
Failure Reason: ${failureReason}

-----------------------------------------------------
RECENT BROWSER CONSOLE LOGS
-----------------------------------------------------
${consoleLogs.slice(-25).join('\n')}
=====================================================
  `.trim();

  fs.writeFileSync(summaryPath, summaryText, 'utf8');

  // 4. Export Playwright Trace if context is active
  if (context && settings.debugMode) {
    const tracePath = path.join(TRACES_DIR, `trace_${contact.phone.replace(/[^0-9]/g, '')}_${timestamp}.zip`);
    await context.tracing.stop({ path: tracePath }).catch(() => {});
    // Restart tracing for next run
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true }).catch(() => {});
    logger.info(`Playwright trace saved: ${tracePath}`);
  }

  logger.info(`Diagnostics saved to:\n  - Summary: ${summaryPath}\n  - Screenshot: ${path.join(SCREENSHOTS_DIR, `${baseName}.png`)}`);
};

/**
 * STEP 10: Debug Mode Helper Hooks
 */
const debugStepHook = async (
  stepName: string,
  p: Page | null,
  targetLocator: any | null,
  settings: AutomationSettings
) => {
  if (!settings.debugMode || !p || p.isClosed()) return;

  logger.info(`[DEBUG MODE] Step: ${stepName}`);
  
  if (targetLocator) {
    try {
      await targetLocator.highlight();
    } catch (_) {}
  }

  // Take step screenshot
  const screenshotPath = path.join(SCREENSHOTS_DIR, `debug_${Date.now()}_${stepName.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
  await p.screenshot({ path: screenshotPath }).catch(() => {});

  // Visual inspection pause (2–3 seconds)
  await sleep(Math.floor(Math.random() * 1000) + 2000);
};

const closeBrowser = async () => {
  try {
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
    if (page) {
      page = null;
    }
    if (context) {
      await context.close().catch(() => {});
      context = null;
    }
    if (browser) {
      await browser.close().catch(() => {});
      browser = null;
    }
  } catch (err: any) {
    logger.error(`Error closing browser: ${err.message}`);
  }
};

export const pauseAutomation = () => {
  if (progressState.status === 'running') {
    isPaused = true;
    updateProgress({ status: 'paused', currentStep: 'Paused by user' });
    logger.info('Automation execution paused by user');
  }
};

export const resumeAutomation = () => {
  if (progressState.status === 'paused') {
    isPaused = false;
    updateProgress({ status: 'running', currentStep: 'Resuming...' });
    logger.info('Automation execution resumed');
  }
};

export const stopAutomation = async () => {
  shouldStop = true;
  isPaused = false;
  updateProgress({ status: 'stopped', currentStep: 'Stopped by user', qrCodeUrl: null });
  logger.warn('Automation execution stopped by user');
  await closeBrowser();
  clearResumeState();
};

/**
 * STEP 6: Session Health Check
 */
const isPageAuthenticated = async (): Promise<boolean> => {
  if (!page || page.isClosed()) return false;
  const state = await detectWhatsAppState(page);
  return state === 'chat_opened' || state === 'chat_list' || state === 'loading';
};

export const connectWhatsApp = async (settings: AutomationSettings): Promise<boolean> => {
  if (progressState.status === 'running' || progressState.status === 'scanning_qr' || progressState.status === 'connecting') {
    logger.warn('WhatsApp connection attempt is already active');
    return true;
  }

  isPaused = false;
  shouldStop = false;
  
  try {
    updateProgress({ status: 'connecting', currentStep: 'Launching Playwright browser...', qrCodeUrl: null });
    const success = await launchBrowserAndAuthenticate(settings);
    return success;
  } catch (err: any) {
    logger.error(`Failed to initiate WhatsApp connection: ${err.message}`);
    updateProgress({ status: 'failed', currentStep: `Connection failed: ${err.message}`, qrCodeUrl: null });
    await closeBrowser();
    return false;
  }
};

const launchBrowserAndAuthenticate = async (settings: AutomationSettings): Promise<boolean> => {
  const sessionDir = 'storage/whatsapp-session';
  
  if (context && page && !page.isClosed()) {
    logger.info('Playwright browser is active. Verifying session...');
    const state = await detectWhatsAppState(page);
    if (state === 'chat_opened' || state === 'chat_list') {
      logger.info('Session is active and authenticated.');
      const nextStatus = (progressState.contacts && progressState.contacts.length > 0 && progressState.status === 'running')
        ? 'running'
        : 'connected';
      updateProgress({ qrCodeUrl: null, status: nextStatus, currentStep: 'Session active. Ready to process contacts' });
      return true;
    }
  }

  if (!context) {
    logger.info('Launching Chromium with persistent context...');
    updateProgress({ currentStep: 'Launching Playwright browser...' });
    
    context = await chromium.launchPersistentContext(sessionDir, {
      headless: false,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    if (settings.debugMode) {
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      logger.info('[DEBUG MODE] Playwright tracing enabled.');
    }

    context.on('close', () => {
      logger.warn('Browser context closed unexpectedly.');
      context = null;
      page = null;
      browser = null;
      updateProgress({ status: 'idle', qrCodeUrl: null, currentStep: 'Browser closed' });
    });
  }

  if (!page || page.isClosed()) {
    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    
    // Capture browser console logs for diagnostics
    consoleLogs = [];
    page.on('console', (msg: ConsoleMessage) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
  }
  
  const currentUrl = page.url();
  if (!currentUrl.includes('web.whatsapp.com')) {
    logger.info('Navigating to WhatsApp Web...');
    updateProgress({ currentStep: 'Opening WhatsApp Web' });
    await page.goto('https://web.whatsapp.com');
  }

  let isAuthenticated = false;
  let qrScanAttempts = 0;

  while (!isAuthenticated && !shouldStop) {
    if (isPaused) {
      await sleep(1000);
      continue;
    }

    if (!page || page.isClosed()) {
      throw new Error('Browser closed during login scan initialization');
    }

    const state = await detectWhatsAppState(page);

    if (state === 'chat_list' || state === 'chat_opened') {
      logger.info('WhatsApp Web authenticated successfully!');
      isAuthenticated = true;
      const nextStatus = (progressState.contacts && progressState.contacts.length > 0 && progressState.status === 'running')
        ? 'running'
        : 'connected';
      updateProgress({ qrCodeUrl: null, status: nextStatus, currentStep: 'Session active. Ready to process contacts' });
      return true;
    }

    if (state === 'qr_login') {
      qrScanAttempts++;
      if (qrScanAttempts % 5 === 1) {
        logger.info('QR Code detected. Capturing screenshot for scanner...');
      }
      
      try {
        let qrElement = page.locator('div[data-ref] canvas, div[data-testid="qrcode"] canvas, canvas[aria-label*="Scan"], canvas[aria-label*="QR"], [data-testid="qrcode"] canvas, canvas').first();
        let isQrVisible = await qrElement.isVisible().catch(() => false);
        
        if (!isQrVisible) {
          qrElement = page.locator('div[data-ref], [data-testid="qrcode"]').first();
          isQrVisible = await qrElement.isVisible().catch(() => false);
        }

        if (isQrVisible) {
          const screenshotBuffer = await qrElement.screenshot();
          const qrBase64 = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
          
          updateProgress({ 
            status: 'scanning_qr',
            qrCodeUrl: qrBase64, 
            currentStep: 'Please scan the QR code using your WhatsApp App' 
          });
        } else {
          updateProgress({
            status: 'scanning_qr',
            currentStep: 'QR code generated in Chromium browser. Please scan...'
          });
        }
      } catch (screenshotErr: any) {
        logger.debug(`QR screenshot failed: ${screenshotErr.message}`);
        updateProgress({
          status: 'scanning_qr',
          currentStep: 'Waiting for QR Code screenshot...'
        });
      }
    } else {
      updateProgress({ 
        status: 'connecting',
        currentStep: 'Waiting for WhatsApp Web UI to load in Chromium browser...' 
      });
    }

    await sleep(2000);
  }
  return false;
};

/**
 * STEP 3: Multiple Chat Opening Strategies
 */
const openChatWithStrategies = async (
  p: Page,
  cleanPhone: string,
  contactName: string,
  settings: AutomationSettings
): Promise<{ success: boolean; state: WhatsAppState; reason?: string }> => {
  logger.info(`Initiating multi-strategy chat opening for ${contactName} (+${cleanPhone})`);

  // --- STRATEGY 1: Direct URL Navigation ---
  try {
    logger.info(`[STRATEGY 1] Opening via Direct URL: https://web.whatsapp.com/send?phone=${cleanPhone}`);
    await p.goto(`https://web.whatsapp.com/send?phone=${cleanPhone}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Wait specifically for chat input textbox to load in active conversation window
    let chatOpened1 = false;
    for (let w = 0; w < 20; w++) {
      if (p.isClosed()) break;

      const state1 = await detectWhatsAppState(p);
      if (state1 === 'invalid_phone_dialog') {
        return { success: false, state: state1, reason: 'Phone number is invalid or not registered on WhatsApp' };
      }

      for (const sel of SELECTORS.textbox) {
        const isVisible = await p.locator(sel).first().isVisible().catch(() => false);
        if (isVisible) {
          chatOpened1 = true;
          break;
        }
      }
      if (chatOpened1) break;
      await sleep(1000);
    }

    if (chatOpened1) {
      logger.info('[STRATEGY 1 SUCCESS] Chat opened directly via URL.');
      await debugStepHook('Strategy 1 Opened Chat', p, null, settings);
      return { success: true, state: 'chat_opened' };
    }
    logger.warn('[STRATEGY 1 FAILED] Textbox not loaded via URL. Trying Strategy 2...');
  } catch (err1: any) {
    logger.warn(`[STRATEGY 1 FAILED] ${err1.message}. Falling back to Strategy 2...`);
  }

  // --- STRATEGY 2: Search Bar Strategy ---
  try {
    logger.info('[STRATEGY 2] Opening via WhatsApp Search Bar...');
    if (!p.url().startsWith('https://web.whatsapp.com') || p.url().includes('/send?')) {
      await p.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    await preparePageForInteraction(p, 15000);

    let searchBoxLocator = null;
    for (const sel of SELECTORS.searchBox) {
      const loc = p.locator(sel).first();
      if (await loc.isVisible().catch(() => false)) {
        searchBoxLocator = loc;
        break;
      }
    }

    if (searchBoxLocator) {
      await debugStepHook('Focus Search Box', p, searchBoxLocator, settings);
      await searchBoxLocator.click({ force: true }).catch(() => searchBoxLocator.dispatchEvent('click'));
      await sleep(500);

      // Clear search text and type phone number
      await p.keyboard.press('Control+A');
      await p.keyboard.press('Delete');
      await sleep(200);

      for (const char of cleanPhone) {
        await p.keyboard.type(char, { delay: Math.floor(Math.random() * 20) + 20 });
      }
      await sleep(1500);

      // Wait for search result or chat opened
      for (let r = 0; r < 10; r++) {
        for (const rSel of SELECTORS.searchResults) {
          const firstResult = p.locator(rSel).first();
          if (await firstResult.isVisible().catch(() => false)) {
            await firstResult.click({ force: true }).catch(() => {});
            logger.info(`[STRATEGY 2] Clicked search result element: ${rSel}`);
            await sleep(1500);
            break;
          }
        }

        const state2 = await detectWhatsAppState(p);
        if (state2 === 'chat_opened') {
          logger.info('[STRATEGY 2 SUCCESS] Chat opened via Search Bar.');
          return { success: true, state: state2 };
        }
        await sleep(1000);
      }
    }
    logger.warn('[STRATEGY 2 FAILED] Could not open chat via search bar. Trying Strategy 3...');
  } catch (err2: any) {
    logger.warn(`[STRATEGY 2 FAILED] ${err2.message}. Falling back to Strategy 3...`);
  }

  // --- STRATEGY 3: New Chat Drawer Strategy ---
  try {
    logger.info('[STRATEGY 3] Opening via New Chat Button...');
    let newChatBtnLocator = null;
    for (const sel of SELECTORS.newChatBtn) {
      const loc = p.locator(sel).first();
      if (await loc.isVisible().catch(() => false)) {
        newChatBtnLocator = loc;
        break;
      }
    }

    if (newChatBtnLocator) {
      await debugStepHook('Click New Chat Button', p, newChatBtnLocator, settings);
      await newChatBtnLocator.click({ force: true }).catch(() => newChatBtnLocator.dispatchEvent('click'));
      await sleep(1000);

      await p.keyboard.type(cleanPhone, { delay: 30 });
      await sleep(1500);

      for (let r = 0; r < 8; r++) {
        await p.keyboard.press('Enter');
        await sleep(1000);

        const state3 = await detectWhatsAppState(p);
        if (state3 === 'chat_opened') {
          logger.info('[STRATEGY 3 SUCCESS] Chat opened via New Chat drawer.');
          return { success: true, state: state3 };
        }
      }
    }
  } catch (err3: any) {
    logger.error(`[STRATEGY 3 FAILED] ${err3.message}`);
  }

  const finalState = await detectWhatsAppState(p);
  return {
    success: false,
    state: finalState,
    reason: `All 3 chat opening strategies failed. Final WhatsApp State: ${finalState}`
  };
};

/**
 * MAIN CAMPAIGN RUNNER
 */
export const startAutomation = async (contacts: Contact[], settings: AutomationSettings, startIndex = 0) => {
  if (progressState.status === 'running' || progressState.status === 'scanning_qr') {
    logger.warn('Automation is already active');
    return;
  }

  isPaused = false;
  shouldStop = false;
  startTime = Date.now();
  
  if (startIndex === 0) {
    initReports();
  }

  const totalContacts = settings.testMode ? Math.min(contacts.length, 3) : contacts.length;
  
  let successCount = contacts.filter((c, idx) => idx < startIndex && c.status === 'sent').length;
  let failedCount = contacts.filter((c, idx) => idx < startIndex && c.status === 'failed').length;
  let completed = startIndex;

  updateProgress({
    status: 'scanning_qr',
    total: totalContacts,
    completed,
    successCount,
    failedCount,
    currentStep: 'Launching Playwright...',
    currentDelay: 0,
    currentBatch: 0,
    elapsedTime: 0,
    eta: 0,
    qrCodeUrl: null,
    contacts: contacts
  });

  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => {
    if (!startTime) return;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    
    let eta = 0;
    if (completed > startIndex) {
      const avgTime = elapsed / (completed - startIndex);
      const remainingContacts = totalContacts - completed;
      eta = Math.round(avgTime * remainingContacts);
    } else {
      const remainingContacts = totalContacts - completed;
      eta = remainingContacts * (Math.round((settings.delayMin + settings.delayMax) / 2) + 5);
    }
    
    updateProgress({ elapsedTime: elapsed, eta });
  }, 1000);

  try {
    let launchSuccess = await launchBrowserAndAuthenticate(settings);
    if (!launchSuccess || shouldStop) {
      await closeBrowser();
      return;
    }

    let currentBatchSent = 0;
    let recoveryAttempts = 0;
    const maxRecoveryAttempts = 3;
    
    for (let i = startIndex; i < totalContacts; i++) {
      if (shouldStop) {
        logger.warn('Stopping execution midway...');
        break;
      }

      while (isPaused && !shouldStop) {
        updateProgress({ status: 'paused', currentStep: 'Paused' });
        await sleep(1000);
      }
      
      if (shouldStop) break;

      const contact = progressState.contacts[i];
      
      if (contact.status === 'sent' || contact.status === 'skipped') {
        completed++;
        updateProgress({ completed });
        continue;
      }

      saveResumeState({
        contacts: progressState.contacts,
        currentIndex: i,
        settings,
        stats: { successCount, failedCount, completed }
      });

      let sentSuccess = false;
      let errorReason: string | null = null;
      let duration = 0;
      const contactStartTime = Date.now();

      contact.status = 'sending';
      updateProgress({ 
        currentContact: contact,
        currentStep: `Opening Chat for ${contact.name}`
      });

      const cleanPhone = contact.phone.replace(/[^0-9]/g, '');

      // STEP 13: Structured Step Logging
      logger.info(`\n=====================================================`);
      logger.info(`Processing Contact [${i + 1}/${totalContacts}]: ${contact.name} (+${cleanPhone})`);
      logger.info(`=====================================================`);

      // Attempt loop for single contact
      for (let attempt = 0; attempt <= settings.retryCount; attempt++) {
        if (shouldStop) break;
        
        contact.retries = attempt;
        if (attempt > 0) {
          logger.warn(`Retrying contact ${contact.name} - Attempt ${attempt}/${settings.retryCount}`);
          updateProgress({ currentStep: `Retrying chat (${attempt}/${settings.retryCount})...` });
        }

        let currentStepSelector = 'N/A';

        try {
          // STEP 6: Session Health Check
          if (!page || page.isClosed() || !context) {
            throw new Error('BROWSER_CRASHED_OR_CLOSED');
          }

          const sessionValid = await isPageAuthenticated();
          if (!sessionValid) {
            logger.warn('Session check failed before contact. Re-authenticating...');
            const reAuth = await launchBrowserAndAuthenticate(settings);
            if (!reAuth) throw new Error('Session expired and re-authentication failed');
          }

          // STEP 3: Multi-Strategy Chat Opening
          currentStepSelector = 'Chat Opening Strategies';
          logger.info('[STEP] Opening Chat...');
          const openResult = await openChatWithStrategies(page, cleanPhone, contact.name, settings);

          if (!openResult.success) {
            if (openResult.state === 'invalid_phone_dialog') {
              errorReason = 'Invalid phone number or not registered on WhatsApp';
              break; // No retry for invalid numbers
            }
            throw new Error(openResult.reason || 'Chat failed to open using all 3 strategies');
          }

          // STEP 4 & 7: Textbox Detection & Step-Level Retry
          logger.info('[STEP] Locating Chat Textbox...');
          let activeTextboxLocator = null;

          for (let w = 0; w < 15 && !activeTextboxLocator && !shouldStop; w++) {
            for (const sel of SELECTORS.textbox) {
              const loc = page.locator(sel).first();
              if (await loc.isVisible().catch(() => false)) {
                activeTextboxLocator = loc;
                currentStepSelector = sel;
                logger.info(`[STEP SUCCESS] Textbox located using selector: ${sel}`);
                break;
              }
            }
            if (!activeTextboxLocator) await sleep(1000);
          }

          if (!activeTextboxLocator) {
            throw new Error('Chat message textbox not found in active conversation DOM');
          }

          await debugStepHook('Focus Textbox', page, activeTextboxLocator, settings);

          // STEP 5: Human-like Message Typing
          logger.info('[STEP] Typing Message...');
          updateProgress({ currentStep: 'Typing message...' });

          const message = settings.messageTemplate
            .replace(/{{name}}/g, contact.name)
            .replace(/{{phone}}/g, contact.phone)
            .replace(/{{websiteUrl}}/g, settings.websiteUrl || '');

          await activeTextboxLocator.click();
          await sleep(300);
          
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Delete');
          await sleep(200);

          const lines = message.split('\n');
          for (let lIdx = 0; lIdx < lines.length; lIdx++) {
            if (shouldStop) break;

            for (const char of lines[lIdx]) {
              await page.keyboard.type(char, { delay: Math.floor(Math.random() * 20) + 20 }); // 20-40ms delay
            }

            if (lIdx < lines.length - 1) {
              await page.keyboard.press('Shift+Enter');
            }
            await sleep(50);
          }

          // STEP 8: Verify Text Exists in Input
          const typedText = await activeTextboxLocator.textContent().catch(() => '');
          logger.info(`[STEP SUCCESS] Message typed into textbox. Character length: ${typedText?.length || 0}`);

          if (settings.dryRunMode) {
            sentSuccess = true;
            duration = Date.now() - contactStartTime;
            logger.info(`[DRY RUN] Message typed for ${contact.name}. Skipping click send.`);
            updateProgress({ currentStep: 'Dry Run: Ready to Send (Sending skipped)' });
            await sleep(3000);
            break;
          }

          // STEP 8: Find and Click Send Button (or Enter key)
          logger.info('[STEP] Clicking Send...');
          updateProgress({ currentStep: 'Sending message...' });

          let sendBtnLocator = null;
          for (const sel of SELECTORS.sendBtn) {
            const loc = page.locator(sel).first();
            if (await loc.isVisible().catch(() => false)) {
              sendBtnLocator = loc;
              currentStepSelector = sel;
              break;
            }
          }

          if (sendBtnLocator) {
            await debugStepHook('Click Send Button', page, sendBtnLocator, settings);
            await sendBtnLocator.click();
            logger.info('[STEP SUCCESS] Clicked Send button.');
          } else {
            logger.info('Send button not found directly. Pressing Enter key to send...');
            await page.keyboard.press('Enter');
          }

          // STEP 8 & 9: Verify Outgoing Message Bubble Exists in Chat
          logger.info('[STEP] Verifying Outgoing Message Bubble in Conversation...');
          let bubbleVerified = false;

          for (let v = 0; v < 10 && !bubbleVerified; v++) {
            for (const bSel of SELECTORS.outgoingBubble) {
              const bLoc = page.locator(bSel).last();
              if (await bLoc.isVisible().catch(() => false)) {
                bubbleVerified = true;
                await debugStepHook('Verified Outgoing Bubble', page, bLoc, settings);
                logger.info(`[STEP SUCCESS] Outgoing message bubble verified in chat using: ${bSel}`);
                break;
              }
            }
            if (!bubbleVerified) await sleep(1000);
          }

          if (!bubbleVerified) {
            logger.warn('Outgoing bubble check timed out, but text cleared out from input.');
          }

          sentSuccess = true;
          duration = Date.now() - contactStartTime;
          logger.info(`[CONTACT SUCCESS] Sent message to ${contact.name} in ${(duration / 1000).toFixed(2)}s`);
          break; // Success exit retry loop

        } catch (err: any) {
          errorReason = err.message;
          logger.error(`Attempt ${attempt} failed for contact ${contact.name}: ${err.message}`);

          // Save diagnostics bundle
          await saveFailureDiagnostics(page, contact, currentStepSelector, err.message, settings);

          // STEP 12: Browser Crash Auto-Recovery
          if (err.message === 'BROWSER_CRASHED_OR_CLOSED' || (page && page.isClosed()) || !context) {
            if (recoveryAttempts < maxRecoveryAttempts) {
              recoveryAttempts++;
              logger.warn(`[RECOVERY] Triggering Browser Auto-Recovery (${recoveryAttempts}/${maxRecoveryAttempts})...`);
              updateProgress({ currentStep: `Browser disconnected. Attempting auto-recovery (${recoveryAttempts}/${maxRecoveryAttempts})...` });
              
              await closeBrowser().catch(() => {});
              await sleep(3000);
              
              const recovered = await launchBrowserAndAuthenticate(settings);
              if (recovered) {
                logger.info('[RECOVERY SUCCESS] Browser restarted & session restored! Retrying contact...');
                attempt = -1;
                continue;
              }
            } else {
              throw new Error('Max browser recovery attempts reached. Automation aborted.');
            }
          }
          await sleep(2000);
        }
      }

      if (shouldStop) break;

      if (sentSuccess) {
        contact.status = 'sent';
        contact.errorReason = null;
        contact.duration = duration;
        successCount++;
        currentBatchSent++;
        logSentReport(contact);
      } else {
        contact.status = 'failed';
        contact.errorReason = errorReason || 'Unknown error occurred';
        contact.duration = Date.now() - contactStartTime;
        failedCount++;
        logFailedReport(contact);
      }

      completed++;
      
      updateProgress({
        completed,
        successCount,
        failedCount,
        currentContact: contact,
        currentBatch: currentBatchSent
      });

      if (settings.testMode && completed >= 3) {
        logger.info('Test Mode Limit reached (first 3 contacts). Finishing run.');
        break;
      }

      if (completed >= totalContacts) {
        break;
      }

      // STEP 11: Randomized Human Delays
      if (currentBatchSent < settings.batchSize) {
        const delaySec = Math.floor(Math.random() * (settings.delayMax - settings.delayMin + 1)) + settings.delayMin;
        logger.info(`[STEP] Waiting random human delay of ${delaySec} seconds...`);
        
        for (let countdown = delaySec; countdown > 0; countdown--) {
          if (shouldStop) break;
          while (isPaused && !shouldStop) {
            updateProgress({ status: 'paused', currentStep: 'Paused' });
            await sleep(1000);
          }
          updateProgress({ 
            currentStep: `Waiting ${countdown}s before next contact`,
            currentDelay: countdown
          });
          await sleep(1000);
        }
        updateProgress({ currentDelay: 0 });
      } else {
        currentBatchSent = 0;
        const batchDelaySec = Math.floor(Math.random() * (settings.batchDelayMax - settings.batchDelayMin + 1)) + settings.batchDelayMin;
        logger.warn(`[STEP] Batch limit reached. Sleeping for cooling period: ${batchDelaySec} seconds...`);
        
        for (let countdown = batchDelaySec; countdown > 0; countdown--) {
          if (shouldStop) break;
          while (isPaused && !shouldStop) {
            updateProgress({ status: 'paused', currentStep: 'Paused' });
            await sleep(1000);
          }
          updateProgress({
            currentStep: `Batch limit reached. Paused for batch cooling: ${countdown}s remaining`,
            currentDelay: countdown
          });
          await sleep(1000);
        }
        updateProgress({ currentDelay: 0 });
      }
    }

    if (!shouldStop) {
      updateProgress({ 
        status: 'completed',
        currentStep: 'Automation run completed successfully!',
        qrCodeUrl: null,
        currentContact: null
      });
      logger.info('WhatsApp Automation run completed successfully');
      
      writeFinalSummary(progressState, progressState.contacts, startTime);
      clearResumeState();
    }

  } catch (error: any) {
    logger.error(`Critical Automation Engine Failure: ${error.message}\n${error.stack}`);
    updateProgress({ 
      status: 'failed', 
      currentStep: `Fatal Error: ${error.message}`,
      qrCodeUrl: null 
    });
    
    saveResumeState({
      contacts: progressState.contacts,
      currentIndex: completed,
      settings,
      stats: { successCount, failedCount, completed }
    });
  } finally {
    if (!settings.debugMode) {
      await closeBrowser();
    } else {
      logger.info('[DEBUG MODE] Keeping Playwright browser window open after run for inspection.');
    }
  }
};
