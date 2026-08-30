export type UserRole = 'ADMIN' | 'TEAM' | 'CLIENT' | 'GUEST';

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
}

export type ClientCategory = 'PVT_LTD' | 'LLP' | 'PARTNERSHIP' | 'PROPRIETOR' | 'INDIVIDUAL' | 'TRUST';

export interface CustomField {
  id: string;
  label: string;
  value: string;
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
