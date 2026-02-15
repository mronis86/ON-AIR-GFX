import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  deleteField,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Event, Poll, QandA } from '../types';
import { QAStatus } from '../types';

// Events Collection
export const eventsCollection = 'events';
export const pollsCollection = 'polls';
export const qaCollection = 'qa';
export const liveStateCollection = 'liveState';

/** Live state for an event: written by Operators page, read by Google Apps Script or CSV export. */
export interface LiveStateData {
  activePoll: { id: string; title: string; type: string; options: Array<{ text: string; votes?: number }>; googleSheetTab?: string } | null;
  activeQA: { question: string; answer?: string; submitterName?: string } | null;
  /** Q&A session ID to use for CSV export (ACTIVE, Cue, Next columns). Set via CSV button in Operators. */
  csvSourceSessionId?: string | null;
  /** Poll ID to use for live Poll CSV export. Set via CSV button in Operators. */
  csvSourcePollId?: string | null;
  pollSheetName?: string;
  qaSheetName?: string;
  qaCell?: string;
  eventName?: string;
  updatedAt: unknown;
}

export const setLiveState = async (eventId: string, data: Partial<Omit<LiveStateData, 'updatedAt'>>): Promise<void> => {
  const ref = doc(db, liveStateCollection, eventId);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
};

export const getLiveState = async (eventId: string): Promise<LiveStateData | null> => {
  const ref = doc(db, liveStateCollection, eventId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as LiveStateData) : null;
};

// Event Operations
export const createEvent = async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = new Date().toISOString();
  // Remove undefined values to avoid Firestore errors
  const cleanData: Record<string, any> = {
    name: eventData.name,
    date: eventData.date,
    createdAt: now,
    updatedAt: now,
  };
  
  if (eventData.googleSheetUrl) cleanData.googleSheetUrl = eventData.googleSheetUrl;
  if (eventData.googleSheetWebAppUrl) cleanData.googleSheetWebAppUrl = eventData.googleSheetWebAppUrl;
  if (eventData.activeQASheetName) cleanData.activeQASheetName = eventData.activeQASheetName;
  if (eventData.activeQACell) cleanData.activeQACell = eventData.activeQACell;

  const docRef = await addDoc(collection(db, eventsCollection), cleanData);
  return docRef.id;
};

export const getEvent = async (eventId: string): Promise<Event | null> => {
  const docRef = doc(db, eventsCollection, eventId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Event;
  }
  return null;
};

export const getAllEvents = async (): Promise<Event[]> => {
  const querySnapshot = await getDocs(collection(db, eventsCollection));
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Event[];
};

export const updateEvent = async (eventId: string, updates: Partial<Event>): Promise<void> => {
  const docRef = doc(db, eventsCollection, eventId);
  // Remove undefined values to avoid Firestore errors
  const cleanUpdates: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };
  
  // Only include fields that are not undefined
  if (updates.name !== undefined) cleanUpdates.name = updates.name;
  if (updates.date !== undefined) cleanUpdates.date = updates.date;
  if (updates.googleSheetUrl !== undefined) {
    if (updates.googleSheetUrl) cleanUpdates.googleSheetUrl = updates.googleSheetUrl;
    else cleanUpdates.googleSheetUrl = deleteField();
  }
  if (updates.googleSheetWebAppUrl !== undefined) {
    if (updates.googleSheetWebAppUrl) cleanUpdates.googleSheetWebAppUrl = updates.googleSheetWebAppUrl;
    else cleanUpdates.googleSheetWebAppUrl = deleteField();
  }
  if (updates.activeQASheetName !== undefined) {
    if (updates.activeQASheetName) cleanUpdates.activeQASheetName = updates.activeQASheetName;
    else cleanUpdates.activeQASheetName = deleteField();
  }
  if (updates.activeQACell !== undefined) {
    if (updates.activeQACell) cleanUpdates.activeQACell = updates.activeQACell;
    else cleanUpdates.activeQACell = deleteField();
  }
  if (updates.qaBackupSheetName !== undefined) {
    if (updates.qaBackupSheetName) cleanUpdates.qaBackupSheetName = updates.qaBackupSheetName;
    else cleanUpdates.qaBackupSheetName = deleteField();
  }
  if (updates.pollBackupSheetName !== undefined) {
    if (updates.pollBackupSheetName) cleanUpdates.pollBackupSheetName = updates.pollBackupSheetName;
    else cleanUpdates.pollBackupSheetName = deleteField();
  }
  if (updates.publicLink !== undefined) {
    if (updates.publicLink) {
      cleanUpdates.publicLink = updates.publicLink;
    } else {
      cleanUpdates.publicLink = deleteField();
    }
  }
  if (updates.railwayLiveCsvBaseUrl !== undefined) {
    if (updates.railwayLiveCsvBaseUrl) {
      cleanUpdates.railwayLiveCsvBaseUrl = updates.railwayLiveCsvBaseUrl;
    } else {
      cleanUpdates.railwayLiveCsvBaseUrl = deleteField();
    }
  }

  await updateDoc(docRef, cleanUpdates);
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  const docRef = doc(db, eventsCollection, eventId);
  await deleteDoc(docRef);
};

// Poll Operations
export const createPoll = async (pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'publicLink'>): Promise<string> => {
  // Initialize votes to 0 for all options and clean undefined imageUrl
  const optionsWithVotes = pollData.options.map(opt => {
    const optionData: any = {
      id: opt.id,
      text: opt.text,
      votes: 0,
    };
    if (opt.imageUrl) {
      optionData.imageUrl = opt.imageUrl;
    }
    return optionData;
  });
  const now = new Date().toISOString();
  const cleanData: Record<string, any> = {
    ...pollData,
    options: optionsWithVotes,
    isActive: false,
    isActiveForPublic: false,
    createdAt: now,
    updatedAt: now,
  };
  
  // Remove undefined values
  const finalData: Record<string, any> = {};
  for (const [key, value] of Object.entries(cleanData)) {
    if (value !== undefined) {
      finalData[key] = value;
    }
  }
  
  const docRef = await addDoc(collection(db, pollsCollection), finalData);
  return docRef.id;
};

export const getPoll = async (pollId: string): Promise<Poll | null> => {
  const docRef = doc(db, pollsCollection, pollId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Poll;
  }
  return null;
};

export const getPollsByEvent = async (eventId: string): Promise<Poll[]> => {
  const q = query(collection(db, pollsCollection), where('eventId', '==', eventId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Poll[];
};

/** Subscribe to polls for an event - Firestore only sends updates when data changes (reduces reads). */
export const subscribePollsByEvent = (eventId: string, callback: (polls: Poll[]) => void): Unsubscribe => {
  const q = query(collection(db, pollsCollection), where('eventId', '==', eventId));
  return onSnapshot(q, (snapshot) => {
    const polls = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Poll));
    callback(polls);
  });
};

export const updatePoll = async (pollId: string, updates: Partial<Poll>): Promise<void> => {
  const docRef = doc(db, pollsCollection, pollId);
  // Remove undefined values to avoid Firestore errors
  const cleanUpdates: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };
  
  // Only include fields that are not undefined
  if (updates.eventId !== undefined) cleanUpdates.eventId = updates.eventId;
  if (updates.type !== undefined) cleanUpdates.type = updates.type;
  if (updates.title !== undefined) cleanUpdates.title = updates.title;
  if (updates.options !== undefined) cleanUpdates.options = updates.options;
  if (updates.isActive !== undefined) cleanUpdates.isActive = updates.isActive;
  if (updates.isActiveForPublic !== undefined) cleanUpdates.isActiveForPublic = updates.isActiveForPublic;
  if (updates.displayType !== undefined) cleanUpdates.displayType = updates.displayType;
  if (updates.primaryColor !== undefined) cleanUpdates.primaryColor = updates.primaryColor;
  if (updates.secondaryColor !== undefined) cleanUpdates.secondaryColor = updates.secondaryColor;
  if (updates.showTitle !== undefined) cleanUpdates.showTitle = updates.showTitle;
  if (updates.showVoteCount !== undefined) cleanUpdates.showVoteCount = updates.showVoteCount;
  if (updates.layoutStyle !== undefined) cleanUpdates.layoutStyle = updates.layoutStyle;
  
  // Handle conditional fields based on layout style
  const newLayoutStyle = updates.layoutStyle;
  
  // fullScreenStyle should only exist for Full Screen layout (1)
  if (updates.fullScreenStyle !== undefined) {
    cleanUpdates.fullScreenStyle = updates.fullScreenStyle;
  } else if (newLayoutStyle !== undefined && newLayoutStyle !== 1) {
    // If layout is changing away from Full Screen, delete fullScreenStyle
    cleanUpdates.fullScreenStyle = deleteField();
  }
  
  if (updates.barEdgeStyle !== undefined) {
    if (updates.barEdgeStyle) {
      cleanUpdates.barEdgeStyle = updates.barEdgeStyle;
    } else {
      cleanUpdates.barEdgeStyle = deleteField();
    }
  }
  
  if (updates.borderRadius !== undefined) {
    if (updates.borderRadius !== undefined && updates.borderRadius !== null) {
      cleanUpdates.borderRadius = updates.borderRadius;
    } else {
      cleanUpdates.borderRadius = deleteField();
    }
  }
  
  // pipPosition should only exist for PIP layout (3)
  if (updates.pipPosition !== undefined) {
    cleanUpdates.pipPosition = updates.pipPosition;
  } else if (newLayoutStyle !== undefined && newLayoutStyle !== 3) {
    // If layout is changing away from PIP, delete pipPosition
    cleanUpdates.pipPosition = deleteField();
  }
  
  if (updates.titleSettings !== undefined) {
    if (updates.titleSettings && Object.keys(updates.titleSettings).length > 0) {
      cleanUpdates.titleSettings = updates.titleSettings;
    } else {
      cleanUpdates.titleSettings = deleteField();
    }
  }
  
  if (updates.backgroundSettings !== undefined) {
    if (updates.backgroundSettings && Object.keys(updates.backgroundSettings).length > 0) {
      cleanUpdates.backgroundSettings = updates.backgroundSettings;
    } else {
      cleanUpdates.backgroundSettings = deleteField();
    }
  }
  
  if (updates.borderSettings !== undefined) {
    if (updates.borderSettings && Object.keys(updates.borderSettings).length > 0) {
      cleanUpdates.borderSettings = updates.borderSettings;
    } else {
      cleanUpdates.borderSettings = deleteField();
    }
  }
  
  if (updates.outputSettings !== undefined) {
    if (updates.outputSettings && Object.keys(updates.outputSettings).length > 0) {
      cleanUpdates.outputSettings = updates.outputSettings;
    } else {
      cleanUpdates.outputSettings = deleteField();
    }
  }

  if (updates.googleSheetTab !== undefined) {
    if (updates.googleSheetTab) cleanUpdates.googleSheetTab = updates.googleSheetTab;
    else cleanUpdates.googleSheetTab = deleteField();
  }
  
  if (updates.emptyBarColor !== undefined) {
    cleanUpdates.emptyBarColor = updates.emptyBarColor;
  }
  
  // Handle publicLink - if undefined, delete the field; if empty string, also delete
  if (updates.publicLink !== undefined) {
    if (updates.publicLink) {
      cleanUpdates.publicLink = updates.publicLink;
    } else {
      // For undefined or empty string, delete the field from Firestore
      cleanUpdates.publicLink = deleteField();
    }
  }
  
  // Final cleanup: Remove any undefined values that might have slipped through
  const finalUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(cleanUpdates)) {
    if (value !== undefined) {
      finalUpdates[key] = value;
    }
  }
  
  await updateDoc(docRef, finalUpdates);
};

/**
 * Increments vote count for poll options
 * @param pollId - The ID of the poll
 * @param optionIds - Array of option IDs to increment votes for
 */
export const submitPollVotes = async (pollId: string, optionIds: string[]): Promise<void> => {
  const pollRef = doc(db, pollsCollection, pollId);
  const pollSnap = await getDoc(pollRef);
  
  if (!pollSnap.exists()) {
    throw new Error('Poll not found');
  }
  
  const pollData = pollSnap.data() as Poll;
  const updatedOptions = pollData.options.map((option) => {
    if (optionIds.includes(option.id)) {
      return {
        ...option,
        votes: (option.votes || 0) + 1,
      };
    }
    return option;
  });
  
  await updatePoll(pollId, {
    options: updatedOptions,
  });
};

export const deletePoll = async (pollId: string): Promise<void> => {
  const docRef = doc(db, pollsCollection, pollId);
  await deleteDoc(docRef);
};

// Q&A Operations
export const createQA = async (qa: Omit<QandA, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = new Date().toISOString();
  
  // Clean up undefined values - Firestore doesn't accept undefined
  const cleanData: Record<string, any> = {
    createdAt: now,
    updatedAt: now,
  };
  
  // Only include fields that are not undefined
  for (const [key, value] of Object.entries(qa)) {
    if (value !== undefined) {
      // Skip empty objects for optional settings fields (these can be added later via updateQA)
      if (typeof value === 'object' && value !== null && Array.isArray(value) === false) {
        const isEmpty = Object.keys(value).length === 0;
        if (isEmpty && (key === 'titleSettings' || key === 'backgroundSettings' || key === 'borderSettings' || key === 'outputSettings')) {
          // Skip empty objects for these optional fields
          continue;
        }
      }
      cleanData[key] = value;
    }
  }
  
  const docRef = await addDoc(collection(db, qaCollection), cleanData);
  return docRef.id;
};

export const getQA = async (qaId: string): Promise<QandA | null> => {
  const docRef = doc(db, qaCollection, qaId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as QandA;
  }
  return null;
};

export const getQAsByEvent = async (eventId: string): Promise<QandA[]> => {
  const q = query(collection(db, qaCollection), where('eventId', '==', eventId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as QandA[];
};

/** Subscribe to Q&A for an event - Firestore only sends updates when data changes (reduces reads). */
export const subscribeQAsByEvent = (eventId: string, callback: (qas: QandA[]) => void): Unsubscribe => {
  const q = query(collection(db, qaCollection), where('eventId', '==', eventId));
  return onSnapshot(q, (snapshot) => {
    const qas = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as QandA));
    callback(qas);
  });
};

export const getQAsByStatus = async (eventId: string, status: string): Promise<QandA[]> => {
  const q = query(
    collection(db, qaCollection),
    where('eventId', '==', eventId),
    where('status', '==', status)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as QandA[];
};

/** Get questions (submissions) for a specific Q&A session.
 * When includeOrphaned is true (e.g. event has only one session), questions without sessionId are included. */
export const getQuestionsBySession = async (
  sessionId: string,
  eventId: string,
  options?: { includeOrphaned?: boolean }
): Promise<QandA[]> => {
  const allQAs = await getQAsByEvent(eventId);
  const submissions = allQAs.filter((qa) => {
    if (!qa.question || qa.name) return false;
    if (qa.sessionId === sessionId) return true;
    if (options?.includeOrphaned && !qa.sessionId) return true; // Legacy questions before sessionId existed
    return false;
  });
  return submissions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const updateQA = async (qaId: string, updates: Partial<QandA>): Promise<void> => {
  const docRef = doc(db, qaCollection, qaId);
  const cleanUpdates: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };
  
  // Only include fields that are not undefined
  if (updates.name !== undefined) cleanUpdates.name = updates.name;
  if (updates.question !== undefined) cleanUpdates.question = updates.question;
  if (updates.answer !== undefined) cleanUpdates.answer = updates.answer;
  if (updates.status !== undefined) cleanUpdates.status = updates.status;
  if (updates.isActive !== undefined) cleanUpdates.isActive = updates.isActive;
  if (updates.isActiveForPublic !== undefined) cleanUpdates.isActiveForPublic = updates.isActiveForPublic;
  if (updates.isNext !== undefined) cleanUpdates.isNext = updates.isNext;
  if (updates.isQueued !== undefined) cleanUpdates.isQueued = updates.isQueued;
  if (updates.isDone !== undefined) cleanUpdates.isDone = updates.isDone;
  if (updates.submitterName !== undefined) cleanUpdates.submitterName = updates.submitterName;
  if (updates.submitterEmail !== undefined) cleanUpdates.submitterEmail = updates.submitterEmail;
  if (updates.moderatorNotes !== undefined) cleanUpdates.moderatorNotes = updates.moderatorNotes;
  if (updates.enablePublicSubmission !== undefined) cleanUpdates.enablePublicSubmission = updates.enablePublicSubmission;
  if (updates.collectName !== undefined) cleanUpdates.collectName = updates.collectName;
  if (updates.collectEmail !== undefined) cleanUpdates.collectEmail = updates.collectEmail;
  if (updates.allowAnonymous !== undefined) cleanUpdates.allowAnonymous = updates.allowAnonymous;
  if (updates.layoutStyle !== undefined) cleanUpdates.layoutStyle = updates.layoutStyle;
  if (updates.splitScreenPosition !== undefined) cleanUpdates.splitScreenPosition = updates.splitScreenPosition;
  if (updates.primaryColor !== undefined) cleanUpdates.primaryColor = updates.primaryColor;
  if (updates.secondaryColor !== undefined) cleanUpdates.secondaryColor = updates.secondaryColor;
  if (updates.titleSize !== undefined) cleanUpdates.titleSize = updates.titleSize;
  if (updates.showTitle !== undefined) cleanUpdates.showTitle = updates.showTitle;
  if (updates.showName !== undefined) cleanUpdates.showName = updates.showName;
  if (updates.queueOrder !== undefined) cleanUpdates.queueOrder = updates.queueOrder;
  
  if (updates.titleSettings !== undefined) {
    if (updates.titleSettings && Object.keys(updates.titleSettings).length > 0) {
      cleanUpdates.titleSettings = updates.titleSettings;
    } else {
      cleanUpdates.titleSettings = deleteField();
    }
  }
  
  if (updates.backgroundSettings !== undefined) {
    if (updates.backgroundSettings && Object.keys(updates.backgroundSettings).length > 0) {
      cleanUpdates.backgroundSettings = updates.backgroundSettings;
    } else {
      cleanUpdates.backgroundSettings = deleteField();
    }
  }
  
  if (updates.borderSettings !== undefined) {
    if (updates.borderSettings && Object.keys(updates.borderSettings).length > 0) {
      cleanUpdates.borderSettings = updates.borderSettings;
    } else {
      cleanUpdates.borderSettings = deleteField();
    }
  }
  
  if (updates.answerSettings !== undefined) {
    if (updates.answerSettings && Object.keys(updates.answerSettings).length > 0) {
      cleanUpdates.answerSettings = updates.answerSettings;
    } else {
      cleanUpdates.answerSettings = deleteField();
    }
  }
  
  if (updates.nameSettings !== undefined) {
    if (updates.nameSettings && Object.keys(updates.nameSettings).length > 0) {
      cleanUpdates.nameSettings = updates.nameSettings;
    } else {
      cleanUpdates.nameSettings = deleteField();
    }
  }
  
  if (updates.borderRadius !== undefined) {
    if (updates.borderRadius !== undefined && updates.borderRadius !== null) {
      cleanUpdates.borderRadius = updates.borderRadius;
    } else {
      cleanUpdates.borderRadius = deleteField();
    }
  }
  
  if (updates.outputSettings !== undefined) {
    if (updates.outputSettings && Object.keys(updates.outputSettings).length > 0) {
      // Filter out empty arrays within outputSettings before saving
      const filteredOutputSettings: { [key: string]: number[] | undefined } = {};
      if (updates.outputSettings.fullScreen && updates.outputSettings.fullScreen.length > 0) {
        filteredOutputSettings.fullScreen = updates.outputSettings.fullScreen;
      }
      if (updates.outputSettings.lowerThird && updates.outputSettings.lowerThird.length > 0) {
        filteredOutputSettings.lowerThird = updates.outputSettings.lowerThird;
      }
      if (updates.outputSettings.pip && updates.outputSettings.pip.length > 0) {
        filteredOutputSettings.pip = updates.outputSettings.pip;
      }
      if (updates.outputSettings.splitScreen && updates.outputSettings.splitScreen.length > 0) {
        filteredOutputSettings.splitScreen = updates.outputSettings.splitScreen;
      }
      
      if (Object.keys(filteredOutputSettings).length > 0) {
        cleanUpdates.outputSettings = filteredOutputSettings;
      } else {
        cleanUpdates.outputSettings = deleteField();
      }
    } else {
      cleanUpdates.outputSettings = deleteField();
    }
  }
  
  if (updates.publicLink !== undefined) {
    if (updates.publicLink) {
      cleanUpdates.publicLink = updates.publicLink;
    } else {
      cleanUpdates.publicLink = deleteField();
    }
  }
  
  // Final cleanup: Remove any undefined values
  const finalUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(cleanUpdates)) {
    if (value !== undefined) {
      finalUpdates[key] = value;
    }
  }
  
  await updateDoc(docRef, finalUpdates);
};

export const deleteQA = async (qaId: string): Promise<void> => {
  const docRef = doc(db, qaCollection, qaId);
  await deleteDoc(docRef);
};

export const submitQA = async (qaId: string, answer: string): Promise<void> => {
  const qaRef = doc(db, qaCollection, qaId);
  const qaSnap = await getDoc(qaRef);
  
  if (!qaSnap.exists()) {
    throw new Error('Q&A not found');
  }
  
  // For now, we'll create a submissions subcollection
  // This allows multiple submissions per Q&A
  const submissionsRef = collection(qaRef, 'submissions');
  await addDoc(submissionsRef, {
    answer: answer,
    createdAt: new Date().toISOString(),
  });
};

export const submitPublicQuestion = async (
  qaId: string,
  question: string,
  submitterName?: string,
  submitterEmail?: string,
  isAnonymous?: boolean
): Promise<void> => {
  // Get the Q&A item that this public submission is for
  const qaRef = doc(db, qaCollection, qaId);
  const qaSnap = await getDoc(qaRef);
  
  if (!qaSnap.exists()) {
    throw new Error('Q&A not found');
  }

  const qaData = qaSnap.data() as QandA;
  
  // Check if this is a Q&A session container (has name, no question)
  if (!qaData.name || qaData.question) {
    throw new Error('Invalid Q&A session');
  }

  // Create a new Q&A item as a submission (pending status)
  const now = new Date().toISOString();
  const submissionData: Record<string, any> = {
    eventId: qaData.eventId,
    sessionId: qaId, // Link to parent Q&A session
    name: '', // Empty name for submissions - they're questions, not sessions
    question: question.trim(),
    status: QAStatus.PENDING,
    isActive: false,
    isNext: false,
    // Only include name/email if provided and allowed
    submitterName: (!isAnonymous && submitterName?.trim()) ? submitterName.trim() : undefined,
    submitterEmail: (!isAnonymous && submitterEmail?.trim()) ? submitterEmail.trim() : undefined,
    // Inherit public submission settings from parent
    enablePublicSubmission: false, // Submissions don't allow further submissions
    collectName: qaData.collectName,
    collectEmail: qaData.collectEmail,
    allowAnonymous: qaData.allowAnonymous,
    // Inherit layout and color settings from parent
    layoutStyle: qaData.layoutStyle,
    splitScreenPosition: qaData.splitScreenPosition,
    primaryColor: qaData.primaryColor,
    secondaryColor: qaData.secondaryColor,
    createdAt: now,
    updatedAt: now,
  };

  // Only include optional settings if they exist and are not undefined
  if (qaData.titleSettings && Object.keys(qaData.titleSettings).length > 0) {
    submissionData.titleSettings = qaData.titleSettings;
  }
  if (qaData.answerSettings && Object.keys(qaData.answerSettings).length > 0) {
    submissionData.answerSettings = qaData.answerSettings;
  }
  if (qaData.nameSettings && Object.keys(qaData.nameSettings).length > 0) {
    submissionData.nameSettings = qaData.nameSettings;
  }
  if (qaData.backgroundSettings && Object.keys(qaData.backgroundSettings).length > 0) {
    submissionData.backgroundSettings = qaData.backgroundSettings;
  }
  if (qaData.borderSettings && Object.keys(qaData.borderSettings).length > 0) {
    submissionData.borderSettings = qaData.borderSettings;
  }
  if (qaData.borderRadius !== undefined) {
    submissionData.borderRadius = qaData.borderRadius;
  }
  if (qaData.splitScreenSide !== undefined) {
    submissionData.splitScreenSide = qaData.splitScreenSide;
  }
  if (qaData.splitScreenWidth !== undefined) {
    submissionData.splitScreenWidth = qaData.splitScreenWidth;
  }

  // Remove undefined values before adding to Firestore
  const cleanSubmissionData: Record<string, any> = {};
  for (const [key, value] of Object.entries(submissionData)) {
    if (value !== undefined) {
      cleanSubmissionData[key] = value;
    }
  }

  await addDoc(collection(db, qaCollection), cleanSubmissionData);
};

