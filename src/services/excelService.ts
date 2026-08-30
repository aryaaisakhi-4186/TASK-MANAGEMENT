import * as XLSX from 'xlsx';
import { Client, TaskItem, ExtraWorkItem, AuditLog } from '../types';

export const ExcelService = {
  exportClientsAndTasksToExcel: (clients: Client[], tasks: TaskItem[], filename = 'TASK-VAANI_Compliance_Master.xlsx') => {
    const wb = XLSX.utils.book_new();

    // 1. Clients Sheet
    const clientsData = clients.map(c => ({
      'Client ID': c.id,
      'Trade / Brand Name': c.tradeName,
      'Legal Entity Name': c.legalName,
      'PAN': c.pan,
      'GSTIN': c.gstin || 'N/A',
      'Entity Category': c.category,
      'Contact Person': c.contactPerson,
      'Phone Number': c.phone,
      'Email ID': c.email,
      'Assigned Staff': c.assignedTeamName,
      'Status': c.status,
      'Created Date': c.createdAt
    }));
    const wsClients = XLSX.utils.json_to_sheet(clientsData);
    XLSX.utils.book_append_sheet(wb, wsClients, 'Clients Master');

    // 2. Tasks Sheet
    const tasksData = tasks.map(t => ({
      'Task ID': t.id,
      'Client Name': t.clientName,
      'Category': t.category,
      'Title': t.title,
      'Frequency': t.frequency,
      'Due Rule / Day': t.dueDayOrDate,
      'Due Date (YYYY-MM-DD)': t.dueDate,
      'Status': t.status,
      'Assigned Staff': t.assignedTeamName,
      'Priority': t.priority,
      'Period': t.period || 'N/A',
      'Financial Year': t.financialYear,
      'Completed Date': t.completedAt || 'N/A',
      'Completed By': t.completedBy || 'N/A'
    }));
    const wsTasks = XLSX.utils.json_to_sheet(tasksData);
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Compliance Matrix');

    // Write file
    XLSX.writeFile(wb, filename);
  },

  exportExtraWorkToExcel: (items: ExtraWorkItem[], filename = 'TASK-VAANI_Extra_Billable_Work.xlsx') => {
    const wb = XLSX.utils.book_new();
    const data = items.map(w => ({
      'Work ID': w.id,
      'Client': w.clientName,
      'Task Title': w.taskTitle,
      'Description': w.description,
      'Category': w.category,
      'Agreed Fee (INR)': w.agreedFee,
      'Advance Received (INR)': w.advanceReceived,
      'Balance Due (INR)': w.balanceDue,
      'Status': w.status,
      'Assigned Staff': w.assignedTeamName,
      'Created Date': w.createdDate,
      'Target Completion': w.targetCompletionDate
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Extra Work');
    XLSX.writeFile(wb, filename);
  },

  exportAuditLogsToExcel: (logs: AuditLog[], filename = 'TASK-VAANI_Audit_Trail.xlsx') => {
    const wb = XLSX.utils.book_new();
    const data = logs.map(l => ({
      'Log ID': l.id,
      'Timestamp (IST)': l.timestamp,
      'Actor Name': l.actorName,
      'Role': l.role,
      'Category': l.category,
      'Action': l.action,
      'Details': l.details
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Logs');
    XLSX.writeFile(wb, filename);
  },

  exportDayWiseAttendanceToExcel: (records: any[], filename = 'TASK-VAANI_Day_Wise_Attendance.xlsx') => {
    const wb = XLSX.utils.book_new();
    const data = records.map(r => ({
      'Date': r.date,
      'Team Member': r.teamName,
      'Punch In Time': r.punchInTime ? (r.punchInTime.includes('T') ? new Date(r.punchInTime).toLocaleTimeString('en-IN') : r.punchInTime) : '-',
      'Punch Out Time': r.punchOutTime ? (r.punchOutTime.includes('T') ? new Date(r.punchOutTime).toLocaleTimeString('en-IN') : r.punchOutTime) : 'Completed',
      'Working Time': `${Math.floor(r.totalMinutesWorked / 60)}h ${r.totalMinutesWorked % 60}m`,
      'Total Minutes': r.totalMinutesWorked,
      'Work / Task Details': r.workSessionNotes || 'Work Session',
      'Attendance Status': r.status || 'PRESENT',
      'Google Drive Photo Link': r.selfieDataUrl ? `https://drive.google.com/drive/search?q=TASK-VAANI+Attendance+${encodeURIComponent(r.teamName)}+${r.date}` : 'Verified Biometric'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Day Wise Attendance');
    XLSX.writeFile(wb, filename);
  },

  exportMonthWiseAttendanceToExcel: (monthlySummary: any[], filename = 'TASK-VAANI_Month_Wise_Attendance_Summary.xlsx') => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(monthlySummary);
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Staff Hours');
    XLSX.writeFile(wb, filename);
  },

  downloadTemplate: () => {
    const wb = XLSX.utils.book_new();
    const sampleData = [
      {
        'Trade / Brand Name': 'XYZ Global Logistics Pvt Ltd',
        'Legal Entity Name': 'XYZ Global Logistics Private Limited',
        'PAN': 'AABCX1234F',
        'GSTIN': '27AABCX1234F1Z8',
        'Entity Category': 'PVT_LTD',
        'Contact Person': 'Sunil Saxena',
        'Phone Number': '+91 98200 99881',
        'Email ID': 'sunil@xyzglobal.com',
        'Assigned Staff': 'CA Rajesh Sharma',
        'Status': 'ACTIVE'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Client_Import_Template');
    XLSX.writeFile(wb, 'TASK-VAANI_Client_Import_Template.xlsx');
  },

  importClientsFromExcel: async (file: File): Promise<Partial<Client>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

          const parsedClients: Partial<Client>[] = rawJson.map((row, idx) => ({
            id: 'cli-' + Date.now() + '-' + idx,
            tradeName: row['Trade / Brand Name'] || row['tradeName'] || row['Client Name'] || 'New Client',
            legalName: row['Legal Entity Name'] || row['legalName'] || row['Trade / Brand Name'] || 'New Client Legal',
            pan: (row['PAN'] || row['pan'] || '').toUpperCase().trim(),
            gstin: (row['GSTIN'] || row['gstin'] || '').toUpperCase().trim(),
            category: (row['Entity Category'] || row['category'] || 'PVT_LTD') as any,
            contactPerson: row['Contact Person'] || row['contactPerson'] || '',
            phone: row['Phone Number'] || row['phone'] || '',
            email: row['Email ID'] || row['email'] || '',
            assignedTeamName: row['Assigned Staff'] || 'Unassigned',
            assignedTeamId: 'team-1',
            status: 'ACTIVE',
            createdAt: new Date().toISOString().split('T')[0]
          }));

          resolve(parsedClients);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  }
};
