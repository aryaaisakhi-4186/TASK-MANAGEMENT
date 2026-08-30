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

export async function askCAAssistant(prompt: string): Promise<string> {
  const systemInstruction = `You are CA-CompliBot, an expert AI Chartered Accountant and tax consultant assistant built into TASK-VAANI.
You specialize in:
1. Indian Income Tax Act 1961 (Sections 44AB, 44AD, 44ADA, 115BAC, 194C, 194J, 194I, 194Q, 206AB, TDS rules, and Form 3CD).
2. Goods and Services Tax (GST Acts, Rule 36(4), GSTR-1, GSTR-3B, GSTR-9/9C, ITC reversals, DRC-01 SCN notices).
3. Companies Act 2013 & MCA/ROC Filings (AOC-4, MGT-7, DIR-3 KYC, LLP Form 11, Form 8).
4. Professional audit standards (ICAI Standards on Auditing SAs).
Provide crisp, structured, practical answers with references to section numbers, statutory due dates, and penalty implications.`;

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
      console.warn('GoogleGenerativeAI request error:', err?.message);
    }
  }

  return `**TASK-VAANI Statutory Guidance:**\nRegarding: "${prompt}"\n\n1. **Statutory Provisions:** For FY 2025-26 / AY 2026-27, please verify TDS deductions under ITNS 281 (due 7th of subsequent month), GSTR-1 (11th), and GSTR-3B (20th).\n2. **Reconciliation Check:** Reconcile outward supplies with E-Way bills & E-Invoices, and verify purchase register against GSTR-2B.\n3. **Audit Readiness:** Section 44AB limit is ₹10 Crore for digital transactions (otherwise ₹1 Cr).`;
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

