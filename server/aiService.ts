import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

let genAI: GoogleGenerativeAI | null = null;
if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
  } catch (e) {
    console.warn('Failed to initialize GoogleGenerativeAI:', e);
  }
}

export async function askCAAssistant(prompt: string, appData?: any): Promise<string> {
  let contextInfo = '';
  if (appData) {
    const clientsSummary = Array.isArray(appData.clients) && appData.clients.length > 0
      ? appData.clients.map((c: any, i: number) => `${i + 1}. ${c.tradeName} (Legal: ${c.legalName || c.tradeName} | PAN: ${c.pan || '-'} | GSTIN: ${c.gstin || '-'} | Type: ${c.category} | Contact: ${c.contactPerson || '-'} | Phone: ${c.phone || '-'} | Email: ${c.email || '-'} | Partner: ${c.assignedTeamName || '-'})`).join('\n')
      : 'None recorded';

    const tasksSummary = Array.isArray(appData.tasks) && appData.tasks.length > 0
      ? appData.tasks.map((t: any, i: number) => `${i + 1}. [${t.status}] ${t.title} for ${t.clientName} (Due: ${t.dueDate || '-'} | Category: ${t.category || '-'})`).join('\n')
      : 'None recorded';

    const teamSummary = Array.isArray(appData.team) && appData.team.length > 0
      ? appData.team.map((m: any, i: number) => `${i + 1}. ${m.name} (Role: ${m.role} | Post: ${m.designation || '-'} | Phone: ${m.phone || '-'})`).join('\n')
      : 'None recorded';

    const extraWorkSummary = Array.isArray(appData.extraWork) && appData.extraWork.length > 0
      ? appData.extraWork.map((e: any, i: number) => `${i + 1}. ${e.taskTitle} for ${e.clientName} (Agreed: ₹${e.agreedFee} | Balance: ₹${e.balanceDue} | Status: ${e.status})`).join('\n')
      : 'None recorded';

    contextInfo = `\n\n=== REAL-TIME LIVE APP DATA FROM TASK-VAANI ===
[TOTAL REGISTERED CLIENTS: ${appData.clients?.length || 0}]
${clientsSummary}

[TOTAL COMPLIANCE TASKS: ${appData.tasks?.length || 0}]
${tasksSummary}

[OFFICE STAFF & TEAM: ${appData.team?.length || 0}]
${teamSummary}

[FINANCIAL EXTRA BILLING ASSIGNMENTS: ${appData.extraWork?.length || 0}]
${extraWorkSummary}
=================================================`;
  }

  const systemInstruction = `You are CA-CompliBot, an expert AI Chartered Accountant, Tax Consultant, and Autonomous Practice Manager for TASK-VAANI.
You communicate in clean, respectful, fluent Hindi / Hinglish / English depending on how the user addresses you.

CORE INSTRUCTIONS:
1. APP KNOWLEDGE & QUESTION ANSWERING:
   - When the user asks about app capabilities ("tum kya kya kar sakte ho", "help kaise karoge"), give a personalized, clear summary of what you can do.
   - When the user asks about specific clients, tasks, staff, or numbers (e.g. "Rakhi Agency ka phone number kya hai", "Pending GST tasks kaunse hain", "Total clients kitne hain"), search the LIVE APP DATA provided below and give precise, factual answers.
2. STATUTORY CA & TAX ADVISORY:
   - Provide high-level professional statutory guidance on Indian Income Tax Act 1961 (Sections 44AB, 44AD, 194C, 194J, 194Q, 206AB, 115BAC), Goods and Services Tax (GST Acts, Rule 36(4), GSTR-1/3B/9), Companies Act 2013, and ICAI auditing standards.
3. CONVERSATIONAL TONE:
   - Never repeat robotic boilerplate text. Speak naturally like a senior CA partner / practice manager sitting next to the user.
${contextInfo}`;

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.7-flash',
        systemInstruction,
      });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      if (text) return text;
    } catch (err: any) {
      console.warn('GoogleGenerativeAI request note:', err?.message);
    }
  }

  // =========================================================================
  // INTELLIGENT DYNAMIC CONTEXTUAL RESOLVER (When AI Cloud API is offline/local)
  // =========================================================================
  const lower = prompt.toLowerCase();

  // 1. Inquiries about Bot Capabilities
  if (lower.includes('tum kya') || lower.includes('what can you do') || lower.includes('capabilities') || lower.includes('help') || lower.includes('kaam kar sakte')) {
    return `Namaste! Main **TASK-VAANI** ka **Agentic AI Assistant** hoon. Main aapke practice management ke liye ye sabhi kaam handle karta hoon:

1. **📄 Client Onboarding via PDF**: GST Registration Certificate (REG-06), PAN Card ya ITR PDF attach karein — main authentic details extract karke instant live preview dunga (kabhi koi dummy data generate nahi hoga).
2. **✅ Compliance Task Automation**: "Apex Tools ka GSTR-3B banao" ya "Rakhi Agency ka GST done mark karo" — tasks schedule aur status update ho jayenge.
3. **💰 Extra Billing & ROC Work**: "Client X ka ₹15,000 ka extra notice work record karo" — agreed fee aur balance due track hoga.
4. **⏱️ Office Shifts & Attendance**: "Office login karo", "Lunch break shuru karo", "Log off karo".
5. **🔍 Live App Data Lookups**: Kisi bhi client ka phone number, PAN, GSTIN, pending return, ya staff assignments direct puchen.
6. **⚖️ Income Tax & GST Rules**: Sec 194Q, 206AB, 44AB limits, GST DRC-01 notices par technical CA guidance lein.`;
  }

  // 2. Client Specific Lookups (Matches client tradeName or PAN in prompt)
  if (appData && Array.isArray(appData.clients)) {
    for (const c of appData.clients) {
      if (lower.includes(c.tradeName.toLowerCase()) || (c.pan && lower.includes(c.pan.toLowerCase()))) {
        return `📋 **Client Profile Details: ${c.tradeName}**
• **Legal Registered Name:** ${c.legalName || c.tradeName}
• **PAN Number:** ${c.pan || 'Not provided'}
• **GSTIN Number:** ${c.gstin || 'Unregistered / None'}
• **Entity Type / Constitution:** ${c.category}
• **Contact Person:** ${c.contactPerson || 'Not provided'}
• **Mobile / Phone:** ${c.phone ? `📞 ${c.phone}` : 'Not provided'}
• **Email Address:** ${c.email || 'Not provided'}
• **Assigned Staff / Partner:** ${c.assignedTeamName || 'Unassigned'}`;
      }
    }
  }

  // 3. Pending Tasks Inquiries
  if (lower.includes('pending') || lower.includes('baki') || lower.includes('due') || lower.includes('task') || lower.includes('gstr') || lower.includes('tds') || lower.includes('itr')) {
    if (appData && Array.isArray(appData.tasks)) {
      let filteredTasks = appData.tasks.filter((t: any) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
      
      if (lower.includes('gst') || lower.includes('gstr')) {
        filteredTasks = filteredTasks.filter((t: any) => t.category === 'GST' || t.title.toLowerCase().includes('gst'));
      } else if (lower.includes('tds')) {
        filteredTasks = filteredTasks.filter((t: any) => t.category === 'TDS' || t.title.toLowerCase().includes('tds'));
      } else if (lower.includes('itr') || lower.includes('income tax')) {
        filteredTasks = filteredTasks.filter((t: any) => t.category === 'INCOME_TAX' || t.title.toLowerCase().includes('itr'));
      }

      if (filteredTasks.length === 0) {
        return `🎉 **Badhai ho!** Is category me is samay koi bhi pending task baki nahi hai. Sabhi compliances completed hain!`;
      }

      const list = filteredTasks.map((t: any, idx: number) => 
        `${idx + 1}. **${t.clientName}** — ${t.title} *(Due Date: ${t.dueDate || '20th'}, Status: ${t.status})*`
      ).join('\n');

      return `📋 **Pending Compliance Tasks (${filteredTasks.length} Found):**\n\n${list}`;
    }
  }

  // 4. Team / Staff Inquiries
  if (lower.includes('staff') || lower.includes('team') || lower.includes('member') || lower.includes('associates') || lower.includes('employee')) {
    if (appData && Array.isArray(appData.team) && appData.team.length > 0) {
      const staffList = appData.team.map((m: any, idx: number) => 
        `${idx + 1}. **${m.name}** — ${m.designation || m.role} ${m.phone ? `(📞 ${m.phone})` : ''}`
      ).join('\n');
      return `👥 **Office Staff & Team Directory (${appData.team.length} Members):**\n\n${staffList}`;
    }
  }

  // 5. Billing & Extra Work Inquiries
  if (lower.includes('extra work') || lower.includes('billing') || lower.includes('fee') || lower.includes('balance') || lower.includes('paisa')) {
    if (appData && Array.isArray(appData.extraWork) && appData.extraWork.length > 0) {
      const totalAgreed = appData.extraWork.reduce((sum: number, e: any) => sum + (e.agreedFee || 0), 0);
      const totalBalance = appData.extraWork.reduce((sum: number, e: any) => sum + (e.balanceDue || 0), 0);
      return `💰 **Financial Extra Billing Overview:**
• **Total Logged Assignments:** ${appData.extraWork.length}
• **Total Agreed Fees:** ₹${totalAgreed.toLocaleString('en-IN')}
• **Total Outstanding Balance:** ₹${totalBalance.toLocaleString('en-IN')}

Aap Extra Work Tracker tab me jakar client-wise invoice download kar sakte hain.`;
    }
  }

  // 6. Statutory Tax & Law Guidance
  if (lower.includes('194q') || lower.includes('206c') || lower.includes('44ab') || lower.includes('44ad') || lower.includes('drc-01') || lower.includes('itc')) {
    if (lower.includes('194q')) {
      return `⚖️ **Section 194Q — TDS on Purchase of Goods:**
1. **Applicability:** Buyer whose turnover exceeded ₹10 Crore in preceding FY.
2. **Threshold:** Value of purchase of goods from a resident seller exceeds **₹50 Lakh** in the current FY.
3. **TDS Rate:** **0.1%** on the amount exceeding ₹50 Lakh (5% if PAN not furnished under Sec 206AA).
4. **Relationship with Sec 206C(1H):** If transaction attracts both 194Q and 206C(1H), TDS under Section 194Q takes precedence.`;
    }
    if (lower.includes('44ab')) {
      return `⚖️ **Section 44AB — Tax Audit Limits for AY 2026-27:**
1. **Business (Cash Transactions > 5%):** ₹1 Crore.
2. **Business (Digital Transactions >= 95%):** **₹10 Crore** limit under Section 44AB(a).
3. **Profession:** ₹50 Lakh (or ₹75 Lakh under Section 44ADA if 95%+ digital receipts).
4. **Statutory Due Date:** 30th September of the Assessment Year.`;
    }
  }

  return `**TASK-VAANI AI Assistant:**
Aapke sawal "**${prompt}**" ke sandarbh me:
• **Live System Status:** Is samay system me ${appData?.clients?.length || 0} clients, ${appData?.tasks?.length || 0} compliance tasks aur ${appData?.team?.length || 0} staff members active hain.
• Aap mujhse kisi bhi client ka naam, pending return, ya koi bhi new task schedule karne ko bol sakte hain.`;
}

// Multimodal Vision / OCR Parser for Scanned PDF & Image Documents
export async function extractDocumentWithAI(base64Data: string, mimeType = 'application/pdf'): Promise<string> {
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.7-flash' });
      const prompt = `Extract all statutory details from this Indian compliance document (GST Certificate Form GST REG-06, PAN Card, MSME Udyam, ITR Ack, or MCA Incorporation Certificate).
Please extract and output clearly:
1. Legal Name: [Legal Name]
2. Trade Name: [Trade Name]
3. Registration Number / GSTIN: [15-character GSTIN]
4. PAN Number: [10-character PAN]
5. TAN Number: [10-character TAN if present]
6. Constitution of Business: [Private Limited Company / Proprietorship / Partnership / LLP / Trust / Individual]
7. Address of Principal Place of Business: [Full Address]
8. Date of Liability / Registration: [DD/MM/YYYY]
9. Name of Authorized Signatory / Proprietor / Director: [Name]
10. Mobile Phone: [Mobile]
11. Email Address: [Email]`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        }
      ]);
      const response = await result.response;
      return response.text() || '';
    } catch (e: any) {
      console.warn('Gemini Document OCR fallback warning:', e?.message);
    }
  }
  return '';
}
