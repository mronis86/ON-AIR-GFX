# ON-AIR GFX - Broadcast Graphics Manager

A Firebase-powered web application for managing broadcast graphics events and items, with real-time Google Sheets integration for systems like VMIX and Singular.Live.

## Features

- **Event Management**: Create and manage broadcast events with dates and Google Sheets integration
- **Poll Creation**: Create polls with multiple types (Single Choice, Multiple Choice, Rating Scale, Yes/No) with up to 6 options
- **Google Sheets Integration**: Automatically syncs data to Google Sheets for broadcast systems
- **Real-time Updates**: Changes are immediately reflected in connected Google Sheets
- **Live data webhook**: Optional URL (e.g. Google Apps Script Web App) to POST current active poll and Q&A as JSON whenever they change, so you can mirror data to a Google Sheet or other endpoint

## Live data webhook (Google Sheet / external URL)

In **Animation Settings** you can set a **Live data webhook** URL. When set, the app sends a POST request with JSON whenever the active poll or Q&A changes. Payload includes `timestamp`, `eventId`, `eventName`, `activePoll` (id, title, options), and `activeQA` (id, question, answer, submitterName).

**To send this data to a Google Sheet:** create a new Google Sheet, go to Extensions → Apps Script, and add a script that implements `doPost(e)`: parse `JSON.parse(e.postData.contents)` and append the fields you need to a sheet. Deploy the script as a Web App (Execute as: Me, Who has access: Anyone), copy the Web App URL, and paste it into the "Live data webhook" field in the app.

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





