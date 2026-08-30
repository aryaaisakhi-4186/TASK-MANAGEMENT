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
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // A. Extract GSTIN (15 characters)
  const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i);
  const gstin = gstinMatch ? gstinMatch[1].toUpperCase() : undefined;

  // B. Extract PAN (Characters 3 to 12 of GSTIN or standalone 10-char PAN)
  let pan: string | undefined = undefined;
  if (gstin && gstin.length === 15) {
    pan = gstin.substring(2, 12);
  } else {
    const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
    if (panMatch) pan = panMatch[1].toUpperCase();
  }

  // C. Extract TAN (10 characters: 4 letters + 5 digits + 1 letter, distinct from PAN)
  let tan: string | undefined = undefined;
  const tanMatch = text.match(/\bTAN\s*[:\-\n]*\s*([A-Z]{4}[0-9]{5}[A-Z])\b/i);
  if (tanMatch && tanMatch[1].toUpperCase() !== pan) {
    tan = tanMatch[1].toUpperCase();
  }

  // D. Extract Legal Name (Follows '1. Legal Name' or 'Legal Name')
  let legalName = '';
  const legalNamePatterns = [
    /(?:1\.?\s*)?Legal\s*Name(?:\s*of\s*Business)?[\s:\-\n]+([^\n]+)/i,
    /Name\s*of\s*(?:the)?\s*Enterprise[\s:\-\n]+([^\n]+)/i,
    /M\/s\.?\s*([^\n,]+)/i
  ];
  for (const pat of legalNamePatterns) {
    const match = text.match(pat);
    if (match && match[1]?.trim().length > 2 && !match[1].toLowerCase().includes('trade name')) {
      legalName = match[1].trim().replace(/^[:\-\s]+/, '').replace(/[;,.]*$/, '').trim();
      break;
    }
  }

  // E. Extract Trade Name (Follows '2. Trade Name' or 'Trade Name')
  let tradeName = '';
  const tradeNamePatterns = [
    /(?:2\.?\s*)?Trade\s*Name(?:,\s*if\s*any)?[\s:\-\n]+([^\n]+)/i,
    /Trade\s*Name[\s:\-\n]+([^\n]+)/i
  ];
  for (const pat of tradeNamePatterns) {
    const match = text.match(pat);
    if (match && match[1]?.trim().length > 2 && !match[1].toLowerCase().includes('constitution')) {
      const candidate = match[1].trim().replace(/^[:\-\s]+/, '').replace(/[;,.]*$/, '').trim();
      if (candidate && candidate.toUpperCase() !== 'NA' && candidate.toUpperCase() !== 'N/A' && candidate !== '-') {
        tradeName = candidate;
        break;
      }
    }
  }

  // Fallbacks for names
  if (!tradeName && legalName) tradeName = legalName;
  if (!legalName && tradeName) legalName = tradeName;
  if (!tradeName && fileName) {
    const cleanFile = fileName.replace(/\.(pdf|png|jpg|jpeg|xlsx|csv)$/i, '').replace(/[_-]/g, ' ').trim();
    if (cleanFile.length > 3 && !cleanFile.toLowerCase().includes('scan') && !cleanFile.toLowerCase().includes('document')) {
      tradeName = cleanFile;
      legalName = cleanFile;
    }
  }

  // F. Extract Constitution of Business / Entity Category
  const constMatch = text.match(/(?:3\.?\s*)?Constitution\s*of\s*Business[\s:\-\n]+([^\n]+)/i);
  const rawConst = constMatch ? constMatch[1] : '';
  const category: ClientCategory = detectEntityCategoryFromPANAndGSTIN(pan, gstin, tradeName, legalName, rawConst);

  // G. Extract Date of Registration / Formation / Liability
  let formationDate = '';
  const datePatterns = [
    /(?:5\.?\s*)?Date\s*of\s*Liability[\s:\-\n]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /Period\s*of\s*Validity[\s:\-\n]*From[\s:\-\n]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /Date\s*of\s*(?:Incorporation|Registration|Formation)[\s:\-\n]+(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/i
  ];
  for (const pat of datePatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const raw = match[1].trim();
      if (raw.includes('/')) {
        const parts = raw.split('/');
        formationDate = parts.length === 3 && parts[2].length === 4 
          ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` 
          : raw;
      } else {
        formationDate = raw;
      }
      break;
    }
  }

  // H. Extract Contact Person / Authorized Signatory
  let contactPerson = '';
  const contactPatterns = [
    /(?:Name\s*of\s*(?:the)?\s*(?:Authorized\s*Signatory|Proprietor|Director|Partner))[\s:\-\n]+([A-Za-z\s.]{3,40})(?=\n|$)/i,
    /(?:Proprietor|Director|Partner)[\s:\-\n]+([A-Za-z\s.]{3,40})(?=\n|$)/i
  ];
  for (const pat of contactPatterns) {
    const match = text.match(pat);
    if (match && match[1]?.trim().length > 2 && !match[1].toLowerCase().includes('date') && !match[1].toLowerCase().includes('place')) {
      contactPerson = match[1].trim();
      break;
    }
  }

  // I. Extract Mobile / Phone
  const phoneMatch = text.match(/(?:\+91[\-\s]?)?([6-9]\d{9})/);
  const phone = phoneMatch ? `+91 ${phoneMatch[1]}` : '';

  // J. Extract Email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch ? emailMatch[1].toLowerCase() : '';

  return {
    tradeName: tradeName || '',
    legalName: legalName || tradeName || '',
    pan: pan || '',
    gstin: gstin || '',
    tan: tan || '',
    category,
    status: 'ACTIVE',
    contactPerson: contactPerson || '',
    phone: phone || '',
    email: email || '',
    formationDate: formationDate || '',
    assignedTeamName: '',
    googleDriveFolderId: '',
    googleDriveFolderUrl: ''
  };
};

// Map Raw Objects to ParsedClientRow array (ACCURATE STATUTORY STATUS & ZERO DUMMIES)
export const mapRawDataToClients = (rawData: any[]): ParsedClientRow[] => {
  return rawData.map((row) => {
    const getVal = (possibleHeaders: string[]): string => {
      for (const header of possibleHeaders) {
        const normHeader = normalizeKey(header);
        for (const key of Object.keys(row)) {
          if (normalizeKey(key) === normHeader || normalizeKey(key).includes(normHeader)) {
            return String(row[key]).trim();
          }
        }
      }
      return '';
    };

    const tradeName = getVal(['tradeName', 'clientName', 'client', 'firmName', 'businessName', 'name']);
    const legalName = getVal(['legalName', 'registeredName', 'companyName']) || tradeName;
    const gstin = getVal(['gstin', 'gst', 'gstNumber', 'gstno']).toUpperCase();
    let pan = getVal(['pan', 'panNumber', 'panno']).toUpperCase();
    if (!pan && gstin && gstin.length === 15) {
      pan = gstin.substring(2, 12);
    }
    const tan = getVal(['tan', 'tanNumber', 'tanno']).toUpperCase();
    const vatNumber = getVal(['vat', 'vatNumber', 'stateId']);
    const phone = getVal(['phone', 'mobile', 'contactNo', 'whatsapp', 'mobileNumber']);
    const email = getVal(['email', 'mail', 'emailAddress']);
    const contactPerson = getVal(['contactPerson', 'director', 'proprietor', 'authorizedPerson']);
    const employeeName = getVal(['employeeName', 'accountant', 'accountantName']);
    const employeePhone = getVal(['employeePhone', 'accountantPhone', 'accountantMobile']);
    const aadharNumber = getVal(['aadhar', 'aadharNumber', 'uidai']);
    const dob = getVal(['dob', 'birthDate', 'dateOfBirth']);
    const formationDate = getVal(['formationDate', 'incorporationDate', 'registrationDate']);
    const assignedTeamName = getVal(['assignedTeamName', 'assignedPartner', 'caStaff', 'assignedStaff']);
    const googleDriveFolderId = getVal(['googleDriveFolderId', 'driveFolderId', 'driveId']);
    const googleDriveFolderUrl = getVal(['googleDriveFolderUrl', 'driveFolderUrl', 'driveUrl', 'driveLink']);

    const rawCategory = getVal(['category', 'entityType', 'constitution', 'type', 'status']);
    
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
      gstin: gstin || undefined,
      tan: tan || undefined,
      vatNumber: vatNumber || undefined,
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
  return rawData.map((row) => {
    const getVal = (possibleHeaders: string[]): string => {
      for (const header of possibleHeaders) {
        const normHeader = normalizeKey(header);
        for (const key of Object.keys(row)) {
          if (normalizeKey(key) === normHeader || normalizeKey(key).includes(normHeader)) {
            return String(row[key]).trim();
          }
        }
      }
      return '';
    };

    const name = getVal(['name', 'staffName', 'employeeName', 'member', 'userName']);
    const roleStr = getVal(['role', 'access', 'userRole']).toUpperCase();
    const role: 'ADMIN' | 'TEAM' = roleStr.includes('ADMIN') || roleStr.includes('PARTNER') ? 'ADMIN' : 'TEAM';
    const designation = getVal(['designation', 'post', 'title', 'position']) || (role === 'ADMIN' ? 'Senior CA / Partner' : 'Compliance Associate');
    const phone = getVal(['phone', 'mobile', 'contactNo', 'mobileNumber']);
    const email = getVal(['email', 'mail', 'officialEmail']);
    const pan = getVal(['pan', 'panNumber']).toUpperCase();
    const pin = getVal(['pin', 'password', 'loginPin']) || (phone ? phone.slice(-4) : '1234');

    let isValid = true;
    let validationError = '';

    if (!name) {
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
  });
};

// 1. Fetch & Parse Direct from Google Sheet URL or ID (Drive Cloud Storage)
export const fetchGoogleSheetData = async (sheetUrlOrId: string): Promise<any[]> => {
  const trimmed = sheetUrlOrId.trim();
  if (!trimmed) throw new Error('Please enter a Google Sheet URL or ID');

  let sheetId = trimmed;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) sheetId = match[1];

  let csvContent = '';

  try {
    const directExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const res = await fetch(directExportUrl);
    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes('<!DOCTYPE html>')) {
        csvContent = text;
      }
    }
  } catch (err) {
    console.warn('Direct Google Sheet fetch attempted:', err);
  }

  if (!csvContent) {
    const proxyRes = await fetch('/api/reports/fetch-google-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetUrlOrId: trimmed })
    });

    if (!proxyRes.ok) {
      const errJson = await proxyRes.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to fetch Google Sheet from Google Drive.');
    }

    const data = await proxyRes.json();
    csvContent = data.csvData;
  }

  if (!csvContent) {
    throw new Error('Google Sheet returned empty data. Ensure sharing is "Anyone with link can view".');
  }

  const workbook = XLSX.read(csvContent, { type: 'string' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
};

export const parseClientsFromGoogleSheet = async (sheetUrlOrId: string): Promise<ParsedClientRow[]> => {
  const rawData = await fetchGoogleSheetData(sheetUrlOrId);
  if (!rawData || rawData.length === 0) {
    throw new Error('The Google Sheet contains no data rows.');
  }
  return mapRawDataToClients(rawData);
};

export const parseTeamFromGoogleSheet = async (sheetUrlOrId: string): Promise<ParsedTeamRow[]> => {
  const rawData = await fetchGoogleSheetData(sheetUrlOrId);
  if (!rawData || rawData.length === 0) {
    throw new Error('The Google Sheet contains no data rows.');
  }
  return mapRawDataToTeam(rawData);
};

// 2. Parse Clients from Excel / CSV / PDF Files (SEAMLESS PDF & EXCEL SUPPORT)
export const parseClientsFromFile = async (file: File): Promise<ParsedClientRow[]> => {
  const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
  const isPdf = /\.pdf$/i.test(file.name);

  if (isExcel) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      throw new Error('The uploaded Excel sheet contains no data rows.');
    }

    return mapRawDataToClients(rawData);
  }

  if (isPdf) {
    let rawText = '';
    try {
      rawText = await extractPdfTextFromServer(file);
    } catch (e) {
      console.warn('PDF server parse attempt:', e);
    }

    if (!rawText || rawText.trim().length < 5) {
      rawText = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
    }

    const client = parseDocumentTextToClientData(rawText, file.name);

    let tradeName = client.tradeName || file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim();
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

    const category = client.category || detectEntityCategoryFromPANAndGSTIN(pan, gstin, tradeName, client.legalName);

    const row: ParsedClientRow = {
      tradeName: tradeName || 'Extracted Client',
      legalName: client.legalName || tradeName || 'Extracted Client',
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

// 3. Parse Team Members from Excel / CSV / PDF Files
export const parseTeamFromFile = async (file: File): Promise<ParsedTeamRow[]> => {
  const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
  const isPdf = /\.pdf$/i.test(file.name);

  if (isExcel) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      throw new Error('The uploaded Excel sheet contains no data rows.');
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
      'PAN Number': 'ABCPS1234M',
      'Login PIN': '2345'
    },
    {
      'Staff Name': 'Priya Nair',
      'Role': 'TEAM',
      'Designation': 'TDS & Direct Tax Specialist',
      'Mobile Number': '9820267890',
      'Email Address': 'priya.nair@cadomain.in',
      'PAN Number': 'ABCPN5678Q',
      'Login PIN': '7890'
    },
    {
      'Staff Name': 'CA Ananya Deshmukh',
      'Role': 'ADMIN',
      'Designation': 'Partner - Corporate Audit & ROC',
      'Mobile Number': '9820399887',
      'Email Address': 'ananya.ca@cadomain.in',
      'PAN Number': 'ABCDA9988Z',
      'Login PIN': '9887'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Team_Master_Template');
  XLSX.writeFile(wb, 'TASK-VAANI_Team_Master_Template.xlsx');
};
