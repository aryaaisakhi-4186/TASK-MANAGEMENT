import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client, TaskItem, ExtraWorkItem, UserProfile } from '../types';

const GEMINI_STORAGE_KEY = 'taskvaani_user_gemini_api_key';

export const getStoredGeminiKey = (): string => {
  try {
    return localStorage.getItem(GEMINI_STORAGE_KEY) || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  } catch {
    return '';
  }
};

export const setStoredGeminiKey = (key: string): void => {
  try {
    if (key && key.trim()) {
      localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(GEMINI_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Failed to save Gemini key:', e);
  }
};

export interface AppContextData {
  clients: Client[];
  tasks: TaskItem[];
  team: UserProfile[];
  extraWork: ExtraWorkItem[];
  currentUser?: UserProfile;
}

export const buildSystemPrompt = (context: AppContextData): string => {
  const clientsList = context.clients.length > 0
    ? context.clients.map((c, i) => `${i + 1}. ${c.tradeName} (Legal: ${c.legalName || c.tradeName} | PAN: ${c.pan || 'N/A'} | GSTIN: ${c.gstin || 'N/A'} | Category: ${c.category} | Phone: ${c.phone || 'N/A'} | Contact: ${c.contactPerson || 'N/A'} | Staff: ${c.assignedTeamName || 'Unassigned'})`).join('\n')
    : 'No clients recorded yet.';

  const tasksList = context.tasks.length > 0
    ? context.tasks.map((t, i) => `${i + 1}. [${t.status}] ${t.title} for ${t.clientName} (Due: ${t.dueDate || '20th'}, Category: ${t.category || 'General'})`).join('\n')
    : 'No tasks scheduled.';

  const teamList = context.team.length > 0
    ? context.team.map((m, i) => `${i + 1}. ${m.name} (${m.role} - ${m.designation || 'Staff'} | Phone: ${m.phone || 'N/A'})`).join('\n')
    : 'No staff recorded.';

  const extraWorkList = context.extraWork.length > 0
    ? context.extraWork.map((e, i) => `${i + 1}. ${e.taskTitle} for ${e.clientName} (Agreed: ₹${e.agreedFee}, Balance: ₹${e.balanceDue}, Status: ${e.status})`).join('\n')
    : 'No extra billing assignments.';

  return `You are "CA-CompliBot", a warm, highly intelligent, human-like AI Chartered Accountant, Tax Consultant, and Practice Manager built into the TASK-VAANI practice management app.

TONE & PERSONALITY:
- Speak completely naturally like a supportive, smart, and experienced senior colleague or CA partner sitting right next to the user.
- Respond in the same language the user uses (Hindi, Hinglish, or English).
- NEVER use robotic phrases like "Aapke nirdesh ke sambandh me", "System status:", or repetitive boilerplate lists.
- Be conversational, friendly, polite, and helpful for general greetings ("Hello", "Kaise ho", "What is your name"), small talk, and questions about what you do.

YOUR REAL-TIME FIRM KNOWLEDGE:
You have direct live access to the firm's real operational data:
---
CLIENTS (${context.clients.length}):
${clientsList}

TASKS (${context.tasks.length}):
${tasksList}

STAFF / TEAM (${context.team.length}):
${teamList}

EXTRA BILLING & AD-HOC WORK:
${extraWorkList}
---

INSTRUCTIONS:
1. When asked questions about clients, tasks, staff, fees, or status, directly lookup the real data above and answer specifically and accurately.
2. For tax, GST, TDS (194Q, 206AB), Income Tax Act 1961 (44AB, 44AD), MCA/ROC compliances, provide expert, practical Chartered Accountant advice with section numbers and thresholds.
3. For friendly talk ("Hi", "Hello", "Kaun ho tum", "Kya kar sakte ho"), reply warmly and naturally like a real human assistant.`;
};

export const callClientGeminiAI = async (
  prompt: string,
  context: AppContextData,
  chatHistory: Array<{ sender: 'user' | 'bot'; text: string }> = []
): Promise<string | null> => {
  const apiKey = getStoredGeminiKey();
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const systemInstruction = buildSystemPrompt(context);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.7-flash',
      systemInstruction,
    });

    const recentHistory = chatHistory.slice(-6).map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const chat = model.startChat({
      history: recentHistory,
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();
    return text ? text.trim() : null;
  } catch (err: any) {
    console.warn('Client Gemini AI Error:', err?.message || err);
    return null;
  }
};
