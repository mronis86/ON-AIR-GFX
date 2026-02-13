# Firebase Setup Guide

This guide will walk you through setting up Firebase for the ON-AIR GFX application.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** (or select an existing project)
3. Enter a project name (e.g., "on-air-gfx")
4. Click **"Continue"**
5. (Optional) Enable Google Analytics - you can skip this for now
6. Click **"Create project"**
7. Wait for the project to be created, then click **"Continue"**

## Step 2: Enable Firestore Database

1. In your Firebase project dashboard, click **"Build"** in the left sidebar
2. Click **"Firestore Database"**
3. Click **"Create database"**
4. Select **"Start in test mode"** (we'll update the rules later)
5. Choose a location for your database (select the closest region to your users)
6. Click **"Enable"**

**Note**: The app includes `firestore.rules` with public read/write access. For production, you'll want to add authentication and proper security rules.

## Step 3: Get Your Firebase Configuration

1. In Firebase Console, click the **gear icon** (⚙️) next to "Project Overview"
2. Select **"Project settings"**
3. Scroll down to the **"Your apps"** section
4. Click the **web icon** (`</>`) to add a web app
5. Register your app:
   - Enter an app nickname (e.g., "ON-AIR-GFX Web")
   - (Optional) Check "Also set up Firebase Hosting"
   - Click **"Register app"**
6. You'll see your Firebase configuration object. It looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 4: Create Environment Variables File

1. In your project root, create a file named `.env`
2. Copy the `.env.example` file if it exists, or create a new one
3. Add your Firebase configuration values:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Important**: Replace the placeholder values with your actual Firebase configuration values from Step 3.

## Step 5: Install Firebase CLI (Optional, for deployment)

If you want to deploy your app to Firebase Hosting:

1. Install Firebase CLI globally:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase in your project:
```bash
firebase init
```

When prompted:
- Select **Firestore** (for database rules)
- Select **Hosting** (for web deployment)
- Choose **"Use an existing project"** and select your Firebase project
- For Firestore rules file: `firestore.rules` (already exists)
- For Firestore indexes: `firestore.indexes.json` (already exists)
- For public directory: `dist` (this is where Vite builds your app)
- Single-page app: **Yes**
- Overwrite index.html: **No**

## Step 6: Deploy Firestore Rules

Deploy the security rules to Firebase:

```bash
firebase deploy --only firestore:rules
```

This will apply the rules defined in `firestore.rules` to your Firestore database.

## Step 7: Test Your Setup

1. Start the development server:
```bash
npm run dev
```

2. Open your browser to `http://localhost:5173`
3. Try creating an event - if it works, Firebase is configured correctly!

## Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Make sure your `.env` file exists in the project root
- Verify all environment variables start with `VITE_`
- Restart your development server after creating/updating `.env`

### "Permission denied" errors
- Make sure you've deployed Firestore rules: `firebase deploy --only firestore:rules`
- Check that `firestore.rules` allows read/write (currently set to public access)

### Can't connect to Firestore
- Verify your Firebase project ID is correct in `.env`
- Check that Firestore Database is enabled in Firebase Console
- Ensure you've selected the correct Firebase project

## Next Steps

Once Firebase is set up:
1. Test creating events and polls
2. Set up Google Sheets API integration (see Google Sheets setup guide)
3. Deploy your app to Firebase Hosting when ready

## Security Note

The current Firestore rules allow public read/write access. For production:
- Add Firebase Authentication
- Update `firestore.rules` to require authentication
- Implement proper user roles and permissions





