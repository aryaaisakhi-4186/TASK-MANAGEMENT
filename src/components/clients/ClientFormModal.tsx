import React, { useState, useEffect } from 'react';
import { Client, ClientCategory, CustomField } from '../../types';
import { useTasks } from '../../context/TaskContext';
import { X, Building, UserCheck, ShieldCheck, Check, Layers, Plus, Trash2, Sparkles } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { detectEntityCategoryFromPANAndGSTIN } from '../../utils/masterImportExport';

interface Props {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
}

export const ClientFormModal: React.FC<Props> = ({ isOpen, client, onClose }) => {
  const { team, addClient, updateClient } = useTasks();
  const isEditing = !!client;

  useEscapeKey(onClose, isOpen);

  const [tradeName, setTradeName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [pan, setPan] = useState('');
  const [gstin, setGstin] = useState('');
  const [tan, setTan] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [category, setCategory] = useState<ClientCategory>('PVT_LTD');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [dob, setDob] = useState('');
  const [formationDate, setFormationDate] = useState('');
  const [assignedTeamId, setAssignedTeamId] = useState(team[0]?.id || '');
  const [portalPassword, setPortalPassword] = useState('client123');
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState('');
  const [googleDriveFolderUrl, setGoogleDriveFolderUrl] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  useEffect(() => {
    if (client) {
      setTradeName(client.tradeName || '');
      setLegalName(client.legalName || '');
      setPan(client.pan || '');
      setGstin(client.gstin || '');
      setTan(client.tan || '');
      setVatNumber(client.vatNumber || '');
      setCategory(client.category || 'PVT_LTD');
      setStatus(client.status || 'ACTIVE');
      setContactPerson(client.contactPerson || '');
      setPhone(client.phone || '');
      setEmail(client.email || '');
      setEmployeeName(client.employeeName || '');
      setEmployeePhone(client.employeePhone || '');
      setAadharNumber(client.aadharNumber || '');
      setDob(client.dob || '');
      setFormationDate(client.formationDate || '');
      setAssignedTeamId(client.assignedTeamId || team[0]?.id || '');
      setPortalPassword(client.portalPassword || 'client123');
      setGoogleDriveFolderId(client.googleDriveFolderId || '');
      setGoogleDriveFolderUrl(client.googleDriveFolderUrl || '');
      setCustomFields(client.customFields && Array.isArray(client.customFields) ? [...client.customFields] : []);
    } else {
      setTradeName('');
      setLegalName('');
      setPan('');
      setGstin('');
      setTan('');
      setVatNumber('');
      setCategory('PVT_LTD');
      setStatus('ACTIVE');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setEmployeeName('');
      setEmployeePhone('');
      setAadharNumber('');
      setDob('');
      setFormationDate('');
      setAssignedTeamId(team[0]?.id || '');
      setPortalPassword('client123');
      setGoogleDriveFolderId('');
      setGoogleDriveFolderUrl('');
      setCustomFields([]);
    }
  }, [client, team, isOpen]);

  if (!isOpen) return null;

  const handleAddCustomField = () => {
    setCustomFields(prev => [
      ...prev,
      { id: 'cf-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5), label: '', value: '' }
    ]);
  };

  const handleUpdateCustomField = (id: string, key: 'label' | 'value', val: string) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedMember = team.find(t => t.id === assignedTeamId);

    const validCustomFields = customFields.filter(f => f.label.trim() !== '');

    const payload = {
      tradeName: tradeName.trim(),
      legalName: legalName.trim() || tradeName.trim(),
      pan: pan.trim().toUpperCase(),
      gstin: gstin.trim().toUpperCase(),
      tan: tan.trim().toUpperCase(),
      vatNumber: vatNumber.trim(),
      category,
      status,
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      employeeName: employeeName.trim(),
      employeePhone: employeePhone.trim(),
      aadharNumber: aadharNumber.trim(),
      dob: dob.trim(),
      formationDate: formationDate.trim(),
      assignedTeamId,
      assignedTeamName: assignedMember?.name || (assignedTeamId ? 'Assigned Partner' : 'Unassigned'),
      portalPassword: portalPassword || 'client123',
      googleDriveFolderId: googleDriveFolderId.trim(),
      googleDriveFolderUrl: googleDriveFolderUrl.trim(),
      customFields: validCustomFields,
    };

    if (isEditing && client) {
      updateClient(client.id, payload);
    } else {
      addClient(payload);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in zoom-in-95 duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-amber-400/40 rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title="Close"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Building size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">
              {isEditing ? ('Edit Client: ' + (client ? client.tradeName : '')) : 'Add New Client to Master Directory'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Edit all statutory fields, contact info, custom columns & formation dates
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Section 1: Business Identity */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Building size={14} className="text-amber-500" /> Business Identity & Registrations
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Client Trade Name *</label>
                <input
                  type="text"
                  required
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="e.g. Apex Precision Tools Pvt Ltd"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Legal Registered Entity Name</label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Apex Precision Tools Private Limited"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1">
                  <span>PAN Number *</span>
                  <span className="text-[10px] text-amber-600 font-normal">(Auto-Status)</span>
                </label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  value={pan}
                  onChange={(e) => {
                    const upper = e.target.value.toUpperCase();
                    setPan(upper);
                    if (upper.length >= 4) {
                      const detected = detectEntityCategoryFromPANAndGSTIN(upper, gstin, tradeName, legalName);
                      setCategory(detected);
                    }
                  }}
                  placeholder="AAACA1234F"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono uppercase font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => {
                    const upper = e.target.value.toUpperCase();
                    setGstin(upper);
                    if (upper.length === 15 && (!pan || pan.length !== 10)) {
                      setPan(upper.substring(2, 12));
                    }
                    if (upper.length >= 6) {
                      const detected = detectEntityCategoryFromPANAndGSTIN(pan, upper, tradeName, legalName);
                      setCategory(detected);
                    }
                  }}
                  placeholder="27AAACA1234F1Z5"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono uppercase focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">TAN Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={tan}
                  onChange={(e) => setTan(e.target.value.toUpperCase())}
                  placeholder="MUMB12345C"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono uppercase focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">VAT / State ID</label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="VAT-MH-998811"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Entity Type</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ClientCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold"
                >
                  <option value="PVT_LTD">Private Limited (Pvt Ltd)</option>
                  <option value="LLP">LLP</option>
                  <option value="PARTNERSHIP">Partnership Firm</option>
                  <option value="PROPRIETOR">Proprietorship</option>
                  <option value="INDIVIDUAL">Individual / Professional</option>
                  <option value="TRUST">Trust / NGO</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Client Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Firm Formation Date</label>
                <input
                  type="date"
                  value={formationDate}
                  onChange={(e) => setFormationDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Assigned Partner</label>
                <select
                  value={assignedTeamId}
                  onChange={(e) => setAssignedTeamId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                >
                  <option value="">-- None / Unassigned (Blank) --</option>
                  {team.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.designation})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Google Drive Folder Mapping */}
            <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/80">
              <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Google Drive Client Folder Link / ID (Cloud Autosave)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={googleDriveFolderId}
                  onChange={(e) => setGoogleDriveFolderId(e.target.value)}
                  placeholder="Google Drive Folder ID (e.g. 1a2B3c4D5e...)"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={googleDriveFolderUrl}
                  onChange={(e) => setGoogleDriveFolderUrl(e.target.value)}
                  placeholder="Drive Folder Link (https://drive.google.com/drive/folders/...)"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Vault uploads & camera scans for this client will be automatically routed to this Google Drive folder.
              </p>
            </div>
          </div>

          {/* Section 2: Contact Person & KYC */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <UserCheck size={14} className="text-emerald-500" /> Contact Person & KYC Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Contact Person Name</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Vikramaditya Mehta (Director)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Mobile / WhatsApp No</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98200 45678"
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Official Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="accounts@apextools.in"
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Aadhar Number</label>
                <input
                  type="text"
                  value={aadharNumber}
                  onChange={(e) => setAadharNumber(e.target.value)}
                  placeholder="e.g. 5489 1234 9876"
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Date of Birth (DOB)</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Client Employee & Sub-Login */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <h4 className="font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-amber-600" /> Client Employee / Accountant Sub-Login Credentials
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Client Employee Name</label>
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="e.g. Ramesh Verma (Accounts Head)"
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">Employee Mobile Number (Last 4 digits used as PIN)</label>
                <input
                  type="text"
                  value={employeePhone}
                  onChange={(e) => setEmployeePhone(e.target.value)}
                  placeholder="e.g. 9820045678 (Login PIN will be 5678)"
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Dynamic Custom Statutory & Business Columns / Fields */}
          <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-slate-950/60 border border-blue-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers size={14} className="text-blue-600 dark:text-blue-400" /> Custom Columns / Statutory Fields ({customFields.length})
                </h4>
                <p className="text-[10px] text-slate-500">
                  Add dynamic custom fields (e.g. MSME Udyam No, IEC Code, CIN, Bank A/c, PT Reg, EPF No)
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddCustomField}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all active:scale-95 self-start sm:self-auto"
              >
                <Plus size={14} /> Add New Column / Field
              </button>
            </div>

            {customFields.length === 0 ? (
              <div className="text-center py-3 border border-dashed border-blue-200 dark:border-slate-800 rounded-xl text-slate-500 text-xs">
                No custom columns added. Click <strong className="text-blue-600 dark:text-blue-400">"+ Add New Column / Field"</strong> to add any custom data field.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto p-1">
                {customFields.map((field) => (
                  <div key={field.id} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="w-1/3 min-w-[130px]">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Column Name</label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleUpdateCustomField(field.id, 'label', e.target.value)}
                        placeholder="e.g. MSME Udyam No"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Field Value</label>
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => handleUpdateCustomField(field.id, 'value', e.target.value)}
                        placeholder="e.g. UDYAM-MH-01-0012345"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCustomField(field.id)}
                      title="Delete Custom Field"
                      className="mt-3.5 p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-300 dark:border-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-1.5"
            >
              <Check size={16} /> {isEditing ? 'Save Client Changes' : 'Create Client'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
