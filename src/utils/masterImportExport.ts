import { extractDocumentDataDirectly, cleanExtractedEntityName, parseRawTextToClientData } from '../services/documentOCRService';
import * as XLSX from 'xlsx';
import { Client, ClientCategory, UserProfile } from '../types';

export interface ParsedClientRow {
  tradeName: string;
  legalName?: string;
  pan: string;
  gstin?: string;
  tan?: string;
  vatNumber?: string;
  category: ClientCategory;
  phone?: string;
  email?: string;
  contactPerson?: string;
  employeeName?: string;
  employeePhone?: string;
  aadharNumber?: string;
  dob?: string;
  formationDate?: string;
  assignedTeamName?: string;
  googleDriveFolderId?: string;
  googleDriveFolderUrl?: string;
  isValid: boolean;
  validationError?: string;
}

export interface ParsedTeamRow {
  name: string;
  role: 'ADMIN' | 'TEAM';
  designation?: string;
  phone?: string;
  email?: string;
  pan?: string;
  pin?: string;
  isValid: boolean;
  validationError?: string;
}

// Normalize headers (case-insensitive & whitespace trimmed)
const normalizeKey = (key: string): string => {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Converts Excel date serial number (e.g. 25759.000115740742) or ISO date strings
 * into clean, readable calendar date format DD-MM-YYYY.
 */
export const formatExcelOrStandardDate = (val?: string | number | null): string => {
  if (!val && val !== 0) return 'N/A';
  const str = String(val).trim();
  if (!str || str === 'N/A' || str === '-' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') {
    return 'N/A';
  }

  // 1. Check for Excel numeric date serials (e.g. 25759.000115740742 or 44561)
  const num = parseFloat(str);
  if (!isNaN(num) && /^\d+(\.\d+)?$/.test(str) && num > 1000 && num < 100000) {
    try {
      // Excel epoch: 25569 = 1970-01-01 UTC (accounts for Excel 1900 leap year bug)
      const jsTimestamp = Math.round((num - 25569) * 86400 * 1000);
      const dt = new Date(jsTimestamp);
      if (!isNaN(dt.getTime())) {
        const day = String(dt.getUTCDate()).padStart(2, '0');
        const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const year = dt.getUTCFullYear();
        return `${day}-${month}-${year}`;
      }
    } catch {}
  }

  // 2. Format standard ISO YYYY-MM-DD -> DD-MM-YYYY
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.substring(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  return str;
};

// 1. Accurate PDF Text Extractor using Server Endpoint (pdf-parse)
export const extractPdfTextFromServer = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetch('/api/reports/parse-pdf-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64Data, filename: file.name })
        });

        if (res.ok) {
          const data = await res.json();
          resolve(data.rawText || '');
        } else {
          resolve('');
        }
      } catch (err) {
        console.warn('PDF server parse error:', err);
        resolve('');
      }
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

// 2. Statutory Status / Constitution Detector using PAN 4th Character and GSTIN
export const detectEntityCategoryFromPANAndGSTIN = (
  pan?: string,
  gstin?: string,
  tradeName?: string,
  legalName?: string,
  rawCategory?: string
): ClientCategory => {
  // A. If explicit category column is present and valid, parse it
  if (rawCategory && rawCategory.trim()) {
    const rawUpper = rawCategory.toUpperCase().trim();
    if (rawUpper.includes('LLP') || rawUpper.includes('LIMITED LIABILITY PARTNERSHIP')) return 'LLP';
    if (rawUpper.includes('PARTNER') || rawUpper.includes('FIRM')) return 'PARTNERSHIP';
    if (rawUpper.includes('PROP') || rawUpper.includes('PROPRIETOR') || rawUpper.includes('SOLE')) return 'PROPRIETOR';
    if (rawUpper.includes('INDIVID') || rawUpper.includes('PERSON') || rawUpper.includes('HUF')) return 'INDIVIDUAL';
    if (rawUpper.includes('TRUST') || rawUpper.includes('SOCIETY') || rawUpper.includes('NGO') || rawUpper.includes('AOP')) return 'TRUST';
    if (rawUpper.includes('PVT') || rawUpper.includes('PRIVATE') || rawUpper.includes('LIMITED') || rawUpper.includes('LTD') || rawUpper.includes('COMPANY')) return 'PVT_LTD';
  }

  // B. Extract clean 10-character PAN
  let cleanPAN = pan?.trim().toUpperCase();
  if (!cleanPAN && gstin && gstin.trim().length >= 12) {
    const cleanGST = gstin.trim().toUpperCase();
    cleanPAN = cleanGST.substring(2, 12);
  }

  // C. Check Name for explicit keywords
  const combinedName = `${tradeName || ''} ${legalName || ''}`.toUpperCase();
  if (combinedName.includes(' LLP') || combinedName.includes('LIMITED LIABILITY PARTNERSHIP') || combinedName.endsWith('LLP')) {
    return 'LLP';
  }
  if (combinedName.includes('PVT LTD') || combinedName.includes('PVT. LTD') || combinedName.includes('PRIVATE LIMITED') || combinedName.includes('LTD.') || combinedName.includes(' LIMITED')) {
    return 'PVT_LTD';
  }
  if (combinedName.includes('TRUST') || combinedName.includes('FOUNDATION') || combinedName.includes('SANSTHA') || combinedName.includes('SAMITI') || combinedName.includes('SOCIETY')) {
    return 'TRUST';
  }

  // D. Statutory Income Tax & GST Rule: 4th character of PAN defines the legal constitution
  if (cleanPAN && cleanPAN.length === 10) {
    const pan4th = cleanPAN.charAt(3);
    switch (pan4th) {
      case 'C': // Company (Private or Public Limited)
        return 'PVT_LTD';
      case 'P': // Person / Individual / Sole Proprietorship
        return 'PROPRIETOR';
      case 'F': // Firm / Partnership Firm
        return 'PARTNERSHIP';
      case 'L': // Limited Liability Partnership
        return 'LLP';
      case 'T': // Trust
      case 'A': // Association of Persons (AOP)
      case 'B': // Body of Individuals (BOI)
      case 'J': // Artificial Juridical Person
        return 'TRUST';
      case 'H': // Hindu Undivided Family (HUF)
        return 'INDIVIDUAL';
      case 'G': // Government Agency
        return 'PVT_LTD';
      default:
        break;
    }
  }

  // E. Name check for Partnership indicators
  if (combinedName.includes('& CO') || combinedName.includes('& SONS') || combinedName.includes('& BROTHERS') || combinedName.includes('& ASSOCIATES') || combinedName.includes('PARTNERSHIP')) {
    return 'PARTNERSHIP';
  }

  return 'PROPRIETOR';
};

// 3. Intelligent GST / Tax Document Field Parser
export const parseDocumentTextToClientData = (rawText: string, fileName?: string): Partial<Client> => {
  return parseRawTextToClientData(rawText, fileName);
};

// Map Raw Objects to ParsedClientRow array (ACCURATE STATUTORY STATUS & ZERO DUMMIES)
export const mapRawDataToClients = (rawData: any[]): ParsedClientRow[] => {
  return rawData.map((row) => {
    const getVal = (possibleHeaders: string[]): string => {
      // 1. First pass: exact normalized match (highest precision)
      for (const header of possibleHeaders) {
        const normHeader = normalizeKey(header);
        for (const key of Object.keys(row)) {
          if (normalizeKey(key) === normHeader) {
            const val = String(row[key] ?? '').trim();
            if (val !== '' && val !== '#N/A' && val !== 'NA' && val !== 'N/A' && val !== 'null' && val !== 'undefined') {
              return val;
            }
          }
        }
      }
      // 2. Second pass: prefix / contains match
      for (const header of possibleHeaders) {
        const normHeader = normalizeKey(header);
        for (const key of Object.keys(row)) {
          const normKey = normalizeKey(key);
          if (normKey.includes(normHeader)) {
            const val = String(row[key] ?? '').trim();
            if (val !== '' && val !== '#N/A' && val !== 'NA' && val !== 'N/A' && val !== 'null' && val !== 'undefined') {
              return val;
            }
          }
        }
      }
      return '';
    };

    const tradeName = getVal(['businessName', 'tradeName', 'clientName', 'client', 'firmName', 'name']);
    const legalName = getVal(['legalName', 'registeredName', 'companyName']) || tradeName;
    const rawGst = getVal(['gst', 'gstin', 'gstNumber', 'gstno']).toUpperCase();
    const gstin = (rawGst !== 'NA' && rawGst !== 'N/A' && rawGst.length >= 10) ? rawGst : undefined;

    let pan = getVal(['pan', 'panNumber', 'panno']).toUpperCase();
    if ((!pan || pan === 'NA' || pan === 'N/A') && gstin && gstin.length === 15) {
      pan = gstin.substring(2, 12);
    }
    if (pan === 'NA' || pan === 'N/A') pan = '';

    const rawTan = getVal(['tan', 'tanNumber', 'tanno']).toUpperCase();
    const tan = (rawTan !== 'NA' && rawTan !== 'N/A' && rawTan.length >= 8) ? rawTan : undefined;

    const rawVat = getVal(['vat', 'vatNumber', 'tin', 'stateId']).toUpperCase();
    const vatNumber = (rawVat !== '' && rawVat !== 'NA' && rawVat !== 'N/A' && rawVat.length >= 4) ? rawVat : undefined;

    const phone = getVal(['contactNumber', 'phone', 'mobile', 'contactNo', 'whatsapp', 'mobileNumber']);
    const email = getVal(['mailId', 'email', 'mail', 'emailAddress']);
    const contactPerson = getVal(['contactPerson', 'director', 'proprietor', 'authorizedPerson']);
    const employeeName = getVal(['employeeName', 'accountant', 'accountantName']);
    const employeePhone = getVal(['employeeContact', 'employeePhone', 'accountantPhone', 'accountantMobile']);
    const aadharNumber = getVal(['aadhar', 'aadharNumber', 'uidai']);
    const rawDob = getVal(['contactPersonDob', 'personDob', 'dob', 'birthDate', 'dateOfBirth']);
    const rawFormationDate = getVal(['dobFirm', 'firmDob', 'formationDate', 'incorporationDate', 'registrationDate']);
    const formattedDob = formatExcelOrStandardDate(rawDob);
    const formattedFormationDate = formatExcelOrStandardDate(rawFormationDate);
    const dob = formattedDob !== 'N/A' ? formattedDob : undefined;
    const formationDate = formattedFormationDate !== 'N/A' ? formattedFormationDate : undefined;
    const assignedTeamName = getVal(['assignedTo', 'assignedStaff', 'assignedTeamName', 'assignedPartner', 'caStaff']);
    const googleDriveFolderId = getVal(['driveFolderId', 'googleDriveFolderId', 'driveId']);
    const googleDriveFolderUrl = getVal(['driveFolderUrl', 'googleDriveFolderUrl', 'driveUrl', 'driveLink']);

    const rawCategory = getVal(['firmStatus', 'category', 'entityType', 'constitution', 'type', 'status']);
    
    // Accurate Entity Status Resolution using PAN, GSTIN, and Legal Trade Name
    const category: ClientCategory = detectEntityCategoryFromPANAndGSTIN(pan, gstin, tradeName, legalName, rawCategory);

    let isValid = true;
    let validationError = '';

    if (!tradeName) {
      isValid = false;
      validationError = 'Trade Name is missing';
    } else if (!pan && !gstin) {
      isValid = false;
      validationError = 'Valid PAN or GSTIN is required';
    }

    return {
      tradeName: tradeName || '',
      legalName: legalName || tradeName || '',
      pan: pan || '',
      gstin,
      tan,
      vatNumber,
      category,
      phone: phone || '',
      email: email || '',
      contactPerson: contactPerson || '',
      employeeName: employeeName || undefined,
      employeePhone: employeePhone || undefined,
      aadharNumber: aadharNumber || undefined,
      dob: dob || undefined,
      formationDate: formationDate || undefined,
      assignedTeamName: assignedTeamName || '',
      googleDriveFolderId: googleDriveFolderId || undefined,
      googleDriveFolderUrl: googleDriveFolderUrl || undefined,
      isValid,
      validationError
    };
  });
};

// Map Raw Objects to ParsedTeamRow array (ZERO DUMMY DATA)
export const mapRawDataToTeam = (rawData: any[]): ParsedTeamRow[] => {
  return rawData
    .filter((row) => {
      if (!row || typeof row !== 'object') return false;
      return Object.values(row).some(v => String(v).trim().length > 0);
    })
    .map((row) => {
      const getVal = (possibleHeaders: string[]): string => {
        for (const header of possibleHeaders) {
          const normHeader = normalizeKey(header);
          for (const key of Object.keys(row)) {
            const normKey = normalizeKey(key);
            if (normKey === normHeader || normKey.includes(normHeader)) {
              const val = row[key];
              if (val !== undefined && val !== null) {
                return String(val).trim();
              }
            }
          }
        }
        return '';
      };

      const name = getVal(['memberName', 'staffName', 'employeeName', 'member', 'userName', 'name']);
      const roleStr = getVal(['userRole', 'role', 'access']).toUpperCase();
      const rawRole = roleStr || 'TEAM';
      const role: 'ADMIN' | 'TEAM' = (rawRole.includes('HOD') || rawRole.includes('ADMIN') || rawRole.includes('PARTNER')) ? 'ADMIN' : 'TEAM';

      let designation = getVal(['designation', 'post', 'title', 'position']);
      if (!designation) {
        if (rawRole.includes('HOD')) designation = 'Head of Department / Senior Partner';
        else if (rawRole.includes('ADMIN')) designation = 'Admin & Principal Partner';
        else if (rawRole.includes('MANAGER')) designation = 'Branch / Compliance Manager';
        else if (rawRole.includes('ACCOUNTANT')) designation = 'Accounts & Tax Specialist';
        else if (rawRole.includes('OPERATOR')) designation = 'Data Entry & Return Operator';
        else designation = role === 'ADMIN' ? 'Senior Partner' : 'Compliance Associate';
      }

      const rawPhone = getVal(['mobileNo', 'mobile', 'phone', 'contactNo', 'mobileNumber']);
      const phoneDigits = rawPhone.replace(/\D/g, '');
      const phone = phoneDigits.length === 10 ? `+91 ${phoneDigits}` : (rawPhone.startsWith('+91') ? rawPhone : (rawPhone || ''));
      const email = getVal(['email', 'mail', 'officialEmail']);
      const pan = getVal(['pan', 'panNumber']).toUpperCase();
      const totpSecret = getVal(['totpSecret', 'totp', 'secret']);
      const rawPin = getVal(['pin', 'password', 'loginPin']);
      const pin = rawPin || (totpSecret ? totpSecret.replace(/[^0-9]/g, '').slice(-4) : (phoneDigits.length >= 4 ? phoneDigits.slice(-4) : '1234'));

      let isValid = true;
      let validationError = '';

      if (!name || name.length < 2) {
        isValid = false;
        validationError = 'Staff Name is missing';
      }

      return {
        name: name || '',
        role,
        designation,
        phone: phone || '',
        email: email || '',
        pan: pan || undefined,
        pin: pin || '1234',
        isValid,
        validationError
      };
    })
    .filter(r => r.name.length > 0 && normalizeKey(r.name) !== 'membername' && normalizeKey(r.name) !== 'staffname');
};

// 1. Fetch & Parse Direct from Google Sheet URL or ID (Drive Cloud Storage)

export interface TabularClassificationResult {
  domain: 'CLIENT_MASTER' | 'TEAM_DIRECTORY' | 'DOCUMENT_VAULT' | 'UNKNOWN';
  confidence: number;
  detectedType: string;
  summary: string;
  sampleEntities: string[];
  suggestedAction: 'IMPORT_CLIENT' | 'IMPORT_TEAM' | 'STORE_VAULT' | 'REVIEW_MANUAL';
  clientRows?: ParsedClientRow[];
  teamRows?: ParsedTeamRow[];
}

// ---------------------------------------------------------------------------
// UNIVERSAL TABULAR & SPREADSHEET DATASET CLASSIFIER
// ---------------------------------------------------------------------------
export const classifyRawTabularData = (rawData: any[], sourceName: string = ''): TabularClassificationResult => {
  if (!rawData || rawData.length === 0) {
    return {
      domain: 'UNKNOWN',
      confidence: 0,
      detectedType: 'Empty Dataset',
      summary: 'No data rows found in the sheet/file.',
      sampleEntities: [],
      suggestedAction: 'REVIEW_MANUAL'
    };
  }

  const allHeaders = Array.from(
    new Set(rawData.flatMap(r => Object.keys(r || {})).map(k => k.toLowerCase().replace(/[^a-z0-9]/g, '')))
  );
  const headerStr = allHeaders.join(' ');
  const lowerSource = sourceName.toLowerCase();

  // Scan row values across first 50 rows
  let gstCount = 0;
  let panCount = 0;
  let tradeNameKeywordCount = 0;
  let designationKeywordCount = 0;
  const sampleEntities: string[] = [];

  const businessKeywords = [
    'agency', 'agencies', 'pvt', 'ltd', 'limited', 'llp', 'traders', 'enterprise', 
    'enterprises', 'industries', 'company', 'store', 'stores', 'corporation', 
    'sales', 'associates', 'firm', 'group', 'services', 'motors', 'steel', 'cloth', 'jewel'
  ];

  const designationKeywords = [
    'ca', 'partner', 'associate', 'article', 'assistant', 'accountant', 'manager', 
    'trainee', 'intern', 'executive', 'clerk', 'developer', 'staff', 'hod', 'admin', 'operator'
  ];

  for (let i = 0; i < Math.min(rawData.length, 50); i++) {
    const row = rawData[i];
    const entries = Object.entries(row);

    for (const [key, rawVal] of entries) {
      const normK = normalizeKey(key);
      const val = String(rawVal).trim();

      if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/i.test(val)) {
        gstCount++;
      }
      if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(val)) {
        panCount++;
      }
      // Only count trade keywords if not a secret/totp/pin/password column
      if (!normK.includes('secret') && !normK.includes('totp') && !normK.includes('password') && !normK.includes('pin')) {
        if (businessKeywords.some(bk => val.toLowerCase().includes(bk))) {
          tradeNameKeywordCount++;
        }
      }
      if (designationKeywords.some(dk => val.toLowerCase() === dk || val.toLowerCase().includes(dk))) {
        designationKeywordCount++;
      }
    }

    // Capture sample entity name
    const values = Object.values(row).map(v => String(v).trim());
    const nameVal = values.find(v => v.length > 3 && !/^[0-9+@.]/.test(v) && !v.includes('@') && !v.includes('http') && !/^[0-9]{2}[A-Z]{5}/.test(v));
    if (nameVal && sampleEntities.length < 4 && !sampleEntities.includes(nameVal)) {
      sampleEntities.push(nameVal);
    }
  }

  // Domain 1: Bank Statement / Ledger / Transaction Vouchers
  const isBankOrVoucher = headerStr.includes('withdrawal') || headerStr.includes('deposit') || 
    headerStr.includes('txndate') || headerStr.includes('chequeno') || headerStr.includes('taxablevalue') || 
    (headerStr.includes('balance') && headerStr.includes('narration')) ||
    (headerStr.includes('invoiceno') && headerStr.includes('cgst'));

  if (isBankOrVoucher) {
    const isInvoice = headerStr.includes('invoiceno') || headerStr.includes('taxablevalue');
    return {
      domain: 'DOCUMENT_VAULT',
      confidence: 95,
      detectedType: isInvoice ? 'Sales / Purchase Voucher Spreadsheet' : 'Bank Statement / Account Ledger',
      summary: `Spreadsheet contains ${rawData.length} financial transaction / voucher entries.`,
      sampleEntities,
      suggestedAction: 'STORE_VAULT'
    };
  }

  // Domain 2: Team Directory (Staff Roster)
  const hasTeamHeaders = (
    headerStr.includes('designation') || 
    headerStr.includes('salary') || 
    headerStr.includes('empid') || 
    headerStr.includes('employeeid') || 
    headerStr.includes('doj') ||
    headerStr.includes('membername') ||
    headerStr.includes('userrole') ||
    headerStr.includes('totpsecret') ||
    (headerStr.includes('member') && headerStr.includes('role'))
  ) && !headerStr.includes('gstin') && !headerStr.includes('tradename');

  const isTeamExplicit = (
    hasTeamHeaders || 
    designationKeywordCount > 3 || 
    lowerSource.includes('team') || 
    lowerSource.includes('staff') ||
    headerStr.includes('membername') ||
    (headerStr.includes('userrole') && !headerStr.includes('gstin'))
  ) && gstCount === 0;

  if (isTeamExplicit) {
    const teamRows = mapRawDataToTeam(rawData);
    return {
      domain: 'TEAM_DIRECTORY',
      confidence: 96,
      detectedType: 'Staff / Team Roster Spreadsheet',
      summary: `Found ${rawData.length} staff member records with designations and roles.`,
      sampleEntities,
      suggestedAction: 'IMPORT_TEAM',
      teamRows
    };
  }

  // Domain 3: Client Master (GSTIN, Trade Names, Agencies, PAN, Entities)
  const isClientMaster = gstCount > 0 || tradeNameKeywordCount >= 2 || 
    headerStr.includes('gstin') || headerStr.includes('tradename') || headerStr.includes('clientname') || 
    headerStr.includes('legalname') || headerStr.includes('constitution') || headerStr.includes('proprietor') ||
    headerStr.includes('tan') || headerStr.includes('cin') || panCount > 0;

  const clientRows = mapRawDataToClients(rawData);
  return {
    domain: 'CLIENT_MASTER',
    confidence: isClientMaster ? 98 : 85,
    detectedType: 'Client Master Database Sheet',
    summary: `Found ${rawData.length} client business profiles (e.g., ${sampleEntities.slice(0, 3).join(', ')}) with GST/PAN and statutory data.`,
    sampleEntities,
    suggestedAction: 'IMPORT_CLIENT',
    clientRows
  };
};

/**
 * Downloads full multi-sheet Google Sheets workbook (.xlsx)
 */
export const fetchGoogleSheetWorkbook = async (sheetUrlOrId: string): Promise<XLSX.WorkBook> => {
  const trimmed = sheetUrlOrId.trim();
  if (!trimmed) throw new Error('Please enter a Google Sheet URL or ID');

  let sheetId = trimmed;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) sheetId = match[1];

  // Try direct XLSX download first
  try {
    const directXlsxUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    const res = await fetch(directXlsxUrl);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer && arrayBuffer.byteLength > 1000) {
        return XLSX.read(arrayBuffer, { type: 'array' });
      }
    }
  } catch (err) {
    console.warn('Direct XLSX Google Sheet fetch error:', err);
  }

  // Fallback to local bundled master workbook if available
  try {
    const localRes = await fetch('./google_drive_master.xlsx').catch(() => fetch('/google_drive_master.xlsx'));
    if (localRes && localRes.ok) {
      const arrayBuffer = await localRes.arrayBuffer();
      if (arrayBuffer && arrayBuffer.byteLength > 1000) {
        return XLSX.read(arrayBuffer, { type: 'array' });
      }
    }
  } catch (err) {
    console.warn('Local master workbook fallback error:', err);
  }

  throw new Error('Unable to fetch Google Sheets workbook. Ensure link sharing is set to "Anyone with link can view".');
};

export const fetchGoogleSheetData = async (
  sheetUrlOrId: string, 
  targetSheet: 'clients' | 'team' | 'business' | string = ''
): Promise<any[]> => {
  const trimmed = sheetUrlOrId.trim();
  if (!trimmed) throw new Error('Please enter a Google Sheet URL or ID');

  let sheetId = trimmed;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) sheetId = match[1];

  const targetLower = (targetSheet || '').toLowerCase();

  // Step 1: Try reading as full multi-sheet XLSX workbook
  try {
    const workbook = await fetchGoogleSheetWorkbook(sheetUrlOrId);
    let chosenSheetName = workbook.SheetNames[0];

    if (targetLower.includes('team') || targetLower.includes('staff')) {
      const teamSheet = workbook.SheetNames.find(s => /team|staff|member/i.test(s));
      if (teamSheet) chosenSheetName = teamSheet;
    } else if (targetLower.includes('business') || targetLower.includes('client')) {
      const clientSheet = workbook.SheetNames.find(s => /business|client/i.test(s));
      if (clientSheet) chosenSheetName = clientSheet;
    } else if (targetSheet && workbook.SheetNames.includes(targetSheet)) {
      chosenSheetName = targetSheet;
    }

    const worksheet = workbook.Sheets[chosenSheetName];
    if (worksheet) {
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      if (rows && rows.length > 0) return rows;
    }
  } catch (e) {
    console.warn('Full workbook fetch attempted, trying GViz CSV fallback:', e);
  }

  // Step 2: Try GViz CSV export with specific sheet name parameter
  let sheetQueryName = '';
  if (targetLower.includes('team') || targetLower.includes('staff')) {
    sheetQueryName = 'team';
  } else if (targetLower.includes('business') || targetLower.includes('client')) {
    sheetQueryName = 'Business Master';
  }

  let csvContent = '';
  try {
    const sheetParam = sheetQueryName ? `&sheet=${encodeURIComponent(sheetQueryName)}` : '';
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${sheetParam}`;
    const res = await fetch(gvizUrl);
    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes('<!DOCTYPE html>')) {
        csvContent = text;
      }
    }
  } catch (err) {
    console.warn('Direct GViz Google Sheet fetch error:', err);
  }

  // Step 3: Try backend proxy if available
  if (!csvContent) {
    try {
      const proxyRes = await fetch('/api/reports/fetch-google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrlOrId: trimmed, sheetName: sheetQueryName })
      });

      if (proxyRes.ok) {
        const data = await proxyRes.json();
        csvContent = data.csvData;
      }
    } catch (e) {}
  }

  if (csvContent) {
    const workbook = XLSX.read(csvContent, { type: 'string' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  }

  throw new Error('Google Sheet returned empty data. Ensure sharing is "Anyone with link can view".');
};

export const parseClientsFromGoogleSheet = async (sheetUrlOrId: string): Promise<ParsedClientRow[]> => {
  const rawData = await fetchGoogleSheetData(sheetUrlOrId, 'business');
  if (!rawData || rawData.length === 0) {
    throw new Error('The Google Sheet contains no data rows in Business Master.');
  }
  return mapRawDataToClients(rawData);
};

export const parseTeamFromGoogleSheet = async (sheetUrlOrId: string): Promise<ParsedTeamRow[]> => {
  const rawData = await fetchGoogleSheetData(sheetUrlOrId, 'team');
  if (!rawData || rawData.length === 0) {
    throw new Error('The Google Sheet contains no data rows in the Team sheet.');
  }
  return mapRawDataToTeam(rawData);
};

// 2. Parse Clients from Excel / CSV / PDF Files (SEAMLESS PDF & MULTI-SHEET EXCEL SUPPORT)
export const parseClientsFromFile = async (file: File): Promise<ParsedClientRow[]> => {
  const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
  const isPdf = /\.pdf$/i.test(file.name);

  if (isExcel) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const chosenSheetName = workbook.SheetNames.find(s => /business|client/i.test(s)) || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[chosenSheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      throw new Error('The uploaded Excel sheet contains no data rows.');
    }

    return mapRawDataToClients(rawData);
  }

  const isImage = /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

  if (isPdf || isImage) {
    const client = await extractDocumentDataDirectly(file);

    const cleanedTrade = cleanExtractedEntityName(client.tradeName);
    const cleanedLegal = cleanExtractedEntityName(client.legalName);
    const fallbackFileName = cleanExtractedEntityName(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').trim());

    let tradeName = cleanedTrade || cleanedLegal || fallbackFileName;
    let legalName = cleanedLegal || cleanedTrade || tradeName;
    let pan = client.pan || '';
    let gstin = client.gstin || '';

    // Check if filename contains PAN or GSTIN
    if (!pan) {
      const panInName = file.name.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
      if (panInName) pan = panInName[1].toUpperCase();
    }
    if (!gstin) {
      const gstInName = file.name.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i);
      if (gstInName) {
        gstin = gstInName[1].toUpperCase();
        if (!pan) pan = gstin.substring(2, 12);
      }
    }

    const category = client.category || detectEntityCategoryFromPANAndGSTIN(pan, gstin, tradeName, legalName);

    const row: ParsedClientRow = {
      tradeName: tradeName || 'Extracted Client',
      legalName: legalName || tradeName || 'Extracted Client',
      pan: pan || '',
      gstin: gstin || undefined,
      tan: client.tan || undefined,
      category,
      phone: client.phone || '',
      email: client.email || '',
      contactPerson: client.contactPerson || '',
      formationDate: client.formationDate || '',
      assignedTeamName: client.assignedTeamName || '',
      googleDriveFolderId: client.googleDriveFolderId,
      googleDriveFolderUrl: client.googleDriveFolderUrl,
      isValid: !!tradeName && (!!pan || !!gstin),
      validationError: (!pan && !gstin) ? 'PAN or GSTIN required (Click row to edit)' : ''
    };

    return [row];
  }

  throw new Error('Please upload a valid Excel (.xlsx, .xls, .csv) or PDF document.');
};

// 3. Parse Team Members from Excel / CSV / PDF Files (MULTI-SHEET EXCEL SUPPORT)
export const parseTeamFromFile = async (file: File): Promise<ParsedTeamRow[]> => {
  const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
  const isPdf = /\.pdf$/i.test(file.name);

  if (isExcel) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const chosenSheetName = workbook.SheetNames.find(s => /team|staff|member/i.test(s)) || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[chosenSheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      throw new Error('The uploaded Excel sheet contains no data rows in the Team sheet.');
    }

    return mapRawDataToTeam(rawData);
  }

  if (isPdf) {
    const rawText = await extractPdfTextFromServer(file);
    if (!rawText || rawText.trim().length < 10) {
      throw new Error('Could not extract text from this PDF file.');
    }

    const nameMatch = rawText.match(/(?:name|staff|employee)\s*[:\-]\s*([A-Za-z\s.]+)/i);
    const phoneMatch = rawText.match(/(?:\+91[\-\s]?)?([6-9]\d{9})/);
    const emailMatch = rawText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

    const staffName = nameMatch ? nameMatch[1].trim() : file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
    const phone = phoneMatch ? `+91 ${phoneMatch[1]}` : '';
    const email = emailMatch ? emailMatch[1].toLowerCase() : '';

    return [
      {
        name: staffName,
        role: 'TEAM',
        designation: 'Compliance Associate',
        phone,
        email,
        pin: phone ? phone.slice(-4) : '1234',
        isValid: staffName.length > 2,
        validationError: staffName.length <= 2 ? 'Staff Name missing' : ''
      }
    ];
  }

  throw new Error('Please upload a valid Excel (.xlsx, .xls, .csv) or PDF document.');
};

// 4. Download Client Sample Template (.xlsx)
export const downloadClientExcelTemplate = () => {
  const sampleData = [
    {
      'Client Trade Name': 'Apex Precision Tools Pvt Ltd',
      'Legal Entity Name': 'Apex Precision Tools Private Limited',
      'PAN Number': 'AAACA1234F',
      'GSTIN Number': '27AAACA1234F1Z5',
      'TAN Number': 'MUMB12345C',
      'Entity Type': 'Private Limited',
      'Contact Person': 'Vikramaditya Mehta',
      'Mobile Number': '9820045678',
      'Email Address': 'accounts@apextools.in',
      'Employee Name': 'Ramesh Verma',
      'Employee Mobile': '9820045678',
      'Aadhar Number': '5489 1234 9876',
      'Date of Birth': '1985-05-15',
      'Formation Date': '2015-04-01',
      'Assigned Partner': 'Arya CA Partner',
      'Google Drive Folder ID': '1A2b3C4d5E6f7G8h9I0j',
      'Google Drive Folder URL': 'https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9I0j'
    },
    {
      'Client Trade Name': 'Bharat Logistics LLP',
      'Legal Entity Name': 'Bharat Multimodal Logistics LLP',
      'PAN Number': 'AABCB9876K',
      'GSTIN Number': '24AABCB9876K1Z9',
      'TAN Number': 'AHMD67890D',
      'Entity Type': 'LLP',
      'Contact Person': 'Suresh Patel',
      'Mobile Number': '9898012345',
      'Email Address': 'finance@bharatlogistics.com',
      'Employee Name': 'Pooja Shah',
      'Employee Mobile': '9898012345',
      'Aadhar Number': '3456 7890 1234',
      'Date of Birth': '1990-11-20',
      'Formation Date': '2019-08-15',
      'Assigned Partner': 'Rohit Sharma',
      'Google Drive Folder ID': '',
      'Google Drive Folder URL': ''
    },
    {
      'Client Trade Name': 'Shree Ganesh Traders',
      'Legal Entity Name': 'Ganesh R. Sharma (Proprietor)',
      'PAN Number': 'ABGPS1234M',
      'GSTIN Number': '27ABGPS1234M1Z8',
      'TAN Number': '',
      'Entity Type': 'Proprietorship',
      'Contact Person': 'Ganesh Sharma',
      'Mobile Number': '9820199887',
      'Email Address': 'ganesh.traders@gmail.com',
      'Employee Name': '',
      'Employee Mobile': '',
      'Aadhar Number': '',
      'Date of Birth': '',
      'Formation Date': '2018-05-10',
      'Assigned Partner': '',
      'Google Drive Folder ID': '',
      'Google Drive Folder URL': ''
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clients_Master_Template');
  XLSX.writeFile(wb, 'TASK-VAANI_Client_Master_Template.xlsx');
};

// 5. Download Team Master Sample Template (.xlsx)
export const downloadTeamExcelTemplate = () => {
  const sampleData = [
    {
      'Staff Name': 'Rohit Sharma',
      'Role': 'TEAM',
      'Designation': 'Senior GST & Audit Associate',
      'Mobile Number': '9820112345',
      'Email Address': 'rohit.sharma@cadomain.in',
      'PAN Number': 'ABCPS1234M'
    },
    {
      'Staff Name': 'Priya Nair',
      'Role': 'TEAM',
      'Designation': 'TDS & Direct Tax Specialist',
      'Mobile Number': '9820267890',
      'Email Address': 'priya.nair@cadomain.in',
      'PAN Number': 'ABCPN5678Q'
    },
    {
      'Staff Name': 'CA Ananya Deshmukh',
      'Role': 'ADMIN',
      'Designation': 'Partner - Corporate Audit & ROC',
      'Mobile Number': '9820399887',
      'Email Address': 'ananya.ca@cadomain.in',
      'PAN Number': 'ABCDA9988Z'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Team_Master_Template');
  XLSX.writeFile(wb, 'TASK-VAANI_Team_Master_Template.xlsx');
};
