import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client, ClientCategory } from '../types';
import { getStoredGeminiKey } from './clientAIService';

// Load PDF.js dynamically from CDN if not already present with timeout guard
let pdfjsLoadingPromise: Promise<any> | null = null;
export const loadPdfJsFromCdn = async (): Promise<any> => {
  if (typeof window === 'undefined') return null;
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  if (pdfjsLoadingPromise) return pdfjsLoadingPromise;

  pdfjsLoadingPromise = new Promise((resolve) => {
    let settled = false;
    const safeResolve = (val: any) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    const timer = setTimeout(() => {
      safeResolve(null);
    }, 3500);

    try {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        clearTimeout(timer);
        const lib = (window as any).pdfjsLib;
        if (lib) {
          try {
            lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          } catch {}
          safeResolve(lib);
        } else {
          safeResolve(null);
        }
      };
      script.onerror = () => {
        clearTimeout(timer);
        console.warn('PDF.js CDN load error, fallback to binary scanner');
        safeResolve(null);
      };
      document.head.appendChild(script);
    } catch {
      clearTimeout(timer);
      safeResolve(null);
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

    let fullOutput = textPieces.join('\n') + '\n' + latin1;
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

// Clean & Sanitize Extracted Legal Name or Trade Name (100% strips any address, PIN code, or form labels)
export const cleanExtractedEntityName = (rawName: string | undefined | null): string => {
  if (!rawName) return '';

  let s = String(rawName)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading field numbers, colons, dashes, or quotes
  s = s.replace(/^(?:[1-9]\.?\s*)?(?:Legal\s*Name(?:\s*of\s*Business)?|Trade\s*Name(?:\s*,\s*if\s*any)?|Business\s*Name|Name\s*of\s*(?:the\s*)?(?:Enterprise|Assessee|Applicant))[\s:\-]*/i, '');
  s = s.replace(/^[\s:\-;,.#"']+/g, '').trim();

  // 1. Cut off immediately at any subsequent GST REG-06 / Statutory Form field labels
  const formLabelCutoffPatterns: RegExp[] = [
    /\s+(?:[1-9]\.\s*)?(?:Legal\s*Name|Trade\s*Name(?:\s*,\s*if\s*any)?|Constitution\s*of\s*Business|Address\s*of\s*Principal\s*Place|Date\s*of\s*Liability|Period\s*of\s*Validity|Type\s*of\s*Registration|Particulars\s*of\s*Approving\s*Authority)\b/i,
    /\s+(?:Details\s*of\s*Additional\s*Places(?:\s*of\s*Business)?|Additional\s*Place(?:s)?\s*of\s*Business|Principal\s*Place\s*of\s*Business|Details\s*of\s*(?:Proprietor|Partners|Managing|Authorized))\b/i,
    /\s+(?:Constitution\s*[:\-]|Registration\s*Number|GSTIN\s*[:\-]?|PAN\s*(?:No\.?|Number)?\s*[:\-]|Permanent\s*Account\s*Number|State\s*Jurisdiction|Center\s*Jurisdiction|Centre\s*Jurisdiction|Sr\.?\s*No\.?\s+Address)\b/i,
    /\s+(?:Father'?s?\s*Name|Date\s*of\s*(?:Birth|Incorporation|Registration|Formation)|Major\s*Activity|Social\s*Category|Official\s*address\s*of\s*Enterprise)\b/i,
  ];
  for (const pat of formLabelCutoffPatterns) {
    const idx = s.search(pat);
    if (idx !== -1) {
      s = s.substring(0, idx).trim();
    }
  }

  // 2. Cut off immediately at explicit Address field labels or prefixes
  const addressLabelCutoffPatterns: RegExp[] = [
    /\s*[,;\-]?\s*\b(?:Address|Add\.?|Regd\.?\s*Off(?:ice)?|Registered\s*Office|Corporate\s*Office|Head\s*Office|Branch\s*Office|Office\s*Address|Principal\s*Address|Factory\s*Address)\s*[:\-]/i,
    /\s*[,;\-]?\s*\b(?:Building\s*No\.?(?:\/Flat\s*No\.?)?|Flat\s*No\.?(?:\/Door\s*No\.?)?|Floor\s*No\.?|Door\s*No\.?|House\s*No\.?|Plot\s*No\.?|Shop\s*No\.?|Gala\s*No\.?|Office\s*No\.?|Unit\s*No\.?|Block\s*No\.?|Ward\s*No\.?|Survey\s*No\.?|Khasra\s*No\.?|Gata\s*No\.?|Room\s*No\.?|Booth\s*No\.?|SCO\s*No\.?|SCF\s*No\.?|Premises\s*No\.?|H\.?\s*No\.?|D\.?\s*No\.?|Bldg\.?\s*No\.?|S\.?\s*No\.?)\s*[:\-.,\dA-Za-z]/i,
    /\s*[,;\-]?\s*\b(?:Name\s*Of\s*Premises(?:\/Building)?|Road\/Street|Locality\/Sub\s*Locality|City\/Town\/Village|Sub\s*District|District\s*:|State\s*:|PIN\s*Code|Pincode|Postal\s*Code)\b/i,
    /\s*[,;\-]?\s*\b(?:Ground\s*Floor|First\s*Floor|Second\s*Floor|Third\s*Floor|Fourth\s*Floor|1st\s*Floor|2nd\s*Floor|3rd\s*Floor|4th\s*Floor|5th\s*Floor|Basement|Upper\s*Ground|Lower\s*Ground|Mezzanine\s*Floor)\b/i,
    /\s*[,;\-]?\s*\b(?:Near\s+|Opp\.?\s+|Opposite\s+|Behind\s+|Beside\s+|Next\s+to\s+|Adjacent\s+to\s+|In\s+front\s+of\s+|At\s+Post\s+|Post\s+Office\s+|P\.?\s*O\.?\s+|Tehsil\s+|Taluka\s+|Taluk\s+|Mandal\s+|Distt\.?\s+|District\s+|S\/o\s+|D\/o\s+|W\/o\s+|C\/o\s+|R\/o\s+)/i,
  ];
  for (const pat of addressLabelCutoffPatterns) {
    const idx = s.search(pat);
    if (idx !== -1) {
      s = s.substring(0, idx).trim();
    }
  }

  // 3. If the entity is a Company or LLP, its legal/trade name ends right at PRIVATE LIMITED / PVT LTD / LIMITED / LLP
  const corpSuffixMatch = s.match(/^(.*?\b(?:(?:\(OPC\)\s*)?PRIVATE\s+LIMITED|PVT\.?\s*LTD\.?|LIMITED\s+LIABILITY\s+PARTNERSHIP|LLP|PUBLIC\s+LIMITED|LIMITED|LTD\.?))(?:\s*[,;\-]|\s+).*$/i);
  if (corpSuffixMatch && corpSuffixMatch[1] && corpSuffixMatch[1].trim().length >= 5) {
    s = corpSuffixMatch[1].trim();
  }

  // 4. If a common business suffix is followed by street/door numbers or address words, truncate right after the business suffix
  const bizSuffixAddressMatch = s.match(
    /^(.*?\b(?:ENTERPRISES|ENTERPRISE|TRADERS|TRADING\s+CO(?:MPANY)?|AGENCIES|AGENCY|INDUSTRIES|ASSOCIATES|CORPORATION|SOLUTIONS|SERVICES|CONSULTANTS|LOGISTICS|MOTORS|AUTOMOBILES|PHARMA|PHARMACEUTICALS|MEDICAL\s+STORE|MEDICO|GENERAL\s+STORE|KIRANA\s+STORE|STORES|STORE|MART|EMPORIUM|GARMENTS|TEXTILES|FABRICS|JEWELLERS|SWEETS|BAKERS|FOODS|AGRO|CHEMICALS|ELECTRICALS|ELECTRONICS|COMPUTERS|HARDWARE|STEELS|METALS|CEMENT|CONSTRUCTIONS|BUILDERS|DEVELOPERS|INFRASTRUCTURE|INFRA|DISTRIBUTORS|EXPORTS|IMPORTS|TRANSPORTS|PRINTERS|WORKS|MILLS|ENGINEERING|COMPANY|&\s*CO\.?|&\s*SONS|BROTHERS))(?:\s*[,;\-]+\s*.*|\s+(?:\d+|No\.?\b|Plot\b|Shop\b|Flat\b|House\b|Bldg\b|Building\b|Floor\b|Gali\b|Lane\b|Road\b|Rd\b|Street\b|St\b|Marg\b|Nagar\b|Colony\b|Vihar\b|Puram\b|Pura\b|Ganj\b|Bazar\b|Bazaar\b|Market\b|Chowk\b|Sector\b|Phase\b|Block\b|Ward\b|Area\b|Estate\b|MIDC\b|GIDC\b|RIICO\b|Vill\b|Village\b|Town\b|City\b|Dist\b|District\b|Tehsil\b|Taluka\b|State\b|Pin\b).*)$/i
  );
  if (bizSuffixAddressMatch && bizSuffixAddressMatch[1] && bizSuffixAddressMatch[1].trim().length >= 4) {
    s = bizSuffixAddressMatch[1].trim();
  }

  // 5. If there is a comma followed by address indicators (digits, road/area/city/state words, or multiple commas), keep only the name before the first comma
  if (s.includes(',')) {
    const commaParts = s.split(',');
    const firstPart = commaParts[0].trim();
    const restParts = commaParts.slice(1).join(',').trim();
    const hasAddressInRest =
      commaParts.length >= 3 ||
      /\d/.test(restParts) ||
      /\b(?:road|rd|street|st|marg|lane|gali|nagar|colony|vihar|puram|pura|ganj|bazar|bazaar|market|chowk|compound|complex|estate|industrial|area|phase|sector|block|ward|enclave|park|garden|society|tower|plaza|arcade|chambers|bhavan|bhawan|flat|floor|shop|plot|house|bldg|building|office|vill|village|town|city|dist|district|tehsil|taluka|post|pin|midc|gidc|riico|east|west|north|south|central|cantt|camp|maharashtra|gujarat|delhi|rajasthan|uttar\s*pradesh|madhya\s*pradesh|karnataka|tamil\s*nadu|telangana|andhra\s*pradesh|west\s*bengal|bihar|jharkhand|odisha|chhattisgarh|punjab|haryana|himachal|uttarakhand|kerala|assam|goa|chandigarh|india)\b/i.test(restParts);

    if (firstPart.length >= 3 && !/^(?:1|2|3|4|5|M\/s)$/i.test(firstPart) && hasAddressInRest) {
      s = firstPart;
    }
  }

  // 6. Strip unlabelled door/plot numbers & street address tails (e.g. "SHARMA TRADERS 12/4 MG Road...")
  const doorNumberTailMatch = s.match(/^([A-Za-z][A-Za-z0-9 .&'()\-]{2,}?)\s+(?:\d{1,4}[\/\-][A-Za-z0-9\/\-]+|[A-Za-z]{1,2}[\-\/]\d{1,4}|\d{1,4}\s+[A-Za-z]+\s+(?:Road|Rd|Street|St|Marg|Nagar|Colony|Market|Bazar|Bazaar|Gali|Lane|Chowk|Sector|Phase))\b.*$/i);
  if (doorNumberTailMatch && doorNumberTailMatch[1] && doorNumberTailMatch[1].trim().length >= 3) {
    s = doorNumberTailMatch[1].trim();
  }

  // 7. Strip any trailing 6-digit PIN code or State name
  s = s.replace(/\s*[,;\-]?\s*\b[1-9]\d{5}\b.*$/i, '').trim();

  // Final cleanup of trailing punctuation or stray numbering
  s = s
    .replace(/^[\s:\-;,.#"']+|[\s:\-;,.#"']+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Reject invalid placeholder values
  const upper = s.toUpperCase();
  if (
    !s ||
    s.length < 2 ||
    upper === 'NA' ||
    upper === 'N/A' ||
    upper === 'NIL' ||
    upper === 'NONE' ||
    upper === 'NOT APPLICABLE' ||
    upper === '-' ||
    upper === 'LEGAL NAME' ||
    upper === 'TRADE NAME' ||
    upper === 'IF ANY' ||
    upper.startsWith('CONSTITUTION OF BUSINESS') ||
    upper.startsWith('ADDRESS OF PRINCIPAL') ||
    upper.startsWith('BUILDING NO')
  ) {
    return '';
  }

  return s;
};

// Text Extractor with PDF.js (Preserves Y/X Visual Table Rows AND Stream Line Breaks)
export const extractPdfJsText = async (file: File): Promise<string> => {
  try {
    const pdfjs = await loadPdfJsFromCdn();
    if (!pdfjs) return '';

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    
    let visualText = '';
    let streamText = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const rawItems = (content.items || []) as any[];

      // A. Stream-order line reconstruction (inserts \n on Y change or EOL)
      let pageStream = '';
      let lastY: number | null = null;
      let lastX: number | null = null;

      const positionedItems: Array<{ str: string; x: number; y: number }> = [];

      for (const item of rawItems) {
        const str = typeof item.str === 'string' ? item.str : '';
        const curX = Array.isArray(item.transform) ? Number(item.transform[4]) : null;
        const curY = Array.isArray(item.transform) ? Number(item.transform[5]) : null;

        if (str.trim() && curX !== null && curY !== null) {
          positionedItems.push({ str: str.trim(), x: curX, y: curY });
        }

        if (!str) {
          if (item.hasEOL) pageStream += '\n';
          continue;
        }

        if (lastY !== null && curY !== null && Math.abs(curY - lastY) > 2.5) {
          pageStream += '\n';
        } else if (lastX !== null && curX !== null && curX < lastX - 15) {
          pageStream += '\n';
        } else if (pageStream.length > 0 && !pageStream.endsWith('\n') && !pageStream.endsWith(' ')) {
          pageStream += ' ';
        }

        pageStream += str;
        if (item.hasEOL) {
          pageStream += '\n';
        }

        if (curY !== null) lastY = curY;
        if (curX !== null) lastX = curX;
      }

      streamText += pageStream + '\n';

      // B. Visual Y/X Row-Sorted reconstruction (handles PDFs where labels and values are stored in separate blocks)
      if (positionedItems.length > 0) {
        // Sort top-to-bottom (descending Y)
        const sortedByY = [...positionedItems].sort((a, b) => b.y - a.y);
        const rows: Array<{ y: number; items: Array<{ str: string; x: number; y: number }> }> = [];

        for (const pt of sortedByY) {
          const existingRow = rows.find(r => Math.abs(r.y - pt.y) <= 3.5);
          if (existingRow) {
            existingRow.items.push(pt);
          } else {
            rows.push({ y: pt.y, items: [pt] });
          }
        }

        const pageVisual = rows
          .map(r => {
            r.items.sort((a, b) => a.x - b.x);
            return r.items.map(it => it.str).join('   ');
          })
          .join('\n');

        visualText += pageVisual + '\n';
      }
    }

    return `${visualText}\n===STREAM_TEXT===\n${streamText}`;
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

// Helper to check if a line is just another statutory form label rather than an entity name value
const isStatutoryLabelLine = (line: string): boolean => {
  const clean = line.trim();
  if (!clean) return true;
  return /^(?:[1-9]\.\s*)?(?:Legal\s*Name|Trade\s*Name|Constitution\s*of\s*Business|Address\s*of\s*Principal|Date\s*of\s*Liability|Period\s*of\s*Validity|Type\s*of\s*Registration|Particulars\s*of\s*Approving|Details\s*of\s*Additional|Details\s*of\s*(?:Proprietor|Partners|Managing)|Registration\s*Number|Form\s*GST|Government\s*of\s*India|Annexure\s*[A-Z]|Building\s*No|Floor\s*No|Flat\s*No|Road\/Street|Locality|City\/Town|District|State|PIN\s*Code)\b/i.test(clean);
};

// Comprehensive Text Regex Field Parser
export const parseRawTextToClientData = (rawText: string, fileName?: string): Partial<Client> => {
  const normalizedRaw = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Pre-structure text so numbered GST REG-06 fields and address blocks never bleed into the same line
  const text = normalizedRaw
    .replace(/\s+(?=[1-9]\.\s*(?:Legal\s*Name|Trade\s*Name|Constitution\s*of\s*Business|Address\s*of\s*Principal|Date\s*of\s*Liability|Period\s*of\s*Validity|Type\s*of\s*Registration|Particulars\s*of\s*Approving))/gi, '\n')
    .replace(/\s+(?=(?:Trade\s*Name\s*,\s*if\s*any|Constitution\s*of\s*Business|Address\s*of\s*Principal\s*Place|Details\s*of\s*Additional\s*Places|Details\s*of\s*(?:Proprietor|Partners|Managing)|Date\s*of\s*Liability|Period\s*of\s*Validity|Type\s*of\s*Registration|Particulars\s*of\s*Approving\s*Authority)\b)/gi, '\n')
    .replace(/\s+(?=(?:Building\s*No\.?\/?\s*Flat\s*No\.?|Floor\s*No\.?\s*:|Name\s*Of\s*Premises\/?\s*Building|Road\/?\s*Street\s*:|Locality\/?\s*Sub\s*Locality|City\/?\s*Town\/?\s*Village|PIN\s*Code\s*:)\b)/gi, '\n');

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
    const panMatch = text.match(/(?:Permanent\s*Account\s*Number|PAN\s*Number|PAN\s*Card|PAN)[\s:\-\n]+([A-Z]{5}[0-9]{4}[A-Z])\b/i) ||
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

  // 4. Legal Name (Exact "1. Legal Name" from GST REG-06 / PAN / Incorporation / MSME PDF)
  let legalName = '';
  const legalNamePatterns = [
    // Same-line value after "1. Legal Name"
    /(?:1\.?\s*)?Legal\s*Name(?:\s*of\s*Business)?[ \t:\-]+([^\n\r]+)/gi,
    // Next-line value after "1. Legal Name"
    /(?:1\.?\s*)?Legal\s*Name(?:\s*of\s*Business)?[ \t:\-]*\n\s*([^\n\r]+)/gi,
    /Name\s*of\s*(?:the\s*)?(?:Enterprise|Assessee|Applicant|Company|Firm)[ \t:\-\n]+([^\n\r]+)/gi,
    /certify\s*that\s+([A-Z0-9][^\n\r]+?(?:LIMITED|LLP))\s+is\s+incorporated/gi,
    /M\/s\.?\s*([^\n\r,;]+)/gi
  ];
  for (const pat of legalNamePatterns) {
    const matches = text.matchAll(pat);
    for (const match of matches) {
      const rawCandidate = (match[1] || '').trim();
      if (!rawCandidate || isStatutoryLabelLine(rawCandidate)) continue;
      const cleaned = cleanExtractedEntityName(rawCandidate);
      if (cleaned && cleaned.length >= 3 && !cleaned.toLowerCase().includes('form gst')) {
        legalName = cleaned;
        break;
      }
    }
    if (legalName) break;
  }

  // 5. Trade Name (Exact "2. Trade Name, if any" from GST REG-06 without any address)
  let tradeName = '';
  const tradeNamePatterns = [
    // Same-line value after "2. Trade Name, if any"
    /(?:2\.?\s*)?Trade\s*Name(?:\s*,\s*if\s*any)?[ \t:\-]+([^\n\r]+)/gi,
    // Next-line value after "2. Trade Name, if any"
    /(?:2\.?\s*)?Trade\s*Name(?:\s*,\s*if\s*any)?[ \t:\-]*\n\s*([^\n\r]+)/gi,
    /(?:Name\s*of\s*Unit|Business\s*Name|Enterprise\s*Name)[ \t:\-]+([^\n\r]+)/gi
  ];
  for (const pat of tradeNamePatterns) {
    const matches = text.matchAll(pat);
    for (const match of matches) {
      const rawCandidate = (match[1] || '').trim();
      if (!rawCandidate || isStatutoryLabelLine(rawCandidate)) continue;
      // Ignore if it accidentally captured ", if any" itself with no value
      const strippedIfAny = rawCandidate.replace(/^,?\s*if\s*any[\s:\-]*/i, '').trim();
      if (!strippedIfAny || isStatutoryLabelLine(strippedIfAny)) continue;
      const cleaned = cleanExtractedEntityName(strippedIfAny);
      if (cleaned && cleaned.length >= 3 && !cleaned.toLowerCase().includes('form gst')) {
        tradeName = cleaned;
        break;
      }
    }
    if (tradeName) break;
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

  // Pre-extract selectable PDF text via PDF.js if available (provides exact character-level ground truth for GST REG-06)
  let pdfJsClient: Partial<Client> | null = null;
  if (isPdf) {
    try {
      const pdfJsText = await extractPdfJsText(file);
      if (pdfJsText && pdfJsText.trim().length > 15) {
        const parsedPdf = parseRawTextToClientData(pdfJsText, file.name);
        if (parsedPdf.pan || parsedPdf.gstin || (parsedPdf.tradeName && parsedPdf.tradeName !== 'New Client Profile')) {
          pdfJsClient = parsedPdf;
        }
      }
    } catch (pdfJsErr) {
      console.warn('PDF.js pre-parse note:', pdfJsErr);
    }
  }

  // -------------------------------------------------------------------------
  // TIER 1: Gemini AI Multimodal Vision (100% Accurate OCR for Scanned / Image / Statutory PDFs)
  // -------------------------------------------------------------------------
  const apiKey = getStoredGeminiKey();
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');

      const prompt = `You are an expert Indian Chartered Accountant statutory document OCR parser.
Analyze this uploaded document (Form GST REG-06 Registration Certificate, PAN Card, Certificate of Incorporation, Udyam MSME Certificate, or Tax Document).

Extract and return ONLY a valid JSON object with the following fields:
{
  "tradeName": "Exact Trade Name from '2. Trade Name, if any' (ONLY the business name, NEVER include address)",
  "legalName": "Exact Legal Name from '1. Legal Name' (ONLY the legal entity/proprietor name, NEVER include address)",
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

CRITICAL RULES FOR TRADE NAME & LEGAL NAME:
1. In Form GST REG-06, Field "1. Legal Name" MUST go into "legalName", and Field "2. Trade Name, if any" MUST go into "tradeName".
2. NEVER copy or append ANY address (Building No, Flat No, Floor, Shop No, Plot No, Road, Street, Locality, City, District, State, or PIN Code) into "tradeName" or "legalName". Keep address strictly in the "address" field only.
3. If "2. Trade Name, if any" is blank, "NA", or "N/A", set "tradeName" equal to "legalName".
4. If PAN is missing but GSTIN is found, extract characters 3-12 of GSTIN as PAN.
5. Determine category from "3. Constitution of Business" or 4th character of PAN (P->PROPRIETOR/INDIVIDUAL, C->PVT_LTD, F->PARTNERSHIP, L->LLP, T->TRUST).
6. Return ONLY raw JSON with NO markdown backticks or extra text.`;

      let parsed: any = null;
      for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent([
            { inlineData: { data: base64Data, mimeType } },
            prompt
          ]);
          const text = result.response.text();
          const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleanJson);
          if (parsed) break;
        } catch {
          // Try next model fallback
        }
      }

      if (parsed && (parsed.pan || parsed.gstin || parsed.tradeName || parsed.legalName)) {
        const aiTrade = cleanExtractedEntityName(parsed.tradeName);
        const aiLegal = cleanExtractedEntityName(parsed.legalName);
        const pdfTrade = pdfJsClient?.tradeName && pdfJsClient.tradeName !== 'New Client Profile' ? cleanExtractedEntityName(pdfJsClient.tradeName) : '';
        const pdfLegal = pdfJsClient?.legalName && pdfJsClient.legalName !== 'New Client Profile' ? cleanExtractedEntityName(pdfJsClient.legalName) : '';

        const finalLegalName = aiLegal || pdfLegal || aiTrade || pdfTrade || '';
        const finalTradeName = aiTrade || pdfTrade || finalLegalName || file.name.replace(/\.[^/.]+$/, '');

        // If PDF text clearly found a distinct Legal Name while AI duplicated Trade Name into Legal Name, prefer the distinct PDF Legal Name
        const resolvedLegalName =
          (finalLegalName.toUpperCase() === finalTradeName.toUpperCase() && pdfLegal && pdfLegal.toUpperCase() !== finalTradeName.toUpperCase())
            ? pdfLegal
            : (finalLegalName || finalTradeName);

        const finalGst = ((parsed.gstin || pdfJsClient?.gstin || '') as string).toUpperCase().trim();
        let finalPan = ((parsed.pan || pdfJsClient?.pan || '') as string).toUpperCase().trim();
        if (!finalPan && finalGst.length === 15) {
          finalPan = finalGst.substring(2, 12);
        }

        return {
          tradeName: finalTradeName,
          legalName: resolvedLegalName,
          pan: finalPan,
          gstin: finalGst,
          tan: ((parsed.tan || pdfJsClient?.tan || '') as string).toUpperCase().trim() || undefined,
          category: parsed.category || pdfJsClient?.category || detectCategory(finalPan, finalGst, finalTradeName, resolvedLegalName),
          contactPerson: cleanExtractedEntityName(parsed.contactPerson) || pdfJsClient?.contactPerson || 'Authorized Signatory',
          phone: parsed.phone || pdfJsClient?.phone || '',
          email: parsed.email || pdfJsClient?.email || '',
          formationDate: parsed.formationDate || pdfJsClient?.formationDate || new Date().toISOString().split('T')[0],
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
  if (pdfJsClient) {
    return pdfJsClient;
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

import * as XLSX from 'xlsx';

export type DocumentDomain = 'CLIENT_MASTER' | 'TEAM_DIRECTORY' | 'DOCUMENT_VAULT' | 'UNKNOWN';

export type DocumentSubType = 
  | 'GST_CERTIFICATE' 
  | 'PAN_CARD' 
  | 'INCORPORATION_CERTIFICATE' 
  | 'MSME_CERTIFICATE' 
  | 'CLIENT_MASTER_EXCEL'
  | 'TEAM_ROSTER_EXCEL'
  | 'STAFF_PROFILE_PDF'
  | 'BANK_STATEMENT' 
  | 'SALE_VOUCHER' 
  | 'PURCHASE_VOUCHER' 
  | 'TAX_INVOICE' 
  | 'FINANCIAL_STATEMENT' 
  | 'TAX_NOTICE' 
  | 'GENERAL_DOCUMENT';

export interface DocumentClassificationResult {
  domain: DocumentDomain;
  subType: DocumentSubType;
  confidence: number;
  title: string;
  summary: string;
  matchedClientId?: string;
  matchedClientName?: string;
  isExistingClient?: boolean;
  clientData?: Partial<Client>;
  teamData?: Array<{ name: string; designation?: string; role: 'ADMIN' | 'TEAM'; phone?: string; email?: string; pin?: string }>;
  vaultData?: {
    documentTitle: string;
    category: string;
    period?: string;
    amount?: number;
  };
  validationWarning?: string;
  suggestedAction: 'CREATE_CLIENT' | 'UPDATE_CLIENT' | 'IMPORT_TEAM' | 'STORE_VAULT' | 'REVIEW_MANUAL';
}

// ---------------------------------------------------------------------------
// UNIVERSAL DOCUMENT & SPREADSHEET CLASSIFIER & FIELD EXTRACTOR
// ---------------------------------------------------------------------------
export const classifyAndExtractDocument = async (
  file: File,
  existingClients: Client[] = [],
  existingTeam: any[] = []
): Promise<DocumentClassificationResult> => {
  const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
  const isPdf = /\.pdf$/i.test(file.name);
  const isImage = /\.(png|jpe?g|webp|bmp)$/i.test(file.name);
  const lowerName = file.name.toLowerCase();

  // =========================================================================
  // DOMAIN 1: SPREADSHEET ANALYSIS (Excel / CSV)
  // =========================================================================
  if (isExcel) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (rawRows.length > 0) {
        const headers = Object.keys(rawRows[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const headerStr = headers.join(' ');

        // Check A: Team Roster
        const isTeamSheet = (
          (headerStr.includes('designation') || headerStr.includes('salary') || headerStr.includes('role') || headerStr.includes('empid') || headerStr.includes('staff')) &&
          !headerStr.includes('gstin') && !headerStr.includes('tradename')
        ) || lowerName.includes('team') || lowerName.includes('staff') || lowerName.includes('employee');

        if (isTeamSheet) {
          const teamList = rawRows.map(r => {
            const keys = Object.keys(r);
            const nameKey = keys.find(k => /name|staff|employee/i.test(k)) || keys[0];
            const desigKey = keys.find(k => /desig|post|role|position/i.test(k));
            const phoneKey = keys.find(k => /phone|mobile|contact/i.test(k));
            const emailKey = keys.find(k => /email|mail/i.test(k));
            const roleKey = keys.find(k => /role|admin|partner/i.test(k));

            const rawRole = roleKey ? String(r[roleKey]).toUpperCase() : '';
            const role: 'ADMIN' | 'TEAM' = (rawRole.includes('ADMIN') || rawRole.includes('PARTNER')) ? 'ADMIN' : 'TEAM';

            return {
              name: String(r[nameKey] || 'Staff Member').trim(),
              designation: desigKey ? String(r[desigKey]).trim() : 'Staff Associate',
              role,
              phone: phoneKey ? String(r[phoneKey]).trim() : '',
              email: emailKey ? String(r[emailKey]).trim() : '',
              pin: '1234'
            };
          }).filter(t => t.name.length > 1 && t.name !== 'Staff Member');

          return {
            domain: 'TEAM_DIRECTORY',
            subType: 'TEAM_ROSTER_EXCEL',
            confidence: 95,
            title: 'Staff / Team Roster Spreadsheet',
            summary: `Found ${teamList.length} staff records with designations & contact details.`,
            teamData: teamList,
            suggestedAction: 'IMPORT_TEAM'
          };
        }

        // Check B: Bank Statement / Ledger Excel
        const isBankOrVoucher = headerStr.includes('balance') || headerStr.includes('withdrawal') || headerStr.includes('deposit') || headerStr.includes('txndate') || headerStr.includes('chequeno') || headerStr.includes('invoiceno');
        if (isBankOrVoucher) {
          let subType: DocumentSubType = 'BANK_STATEMENT';
          let category = 'Bank Statements';
          if (headerStr.includes('invoiceno') || headerStr.includes('taxablevalue')) {
            subType = 'SALE_VOUCHER';
            category = 'Sales & Invoices';
          }

          // Match client
          let matchedClient: Client | undefined = undefined;
          for (const c of existingClients) {
            if (lowerName.includes(c.tradeName.toLowerCase()) || (c.pan && lowerName.includes(c.pan.toLowerCase()))) {
              matchedClient = c;
              break;
            }
          }

          return {
            domain: 'DOCUMENT_VAULT',
            subType,
            confidence: 90,
            title: `${subType === 'BANK_STATEMENT' ? 'Bank Statement' : 'Transaction Voucher'} Spreadsheet`,
            summary: `Contains ${rawRows.length} transaction entries.`,
            matchedClientId: matchedClient?.id,
            matchedClientName: matchedClient?.tradeName,
            vaultData: {
              documentTitle: file.name.replace(/\.[^/.]+$/, ''),
              category,
              amount: rawRows.length
            },
            suggestedAction: 'STORE_VAULT'
          };
        }

        // Check C: Client Master Excel
        const clientData = parseRawTextToClientData('', file.name);
        return {
          domain: 'CLIENT_MASTER',
          subType: 'CLIENT_MASTER_EXCEL',
          confidence: 85,
          title: 'Client Master Spreadsheet',
          summary: `Spreadsheet with ${rawRows.length} client rows ready for Master import.`,
          clientData,
          suggestedAction: 'CREATE_CLIENT'
        };
      }
    } catch (e) {
      console.warn('Excel parse note:', e);
    }
  }

  // =========================================================================
  // DOMAIN 2: PDF & IMAGE DEEP TEXT & MULTIMODAL CLASSIFICATION
  // =========================================================================
  let rawText = '';
  let clientData: Partial<Client> = {};

  try {
    clientData = await extractDocumentDataDirectly(file);
  } catch (e) {
    console.warn('Direct extraction note:', e);
  }

  try {
    if (isPdf) {
      rawText = await extractPdfJsText(file) || await extractBinaryPdfText(file) || '';
    }
  } catch {}

  const combinedText = (rawText + ' ' + JSON.stringify(clientData) + ' ' + lowerName).toLowerCase();

  // 1. Check if Document is a Bank Statement
  if (
    combinedText.includes('bank statement') || 
    combinedText.includes('account statement') ||
    combinedText.includes('opening balance') ||
    combinedText.includes('closing balance') ||
    combinedText.includes('available balance') ||
    combinedText.includes('ifsc code') ||
    combinedText.includes('hdfc bank') ||
    combinedText.includes('icici bank') ||
    combinedText.includes('state bank of india') ||
    combinedText.includes('axis bank') ||
    combinedText.includes('kotak mahindra') ||
    combinedText.includes('punjab national bank') ||
    combinedText.includes('canara bank') ||
    combinedText.includes('bank of baroda') ||
    (combinedText.includes('withdrawal') && combinedText.includes('deposit'))
  ) {
    // Match client from existingClients
    let matchedClient: Client | undefined = undefined;
    for (const c of existingClients) {
      const cName = c.tradeName.toLowerCase();
      const cLegal = (c.legalName || '').toLowerCase();
      if (
        (cName.length > 3 && combinedText.includes(cName)) ||
        (cLegal.length > 3 && combinedText.includes(cLegal)) ||
        (c.pan && combinedText.includes(c.pan.toLowerCase())) ||
        (c.gstin && combinedText.includes(c.gstin.toLowerCase()))
      ) {
        matchedClient = c;
        break;
      }
    }

    return {
      domain: 'DOCUMENT_VAULT',
      subType: 'BANK_STATEMENT',
      confidence: 95,
      title: 'Banking & Account Statement',
      summary: `Bank Statement detected for ${matchedClient ? matchedClient.tradeName : 'Client'}. Ready to archive in Document Vault.`,
      matchedClientId: matchedClient?.id,
      matchedClientName: matchedClient?.tradeName,
      vaultData: {
        documentTitle: `Bank Statement - ${file.name.replace(/\.[^/.]+$/, '')}`,
        category: 'Bank Statements'
      },
      suggestedAction: 'STORE_VAULT'
    };
  }

  // 2. Check if Document is a Sale / Purchase Voucher / Tax Invoice
  if (
    combinedText.includes('tax invoice') ||
    combinedText.includes('sales invoice') ||
    combinedText.includes('bill of supply') ||
    combinedText.includes('invoice no') ||
    combinedText.includes('purchase voucher') ||
    combinedText.includes('purchase bill') ||
    combinedText.includes('debit note') ||
    combinedText.includes('credit note') ||
    (combinedText.includes('place of supply') && combinedText.includes('hsn'))
  ) {
    const isPurchase = combinedText.includes('purchase') || combinedText.includes('vendor') || combinedText.includes('goods received');
    const subType: DocumentSubType = isPurchase ? 'PURCHASE_VOUCHER' : 'TAX_INVOICE';
    const category = isPurchase ? 'Purchase & Expense Vouchers' : 'Sales & Invoices';

    let matchedClient: Client | undefined = undefined;
    for (const c of existingClients) {
      if (
        combinedText.includes(c.tradeName.toLowerCase()) ||
        (c.pan && combinedText.includes(c.pan.toLowerCase())) ||
        (c.gstin && combinedText.includes(c.gstin.toLowerCase()))
      ) {
        matchedClient = c;
        break;
      }
    }

    return {
      domain: 'DOCUMENT_VAULT',
      subType,
      confidence: 92,
      title: isPurchase ? 'Purchase Voucher / Bill' : 'Tax / Sales Invoice',
      summary: `${isPurchase ? 'Purchase Voucher' : 'Tax Invoice'} detected. Ready to index in Document Vault under ${matchedClient ? matchedClient.tradeName : 'Client'}.`,
      matchedClientId: matchedClient?.id,
      matchedClientName: matchedClient?.tradeName,
      vaultData: {
        documentTitle: `${isPurchase ? 'Purchase Voucher' : 'Invoice'} - ${file.name.replace(/\.[^/.]+$/, '')}`,
        category
      },
      suggestedAction: 'STORE_VAULT'
    };
  }

  // 3. Check if Document is a Tax Notice / Scrutiny Demand
  if (
    combinedText.includes('drc-01') ||
    combinedText.includes('asmt-10') ||
    combinedText.includes('notice under section') ||
    combinedText.includes('scrutiny assessment') ||
    combinedText.includes('income tax notice')
  ) {
    let matchedClient: Client | undefined = undefined;
    for (const c of existingClients) {
      if (combinedText.includes(c.tradeName.toLowerCase()) || (c.pan && combinedText.includes(c.pan.toLowerCase()))) {
        matchedClient = c;
        break;
      }
    }

    return {
      domain: 'DOCUMENT_VAULT',
      subType: 'TAX_NOTICE',
      confidence: 94,
      title: 'Statutory Notice & Scrutiny Order',
      summary: `Tax Notice detected. Archiving in Document Vault under Notices & Litigation.`,
      matchedClientId: matchedClient?.id,
      matchedClientName: matchedClient?.tradeName,
      vaultData: {
        documentTitle: `Statutory Notice - ${file.name.replace(/\.[^/.]+$/, '')}`,
        category: 'Notices & Scrutiny'
      },
      suggestedAction: 'STORE_VAULT'
    };
  }

  // 4. Check if Document is a Staff Resume / Joining Document
  if (
    combinedText.includes('curriculum vitae') ||
    combinedText.includes('resume') ||
    combinedText.includes('articleship agreement') ||
    combinedText.includes('form 102') ||
    combinedText.includes('form 103')
  ) {
    return {
      domain: 'TEAM_DIRECTORY',
      subType: 'STAFF_PROFILE_PDF',
      confidence: 90,
      title: 'Staff / Candidate Profile Document',
      summary: 'Candidate / Staff profile detected. Ready to register in Team Directory.',
      teamData: [{
        name: clientData.contactPerson || file.name.replace(/\.[^/.]+$/, ''),
        designation: 'Staff Associate / Article Assistant',
        role: 'TEAM',
        phone: clientData.phone || '',
        email: clientData.email || '',
        pin: '1234'
      }],
      suggestedAction: 'IMPORT_TEAM'
    };
  }

  // 5. Default Domain: Client Master (GST Registration REG-06, PAN Card, Incorporation)
  let subType: DocumentSubType = 'GST_CERTIFICATE';
  if (combinedText.includes('income tax department') || combinedText.includes('permanent account number card')) {
    subType = 'PAN_CARD';
  } else if (combinedText.includes('certificate of incorporation') || combinedText.includes('registrar of companies')) {
    subType = 'INCORPORATION_CERTIFICATE';
  } else if (combinedText.includes('udyam registration') || combinedText.includes('msme')) {
    subType = 'MSME_CERTIFICATE';
  }

  // Check if client ALREADY EXISTS (DUPLICATE SAFETY CHECK)
  const normPan = clientData.pan?.toUpperCase().trim();
  const normGst = clientData.gstin?.toUpperCase().trim();
  const normTrade = clientData.tradeName?.toLowerCase().trim();

  let existingMatch: Client | undefined = undefined;

  for (const c of existingClients) {
    const cPan = c.pan?.toUpperCase().trim();
    const cGst = c.gstin?.toUpperCase().trim();
    const cTrade = c.tradeName.toLowerCase().trim();

    if (normPan && normPan.length === 10 && cPan === normPan) {
      existingMatch = c;
      break;
    }
    if (normGst && normGst.length === 15 && cGst === normGst) {
      existingMatch = c;
      break;
    }
    if (normTrade && normTrade.length > 3 && (cTrade === normTrade || cTrade.includes(normTrade) || normTrade.includes(cTrade))) {
      existingMatch = c;
      break;
    }
  }

  if (existingMatch) {
    return {
      domain: 'CLIENT_MASTER',
      subType,
      confidence: 98,
      title: `Update Client Profile: ${existingMatch.tradeName}`,
      summary: `Client already exists in database (${existingMatch.tradeName} | PAN: ${existingMatch.pan}). Details will be updated without creating any duplicate rows.`,
      isExistingClient: true,
      matchedClientId: existingMatch.id,
      matchedClientName: existingMatch.tradeName,
      clientData: {
        ...existingMatch,
        tradeName: clientData.tradeName || existingMatch.tradeName,
        legalName: clientData.legalName || existingMatch.legalName || existingMatch.tradeName,
        pan: clientData.pan || existingMatch.pan,
        gstin: clientData.gstin || existingMatch.gstin,
        category: clientData.category || existingMatch.category,
        contactPerson: clientData.contactPerson || existingMatch.contactPerson,
        phone: clientData.phone || existingMatch.phone,
        email: clientData.email || existingMatch.email,
        formationDate: clientData.formationDate || existingMatch.formationDate
      },
      suggestedAction: 'UPDATE_CLIENT'
    };
  }

  return {
    domain: 'CLIENT_MASTER',
    subType,
    confidence: 95,
    title: `New Client Profile: ${clientData.tradeName || file.name}`,
    summary: 'New client registration certificate detected. Ready to create master profile.',
    isExistingClient: false,
    clientData,
    suggestedAction: 'CREATE_CLIENT'
  };
};
