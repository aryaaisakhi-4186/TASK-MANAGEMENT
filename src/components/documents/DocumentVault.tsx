import React, { useState, useEffect, useMemo } from 'react';
import { useTasks } from '../../context/TaskContext';
import { useAuth } from '../../context/AuthContext';
import { DocumentItem } from '../../types';
import { 
  FolderKanban, 
  Plus, 
  FileText, 
  Share2, 
  Trash2, 
  Search, 
  FolderPlus, 
  X, 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  Home, 
  ArrowLeft,
  Sparkles,
  Layers,
  Edit3,
  Check,
  Camera,
  UploadCloud,
  FileUp,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  SwitchCamera,
  Smartphone
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { ShareModal } from './ShareModal';
import { GoogleDriveService } from '../../services/googleDriveService';
import { VoiceSearchBar } from '../common/VoiceSearchBar';

export interface DocFolder {
  id: string;
  name: string;
  parentId: string | null; // null for top-level primary folders
  isBuiltIn?: boolean;
}

const INITIAL_DEFAULT_FOLDERS: DocFolder[] = [
  // Top-Level Built-in Primary Folders
  { id: 'GST', name: 'GST Returns & Challans', parentId: null, isBuiltIn: true },
  { id: 'TDS', name: 'TDS & TCS Returns', parentId: null, isBuiltIn: true },
  { id: 'INCOME_TAX', name: 'Income Tax & Computation', parentId: null, isBuiltIn: true },
  { id: 'ROC', name: 'ROC & MCA Filings', parentId: null, isBuiltIn: true },
  { id: 'AUDIT', name: 'Tax Audit & Working Papers', parentId: null, isBuiltIn: true },

  // Built-in Sub-Folders for GST
  { id: 'sub-gst-gstr3b', name: 'GSTR-3B Monthly Returns', parentId: 'GST', isBuiltIn: true },
  { id: 'sub-gst-gstr1', name: 'GSTR-1 Sales Returns', parentId: 'GST', isBuiltIn: true },
  { id: 'sub-gst-pmt06', name: 'PMT-06 Tax Challans', parentId: 'GST', isBuiltIn: true },
  { id: 'sub-gst-gstr9', name: 'Annual Return (GSTR-9/9C)', parentId: 'GST', isBuiltIn: true },

  // Built-in Sub-Folders for TDS
  { id: 'sub-tds-24q', name: 'Form 24Q Salary Returns', parentId: 'TDS', isBuiltIn: true },
  { id: 'sub-tds-26q', name: 'Form 26Q Non-Salary Returns', parentId: 'TDS', isBuiltIn: true },
  { id: 'sub-tds-form16', name: 'Form 16 / 16A Certificates', parentId: 'TDS', isBuiltIn: true },
  { id: 'sub-tds-281', name: 'Challan 281 Payment Receipts', parentId: 'TDS', isBuiltIn: true },

  // Built-in Sub-Folders for INCOME TAX
  { id: 'sub-it-itrv', name: 'ITR Filing Acknowledgments (ITR-V)', parentId: 'INCOME_TAX', isBuiltIn: true },
  { id: 'sub-it-comp', name: 'Computation of Total Income', parentId: 'INCOME_TAX', isBuiltIn: true },
  { id: 'sub-it-26as', name: 'Form 26AS / AIS / TIS Statements', parentId: 'INCOME_TAX', isBuiltIn: true },
  { id: 'sub-it-280', name: 'Advance Tax & Self-Assessment 280', parentId: 'INCOME_TAX', isBuiltIn: true },

  // Built-in Sub-Folders for ROC
  { id: 'sub-roc-aoc4', name: 'AOC-4 & MGT-7 Annual Filing', parentId: 'ROC', isBuiltIn: true },
  { id: 'sub-roc-dir3', name: 'Director KYC (DIR-3 KYC)', parentId: 'ROC', isBuiltIn: true },
  { id: 'sub-roc-inc', name: 'Incorporation & MOA / AOA', parentId: 'ROC', isBuiltIn: true },

  // Built-in Sub-Folders for AUDIT
  { id: 'sub-audit-3cd', name: 'Form 3CA / 3CB - 3CD Tax Audit', parentId: 'AUDIT', isBuiltIn: true },
  { id: 'sub-audit-caro', name: 'CARO 2020 & Statutory Reports', parentId: 'AUDIT', isBuiltIn: true },
  { id: 'sub-audit-papers', name: 'Audit Working Papers & Vouching', parentId: 'AUDIT', isBuiltIn: true },
];

export const DocumentVault: React.FC = () => {
  const { documents, clients, addDocument, deleteDocument } = useTasks();
  const { currentRole, currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null); // null = Root ALL Folders
  const [isUploading, setIsUploading] = useState(false);
  const [shareDoc, setShareDoc] = useState<DocumentItem | null>(null);

  // Folders State
  const [folders, setFolders] = useState<DocFolder[]>(() => {
    try {
      const saved = localStorage.getItem('taskvaani_vault_folders_v2');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return INITIAL_DEFAULT_FOLDERS;
  });

  const saveFolders = (newFolders: DocFolder[]) => {
    setFolders(newFolders);
    try {
      localStorage.setItem('taskvaani_vault_folders_v2', JSON.stringify(newFolders));
    } catch (e) {
      console.warn('Could not save folders to localStorage:', e);
    }
  };

  // New Folder Modal States
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  // Edit / Rename Folder Modal States
  const [editingFolder, setEditingFolder] = useState<DocFolder | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderParentId, setEditFolderParentId] = useState<string | null>(null);
  const [isEditFolderModalOpen, setIsEditFolderModalOpen] = useState(false);

  // Upload Form States
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [uploadFolderId, setUploadFolderId] = useState<string>('GST');
  const [tags, setTags] = useState('July 2026, Compliance');
  const [uploadMode, setUploadMode] = useState<'BROWSE' | 'CAMERA'>('BROWSE');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFileSize, setSelectedFileSize] = useState('420 KB');
  const [selectedFileType, setSelectedFileType] = useState('PDF');
  const [cameraStreamActive, setCameraStreamActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [uploadDriveNotice, setUploadDriveNotice] = useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  // Breadcrumb Hierarchy Calculation
  const breadcrumbs = useMemo(() => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Primary Folders' }];
    if (!currentFolderId) return crumbs;

    const findFolder = (id: string): DocFolder | undefined => folders.find(f => f.id === id);
    const path: DocFolder[] = [];
    let curr = findFolder(currentFolderId);
    while (curr) {
      path.unshift(curr);
      if (curr.parentId) {
        curr = findFolder(curr.parentId);
      } else {
        break;
      }
    }

    path.forEach(f => crumbs.push({ id: f.id, name: f.name }));
    return crumbs;
  }, [currentFolderId, folders]);

  // Current Level Sub-Folders
  const currentSubFolders = useMemo(() => {
    return folders.filter(f => f.parentId === currentFolderId);
  }, [folders, currentFolderId]);

  // Get all descendant folder IDs for document filtering
  const getDescendantFolderIds = (folderId: string): string[] => {
    const result = [folderId];
    const directChildren = folders.filter(f => f.parentId === folderId);
    directChildren.forEach(child => {
      result.push(...getDescendantFolderIds(child.id));
    });
    return result;
  };

  // Filtered Documents
  const filteredDocs = useMemo(() => {
    const activeFolderIds = currentFolderId ? getDescendantFolderIds(currentFolderId) : null;

    return documents.filter(d => {
      if (currentRole === 'CLIENT' && currentUser) {
        if (d.clientId !== currentUser.id) return false;
      }

      if (activeFolderIds) {
        const matchesFolder = activeFolderIds.includes(d.category);
        if (!matchesFolder) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          d.title.toLowerCase().includes(q) ||
          d.clientName.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.tags.some((t: string) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [documents, currentFolderId, folders, currentRole, currentUser, searchTerm]);

  // Open Create Folder Modal with preselected parent
  const handleOpenCreateFolderModal = (parentId: string | null = currentFolderId) => {
    setNewFolderParentId(parentId);
    setNewFolderName('');
    setIsNewFolderModalOpen(true);
  };

  // Handle Folder / Sub-Folder Creation
  const handleCreateFolder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newFolderName.trim();
    if (!cleanName) return;

    const folderId = (newFolderParentId ? `${newFolderParentId}-` : '') + cleanName.toUpperCase().replace(/[^A-Z0-9]/g, '_') + `-${Date.now().toString().slice(-4)}`;

    const newFolder: DocFolder = {
      id: folderId,
      name: cleanName,
      parentId: newFolderParentId,
      isBuiltIn: false
    };

    const updated = [...folders, newFolder];
    saveFolders(updated);

    setCurrentFolderId(newFolder.id);
    setUploadFolderId(newFolder.id);
    setNewFolderName('');
    setIsNewFolderModalOpen(false);
  };

  // Open Edit / Rename Folder Modal
  const handleOpenEditFolderModal = (folder: DocFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingFolder(folder);
    setEditFolderName(folder.name);
    setEditFolderParentId(folder.parentId);
    setIsEditFolderModalOpen(true);
  };

  // Handle Folder Renaming / Edit
  const handleSaveEditFolder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = editFolderName.trim();
    if (!editingFolder || !cleanName) return;

    const updated = folders.map(f => {
      if (f.id === editingFolder.id) {
        return {
          ...f,
          name: cleanName,
          parentId: editFolderParentId
        };
      }
      return f;
    });

    saveFolders(updated);
    setIsEditFolderModalOpen(false);
    setEditingFolder(null);
  };

  // Delete Folder and its Sub-Folders
  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    if (window.confirm(`Delete folder "${folder.name}" and all sub-folders inside it? Documents will remain safely stored.`)) {
      const idsToDelete = getDescendantFolderIds(folderId);
      const updated = folders.filter(f => !idsToDelete.includes(f.id));
      saveFolders(updated);
      if (currentFolderId && idsToDelete.includes(currentFolderId)) {
        setCurrentFolderId(folder.parentId);
      }
    }
  };

  // Camera Stream & Photo Snap Handlers (Universal Laptop Webcam & Mobile Front/Back Support)
  const startCamera = async (mode: 'environment' | 'user' = cameraFacing) => {
    stopCamera();
    setCapturedPhotoUrl(null);
    setCameraError(false);

    try {
      let stream: MediaStream | null = null;

      // Tier 1: Try requested facingMode with ideal HD resolution
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (e1) {
        // Tier 2: Try basic facingMode
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: false
          });
        } catch (e2) {
          // Tier 3: Universal Laptop Webcam / External USB Camera (ignores facingMode constraint)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('Video play catch:', e));
        setCameraStreamActive(true);
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      setCameraError(true);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraStreamActive(false);
  };

  const toggleCameraFacing = () => {
    const nextMode = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextMode);
    startCamera(nextMode);
  };

  const snapPhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhotoUrl(dataUrl);
        setSelectedFileType('JPG');
        setSelectedFileSize('280 KB');
        if (!title) {
          setTitle('Camera Doc Scan ' + new Date().toLocaleDateString('en-IN'));
        }
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles(files);
    if (files.length === 1) {
      const file = files[0];
      setSelectedFileName(file.name);
      const sizeInKB = Math.round(file.size / 1024);
      setSelectedFileSize(sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(1)} MB` : `${sizeInKB} KB`);
      const ext = file.name.split('.').pop()?.toUpperCase() || 'PDF';
      setSelectedFileType(ext);

      if (!title) {
        const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
        setTitle(cleanTitle);
      }
    } else {
      setSelectedFileName(`${files.length} Documents Selected: ${files.map(f => f.name).slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`);
      const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
      const sizeInKB = Math.round(totalBytes / 1024);
      setSelectedFileSize(sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(1)} MB` : `${sizeInKB} KB`);
      setSelectedFileType('BATCH');

      if (!title) {
        setTitle(`${files.length} Documents Batch`);
      }
    }
  };

  // Handle Document Upload & Auto-Save to Google Drive
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClient = clients.find(c => c.id === clientId);
    if (!selectedClient) return;

    const targetFolder = folders.find(f => f.id === uploadFolderId);
    const folderLabel = targetFolder ? targetFolder.name : uploadFolderId;

    setIsUploadingToDrive(true);
    setUploadDriveNotice(null);

    try {
      if (selectedFiles.length > 1) {
        let lastMsg = '';
        for (const file of selectedFiles) {
          const sizeInKB = Math.round(file.size / 1024);
          const fSize = sizeInKB > 1024 ? `${(sizeInKB / 1024).toFixed(1)} MB` : `${sizeInKB} KB`;
          const fType = file.name.split('.').pop()?.toUpperCase() || 'PDF';
          const fTitle = file.name.replace(/\.[^/.]+$/, '');

          const uploadRes = await GoogleDriveService.uploadDocumentToClientDriveFolder(
            {
              name: fTitle,
              fileType: fType,
              fileSize: fSize,
              category: folderLabel
            },
            selectedClient,
            'arya.taskmanagement@gmail.com'
          );
          lastMsg = uploadRes.message;

          addDocument({
            clientId,
            clientName: selectedClient.tradeName,
            title: fTitle,
            category: uploadFolderId,
            fileType: fType,
            fileSize: fSize,
            fileUrl: uploadRes.driveFileUrl,
            googleDriveUrl: uploadRes.driveFileUrl,
            googleDriveFileId: uploadRes.driveFileId,
            isDriveSynced: true,
            uploadSource: 'BROWSE',
            uploadedBy: currentUser?.name || 'Staff',
            tags: [folderLabel, ...tags.split(',').map(t => t.trim()).filter(Boolean)],
          });
        }
        setUploadDriveNotice(`Successfully saved ${selectedFiles.length} documents directly to ${selectedClient.tradeName}'s Google Drive folder & Document Vault!`);
      } else {
        const uploadRes = await GoogleDriveService.uploadDocumentToClientDriveFolder(
          {
            name: title || selectedFileName || 'Document',
            fileType: selectedFileType,
            fileSize: selectedFileSize,
            category: folderLabel,
            base64OrBlob: capturedPhotoUrl || undefined
          },
          selectedClient,
          'arya.taskmanagement@gmail.com'
        );

        addDocument({
          clientId,
          clientName: selectedClient.tradeName,
          title: title || selectedFileName || 'Document',
          category: uploadFolderId,
          fileType: selectedFileType,
          fileSize: selectedFileSize,
          fileUrl: uploadRes.driveFileUrl,
          googleDriveUrl: uploadRes.driveFileUrl,
          googleDriveFileId: uploadRes.driveFileId,
          isDriveSynced: true,
          uploadSource: uploadMode === 'CAMERA' ? 'CAMERA' : 'BROWSE',
          uploadedBy: currentUser?.name || 'Staff',
          tags: [folderLabel, ...tags.split(',').map(t => t.trim()).filter(Boolean)],
        });

        setUploadDriveNotice(uploadRes.message);
      }

      setTitle('');
      setSelectedFileName('');
      setSelectedFiles([]);
      setCapturedPhotoUrl(null);
      stopCamera();

      setTimeout(() => {
        setIsUploading(false);
        setIsUploadingToDrive(false);
      }, 1000);

    } catch (err) {
      console.warn('Upload error:', err);
      setIsUploadingToDrive(false);
    }
  };

  // Count documents inside a folder (including sub-folders)
  const getFolderDocCount = (folderId: string) => {
    const ids = getDescendantFolderIds(folderId);
    return documents.filter(d => ids.includes(d.category)).length;
  };

  const currentFolder = currentFolderId ? folders.find(f => f.id === currentFolderId) : null;

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white font-serif tracking-tight flex items-center gap-2">
            <FolderKanban className="text-amber-500" /> Compliance Document Vault
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organized filing repository with hierarchical folders & sub-folders, instant preview and 1-click WhatsApp / Telegram sharing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add New Folder / Sub-Folder Button */}
          {currentRole !== 'GUEST' && (
            <button
              onClick={() => handleOpenCreateFolderModal(currentFolderId)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 hover:text-amber-600 font-bold text-xs shadow-sm transition-all active:scale-95"
            >
              <FolderPlus size={16} className="text-amber-500" />
              <span>{currentFolderId ? '+ New Sub-Folder' : '+ New Primary Folder'}</span>
            </button>
          )}

          {/* Upload Document Button */}
          {currentRole !== 'GUEST' && (
            <button
              onClick={() => {
                if (currentFolderId) setUploadFolderId(currentFolderId);
                setIsUploading(!isUploading);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus size={16} /> Upload Document
            </button>
          )}
        </div>
      </div>

      {/* Upload Document Form Drawer */}
      {isUploading && (
        <GlassCard className="p-5 animate-in fade-in" glow="gold">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                <UploadCloud size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  Upload & Scan Document to Client Google Drive
                </h3>
                <p className="text-[11px] text-slate-500">
                  Files are saved directly to the client's Google Drive folder without filling local storage
                </p>
              </div>
            </div>

            <button 
              onClick={() => { stopCamera(); setIsUploading(false); }} 
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={18} />
            </button>
          </div>

          {/* Upload Method Switcher Tabs */}
          <div className="flex items-center gap-2 mb-4 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 max-w-sm">
            <button
              type="button"
              onClick={() => { stopCamera(); setUploadMode('BROWSE'); }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                uploadMode === 'BROWSE'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileUp size={14} /> 📂 Browse Files
            </button>

            <button
              type="button"
              onClick={() => { setUploadMode('CAMERA'); startCamera(); }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                uploadMode === 'CAMERA'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Camera size={14} /> 📸 Camera / Scanner
            </button>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            
            {/* Mode 1: Browse File Input Area */}
            {uploadMode === 'BROWSE' && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 rounded-2xl p-4 text-center cursor-pointer transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*,.xlsx,.xls,.csv,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <UploadCloud size={20} />
                </div>
                {selectedFileName ? (
                  <div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span>{selectedFileName}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {selectedFileType} • {selectedFileSize}
                    </p>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold underline mt-1 inline-block">
                      Click to choose a different file
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Click here to Browse PDF, Images, Excel or Docs
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Supports PDF, PNG, JPG, XLSX, CSV, Word documents
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Camera / Live Document Scanner Area (Laptop & Mobile Ready) */}
            {uploadMode === 'CAMERA' && (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 max-w-md mx-auto aspect-video flex items-center justify-center">
                  {capturedPhotoUrl ? (
                    <img src={capturedPhotoUrl} alt="Captured Document" className="w-full h-full object-cover" />
                  ) : cameraError ? (
                    <div className="text-center p-4 text-slate-400">
                      <Smartphone size={32} className="mx-auto mb-2 text-amber-500 animate-bounce" />
                      <p className="text-xs font-bold text-white">Direct Phone Camera / Webcam Ready</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                        Tap "Open Phone / Laptop Camera" below to scan documents directly.
                      </p>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
                      />
                      
                      {/* Flip Camera Button (Front / Back / Laptop Camera) */}
                      {cameraStreamActive && (
                        <button
                          type="button"
                          onClick={toggleCameraFacing}
                          title="Switch Front / Back Camera"
                          className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs flex items-center gap-1.5 backdrop-blur-sm border border-slate-700 shadow-md transition-all active:scale-95"
                        >
                          <SwitchCamera size={14} className="text-amber-400" />
                          <span className="text-[10px] font-bold">
                            {cameraFacing === 'environment' ? 'Rear (Back)' : 'Front (Laptop/Selfie)'}
                          </span>
                        </button>
                      )}
                    </>
                  )}

                  {!cameraStreamActive && !capturedPhotoUrl && !cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 p-4 text-center">
                      <Camera size={32} className="text-amber-500 mb-2" />
                      <p className="text-xs text-white font-bold">Laptop Webcam & Mobile Camera Access</p>
                      <button
                        type="button"
                        onClick={() => startCamera(cameraFacing)}
                        className="mt-2 px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md active:scale-95"
                      >
                        Start Live Camera
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {cameraStreamActive && !capturedPhotoUrl && (
                    <button
                      type="button"
                      onClick={snapPhoto}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <Camera size={15} /> Snap Document Photo
                    </button>
                  )}

                  {capturedPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => { setCapturedPhotoUrl(null); startCamera(cameraFacing); }}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 hover:bg-amber-500/20"
                    >
                      <RefreshCw size={13} /> Retake Photo
                    </button>
                  )}

                  {/* Universal Mobile / Laptop Native Camera File Picker */}
                  <label className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:border-amber-400 flex items-center gap-1.5 transition-colors">
                    <Smartphone size={13} className="text-amber-500" /> Open Phone / System Camera
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture={cameraFacing === 'user' ? 'user' : 'environment'}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Form Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-700 dark:text-slate-300 mb-1 font-semibold">Client Entity *</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
                >
                  {clients.map(c => <option key={c.id} value={c.id}>{c.tradeName}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-700 dark:text-slate-300 mb-1 font-semibold">Document Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bank Statement July 2026 or GSTR-3B Ack"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-700 dark:text-slate-300 font-semibold">Destination Folder / Sub-Folder</label>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateFolderModal(uploadFolderId)}
                    className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline"
                  >
                    + Add Folder
                  </button>
                </div>
                <select
                  value={uploadFolderId}
                  onChange={(e) => setUploadFolderId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
                >
                  {/* Primary Top Level Folders */}
                  {folders.filter(f => !f.parentId).map(main => {
                    const subs = folders.filter(s => s.parentId === main.id);
                    return (
                      <React.Fragment key={main.id}>
                        <option value={main.id} className="font-bold">
                          📁 {main.name} (Primary Folder)
                        </option>
                        {subs.map(sub => (
                          <option key={sub.id} value={sub.id}>
                            &nbsp;&nbsp;&nbsp;&nbsp;↳ 📂 {sub.name}
                          </option>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Client Google Drive Status Indicator */}
            {(() => {
              const selectedClient = clients.find(c => c.id === clientId);
              return (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                    <span className="text-emerald-800 dark:text-emerald-300">
                      <strong>Google Drive Autosave Active:</strong> Files routed to <strong>{selectedClient?.tradeName}</strong>'s folder
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold font-mono">
                    Zero LocalStorage Used
                  </span>
                </div>
              );
            })()}

            {/* Notice */}
            {uploadDriveNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{uploadDriveNotice}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { stopCamera(); setIsUploading(false); }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploadingToDrive}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isUploadingToDrive ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Syncing to Google Drive...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={15} />
                    <span>Upload & Save to Google Drive</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Breadcrumb Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-md">
        
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
          
          {/* Back Button if inside a folder */}
          {currentFolderId && (
            <button
              onClick={() => {
                const parent = currentFolder?.parentId || null;
                setCurrentFolderId(parent);
              }}
              title="Go back up one folder level"
              className="mr-1.5 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/20 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <ArrowLeft size={14} />
            </button>
          )}

          {/* Breadcrumb Path Links */}
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id || 'root'}>
                {idx > 0 && <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                <button
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
                    isLast
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {idx === 0 ? <Home size={13} /> : <Folder size={13} />}
                  <span>{crumb.name}</span>
                </button>
              </React.Fragment>
            );
          })}

        </div>

        {/* Current Folder Action */}
        <div className="flex items-center gap-2">
          {currentFolder && (
            <button
              onClick={(e) => handleOpenEditFolderModal(currentFolder, e)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/20 text-slate-700 dark:text-slate-300 hover:text-amber-600 text-[11px] font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-all"
              title="Rename current folder"
            >
              <Edit3 size={12} className="text-amber-500" /> Rename Folder
            </button>
          )}

          {currentRole !== 'GUEST' && (
            <button
              onClick={() => handleOpenCreateFolderModal(currentFolderId)}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-bold border border-amber-500/30 flex items-center gap-1 transition-all"
            >
              <Plus size={12} /> {currentFolderId ? 'Add Sub-Folder' : 'Add Folder'}
            </button>
          )}
        </div>

      </div>

      {/* Sub-Folders / Primary Folders Grid Display */}
      {currentSubFolders.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers size={13} className="text-amber-500" />
              {currentFolderId ? `Sub-Folders inside "${currentFolder?.name}"` : 'Primary Folders'} ({currentSubFolders.length})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {currentSubFolders.map(folder => {
              const childSubCount = folders.filter(f => f.parentId === folder.id).length;
              const docCount = getFolderDocCount(folder.id);

              return (
                <div
                  key={folder.id}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="group relative p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500/80 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-2 active:scale-95"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Folder size={20} />
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Rename / Edit Folder Button */}
                      {currentRole !== 'GUEST' && (
                        <button
                          onClick={(e) => handleOpenEditFolderModal(folder, e)}
                          title="Rename folder"
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-amber-500/20 text-slate-400 hover:text-amber-600 transition-all"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}

                      {/* Delete button for custom folders */}
                      {!folder.isBuiltIn && currentRole === 'ADMIN' && (
                        <button
                          onClick={(e) => handleDeleteFolder(folder.id, e)}
                          title="Delete folder and sub-folders"
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500 hover:text-white text-slate-400 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {folder.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {docCount} {docCount === 1 ? 'file' : 'files'}
                      {childSubCount > 0 && ` • ${childSubCount} sub-folders`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Voice Search Bar */}
      <VoiceSearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search documents by title, client, or tags (#GSTR-3B) (or speak in Hindi/English)..."
        className="max-w-md"
      />

      {/* Documents Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <FileText size={13} className="text-amber-500" />
            Documents List ({filteredDocs.length})
          </span>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 bg-white/40 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
            <FolderKanban size={32} className="mx-auto text-slate-400 mb-2 opacity-50" />
            <p className="font-bold text-sm">No files uploaded in this folder view.</p>
            <p className="text-xs text-slate-400 mt-1">Click "Upload Document" to index files here or choose another folder.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map(doc => {
              const docFolder = folders.find(f => f.id === doc.category);
              const folderDisplay = docFolder ? docFolder.name : doc.category.replace(/_/g, ' ');

              return (
                <GlassCard key={doc.id} className="p-4 flex flex-col justify-between gap-3 group" variant="elevated">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      <FileText size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 font-mono font-bold border border-slate-200 dark:border-slate-700 truncate max-w-full inline-block">
                        📁 {folderDisplay}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs mt-1 truncate group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
                        {doc.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{doc.clientName}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {doc.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 font-medium">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px]">{doc.uploadedAt}</span>
                      {doc.uploadSource === 'CAMERA' ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20">
                          📸 Camera
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/20">
                          📂 File
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {doc.googleDriveUrl && (
                        <a
                          href={doc.googleDriveUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open Document in Google Drive"
                          className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-700 dark:text-emerald-300 hover:text-white transition-colors border border-emerald-500/20 flex items-center gap-1 text-[10px] font-bold"
                        >
                          <ExternalLink size={12} /> Drive ↗
                        </a>
                      )}

                      <button
                        onClick={() => setShareDoc(doc)}
                        className="p-1.5 rounded-lg bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 transition-colors border border-emerald-200 dark:border-slate-700"
                        title="Share on WhatsApp / Telegram"
                      >
                        <Share2 size={14} />
                      </button>
                      {currentRole === 'ADMIN' && (
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 dark:border-slate-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={!!shareDoc}
        document={shareDoc}
        onClose={() => setShareDoc(null)}
      />

      {/* Create Folder / Sub-Folder Modal */}
      {isNewFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base font-serif">
                    {newFolderParentId ? 'Create New Sub-Folder' : 'Create New Main Folder'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {newFolderParentId ? `Adding under: "${folders.find(f => f.id === newFolderParentId)?.name}"` : 'Adding top-level main category folder'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewFolderModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Folder Form */}
            <form onSubmit={handleCreateFolder} className="space-y-4">
              
              {/* Parent Folder Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Location (Parent Folder):
                </label>
                <select
                  value={newFolderParentId || 'ROOT'}
                  onChange={(e) => setNewFolderParentId(e.target.value === 'ROOT' ? null : e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
                >
                  <option value="ROOT">📁 Primary Folder (Top Level Category)</option>
                  {folders.filter(f => !f.parentId).map(main => (
                    <option key={main.id} value={main.id}>
                      ↳ 📂 Inside "{main.name}"
                    </option>
                  ))}
                </select>
              </div>

              {/* Folder Name */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Folder Name / Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. HDFC Bank, ICICI Bank, Form 16, Import-Export..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-500" /> Quick Suggestions:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['HDFC Bank', 'ICICI Bank', 'SBI Bank', 'Sales Registers', 'Purchase Registers', 'Form 16A', '26AS Statements', 'Board Resolutions'].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewFolderName(p)}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/20 text-slate-700 dark:text-slate-300 hover:text-amber-800 text-[10px] font-semibold border border-slate-200 dark:border-slate-700"
                    >
                      + {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewFolderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all"
                >
                  Save Folder
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT / RENAME FOLDER MODAL                                                */}
      {/* ========================================================================= */}
      {isEditFolderModalOpen && editingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base font-serif">
                    Rename / Edit Folder
                  </h3>
                  <p className="text-xs text-slate-500">
                    Update folder title and level hierarchy
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setIsEditFolderModalOpen(false); setEditingFolder(null); }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Edit Folder Form */}
            <form onSubmit={handleSaveEditFolder} className="space-y-4">
              
              {/* Folder Name */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Folder Name / Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  placeholder="e.g. GST Returns, ICICI Bank Statements..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Location Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Folder Level / Location:
                </label>
                <select
                  value={editFolderParentId || 'ROOT'}
                  onChange={(e) => setEditFolderParentId(e.target.value === 'ROOT' ? null : e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold focus:border-amber-500 focus:outline-none"
                >
                  <option value="ROOT">📁 Primary Folder (Top Level Category)</option>
                  {folders
                    .filter(f => !f.parentId && f.id !== editingFolder.id)
                    .map(main => (
                      <option key={main.id} value={main.id}>
                        ↳ 📂 Inside "{main.name}"
                      </option>
                    ))}
                </select>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsEditFolderModalOpen(false); setEditingFolder(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check size={14} /> Update Folder Name
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
