import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, TaskItem } from '../types';
import { GoogleDriveService } from './googleDriveService';

export const PDFService = {
  // Generates the PDF and directly emails it to arya.taskmanagement@gmail.com without filling phone storage!
  generateAndEmailReport: async (
    client: Client,
    tasks: TaskItem[],
    firmName = 'M/S VAANI & ASSOCIATES, CHARTERED ACCOUNTANTS',
    targetEmail = 'arya.taskmanagement@gmail.com'
  ): Promise<{ success: boolean; message: string }> => {
    const doc = new jsPDF();

    // Indian Corporate Header with Gold / Saffron accent
    doc.setFillColor(11, 25, 44);
    doc.rect(0, 0, 210, 38, 'F');

    // Accent line
    doc.setFillColor(218, 165, 32);
    doc.rect(0, 38, 210, 2, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(firmName.toUpperCase(), 14, 16);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(218, 165, 32);
    doc.text('CLIENT STATUTORY COMPLIANCE & STATUS REPORT (TASK-VAANI)', 14, 24);

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    const reportDate = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
    doc.text(`Generated on: ${reportDate} • Cloud Target: ${targetEmail}`, 14, 31);

    // Client Overview Card
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENT DETAILS', 14, 48);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Legal Name: ${client.legalName}`, 14, 55);
    doc.text(`Trade Name: ${client.tradeName}`, 14, 61);
    doc.text(`PAN: ${client.pan}`, 14, 67);
    doc.text(`GSTIN: ${client.gstin || 'Not Registered'}`, 110, 55);
    doc.text(`Entity Category: ${client.category}`, 110, 61);
    doc.text(`Assigned Partner/Staff: ${client.assignedTeamName}`, 110, 67);

    // Summary Statistics
    const clientTasks = tasks.filter(t => t.clientId === client.id);
    const total = clientTasks.length;
    const done = clientTasks.filter(t => t.status === 'DONE').length;
    const pending = clientTasks.filter(t => t.status === 'PENDING').length;
    const inProgress = clientTasks.filter(t => t.status === 'IN_PROGRESS').length;

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(14, 73, 182, 14, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Compliance Items: ${total}  |  Completed: ${done}  |  In Progress: ${inProgress}  |  Pending: ${pending}`, 18, 82);

    // Compliance Tasks Table
    const tableRows = clientTasks.map((t, idx) => [
      (idx + 1).toString(),
      t.title,
      t.category,
      t.frequency,
      t.dueDate,
      t.status.replace('_', ' '),
      t.priority,
      t.completedAt ? new Date(t.completedAt).toLocaleDateString('en-IN') : '-'
    ]);

    autoTable(doc, {
      startY: 92,
      head: [['#', 'Compliance Title', 'Category', 'Freq', 'Due Date', 'Status', 'Priority', 'Completed']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [11, 25, 44],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 58 },
        2: { cellWidth: 20 },
        3: { cellWidth: 18 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
        6: { cellWidth: 16 },
        7: { cellWidth: 18 },
      }
    });

    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Archived to ${targetEmail} • Zero device memory stored.`, 14, pageHeight - 12);
    doc.text('Page 1 of 1', 180, pageHeight - 12);

    // Convert in-memory to base64 string
    const pdfBase64 = doc.output('datauristring');
    const filename = `${client.tradeName.replace(/[^a-zA-Z0-9]/g, '_')}_Compliance_Report.pdf`;

    // Email to arya.taskmanagement@gmail.com
    return await GoogleDriveService.emailPDFReport(client.tradeName, pdfBase64, filename, targetEmail);
  },

  // Fallback direct download if user explicitly wants local copy
  downloadLocalPDF: (client: Client, tasks: TaskItem[], firmName = 'M/S VAANI & ASSOCIATES, CHARTERED ACCOUNTANTS') => {
    const doc = new jsPDF();
    doc.setFillColor(11, 25, 44);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setFillColor(218, 165, 32);
    doc.rect(0, 38, 210, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(firmName.toUpperCase(), 14, 16);
    doc.save(`${client.tradeName.replace(/[^a-zA-Z0-9]/g, '_')}_Compliance.pdf`);
  }
};
