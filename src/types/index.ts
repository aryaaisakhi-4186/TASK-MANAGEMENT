export type UserRole = 'ADMIN' | 'TEAM' | 'CLIENT' | 'GUEST';

export interface GuestTrialInfo {
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isExpired: boolean;
  firmName?: string;
  city?: string;
  isDemoSetup?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  phone?: string;
  pan?: string;
  pin?: string;
  avatar?: string;
  assignedClientIds?: string[];
  designation?: string;
  isEmployeeLogin?: boolean;
  trialInfo?: GuestTrialInfo;
}

export interface GuestLead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  firmName?: string;
  city?: string;
  registeredAt: string;
  trialStartDate: string;
  trialEndDate: string;
  trialStatus: 'ACTIVE_DEMO' | 'EXPIRED' | 'CONVERTED';
  isDemoSetup: boolean;
  notes?: string;
}

export type ClientCategory = 'PVT_LTD' | 'LLP' | 'PARTNERSHIP' | 'PROPRIETOR' | 'INDIVIDUAL' | 'TRUST';

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export type ClientRepoDocType = 'GST_REG' | 'PAN_CARD' | 'AADHAR_CARD' | 'TAN_LETTER' | 'INCORPORATION_DEED' | 'UDYAM_MSME' | 'OTHER_KYC';

export interface ClientRepoDoc {
  id: string;
  docType: ClientRepoDocType;
  title: string;
  docNumber?: string;
  fileType: string;           // 'IMAGE_WEBP' | 'PDF' | 'CLOUD_LINK'
  originalSizeKB?: number;
  compressedSizeKB: number;   // Ultra-low size in KB (e.g. 18 KB, or 0 KB for cloud link)
  dataUrl: string;            // Ultra-compressed base64 or Google Drive URL
  uploadedAt: string;
}

export type ComplianceApplicabilityKey = 'AUDIT' | 'GST' | 'TDS' | 'ITR' | 'VAT' | 'E_INVOICE' | 'RCM' | 'RULE_86B';

export interface ClientComplianceApplicability {
  AUDIT: boolean;
  GST: boolean;
  TDS: boolean;
  ITR: boolean;
  VAT: boolean;
  E_INVOICE: boolean;
  RCM: boolean;
  RULE_86B: boolean;
}

export interface Client {
  id: string;
  tradeName: string;
  legalName: string;
  pan: string;
  gstin?: string;
  tan?: string;             // Tax Deduction & Collection Account No
  vatNumber?: string;       // VAT / State Registration No
  category: ClientCategory; // Entity Type
  status: 'ACTIVE' | 'INACTIVE';
  contactPerson: string;
  phone: string;
  email: string;
  employeeName?: string;    // Client Employee / Accountant Name
  employeePhone?: string;   // Client Employee Mobile No (Last 4 digits for login)
  aadharNumber?: string;    // Aadhar Number
  dob?: string;             // Date of Birth
  formationDate?: string;   // Firm Formation / Incorporation Date
  assignedTeamId: string;
  assignedTeamName: string;
  portalPassword?: string;
  googleDriveFolderId?: string;   // Google Drive Folder ID for this client
  googleDriveFolderUrl?: string;  // Direct URL to client's Drive folder
  customFields?: CustomField[];
  repositoryDocs?: ClientRepoDoc[]; // Ultra-light KYC & Statutory Document Repository
  complianceApplicability?: ClientComplianceApplicability; // AUDIT, GST, TDS, VAT, E-INVOICE, RCM, 86B (Applicable / Not Applicable)
  createdAt: string;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_TIME';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'NOT_APPLICABLE';
export type ComplianceCategory = 'GST' | 'TDS' | 'INCOME_TAX' | 'ROC' | 'AUDIT' | 'BOOKKEEPING' | 'PF_ESIC' | 'ADVANCE_TAX';

export interface TaskItem {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description?: string;
  category: ComplianceCategory;
  frequency: TaskFrequency;
  dueDayOrDate: string;
  dueDate: string;
  status: TaskStatus;
  assignedTeamId: string;
  assignedTeamName: string;
  priority: TaskPriority;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  financialYear: string;
  period?: string;
}

export interface AttendanceRecord {
  id: string;
  teamId: string;
  teamName: string;
  date: string;
  punchInTime: string;
  punchOutTime?: string;
  totalMinutesWorked: number;
  selfieDataUrl?: string;
  locationStamp?: string;
  workSessionNotes?: string;
  status: 'PRESENT' | 'HALF_DAY' | 'LATE' | 'REMOTE';
}

export interface DocumentItem {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  category: ComplianceCategory | string;
  fileType: string;
  fileSize: string;
  fileUrl: string;
  googleDriveUrl?: string;
  googleDriveFileId?: string;
  isDriveSynced?: boolean;
  uploadSource?: 'BROWSE' | 'CAMERA' | 'MANUAL';
  uploadedBy: string;
  uploadedAt: string;
  tags: string[];
}

export interface ExtraWorkItem {
  id: string;
  clientId: string;
  clientName: string;
  taskTitle: string;
  description: string;
  category: string;
  agreedFee: number;
  advanceReceived: number;
  balanceDue: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'BILLED' | 'SETTLED';
  assignedTeamId: string;
  assignedTeamName: string;
  createdDate: string;
  targetCompletionDate: string;
}

export interface ClientReminder {
  id: string;
  clientId: string;
  clientName: string;
  clientContactPerson: string;
  clientPhone: string;
  clientEmail: string;
  employeeName?: string;
  employeePhone?: string;
  complianceTitle: string;
  requiredDocuments: string[];
  notes?: string;
  senderId: string;
  senderName: string;
  sentDate: string;
  status: 'PENDING_DOCS' | 'RECEIVED';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  role: UserRole;
  action: string;
  category: 'TASK' | 'CLIENT' | 'ATTENDANCE' | 'DOCUMENT' | 'FINANCE' | 'AUTH' | 'SYSTEM';
  details: string;
}

export interface SystemSettings {
  adminPasswordHash: string;
  firmName: string;
  firmEmail: string;
  firmPhone: string;
  firmAddress: string;
  morningAlarmTime: string;
  enableMorningAlarm: boolean;
  enableSoundChime: boolean;
  cloudStorageEmail: string;
  googleDriveSyncEnabled: boolean;
  googleSheetName: string;
  masterGoogleSheetUrl?: string;
  masterGoogleSheetId?: string;
  googleWebhookUrl?: string;
  lastCloudSyncTimestamp?: string;
}

export type AIMemoryCategory = 'PREFERENCE' | 'CLIENT_RULE' | 'STAFF_RULE' | 'FEE_RULE' | 'GENERAL_NOTE';

export interface AIMemoryItem {
  id: string;
  category: AIMemoryCategory;
  topic: string;
  content: string;
  source: 'USER_CHAT' | 'MANUAL';
  learnedAt: string;
}
