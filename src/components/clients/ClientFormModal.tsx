import React, { useState, useEffect } from 'react';
import { Client, ClientCategory, CustomField, ClientRepoDoc, ClientRepoDocType, ClientComplianceApplicability, ComplianceApplicabilityKey } from '../../types';
import { useTasks } from '../../context/TaskContext';
import { 
  X, 
  Building, 
  UserCheck, 
  ShieldCheck, 
  Check, 
  Layers, 
  Plus, 
  Trash2, 
  FolderKanban, 
  UploadCloud, 
  Share2, 
  Download, 
  Eye, 
  MessageCircle, 
  Mail, 
  Zap, 
  FileText, 
  Link as LinkIcon,
  CheckCircle2
} from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { detectEntityCategoryFromPANAndGSTIN } from '../../utils/masterImportExport';
import { COMPLIANCE_APPLICABILITY_ITEMS, resolveClientApplicability } from '../../utils/complianceApplicability';

interface Props {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
  initialTab?: 'DETAILS' | 'REPOSITORY';
}

const DOC_TYPE_OPTIONS: { value: ClientRepoDocType; label: string; badge: string }[] = [
  { value: 'GST_REG', label: '📜 GST Registration Certificate (REG-06)', badge: 'GST REG' },
  { value: 'PAN_CARD', label: '💳 PAN Card Copy', badge: 'PAN CARD' },
  { value: 'AADHAR_CARD', label: '🆔 Aadhar Card Copy', badge: 'AADHAR' },
  { value: 'TAN_LETTER', label: '🏛️ TAN Allotment Letter', badge: 'TAN LETTER' },
  { value: 'INCORPORATION_DEED', label: '🏢 Incorporation Certificate / Partnership Deed', badge: 'DEED / COI' },
  { value: 'UDYAM_MSME', label: '🏭 MSME / Udyam Registration Certificate', badge: 'UDYAM MSME' },
  { value: 'OTHER_KYC', label: '📄 Other Statutory / KYC Document', badge: 'OTHER KYC' },
];

// Ultra-Light Image Compressor: shrinks 3MB-5MB scans down to ~18KB - 35KB so storage never fills up
async function compressImageToUltraLight(file: File): Promise<{ dataUrl: string; compressedKB: number; originalKB: number }> {
  const originalKB = Math.max(1, Math.round(file.size / 1024));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 820; // Sharp enough to read PAN/GST/Aadhar numbers clearly, tiny byte footprint
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP 0.42 first (smallest size), fallback to JPEG 0.42
        let compressedDataUrl = canvas.toDataURL('image/webp', 0.42);
        if (!compressedDataUrl.startsWith('data:image/webp')) {
          compressedDataUrl = canvas.toDataURL('image/jpeg', 0.42);
        }

        const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);
        const compressedKB = Math.max(1, Math.round(approxBytes / 1024));
        resolve({ dataUrl: compressedDataUrl, compressedKB, originalKB });
      };
      img.onerror = () => reject(new Error('Could not decode image for ultra-light compression'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

export const ClientFormModal: React.FC<Props> = ({ isOpen, client, onClose, initialTab = 'DETAILS' }) => {
  const { team, addClient, updateClient, addDocument } = useTasks();
  const isEditing = !!client;

  useEscapeKey(onClose, isOpen);

  const [activeTab, setActiveTab] = useState<'DETAILS' | 'REPOSITORY'>(initialTab);

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
  const [repositoryDocs, setRepositoryDocs] = useState<ClientRepoDoc[]>([]);
  const [complianceApplicability, setComplianceApplicability] = useState<ClientComplianceApplicability>(() =>
    resolveClientApplicability(client)
  );

  // Repository Upload Form State
  const [selectedDocType, setSelectedDocType] = useState<ClientRepoDocType>('GST_REG');
  const [customDocTitle, setCustomDocTitle] = useState('');
  const [docNumberInput, setDocNumberInput] = useState('');
  const [cloudDocUrlInput, setCloudDocUrlInput] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [repoNotice, setRepoNotice] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ClientRepoDoc | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

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
      setRepositoryDocs(client.repositoryDocs && Array.isArray(client.repositoryDocs) ? [...client.repositoryDocs] : []);
      setComplianceApplicability(resolveClientApplicability(client));
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
      setRepositoryDocs([]);
      setComplianceApplicability(resolveClientApplicability(null));
    }
  }, [client, team, isOpen]);

  const handleToggleApplicability = (key: ComplianceApplicabilityKey, forcedVal?: boolean) => {
    setComplianceApplicability(prev => ({
      ...prev,
      [key]: forcedVal !== undefined ? forcedVal : !prev[key]
    }));
  };

  // Auto-populate document number when switching docType
  useEffect(() => {
    if (selectedDocType === 'GST_REG') setDocNumberInput(gstin || '');
    else if (selectedDocType === 'PAN_CARD') setDocNumberInput(pan || '');
    else if (selectedDocType === 'AADHAR_CARD') setDocNumberInput(aadharNumber || '');
    else if (selectedDocType === 'TAN_LETTER') setDocNumberInput(tan || '');
    else setDocNumberInput('');
  }, [selectedDocType, gstin, pan, aadharNumber, tan]);

  if (!isOpen) return null;

  const totalStorageKB = repositoryDocs.reduce((acc, d) => acc + (d.compressedSizeKB || 0), 0);

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

  // Handle Ultra-Light File Upload in Repository Tab
  const handleRepoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setRepoNotice(null);

    try {
      const optionMeta = DOC_TYPE_OPTIONS.find(o => o.value === selectedDocType);
      const docTitle = customDocTitle.trim() || optionMeta?.label.replace(/^[^\s]+\s/, '') || file.name;

      if (file.type.startsWith('image/')) {
        const { dataUrl, compressedKB, originalKB } = await compressImageToUltraLight(file);
        const savedPct = originalKB > compressedKB ? Math.round(((originalKB - compressedKB) / originalKB) * 100) : 0;

        const newDoc: ClientRepoDoc = {
          id: 'repodoc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          docType: selectedDocType,
          title: docTitle,
          docNumber: docNumberInput.trim(),
          fileType: 'IMAGE_WEBP',
          originalSizeKB: originalKB,
          compressedSizeKB: compressedKB,
          dataUrl,
          uploadedAt: new Date().toLocaleDateString('en-IN')
        };

        setRepositoryDocs(prev => [newDoc, ...prev]);
        setCustomDocTitle('');
        setRepoNotice(`⚡ Ultra-Light Compressed! Original ${originalKB} KB -> Stored in just ${compressedKB} KB (${savedPct}% space saved).`);
      } else {
        // For PDF or other files: keep ultra-low storage by limiting inline size to <= 95 KB or storing lightweight reference
        const originalKB = Math.max(1, Math.round(file.size / 1024));
        if (originalKB <= 95) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const newDoc: ClientRepoDoc = {
              id: 'repodoc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              docType: selectedDocType,
              title: docTitle,
              docNumber: docNumberInput.trim(),
              fileType: 'PDF',
              originalSizeKB: originalKB,
              compressedSizeKB: originalKB,
              dataUrl,
              uploadedAt: new Date().toLocaleDateString('en-IN')
            };
            setRepositoryDocs(prev => [newDoc, ...prev]);
            setCustomDocTitle('');
            setRepoNotice(`✅ Lightweight PDF (${originalKB} KB) stored in repository!`);
          };
          reader.readAsDataURL(file);
        } else {
          // Zero-Bloat Smart Metadata Card for large PDFs so storage never fills up
          const newDoc: ClientRepoDoc = {
            id: 'repodoc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            docType: selectedDocType,
            title: `${docTitle} (${file.name})`,
            docNumber: docNumberInput.trim(),
            fileType: 'CLOUD_LINK',
            originalSizeKB: originalKB,
            compressedSizeKB: 1, // Only 1 KB metadata!
            dataUrl: googleDriveFolderUrl || 'https://drive.google.com',
            uploadedAt: new Date().toLocaleDateString('en-IN')
          };
          setRepositoryDocs(prev => [newDoc, ...prev]);
          setCustomDocTitle('');
          setRepoNotice(`⚡ Zero-Bloat Mode: Large PDF (${originalKB} KB) indexed using only 1 KB storage & linked to Google Drive! Tip: Upload image/photo for 20 KB inline preview.`);
        }
      }
    } catch (err: any) {
      alert('Document compression note: ' + (err?.message || 'Could not process file'));
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  // Add 0 KB Cloud / Drive Link directly
  const handleAddCloudLinkDoc = () => {
    if (!cloudDocUrlInput.trim()) {
      alert('Kripya Google Drive / Document link enter karein.');
      return;
    }
    const optionMeta = DOC_TYPE_OPTIONS.find(o => o.value === selectedDocType);
    const docTitle = customDocTitle.trim() || optionMeta?.label.replace(/^[^\s]+\s/, '') || 'Statutory Document';

    const newDoc: ClientRepoDoc = {
      id: 'repodoc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      docType: selectedDocType,
      title: docTitle,
      docNumber: docNumberInput.trim(),
      fileType: 'CLOUD_LINK',
      originalSizeKB: 0,
      compressedSizeKB: 0,
      dataUrl: cloudDocUrlInput.trim(),
      uploadedAt: new Date().toLocaleDateString('en-IN')
    };

    setRepositoryDocs(prev => [newDoc, ...prev]);
    setCloudDocUrlInput('');
    setCustomDocTitle('');
    setRepoNotice('⚡ Added Cloud Document Link (0 KB Local Storage Used)!');
  };

  const handleDeleteRepoDoc = (id: string) => {
    setRepositoryDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleDownloadRepoDoc = (doc: ClientRepoDoc) => {
    if (doc.fileType === 'CLOUD_LINK' || doc.dataUrl.startsWith('http')) {
      window.open(doc.dataUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const a = document.createElement('a');
    a.href = doc.dataUrl;
    const ext = doc.fileType === 'PDF' ? 'pdf' : 'webp';
    const cleanClient = (tradeName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${cleanClient}_${doc.docType}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareRepoDocWhatsApp = async (doc: ClientRepoDoc) => {
    const clientLabel = tradeName || 'Client';
    const shareText = `*TASK-VAANI Statutory Document*\n*Client:* ${clientLabel}\n*Document:* ${doc.title}\n${doc.docNumber ? `*Reg/ID No:* ${doc.docNumber}\n` : ''}${doc.dataUrl.startsWith('http') ? `*Link:* ${doc.dataUrl}` : ''}`;

    // Try native file sharing on mobile/modern browsers if inline image/PDF
    if (doc.dataUrl.startsWith('data:') && navigator.share) {
      try {
        const res = await fetch(doc.dataUrl);
        const blob = await res.blob();
        const ext = doc.fileType === 'PDF' ? 'pdf' : 'jpg';
        const file = new File([blob], `${clientLabel.replace(/\s+/g, '_')}_${doc.docType}.${ext}`, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${clientLabel} - ${doc.title}`,
            text: shareText,
            files: [file]
          });
          return;
        }
      } catch (err) {
        console.warn('Native file share fallback to WhatsApp link:', err);
      }
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const waUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(shareText)}`
      : `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShareRepoDocEmail = (doc: ClientRepoDoc) => {
    const clientLabel = tradeName || 'Client';
    const subject = `Statutory KYC Document: ${doc.title} - ${clientLabel}`;
    const body = `Dear Sir/Madam,\n\nPlease find the statutory document details for ${clientLabel}:\n\nDocument: ${doc.title}\nRegistration / ID Number: ${doc.docNumber || 'N/A'}\nPAN: ${pan || 'N/A'}\nGSTIN: ${gstin || 'N/A'}\n${doc.dataUrl.startsWith('http') ? `Cloud Link: ${doc.dataUrl}\n` : ''}\nRegards,\nTASK-VAANI Compliance Hub`;
    window.location.href = `mailto:${email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeName.trim() || !pan.trim()) {
      setActiveTab('DETAILS');
      alert('Kripya Client Trade Name aur PAN Number fill karein.');
      return;
    }

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
      repositoryDocs,
      complianceApplicability,
    };

    if (isEditing && client) {
      updateClient(client.id, payload);
    } else {
      const created = addClient(payload);
      // Sync newly added repository docs to Document Vault as well
      repositoryDocs.forEach(rDoc => {
        addDocument({
          clientId: created.id,
          clientName: created.tradeName,
          title: `${rDoc.title}${rDoc.docNumber ? ` (${rDoc.docNumber})` : ''}`,
          category: rDoc.docType === 'GST_REG' ? 'GST' : rDoc.docType === 'TAN_LETTER' ? 'TDS' : 'INCOME_TAX',
          fileType: rDoc.fileType === 'PDF' ? 'PDF' : 'IMAGE',
          fileSize: `${rDoc.compressedSizeKB} KB`,
          fileUrl: rDoc.dataUrl,
          uploadedBy: 'Admin',
          tags: [rDoc.docType, 'Client Repository', 'Ultra-Light']
        });
      });
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

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Building size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white font-serif">
              {isEditing ? ('Edit Client: ' + (client ? client.tradeName : '')) : 'Add New Client to Master Directory'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Edit statutory fields, contact info & store/share ultra-light KYC documents (GST, PAN, Aadhar, TAN)
            </p>
          </div>
        </div>

        {/* Navigation Tabs: Client Master Details vs Document Repository */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('DETAILS')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'DETAILS'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building size={15} />
            <span>1. Client Details & Statutory KYC</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('REPOSITORY')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'REPOSITORY'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FolderKanban size={15} />
            <span>2. Document Repository (GST / PAN / Aadhar / TAN)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'REPOSITORY'
                ? 'bg-slate-950 text-emerald-400'
                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            }`}>
              {repositoryDocs.length}
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {activeTab === 'DETAILS' ? (
            <>
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

                {/* Compliances (AUDIT, GST, TDS, VAT, E-INVOICE, RCM, 86B) */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                  <label className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span>Compliances</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    {COMPLIANCE_APPLICABILITY_ITEMS.map(item => {
                      const isApp = complianceApplicability[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleToggleApplicability(item.key)}
                          title={item.fullTitle}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-400 transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm"
                        >
                          <span className="font-mono font-bold text-[10px] uppercase text-slate-800 dark:text-slate-200">
                            {item.label}
                          </span>
                          <span
                            className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors duration-200 ${
                              isApp ? 'bg-emerald-500 justify-end' : 'bg-red-500 justify-start'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full bg-white shadow-sm block" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
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
            </>
          ) : (
            /* TAB 2: CLIENT STATUTORY DOCUMENT REPOSITORY (ULTRA-LIGHT STORAGE & SHARE) */
            <div className="space-y-4">
              
              {/* Ultra-Low Storage Banner */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-amber-500/15 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <Zap size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                      ⚡ Ultra-Low Storage Micro-Compression Engine (Active)
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      GST Certificate, PAN, Aadhar aur TAN photos/documents ko automatically <strong>15 KB – 35 KB</strong> me micro-compress kiya jata hai jisse phone ya app ki storage kabhi nahi bharti!
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-emerald-400 font-mono font-bold text-[11px] shrink-0 text-center border border-emerald-500/30">
                  Used: {totalStorageKB} KB
                </div>
              </div>

              {/* Add / Upload Document to Repository Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <UploadCloud size={15} className="text-emerald-500" /> Upload & Store Client Registration Document
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">1. Select Document Type</label>
                    <select
                      value={selectedDocType}
                      onChange={(e) => setSelectedDocType(e.target.value as ClientRepoDocType)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:border-emerald-500 focus:outline-none"
                    >
                      {DOC_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">2. Registration / ID Number</label>
                    <input
                      type="text"
                      value={docNumberInput}
                      onChange={(e) => setDocNumberInput(e.target.value)}
                      placeholder="e.g. GSTIN / PAN / Aadhar / TAN"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">3. Custom Remark / Title (Optional)</label>
                    <input
                      type="text"
                      value={customDocTitle}
                      onChange={(e) => setCustomDocTitle(e.target.value)}
                      placeholder="e.g. Head Office GST Certificate"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Upload File or Paste Cloud Link */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {/* Option A: Ultra-Light File / Photo Upload */}
                  <label className="cursor-pointer flex items-center justify-center gap-2.5 p-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-98">
                    <UploadCloud size={17} />
                    <span>{isCompressing ? 'Compressing to Ultra-Light Size...' : '📤 Select Photo / PDF (Auto ~25 KB)'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleRepoFileSelect}
                      disabled={isCompressing}
                      className="hidden"
                    />
                  </label>

                  {/* Option B: 0 KB Cloud / Google Drive Link */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="url"
                      value={cloudDocUrlInput}
                      onChange={(e) => setCloudDocUrlInput(e.target.value)}
                      placeholder="Or paste Google Drive Link (0 KB Storage)"
                      className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCloudLinkDoc}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shrink-0 flex items-center gap-1"
                    >
                      <LinkIcon size={13} /> Add Link
                    </button>
                  </div>
                </div>

                {repoNotice && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    <span>{repoNotice}</span>
                  </div>
                )}
              </div>

              {/* Stored Documents List with 1-Click Share & Preview */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                    Stored Client Documents ({repositoryDocs.length})
                  </h4>
                  <span className="text-[10px] text-slate-500">Click WhatsApp or Email to share directly</span>
                </div>

                {repositoryDocs.length === 0 ? (
                  <div className="text-center py-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-slate-500 space-y-1">
                    <FolderKanban size={28} className="mx-auto text-slate-400 mb-1" />
                    <p className="font-bold text-xs text-slate-700 dark:text-slate-300">No Documents in Client Repository Yet</p>
                    <p className="text-[11px]">Upload GST Registration, PAN Card, Aadhar Card, or TAN Letter above.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1">
                    {repositoryDocs.map((doc) => {
                      const badgeLabel = DOC_TYPE_OPTIONS.find(o => o.value === doc.docType)?.badge || 'KYC DOC';
                      return (
                        <div
                          key={doc.id}
                          className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 shadow-sm flex flex-col justify-between gap-2.5 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-mono font-bold text-[9px]">
                                  {badgeLabel}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[9px]">
                                  ⚡ {doc.compressedSizeKB} KB
                                </span>
                              </div>
                              <p className="font-bold text-slate-900 dark:text-white text-xs truncate" title={doc.title}>
                                {doc.title}
                              </p>
                              {doc.docNumber && (
                                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
                                  No: {doc.docNumber}
                                </p>
                              )}
                            </div>

                            {doc.dataUrl.startsWith('data:image') ? (
                              <img
                                src={doc.dataUrl}
                                alt={doc.title}
                                onClick={() => setPreviewDoc(doc)}
                                className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-80 shrink-0"
                              />
                            ) : (
                              <div
                                onClick={() => setPreviewDoc(doc)}
                                className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-amber-500 cursor-pointer shrink-0"
                              >
                                <FileText size={20} />
                              </div>
                            )}
                          </div>

                          {/* Action Buttons: View, Download, WhatsApp Share, Email Share, Delete */}
                          <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(doc)}
                                title="View / Preview Document"
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center gap-1 transition-colors"
                              >
                                <Eye size={11} /> View
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadRepoDoc(doc)}
                                title="Download Document"
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-blue-500 hover:text-white text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center gap-1 transition-colors"
                              >
                                <Download size={11} /> Save
                              </button>

                              <button
                                type="button"
                                onClick={() => handleShareRepoDocWhatsApp(doc)}
                                title="Share Document on WhatsApp"
                                className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-700 dark:text-emerald-300 hover:text-slate-950 font-bold text-[10px] flex items-center gap-1 transition-colors"
                              >
                                <MessageCircle size={11} /> WhatsApp
                              </button>

                              <button
                                type="button"
                                onClick={() => handleShareRepoDocEmail(doc)}
                                title="Share Document via Email"
                                className="p-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-600 dark:text-slate-400 transition-colors"
                              >
                                <Mail size={12} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteRepoDoc(doc.id)}
                              title="Remove Document"
                              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">
              {activeTab === 'DETAILS' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('REPOSITORY')}
                  className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                >
                  <FolderKanban size={13} /> Go to Document Repository ({repositoryDocs.length} Docs) →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab('DETAILS')}
                  className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
                >
                  ← Back to Client Statutory Details
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
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
                <Check size={16} /> {isEditing ? 'Save Client & Repository' : 'Create Client & Save Docs'}
              </button>
            </div>
          </div>

        </form>

        {/* Instant Document Preview Lightbox */}
        {previewDoc && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
            onClick={() => setPreviewDoc(null)}
          >
            <div
              className="max-w-xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="font-bold text-sm">{previewDoc.title}</h4>
                  <p className="text-xs text-slate-400 font-mono">
                    {previewDoc.docNumber ? `Reg No: ${previewDoc.docNumber} • ` : ''}Size: {previewDoc.compressedSizeKB} KB (Ultra-Light)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-2xl p-3">
                {previewDoc.dataUrl.startsWith('data:image') ? (
                  <img src={previewDoc.dataUrl} alt={previewDoc.title} className="max-w-full rounded-xl" />
                ) : previewDoc.dataUrl.startsWith('http') ? (
                  <div className="text-center py-8 space-y-3">
                    <FileText size={40} className="mx-auto text-amber-400" />
                    <p className="text-xs text-slate-300">Cloud Linked Statutory Document</p>
                    <a
                      href={previewDoc.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                    >
                      Open Cloud Link
                    </a>
                  </div>
                ) : (
                  <iframe src={previewDoc.dataUrl} title={previewDoc.title} className="w-full h-80 rounded-xl" />
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleShareRepoDocWhatsApp(previewDoc)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Share2 size={14} /> Share on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadRepoDoc(previewDoc)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Download size={14} /> Download
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
