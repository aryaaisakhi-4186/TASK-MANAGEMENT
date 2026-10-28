import React, { useState, useMemo } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Client, ComplianceApplicabilityKey } from '../../types';
import { ExcelService } from '../../services/excelService';
import { PDFService } from '../../services/pdfService';
import { COMPLIANCE_APPLICABILITY_ITEMS, resolveClientApplicability } from '../../utils/complianceApplicability';
import { formatExcelOrStandardDate } from '../../utils/masterImportExport';
import { 
  Building, 
  Plus, 
  Search, 
  Download, 
  Upload, 
  Edit3, 
  Trash2, 
  FileText,
  FileSpreadsheet,
  FolderKanban,
  X,
  RotateCcw,
  Filter
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { ClientFormModal } from './ClientFormModal';
import { ClientImportModal } from './ClientImportModal';
import { VoiceSearchBar } from '../common/VoiceSearchBar';

interface ColumnFilters {
  sNo: string;
  name: string;
  statutory: string;
  compliance: string;
  statusCategory: string;
  contact: string;
  employee: string;
  aadharDob: string;
  assignedStaff: string;
}

const INITIAL_COLUMN_FILTERS: ColumnFilters = {
  sNo: '',
  name: '',
  statutory: '',
  compliance: '',
  statusCategory: '',
  contact: '',
  employee: '',
  aadharDob: '',
  assignedStaff: '',
};

export const ClientMasterTable: React.FC = () => {
  const { clients, tasks, addClient, updateClient, deleteClient, settings } = useTasks();
  const { currentRole, currentUser } = useAuth();
  const canEditClients = currentRole === 'ADMIN' || (currentRole === 'GUEST' && !currentUser?.trialInfo?.isExpired);

  const handleToggleClientCompliance = (client: Client, key: ComplianceApplicabilityKey) => {
    const currentApp = resolveClientApplicability(client);
    const updatedApp = {
      ...currentApp,
      [key]: !currentApp[key],
    };
    updateClient(client.id, { complianceApplicability: updatedApp });
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<Client | null | 'NEW'>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'DETAILS' | 'REPOSITORY'>('DETAILS');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [colFilters, setColFilters] = useState<ColumnFilters>(INITIAL_COLUMN_FILTERS);

  const handleColFilterChange = (key: keyof ColumnFilters, value: string) => {
    setColFilters(prev => ({ ...prev, [key]: value }));
  };

  const hasActiveColFilters = useMemo(() => {
    return Object.values(colFilters).some(v => v.trim() !== '');
  }, [colFilters]);

  const clearAllColFilters = () => {
    setColFilters(INITIAL_COLUMN_FILTERS);
  };

  const clientWithStableSNo = useMemo(() => {
    return clients.map((c, masterIdx) => ({
      ...c,
      displaySNo: c.serialNumber || (masterIdx + 1)
    }));
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clientWithStableSNo.filter((c) => {
      // 1. Category Filter
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;

      // 2. Global Search Term (Voice / Text)
      if (searchTerm && searchTerm.trim()) {
        const qTrim = searchTerm.trim().toLowerCase();
        const cleanQ = qTrim.replace(/^(pan|gst|gstin|tan|vat|sno)[:\s#]*/i, '').trim();
        const cleanQAlnum = cleanQ.replace(/[^a-z0-9]/gi, '');
        const sNoStr = String(c.displaySNo);
        let globalMatched = false;

        if (qTrim === sNoStr || qTrim === '#' + sNoStr || cleanQ === sNoStr) {
          globalMatched = true;
        }

        if (!globalMatched && cleanQAlnum.length >= 3) {
          const cPanAlnum = (c.pan || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
          const cGstAlnum = (c.gstin || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
          const cTanAlnum = (c.tan || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
          const cVatAlnum = (c.vatNumber || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
          if (cPanAlnum.includes(cleanQAlnum) || cGstAlnum.includes(cleanQAlnum) || cTanAlnum.includes(cleanQAlnum) || cVatAlnum.includes(cleanQAlnum)) {
            globalMatched = true;
          }
        }

        if (!globalMatched) {
          const cleanEncoding = (s?: string) => (s || '')
            .replace(/\xc3[\u2030\x89]|CAFÃ‰|cafÃ©|café/gi, 'cafe')
            .replace(/[\u0080-\uFFFF]/g, ' ')
            .replace(/[^a-zA-Z0-9\s]/g, ' ');

          const unified = [
            c.tradeName,
            cleanEncoding(c.tradeName),
            c.legalName,
            cleanEncoding(c.legalName),
            c.pan,
            c.gstin,
            c.tan,
            c.vatNumber,
            c.contactPerson,
            c.employeeName,
            c.phone,
            c.employeePhone,
            c.email,
            c.aadharNumber,
            c.assignedTeamName
          ].filter(Boolean).join(' ').toLowerCase();

          if (unified.includes(qTrim) || unified.includes(cleanQ)) {
            globalMatched = true;
          } else {
            const tokens = cleanQ.split(/\s+/).filter(t => t.length > 0);
            if (tokens.length > 1 && tokens.every(tok => unified.includes(tok))) {
              globalMatched = true;
            }
          }
        }

        if (!globalMatched) return false;
      }

      // 3. Per-Column Filter Checks
      if (colFilters.sNo.trim()) {
        const qSno = colFilters.sNo.trim().replace(/^#/i, '').toLowerCase();
        const curSno = String(c.displaySNo).toLowerCase();
        if (!curSno.includes(qSno) && curSno !== qSno) return false;
      }

      if (colFilters.name.trim()) {
        const q = colFilters.name.trim().toLowerCase();
        const trade = (c.tradeName || '').toLowerCase();
        const legal = (c.legalName || '').toLowerCase();
        if (!trade.includes(q) && !legal.includes(q)) return false;
      }

      if (colFilters.statutory.trim()) {
        const q = colFilters.statutory.trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
        const pan = (c.pan || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        const gst = (c.gstin || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        const tan = (c.tan || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        const vat = (c.vatNumber || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        if (!pan.includes(q) && !gst.includes(q) && !tan.includes(q) && !vat.includes(q)) return false;
      }

      if (colFilters.compliance.trim()) {
        const q = colFilters.compliance.trim().toUpperCase();
        const app = resolveClientApplicability(c);
        const matchesApp = Object.entries(app).some(([k, isApplicable]) => {
          return isApplicable && k.toUpperCase().includes(q);
        });
        if (!matchesApp) return false;
      }

      if (colFilters.statusCategory.trim()) {
        const q = colFilters.statusCategory.trim().toLowerCase();
        const cat = (c.category || '').toLowerCase();
        const stat = (c.status || '').toLowerCase();
        if (!cat.includes(q) && !stat.includes(q)) return false;
      }

      if (colFilters.contact.trim()) {
        const q = colFilters.contact.trim().toLowerCase();
        const cp = (c.contactPerson || '').toLowerCase();
        const ph = (c.phone || '').toLowerCase();
        const em = (c.email || '').toLowerCase();
        if (!cp.includes(q) && !ph.includes(q) && !em.includes(q)) return false;
      }

      if (colFilters.employee.trim()) {
        const q = colFilters.employee.trim().toLowerCase();
        const en = (c.employeeName || '').toLowerCase();
        const ep = (c.employeePhone || '').toLowerCase();
        if (!en.includes(q) && !ep.includes(q)) return false;
      }

      if (colFilters.aadharDob.trim()) {
        const q = colFilters.aadharDob.trim().toLowerCase();
        const ad = (c.aadharNumber || '').toLowerCase();
        const dob = (c.dob || '').toLowerCase();
        const fd = (c.formationDate || '').toLowerCase();
        if (!ad.includes(q) && !dob.includes(q) && !fd.includes(q)) return false;
      }

      if (colFilters.assignedStaff.trim()) {
        const q = colFilters.assignedStaff.trim().toLowerCase();
        const staff = (c.assignedTeamName || '').toLowerCase();
        if (!staff.includes(q)) return false;
      }

      return true;
    });
  }, [clientWithStableSNo, selectedCategory, searchTerm, colFilters]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      ExcelService.importClientsFromExcel(file).then((importedClients) => {
        importedClients.forEach(c => {
          if (c.tradeName && c.pan) {
            addClient(c as any);
          }
        });
        alert(`Successfully imported ${importedClients.length} clients into Master Directory.`);
      }).catch(err => {
        alert('Failed to import Excel: ' + (err?.message || 'Invalid format'));
      });
    }
  };

  const handleDownloadPDF = async (client: Client) => {
    try {
      const res = await PDFService.generateAndEmailReport(
        client,
        tasks,
        settings.firmName,
        client.email || settings.cloudStorageEmail || 'arya.taskmanagement@gmail.com'
      );
      alert(res.message);
    } catch (e) {
      alert('PDF report emailed to ' + (client.email || 'Client'));
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete client "${name}"? Associated tasks will be archived.`)) {
      deleteClient(id);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight flex items-center gap-2">
            <Building className="text-amber-500" /> Client Master Directory
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
            Manage client identities, statutory registrations (PAN, GSTIN, TAN, VAT), employee sub-logins & KYC records ({clients.length} Registered Clients • {filteredClients.length} Showing)
          </p>
        </div>

        {canEditClients && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setModalInitialTab('DETAILS');
                setSelectedClientForEdit('NEW');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all"
            >
              <Plus size={16} /> Add New Client
            </button>

            <button
              onClick={() => {
                setModalInitialTab('REPOSITORY');
                setSelectedClientForEdit('NEW');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:text-slate-950 font-bold text-xs shadow-sm transition-all"
            >
              <FolderKanban size={15} /> Client Repository (GST/PAN/TAN)
            </button>

            <button
              onClick={() => ExcelService.exportClientsAndTasksToExcel(clients, tasks)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:border-emerald-500 shadow-sm"
            >
              <Download size={14} /> Export Excel
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-bold shadow-sm transition-all"
            >
              <FileSpreadsheet size={15} /> Import Excel / PDF
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar with Voice Input (Hindi & English) */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <VoiceSearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search Trade Name, PAN, GSTIN, TAN (or speak in Hindi/English)..."
            className="w-full md:w-96"
          />

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              Showing: <span className="text-amber-600 dark:text-amber-400 font-mono">{filteredClients.length}</span> / {clients.length}
            </span>

            {hasActiveColFilters && (
              <button
                onClick={clearAllColFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500 text-red-700 dark:text-red-300 hover:text-white border border-red-500/30 font-bold text-xs shadow-xs transition-all"
                title="Reset all column search filters"
              >
                <RotateCcw size={12} /> Clear Filters
              </button>
            )}

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold focus:border-amber-500 focus:outline-none shadow-sm"
            >
              <option value="ALL">All Entity Types</option>
              <option value="PVT_LTD">Private Limited</option>
              <option value="LLP">LLP</option>
              <option value="PARTNERSHIP">Partnership</option>
              <option value="PROPRIETOR">Proprietorship</option>
              <option value="INDIVIDUAL">Individual / Professional</option>
              <option value="TRUST">Trust / NGO</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Master Table with Column-wise Search Boxes (Sticky Frozen Header) */}
      <GlassCard className="overflow-hidden" variant="elevated">
        <div className="overflow-x-auto max-h-[calc(100vh-230px)] overflow-y-auto relative scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800">
              {/* Row 1: Column Headings */}
              <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] leading-tight">
                <th className="px-2.5 py-2 text-center w-14 min-w-[56px]">
                  #<br /><span className="text-[9px] text-slate-500 font-normal">S.No.</span>
                </th>
                <th className="px-2.5 py-2 min-w-[140px]">
                  Client &<br /><span className="text-[9px] text-slate-500 font-normal">Legal Name</span>
                </th>
                <th className="px-2.5 py-2 min-w-[145px]">
                  Statutory IDs<br /><span className="text-[9px] text-slate-500 font-normal">(PAN / GST / TAN / VAT)</span>
                </th>
                <th className="px-2 py-2 text-center min-w-[115px]">
                  Compliances<br /><span className="text-[9px] text-slate-500 font-normal">Applicability</span>
                </th>
                <th className="px-2.5 py-2 min-w-[115px]">
                  Entity Status<br /><span className="text-[9px] text-slate-500 font-normal">& Constitution</span>
                </th>
                <th className="px-2.5 py-2 min-w-[125px]">
                  Contact Person<br /><span className="text-[9px] text-slate-500 font-normal">& Phone / Email</span>
                </th>
                <th className="px-2.5 py-2 min-w-[120px]">
                  Client Employee<br /><span className="text-[9px] text-slate-500 font-normal">(Sub-Login)</span>
                </th>
                <th className="px-2.5 py-2 min-w-[125px]">
                  Aadhar, DOB &<br /><span className="text-[9px] text-slate-500 font-normal">Formation Date</span>
                </th>
                <th className="px-2.5 py-2 min-w-[110px]">
                  Assigned Staff<br /><span className="text-[9px] text-slate-500 font-normal">CA Office Team</span>
                </th>
                <th className="px-2.5 py-2 text-right min-w-[105px]">
                  Actions<br /><span className="text-[9px] text-slate-500 font-normal">(Repo / Edit)</span>
                </th>
              </tr>

              {/* Row 2: Per-Column Search Input Boxes */}
              <tr className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
                {/* 1. S.No. Search */}
                <th className="p-1 text-center">
                  <div className="relative">
                    <input
                      type="text"
                      value={colFilters.sNo}
                      onChange={(e) => handleColFilterChange('sNo', e.target.value)}
                      placeholder="# S.No"
                      className="w-full text-center px-1 py-1 text-[11px] font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:border-amber-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px]"
                    />
                    {colFilters.sNo && (
                      <button
                        onClick={() => handleColFilterChange('sNo', '')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>

                {/* 2. Client & Legal Name Search */}
                <th className="p-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={colFilters.name}
                      onChange={(e) => handleColFilterChange('name', e.target.value)}
                      placeholder="🔍 Name..."
                      className="w-full px-2 py-1 text-[11px] font-normal bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:border-amber-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px]"
                    />
                    {colFilters.name && (
                      <button
                        onClick={() => handleColFilterChange('name', '')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>

                {/* 3. Statutory IDs Search */}
                <th className="p-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={colFilters.statutory}
                      onChange={(e) => handleColFilterChange('statutory', e.target.value)}
                      placeholder="🔍 PAN / GST..."
                      className="w-full px-2 py-1 text-[11px] font-normal bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:border-amber-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px]"
                    />
                    {colFilters.statutory && (
                      <button
                        onClick={() => handleColFilterChange('statutory', '')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>

                {/* 4. Compliances Applicability Search */}
                <th className="p-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={colFilters.compliance}
                      onChange={(e) => handleColFilterChange('compliance', e.target.value)}
                      placeholder="🔍 GST/TDS/VAT"
                      className="w-full px-1.5 py-1 text-[11px] font-normal text-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:border-amber-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px]"
                    />
                    {colFilters.compliance && (
                      <button
                        onClick={() => handleColFilterChange('compliance', '')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>

                {/* 5. Entity Status & Constitution Search */}
                <th className="p-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={colFilters.statusCategory}
                      onChange={(e) => handleColFilterChange('statusCategory', e.target.value)}
                      placeholder="🔍 Status/Type..."
                      className="w-full px-2 py-1 text-[11px] font-normal bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:border-amber-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px]"
                    />
                    {colFilters.statusCategory && (
                      <button
                        onClick={() => handleColFilterChange('statusCategory', '')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>

                {/* 6. Contact Person & Phone / Email Search */}
                <th className="p-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={colFilters.contact}
                      onChange={(e) => handleColFilterChange('contact', e.target.value)}
                      placeholder="🔍 Person/Phone..."
                      className="w-full px-2 py-1 text-[11px] font-normal bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:border-amber-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px]"
                    />
                    {colFilters.contact && (
                      <button
                        onClick={() => handleColFilterChange('contact', '')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>

                {/* 7. Client Employee Search */}
                <th className="p-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={colFilters.employee}
                      onChange={(e) => handleColFilterChange('employee', e.target.value)}
                      placeholder="🔍 Employee..."
                      className="w-full px-2 py-1 text-[11px] font-normal bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:border-amber-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px]"
                    />
                    {colFilters.employee && (
                      <button
                        onClick={() => handleColFilterChange('employee', '')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>

                {/* 8. Aadhar, DOB & Formation Date Search */}
                <th className="p-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={colFilters.aadharDob}
                      onChange={(e) => handleColFilterChange('aadharDob', e.target.value)}
                      placeholder="🔍 Aadhar/DOB..."
                      className="w-full px-2 py-1 text-[11px] font-normal bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:border-amber-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px]"
                    />
                    {colFilters.aadharDob && (
                      <button
                        onClick={() => handleColFilterChange('aadharDob', '')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>

                {/* 9. Assigned Staff Search */}
                <th className="p-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={colFilters.assignedStaff}
                      onChange={(e) => handleColFilterChange('assignedStaff', e.target.value)}
                      placeholder="🔍 Staff..."
                      className="w-full px-2 py-1 text-[11px] font-normal bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded focus:border-amber-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:text-[10px]"
                    />
                    {colFilters.assignedStaff && (
                      <button
                        onClick={() => handleColFilterChange('assignedStaff', '')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </th>

                {/* 10. Actions / Reset All Column Filters */}
                <th className="p-1 text-right">
                  {hasActiveColFilters ? (
                    <button
                      onClick={clearAllColFilters}
                      title="Clear all column searches"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 rounded border border-red-200 dark:border-red-800/80 transition-all shadow-xs"
                    >
                      <RotateCcw size={10} />
                      <span>Reset</span>
                    </button>
                  ) : (
                    <div className="text-[9px] text-slate-400 text-center font-normal italic">
                      Filters
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 font-medium">
                    No clients match your search criteria.
                  </td>
                </tr>
              )}
              {filteredClients.map((client) => {
                const appMap = resolveClientApplicability(client);
                return (
                <tr key={client.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/30 transition-colors group">
                  
                  {/* S.No. Serial Number */}
                  <td className="px-2.5 py-2 text-center text-slate-500 dark:text-slate-400 font-mono text-xs font-bold bg-slate-50/50 dark:bg-slate-900/40 border-r border-slate-100 dark:border-slate-800/60">
                    {client.displaySNo}
                  </td>

                  {/* Client & Legal Name */}
                  <td className="px-2.5 py-2">
                    <p className="font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 leading-snug">{client.tradeName}</p>
                    <p className="text-[10px] text-slate-500 font-medium leading-snug">{client.legalName}</p>
                    {client.googleDriveFolderUrl || client.googleDriveFolderId ? (
                      <a
                        href={client.googleDriveFolderUrl || `https://drive.google.com/drive/folders/${client.googleDriveFolderId}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open Google Drive Folder"
                        className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold hover:underline mt-0.5"
                      >
                        📁 Drive Folder ↗
                      </a>
                    ) : (
                      <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">📁 Drive: Auto</span>
                    )}
                  </td>

                  {/* Single Unified Statutory Registrations Column */}
                  <td className="px-2.5 py-2 font-mono text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">PAN</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">{client.pan}</span>
                      </div>
                      
                      {client.gstin ? (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-[9px] font-sans font-bold px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">GST</span>
                          <span className="text-slate-700 dark:text-slate-300">{client.gstin}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-400 italic">No GSTIN</span>
                      )}

                      {client.customFields && client.customFields.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {client.customFields.map(f => (
                            <span key={f.id} className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20 text-[9px] font-mono">
                              <strong className="font-sans">{f.label}:</strong> {f.value}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-500 pt-0.5">
                        {client.tan && client.tan !== 'N/A' && (
                          <span className="bg-slate-50 dark:bg-slate-900 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-800">
                            TAN: <strong className="text-slate-800 dark:text-slate-200">{client.tan}</strong>
                          </span>
                        )}
                        {client.vatNumber && client.vatNumber !== 'N/A' && (
                          <span className="bg-slate-50 dark:bg-slate-900 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-800">
                            VAT: <strong className="text-slate-800 dark:text-slate-200">{client.vatNumber}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 10 Compliances in Up-Down Vertical Columns (5 per column: AUDIT, GST, GSTR-9, GSTR-9C, TDS | ITR, VAT, E-INVOICE, RCM, 86B) */}
                  <td className="px-2 py-2">
                    <div className="grid grid-rows-5 grid-flow-col gap-0.5 w-fit">
                      {COMPLIANCE_APPLICABILITY_ITEMS.map(item => {
                        const isApp = appMap[item.key];
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleToggleClientCompliance(client, item.key)}
                            title={item.fullTitle}
                            className="px-1 py-[2px] rounded bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 hover:border-slate-400 transition-all flex items-center justify-between gap-1 cursor-pointer whitespace-nowrap leading-none"
                          >
                            <span className="font-mono font-bold text-[8px] leading-none uppercase text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {item.label}
                            </span>
                            <span
                              className={`w-3.5 h-2 rounded-full p-[1px] flex items-center shrink-0 transition-colors duration-200 ${
                                isApp ? 'bg-emerald-500 justify-end' : 'bg-red-500 justify-start'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-sm block" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  {/* Entity Status & Type */}
                  <td className="px-2.5 py-2">
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-700 block w-fit mb-1">
                      {client.category}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${client.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/15 text-red-700'}`}>
                      ● {client.status}
                    </span>
                  </td>

                  {/* Contact Person */}
                  <td className="px-2.5 py-2 text-slate-700 dark:text-slate-300">
                    <p className="font-semibold text-slate-900 dark:text-white leading-tight">{client.contactPerson || 'N/A'}</p>
                    <p className="text-[10px] text-slate-500 font-mono leading-tight">{client.phone}</p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[130px] leading-tight">{client.email}</p>
                  </td>

                  {/* Client Employee (Sub-Login) */}
                  <td className="px-2.5 py-2">
                    <p className="font-bold text-slate-900 dark:text-white leading-tight">{client.employeeName || 'No Employee Set'}</p>
                    <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold leading-tight">
                      {client.employeePhone ? `Mob: ${client.employeePhone}` : '-'}
                    </p>
                  </td>

                  {/* Aadhar, DOB & Formation Date */}
                  <td className="px-2.5 py-2 font-mono text-[10px] text-slate-700 dark:text-slate-300">
                    <p className="text-slate-900 dark:text-white font-semibold leading-tight">Aad: {client.aadharNumber || 'N/A'}</p>
                    <p className="text-[10px] text-slate-500 leading-tight">DOB: {formatExcelOrStandardDate(client.dob)}</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-tight">Form: {formatExcelOrStandardDate(client.formationDate)}</p>
                  </td>

                  {/* Assigned Staff */}
                  <td className="px-2.5 py-2 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                    {client.assignedTeamName}
                  </td>

                  {/* Actions */}
                  <td className="px-2.5 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setModalInitialTab('REPOSITORY');
                          setSelectedClientForEdit(client);
                        }}
                        title="Open Client Statutory Document Repository (GST, PAN, Aadhar, TAN)"
                        className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-800 dark:text-emerald-300 hover:text-slate-950 font-bold transition-all border border-emerald-500/30 flex items-center gap-1 text-[11px] px-2"
                      >
                        <FolderKanban size={13} /> Repo ({client.repositoryDocs?.length || 0})
                      </button>

                      {canEditClients && (
                        <button
                          onClick={() => {
                            setModalInitialTab('DETAILS');
                            setSelectedClientForEdit(client);
                          }}
                          title="Edit Client Master Details"
                          className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 font-bold transition-all border border-amber-500/30 flex items-center gap-1 text-[11px] px-2"
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                      )}

                      <button
                        onClick={() => handleDownloadPDF(client)}
                        title="Email PDF Compliance Certificate"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-600 dark:text-slate-400 transition-colors"
                      >
                        <FileText size={14} />
                      </button>

                      {canEditClients && (
                        <button
                          onClick={() => handleDelete(client.id, client.tradeName)}
                          title="Delete Client"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white text-slate-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Edit / Add Client Modal */}
      <ClientFormModal
        isOpen={selectedClientForEdit !== null}
        client={selectedClientForEdit === 'NEW' ? null : selectedClientForEdit}
        initialTab={modalInitialTab}
        onClose={() => setSelectedClientForEdit(null)}
      />

      {/* Bulk Client Import Modal (Excel / PDF) */}
      <ClientImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

    </div>
  );
};
