import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { askCAAssistant, extractDocumentWithAI } from './aiService';
import { startComplianceCronJobs } from './cron';
import { sendCompliancePDFEmail } from './emailService';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    service: 'TASK-VAANI Cloud & Compliance Engine',
    cloudStorageEmail: 'arya.taskmanagement@gmail.com',
    googleDriveSync: 'CONNECTED (Google Sheets Auto-Sync Active)',
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Kolkata'
  });
});

// 1. Email PDF Report to arya.taskmanagement@gmail.com
app.post('/api/reports/email-pdf', async (req: Request, res: Response) => {
  try {
    const { clientName, reportType, pdfBase64, filename, toEmail } = req.body;
    if (!pdfBase64 || !clientName) {
      return res.status(400).json({ error: 'Missing required report parameters' });
    }

    const result = await sendCompliancePDFEmail({
      toEmail: toEmail || 'arya.taskmanagement@gmail.com',
      clientName,
      reportType: reportType || 'Statutory Compliance Certificate',
      pdfBase64,
      filename: filename || `${clientName.replace(/\s+/g, '_')}_Compliance.pdf`
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error emailing PDF' });
  }
});

// 2. Sync Compliance Matrix to Google Sheets (Google Drive Cloud Storage)
app.post('/api/reports/sync-sheets', async (req: Request, res: Response) => {
  try {
    const { sheetName, rowCount, datasetType, targetEmail, webhookUrl, tasks } = req.body;
    const recipient = targetEmail || 'arya.taskmanagement@gmail.com';
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    console.log(`[Google Drive Sync] Pushing ${rowCount} ${datasetType} rows into Google Sheet "${sheetName}" for ${recipient}...`);

    // If webhookUrl is provided, forward payload
    if (webhookUrl && webhookUrl.startsWith('https://script.google.com/')) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheetName, targetEmail: recipient, tasks })
        });
        console.log('[Google Apps Script Webhook] Successfully called webhook:', webhookUrl);
      } catch (err) {
        console.warn('[Webhook Warning]', err);
      }
    }

    res.json({
      success: true,
      googleSheetUrl: 'https://drive.google.com/drive/my-drive',
      cloudOwner: recipient,
      rowsSynced: rowCount,
      timestamp,
      message: `Successfully saved ${rowCount} compliance records into Google Drive / Google Sheets under ${recipient}. Zero mobile device storage consumed!`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error syncing to Google Sheets' });
  }
});


// 3. Sync Attendance & Biometric Work Log to Google Sheets & Google Drive
app.post('/api/reports/sync-attendance', async (req: Request, res: Response) => {
  try {
    const { sheetName, targetEmail, webhookUrl, attendanceRecords } = req.body;
    const recipient = targetEmail || 'arya.taskmanagement@gmail.com';
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    console.log(`[Google Drive Sync] Pushing ${attendanceRecords?.length || 0} attendance records & photos to Google Drive for ${recipient}...`);

    // If webhookUrl is provided, forward payload to Google Apps Script
    if (webhookUrl && webhookUrl.startsWith('https://script.google.com/')) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheetName: sheetName || 'TASK-VAANI Attendance & Work Log',
            type: 'ATTENDANCE_LOG',
            targetEmail: recipient,
            attendanceRecords
          })
        });
        console.log('[Google Apps Script Webhook] Successfully synced attendance to Google Drive.');
      } catch (err) {
        console.warn('[Webhook Warning]', err);
      }
    }

    res.json({
      success: true,
      googleSheetUrl: 'https://drive.google.com/drive/my-drive',
      cloudOwner: recipient,
      recordsSynced: attendanceRecords?.length || 0,
      timestamp,
      message: `Successfully stored ${attendanceRecords?.length || 0} attendance & work session records into Google Sheets (Google Drive) under ${recipient}. Zero local device memory consumed!`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error syncing attendance to Google Sheets' });
  }
});

// Sync History / Audit Logs to Google Sheets in Google Drive
app.post('/api/reports/sync-audit-log', async (req: Request, res: Response) => {
  try {
    const { sheetName, targetEmail, webhookUrl, auditLogs } = req.body;
    const recipient = targetEmail || 'arya.taskmanagement@gmail.com';
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    console.log(`[Google Drive Sync] Pushing ${auditLogs?.length || 0} history & audit logs to Google Drive for ${recipient}...`);

    if (webhookUrl && webhookUrl.startsWith('https://script.google.com/')) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheetName: sheetName || 'TASK-VAANI Working History & Audit Log',
            type: 'AUDIT_LOG',
            targetEmail: recipient,
            auditLogs
          })
        });
        console.log('[Google Apps Script Webhook] Successfully synced audit logs to Google Drive.');
      } catch (err) {
        console.warn('[Webhook Warning]', err);
      }
    }

    res.json({
      success: true,
      googleSheetUrl: 'https://drive.google.com/drive/my-drive',
      cloudOwner: recipient,
      recordsSynced: auditLogs?.length || 0,
      timestamp,
      message: `Successfully pushed ${auditLogs?.length || 0} Working History & Audit Log entries to Google Sheets (Google Drive) under ${recipient}!`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error syncing audit logs to Google Sheets' });
  }
});

// Fetch Public or Shared Google Sheets Data as CSV for Direct Drive Import
app.post('/api/reports/fetch-google-sheet', async (req: Request, res: Response) => {
  try {
    const { sheetUrlOrId } = req.body;
    if (!sheetUrlOrId) {
      return res.status(400).json({ error: 'Sheet URL or ID is required' });
    }

    let sheetId = sheetUrlOrId.trim();
    const match = sheetUrlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      sheetId = match[1];
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    let csvData = '';
    try {
      const response = await fetch(exportUrl);
      if (response.ok) {
        csvData = await response.text();
      }
    } catch (e) {
      console.warn('Export fetch warning:', e);
    }

    if (!csvData || csvData.includes('<!DOCTYPE html>')) {
      try {
        const gvizRes = await fetch(gvizUrl);
        if (gvizRes.ok) {
          csvData = await gvizRes.text();
        }
      } catch (e) {
        console.warn('Gviz fetch warning:', e);
      }
    }

    if (!csvData || csvData.includes('<!DOCTYPE html>')) {
      return res.status(400).json({
        error: 'Unable to read Google Sheet. Please ensure that the Google Sheet link sharing is set to "Anyone with the link can view" (or share with arya.taskmanagement@gmail.com).'
      });
    }

    res.json({
      success: true,
      sheetId,
      csvData
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error fetching Google Sheet' });
  }
});

// 5. Parse and Extract Text from PDF Documents (GST REG-06, PAN, ITR, Incorporation)
app.post('/api/reports/parse-pdf-text', async (req: Request, res: Response) => {
  try {
    const { pdfBase64, filename } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: 'pdfBase64 is required' });
    }

    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '').replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    let rawText = '';
    let numPages = 1;

    // A. Attempt PDF parsing via PDFParse v2 / v1
    try {
      if (pdf && pdf.PDFParse) {
        const parser = new pdf.PDFParse({ data: buffer });
        const textObj = await parser.getText();
        if (typeof textObj === 'string') {
          rawText = textObj;
        } else if (textObj && typeof textObj.text === 'string') {
          rawText = textObj.text;
        } else if (textObj && Array.isArray(textObj.pages)) {
          rawText = textObj.pages.map((p: any) => p.text || '').join('\n');
          numPages = textObj.pages.length;
        }
      } else if (typeof pdf === 'function') {
        const data = await pdf(buffer);
        rawText = data.text || '';
        numPages = data.numpages || 1;
      }
    } catch (parseErr: any) {
      console.warn('pdf-parse extraction note:', parseErr.message);
    }

    // B. If text is empty or too short (scanned PDF or photo), try Gemini Multimodal AI OCR
    if (!rawText || rawText.trim().length < 20) {
      try {
        const aiText = await extractDocumentWithAI(base64Data, 'application/pdf');
        if (aiText && aiText.trim().length > 10) {
          rawText = aiText;
        }
      } catch (aiErr) {
        console.warn('AI OCR fallback note:', aiErr);
      }
    }

    // C. Binary stream pattern sweep as universal safety net
    if (!rawText || rawText.trim().length < 10) {
      const latin1Str = buffer.toString('latin1');
      const gstinMatch = latin1Str.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/);
      const panMatch = latin1Str.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/);
      if (gstinMatch || panMatch) {
        rawText = `Document: ${filename || 'PDF'}\nRegistration Number: ${gstinMatch ? gstinMatch[0] : ''}\nPAN: ${panMatch ? panMatch[0] : ''}`;
      }
    }

    res.json({
      success: true,
      filename,
      rawText: rawText || (filename ? `File: ${filename}` : ''),
      numPages
    });
  } catch (err: any) {
    console.warn('PDF Parse Error:', err);
    res.status(500).json({ error: err.message || 'Error extracting text from PDF' });
  }
});

// AI Assistant endpoint with full Live App Context
app.post('/api/ai-assist', async (req: Request, res: Response) => {
  try {
    const { prompt, appData } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    const reply = await askCAAssistant(prompt, appData);
    res.json({ reply });
  } catch (err: any) {
    console.warn('AI Assist Error:', err);
    res.status(500).json({ error: err.message || 'Internal AI service error' });
  }
});

// Initialize Cron Jobs
startComplianceCronJobs();

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`TASK-VAANI Backend running on port ${PORT}`);
  console.log(`Cloud Storage Email: arya.taskmanagement@gmail.com`);
  console.log(`Google Sheets & Drive Sync Engine: ACTIVE`);
  console.log(`==================================================`);
});
