import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  Download, 
  Trash2, 
  Building, 
  Sparkles,
  Link,
  Cloud,
  ExternalLink,
  RefreshCw,
  Database,
  Edit3,
  Save,
  ShieldCheck
} from 'lucide-react';
import { useTasks } from '../../context/TaskContext';
import { 
  parseClientsFromFile, 
  parseClientsFromGoogleSheet, 
  ParsedClientRow, 
  downloadClientExcelTemplate,
  detectEntityCategoryFromPANAndGSTIN
} from '../../utils/masterImportExport';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { ClientCategory, Client } from '../../types';
import { classifyAndExtractDocument, DocumentClassificationResult } from '../../services/documentOCRService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_MASTER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1GcG1ekpVnewJo034_yttoP92qIYEeO_2uBacAgpwCqU/edit?pli=1&gid=0#gid=0';

export const ClientImportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { clients, addClient, updateClient, settings, updateSettings, team } = useTasks();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose, isOpen);

  const [activeSource, setActiveSource] = useState<'FILE' | 'GOOGLE_SHEET'>('GOOGLE_SHEET');
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>(() => {
    return settings.masterGoogleSheetUrl || localStorage.getItem('taskvaani_master_google_sheet_url') || DEFAULT_MASTER_SHEET_URL;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedClientRow[]>([]);
  const [sourceName, setSourceName] = useState<string>('');
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [importSuccessSummary, setImportSuccessSummary] = useState<string | null>(null);
  const [misclassificationAlert, setMisclassificationAlert] = useState<{ fileName: string; domain: string; title: string; summary: string } | null>(null);

  // Row Editing State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<ParsedClientRow | null>(null);

  useEffect(() => {
    if (settings.masterGoogleSheetUrl) {
      setGoogleSheetUrl(settings.masterGoogleSheetUrl);
    }
  }, [settings.masterGoogleSheetUrl]);

  if (!isOpen) return null;

  const handleMultipleFilesProcess = async (files: File[], bypassCheck: boolean = false) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    setErrorMsg(null);
    setMisclassificationAlert(null);
    setImportSuccessCount(null);
    setImportSuccessSummary(null);
    setSourceName(files.length === 1 ? files[0].name : `${files.length} Files (${files.map(f => f.name).slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''})`);

    try {
      let allRows: ParsedClientRow[] = [];
      for (const file of files) {
        if (!bypassCheck) {
          const classification = await classifyAndExtractDocument(file, clients, team);
          if (classification.domain === 'TEAM_DIRECTORY' || classification.domain === 'DOCUMENT_VAULT') {
            setMisclassificationAlert({
              fileName: file.name,
              domain: classification.domain === 'TEAM_DIRECTORY' ? 'Team Directory' : 'Document Vault',
              title: classification.title,
              summary: classification.summary
            });
            setLoading(false);
            return;
          }
        }
        const rows = await parseClientsFromFile(file);
        allRows = [...allRows, ...rows];
      }
      setParsedRows(allRows);
      if (allRows.length === 1) {
        setEditingIndex(0);
        setEditFormData({ ...allRows[0] });
      }
    } catch (err: any) {
      console.warn('Import parse error:', err);
      setErrorMsg(err.message || 'Failed to read files. Please ensure valid Excel, PDF or image documents.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileProcess = (file: File) => {
    handleMultipleFilesProcess([file]);
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
      const rows = await parseClientsFromGoogleSheet(urlToFetch);
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
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) handleMultipleFilesProcess(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleMultipleFilesProcess(files);
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
    const tradeName = editFormData.tradeName.trim();
    const pan = editFormData.pan.trim().toUpperCase();
    const gstin = (editFormData.gstin || '').trim().toUpperCase();

    // Auto-detect accurate category from PAN/GSTIN
    const category = detectEntityCategoryFromPANAndGSTIN(
      pan, 
      gstin, 
      tradeName, 
      editFormData.legalName, 
      editFormData.category
    );

    const isValid = !!tradeName && (!!pan || !!gstin);
    const validationError = !tradeName 
      ? 'Trade Name is missing' 
      : (!pan && !gstin ? 'PAN or GSTIN required' : '');

    updated[editingIndex] = {
      ...editFormData,
      tradeName,
      legalName: editFormData.legalName?.trim() || tradeName,
      pan,
      gstin: gstin || undefined,
      category,
      isValid,
      validationError
    };

    setParsedRows(updated);
    setEditingIndex(null);
    setEditFormData(null);
  };

  const handleCommitImport = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    let updatedCount = 0;
    let createdCount = 0;

    validRows.forEach(row => {
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

    setImportSuccessCount(validRows.length);
    setImportSuccessSummary(`✨ ${createdCount} New Clients created, 🔄 ${updatedCount} Existing Profiles updated (0 Duplicate Records).`);
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
            <Building size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">
              Import Clients (PDF / Excel / Google Drive Sheet)
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Live Inline Edit • Permanent Google Drive Sheet • Zero Duplication • Auto-Status by PAN & GSTIN
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
            <Upload size={15} /> 📂 Upload PDF / Excel File
          </button>
        </div>

        {/* Success Alert */}
        {importSuccessCount !== null && (
          <div className="mb-4 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={18} className="text-emerald-500 font-bold" />
              <span>
                <strong>{importSuccessCount} Clients</strong> successfully imported/updated into Master Directory without any duplicates!
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
                  💡 <strong>Auto-Status Active:</strong> Sheet ke clients ka status PAN aur GSTIN ke 4th character ke mutabik accurate detect ho kar import hoga.
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
                    {loading ? 'Reading & Parsing File...' : 'Click or Drag & Drop PDF / Excel (.xlsx, .xls, .csv)'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Directly parses GST REG-06, PAN Cards, Trade Name, Legal Name, PAN, GSTIN & Category
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); downloadClientExcelTemplate(); }}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-500 text-[11px] font-bold shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <Download size={13} /> Download Excel Template
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.csv,image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            )
          ) : (
            /* Live Preview & In-place Edit View */
            <div className="space-y-4">
              
              {/* 1. Inline Client Edit Modal / Card */}
              {editingIndex !== null && editFormData && (
                <div className="p-4 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 shadow-xl space-y-3.5 animate-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-500/30">
                    <div className="flex items-center gap-2">
                      <Edit3 className="text-amber-600 dark:text-amber-400" size={16} />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        Edit Client Details #{editingIndex + 1}
                      </span>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/30">
                      Live Editable Preview
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Trade Name *</label>
                      <input
                        type="text"
                        value={editFormData.tradeName}
                        onChange={(e) => setEditFormData({ ...editFormData, tradeName: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Legal Registered Name</label>
                      <input
                        type="text"
                        value={editFormData.legalName || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, legalName: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-600 uppercase">PAN Number *</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={editFormData.pan}
                        onChange={(e) => {
                          const upper = e.target.value.toUpperCase();
                          const detected = detectEntityCategoryFromPANAndGSTIN(upper, editFormData.gstin, editFormData.tradeName, editFormData.legalName);
                          setEditFormData({ ...editFormData, pan: upper, category: detected });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 font-mono font-black text-amber-800 dark:text-amber-300 text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">GSTIN Number</label>
                      <input
                        type="text"
                        maxLength={15}
                        value={editFormData.gstin || ''}
                        onChange={(e) => {
                          const upper = e.target.value.toUpperCase();
                          let newPan = editFormData.pan;
                          if (upper.length === 15 && (!newPan || newPan.length !== 10)) {
                            newPan = upper.substring(2, 12);
                          }
                          const detected = detectEntityCategoryFromPANAndGSTIN(newPan, upper, editFormData.tradeName, editFormData.legalName);
                          setEditFormData({ ...editFormData, gstin: upper, pan: newPan, category: detected });
                        }}
                        placeholder="Optional"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Entity Constitution</label>
                      <select
                        value={editFormData.category || 'PVT_LTD'}
                        onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value as ClientCategory })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-semibold text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      >
                        <option value="PVT_LTD">Private Limited</option>
                        <option value="LLP">LLP</option>
                        <option value="PARTNERSHIP">Partnership Firm</option>
                        <option value="PROPRIETOR">Proprietorship</option>
                        <option value="INDIVIDUAL">Individual</option>
                        <option value="TRUST">Trust / NGO</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">TAN Number</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={editFormData.tan || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, tan: e.target.value.toUpperCase() })}
                        placeholder="Optional"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 font-mono text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Contact Person</label>
                      <input
                        type="text"
                        value={editFormData.contactPerson || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Mobile Phone</label>
                      <input
                        type="text"
                        value={editFormData.phone || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase">Email Address</label>
                      <input
                        type="text"
                        value={editFormData.email || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-500/30">
                    <button
                      onClick={() => { setEditingIndex(null); setEditFormData(null); }}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold"
                    >
                      Cancel Edit
                    </button>
                    <button
                      onClick={handleSaveEditedRow}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                    >
                      <Save size={13} /> Save Row Changes
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Parsed Data Table with [Edit] and [Delete] buttons */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Parsed Data Preview ({sourceName})</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      {validCount} Ready
                    </span>
                    {invalidCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-700 dark:text-red-300 text-[10px] font-bold">
                        {invalidCount} Needs Review
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

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Trade Name</th>
                      <th className="p-2.5">PAN Number</th>
                      <th className="p-2.5">GSTIN</th>
                      <th className="p-2.5">Entity Type</th>
                      <th className="p-2.5">Contact Person</th>
                      <th className="p-2.5">Mobile Phone</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {parsedRows.map((row, idx) => {
                      const isExisting = clients.some(c => 
                        (row.pan && row.pan !== 'PAN-PENDING' && c.pan?.toUpperCase() === row.pan.toUpperCase()) ||
                        (row.gstin && c.gstin?.toUpperCase() === row.gstin.toUpperCase()) ||
                        (row.tradeName && c.tradeName.toLowerCase() === row.tradeName.toLowerCase())
                      );

                      return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${!row.isValid ? 'bg-red-500/10' : ''} ${editingIndex === idx ? 'bg-amber-500/15' : ''}`}
                      >
                        <td className="p-2.5">
                          {row.isValid ? (
                            isExisting ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-500/30">
                                🔄 Update
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                                ✨ New
                              </span>
                            )
                          ) : (
                            <span className="text-red-500 font-bold text-[10px]" title={row.validationError}>
                              ⚠ {row.validationError}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          <div>{row.tradeName}</div>
                          {isExisting && <div className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">Existing profile will be updated</div>}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                          {row.pan}
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">
                          {row.gstin || '-'}
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-[10px] font-bold">
                            {row.category}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          {row.contactPerson || '-'}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">
                          {row.phone || '-'}
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* [Edit] Button */}
                            <button
                              onClick={() => startEditRow(idx)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 font-bold text-[10px] flex items-center gap-1 transition-all"
                              title="Edit Client Row"
                            >
                              <Edit3 size={11} /> Edit
                            </button>

                            {/* [Delete] Button */}
                            <button
                              onClick={() => handleRemoveRow(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded"
                              title="Remove row"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
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
              <span><strong>{validCount}</strong> clients ready to import (Click <strong>Edit</strong> to modify any field)</span>
            ) : (
              <span>PDF / Excel templates auto-detect Trade Name, PAN, GSTIN & Category</span>
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
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-95"
              >
                <Check size={15} /> Confirm & Import {validCount} Clients
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
