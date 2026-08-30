import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  Download, 
  Trash2, 
  UserCheck, 
  Sparkles,
  Cloud,
  ExternalLink,
  RefreshCw,
  Database
} from 'lucide-react';
import { useTasks } from '../../context/TaskContext';
import { 
  parseTeamFromFile, 
  parseTeamFromGoogleSheet, 
  ParsedTeamRow, 
  downloadTeamExcelTemplate 
} from '../../utils/masterImportExport';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_MASTER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1GcG1ekpVnewJo034_yttoP92qIYEeO_2uBacAgpwCqU/edit?pli=1&gid=0#gid=0';

export const TeamImportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { addTeamMember, settings, updateSettings } = useTasks();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose, isOpen);

  const [activeSource, setActiveSource] = useState<'FILE' | 'GOOGLE_SHEET'>('GOOGLE_SHEET');
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>(() => {
    return settings.masterGoogleSheetUrl || localStorage.getItem('taskvaani_master_google_sheet_url') || DEFAULT_MASTER_SHEET_URL;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedTeamRow[]>([]);
  const [sourceName, setSourceName] = useState<string>('');
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  useEffect(() => {
    if (settings.masterGoogleSheetUrl) {
      setGoogleSheetUrl(settings.masterGoogleSheetUrl);
    }
  }, [settings.masterGoogleSheetUrl]);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setLoading(true);
    setErrorMsg(null);
    setImportSuccessCount(null);
    setSourceName(file.name);

    try {
      const rows = await parseTeamFromFile(file);
      setParsedRows(rows);
    } catch (err: any) {
      console.warn('Team import parse error:', err);
      setErrorMsg(err.message || 'Failed to read file. Please ensure it is a valid Excel or PDF file.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchGoogleSheet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const urlToFetch = googleSheetUrl.trim() || DEFAULT_MASTER_SHEET_URL;

    setLoading(true);
    setErrorMsg(null);
    setImportSuccessCount(null);
    setSourceName('Google Drive Master Sheet');

    try {
      localStorage.setItem('taskvaani_master_google_sheet_url', urlToFetch);
      updateSettings({ 
        masterGoogleSheetUrl: urlToFetch,
        masterGoogleSheetId: '1GcG1ekpVnewJo034_yttoP92qIYEeO_2uBacAgpwCqU'
      });
    } catch (e) {
      console.warn('Save settings error:', e);
    }

    try {
      const rows = await parseTeamFromGoogleSheet(urlToFetch);
      setParsedRows(rows);
    } catch (err: any) {
      console.warn('Google Sheet parse error:', err);
      setErrorMsg(err.message || 'Unable to read Google Sheet. Ensure link sharing is set to "Anyone with the link can view".');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleRemoveRow = (index: number) => {
    setParsedRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleCommitImport = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    validRows.forEach(row => {
      addTeamMember({
        name: row.name,
        role: row.role || 'TEAM',
        designation: row.designation || 'Compliance Associate',
        phone: row.phone || '',
        email: row.email || '',
        pan: row.pan,
        pin: row.pin || (row.phone ? row.phone.slice(-4) : '1234'),
        assignedClientIds: []
      });
    });

    setImportSuccessCount(validRows.length);
    setParsedRows([]);
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-6 shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title="Close Modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition-all"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <UserCheck size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">
              Import Team Members (Google Drive Sheet & Excel)
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Permanent Google Drive Sheet auto-synced • Zero Duplication • Auto PIN from Mobile No
            </p>
          </div>
        </div>

        {/* Source Switcher Tabs */}
        <div className="flex items-center gap-2 mb-4 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => { setActiveSource('GOOGLE_SHEET'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeSource === 'GOOGLE_SHEET'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cloud size={15} /> 🌐 Permanent Google Drive Sheet
          </button>

          <button
            onClick={() => { setActiveSource('FILE'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeSource === 'FILE'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload size={15} /> 📂 Upload Excel / CSV File
          </button>
        </div>

        {/* Success Alert */}
        {importSuccessCount !== null && (
          <div className="mb-4 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={18} className="text-emerald-500 font-bold" />
              <span>
                <strong>{importSuccessCount} Staff Members</strong> successfully imported/updated into Team Directory without duplicates!
              </span>
            </div>
            <button
              onClick={() => setImportSuccessCount(null)}
              className="font-bold underline ml-2"
            >
              Import More
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto space-y-4">
          
          {parsedRows.length === 0 ? (
            activeSource === 'GOOGLE_SHEET' ? (
              /* TAB 1: Google Sheet Source */
              <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="text-amber-500" size={18} />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Google Drive Cloud Master Sheet
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                    ● Permanently Saved
                  </span>
                </div>

                <form onSubmit={handleFetchGoogleSheet} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Google Sheet URL or Spreadsheet ID:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={googleSheetUrl}
                        onChange={(e) => setGoogleSheetUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 shrink-0 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        {loading ? 'Fetching Sheet...' : 'Fetch & Import Sheet'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <span>ID: <strong>1GcG1ekpVnewJo034_yttoP92qIYEeO_2uBacAgpwCqU</strong></span>
                    </div>
                    <a
                      href={googleSheetUrl || DEFAULT_MASTER_SHEET_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> Open Sheet in Google Drive
                    </a>
                  </div>
                </form>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200">
                  💡 <strong>Direct Sync:</strong> Staff members will be assigned auto-PIN from their mobile number last 4 digits for instant attendance login.
                </div>
              </div>
            ) : (
              /* TAB 2: Drag & Drop File Upload */
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-amber-500 bg-amber-500/10 scale-[0.99]'
                    : 'border-slate-300 dark:border-slate-700 hover:border-amber-500/50 bg-slate-50 dark:bg-slate-950/40'
                }`}
              >
                <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
                  {loading ? (
                    <RefreshCw size={28} className="animate-spin text-amber-500" />
                  ) : (
                    <FileSpreadsheet size={32} />
                  )}
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {loading ? 'Reading & Parsing File...' : 'Click or Drag & Drop Excel (.xlsx, .xls, .csv)'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Directly parses Staff Name, Role, Designation, Mobile Phone & PAN
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); downloadTeamExcelTemplate(); }}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-500 text-[11px] font-bold shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <Download size={13} /> Download Team Template
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            )
          ) : (
            /* Live Preview Table Before Committing */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Parsed Team Preview ({sourceName})</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      {validCount} Valid
                    </span>
                    {invalidCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-700 dark:text-red-300 text-[10px] font-bold">
                        {invalidCount} Invalid (Skipped)
                      </span>
                    )}
                  </h4>
                </div>

                <button
                  onClick={() => setParsedRows([])}
                  className="text-xs text-slate-500 hover:text-red-500 font-bold flex items-center gap-1"
                >
                  <Trash2 size={13} /> Clear Preview
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Staff Name</th>
                      <th className="p-2.5">Role</th>
                      <th className="p-2.5">Designation</th>
                      <th className="p-2.5">Mobile Phone</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Login PIN</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {parsedRows.map((row, idx) => (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${!row.isValid ? 'bg-red-500/10' : ''}`}
                      >
                        <td className="p-2.5">
                          {row.isValid ? (
                            <span className="text-emerald-500 font-bold flex items-center gap-1">
                              <Check size={14} /> Ready
                            </span>
                          ) : (
                            <span className="text-red-500 font-bold text-[10px]" title={row.validationError}>
                              ⚠ {row.validationError}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          {row.name}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            row.role === 'ADMIN'
                              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                              : 'bg-blue-500/20 text-blue-800 dark:text-blue-300'
                          }`}>
                            {row.role}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          {row.designation || '-'}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          {row.phone || '-'}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          {row.email || '-'}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] font-bold text-amber-600">
                          {row.pin || '1234'}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded"
                            title="Remove row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
          <div className="text-xs text-slate-500 font-medium">
            {parsedRows.length > 0 ? (
              <span><strong>{validCount}</strong> staff members ready to import (Duplicates auto-merged)</span>
            ) : (
              <span>Template headers: Staff Name, Role, Designation, Mobile Number, Email, PAN, PIN</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Cancel
            </button>

            {parsedRows.length > 0 && (
              <button
                onClick={handleCommitImport}
                disabled={validCount === 0}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Check size={15} /> Confirm & Import {validCount} Staff Members
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
