# WhatsApp Automation Application (Local Engine)

A complete, production-ready, full-stack local web application for automated, personalized message delivery using WhatsApp Web. Built with React, Vite, TypeScript, Express, and Playwright.

---

## Folder Structure

The project is structured according to a scalable clean full-stack architecture:

```
whatsapp-automation/
├── backend/
│   ├── src/
│   │   ├── index.ts               # Express Server & Global Error boundaries
│   │   ├── routes/
│   │   │   └── index.ts           # Express Router (CSV, settings, and automation controls)
│   │   ├── services/
│   │   │   ├── automation.ts      # Playwright Automation Engine & recovery loops
│   │   │   ├── csv-validator.ts   # CSV parser & custom phone validations
│   │   │   ├── history-manager.ts # JSON campaign history manager
│   │   │   ├── report-manager.ts  # CSV and JSON report writers
│   │   │   ├── state-manager.ts   # Crash-resume tracker
│   │   │   └── storage.ts         # Configuration settings IO
│   │   ├── utils/
│   │   │   └── logger.ts          # Winston logger & event emitters
│   │   └── types/
│   │       └── index.ts           # Shared TypeScript models
│   ├── tsconfig.json              # Backend strict TypeScript configuration
│   └── package.json               # Backend dependencies (Winston, Playwright, CSV-Parser)
├── frontend/
│   ├── src/
│   │   ├── main.tsx               # App mount containing TanStack React Query Client
│   │   ├── App.tsx                # Main Dashboard UI & Event Streams listener
│   │   ├── components/
│   │   │   ├── ContactsTable.tsx  # Campaign csv histories & validator table
│   │   │   ├── DashboardStats.tsx # Execution performance metrics
│   │   │   ├── TemplateEditor.tsx # Invite editor with live mock preview
│   │   │   ├── SettingsForm.tsx   # Config manager via React Hook Form
│   │   │   ├── LiveTimeline.tsx   # Log terminal & SSE sub-step banner
│   │   │   └── QRModal.tsx        # WhatsApp scan popup
│   │   ├── hooks/
│   │   │   └── useSettings.ts     # Settings TanStack Query state hook
│   │   ├── store/
│   │   │   └── useStore.ts        # Zustand global state (toasts, logs, tabs)
│   │   └── utils/
│   │       └── notifications.ts   # Audio chimes & Desktop Web push alerts
│   ├── tsconfig.json              # Frontend TS config
│   └── package.json               # Frontend dependencies (Zustand, React Query, Tailwind)
├── playwright/
│   ├── tests/
│   │   └── smoke.spec.ts          # E2E Smoke validation suite
│   └── playwright.config.ts       # Playwright runner configurations
└── README.md                      # Documentation
```

---

## Installation & Setup

Ensure you have **Node.js (v18+)** installed.

### 1. Clone & Set Up Backend
```bash
cd backend
npm install
npx playwright install chromium
```

### 2. Set Up Frontend
```bash
cd ../frontend
npm install
```

### 3. Set Up E2E Tests
```bash
cd ../playwright
npm install
npx playwright install
```

---

## Running the Application

For a fully operational application, you must run both the backend and frontend servers simultaneously.

### Start Backend Dev Server
```bash
cd backend
npm run dev
```
Runs the API server on [http://localhost:5000](http://localhost:5000) using hot-reloaded TypeScript compilation.

### Start Frontend Dev Server
```bash
cd frontend
npm run dev
```
Launches the dashboard on [http://localhost:5173](http://localhost:5173). Open this URL in your web browser.

### Run Playwright Integration Tests
Ensure frontend dev server is running on port 5173, then:
```bash
cd playwright
npm run test
```

---

## How it Works

### 1. Playwright & WhatsApp Web Authentication
* The backend launches a **headful Chromium instance** managed by Playwright in the background.
* It uses a local persistent directory `storage/whatsapp-session` to cache cookies, local storage, and indexDB files.
* **No QR scan is required on every run:** Once scanned successfully, your browser session is kept active.
* If a session is inactive or expired, the backend captures screenshots of the WhatsApp Web QR Canvas and streams it to the frontend `QRModal` using **Server-Sent Events (SSE)** in real-time.

### 2. The CSV Parsing & Validation Pipeline
Your upload CSV file must include `Name` and `Phone` columns (case-insensitive headers).
```csv
Name,Phone
Sandeep,+919876543210
Ravi,+12025550143
```
* **Format Checks:** Phone numbers must start with `+` followed by a country code and a subscriber number (between 10 and 15 digits).
* **Validation Report:** The application screens for empty fields, duplicates, or country code formatting issues, showing a detailed validation report card on the UI before you start the campaign.

### 3. Safe Delays & Message Compilation
* **Random Delay:** Delay intervals (e.g. 5 to 10 seconds) are randomized between messages to emulate human behaviors and avoid WhatsApp anti-spam flags.
* **Batch Pauses:** After sending a custom batch size (e.g., 20 messages), the system triggers a cooling pause (e.g., 60 to 120 seconds) before proceeding automatically.
* **Template Placeholders:** Message syntax replaces tags like `{{name}}` and `{{phone}}` with corresponding contact properties.

---

## Advanced Resilience Features

### 1. Crash Recovery & Resuming
* If the backend server crashes, or your computer restarts midway, the current campaign progress is automatically stored in `storage/resume_state.json`.
* When the application restarts, a warning banner is shown on the UI offering to **Resume Run**. Clicking it automatically picks up from the exact last contact index, ensuring already-processed contacts are not messaged again.

### 2. Auto Browser Recovery
* If the Playwright browser window is closed unexpectedly (or crashes due to system resources), the automation loop enters recovery mode.
* It automatically closes dead references, attempts to re-initialize Chromium, navigates back to WhatsApp, confirms authentication, and retries the current contact without breaking the queue run.

### 3. Campaign History Reloads
* Upload history is tracked index-by-index in `storage/csv_history.json` and campaign contacts are persisted under `storage/campaigns/`.
* You can instantly reload past CSV campaigns directly from the "Recent CSV Campaigns" history sidebar when your queue is empty.

---

## Troubleshooting & FAQ

#### Q: Playwright browser fails to launch or throws errors about missing browser binaries?
Run `npx playwright install chromium` inside the `backend` folder to ensure local Chromium drivers are installed on your OS.

#### Q: The browser hangs on "Waiting for WhatsApp Web UI to load"?
This usually indicates network latency or slow internet speeds. You can adjust the load timeout constraints inside `backend/src/services/automation.ts`.

#### Q: WhatsApp shows "Phone number shared via url is invalid"?
Verify that the phone number in your CSV includes a proper `+` and country code. The local validator checks this, but WhatsApp ultimately determines subscriber status on their network.

#### Q: I closed the browser window. Did I lose my campaign progress?
No. The engine automatically detects the browser disconnect, attempts to relaunch it up to 3 times, or saves the current progress state, enabling you to click "Resume" from the dashboard once the browser is reopened.
