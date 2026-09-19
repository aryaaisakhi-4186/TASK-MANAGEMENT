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
  Database,
  Edit3,
  Save,
  ShieldCheck,
  Building,
  ArrowRight
} from 'lucide-react';
import { useTasks } from '../../context/TaskContext';
import { 
  parseTeamFromFile, 
  parseTeamFromGoogleSheet, 
  fetchGoogleSheetData,
  classifyRawTabularData,
  mapRawDataToTeam,
  mapRawDataToClients,
  ParsedTeamRow, 
  ParsedClientRow,
  downloadTeamExcelTemplate 
} from '../../utils/masterImportExport';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import * as XLSX from 'xlsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToClientImport?: () => void;
}

const DEFAULT_MASTER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1GcG1ekpVnewJo034_yttoP92qIYEeO_2uBacAgpwCqU/edit?pli=1&gid=0#gid=0';

export const TeamImportModal: React.FC<Props> = ({ isOpen, onClose, onSwitchToClientImport }) => {
  const { clients, team, addTeamMember, addClient, updateClient, settings, updateSettings } = useTasks();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose, isOpen);

  const [activeSource, setActiveSource] = useState<'FILE' | 'GOOGLE_SHEET'>('GOOGLE_SHEET');
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>(() => {
    return (settings as any).teamGoogleSheetUrl || settings.masterGoogleSheetUrl || localStorage.getItem('taskvaani_team_google_sheet_url') || DEFAULT_MASTER_SHEET_URL;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedTeamRow[]>([]);
  const [sourceName, setSourceName] = useState<string>('');
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [clientImportSuccessCount, setClientImportSuccessCount] = useState<number | null>(null);

  // Mismatch / Misclassification Guard Alert State
  const [misclassificationAlert, setMisclassificationAlert] = useState<{ 
    fileName: string; 
    domain: string; 
    title: string; 
    summary: string;
    sampleEntities: string[];
    clientRows?: ParsedClientRow[];
    rawData?: any[];
  } | null>(null);

  // Row Editing State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<ParsedTeamRow | null>(null);

  useEffect(() => {
    if ((settings as any).teamGoogleSheetUrl) {
      setGoogleSheetUrl((settings as any).teamGoogleSheetUrl);
    }
  }, [(settings as any).teamGoogleSheetUrl]);

  if (!isOpen) return null;

  // Process uploaded Excel / CSV / PDF File with Tabular Intelligence
  const handleFileProcess = async (file: File) => {
    setLoading(true);
    setErrorMsg(null);
    setMisclassificationAlert(null);
    setImportSuccessCount(null);
    setClientImportSuccessCount(null);
    setSourceName(file.name);

    try {
      const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
      if (isExcel) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawData || rawData.length === 0) {
          throw new Error('Uploaded sheet contains no data rows.');
        }

        const classification = classifyRawTabularData(rawData, file.name);

        if (classification.domain === 'CLIENT_MASTER') {
          setMisclassificationAlert({
            fileName: file.name,
            domain: 'Client Master',
            title: classification.detectedType,
            summary: classification.summary,
            sampleEntities: classification.sampleEntities,
            clientRows: classification.clientRows,
            rawData
          });
          setLoading(false);
          return;
        }

        if (classification.domain === 'DOCUMENT_VAULT') {
          setErrorMsg('⚠️ This spreadsheet contains Bank Statements / Transaction Vouchers. Please archive it in Document Vault.');
          setLoading(false);
          return;
        }

        setParsedRows(mapRawDataToTeam(rawData));
      } else {
        const rows = await parseTeamFromFile(file);
        setParsedRows(rows);
      }
    } catch (err: any) {
      console.warn('Team import parse error:', err);
      setErrorMsg(err.message || 'Failed to read file. Please ensure it is a valid Excel or PDF file.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch from Google Sheet with Automatic Domain Classification Guard
  const handleFetchGoogleSheet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const urlToFetch = googleSheetUrl.trim() || DEFAULT_MASTER_SHEET_URL;

    setLoading(true);
    setErrorMsg(null);
    setMisclassificationAlert(null);
    setImportSuccessCount(null);
    setClientImportSuccessCount(null);
    setSourceName('Google Drive Sheet');

    try {
      localStorage.setItem('taskvaani_team_google_sheet_url', urlToFetch);
      updateSettings({ 
        masterGoogleSheetUrl: urlToFetch
      });
    } catch (e) {
      console.warn('Save settings error:', e);
    }

    try {
      const rawData = await fetchGoogleSheetData(urlToFetch);
      if (!rawData || rawData.length === 0) {
        throw new Error('The Google Sheet contains no data rows.');
      }

      const classification = classifyRawTabularData(rawData, 'Google Drive Master Sheet');

      if (classification.domain === 'CLIENT_MASTER') {
        setMisclassificationAlert({
          fileName: 'Google Drive Master Sheet',
          domain: 'Client Master',
          title: classification.detectedType,
          summary: classification.summary,
          sampleEntities: classification.sampleEntities,
          clientRows: classification.clientRows,
          rawData
        });
        setLoading(false);
        return;
      }

      if (classification.domain === 'DOCUMENT_VAULT') {
        setErrorMsg('⚠️ This sheet contains Bank Statement / Financial Voucher data. Please import in Document Vault.');
        setLoading(false);
        return;
      }

      setParsedRows(mapRawDataToTeam(rawData));
    } catch (err: any) {
      console.warn('Google Sheet parse error:', err);
      setErrorMsg(err.message || 'Unable to read Google Sheet. Ensure link sharing is set to "Anyone with the link can view".');
    } finally {
      setLoading(false);
    }
  };

  // Direct 1-Click Import into Client Master when Client Sheet is Detected
  const handleImportDirectlyAsClients = () => {
    if (!misclassificationAlert || !misclassificationAlert.clientRows) return;
    const validClients = misclassificationAlert.clientRows.filter(r => r.isValid);
    if (validClients.length === 0) {
      setErrorMsg('No valid client records found to import.');
      return;
    }

    let createdCount = 0;
    let updatedCount = 0;

    validClients.forEach(row => {
      const normPan = row.pan?.trim().toUpperCase();
      const normGst = row.gstin?.trim().toUpperCase();
      const normName = row.tradeName?.trim().toLowerCase();

      const existingMatch = clients.find(c => {
        if (normPan && normPan !== 'PAN-PENDING' && c.pan?.trim().toUpperCase() === normPan) return true;
        if (normGst && c.gstin?.trim().toUpperCase() === normGst) return true;
        if (normName && c.tradeName?.trim().toLowerCase() === normName) return true;
        return false;
      });

      if (existingMatch) {
        updateClient(existingMatch.id, {
          tradeName: row.tradeName || existingMatch.tradeName,
          legalName: row.legalName || existingMatch.legalName || row.tradeName,
          pan: (normPan && normPan !== 'PAN-PENDING') ? normPan : existingMatch.pan,
          gstin: row.gstin || existingMatch.gstin,
          tan: row.tan || existingMatch.tan,
          category: row.category || existingMatch.category,
          contactPerson: row.contactPerson || existingMatch.contactPerson,
          phone: row.phone || existingMatch.phone,
          email: row.email || existingMatch.email,
          formationDate: row.formationDate || existingMatch.formationDate
        });
        updatedCount++;
      } else {
        addClient({
          tradeName: row.tradeName,
          legalName: row.legalName || row.tradeName,
          pan: row.pan,
          gstin: row.gstin,
          tan: row.tan,
          vatNumber: row.vatNumber,
          category: row.category,
          status: 'ACTIVE',
          contactPerson: row.contactPerson || '',
          phone: row.phone || '',
          email: row.email || '',
          employeeName: row.employeeName,
          employeePhone: row.employeePhone,
          aadharNumber: row.aadharNumber,
          dob: row.dob,
          formationDate: row.formationDate,
          assignedTeamId: '',
          assignedTeamName: row.assignedTeamName || 'Assigned Staff',
          portalPassword: 'client' + (row.phone ? row.phone.slice(-4) : '123'),
          googleDriveFolderId: row.googleDriveFolderId || '',
          googleDriveFolderUrl: row.googleDriveFolderUrl || '',
          customFields: []
        });
        createdCount++;
      }
    });

    setClientImportSuccessCount(validClients.length);
    setMisclassificationAlert(null);
  };

  // Force parse as Staff Members with manual editing option
  const handleForceParseAsTeam = () => {
    if (!misclassificationAlert || !misclassificationAlert.rawData) return;
    const teamRows = mapRawDataToTeam(misclassificationAlert.rawData);
    setParsedRows(teamRows);
    setMisclassificationAlert(null);
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
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditFormData(null);
    }
  };

  const startEditRow = (index: number) => {
    setEditingIndex(index);
    setEditFormData({ ...parsedRows[index] });
  };

  const handleSaveEditedRow = () => {
    if (editingIndex === null || !editFormData) return;
    const updated = [...parsedRows];
    const name = editFormData.name.trim();

    updated[editingIndex] = {
      ...editFormData,
      name,
      designation: editFormData.designation?.trim() || (editFormData.role === 'ADMIN' ? 'Senior CA / Partner' : 'Compliance Associate'),
      pin: editFormData.pin?.trim() || (editFormData.phone ? editFormData.phone.slice(-4) : '1234'),
      isValid: name.length > 1,
      validationError: name.length <= 1 ? 'Staff Name is missing' : ''
    };

    setParsedRows(updated);
    setEditingIndex(null);
    setEditFormData(null);
  };

  const toggleRowRole = (index: number) => {
    setParsedRows(prev => prev.map((row, i) => {
      if (i === index) {
        const nextRole: 'ADMIN' | 'TEAM' = row.role === 'ADMIN' ? 'TEAM' : 'ADMIN';
        const nextDesig = nextRole === 'ADMIN' ? 'Senior CA / Partner' : 'Compliance Associate';
        return {
          ...row,
          role: nextRole,
          designation: (row.designation === 'Compliance Associate' || row.designation === 'Senior CA / Partner') ? nextDesig : row.designation
        };
      }
      return row;
    }));
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
              Smart Dataset Classifier • Editable Roles & Designations • Zero Duplication
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

        {/* Misclassification Guard Alert: Client Master Sheet Detected */}
        {misclassificationAlert && (
          <div className="mb-4 p-4 rounded-3xl bg-amber-500/15 border-2 border-amber-500/50 text-xs animate-in zoom-in-95 space-y-3.5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/25 text-amber-800 dark:text-amber-300 shrink-0">
                <AlertCircle size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-amber-950 dark:text-amber-200 text-sm">
                    ⚠️ Client Master Dataset Detected in Team Import!
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-300 font-mono text-[10px] font-bold">
                    Domain: Client Master
                  </span>
                </div>

                <p className="text-slate-700 dark:text-slate-200 text-xs mt-1 leading-relaxed">
                  Aapne jo Google Sheet / File load ki hai usme <strong>Client Business Profiles</strong> hain (jaise: <em>{misclassificationAlert.sampleEntities.slice(0, 3).join(', ')}</em> with GSTIN / PAN), ye Team / Staff Roster nahi hai.
                </p>

                <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 font-medium bg-white/60 dark:bg-slate-950/60 p-2 rounded-xl border border-amber-500/20">
                  💡 <strong>Smart Recommendation:</strong> Inhe seedhe <strong>Client Master Database</strong> me import karein taaki har client ke profile me PAN, GSTIN aur trade details sahi jagah save hon.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-amber-500/30">
              <button
                onClick={() => setMisclassificationAlert(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 transition-all"
              >
                ✕ Cancel Preview
              </button>

              <button
                onClick={handleForceParseAsTeam}
                title="Edit and force import as staff members"
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200"
              >
                ✏️ Edit & Force Import as Staff
              </button>

              <button
                onClick={handleImportDirectlyAsClients}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/25 flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Building size={14} />
                <span>👉 Import Directly to Client Master (0 Duplicates)</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Team Import Success Alert */}
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

        {/* Client Master Import Success Alert */}
        {clientImportSuccessCount !== null && (
          <div className="mb-4 p-4 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={18} className="text-blue-500 font-bold" />
              <span>
                ✨ <strong>{clientImportSuccessCount} Client Profiles</strong> successfully saved directly into Client Master without duplicates!
              </span>
            </div>
            <button
              onClick={() => setClientImportSuccessCount(null)}
              className="font-bold underline ml-2"
            >
              Done
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
          
          {parsedRows.length === 0 && !misclassificationAlert ? (
            activeSource === 'GOOGLE_SHEET' ? (
              /* TAB 1: Google Sheet Source */
              <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Cloud className="text-amber-500" size={16} />
                    <span>Connected Google Drive Sheet</span>
                  </div>
                  <a
                    href={googleSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Open Sheet Online</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <form onSubmit={handleFetchGoogleSheet} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">
                      Google Drive Spreadsheet URL / ID
                    </label>
                    <input
                      type="text"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={downloadTeamExcelTemplate}
                      className="text-xs text-slate-500 hover:text-amber-500 font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Download size={13} /> Download Sample Team Template (.xlsx)
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                    >
                      {loading ? <RefreshCw className="animate-spin" size={14} /> : <Database size={14} />}
                      <span>Fetch & Classify Sheet</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* TAB 2: File Upload (Excel, CSV, PDF) */
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-300 dark:border-slate-800 hover:border-amber-400 bg-slate-50 dark:bg-slate-950/40'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center mb-3">
                  <FileSpreadsheet size={28} />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Drop Team Roster Excel, CSV or PDF here
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Supports .xlsx, .xls, .csv, and staff profile PDFs
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            )
          ) : parsedRows.length > 0 ? (
            /* Parsed Preview Table with Editable Rows */
            <div className="space-y-4">
              
              {/* 1. Inline Row Edit Panel */}
              {editingIndex !== null && editFormData && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                    <h5 className="font-bold text-xs text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Edit3 size={14} />
                      <span>Edit Staff Member Details (Row #{editingIndex + 1})</span>
                    </h5>
                    <span className="text-[10px] text-slate-500 font-mono">
                      PIN Auto-sync from Mobile No
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Staff Full Name *</label>
                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">System Role</label>
                      <select
                        value={editFormData.role || 'TEAM'}
                        onChange={(e) => {
                          const role = e.target.value as 'ADMIN' | 'TEAM';
                          setEditFormData({
                            ...editFormData,
                            role,
                            designation: role === 'ADMIN' ? 'Senior CA / Partner' : (editFormData.designation || 'Compliance Associate')
                          });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      >
                        <option value="TEAM">Team Associate (Staff)</option>
                        <option value="ADMIN">Admin / Partner</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Designation / Post</label>
                      <input
                        type="text"
                        value={editFormData.designation || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                        placeholder="e.g. Compliance Associate / CA"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-semibold text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Mobile Phone</label>
                      <input
                        type="text"
                        value={editFormData.phone || ''}
                        onChange={(e) => {
                          const phone = e.target.value;
                          setEditFormData({
                            ...editFormData,
                            phone,
                            pin: phone.length >= 4 ? phone.slice(-4) : editFormData.pin
                          });
                        }}
                        placeholder="+91 98000 00000"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Email Address</label>
                      <input
                        type="email"
                        value={editFormData.email || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        placeholder="staff@firm.com"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Login PIN (4-Digit)</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={editFormData.pin || '1234'}
                        onChange={(e) => setEditFormData({ ...editFormData, pin: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono font-bold text-amber-600 text-xs focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Designation Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500 font-bold">Quick Presets:</span>
                    {[
                      'Senior CA / Partner',
                      'Compliance Associate',
                      'Article Assistant',
                      'Tax Consultant',
                      'Accountant',
                      'Audit Executive'
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const role: 'ADMIN' | 'TEAM' = preset.includes('Partner') || preset.includes('Senior CA') ? 'ADMIN' : 'TEAM';
                          setEditFormData({ ...editFormData, designation: preset, role });
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-500 font-medium"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
                    <button
                      onClick={() => { setEditingIndex(null); setEditFormData(null); }}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300"
                    >
                      Cancel Edit
                    </button>
                    <button
                      onClick={handleSaveEditedRow}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                    >
                      <Save size={13} /> Save Staff Changes
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Parsed Data Table Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Parsed Team Preview ({sourceName})</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      {validCount} Valid
                    </span>
                    {invalidCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-700 dark:text-red-300 text-[10px] font-bold">
                        {invalidCount} Incomplete
                      </span>
                    )}
                  </h4>
                </div>

                <button
                  onClick={() => { setParsedRows([]); setEditingIndex(null); setEditFormData(null); }}
                  className="text-xs text-slate-500 hover:text-red-500 font-bold flex items-center gap-1"
                >
                  <Trash2 size={13} /> Clear Preview
                </button>
              </div>

              {/* 3. Table with Role/Designation editing & Toggle */}
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
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${!row.isValid ? 'bg-red-500/10' : ''} ${editingIndex === idx ? 'bg-amber-500/15' : ''}`}
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
                          <button
                            type="button"
                            onClick={() => toggleRowRole(idx)}
                            title="Click to toggle Role (ADMIN / TEAM)"
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all active:scale-95 ${
                              row.role === 'ADMIN'
                                ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                : 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30'
                            }`}
                          >
                            {row.role === 'ADMIN' ? '👑 ADMIN' : '👥 TEAM'}
                          </button>
                        </td>
                        <td className="p-2.5 text-slate-700 dark:text-slate-300 font-medium">
                          {row.designation || 'Compliance Associate'}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          {row.phone || '-'}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          {row.email || '-'}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                          {row.pin || '1234'}
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEditRow(idx)}
                              title="Edit Role, Designation, Name & PIN"
                              className="p-1 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-500/10 transition-all"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              title="Delete Row"
                              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          ) : null}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 && (
              <span><strong>{validCount}</strong> staff members ready to import (Duplicates auto-merged)</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all"
            >
              Cancel
            </button>

            {parsedRows.length > 0 && (
              <button
                onClick={handleCommitImport}
                disabled={validCount === 0}
                className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
              >
                <Check size={16} /> Confirm & Import {validCount} Staff Members
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
