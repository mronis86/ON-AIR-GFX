// Event Types
export interface Event {
  id: string;
  name: string;
  date: string; // ISO date string
  /** Spreadsheet URL (for display / open link) */
  googleSheetUrl?: string;
  /** Apps Script Web App URL — POST poll/QA updates here to write to the sheet */
  googleSheetWebAppUrl?: string;
  /** Sub-sheet name where the active Q&A question is written (e.g. "Live") */
  activeQASheetName?: string;
  /** Cell for active Q&A (e.g. "A1") — active question/answer update this cell */
  activeQACell?: string;
  /** Base URL of Railway live-csv server (e.g. https://xxx.up.railway.app) for IMPORTDATA formula */
  railwayLiveCsvBaseUrl?: string;
  publicLink?: string; // Public link for event submissions
  createdAt: string;
  updatedAt: string;
}

// Poll Types
export enum PollType {
  SINGLE_CHOICE = 'single_choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  RATING_SCALE = 'rating_scale',
  YES_NO = 'yes_no',
}

export enum PollDisplayType {
  CARDS = 'cards',
  BARS = 'bars',
  PIE_CHART = 'pie_chart',
  NUMBERS = 'numbers',
  LIST = 'list',
  GRID = 'grid',
  CIRCULAR = 'circular',
  ANIMATED_BARS = 'animated_bars',
}

export interface PollOption {
  id: string;
  text: string;
  votes?: number;
  imageUrl?: string; // URL to PNG icon or image
}

export interface Poll {
  id: string;
  eventId: string;
  type: PollType;
  title: string;
  options: PollOption[]; // Max 6 options
  isActive: boolean; // Shown on output (Play/Stop in Operators)
  isActiveForPublic?: boolean; // Shown on public event page for voting (Active button in Operators)
  publicLink?: string; // Temporary public link for submissions
  displayType?: PollDisplayType; // How to display the poll
  primaryColor?: string; // Primary color (hex)
  secondaryColor?: string; // Secondary color (hex)
  emptyBarColor?: string; // Empty/unpopulated bar color (hex with opacity, e.g., rgba(255,255,255,0.2))
  showTitle?: boolean; // Whether to show the poll title (default: true)
  showVoteCount?: boolean; // Whether to show vote counts (default: true)
  layoutStyle?: number; // Style variant for the layout (1=Full Screen, 2=Lower Third, 3=PIP)
  fullScreenStyle?: 'horizontal' | 'vertical'; // Full Screen style variant (default: 'horizontal')
  barEdgeStyle?: 'square' | 'beveled' | 'rounded'; // Bar edge style for poll bars (default: 'rounded')
  borderRadius?: number; // Border radius in pixels for container/border (0 = square, default: 0)
  pipPosition?: 'left' | 'right'; // PIP position (default: 'right')
  titleSize?: 'small' | 'medium' | 'large'; // Title size (default: 'large')
  // Per-layout title settings (independent for each layout type)
  titleSettings?: {
    fullScreen?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' }; // Font size in px, Y position in px (positive = down, negative = up), horizontal justification
    lowerThird?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' };
    pip?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' };
  };
  // Per-layout background settings (independent for each layout type)
  backgroundSettings?: {
    fullScreen?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string };
    lowerThird?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string };
    pip?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string };
  };
  // Per-layout border settings (independent for each layout type)
  borderSettings?: {
    fullScreen?: { thickness?: number; position?: 'inner' | 'outer'; zoom?: number }; // zoom = scale percentage (70-150, default 100)
    lowerThird?: { thickness?: number; position?: 'inner' | 'outer' | 'line'; type?: 'line' | 'boxEdge'; zoom?: number; yPosition?: number }; // For lower third: 'line' = top border only, 'boxEdge' = full border box inset 10px, zoom = scale percentage (70-100, default 100), yPosition = vertical offset in px (default 0)
    pip?: { thickness?: number; position?: 'inner' | 'outer'; zoom?: number; xPosition?: number; yPosition?: number }; // For PIP: zoom = scale percentage (70-150, default 100), xPosition = horizontal offset in px (default 0), yPosition = vertical offset in px (default 0)
  };
  // Output settings: which outputs (1-4) should show which layout types
  outputSettings?: {
    fullScreen?: number[]; // Array of output numbers (1-4) that should show this poll as Full Screen
    lowerThird?: number[]; // Array of output numbers (1-4) that should show this poll as Lower Third
    pip?: number[]; // Array of output numbers (1-4) that should show this poll as PIP
  };
  /** If set, poll full info and results are sent to this sub-sheet name in the event's Google Sheet */
  googleSheetTab?: string;
  createdAt: string;
  updatedAt: string;
}

// Future item types (to be implemented)
export interface WebLink {
  id: string;
  eventId: string;
  url: string;
  label: string;
  createdAt: string;
}

export interface InfoBar {
  id: string;
  eventId: string;
  text: string;
  createdAt: string;
}

export interface Box {
  id: string;
  eventId: string;
  text: string;
  createdAt: string;
}

export enum QAStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface QandA {
  id: string;
  eventId: string;
  sessionId?: string; // For questions: ID of the Q&A session this question belongs to
  name?: string; // Q&A session name/title (e.g., "Main Session Q&A", "Panel Discussion Q&A") - required for session containers
  question?: string; // The actual question - required for individual submissions/approved items
  answer?: string; // Optional - answer can be added later by moderator
  status: QAStatus; // pending, approved, rejected
  isActive: boolean; // Currently showing on output (Play/Stop in Operators)
  isActiveForPublic?: boolean; // Session shown on public event page for submissions (Active button in Operators)
  isNext: boolean; // Next in queue to show
  isQueued?: boolean; // Queued for display
  isDone?: boolean; // Question has been displayed and is done
  submitterName?: string; // Optional name of person submitting
  submitterEmail?: string; // Optional email of person submitting
  moderatorNotes?: string; // Internal notes for moderators
  publicLink?: string; // Temporary public link for submissions
  // Public submission configuration
  enablePublicSubmission?: boolean; // Enable public to submit questions
  collectName?: boolean; // Collect submitter name
  collectEmail?: boolean; // Collect submitter email
  allowAnonymous?: boolean; // Allow anonymous submissions (name without email)
  layoutStyle?: number; // Style variant for the layout (1=Full Screen, 2=Lower Third, 3=PIP/Side Box, 4=Split Screen)
  splitScreenPosition?: 'left' | 'right'; // PIP/Side Box position (default: 'left')
  splitScreenSide?: 'left' | 'right'; // Split Screen side (default: 'left')
  splitScreenWidth?: 'third' | 'half'; // Split Screen width (default: 'third')
  primaryColor?: string; // Primary color (hex)
  secondaryColor?: string; // Secondary color (hex)
  titleSize?: 'small' | 'medium' | 'large'; // Title/question size (default: 'large')
  showTitle?: boolean; // Whether to show the question/title (default: true)
  showName?: boolean; // Whether to show the submitter name (default: true)
  // Per-layout title settings (independent for each layout type)
  titleSettings?: {
    fullScreen?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' };
    lowerThird?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' };
    pip?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' }; // Layout 3: PIP/Side Box
    splitScreen?: { fontSize?: number; yPosition?: number; justification?: 'left' | 'center' | 'right' }; // Layout 4: True Split Screen
  };
  // Per-layout answer settings (font size, justification, and Y position)
  answerSettings?: {
    fullScreen?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
    lowerThird?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
    pip?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number }; // Layout 3: PIP/Side Box
    splitScreen?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number }; // Layout 4: True Split Screen
  };
  // Per-layout name settings (font size, justification, and Y position)
  nameSettings?: {
    fullScreen?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
    lowerThird?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number };
    pip?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number }; // Layout 3: PIP/Side Box
    splitScreen?: { fontSize?: number; justification?: 'left' | 'center' | 'right'; yPosition?: number }; // Layout 4: True Split Screen
  };
  // Per-layout background settings (independent for each layout type)
  backgroundSettings?: {
    fullScreen?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string };
    lowerThird?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string };
    pip?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string }; // Layout 3: PIP/Side Box
    splitScreen?: { type?: 'color' | 'transparent' | 'image'; color?: string; imageUrl?: string }; // Layout 4: True Split Screen
  };
      // Per-layout border settings (independent for each layout type)
      borderSettings?: {
        fullScreen?: { thickness?: number; position?: 'inner' | 'outer'; zoom?: number; borderRadius?: number }; // zoom = scale percentage (70-150, default 100)
        lowerThird?: { thickness?: number; position?: 'inner' | 'outer' | 'line'; type?: 'line' | 'boxEdge'; zoom?: number; yPosition?: number; borderRadius?: number }; // For lower third: 'line' = top border only, 'boxEdge' = full border box inset 10px, zoom = scale percentage (70-100, default 100), yPosition = vertical offset in px (default 0)
        pip?: { thickness?: number; position?: 'inner' | 'outer'; zoom?: number; xPosition?: number; yPosition?: number; borderRadius?: number }; // Layout 3: PIP/Side Box - zoom = scale percentage (70-150, default 100), xPosition = horizontal offset in px (default 0), yPosition = vertical offset in px (default 0)
        splitScreen?: { thickness?: number; position?: 'inner' | 'outer' | 'line'; type?: 'line' | 'boxEdge'; zoom?: number; xPosition?: number; yPosition?: number; borderRadius?: number }; // Layout 4: True Split Screen - zoom = scale percentage (70-150, default 100), xPosition = horizontal offset in px (default 0), yPosition = vertical offset in px (default 0)
      };
  borderRadius?: number; // Border radius in pixels for container/border (0 = square, default: 0)
  // Output settings: which outputs (1-4) should show which layout types
  outputSettings?: {
    fullScreen?: number[]; // Array of output numbers (1-4) that should show this Q&A as Full Screen
    lowerThird?: number[]; // Array of output numbers (1-4) that should show this Q&A as Lower Third
    pip?: number[]; // Array of output numbers (1-4) that should show this Q&A as PIP (Layout 3)
    splitScreen?: number[]; // Array of output numbers (1-4) that should show this Q&A as Split Screen (Layout 4)
  };
  queueOrder?: number; // Order in approved queue (lower number = higher priority)
  createdAt: string;
  updatedAt: string;
}
