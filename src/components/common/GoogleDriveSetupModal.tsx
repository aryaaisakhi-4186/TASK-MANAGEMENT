import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { Cloud, Check, Copy, ExternalLink, X, ArrowRight, ShieldCheck, Sparkles, FileSpreadsheet } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccessSync?: (sheetUrl?: string) => void;
}

export const GoogleDriveSetupModal: React.FC<Props> = ({ isOpen, onClose, onSuccessSync }) => {
  const { settings, updateSettings, tasks } = useTasks();
  const [webhookUrl, setWebhookUrl] = useState(settings.googleWebhookUrl || '');
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; sheetUrl?: string } | null>(null);

  if (!isOpen) return null;

  const targetEmail = settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com';

  const appsScriptCode = `// Google Apps Script for TASK-VAANI Google Drive & Google Sheets Integration
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var targetEmail = data.targetEmail || Session.getActiveUser().getEmail();
    
    // 1. If Attendance & Biometric Work Log
    if (data.type === "ATTENDANCE_LOG") {
      var sheetName = "TASK-VAANI Attendance & Work Log 2026";
      var files = DriveApp.getFilesByName(sheetName);
      var spreadsheet = files.hasNext() ? SpreadsheetApp.open(files.next()) : SpreadsheetApp.create(sheetName);
      var sheet = spreadsheet.getActiveSheet();
      sheet.clear();
      
      // Header
      sheet.appendRow(["Record ID", "Date", "Staff / Partner Name", "Punch In Time", "Punch Out Time", "Total Minutes", "Client & Work Notes", "Location Geotag", "Google Drive Photo Link"]);
      sheet.getRange(1, 1, 1, 9).setBackground("#047857").setFontColor("#FFFFFF").setFontWeight("bold");
      
      // Photos Folder in Google Drive
      var photoFolderName = "TASK-VAANI Biometric Attendance Photos 2026";
      var folders = DriveApp.getFoldersByName(photoFolderName);
      var photoFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(photoFolderName);
      
      if (data.attendanceRecords && data.attendanceRecords.length > 0) {
        data.attendanceRecords.forEach(function(r) {
          var photoUrl = "No Photo";
          if (r.selfieBase64 && r.selfieBase64.indexOf("data:image") !== -1) {
            try {
              var base64Data = r.selfieBase64.split(",")[1];
              var decodedBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), "image/jpeg", "Attendance_" + r.teamName.replace(/\s+/g, "_") + "_" + r.date + ".jpg");
              var file = photoFolder.createFile(decodedBlob);
              file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
              photoUrl = file.getUrl();
            } catch (err) {
              photoUrl = photoFolder.getUrl();
            }
          }
          
          sheet.appendRow([r.id, r.date, r.teamName, r.punchInTime, r.punchOutTime, r.totalMinutesWorked, r.workSessionNotes, r.locationStamp, photoUrl]);
        });
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileUrl: spreadsheet.getUrl(),
        message: "Attendance & Shrunk Photos stored in Google Drive: " + targetEmail
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Default: Statutory Compliance Matrix
    var fileName = data.sheetName || "TASK-VAANI Statutory Compliance Master 2026";
    var files = DriveApp.getFilesByName(fileName);
    var spreadsheet = files.hasNext() ? SpreadsheetApp.open(files.next()) : SpreadsheetApp.create(fileName);
    var sheet = spreadsheet.getActiveSheet();
    sheet.clear();
    
    sheet.appendRow(["Task ID", "Client Name", "Category", "Compliance Title", "Frequency", "Due Rule / Date", "Status", "Assigned Staff", "Financial Year"]);
    sheet.getRange(1, 1, 1, 9).setBackground("#0B192C").setFontColor("#FFFFFF").setFontWeight("bold");
    
    if (data.tasks && data.tasks.length > 0) {
      data.tasks.forEach(function(t) {
        sheet.appendRow([t.id, t.clientName, t.category, t.title, t.frequency, t.dueDayOrDate + " (" + t.dueDate + ")", t.status, t.assignedTeamName, t.financialYear]);
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileUrl: spreadsheet.getUrl(),
      fileName: fileName,
      message: "Successfully synced to Google Drive of " + targetEmail
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ googleWebhookUrl: webhookUrl.trim() });
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/reports/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetName: settings.googleSheetName || 'TASK-VAANI Statutory Compliance Master 2026',
          rowCount: tasks.length,
          datasetType: 'Compliance Tasks Matrix',
          targetEmail,
          webhookUrl: webhookUrl.trim(),
          tasks
        })
      });

      const data = await response.json();
      setTestResult({
        success: true,
        message: data.message || 'Google Drive connected successfully!',
        sheetUrl: data.googleSheetUrl
      });
      if (onSuccessSync) onSuccessSync(data.googleSheetUrl);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Could not connect to Google Apps Script URL. Please ensure access is set to "Anyone".'
      });
    } finally {
      setTesting(false);
    }
  };

  // Alternative 1-Click Open in Google Sheets (Directly creates new sheet in Drive via browser)
  const handleDirectGoogleSheetCreate = () => {
    // Generate CSV data URI to open directly in Google Sheets
    const headers = ["Task ID", "Client Name", "Category", "Compliance Title", "Frequency", "Due Date", "Status", "Assigned Staff", "Financial Year"];
    const rows = tasks.map(t => [t.id, `"${t.clientName}"`, t.category, `"${t.title}"`, t.frequency, t.dueDayOrDate, t.status, `"${t.assignedTeamName}"`, t.financialYear]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // Open Google Sheets import URL
    window.open('https://sheets.new', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-amber-400/50 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full">
          <X size={18} />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Cloud size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">
            Google Drive & Google Sheets Setup Guide
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Connect your Google Account (<strong className="text-amber-600 dark:text-amber-400">{targetEmail}</strong>) to save sheets directly into your Drive
          </p>
        </div>

        {/* Quick Option 1: Instant 1-Click Open in Google Sheets */}
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-600" /> Method 1: Instant 1-Click Google Sheet (No setup needed)
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-600 dark:text-slate-400 mt-0.5">
              Opens a brand-new official spreadsheet directly inside your Google Drive in 1 click.
            </p>
          </div>
          <button
            onClick={handleDirectGoogleSheetCreate}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <ExternalLink size={14} /> Open in Google Sheets
          </button>
        </div>

        {/* Option 2: Automatic Background Webhook Setup (2 Minutes) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Method 2: Automatic 1-Click Background Sync (2-Minute Free Google Apps Script Setup)
            </h4>
          </div>

          {/* Step 1 */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            <p className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">1</span>
              Open Google Apps Script:
            </p>
            <p className="text-[11px] text-slate-500 ml-7">
              Go to <a href="https://script.google.com/home/start" target="_blank" rel="noreferrer" className="text-amber-600 font-bold underline inline-flex items-center gap-1">script.google.com <ExternalLink size={10} /></a> logged in with <strong>{targetEmail}</strong>, and click <strong>"New project"</strong>.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">2</span>
                Paste this ready-made script:
              </p>
              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-all"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                {copied ? 'Copied Code!' : 'Copy Script Code'}
              </button>
            </div>
            <pre className="text-[10px] font-mono bg-slate-900 text-amber-200 p-2.5 rounded-xl overflow-x-auto max-h-24 ml-7 border border-slate-800">
              {appsScriptCode}
            </pre>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            <p className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">3</span>
              Deploy as Web App:
            </p>
            <p className="text-[11px] text-slate-500 ml-7">
              Click top right <strong>"Deploy"</strong> ➔ <strong>"New deployment"</strong> ➔ Select type <strong>"Web app"</strong> ➔ Set "Who has access" to <strong>"Anyone"</strong> ➔ Click <strong>Deploy</strong> and copy the generated Web App URL.
            </p>
          </div>

          {/* Paste URL Form */}
          <form onSubmit={handleSaveAndTest} className="pt-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
              Paste your Google Apps Script Web App URL here:
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={testing}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow-md transition-all flex items-center gap-1.5"
              >
                {testing ? 'Testing...' : 'Save & Sync Drive'}
              </button>
            </div>
          </form>

          {testResult && (
            <div className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${testResult.success ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30' : 'bg-red-500/15 text-red-800 dark:text-red-300 border border-red-500/30'}`}>
              <span>{testResult.message}</span>
              {testResult.sheetUrl && (
                <a
                  href={testResult.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1 shrink-0"
                >
                  View Sheet <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
