import { extractDocumentDataDirectly, extractBinaryPdfText, parseRawTextToClientData } from '../services/documentOCRService';
import { Client, TaskItem, ExtraWorkItem, UserProfile, ComplianceCategory, ClientCategory, AIMemoryItem } from '../types';
import { StorageService } from '../services/storage';
import { detectEntityCategoryFromPANAndGSTIN } from './masterImportExport';
import { callClientGeminiAI, AppContextData } from '../services/clientAIService';

export interface AgenticAction {
  type: 
    | 'PREVIEW_CLIENT'
    | 'CREATE_CLIENT' 
    | 'UPDATE_CLIENT'
    | 'STORE_VAULT'
    | 'IMPORT_TEAM'
    | 'CREATE_TASK' 
    | 'UPDATE_TASK_STATUS' 
    | 'RECORD_EXTRA_WORK' 
    | 'OFFICE_SHIFT' 
    | 'CREATE_FOLDER' 
    | 'ADD_TEAM_MEMBER' 
    | 'SEND_REMINDER' 
    | 'LEARN_MEMORY'
    | 'INFO_SUMMARY';
  title: string;
  description: string;
  data: any;
  executed: boolean;
  targetTab?: string;
}

export interface AgenticResponse {
  replyText: string;
  action?: AgenticAction;
}

// Check PAN Format: 5 uppercase letters + 4 digits + 1 uppercase letter
export const isValidPAN = (pan?: string): boolean => {
  if (!pan) return false;
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase());
};

// Check GSTIN Format: 2 digits + 10-char PAN + 1 char + Z + 1 char
export const isValidGSTIN = (gstin?: string): boolean => {
  if (!gstin) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin.trim().toUpperCase());
};

// Accurate PDF Text Extractor using Server Endpoint (pdf-parse & Gemini OCR)
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

// Intelligent GST / Tax Document Field Parser
export const parseDocumentTextToClient = (rawText: string, fileName?: string): Partial<Client> => {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i);
  const gstin = gstinMatch ? gstinMatch[1].toUpperCase() : undefined;

  let pan: string | undefined = undefined;
  if (gstin && gstin.length === 15) {
    pan = gstin.substring(2, 12);
  } else {
    const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
    if (panMatch) pan = panMatch[1].toUpperCase();
  }

  let tan: string | undefined = undefined;
  const tanMatch = text.match(/\bTAN\s*[:\-\n]*\s*([A-Z]{4}[0-9]{5}[A-Z])\b/i);
  if (tanMatch && tanMatch[1].toUpperCase() !== pan) {
    tan = tanMatch[1].toUpperCase();
  }

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

  if (!tradeName && legalName) tradeName = legalName;
  if (!legalName && tradeName) legalName = tradeName;
  if (!tradeName && fileName) {
    const cleanFile = fileName.replace(/\.(pdf|png|jpg|jpeg|xlsx|csv)$/i, '').replace(/[_-]/g, ' ').trim();
    if (cleanFile.length > 3 && !cleanFile.toLowerCase().includes('scan') && !cleanFile.toLowerCase().includes('document')) {
      tradeName = cleanFile;
      legalName = cleanFile;
    }
  }

  const constMatch = text.match(/(?:3\.?\s*)?Constitution\s*of\s*Business[\s:\-\n]+([^\n]+)/i);
  const rawConst = constMatch ? constMatch[1] : '';
  const category: ClientCategory = detectEntityCategoryFromPANAndGSTIN(pan, gstin, tradeName, legalName, rawConst);

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

  const phoneMatch = text.match(/(?:\+91[\-\s]?)?([6-9]\d{9})/);
  const phone = phoneMatch ? `+91 ${phoneMatch[1]}` : '';

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

// Robust Fuzzy & Token Matcher to find any Client from natural query
export const findBestMatchingClient = (query: string, clients: Client[]): { client: Client; score: number } | null => {
  const qClean = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const stopWords = new Set([
    'batao', 'dikhao', 'profile', 'details', 'poori', 'karo', 'hai', 'hain', 'status', 'kya', 'info', 
    'check', 'ka', 'ki', 'ke', 'aur', 'ko', 'par', 'se', 'the', 'for', 'about', 'show', 'give', 
    'me', 'please', 'sir', 'madam', 'search', 'find', 'view', 'full', 'all', 'information',
    'extra', 'work', 'tracker', 'fee', 'total', 'payable', 'jod', 'do', 'add', 'provisional', 'balance', 'sheet'
  ]);
  const qTokens = qClean.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));

  if (qTokens.length === 0 && query.trim().length < 3) return null;

  let bestClient: Client | null = null;
  let highestScore = 0;

  for (const c of clients) {
    let score = 0;
    const tName = c.tradeName.toLowerCase();
    const lName = (c.legalName || '').toLowerCase();
    const pan = (c.pan || '').toLowerCase();
    const gstin = (c.gstin || '').toLowerCase();
    const contact = (c.contactPerson || '').toLowerCase();
    const phone = (c.phone || '').replace(/\D/g, '');

    // Full name direct containment
    if (query.toLowerCase().includes(tName) || (lName && query.toLowerCase().includes(lName))) {
      score += 150;
    }

    // Direct PAN / GSTIN match
    if (pan && pan.length === 10 && query.toLowerCase().includes(pan)) score += 120;
    if (gstin && gstin.length >= 10 && query.toLowerCase().includes(gstin)) score += 120;

    // Token matching
    let matchedTokenCount = 0;
    for (const token of qTokens) {
      if (tName.includes(token)) {
        score += 35;
        matchedTokenCount++;
      } else if (lName.includes(token)) {
        score += 25;
        matchedTokenCount++;
      } else if (contact.includes(token)) {
        score += 20;
        matchedTokenCount++;
      } else if (pan.includes(token)) {
        score += 35;
        matchedTokenCount++;
      } else if (token.length >= 4 && phone.includes(token)) {
        score += 40;
        matchedTokenCount++;
      }
    }

    // Boost if multiple tokens matched
    if (matchedTokenCount >= 2) {
      score += matchedTokenCount * 30;
    }

    if (score > highestScore) {
      highestScore = score;
      bestClient = c;
    }
  }

  return (bestClient && highestScore >= 20) ? { client: bestClient, score: highestScore } : null;
};

// 3. Human-like Conversational & Action NLP Processor
export const processAgenticCommand = async (
  prompt: string,
  contextData: AppContextData,
  chatHistory: Array<{ sender: 'user' | 'bot'; text: string }> = []
): Promise<AgenticResponse> => {
  const q = prompt.trim();
  const lower = q.toLowerCase();

  // =========================================================================
  // 1. DIRECT ACTION RECOGNITION (COMMANDS TO EXECUTE IN APP)
  // =========================================================================

  // Action A: Record Financial Extra Work / Ad-hoc Billing (e.g. "cloud wave ka extra work provisional balance sheet ki fee total 10000 payable jod do")
  if (
    (lower.includes('extra work') || lower.includes('extra billing') || lower.includes('ad-hoc') || lower.includes('provisional balance sheet') || lower.includes('balance sheet') || lower.includes('cma') || lower.includes('notice reply') || lower.includes('project report') || (lower.includes('fee') && (lower.includes('jod') || lower.includes('add') || lower.includes('record')))) &&
    (lower.includes('jod') || lower.includes('add') || lower.includes('record') || lower.includes('create') || lower.includes('banao') || lower.includes('payable') || lower.includes('tracker') || /\b\d{3,7}\b/.test(q))
  ) {
    const match = findBestMatchingClient(q, contextData.clients);
    const targetClient = match ? match.client : contextData.clients[0];

    if (targetClient) {
      // Extract Fee Amount
      const feeMatch = q.match(/(?:rs\.?|inr|₹|amount|fee|total|payable)?\s*(\d{3,7})/i);
      const agreedFee = feeMatch ? parseInt(feeMatch[1], 10) : 10000;

      // Extract / Infer Assignment Title
      let taskTitle = 'Advisory & Financial Consulting Working';
      let category = 'Advisory & ROC';

      if (lower.includes('provisional balance sheet')) {
        taskTitle = 'Provisional Balance Sheet & Financial Statements';
        category = 'Accounting & CMA';
      } else if (lower.includes('balance sheet')) {
        taskTitle = 'Balance Sheet & Final Accounts Preparation';
        category = 'Accounting & CMA';
      } else if (lower.includes('cma') || lower.includes('project report')) {
        taskTitle = 'Bank CMA Data & Loan Project Report';
        category = 'Banking & Finance';
      } else if (lower.includes('notice') || lower.includes('scrutiny')) {
        taskTitle = 'GST / Income Tax Scrutiny Notice Reply';
        category = 'Litigation & Notice';
      } else if (lower.includes('roc') || lower.includes('mca')) {
        taskTitle = 'MCA ROC Compliance & Filing Working';
        category = 'ROC & Corporate';
      }

      const extraWorkData: Partial<ExtraWorkItem> = {
        clientId: targetClient.id,
        clientName: targetClient.tradeName,
        taskTitle,
        category,
        agreedFee,
        advanceReceived: 0,
        balanceDue: agreedFee,
        status: 'PENDING',
        assignedTeamName: targetClient.assignedTeamName || contextData.team[0]?.name || 'Assigned Staff',
        createdDate: new Date().toISOString().split('T')[0],
        targetCompletionDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
      };

      return {
        replyText: `Maine **${extraWorkData.clientName}** ke liye **${extraWorkData.taskTitle}** ka extra work ₹${extraWorkData.agreedFee?.toLocaleString('en-IN')} fee ke sath **Extra Work Tracker** me add kar diya hai!

• **Client:** ${extraWorkData.clientName}
• **Assignment:** ${extraWorkData.taskTitle}
• **Total Agreed Fee:** ₹${extraWorkData.agreedFee?.toLocaleString('en-IN')}
• **Balance Payable:** ₹${extraWorkData.balanceDue?.toLocaleString('en-IN')}
• **Status:** PENDING`,
        action: {
          type: 'RECORD_EXTRA_WORK',
          title: `Extra Work Logged: ₹${extraWorkData.agreedFee?.toLocaleString('en-IN')}`,
          description: `${extraWorkData.taskTitle} for ${extraWorkData.clientName}`,
          data: extraWorkData,
          executed: false,
          targetTab: 'extra-work'
        }
      };
    }
  }

  // Action B: Create New Client
  if (
    (lower.includes('create client') || lower.includes('add client') || lower.includes('naya client') || lower.includes('client banao') || lower.includes('client jodo')) &&
    !lower.includes('task') && !lower.includes('extra work')
  ) {
    const panMatch = q.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
    const gstinMatch = q.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i);
    const pan = panMatch ? panMatch[1].toUpperCase() : (gstinMatch ? gstinMatch[1].substring(2, 12).toUpperCase() : undefined);
    const gstin = gstinMatch ? gstinMatch[1].toUpperCase() : undefined;

    let tradeName = q.replace(/(create|add|naya|new|client|banao|jodo|with|pan|gstin|having|for|ka|ki|ke)/gi, '').trim();
    if (panMatch) tradeName = tradeName.replace(panMatch[0], '').trim();
    if (gstinMatch) tradeName = tradeName.replace(gstinMatch[0], '').trim();

    if (!tradeName || tradeName.length < 3) {
      tradeName = pan ? `Client ${pan}` : 'New Client Enterprise';
    }

    const category = detectEntityCategoryFromPANAndGSTIN(pan, gstin, tradeName);

    const clientData: Partial<Client> = {
      tradeName,
      legalName: tradeName,
      pan: pan || '',
      gstin: gstin || undefined,
      category,
      status: 'ACTIVE',
      contactPerson: '',
      phone: '',
      email: '',
      formationDate: new Date().toISOString().split('T')[0],
      assignedTeamName: contextData.team[0]?.name || 'Assigned Staff',
      googleDriveFolderId: '',
      googleDriveFolderUrl: ''
    };

    return {
      replyText: `Main naye client **"${clientData.tradeName}"** ka profile bana raha hoon. Niche live preview check karke **"Confirm & Import"** par click karein:`,
      action: {
        type: 'PREVIEW_CLIENT',
        title: `Preview: ${clientData.tradeName}`,
        description: `PAN: ${clientData.pan || 'Pending'} • Type: ${clientData.category}`,
        data: clientData,
        executed: false,
        targetTab: 'clients'
      }
    };
  }

  // Action C: Create Compliance Task
  if (
    (lower.includes('task') || lower.includes('compliance') || lower.includes('gstr') || lower.includes('itr') || lower.includes('tds') || lower.includes('audit')) &&
    (lower.includes('create') || lower.includes('add') || lower.includes('banao') || lower.includes('jodo') || lower.includes('assign') || lower.includes('schedule')) &&
    !lower.includes('extra work')
  ) {
    const match = findBestMatchingClient(q, contextData.clients);
    const targetClient = match ? match.client : contextData.clients[0];

    if (targetClient) {
      let category: ComplianceCategory = 'GST';
      if (lower.includes('tds')) category = 'TDS';
      else if (lower.includes('itr') || lower.includes('income tax')) category = 'INCOME_TAX';
      else if (lower.includes('roc')) category = 'ROC';
      else if (lower.includes('audit')) category = 'AUDIT';

      let taskTitle = `${category} Filing & Compliance Working`;
      if (lower.includes('gstr-3b') || lower.includes('3b')) taskTitle = 'GSTR-3B Monthly Return Filing';
      else if (lower.includes('gstr-1') || lower.includes('gstr1')) taskTitle = 'GSTR-1 Sales Return Filing';
      else if (lower.includes('26q') || lower.includes('tds return')) taskTitle = 'TDS 26Q Quarterly Return Filing';
      else if (lower.includes('itr-6') || lower.includes('itr 6')) taskTitle = 'ITR-6 Corporate Income Tax Return';
      else if (lower.includes('itr-7') || lower.includes('trust')) taskTitle = 'ITR-7 Trust / Society Return';
      else if (lower.includes('tax audit') || lower.includes('44ab')) taskTitle = 'Tax Audit Report Form 3CA-3CD';

      const newTaskData: Partial<TaskItem> = {
        clientId: targetClient.id,
        clientName: targetClient.tradeName,
        title: taskTitle,
        category,
        frequency: 'MONTHLY',
        dueDayOrDate: '20th',
        dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
        priority: 'HIGH',
        assignedTeamName: targetClient.assignedTeamName || '',
        financialYear: '2025-26',
        status: 'PENDING'
      };

      return {
        replyText: `Maine **${newTaskData.clientName}** ke liye **${newTaskData.title}** task schedule kar diya hai (Due Date: ${newTaskData.dueDate}).`,
        action: {
          type: 'CREATE_TASK',
          title: `Task Added: ${newTaskData.title}`,
          description: `Assigned to ${newTaskData.clientName} (${newTaskData.category})`,
          data: newTaskData,
          executed: false
        }
      };
    }
  }

  // Action D: Update Task Status
  if (
    (lower.includes('complete') || lower.includes('done') || lower.includes('ho gaya') || lower.includes('khatam') || lower.includes('in progress') || lower.includes('shuru')) &&
    (lower.includes('task') || lower.includes('gst') || lower.includes('tds') || lower.includes('itr') || lower.includes('audit'))
  ) {
    const match = findBestMatchingClient(q, contextData.clients);
    let targetTask = match 
      ? contextData.tasks.find(t => (t.clientId === match.client.id || t.clientName.toLowerCase().includes(match.client.tradeName.toLowerCase())) && (t.status === 'PENDING' || t.status === 'IN_PROGRESS'))
      : contextData.tasks.find(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');

    if (!targetTask) {
      targetTask = contextData.tasks.find(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS') || contextData.tasks[0];
    }

    const nextStatus = lower.includes('progress') || lower.includes('shuru') ? 'IN_PROGRESS' : 'DONE';

    if (targetTask) {
      return {
        replyText: `Maine **${targetTask.clientName}** ka task "**${targetTask.title}**" ko **${nextStatus}** mark kar diya hai.`,
        action: {
          type: 'UPDATE_TASK_STATUS',
          title: `Task Updated to ${nextStatus}`,
          description: `${targetTask.title} (${targetTask.clientName})`,
          data: { taskId: targetTask.id, status: nextStatus, taskTitle: targetTask.title, clientName: targetTask.clientName },
          executed: false,
          targetTab: 'tasks'
        }
      };
    }
  }

  // Action E: Office Shift / Attendance
  if (lower.includes('login') || lower.includes('shift in') || lower.includes('punch in') || lower.includes('lunch') || lower.includes('log off') || lower.includes('logoff')) {
    let shiftAction = 'LOGIN';
    let shiftTitle = '🟢 Office Login (Shift IN)';
    let replyMsg = 'Aapki office entry (Shift IN) record kar li gayi hai. Have a productive day!';

    if (lower.includes('lunch') && (lower.includes('start') || lower.includes('shuru') || lower.includes('on') || lower.includes('le raha') || lower.includes('chala'))) {
      shiftAction = 'LUNCH_START';
      shiftTitle = '🍽️ Lunch Break [ON]';
      replyMsg = 'Aapka Lunch Break start ho gaya hai. 45-minute timer active hai!';
    } else if (lower.includes('lunch') && (lower.includes('end') || lower.includes('khatam') || lower.includes('off') || lower.includes('resume') || lower.includes('aagaya'))) {
      shiftAction = 'LUNCH_END';
      shiftTitle = '▶ Lunch Break [OFF]';
      replyMsg = 'Welcome back! Lunch Break complete mark kar diya gaya hai.';
    } else if (lower.includes('log off') || lower.includes('logoff') || lower.includes('shift out') || lower.includes('chhutti')) {
      shiftAction = 'LOGOFF';
      shiftTitle = '🔴 Office Log-Off (Shift OUT)';
      replyMsg = 'Office Shift OUT record ho gaya hai. Good evening!';
    }

    return {
      replyText: replyMsg,
      action: {
        type: 'OFFICE_SHIFT',
        title: shiftTitle,
        description: `Recorded for ${contextData.currentUser?.name || 'Staff'}`,
        data: { action: shiftAction },
        executed: false,
        targetTab: 'dashboard'
      }
    };
  }

  // =========================================================================
  // ACTION F: LEARN & REMEMBER RULES INTO LONG-TERM AI MEMORY
  // (e.g. "yaad rakhna CloudWave ka GST filing Amit karega", "meri firm me notice reply ki fee 5000 hoti hai")
  // =========================================================================
  if (
    lower.includes('yaad rakhna') || 
    lower.includes('yaad rakho') || 
    lower.includes('remember this') || 
    lower.includes('remember that') || 
    lower.includes('note kar lo') || 
    lower.includes('ye rule hai') || 
    lower.includes('meri firm ka rule') || 
    lower.includes('rule jod do') || 
    lower.includes('hamesha yaad') ||
    lower.includes('future ke liye') ||
    (lower.includes('rule') && lower.includes('yaad'))
  ) {
    let cleanRule = q
      .replace(/^(yaad rakhna|yaad rakho|remember this|remember that|note kar lo|ye rule hai|meri firm ka rule hai|rule jod do|hamesha yaad rakhna|future ke liye yaad rakhna)s*[:,-]?s*/i, '')
      .trim();

    if (!cleanRule || cleanRule.length < 3) cleanRule = q;

    let category: 'PREFERENCE' | 'CLIENT_RULE' | 'STAFF_RULE' | 'FEE_RULE' | 'GENERAL_NOTE' = 'GENERAL_NOTE';
    let topic = 'Firm Custom Rule';

    if (lower.includes('fee') || lower.includes('billing') || lower.includes('rupaye') || lower.includes('charge') || lower.includes('paisa')) {
      category = 'FEE_RULE';
      topic = 'Billing & Fees Policy';
    } else if (lower.includes('staff') || lower.includes('team') || lower.includes('employee') || lower.includes('assign') || lower.includes('karega') || lower.includes('karegi')) {
      category = 'STAFF_RULE';
      topic = 'Staff Allocation Rule';
    } else {
      const clientMatch = findBestMatchingClient(cleanRule, contextData.clients);
      if (clientMatch) {
        category = 'CLIENT_RULE';
        topic = `Client Rule: ${clientMatch.client.tradeName}`;
      } else {
        category = 'PREFERENCE';
        topic = 'Operational Preference';
      }
    }

    const memoryItem = StorageService.addLearnedMemoryItem({
      category,
      topic,
      content: cleanRule,
      source: 'USER_CHAT'
    });

    return {
      replyText: `Maine ye rule apni **Long-Term Memory** me permanently sikh kar save kar liya hai! 🧠✨\n\n` +
        `• **Topic:** ${topic}\n` +
        `• **Rule / Learned Instruction:** "${cleanRule}"\n` +
        `• **Category:** ${category}\n\n` +
        `Ab se main har future task creation, staff assignment, extra billing aur conversation me is rule ko 100% follow karunga!\n\nAap upar **🧠 AI Memory** button dabakar sabhi learned rules dekh ya edit kar sakte hain.`,
      action: {
        type: 'LEARN_MEMORY',
        title: `🧠 Rule Learned: ${topic}`,
        description: cleanRule,
        data: memoryItem,
        executed: true,
        targetTab: 'ai-bot'
      }
    };
  }

  // Inquiry: "kya yaad hai", "learned rules", "ai memory", "firm ke rules batao"
  if (
    lower.includes('kya yaad') || 
    lower.includes('rules kya') || 
    lower.includes('learned memory') || 
    lower.includes('firm ke rules') || 
    lower.includes('yaad hai kya') ||
    lower.includes('memory dikhao')
  ) {
    const memory = StorageService.getLearnedMemory();
    if (memory.length === 0) {
      return {
        replyText: 'Abhi tak koi custom rule ya memory save nahi hai. Aap mujhse "yaad rakhna CloudWave ka GST filing Amit karega" ya "notice reply ki minimum fee 5000 hogi" bolkar naye rules sikha sakte hain!'
      };
    }
    const memList = memory.map((m, i) => `${i + 1}. **[${m.topic}]**: ${m.content} *(Learned: ${m.learnedAt})*`).join('\n');
    return {
      replyText: `🧠 **Meri Long-Term Memory me ye ${memory.length} rules aur preferences saved hain:**\n\n${memList}\n\nMain in sabhi rules ko dhyan me rakhkar kaam karta hoon!`
    };
  }

  // =========================================================================
  // 2. CLIENT-SIDE GEMINI 3.7 FLASH DIRECT INVOCATION (For GitHub Pages & Web)
  // =========================================================================
  try {
    const directGeminiReply = await callClientGeminiAI(q, contextData, chatHistory);
    if (directGeminiReply) {
      return { replyText: directGeminiReply };
    }
  } catch (e) {
    console.warn('Direct client Gemini check note:', e);
  }

  // =========================================================================
  // 3. SERVER BACKEND /api/ai-assist INVOCATION (If running on localhost/server)
  // =========================================================================
  try {
    const res = await fetch('/api/ai-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: q,
        appData: {
          clients: contextData.clients,
          tasks: contextData.tasks,
          team: contextData.team,
          extraWork: contextData.extraWork
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.reply && data.reply.trim()) {
        return { replyText: data.reply.trim() };
      }
    }
  } catch {
    // Expected on static GitHub Pages
  }

  // =========================================================================
  // 4. NATURAL HUMAN CONVERSATIONAL NLP ENGINE (Instant, Contextual & Empathetic)
  // =========================================================================

  // A. Name, Identity & Introduction Queries (Handles all variations: "tumara name kya hai", "apka naam", "who are you", "tera name", etc.)
  const isNameOrIdentityInquiry = 
    ((lower.includes('name') || lower.includes('naam') || lower.includes('nam')) && (lower.includes('kya') || lower.includes('kaun') || lower.includes('koun') || lower.includes('kon') || lower.includes('batao') || lower.includes('bataye') || lower.includes('tell') || lower.includes('what'))) ||
    lower.includes('who are you') ||
    lower.includes('what is your name') ||
    lower.includes("what's your name") ||
    lower.includes('tum kaun ho') ||
    lower.includes('tum koun ho') ||
    lower.includes('tum kon ho') ||
    lower.includes('aap kaun ho') ||
    lower.includes('aap koun ho') ||
    lower.includes('aap kon ho') ||
    lower.includes('ap kaun ho') ||
    lower.includes('apna intro') ||
    lower.includes('apna parichay') ||
    lower.includes('apne bare me') ||
    lower.includes('apne baare me') ||
    lower.includes('tell me about yourself') ||
    lower.includes('introduce yourself') ||
    lower.includes('who created you') ||
    lower.includes('kisne banaya') ||
    lower.includes('kiski app hai');

  if (isNameOrIdentityInquiry) {
    return {
      replyText: `Namaste! Mera naam **TASK-VAANI Agentic AI Assistant** hai. 🤖✨

Main is app ka dedicated **AI Practice Manager aur Statutory CA Assistant** hoon.

**Main aapke liye kya-kya kar sakta hoon:**
• 📄 **GST / PAN / Bank Statement Reader**: PDF ya Excel upload karte hi trade name, GSTIN, PAN aur bank transactions extract karke sahi Document Vault me save karta hoon (bina kisi duplicate client ke).
• 📋 **Statutory Task Matrix**: GSTR-3B, GSTR-1, PMT-06, TDS 24Q/26Q, Income Tax Return aur ROC tasks create aur track karta hoon.
• 💰 **Ad-hoc Extra Billing**: "Client X ka provisional balance sheet fee ₹10,000 jod do" bolne par instantly Extra Work Tracker me add karta hoon.
• ⏱️ **Office Shifts & Timers**: Office login, lunch break on/off, aur log-off manage karta hoon.
• 🔍 **Client & Team Lookups**: Kisi bhi client ka naam bolkar unka PAN, GSTIN, mobile ya pending tasks dekh sakte hain.
• 🧠 **Long-Term Memory**: Aap mujhse jo bhi naye rules ya practice policy sikhaate hain, main unhe permanent memory me yaad rakhta hoon!

Batayein, aaj kis client ya compliance task me aapki madad karu?`
    };
  }

  // B. What is TASK-VAANI / App Overview Queries (e.g. "task vaani kya hai", "ye app kya kaam karti hai")
  if (
    lower.includes('task vaani kya') || 
    lower.includes('taskvaani kya') || 
    lower.includes('app kya hai') || 
    lower.includes('ye app kya') || 
    lower.includes('kya software hai') ||
    lower.includes('software ke bare me') ||
    lower.includes('about task vaani') ||
    lower.includes('about this app')
  ) {
    return {
      replyText: `**TASK-VAANI — Statutory Compliance Hub** Chartered Accountants, Tax Practitioners, aur Compliance Professionals ke liye banaya gaya ek complete Operating System hai.

**Iske 5 Mukhya Features:**
1. 📊 **Compliance Matrix**: GST, TDS, Income Tax, ROC aur Audit ke monthly/annual statutory due dates ka live real-time dashboard.
2. 🤖 **Autonomous Agentic AI**: PDF/Excel reading, OCR data extraction, auto task creation, aur Hindi/English conversational support.
3. 📁 **Universal Document Vault**: Client-indexed Google Drive cloud storage jisme Bank Statements, Invoices, aur Scrutiny Notices (DRC-01, ASMT-10) auto-index hote hain.
4. 👥 **Staff Management & Shifts**: Office Shift Login, 10:30 AM Statutory Chime, Lunch Break push timers, aur biometric punch logs.
5. 💰 **Extra Billing Tracker**: Client-wise ad-hoc project reports, CMA data, aur advisory fees ka balance tracking.

Aap upar diye gaye tabs me se kisi bhi section ko explore kar sakte hain!`
    };
  }

  // C. Document Vault, Bank Statements, PDF, Drive Storage, File Upload Inquiries
  if (
    lower.includes('bank statement') ||
    lower.includes('statement') ||
    lower.includes('document vault') ||
    lower.includes('vault') ||
    (lower.includes('pdf') && (lower.includes('save') || lower.includes('read') || lower.includes('padh') || lower.includes('upload') || lower.includes('du') || lower.includes('den') || lower.includes('rakh') || lower.includes('store'))) ||
    lower.includes('save kar loge') ||
    lower.includes('save karoge') ||
    lower.includes('save kar sakte') ||
    lower.includes('drive me save') ||
    lower.includes('cloud me save') ||
    lower.includes('folder me save') ||
    (lower.includes('document') && (lower.includes('save') || lower.includes('upload') || lower.includes('kaha') || lower.includes('kaise')))
  ) {
    const clientMatch = findBestMatchingClient(q, contextData.clients);
    const clientNameStr = clientMatch ? `**${clientMatch.client.tradeName}**` : 'sahi client';

    return {
      replyText: `Haan, bilkul! Main aapke diye gaye documents ko accurately read karke ${clientNameStr} ke **Document Vault** me store kar sakta hoon. 📂✨\n\n` +
        `**Kaise kaam karta hai:**\n` +
        `1. **📎 PDF / Statement Upload karein**: Niche **📎 Paperclip** icon ya upar **"Read GST / PAN PDF"** button par click karke Bank Statement, GST Certificate (REG-06), PAN Card ya Tax Invoice attach karein.\n` +
        `2. **🔍 Automatic Client & Data Extraction**: Main document se Trade Name, PAN, GSTIN aur details instantly extract karke screen par **Live Preview** dikhaunga.\n` +
        `3. **📁 Sahi Client ke Vault me Save**: Jab aap **"Confirm & Import"** karenge, to document ${clientNameStr} ke **Document Vault** aur unke linked **Google Drive Folder** me bina kisi duplicate row ke 100% safely save ho jayega.\n` +
        `4. **☁️ Zero Local Storage**: Sabhi files direct Google Drive cloud par archive hoti hain, jisse aapke device ka space 0% use hota hai!\n\n` +
        `Aap abhi paperclip (📎) icon daba kar file attach karke test kar sakte hain!`
    };
  }

  // D. Friendly Greetings & Small Talk (Hi, Hello, Namaste, Pranam, etc.)
  if (
    lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'namaste' || lower === 'pranam' || 
    lower === 'namaskar' || lower === 'satsriakal' || lower === 'good morning' || lower === 'good afternoon' || 
    lower === 'good evening' || lower.startsWith('hello ') || lower.startsWith('hi ') || lower.startsWith('hey ') ||
    lower.startsWith('namaste ')
  ) {
    return {
      replyText: `Namaste! Main **TASK-VAANI Agentic AI Assistant** hoon. Kaise hain aap?

Aap mujhse koi bhi compliance task create karwa sakte hain, client profile dekh sakte hain, ya Bank Statement / GST PDF attach karke Document Vault me save karwa sakte hain.

Aaj office me kis client ka kaam dekhna hai?`
    };
  }

  // E. How are you / Kaise ho / Kya haal hai
  if (
    lower.includes('kaise ho') || 
    lower.includes('how are you') || 
    lower.includes('kya haal') || 
    lower.includes('kya hal') || 
    lower.includes('sab theek') || 
    lower.includes('kaisa chal raha')
  ) {
    return {
      replyText: `Main bilkul badhiya aur active hoon! 🙏

Aapki firm ke records real-time sync hain:
• **Clients in Master:** ${contextData.clients.length} Clients
• **Active Compliance Tasks:** ${contextData.tasks.length} Tasks
• **Staff Associates:** ${contextData.team.length} Members
• **Extra Billing Assignments:** ${contextData.extraWork.length} Items

Batayein, aaj kaunsa task process karein?`
    };
  }

  // F. Capabilities / "Tum kya kya kar sakte ho" / "Can you do..."
  if (
    lower.includes('tum kya') || 
    lower.includes('what can you do') || 
    lower.includes('help me') || 
    lower.includes('kya kaam') || 
    lower.includes('capabilities') || 
    lower.includes('kya kar sakte') || 
    lower.includes('kar sakte ho') || 
    lower.includes('kar loge') ||
    lower.includes('madad kar sakte')
  ) {
    return {
      replyText: `Main aapki firm ke liye ek senior practice manager aur tax assistant ki tarah kaam karta hoon:

1. **📄 Universal Document & OCR Reader**: GST Certificate (REG-06), PAN Card, Bank Statement ya Invoice upload karein — main accurate data extract karke Document Vault me sahi folder me save karta hoon (Duplicate-Safe).
2. **💰 Extra Billing & Ad-hoc Work**: "CloudWave ka provisional balance sheet fee ₹15,000 jod do" bolkar extra billing add karein.
3. **✅ Task Scheduling & Done Updates**: "Apex Tools ka GSTR-3B task banao" ya "Bharat Logistics ka GST done mark karo".
4. **🔍 Instant Client Profile Lookups**: Kisi bhi client ka naam bolkar unka PAN, GSTIN, mobile, address ya pending task list dekhein.
5. **⏱️ Office Shift & Lunch Break**: "Office login karo", "Lunch break start karo", "Log off karo".
6. **🧠 Continuous Rule Learning**: "Yaad rakhna..." bolkar firm ke custom rules aur policies sikhayein.`
    };
  }

  // G. Guidance / How to do X in App (e.g. "client kaise banaye", "excel kaise upload kare")
  if (
    (lower.includes('kaise') || lower.includes('how to') || lower.includes('kaha se')) &&
    (lower.includes('client') || lower.includes('task') || lower.includes('excel') || lower.includes('pdf') || lower.includes('vault') || lower.includes('team') || lower.includes('shift'))
  ) {
    if (lower.includes('client')) {
      return {
        replyText: `**Client add karne ke 3 aasan tarike hain:**
1. **📄 PDF se Auto-Setup**: GST REG-06 ya PAN card ka PDF niche paperclip (📎) se attach karein. AI sabhi details extract karke live preview dikhayega aur 1-click me save karega.
2. **🌐 Google Sheet / Excel**: **Client Master** tab me jakar **"Import Clients"** button dabayein aur apni Google Sheet link paste karein ya Excel file drop karein.
3. **💬 AI Prompt se**: Chat me likhein *"Naya client XYZ Traders PAN ABCDE1234F jod do"*.`
      };
    }
    if (lower.includes('task')) {
      return {
        replyText: `**Compliance Task banane ke 2 aasan tarike:**
1. **💬 AI se bole**: Chat me likhein *"Apex Tools ka GSTR-3B task banao priority high"* ya *"Client X ka TDS 24Q task add karo"*.
2. **📋 Compliance Matrix Tab**: **Compliance Matrix** tab me jakar **"+ New Compliance Task"** button click karein.`
      };
    }
    if (lower.includes('excel') || lower.includes('pdf')) {
      return {
        replyText: `**Excel / PDF Upload karne ke tarike:**
• **Direct AI Chat**: Niche paperclip (📎) icon click karke multiple PDFs / Excel files ek sath attach karein. AI auto-detect karke Client Master, Team Directory, ya Document Vault me route kar dega.
• **Client Master Tab**: "Import Clients" button se Google Sheet / Excel import karein.
• **Staff Directory Tab**: "Import Team" button se staff list import karein.`
      };
    }
  }

  // H. Client Profile Lookup
  const isProfileInquiry = lower.includes('profile') || lower.includes('detail') || lower.includes('phone') || lower.includes('number') || lower.includes('pan') || lower.includes('gstin') || lower.includes('address') || lower.includes('contact') || lower.includes('koun hai') || lower.includes('kya hai') || lower.includes('batao') || lower.includes('dikhao') || lower.includes('check');
  const clientMatch = findBestMatchingClient(q, contextData.clients);

  if (clientMatch && isProfileInquiry) {
    const c = clientMatch.client;
    const clientTasks = contextData.tasks.filter(t => t.clientId === c.id || (t.clientName && t.clientName.toLowerCase().includes(c.tradeName.toLowerCase())));
    const clientPending = clientTasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
    const clientExtra = contextData.extraWork.filter(e => e.clientId === c.id || (e.clientName && e.clientName.toLowerCase().includes(c.tradeName.toLowerCase())));

    let taskSummaryText = '';
    if (clientTasks.length > 0) {
      taskSummaryText = `\n\n📋 **Compliance Tasks (${clientTasks.length} Total | ${clientPending.length} Pending):**\n` + 
        clientTasks.map((t, i) => `  ${i + 1}. [${t.status}] ${t.title} *(Due: ${t.dueDate || '20th'})*`).join('\n');
    } else {
      taskSummaryText = `\n\n📋 **Compliance Tasks:** Filhal koi task schedule nahi hai.`;
    }

    let extraWorkText = '';
    if (clientExtra.length > 0) {
      extraWorkText = `\n\n💰 **Ad-hoc Extra Work:**\n` +
        clientExtra.map(e => `  • ${e.taskTitle} (Agreed: ₹${e.agreedFee}, Balance: ₹${e.balanceDue})`).join('\n');
    }

    return {
      replyText: `🏢 **Client Profile: ${c.tradeName}**
• **Legal Registered Name:** ${c.legalName || c.tradeName}
• **Constitution / Entity Type:** ${c.category}
• **PAN Number:** ${c.pan || 'Not provided'}
• **GSTIN Number:** ${c.gstin || 'Unregistered / None'}
• **TAN Number:** ${c.tan || 'None'}
• **Authorized Contact Person:** ${c.contactPerson || 'Not provided'}
• **Mobile / Phone:** ${c.phone ? `📞 ${c.phone}` : 'Not provided'}
• **Email Address:** ${c.email || 'Not provided'}
• **Date of Formation / Liability:** ${c.formationDate || 'Not specified'}
• **Assigned Staff / Partner:** ${c.assignedTeamName || 'Unassigned'}
• **Google Drive Cloud Vault:** ${c.googleDriveFolderId ? `🟢 Linked (${c.googleDriveFolderId})` : '⚪ Not Connected'}${taskSummaryText}${extraWorkText}

Kya aap inka koi naya compliance task schedule karna chahte hain ya details update karna chahte hain?`
    };
  }

  // I. Pending Tasks Inquiries
  if (lower.includes('pending') || lower.includes('baki') || lower.includes('due') || lower.includes('overdue') || (lower.includes('task') && (lower.includes('dikhao') || lower.includes('batao') || lower.includes('list')))) {
    let pending = contextData.tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');

    if (lower.includes('gst') || lower.includes('3b') || lower.includes('gstr')) {
      pending = pending.filter(t => t.category === 'GST' || t.title.toLowerCase().includes('gst'));
    } else if (lower.includes('tds')) {
      pending = pending.filter(t => t.category === 'TDS' || t.title.toLowerCase().includes('tds'));
    } else if (lower.includes('itr') || lower.includes('income tax')) {
      pending = pending.filter(t => t.category === 'INCOME_TAX' || t.title.toLowerCase().includes('itr'));
    }

    if (pending.length === 0) {
      return {
        replyText: `🎉 Badhai ho! Is category me is samay koi bhi pending task nahi hai. Sabhi filings up-to-date hain!`
      };
    }

    const taskItems = pending.slice(0, 6).map((t, i) => `${i + 1}. **${t.clientName}** — ${t.title} *(Due: ${t.dueDate || '20th'}, Status: ${t.status})*`).join('\n');

    return {
      replyText: `Filhal total **${pending.length} tasks** pending hain:\n\n${taskItems}${pending.length > 6 ? `\n\n*(...aur ${pending.length - 6} tasks Task Matrix me list hain)*` : ''}`
    };
  }

  // J. Staff & Team Directory
  if (lower.includes('staff') || lower.includes('team') || lower.includes('member') || lower.includes('employee') || lower.includes('associates')) {
    if (contextData.team.length === 0) {
      return { replyText: 'Abhi system me koi team member add nahi hai. Aap Staff Directory tab me jakar staff add kar sakte hain.' };
    }
    const staffSummary = contextData.team.map((m, i) => `${i + 1}. **${m.name}** (${m.designation || m.role}) ${m.phone ? `• 📞 ${m.phone}` : ''}`).join('\n');
    return {
      replyText: `Aapke office me ye **${contextData.team.length} team members** registered hain:\n\n${staffSummary}`
    };
  }

  // K. Billing & Balance Fees
  if (lower.includes('extra work') || lower.includes('billing') || lower.includes('fee') || lower.includes('balance') || lower.includes('fees') || lower.includes('paisa')) {
    if (contextData.extraWork.length === 0) {
      return { replyText: 'Abhi tak koi Extra Work ya Ad-hoc billing record nahi kiya gaya hai. Aap "CloudWave ka extra work provisional balance sheet fee ₹10,000 jod do" bolkar naya billing assignment create kar sakte hain.' };
    }
    const totalAgreed = contextData.extraWork.reduce((s, e) => s + (e.agreedFee || 0), 0);
    const totalBal = contextData.extraWork.reduce((s, e) => s + (e.balanceDue || 0), 0);
    return {
      replyText: `💰 **Financial Extra Billing Summary:**
• Total Assignments: **${contextData.extraWork.length}**
• Total Agreed Fees: **₹${totalAgreed.toLocaleString('en-IN')}**
• Total Pending Balance Due: **₹${totalBal.toLocaleString('en-IN')}**

Aap Extra Work Tracker tab me jakar client-wise invoice dekh sakte hain.`
    };
  }

  // L. Statutory Tax Knowledge (Income Tax 194Q, 206AB, 44AB, GST)
  if (lower.includes('194q') || lower.includes('206c') || lower.includes('44ab') || lower.includes('44ad') || lower.includes('115bac') || lower.includes('drc-01') || lower.includes('itc')) {
    if (lower.includes('194q')) {
      return {
        replyText: `⚖️ **Section 194Q (TDS on Purchase of Goods):**
• **Applicability:** Agar buyer ka turnover pichhle financial year me **₹10 Crore** se zyada tha.
• **Threshold:** Current FY me kisi resident seller se goods purchase value **₹50 Lakh** cross kare.
• **TDS Rate:** **0.1%** (₹50 Lakh se upar wale amount par). Agar seller PAN na de to 5% under Sec 206AA.
• **Note:** 194Q lagne par Section 206C(1H) TCS nahi lagta.`
      };
    }
    if (lower.includes('44ab')) {
      return {
        replyText: `⚖️ **Section 44AB (Tax Audit Limits for AY 2026-27):**
• **Business (Normal):** ₹1 Crore turnover.
• **Business (Digital Receipts & Payments >= 95%):** **₹10 Crore** limit.
• **Professionals:** ₹50 Lakh (Presumptive 44ADA me ₹75 Lakh if 95%+ digital).
• **Due Date:** 30th September of the Assessment Year.`
      };
    }
  }

  // M. Thank you / Pleasantries
  if (lower.includes('thank') || lower.includes('dhanyawad') || lower.includes('shukriya') || lower.includes('great') || lower.includes('good job') || lower.includes('shabash')) {
    return {
      replyText: `Aapka bahut-bahut shukriya! 🙏 Main hamesha aapke office management aur tax compliances ke liye yahan moujood hoon. Kuch aur help chahiye ho to batayein!`
    };
  }

  // N. Smart Human-like Contextual Fallback
  return {
    replyText: `Main aapki baat samajh raha hoon!

Aapne poocha: *"${q}"*

Main **TASK-VAANI Agentic AI** hoon. Main aapke natural prompts par direct app ke andar action leta hoon:
• 📄 **GST/PAN PDF ya Bank Statement**: Niche 📎 se attach karein, main verify karke Document Vault me save kar dunga.
• 📋 **Task Schedule**: "Apex Tools ka GSTR-3B task banao" ya "GST complete mark karo".
• 💰 **Extra Billing**: "Client X ka balance sheet fee ₹10,000 jod do".
• 🔍 **Client Info**: Kisi bhi client ka naam bolkar unka PAN, GSTIN ya pending tasks dekhein.

Kripya batayein aapko kaunsa specific client ya task execute karwana hai?`
  };
};