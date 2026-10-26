import * as XLSX from 'xlsx';
import { TaskItem, Client } from '../types';

export const exportTasksToExcel = (
  tasks: TaskItem[],
  activeTab = 'ALL',
  selectedCategory = 'ALL',
  selectedStatus = 'ALL',
  searchTerm = '',
  clients: Client[] = []
) => {
  if (!tasks || tasks.length === 0) {
    alert('No tasks to export for the selected filter.');
    return;
  }

  // Format tab label
  let tabLabel = 'All_Compliance';
  if (activeTab === 'DAILY') tabLabel = 'Daily_Tasks';
  else if (activeTab === 'WEEKLY') tabLabel = 'Weekly_Tasks';
  else if (activeTab === 'MONTHLY') tabLabel = 'Monthly_Returns';
  else if (activeTab === 'QUARTERLY') tabLabel = 'Quarterly_Tasks';
  else if (activeTab === 'YEARLY') tabLabel = 'Annual_Audit';
  else if (activeTab === 'ACTION_PENDING') tabLabel = 'Pending_Deadlines';
  else if (activeTab === 'IN_PROGRESS') tabLabel = 'InProgress_Tasks';
  else if (activeTab === 'COMPLIANCE_DONE') tabLabel = 'Completed_Tasks';

  if (selectedCategory && selectedCategory !== 'ALL') {
    tabLabel += `_${selectedCategory}`;
  }
  if (selectedStatus && selectedStatus !== 'ALL') {
    tabLabel += `_${selectedStatus}`;
  }
  if (searchTerm && searchTerm.trim()) {
    const cleanSearch = searchTerm.trim().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
    if (cleanSearch) {
      tabLabel += `_Search_${cleanSearch}`;
    }
  }

  // Map clients for quick lookup of statutory tax numbers
  const clientMap = new Map<string, Client>();
  if (clients && clients.length > 0) {
    clients.forEach(c => {
      if (c.id) clientMap.set(c.id, c);
      if (c.tradeName) clientMap.set(c.tradeName.toLowerCase().trim(), c);
      if (c.legalName) clientMap.set(c.legalName.toLowerCase().trim(), c);
    });
  }

  const rows = tasks.map((t, idx) => {
    let client: Client | undefined;
    if (t.clientId && clientMap.has(t.clientId)) {
      client = clientMap.get(t.clientId);
    } else if (t.clientName && clientMap.has(t.clientName.toLowerCase().trim())) {
      client = clientMap.get(t.clientName.toLowerCase().trim());
    }

    const pan = client?.pan || 'N/A';
    const gstin = client?.gstin && client.gstin !== 'N/A' ? client.gstin : '-';
    const tan = client?.tan && client.tan !== 'N/A' ? client.tan : '-';

    const cat = (t.category || '').toUpperCase();
    const title = (t.title || '').toUpperCase();

    let relatedTaxId = `PAN: ${pan}`;
    if (cat === 'GST' || title.includes('GST') || title.includes('3B')) {
      relatedTaxId = gstin !== '-' ? `GSTIN: ${gstin}` : `PAN: ${pan}`;
    } else if (cat === 'TDS' || title.includes('TDS') || title.includes('281') || title.includes('24Q') || title.includes('26Q')) {
      relatedTaxId = tan !== '-' ? `TAN: ${tan}` : `PAN: ${pan}`;
    }

    return {
      'Sr No': idx + 1,
      'Client Name': t.clientName,
      'Task Statutory Tax ID': relatedTaxId,
      'PAN': pan,
      'GSTIN': gstin,
      'TAN': tan,
      'Compliance Task': t.title,
      'Category': t.category,
      'Frequency / Cadence': t.frequency,
      'Due Rule / Day': t.dueDayOrDate,
      'Due Date': t.dueDate,
      'Assigned Staff': t.assignedTeamName,
      'Current Status': t.status,
      'Financial Year': t.financialYear,
      'Period': t.period || 'General',
      'Task Description / Notes': t.description || '',
      'Completed Date': t.completedAt ? new Date(t.completedAt).toLocaleString('en-IN') : '-',
      'Completed By': t.completedBy || '-'
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column Widths for professional Excel styling
  worksheet['!cols'] = [
    { wch: 8 },   // Sr No
    { wch: 34 },  // Client Name
    { wch: 22 },  // Task Statutory Tax ID
    { wch: 14 },  // PAN
    { wch: 18 },  // GSTIN
    { wch: 14 },  // TAN
    { wch: 40 },  // Compliance Task
    { wch: 15 },  // Category
    { wch: 16 },  // Frequency
    { wch: 16 },  // Due Rule / Day
    { wch: 14 },  // Due Date
    { wch: 22 },  // Assigned Staff
    { wch: 15 },  // Current Status
    { wch: 14 },  // Financial Year
    { wch: 14 },  // Period
    { wch: 45 },  // Description
    { wch: 22 },  // Completed Date
    { wch: 20 },  // Completed By
  ];

  const workbook = XLSX.utils.book_new();
  const sheetName = tabLabel.substring(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `TASK-VAANI_${tabLabel}_${dateStamp}.xlsx`;

  XLSX.writeFile(workbook, filename);
};
