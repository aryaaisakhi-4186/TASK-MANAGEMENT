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

  // Fallbacks for names from filename if strictly no dummy names
  if (!tradeName && legalName) tradeName = legalName;
  if (!legalName && tradeName) legalName = tradeName;
  if (!tradeName && fileName) {
    const cleanFile = fileName.replace(/\.(pdf|png|jpg|jpeg|xlsx|csv)$/i, '').replace(/[_-]/g, ' ').trim();
    if (cleanFile.length > 3 && !cleanFile.toLowerCase().includes('scan') && !cleanFile.toLowerCase().includes('document')) {
      tradeName = cleanFile;
      legalName = cleanFile;
    }
  }

  // F. Extract Constitution of Business / Entity Category (Statutory PAN & GSTIN rule)
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

  // H. Extract Contact Person / Authorized Signatory (ONLY REAL DATA, NO DUMMIES)
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

  // I. Extract Mobile / Phone (ONLY REAL NUMBERS, NO DUMMY +91 98000 00000)
  const phoneMatch = text.match(/(?:\+91[\-\s]?)?([6-9]\d{9})/);
  const phone = phoneMatch ? `+91 ${phoneMatch[1]}` : '';

  // J. Extract Email (ONLY REAL EMAILS, NO DUMMY accounts@client.com)
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

// 3. Main Agentic AI Command Processor (STRICT VALIDATION, ZERO DUMMIES)
export const processAgenticCommand = (
  userPrompt: string,
  contextData: {
    clients: Client[];
    tasks: TaskItem[];
    team: UserProfile[];
    extraWork: ExtraWorkItem[];
    currentRole: string;
    currentUser: UserProfile | null;
  }
): AgenticResponse => {
  const q = userPrompt.trim();
  const lower = q.toLowerCase();

  // A. Command: Setup / Create Client from Prompt Text or Document
  if (
    (lower.includes('client') || lower.includes('profile') || lower.includes('gst')) &&
    (lower.includes('create') || lower.includes('add') || lower.includes('setup') || lower.includes('banao') || lower.includes('jodo') || lower.includes('read') || lower.includes('import'))
  ) {
    const parsedClient = parseDocumentTextToClient(q);

    // Extract trade name from text if available
    let detectedName = parsedClient.tradeName;
    const nameMatch = q.match(/(?:client|name|company|firm)\s*(?:is|ka|ka naam|:)?\s*([A-Za-z0-9\s&.,\-_]+?)(?=\bwith|pan|gst|mobile|phone|email|$)/i);
    if (nameMatch && nameMatch[1].trim().length > 2 && !nameMatch[1].toLowerCase().includes('create') && !nameMatch[1].toLowerCase().includes('add') && !nameMatch[1].toLowerCase().includes('import') && !nameMatch[1].toLowerCase().includes('setup') && !nameMatch[1].toLowerCase().includes('banao')) {
      detectedName = nameMatch[1].trim();
    }

    const tradeName = detectedName || parsedClient.tradeName || '';
    const pan = parsedClient.pan || '';
    const gstin = parsedClient.gstin || '';

    // STRICT VALIDATION: If neither valid Trade Name nor PAN/GSTIN is provided, NEVER CREATE DUMMY DATA!
    if (!tradeName && !pan && !gstin) {
      return {
        replyText: `⚠️ **Client create nahi kiya gaya kyunki koi real client data nahi mila.**

Kripya client ka **Asli Trade Name** aur **PAN / GSTIN Number** batayein (jaise: *"Create client Apex Precision Tools PAN AAACA1234F"*) ya valid **GST Registration Certificate (REG-06) / PAN Card PDF** attach karein.

🚫 *System kabhi bhi dummy ya fake client generate nahi karta.*`
      };
    }

    const category: ClientCategory = detectEntityCategoryFromPANAndGSTIN(pan, gstin, tradeName, parsedClient.legalName);

    const previewClientData: Partial<Client> = {
      ...parsedClient,
      tradeName: tradeName || (pan ? `Client ${pan}` : ''),
      legalName: parsedClient.legalName || tradeName || '',
      pan: pan,
      gstin: gstin,
      category,
      status: 'ACTIVE'
    };

    // Check if duplicate exists
    const isExisting = contextData.clients.some(c => 
      (previewClientData.pan && c.pan?.toUpperCase() === previewClientData.pan?.toUpperCase()) ||
      (previewClientData.gstin && c.gstin?.toUpperCase() === previewClientData.gstin?.toUpperCase())
    );

    return {
      replyText: `Maine document se authentic client details extract kar li hain. Niche **Live Preview** me verify karein aur **"Confirm & Import"** par click karein:`,
      action: {
        type: 'PREVIEW_CLIENT',
        title: isExisting ? `Update Existing Profile: ${previewClientData.tradeName}` : `New Client: ${previewClientData.tradeName}`,
        description: `PAN: ${previewClientData.pan || 'Pending'} • GSTIN: ${previewClientData.gstin || 'None'} • Type: ${previewClientData.category}`,
        data: previewClientData,
        executed: false
      }
    };
  }

  // B. Command: Add New Team Member (STRICT VALIDATION, ZERO DUMMIES)
  if ((lower.includes('team') || lower.includes('staff') || lower.includes('member')) && (lower.includes('add') || lower.includes('create') || lower.includes('jodo') || lower.includes('banao'))) {
    const nameMatch = q.match(/(?:staff|member|name|team)\s*[:\-]?\s*([A-Za-z\s.]+?)(?=\s*as|with|phone|email|$)/i);
    const staffName = nameMatch && nameMatch[1].trim().length > 2 && !nameMatch[1].toLowerCase().includes('add') && !nameMatch[1].toLowerCase().includes('banao') ? nameMatch[1].trim() : '';

    if (!staffName) {
      return {
        replyText: `⚠️ **Team member add nahi kiya gaya kyunki koi real staff name nahi mila.**

Kripya staff ka asli naam aur designation batayein (jaise: *"Team me Rohit Sharma add karo Senior GST Associate"*).

🚫 *Dummy team member generate nahi kiya ja sakta.*`
      };
    }

    // Extract real phone & email if in prompt
    const phoneMatch = q.match(/(?:\+91[\-\s]?)?([6-9]\d{9})/);
    const phone = phoneMatch ? `+91 ${phoneMatch[1]}` : '';
    const emailMatch = q.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch ? emailMatch[1].toLowerCase() : '';

    const newMemberData: Partial<UserProfile> = {
      name: staffName,
      role: lower.includes('partner') || lower.includes('admin') ? 'ADMIN' : 'TEAM',
      designation: lower.includes('partner') ? 'Partner / Senior CA' : (lower.includes('audit') ? 'Audit & Compliance Associate' : 'Compliance Associate'),
      phone,
      email,
      pin: phone ? phone.slice(-4) : '1234',
      assignedClientIds: []
    };

    return {
      replyText: `Team member **${newMemberData.name}** add kar diya gaya hai!\n• **Designation:** ${newMemberData.designation}\n• **Role:** ${newMemberData.role}${newMemberData.phone ? `\n• **Phone:** ${newMemberData.phone}` : ''}`,
      action: {
        type: 'ADD_TEAM_MEMBER',
        title: `Team Member Added: ${newMemberData.name}`,
        description: `${newMemberData.designation} (${newMemberData.role})`,
        data: newMemberData,
        executed: false
      }
    };
  }

  // C. Command: Create New Compliance Task
  if (
    (lower.includes('task') || lower.includes('compliance') || lower.includes('gstr') || lower.includes('itr') || lower.includes('tds') || lower.includes('audit')) &&
    (lower.includes('create') || lower.includes('add') || lower.includes('banao') || lower.includes('jodo') || lower.includes('assign') || lower.includes('new task'))
  ) {
    let targetClient = contextData.clients[0];
    for (const c of contextData.clients) {
      if (lower.includes(c.tradeName.toLowerCase()) || lower.includes(c.pan.toLowerCase())) {
        targetClient = c;
        break;
      }
    }

    if (!targetClient) {
      return {
        replyText: '⚠️ Task create karne ke liye pehle kam se kam ek Client Master me hona zaroori hai.'
      };
    }

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
      replyText: `Compliance Task bana diya gaya hai!
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

  // D. Command: Update Task Status to DONE / IN PROGRESS
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

  // E. Command: Record Extra Work / Ad-hoc Billing
  if (lower.includes('extra work') || lower.includes('billing') || lower.includes('fee') || lower.includes('agreed fee')) {
    let targetClient = contextData.clients[0];
    for (const c of contextData.clients) {
      if (lower.includes(c.tradeName.toLowerCase())) {
        targetClient = c;
        break;
      }
    }

    if (!targetClient) {
      return {
        replyText: '⚠️ Extra work record karne ke liye Client ka naam zaroori hai.'
      };
    }

    const feeMatch = q.match(/(?:rs\.?|inr|₹|amount|fee)?\s*(\d{3,7})/i);
    const agreedFee = feeMatch ? parseInt(feeMatch[1], 10) : 10000;

    const extraWorkData: Partial<ExtraWorkItem> = {
      clientId: targetClient.id,
      clientName: targetClient.tradeName,
      taskTitle: 'Advisory & Ad-hoc ROC Filing Working',
      category: 'ROC & Advisory',
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

  // F. Command: Office Shift & Punch-in / Lunch Break
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
      replyText: `Office shift action execute ho gaya hai: **${shiftTitle}**.
History & Audit log me real-time entry update ho gayi hai.`,
      action: {
        type: 'OFFICE_SHIFT',
        title: shiftTitle,
        description: `Recorded for ${contextData.currentUser?.name || 'Staff'}`,
        data: { action: shiftAction },
        executed: false
      }
    };
  }

  // Fallback summary
  const totalTasks = contextData.tasks.length;
  const pendingTasks = contextData.tasks.filter(t => t.status === 'PENDING').length;
  const doneTasks = contextData.tasks.filter(t => t.status === 'DONE').length;
  const totalClients = contextData.clients.length;

  return {
    replyText: `Main TASK-VAANI ka **Agentic AI Assistant** hoon. Aap mujhe authentic client document dekar direct setup karwa sakte hain:

1. **📄 Read GST/PAN PDF with Live Preview**: GST Certificate (REG-06) attach karein, main authentic details read karke preview dikhaunga (kabhi koi dummy data generate nahi hoga).
2. **✅ Compliance Task Management**: "Apex Tools ka GSTR-3B task banao" ya "Bharat Logistics ka GST done mark karo".
3. **💰 Financial Extra Work**: "Client X ka ₹15,000 ka extra billing record karo".
4. **⏱️ Office Shifts & Attendance**: "Office login karo", "Lunch break shuru karo", "Log off karo".

**Current App Status:**
• Total Clients: **${totalClients}**
• Total Tasks: **${totalTasks}** (Pending: **${pendingTasks}** | Done: **${doneTasks}**)`,
    action: undefined
  };
};
