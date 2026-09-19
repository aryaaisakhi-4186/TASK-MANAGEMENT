import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client, ClientCategory } from '../types';
import { getStoredGeminiKey } from './clientAIService';

// Load PDF.js dynamically from CDN if not already present
let pdfjsLoadingPromise: Promise<any> | null = null;
export const loadPdfJsFromCdn = async (): Promise<any> => {
  if (typeof window === 'undefined') return null;
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  if (pdfjsLoadingPromise) return pdfjsLoadingPromise;

  pdfjsLoadingPromise = new Promise((resolve) => {
    try {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(lib);
        } else {
          resolve(null);
        }
      };
      script.onerror = () => {
        console.warn('PDF.js CDN load error, fallback to binary scanner');
        resolve(null);
      };
      document.head.appendChild(script);
    } catch {
      resolve(null);
    }
  });

  return pdfjsLoadingPromise;
};

// Convert File to base64 string
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

// Entity Category Detector from PAN 4th Character and GSTIN
export const detectCategory = (
  pan?: string,
  gstin?: string,
  tradeName?: string,
  legalName?: string,
  rawCategory?: string
): ClientCategory => {
  if (rawCategory && rawCategory.trim()) {
    const r = rawCategory.toUpperCase().trim();
    if (r.includes('LLP') || r.includes('LIMITED LIABILITY')) return 'LLP';
    if (r.includes('PARTNER') || r.includes('FIRM')) return 'PARTNERSHIP';
    if (r.includes('PROP') || r.includes('SOLE')) return 'PROPRIETOR';
    if (r.includes('INDIVID') || r.includes('PERSON') || r.includes('HUF')) return 'INDIVIDUAL';
    if (r.includes('TRUST') || r.includes('SOCIETY') || r.includes('NGO') || r.includes('AOP')) return 'TRUST';
    if (r.includes('PVT') || r.includes('PRIVATE') || r.includes('LTD') || r.includes('COMPANY')) return 'PVT_LTD';
  }

  let cleanPan = pan?.trim().toUpperCase();
  if (!cleanPan && gstin && gstin.trim().length >= 12) {
    cleanPan = gstin.trim().toUpperCase().substring(2, 12);
  }

  if (cleanPan && cleanPan.length === 10) {
    const fourthChar = cleanPan.charAt(3);
    if (fourthChar === 'C') return 'PVT_LTD';
    if (fourthChar === 'F') return 'PARTNERSHIP';
    if (fourthChar === 'L') return 'LLP';
    if (fourthChar === 'T') return 'TRUST';
    if (fourthChar === 'P') {
      const combined = `${tradeName || ''} ${legalName || ''}`.toUpperCase();
      if (
        combined.includes('TRADERS') || 
        combined.includes('ENTERPRISES') || 
        combined.includes('STORE') || 
        combined.includes('AGENCY') || 
        combined.includes('SERVICES') ||
        combined.includes('SOLUTIONS')
      ) {
        return 'PROPRIETOR';
      }
      return 'INDIVIDUAL';
    }
  }

  const combined = `${tradeName || ''} ${legalName || ''}`.toUpperCase();
  if (combined.includes('PVT') || combined.includes('PRIVATE LIMITED') || combined.includes('LTD')) return 'PVT_LTD';
  if (combined.includes('LLP')) return 'LLP';
  if (combined.includes('TRUST') || combined.includes('FOUNDATION') || combined.includes('SAMITI') || combined.includes('SANSTHA')) return 'TRUST';
  if (combined.includes('PARTNERSHIP') || combined.includes('& CO') || combined.includes('& ASSOCIATES')) return 'PARTNERSHIP';

  return 'PVT_LTD';
};

// Pure client-side binary & Latin-1 stream text extractor
export const extractBinaryPdfText = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    let latin1 = '';
    const chunkSize = 16384;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      latin1 += String.fromCharCode.apply(null, chunk as any);
    }

    const textPieces: string[] = [];

    // Search for Tj strings
    const tjMatches = latin1.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g);
    for (const m of tjMatches) {
      if (m[1] && m[1].length > 1) textPieces.push(m[1].replace(/\\([()\\])/g, '$1'));
    }

    // Search for TJ arrays
    const tjArrMatches = latin1.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
    for (const m of tjArrMatches) {
      const subStrings = m[1].matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g);
      for (const s of subStrings) {
        if (s[1] && s[1].length > 1) textPieces.push(s[1].replace(/\\([()\\])/g, '$1'));
      }
    }

    // Search for direct regex matches in full latin1 string
    const gstinMatches = latin1.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/g);
    const panMatches = latin1.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/g);

    let fullOutput = textPieces.join(' ') + '\n' + latin1;
    if (gstinMatches && gstinMatches.length > 0) {
      fullOutput += '\nGSTIN_LIST: ' + gstinMatches.join(' ');
    }
    if (panMatches && panMatches.length > 0) {
      fullOutput += '\nPAN_LIST: ' + panMatches.join(' ');
    }

    return fullOutput;
  } catch (e) {
    console.warn('Binary stream extract note:', e);
    return '';
  }
};

// Text Extractor with PDF.js
export const extractPdfJsText = async (file: File): Promise<string> => {
  try {
    const pdfjs = await loadPdfJsFromCdn();
    if (!pdfjs) return '';

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    
    let text = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str || '').join(' ');
      text += pageText + '\n';
    }
    return text;
  } catch (e) {
    console.warn('PDF.js text parse note:', e);
    return '';
  }
};

// Server Endpoint Parser (/api/reports/parse-pdf-text)
export const extractServerPdfText = async (file: File): Promise<string> => {
  try {
    const base64Data = await fileToBase64(file);
    const res = await fetch('/api/reports/parse-pdf-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64: base64Data, filename: file.name })
    });
    if (res.ok) {
      const data = await res.json();
      return data.rawText || '';
    }
    return '';
  } catch {
    return '';
  }
};

// Comprehensive Text Regex Field Parser
export const parseRawTextToClientData = (rawText: string, fileName?: string): Partial<Client> => {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. GSTIN (15-character statutory format)
  let gstin: string | undefined = undefined;
  const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i) ||
                     text.match(/(?:GSTIN|Registration\s*Number|GST\s*No\.?)[\s:\-\n]+([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])/i);
  if (gstinMatch) {
    gstin = gstinMatch[1].toUpperCase();
  }

  // 2. PAN (10-character statutory format)
  let pan: string | undefined = undefined;
  if (gstin && gstin.length === 15) {
    pan = gstin.substring(2, 12);
  } else {
    const panMatch = text.match(/(?:Permanent\s*Account\s*Number|PAN\s*Number|PAN\s*Card|PAN)[\s:\-\n]+([A-Z]{5}[0-9]{4}[A-Z])/i) ||
                     text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
    if (panMatch) {
      pan = panMatch[1].toUpperCase();
    }
  }

  // 3. TAN
  let tan: string | undefined = undefined;
  const tanMatch = text.match(/\bTAN\s*[:\-\n]*\s*([A-Z]{4}[0-9]{5}[A-Z])\b/i);
  if (tanMatch && tanMatch[1].toUpperCase() !== pan) {
    tan = tanMatch[1].toUpperCase();
  }

  // 4. Legal Name
  let legalName = '';
  const legalNamePatterns = [
    /(?:1\.?\s*)?Legal\s*Name(?:\s*of\s*Business)?[\s:\-\n]+([^\n\r]+)/i,
    /Name\s*of\s*(?:the)?\s*Enterprise[\s:\-\n]+([^\n\r]+)/i,
    /Name\s*of\s*(?:the)?\s*Assessee[\s:\-\n]+([^\n\r]+)/i,
    /Name\s*of\s*(?:the)?\s*Applicant[\s:\-\n]+([^\n\r]+)/i,
    /M\/s\.?\s*([^\n\r,;]+)/i
  ];
  for (const pat of legalNamePatterns) {
    const match = text.match(pat);
    if (match && match[1]?.trim().length > 2) {
      const candidate = match[1].trim().replace(/^[:\-\s]+/, '').replace(/[;,.]*$/, '').trim();
      if (!candidate.toLowerCase().includes('trade name') && !candidate.toLowerCase().includes('form') && candidate.length > 2) {
        legalName = candidate;
        break;
      }
    }
  }

  // 5. Trade Name
  let tradeName = '';
  const tradeNamePatterns = [
    /(?:2\.?\s*)?Trade\s*Name(?:,\s*if\s*any)?[\s:\-\n]+([^\n\r]+)/i,
    /Trade\s*Name[\s:\-\n]+([^\n\r]+)/i,
    /Business\s*Name[\s:\-\n]+([^\n\r]+)/i,
    /Enterprise\s*Name[\s:\-\n]+([^\n\r]+)/i
  ];
  for (const pat of tradeNamePatterns) {
    const match = text.match(pat);
    if (match && match[1]?.trim().length > 2) {
      const candidate = match[1].trim().replace(/^[:\-\s]+/, '').replace(/[;,.]*$/, '').trim();
      if (candidate && candidate.toUpperCase() !== 'NA' && candidate.toUpperCase() !== 'N/A' && candidate !== '-' && !candidate.toLowerCase().includes('constitution')) {
        tradeName = candidate;
        break;
      }
    }
  }

  if (!tradeName && legalName) tradeName = legalName;
  if (!legalName && tradeName) legalName = tradeName;

  // Fallback to clean file name if neither is found
  if (!tradeName && fileName) {
    const cleanFile = fileName.replace(/\.(pdf|png|jpg|jpeg|xlsx|csv)$/i, '').replace(/[_-]/g, ' ').trim();
    if (cleanFile.length > 3 && !cleanFile.toLowerCase().includes('scan') && !cleanFile.toLowerCase().includes('document') && !cleanFile.toLowerCase().includes('untitled')) {
      tradeName = cleanFile;
      legalName = cleanFile;
    }
  }

  // 6. Constitution & Category
  const constMatch = text.match(/(?:3\.?\s*)?Constitution\s*of\s*Business[\s:\-\n]+([^\n\r]+)/i) ||
                     text.match(/Status\s*[:\-\n]*\s*([^\n\r]+)/i);
  const rawConst = constMatch ? constMatch[1] : '';
  const category = detectCategory(pan, gstin, tradeName, legalName, rawConst);

  // 7. Formation / Liability Date
  let formationDate = '';
  const datePatterns = [
    /(?:5\.?\s*)?Date\s*of\s*Liability[\s:\-\n]+(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i,
    /Period\s*of\s*Validity[\s:\-\n]*From[\s:\-\n]+(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i,
    /Date\s*of\s*(?:Incorporation|Registration|Formation|Birth)[\s:\-\n]+(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})/i
  ];
  for (const pat of datePatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const raw = match[1].trim();
      if (raw.includes('/') || raw.includes('-') || raw.includes('.')) {
        const parts = raw.split(/[\/\-\.]/);
        if (parts.length === 3) {
          formationDate = parts[2].length === 4
            ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
            : raw;
        }
      }
      break;
    }
  }

  // 8. Contact Person
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

  // 9. Phone
  const phoneMatch = text.match(/(?:\+91[\-\s]?)?([6-9]\d{9})/);
  const phone = phoneMatch ? `+91 ${phoneMatch[1]}` : '';

  // 10. Email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch ? emailMatch[1].toLowerCase() : '';

  return {
    tradeName: tradeName || 'New Client Profile',
    legalName: legalName || tradeName || 'New Client Profile',
    pan: pan || '',
    gstin: gstin || '',
    tan: tan || '',
    category,
    status: 'ACTIVE',
    contactPerson: contactPerson || 'Authorized Person',
    phone: phone || '',
    email: email || '',
    formationDate: formationDate || new Date().toISOString().split('T')[0],
    assignedTeamName: '',
    googleDriveFolderId: '',
    googleDriveFolderUrl: ''
  };
};

// MULTI-TIER DOCUMENT & PDF EXTRACTION ENGINE (UNIVERSAL OCR)
export const extractDocumentDataDirectly = async (file: File): Promise<Partial<Client>> => {
  const isPdf = /\.pdf$/i.test(file.name);

  // -------------------------------------------------------------------------
  // TIER 1: Gemini AI Multimodal Vision (100% Accurate OCR for Scanned / Image PDFs)
  // -------------------------------------------------------------------------
  const apiKey = getStoredGeminiKey();
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');

      const prompt = `You are an expert Indian Chartered Accountant document OCR parser.
Analyze this uploaded document (Form GST REG-06, PAN Card, Certificate of Incorporation, MSME Certificate, Bank Statement, Tax Notice, or Tax Invoice).

Extract and return ONLY a valid JSON object with the following fields:
{
  "tradeName": "Trade / Business Name",
  "legalName": "Legal Name of Enterprise or Person",
  "pan": "10-character PAN (e.g. ABCDE1234F)",
  "gstin": "15-character GSTIN (e.g. 07ABCDE1234F1Z5)",
  "tan": "10-character TAN if present",
  "category": "PVT_LTD" | "LLP" | "PARTNERSHIP" | "PROPRIETOR" | "INDIVIDUAL" | "TRUST",
  "contactPerson": "Authorized Signatory / Proprietor / Director / Partner name",
  "phone": "Mobile or phone number",
  "email": "Email address",
  "formationDate": "YYYY-MM-DD (Date of liability / registration / incorporation)",
  "address": "Principal Place of Business address"
}

Important Rules:
- If PAN is missing but GSTIN is found, extract characters 3-12 of GSTIN as PAN.
- If Trade Name is missing or N/A, set tradeName to legalName.
- Determine category from constitution or 4th character of PAN (P->PROPRIETOR/INDIVIDUAL, C->PVT_LTD, F->PARTNERSHIP, L->LLP, T->TRUST).
- Return ONLY raw JSON with NO markdown backticks or extra text.`;

      const result = await model.generateContent([
        { inlineData: { data: base64Data, mimeType } },
        prompt
      ]);

      const text = result.response.text();
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed && (parsed.pan || parsed.gstin || parsed.tradeName || parsed.legalName)) {
        return {
          tradeName: parsed.tradeName || parsed.legalName || file.name.replace(/\.[^/.]+$/, ''),
          legalName: parsed.legalName || parsed.tradeName || '',
          pan: (parsed.pan || '').toUpperCase().trim(),
          gstin: (parsed.gstin || '').toUpperCase().trim(),
          tan: (parsed.tan || '').toUpperCase().trim() || undefined,
          category: parsed.category || detectCategory(parsed.pan, parsed.gstin, parsed.tradeName, parsed.legalName),
          contactPerson: parsed.contactPerson || 'Authorized Signatory',
          phone: parsed.phone || '',
          email: parsed.email || '',
          formationDate: parsed.formationDate || new Date().toISOString().split('T')[0],
          status: 'ACTIVE'
        };
      }
    } catch (geminiErr) {
      console.warn('Gemini Document Extraction fallback note:', geminiErr);
    }
  }

  // -------------------------------------------------------------------------
  // TIER 2: PDF.js Browser-side Text Extraction
  // -------------------------------------------------------------------------
  if (isPdf) {
    try {
      const pdfJsText = await extractPdfJsText(file);
      if (pdfJsText && pdfJsText.trim().length > 15) {
        const client = parseRawTextToClientData(pdfJsText, file.name);
        if (client.pan || client.gstin || (client.tradeName && client.tradeName !== 'New Client Profile')) {
          return client;
        }
      }
    } catch (pdfJsErr) {
      console.warn('PDF.js parse note:', pdfJsErr);
    }
  }

  // -------------------------------------------------------------------------
  // TIER 3: Backend Server Endpoint (/api/reports/parse-pdf-text)
  // -------------------------------------------------------------------------
  if (isPdf) {
    try {
      const serverText = await extractServerPdfText(file);
      if (serverText && serverText.trim().length > 15) {
        const client = parseRawTextToClientData(serverText, file.name);
        if (client.pan || client.gstin) {
          return client;
        }
      }
    } catch (srvErr) {
      console.warn('Server parse note:', srvErr);
    }
  }

  // -------------------------------------------------------------------------
  // TIER 4: Client-side Binary Stream Sweep (Offline Safety Net)
  // -------------------------------------------------------------------------
  try {
    const binaryText = await extractBinaryPdfText(file);
    const client = parseRawTextToClientData(binaryText, file.name);
    return client;
  } catch (binErr) {
    console.warn('Binary stream parse note:', binErr);
    return parseRawTextToClientData('', file.name);
  }
};
