# ON-AIR GFX - Broadcast Graphics Manager

A Firebase-powered web application for managing broadcast graphics events and items, with real-time Google Sheets integration for systems like VMIX and Singular.Live.

## Features

- **Event Management**: Create and manage broadcast events with dates and Google Sheets integration
- **Poll Creation**: Create polls with multiple types (Single Choice, Multiple Choice, Rating Scale, Yes/No) with up to 6 options
- **Google Sheets Integration**: Per-event Google Sheet target with Web App URL; polls and Q&A push to sub-sheets or a cell
- **Real-time Updates**: Active poll results and active Q&A are POSTed to your Apps Script Web App when they change

## Google Sheet integration (event-level)

For each **event** you can set:

- **Google Sheet URL** – link to the spreadsheet (for opening the sheet).
- **Web App URL** – the “Deploy as Web app” URL from **Extensions → Apps Script** for that same spreadsheet. The app POSTs JSON to this URL so your script can write to the sheet.
- **Active Q&A sub-sheet** and **cell** (e.g. `Live` / `A1`) – the currently active Q&A question is written to that cell when it changes.
- Per **poll**, you can set a **target sheet tab**; the active poll’s full info and results are sent to that tab when it’s live.

When you save the event with a **Web App URL**, the app sends an **initialize** request so your script can create default sub-sheets (Events, Polls, WebLinks, InfoBars, Boxes, Q&A) if they don’t exist.

**Copy the full Apps Script:** In the app, open an event → Google Sheet section → **Copy script for your Google Sheet**. Paste that into your sheet (Extensions → Apps Script), then Deploy → Deploy as web app. Copy the Web App URL into the event’s **Web App URL** field. The app uses a Firebase proxy so saving works without “Failed to fetch”; deploy with `firebase deploy` (including `functions`) so the proxy is active.

**Apps Script (Web App)** – implement `doPost(e)` and parse `JSON.parse(e.postData.contents)`:

- **`type: 'initialize'`** – `sheetNames` array; create each sheet tab if it doesn’t exist (e.g. `Events`, `Polls`, `WebLinks`, `InfoBars`, `Boxes`, `Q&A`).
- **`type: 'poll'`** – `subSheet`, `poll` (id, title, type, options, isActive); write poll data to the named tab.
- **`type: 'qa_active'`** – `sheetName`, `cell`, `data` (question, answer, submitterName); write the active Q&A to that cell (empty strings when no active Q&A).

Example **initialize** handler in Apps Script (creates missing tabs; add your own handling for `poll` and `qa_active`):

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (data.type === 'initialize' && data.sheetNames) {
    data.sheetNames.forEach(function(name) {
      if (!ss.getSheetByName(name)) ss.insertSheet(name);
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Tech Stack

- React 18 + TypeScript
- Firebase (Firestore, Hosting)
- Tailwind CSS
- Vite
- React Router
- Google Sheets API (for future implementation)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase account
- Google account (for Google Sheets integration)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up Firebase:

   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or select an existing one
   - Enable Firestore Database
   - Get your Firebase configuration

3. Create a `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

4. Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

5. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Firebase Setup Instructions

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter project name (e.g., "on-air-gfx")
   - Enable/disable Google Analytics (optional)
   - Click "Create project"

### Step 2: Enable Firestore Database

1. In your Firebase project, go to "Build" → "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (we'll update rules later)
4. Select a location for your database
5. Click "Enable"

### Step 3: Get Firebase Configuration

1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Register your app with a nickname (e.g., "ON-AIR-GFX Web")
5. Copy the Firebase configuration object
6. Add these values to your `.env` file

### Step 4: Install Firebase CLI (for deployment)

```bash
npm install -g firebase-tools
```

### Step 5: Login to Firebase

```bash
firebase login
```

### Step 6: Initialize Firebase in Your Project

```bash
firebase init
```

Select:
- Firestore (for database rules)
- Hosting (for deployment)

When prompted:
- Use existing project: Select your Firebase project
- Firestore rules file: `firestore.rules` (already created)
- Firestore indexes file: `firestore.indexes.json` (already created)
- Public directory: `dist` (Vite's build output)
- Single-page app: Yes
- Overwrite index.html: No

### Step 7: Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Step 8: Build and Deploy (when ready)

```bash
npm run build
firebase deploy --only hosting
```

## Deploying the live CSV server (Railway)

The **live-csv-server** (Companion API + live CSV endpoints for VMIX/Sheets) runs on [Railway](https://railway.app/). Push to GitHub to deploy:

- Connect your GitHub repo to Railway and set the service **Root Directory** to `live-csv-server` (see the Dockerfile there).
- **Push to GitHub** → Railway builds and deploys from the `main` branch (or your configured branch). No separate deploy step needed after `git push`.

```bash
git add .
git commit -m "Your message"
git push origin main
```

## Project Structure

```
ON-AIR-GFX/
├── src/
│   ├── components/       # React components
│   │   ├── EventForm.tsx
│   │   ├── EventList.tsx
│   │   └── PollForm.tsx
│   ├── pages/           # Page components
│   │   ├── EventsPage.tsx
│   │   └── EventDetailPage.tsx
│   ├── services/        # Firebase and API services
│   │   ├── firebase.ts
│   │   ├── firestore.ts
│   │   └── googleSheets.ts
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/           # Utility functions
│   │   └── qrCode.ts
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── firebase.json        # Firebase configuration
├── firestore.rules      # Firestore security rules
└── .env                 # Environment variables (create this)
```

## Usage

### Creating an Event

1. Click "+ New Event" on the main page
2. Enter event name and date
3. (Optional) Add a Google Sheets URL - the app will create sub-sheets automatically
4. Click "Create Event"

### Creating a Poll

1. Navigate to an event's detail page
2. Click "+ New Poll"
3. Select poll type
4. Enter poll title
5. Add 2-6 options
6. Click "Create Poll"

## Google Sheets Integration

When you provide a Google Sheets URL:
- The app extracts the spreadsheet ID
- Creates sub-sheets: Events, Polls, WebLinks, InfoBars, Boxes, Q&A
- Writes data in real-time as items are created

**Note**: Full Google Sheets API integration requires additional setup (Service Account or OAuth). The current implementation includes the structure and placeholder functions.

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Future Features

- WebLinks with QR Codes
- InfoBars (scrolling text)
- Boxes (text displays)
- Q&A management
- Web-based animations for graphics
- Real-time Google Sheets API integration
- Authentication system

## License

MIT





