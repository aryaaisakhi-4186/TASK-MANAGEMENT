import { Client, TaskItem, ExtraWorkItem, UserProfile, ComplianceCategory, ClientCategory } from '../types';
import { detectEntityCategoryFromPANAndGSTIN } from './masterImportExport';

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

// 1. Accurate PDF Text Extractor using Server Endpoint (pdf-parse & Gemini OCR)
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

// 2. Intelligent GST / Tax Document Field Parser (STRICT ZERO-DUMMY DATA)
export const parseDocumentTextToClient = (rawText: string, fileName?: string): Partial<Client> => {
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

  // C. Extract TAN
  let tan: string | undefined = undefined;
  const tanMatch = text.match(/\bTAN\s*[:\-\n]*\s*([A-Z]{4}[0-9]{5}[A-Z])\b/i);
  if (tanMatch && tanMatch[1].toUpperCase() !== pan) {
    tan = tanMatch[1].toUpperCase();
  }

  // D. Extract Legal Name
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

  // E. Extract Trade Name
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

// 3. Autonomous Natural Language Processor with Backend AI & Rich Context
export const processAgenticCommand = async (
  prompt: string,
  contextData: {
    clients: Client[];
    tasks: TaskItem[];
    team: UserProfile[];
    extraWork: ExtraWorkItem[];
    currentUser?: UserProfile;
  }
): Promise<AgenticResponse> => {
  const q = prompt.trim();
  const lower = q.toLowerCase();

  // ==========================================
  // A. DIRECT ACTION RECOGNITION (COMMANDS)
  // ==========================================

  // 1. Action: Create New Client
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
      assignedTeamName: contextData.team[0]?.name || 'Assigned Partner',
      googleDriveFolderId: '',
      googleDriveFolderUrl: ''
    };

    return {
      replyText: `Naya Client Profile tayyar hai! Niche preview verify karke **"Confirm & Import"** karein:`,
      action: {
        type: 'PREVIEW_CLIENT',
        title: `Preview: ${clientData.tradeName}`,
        description: `PAN: ${clientData.pan || 'Pending'} • Type: ${clientData.category}`,
        data: clientData,
        executed: false
      }
    };
  }

  // 2. Action: Create New Compliance Task
  if (
    (lower.includes('task') || lower.includes('compliance') || lower.includes('gstr') || lower.includes('itr') || lower.includes('tds') || lower.includes('audit')) &&
    (lower.includes('create') || lower.includes('add') || lower.includes('banao') || lower.includes('jodo') || lower.includes('assign') || lower.includes('schedule'))
  ) {
    let targetClient = contextData.clients[0];
    for (const c of contextData.clients) {
      if (lower.includes(c.tradeName.toLowerCase()) || (c.pan && lower.includes(c.pan.toLowerCase()))) {
        targetClient = c;
        break;
      }
    }

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
        replyText: `Compliance Task schedule kar diya gaya hai!
• **Title:** ${newTaskData.title}
• **Client:** ${newTaskData.clientName}
• **Category:** ${newTaskData.category}
• **Due Date:** ${newTaskData.dueDate}
• **Status:** PENDING`,
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

  // 3. Action: Update Task Status to DONE / IN PROGRESS
  if (
    (lower.includes('complete') || lower.includes('done') || lower.includes('ho gaya') || lower.includes('khatam') || lower.includes('in progress') || lower.includes('shuru')) &&
    (lower.includes('task') || lower.includes('gst') || lower.includes('tds') || lower.includes('itr') || lower.includes('audit'))
  ) {
    let targetTask = contextData.tasks.find(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
    for (const t of contextData.tasks) {
      if (lower.includes(t.clientName.toLowerCase()) || lower.includes(t.title.toLowerCase())) {
        targetTask = t;
        break;
      }
    }

    const nextStatus = lower.includes('progress') || lower.includes('shuru') ? 'IN_PROGRESS' : 'DONE';

    if (targetTask) {
      return {
        replyText: `Task status update kar diya gaya hai!
• **Task:** ${targetTask.title}
• **Client:** ${targetTask.clientName}
• **New Status:** ${nextStatus}
• **Updated By:** ${contextData.currentUser?.name || 'Staff'}`,
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

  // 4. Action: Record Extra Work / Ad-hoc Billing
  if (lower.includes('extra work') || lower.includes('extra billing') || lower.includes('ad-hoc') || (lower.includes('record') && lower.includes('fee'))) {
    let targetClient = contextData.clients[0];
    for (const c of contextData.clients) {
      if (lower.includes(c.tradeName.toLowerCase())) {
        targetClient = c;
        break;
      }
    }

    if (targetClient) {
      const feeMatch = q.match(/(?:rs\.?|inr|₹|amount|fee)?\s*(\d{3,7})/i);
      const agreedFee = feeMatch ? parseInt(feeMatch[1], 10) : 15000;

      const extraWorkData: Partial<ExtraWorkItem> = {
        clientId: targetClient.id,
        clientName: targetClient.tradeName,
        taskTitle: 'Advisory & Scrutiny Notice Reply Working',
        category: 'GST & Scrutiny',
        agreedFee,
        advanceReceived: 0,
        balanceDue: agreedFee,
        status: 'PENDING',
        assignedTeamName: targetClient.assignedTeamName || '',
        createdDate: new Date().toISOString().split('T')[0],
        targetCompletionDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
      };

      return {
        replyText: `Financial Extra Work record kar diya gaya hai!
• **Client:** ${extraWorkData.clientName}
• **Assignment:** ${extraWorkData.taskTitle}
• **Agreed Fee:** ₹${extraWorkData.agreedFee?.toLocaleString('en-IN')}
• **Balance Due:** ₹${extraWorkData.balanceDue?.toLocaleString('en-IN')}`,
        action: {
          type: 'RECORD_EXTRA_WORK',
          title: `Extra Work Logged: ₹${extraWorkData.agreedFee?.toLocaleString('en-IN')}`,
          description: `${extraWorkData.taskTitle} for ${extraWorkData.clientName}`,
          data: extraWorkData,
          executed: false
        }
      };
    }
  }

  // 5. Action: Office Shift & Punch-in / Lunch Break
  if (lower.includes('login') || lower.includes('shift in') || lower.includes('punch in') || lower.includes('lunch') || lower.includes('log off') || lower.includes('logoff')) {
    let shiftAction = 'LOGIN';
    let shiftTitle = '🟢 Office Login (Shift IN)';
    if (lower.includes('lunch') && (lower.includes('start') || lower.includes('shuru') || lower.includes('on') || lower.includes('le raha'))) {
      shiftAction = 'LUNCH_START';
      shiftTitle = '🍽️ Lunch Break [ON]';
    } else if (lower.includes('lunch') && (lower.includes('end') || lower.includes('khatam') || lower.includes('off') || lower.includes('resume'))) {
      shiftAction = 'LUNCH_END';
      shiftTitle = '▶ Lunch Break [OFF]';
    } else if (lower.includes('log off') || lower.includes('logoff') || lower.includes('shift out')) {
      shiftAction = 'LOGOFF';
      shiftTitle = '🔴 Office Log-Off (Shift OUT)';
    }

    return {
      replyText: `Office shift action execute ho gaya hai: **${shiftTitle}**.`,
      action: {
        type: 'OFFICE_SHIFT',
        title: shiftTitle,
        description: `Recorded for ${contextData.currentUser?.name || 'Staff'}`,
        data: { action: shiftAction },
        executed: false
      }
    };
  }

  // ==========================================
  // B. INTELLIGENT AI REASONING VIA BACKEND
  // ==========================================
  try {
    const res = await fetch('/api/ai-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: q,
        appData: {
          clients: contextData.clients.map(c => ({
            tradeName: c.tradeName,
            legalName: c.legalName,
            pan: c.pan,
            gstin: c.gstin,
            category: c.category,
            contactPerson: c.contactPerson,
            phone: c.phone,
            email: c.email,
            assignedTeamName: c.assignedTeamName
          })),
          tasks: contextData.tasks.map(t => ({
            title: t.title,
            clientName: t.clientName,
            status: t.status,
            dueDate: t.dueDate,
            category: t.category
          })),
          team: contextData.team.map(m => ({
            name: m.name,
            role: m.role,
            designation: m.designation,
            phone: m.phone
          })),
          extraWork: contextData.extraWork.map(e => ({
            taskTitle: e.taskTitle,
            clientName: e.clientName,
            agreedFee: e.agreedFee,
            balanceDue: e.balanceDue,
            status: e.status
          }))
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.reply && data.reply.trim()) {
        return {
          replyText: data.reply.trim()
        };
      }
    }
  } catch (apiErr) {
    console.warn('Backend AI fetch failed, using local context engine:', apiErr);
  }

  // ==========================================
  // C. DYNAMIC LOCAL CONTEXT QUERY ENGINE
  // ==========================================
  
  // 1. Client Search / Inquiries
  for (const c of contextData.clients) {
    if (lower.includes(c.tradeName.toLowerCase()) || (c.pan && lower.includes(c.pan.toLowerCase()))) {
      return {
        replyText: `📋 **Client Profile: ${c.tradeName}**
• **Legal Name:** ${c.legalName || c.tradeName}
• **PAN Number:** ${c.pan || 'Not provided'}
• **GSTIN:** ${c.gstin || 'Unregistered / None'}
• **Constitution / Type:** ${c.category}
• **Contact Person:** ${c.contactPerson || 'Not provided'}
• **Mobile Phone:** ${c.phone || 'Not provided'}
• **Email Address:** ${c.email || 'Not provided'}
• **Assigned Staff:** ${c.assignedTeamName || 'Unassigned'}
• **Google Drive Sync:** ${c.googleDriveFolderId ? '🟢 Connected (' + c.googleDriveFolderId + ')' : '⚪ Not Linked'}`
      };
    }
  }

  // 2. Pending Task Lists
  if (lower.includes('pending') || lower.includes('baki') || lower.includes('due') || lower.includes('overdue')) {
    const pending = contextData.tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
    if (pending.length === 0) {
      return {
        replyText: '🎉 **Badhai ho!** Is samay koi bhi pending task baki nahi hai. Sabhi compliance filings complete hain!'
      };
    }

    const taskList = pending.slice(0, 5).map((t, idx) => 
      `${idx + 1}. **${t.clientName}** — ${t.title} (Due: ${t.dueDate || '20th'}, Status: ${t.status})`
    ).join('\n');

    return {
      replyText: `📋 **Total ${pending.length} Pending Compliance Tasks Hain:**\n\n${taskList}${pending.length > 5 ? `\n\n*(...aur ${pending.length - 5} aur tasks Task Matrix tab me moujood hain)*` : ''}`
    };
  }

  // 3. Capabilities question
  if (lower.includes('tum kya') || lower.includes('what can you do') || lower.includes('help') || lower.includes('kaam')) {
    return {
      replyText: `Main TASK-VAANI ka **Autonomous AI Assistant** hoon. Main aapke CA firm ke live data (${contextData.clients.length} Clients, ${contextData.tasks.length} Tasks, ${contextData.team.length} Staff) ke sath seamlessly integrated hoon:

1. **📄 PDF Client Import**: GST Certificate REG-06 ya PAN PDF upload karein — main live preview banaunga bina dummy data ke.
2. **✅ Task Scheduler & Status**: "Rakhi Agency ka GSTR-3B banao" ya "Task complete mark karo".
3. **💰 Extra Billing Tracker**: "Client X ka ₹15,000 ka extra ROC work log karo".
4. **⏱️ Office Shifts**: "Office login", "Lunch break start/end", "Shift out".
5. **🔍 Client & Task Lookups**: Kisi bhi client ka naam bolkar uska PAN, phone ya GSTIN check karein.
6. **⚖️ Statutory Tax Guidance**: Income Tax sections (194Q, 44AB, 206AB) aur GST rules par technical consultation lein.`
    };
  }

  return {
    replyText: `Aapke nirdesh "**${prompt}**" ke sambandh me:
• **Firm Overview:** Is samay ${contextData.clients.length} registered clients aur ${contextData.tasks.length} statutory tasks system me active hain.
• Aap mujhse kisi bhi client ka naam lekar unka record, pending return, ya koi bhi new task setup karwa sakte hain.`
  };
};
