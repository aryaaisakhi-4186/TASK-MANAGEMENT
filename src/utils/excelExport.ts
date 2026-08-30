import * as XLSX from 'xlsx';
import { TaskItem } from '../types';

export const exportTasksToExcel = (
  tasks: TaskItem[],
  activeTab = 'ALL',
  selectedCategory = 'ALL',
  selectedStatus = 'ALL'
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

  if (selectedCategory !== 'ALL') {
    tabLabel += `_${selectedCategory}`;
  }
  if (selectedStatus !== 'ALL') {
    tabLabel += `_${selectedStatus}`;
  }

  const rows = tasks.map((t, idx) => ({
    'Sr No': idx + 1,
    'Client Name': t.clientName,
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
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column Widths for professional Excel styling
  worksheet['!cols'] = [
    { wch: 8 },   // Sr No
    { wch: 34 },  // Client Name
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
