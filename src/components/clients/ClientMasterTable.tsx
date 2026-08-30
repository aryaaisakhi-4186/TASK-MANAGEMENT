import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { Client } from '../../types';
import { ExcelService } from '../../services/excelService';
import { PDFService } from '../../services/pdfService';
import { 
  Building, 
  Plus, 
  Search, 
  Download, 
  Upload, 
  Edit3, 
  Trash2, 
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { ClientFormModal } from './ClientFormModal';
import { ClientImportModal } from './ClientImportModal';
import { VoiceSearchBar } from '../common/VoiceSearchBar';

export const ClientMasterTable: React.FC = () => {
  const { clients, tasks, addClient, deleteClient, settings } = useTasks();
  const { currentRole } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<Client | null | 'NEW'>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const filteredClients = clients.filter(c => {
    if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        c.tradeName.toLowerCase().includes(q) ||
        c.legalName.toLowerCase().includes(q) ||
        c.pan.toLowerCase().includes(q) ||
        (c.gstin && c.gstin.toLowerCase().includes(q)) ||
        (c.tan && c.tan.toLowerCase().includes(q)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
        (c.employeeName && c.employeeName.toLowerCase().includes(q))
      );
    }
    return true;
  });

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
            Manage client identities, statutory registrations (PAN, GSTIN, TAN, VAT), employee sub-logins & KYC records
          </p>
        </div>

        {currentRole === 'ADMIN' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedClientForEdit('NEW')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all"
            >
              <Plus size={16} /> Add New Client
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

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
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

      {/* Master Table with Single Combined Statutory ID Column */}
      <GlassCard className="overflow-hidden" variant="elevated">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="p-3.5">Client & Legal Name</th>
                <th className="p-3.5">Statutory IDs (PAN / GST / TAN / VAT)</th>
                <th className="p-3.5">Entity Status / Type</th>
                <th className="p-3.5">Contact Person</th>
                <th className="p-3.5">Client Employee (Sub-Login)</th>
                <th className="p-3.5">Aadhar, DOB & Formation Date</th>
                <th className="p-3.5">Assigned CA Staff</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredClients.map(client => (
                <tr key={client.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/30 transition-colors group">
                  
                  {/* Client & Legal Name */}
                  <td className="p-3.5">
                    <p className="font-bold text-slate-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300">{client.tradeName}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{client.legalName}</p>
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
                  <td className="p-3.5 font-mono text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">PAN</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">{client.pan}</span>
                      </div>
                      
                      {client.gstin ? (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">GST</span>
                          <span className="text-slate-700 dark:text-slate-300">{client.gstin}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No GSTIN</span>
                      )}

                      {client.customFields && client.customFields.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {client.customFields.map(f => (
                            <span key={f.id} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20 text-[10px] font-mono">
                              <strong className="font-sans">{f.label}:</strong> {f.value}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                        {client.tan && client.tan !== 'N/A' && (
                          <span className="bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                            TAN: <strong className="text-slate-800 dark:text-slate-200">{client.tan}</strong>
                          </span>
                        )}
                        {client.vatNumber && client.vatNumber !== 'N/A' && (
                          <span className="bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                            VAT: <strong className="text-slate-800 dark:text-slate-200">{client.vatNumber}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Entity Status & Type */}
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-700 block w-fit mb-1">
                      {client.category}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${client.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/15 text-red-700'}`}>
                      ● {client.status}
                    </span>
                  </td>

                  {/* Contact Person */}
                  <td className="p-3.5 text-slate-700 dark:text-slate-300">
                    <p className="font-semibold text-slate-900 dark:text-white">{client.contactPerson || 'N/A'}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{client.phone}</p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[140px]">{client.email}</p>
                  </td>

                  {/* Client Employee (Sub-Login) */}
                  <td className="p-3.5">
                    <p className="font-bold text-slate-900 dark:text-white">{client.employeeName || 'No Employee Set'}</p>
                    <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      {client.employeePhone ? `Mob: ${client.employeePhone} (PIN: ${client.employeePhone.slice(-4)})` : '-'}
                    </p>
                  </td>

                  {/* Aadhar, DOB & Formation Date */}
                  <td className="p-3.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    <p className="text-slate-900 dark:text-white font-semibold">Aadhar: {client.aadharNumber || 'N/A'}</p>
                    <p className="text-[10px] text-slate-500">DOB: {client.dob || 'N/A'}</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">Formed: {client.formationDate || 'N/A'}</p>
                  </td>

                  {/* Assigned Staff */}
                  <td className="p-3.5 text-slate-700 dark:text-slate-300 font-semibold">
                    {client.assignedTeamName}
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedClientForEdit(client)}
                        title="Edit Client Master Details"
                        className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-900 dark:text-amber-300 hover:text-slate-950 font-bold transition-all border border-amber-500/30 flex items-center gap-1 text-[11px] px-2"
                      >
                        <Edit3 size={13} /> Edit
                      </button>

                      <button
                        onClick={() => handleDownloadPDF(client)}
                        title="Email PDF Compliance Certificate"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-600 dark:text-slate-400 transition-colors"
                      >
                        <FileText size={14} />
                      </button>

                      {currentRole === 'ADMIN' && (
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
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Edit / Add Client Modal */}
      <ClientFormModal
        isOpen={selectedClientForEdit !== null}
        client={selectedClientForEdit === 'NEW' ? null : selectedClientForEdit}
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
