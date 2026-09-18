import { Client, TaskItem, ExtraWorkItem, UserProfile, ComplianceCategory, ClientCategory } from '../types';
import { detectEntityCategoryFromPANAndGSTIN } from './masterImportExport';
import { callClientGeminiAI, AppContextData } from '../services/clientAIService';

export interface AgenticAction {
  type: 
    | 'PREVIEW_CLIENT'
    | 'CREATE_CLIENT' 
    | 'CREATE_TASK' 
    | 'UPDATE_TASK_STATUS' 
    | 'RECORD_EXTRA_WORK' 
    | 'OFFICE_SHIFT' 
    | 'CREATE_FOLDER' 
    | 'ADD_TEAM_MEMBER' 
    | 'SEND_REMINDER' 
    | 'INFO_SUMMARY';
  title: string;
  description: string;
  data: any;
  executed: boolean;
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
  const stopWords = new Set(['batao', 'dikhao', 'profile', 'details', 'poori', 'karo', 'hai', 'hain', 'status', 'kya', 'info', 'check', 'ka', 'ki', 'ke', 'aur', 'ko', 'par', 'se', 'the', 'for', 'about', 'show', 'give', 'me', 'please', 'sir', 'madam', 'search', 'find', 'view', 'full', 'all', 'information']);
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
    const clientCombined = `${tName} ${lName} ${contact} ${pan}`;
    let matchedTokenCount = 0;

    for (const token of qTokens) {
      if (tName.includes(token)) {
        score += 30;
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

    // Boost if multiple tokens matched (e.g. "shri ganesh charitable")
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

  // Action A: Create Client
  if (
    (lower.includes('create client') || lower.includes('add client') || lower.includes('naya client') || lower.includes('client banao') || lower.includes('client jodo')) &&
    !lower.includes('task')
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
        executed: false
      }
    };
  }

  // Action B: Create Compliance Task
  if (
    (lower.includes('task') || lower.includes('compliance') || lower.includes('gstr') || lower.includes('itr') || lower.includes('tds') || lower.includes('audit')) &&
    (lower.includes('create') || lower.includes('add') || lower.includes('banao') || lower.includes('jodo') || lower.includes('assign') || lower.includes('schedule'))
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

  // Action C: Update Task Status
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
          executed: false
        }
      };
    }
  }

  // Action D: Office Shift / Attendance
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
        executed: false
      }
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

  // A. Friendly Greetings & Small Talk
  if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'namaste' || lower === 'pranam' || lower.startsWith('hello ') || lower.startsWith('hi ')) {
    if (lower.includes('name') || lower.includes('naam') || lower.includes('who are you') || lower.includes('kaun ho')) {
      return {
        replyText: `Namaste! Mera naam **CA-CompliBot** hai. Main TASK-VAANI ka **AI Practice Manager aur Tax Assistant** hoon. Main aapke office ke clients, compliance tasks, GST/ITR filings, aur billing ko manage karne me madad karta hoon. Batayein, aaj kis kaam me help karu?`
      };
    }
    return {
      replyText: `Namaste! Main **CA-CompliBot** hoon. Kaise hain aap? Aaj office me kaunsa client ya compliance task dekhna hai?`
    };
  }

  // B. Identity, Name, and Role Inquiries
  if (lower.includes('what is your name') || lower.includes('naam kya hai') || lower.includes('who are you') || lower.includes('kaun ho tum') || lower.includes('koun ho')) {
    return {
      replyText: `Mera naam **CA-CompliBot** hai! Main aapka personal AI assistant aur practice manager hoon. 

Aap mujhse:
• Kisi bhi client ki details (PAN, GSTIN, Phone, Profile) puch sakte hain
• Naye task ya client create karwa sakte hain
• Income Tax, GST aur MCA statutory rules par advice le sakte hain
• Office login, lunch break aur attendance mark karwa sakte hain.`
    };
  }

  // C. How are you / Kaise ho
  if (lower.includes('kaise ho') || lower.includes('how are you') || lower.includes('kya haal hai') || lower.includes('sab theek')) {
    return {
      replyText: `Main bilkul badhiya hoon! Aapki firm ke sabhi records (${contextData.clients.length} Clients aur ${contextData.tasks.length} Compliance Tasks) up-to-date hain. Aap batayein, aaj kis client ka kaam process karein?`
    };
  }

  // D. Robust Client Profile & Information Lookup (Fuzzy Matched for ANY client)
  const clientMatch = findBestMatchingClient(q, contextData.clients);
  if (clientMatch) {
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

  // E. Capabilities / "Tum kya kya kar sakte ho"
  if (lower.includes('tum kya') || lower.includes('what can you do') || lower.includes('help me') || lower.includes('kya kaam') || lower.includes('capabilities')) {
    return {
      replyText: `Main aapki firm ke liye ek senior practice assistant ki tarah kaam karta hoon. Yahan kuch mukhya cheezein hain jo main kar sakta hoon:

1. **📄 GST & PAN PDF Reading**: GST Certificate (REG-06) ya PAN PDF upload karein — main bina kisi dummy data ke accurate trade name, PAN, GSTIN aur constitution extract kar dunga.
2. **✅ Task Scheduling & Updates**: "Apex Tools ka GSTR-3B task banao" ya "Rakhi Agency ka GST complete mark karo".
3. **🔍 Instant Client & Staff Lookups**: Kisi bhi client (e.g. "Shri Ganesh Charitable", "Rakhi Agency") ka naam bolkar unki poori profile, PAN, mobile number, ya pending tasks puchen.
4. **💰 Extra Billing Tracking**: "Client X ka ₹15,000 ka notice reply work add karo" — fees aur balance due track hoga.
5. **⏱️ Office Shifts & Lunch Timers**: "Office login", "Lunch break shuru", "Log off".
6. **⚖️ Statutory CA Guidance**: TDS under 194Q, 206AB, Section 44AB audit limits, aur DRC-01 notices par technical guidance.`
    };
  }

  // F. Pending Tasks Inquiries
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

  // G. Staff & Team Directory
  if (lower.includes('staff') || lower.includes('team') || lower.includes('member') || lower.includes('employee') || lower.includes('associates')) {
    if (contextData.team.length === 0) {
      return { replyText: 'Abhi system me koi team member add nahi hai. Aap Settings tab me jakar staff add kar sakte hain.' };
    }
    const staffSummary = contextData.team.map((m, i) => `${i + 1}. **${m.name}** (${m.designation || m.role}) ${m.phone ? `• 📞 ${m.phone}` : ''}`).join('\n');
    return {
      replyText: `Aapke office me ye **${contextData.team.length} team members** registered hain:\n\n${staffSummary}`
    };
  }

  // H. Billing & Balance Fees
  if (lower.includes('extra work') || lower.includes('billing') || lower.includes('fee') || lower.includes('balance') || lower.includes('fees') || lower.includes('paisa')) {
    if (contextData.extraWork.length === 0) {
      return { replyText: 'Abhi tak koi Extra Work ya Ad-hoc billing record nahi kiya gaya hai. Aap "Client X ka ₹15,000 ka extra work add karo" bolkar naya billing assignment create kar sakte hain.' };
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

  // I. Statutory Tax Knowledge (Income Tax 194Q, 206AB, 44AB, GST)
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

  // J. Thank you / Pleasantries
  if (lower.includes('thank') || lower.includes('dhanyawad') || lower.includes('shukriya') || lower.includes('great') || lower.includes('good job') || lower.includes('shabash')) {
    return {
      replyText: `Aapka bahut-bahut shukriya! 🙏 Main hamesha aapke office management aur tax compliances ke liye yahan moujood hoon. Kuch aur help chahiye ho to batayein!`
    };
  }

  // K. Default Conversational Response
  return {
    replyText: `Main aapki baat samajh gaya! Is samay aapki firm me **${contextData.clients.length} Clients** aur **${contextData.tasks.length} Compliance Tasks** active hain. 

Aap mujhse kisi bhi client (jaise "Shri Ganesh Charitable", "Rakhi Agency", "Apex Tools") ka naam bolkar unka profile aur pending tasks dekh sakte hain!`
  };
};
