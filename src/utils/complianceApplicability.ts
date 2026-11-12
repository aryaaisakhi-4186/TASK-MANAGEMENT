import { Client, ClientComplianceApplicability, ComplianceApplicabilityKey, TaskItem } from '../types';

export const COMPLIANCE_APPLICABILITY_ITEMS: {
  key: ComplianceApplicabilityKey;
  label: string;
  fullTitle: string;
}[] = [
  { key: 'AUDIT', label: 'AUDIT', fullTitle: 'Statutory / Tax Audit (44AB)' },
  { key: 'GST', label: 'GST', fullTitle: 'GST Regular Returns (GSTR-1 / 3B)' },
  { key: 'GSTR_9', label: 'GSTR-9', fullTitle: 'GSTR-9 (GST Annual Return)' },
  { key: 'GSTR_9C', label: 'GSTR-9C', fullTitle: 'GSTR-9C (Reconciliation Statement / Audit)' },
  { key: 'TDS', label: 'TDS', fullTitle: 'TDS / TCS Compliance (24Q / 26Q)' },
  { key: 'ITR', label: 'ITR', fullTitle: 'Income Tax Return (ITR Filing)' },
  { key: 'VAT', label: 'VAT', fullTitle: 'VAT / State Tax (Return & Tax Payment)' },
  { key: 'E_INVOICE', label: 'E-INVOICE', fullTitle: 'GST E-Invoicing Mandate' },
  { key: 'RCM', label: 'RCM', fullTitle: 'Reverse Charge Mechanism (RCM)' },
  { key: 'RULE_86B', label: '86B', fullTitle: 'Rule 86B (1% Cash Ledger GST Rule)' },
];

export function hasValidPan(pan?: string | null): boolean {
  if (!pan) return false;
  const clean = pan.trim().toUpperCase();
  if (!clean || clean === 'PAN-PENDING' || clean === 'N/A' || clean === 'NA' || clean === 'NONE' || clean === '-') return false;
  return clean.length >= 5;
}

export function hasValidGstin(gstin?: string | null): boolean {
  if (!gstin) return false;
  const clean = gstin.trim().toUpperCase();
  if (!clean || clean === 'N/A' || clean === 'NA' || clean === 'NONE' || clean === 'PENDING' || clean === '-') return false;
  return clean.length >= 5;
}

export function hasValidTan(tan?: string | null): boolean {
  if (!tan) return false;
  const clean = tan.trim().toUpperCase();
  if (!clean || clean === 'N/A' || clean === 'NA' || clean === 'NONE' || clean === 'PENDING' || clean === '-') return false;
  return clean.length >= 4;
}

export function hasValidVat(vat?: string | null): boolean {
  if (!vat) return false;
  const clean = vat.trim().toUpperCase();
  if (!clean || clean === 'N/A' || clean === 'NA' || clean === 'NONE' || clean === 'PENDING' || clean === '-') return false;
  return clean.length >= 3;
}

/**
 * Checks whether a compliance task is valid for a client based on the Tax ID columns populated in Client Master:
 * - TDS tasks require TAN number in Client Master
 * - GST tasks require GSTIN number in Client Master
 * - VAT tasks require VAT number in Client Master
 * - Income Tax (ITR) tasks require PAN number in Client Master
 */
export function isTaskAllowedForClientTaxIds(task: TaskItem, client?: Partial<Client> | null): boolean {
  if (!client) return true;
  const cat = (task.category || '').toUpperCase().trim();
  const title = (task.title || '').toUpperCase().trim();

  const isTdsTask = cat === 'TDS' || title.includes('TDS') || title.includes('CHALLAN 281') || title.includes('24Q') || title.includes('26Q');
  if (isTdsTask) {
    return hasValidTan(client.tan);
  }

  const isGstTask = cat === 'GST' || title.includes('GSTR') || title.includes('3B');
  if (isGstTask) {
    return hasValidGstin(client.gstin);
  }

  const isVatTask = cat === 'VAT' || title.includes('VAT');
  if (isVatTask) {
    return hasValidVat(client.vatNumber);
  }

  const isPanTask = cat === 'INCOME_TAX' || cat === 'ADVANCE_TAX' || title.includes('ITR') || title.includes('INCOME TAX');
  if (isPanTask) {
    return hasValidPan(client.pan);
  }

  return true;
}

const normKey = (s?: string) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Generates missing statutory compliance tasks for a client strictly for the Tax ID columns
 * that have data in Client Master (PAN -> ITR, GSTIN -> GSTR-1 & GSTR-3B, TAN -> TDS Challan 281, VAT -> VAT Returns).
 */
export function generateMissingTasksForClientTaxIds(
  client: Client,
  existingClientTasks: TaskItem[],
  deletedTaskIds: Set<string>,
  defaultTaxYear: string = 'Tax Year 2026-27'
): TaskItem[] {
  const created: TaskItem[] = [];
  if (!client || !client.id) return created;

  const hasPan = hasValidPan(client.pan);
  const hasGst = hasValidGstin(client.gstin);
  const hasTan = hasValidTan(client.tan);
  const hasVat = hasValidVat(client.vatNumber);

  const staffId = client.assignedTeamId || '';
  const staffName = client.assignedTeamName || 'Assigned Staff';

  const hasTaskOrDeleted = (autoId: string, fullTitle: string, matchFn: (t: TaskItem) => boolean): boolean => {
    if (deletedTaskIds.has(autoId) || deletedTaskIds.has(`sig:${client.id}::${normKey(fullTitle)}`)) {
      return true;
    }
    return existingClientTasks.some(matchFn);
  };

  // 1. TAN Column -> TDS Compliance Task
  if (hasTan) {
    const autoId = `tsk-auto-${client.id}-tds`;
    const fullTitle = 'Monthly TDS Payment (Challan 281)';
    const exists = hasTaskOrDeleted(autoId, fullTitle, t => {
      const cat = (t.category || '').toUpperCase();
      const ttl = (t.title || '').toUpperCase();
      return cat === 'TDS' || ttl.includes('TDS') || ttl.includes('CHALLAN 281');
    });
    if (!exists) {
      created.push({
        id: autoId,
        clientId: client.id,
        clientName: client.tradeName,
        title: fullTitle,
        category: 'TDS',
        frequency: 'MONTHLY',
        dueDayOrDate: '2',
        dueDate: '2026-09-07',
        status: 'PENDING',
        assignedTeamId: staffId,
        assignedTeamName: staffName,
        priority: 'HIGH',
        financialYear: defaultTaxYear,
      });
    }
  }

  // 2. GSTIN Column -> GST Compliance Tasks (GSTR-1 & GSTR-3B)
  if (hasGst) {
    const autoIdGstr1 = `tsk-auto-${client.id}-gstr1`;
    const titleGstr1 = 'GSTR-1 Monthly Outward Return';
    const existsGstr1 = hasTaskOrDeleted(autoIdGstr1, titleGstr1, t =>
      (t.title || '').toUpperCase().includes('GSTR-1') || (t.title || '').toUpperCase().includes('GSTR 1')
    );
    if (!existsGstr1) {
      created.push({
        id: autoIdGstr1,
        clientId: client.id,
        clientName: client.tradeName,
        title: titleGstr1,
        category: 'GST',
        frequency: 'MONTHLY',
        dueDayOrDate: '6',
        dueDate: '2026-09-11',
        status: 'PENDING',
        assignedTeamId: staffId,
        assignedTeamName: staffName,
        priority: 'CRITICAL',
        financialYear: defaultTaxYear,
      });
    }

    const autoIdGstr3b = `tsk-auto-${client.id}-gstr3b`;
    const titleGstr3b = 'GSTR-3B Monthly Return & Tax Settlement';
    const existsGstr3b = hasTaskOrDeleted(autoIdGstr3b, titleGstr3b, t =>
      (t.title || '').toUpperCase().includes('GSTR-3B') || (t.title || '').toUpperCase().includes('3B')
    );
    if (!existsGstr3b) {
      created.push({
        id: autoIdGstr3b,
        clientId: client.id,
        clientName: client.tradeName,
        title: titleGstr3b,
        category: 'GST',
        frequency: 'MONTHLY',
        dueDayOrDate: '15',
        dueDate: '2026-09-20',
        status: 'PENDING',
        assignedTeamId: staffId,
        assignedTeamName: staffName,
        priority: 'CRITICAL',
        financialYear: defaultTaxYear,
      });
    }

    if (client.complianceApplicability?.GSTR_9) {
      const autoIdGstr9 = `tsk-auto-${client.id}-gstr9`;
      const titleGstr9 = 'GSTR-9 Annual Return';
      const existsGstr9 = hasTaskOrDeleted(autoIdGstr9, titleGstr9, t => {
        const u = (t.title || '').toUpperCase();
        return u.includes('GSTR-9') && !u.includes('GSTR-9C');
      });
      if (!existsGstr9) {
        created.push({
          id: autoIdGstr9,
          clientId: client.id,
          clientName: client.tradeName,
          title: titleGstr9,
          category: 'GST',
          frequency: 'YEARLY',
          dueDayOrDate: '26',
          dueDate: '2026-12-31',
          status: 'PENDING',
          assignedTeamId: staffId,
          assignedTeamName: staffName,
          priority: 'HIGH',
          financialYear: defaultTaxYear,
        });
      }
    }

    if (client.complianceApplicability?.GSTR_9C) {
      const autoIdGstr9c = `tsk-auto-${client.id}-gstr9c`;
      const titleGstr9c = 'GSTR-9C Reconciliation Statement & Audit Certification';
      const existsGstr9c = hasTaskOrDeleted(autoIdGstr9c, titleGstr9c, t =>
        (t.title || '').toUpperCase().includes('GSTR-9C')
      );
      if (!existsGstr9c) {
        created.push({
          id: autoIdGstr9c,
          clientId: client.id,
          clientName: client.tradeName,
          title: titleGstr9c,
          category: 'GST',
          frequency: 'YEARLY',
          dueDayOrDate: '26',
          dueDate: '2026-12-31',
          status: 'PENDING',
          assignedTeamId: staffId,
          assignedTeamName: staffName,
          priority: 'HIGH',
          financialYear: defaultTaxYear,
        });
      }
    }
  }

  // 3. PAN Column -> Income Tax Return (ITR) Compliance Task
  if (hasPan) {
    const autoIdItr = `tsk-auto-${client.id}-itr`;
    const titleItr = 'Income Tax Return (ITR) Annual Filing';
    const existsItr = hasTaskOrDeleted(autoIdItr, titleItr, t => {
      const cat = (t.category || '').toUpperCase();
      const ttl = (t.title || '').toUpperCase();
      return cat === 'INCOME_TAX' || ttl.includes('ITR') || ttl.includes('INCOME TAX RETURN');
    });
    if (!existsItr) {
      created.push({
        id: autoIdItr,
        clientId: client.id,
        clientName: client.tradeName,
        title: titleItr,
        category: 'INCOME_TAX',
        frequency: 'YEARLY',
        dueDayOrDate: '26',
        dueDate: '2026-07-31',
        status: 'PENDING',
        assignedTeamId: staffId,
        assignedTeamName: staffName,
        priority: 'HIGH',
        financialYear: defaultTaxYear,
      });
    }
  }

  // 4. VAT Column -> VAT Compliance Tasks
  if (hasVat) {
    const autoIdVatQ = `tsk-auto-${client.id}-vat-q`;
    const titleVatQ = 'VAT Quarterly Return Filing';
    const existsVatQ = hasTaskOrDeleted(autoIdVatQ, titleVatQ, t =>
      (t.title || '').toUpperCase().includes('VAT') && (t.frequency === 'QUARTERLY' || (t.title || '').toUpperCase().includes('QUARTERLY'))
    );
    if (!existsVatQ) {
      created.push({
        id: autoIdVatQ,
        clientId: client.id,
        clientName: client.tradeName,
        title: titleVatQ,
        category: 'VAT',
        frequency: 'QUARTERLY',
        dueDayOrDate: '25',
        dueDate: '2026-10-30',
        status: 'PENDING',
        assignedTeamId: staffId,
        assignedTeamName: staffName,
        priority: 'HIGH',
        financialYear: defaultTaxYear,
      });
    }

    const autoIdVatM = `tsk-auto-${client.id}-vat-m`;
    const titleVatM = 'Monthly VAT Tax Payment & Challan Deposit';
    const existsVatM = hasTaskOrDeleted(autoIdVatM, titleVatM, t =>
      (t.title || '').toUpperCase().includes('VAT') && (t.frequency === 'MONTHLY' || (t.title || '').toUpperCase().includes('MONTHLY'))
    );
    if (!existsVatM) {
      created.push({
        id: autoIdVatM,
        clientId: client.id,
        clientName: client.tradeName,
        title: titleVatM,
        category: 'VAT',
        frequency: 'MONTHLY',
        dueDayOrDate: '5',
        dueDate: '2026-09-10',
        status: 'PENDING',
        assignedTeamId: staffId,
        assignedTeamName: staffName,
        priority: 'HIGH',
        financialYear: defaultTaxYear,
      });
    }
  }

  return created;
}

export function resolveClientApplicability(client?: Partial<Client> | null): ClientComplianceApplicability {
  const hasPan = hasValidPan(client?.pan);
  const hasGst = hasValidGstin(client?.gstin);
  const hasTan = hasValidTan(client?.tan);
  const hasVat = hasValidVat(client?.vatNumber);
  const isCorp = client?.category === 'PVT_LTD' || client?.category === 'LLP';

  if (client?.complianceApplicability) {
    return {
      AUDIT: !!client.complianceApplicability.AUDIT,
      GST: hasGst,
      GSTR_9: hasGst ? (client.complianceApplicability.GSTR_9 !== undefined ? !!client.complianceApplicability.GSTR_9 : false) : false,
      GSTR_9C: hasGst ? (client.complianceApplicability.GSTR_9C !== undefined ? !!client.complianceApplicability.GSTR_9C : false) : false,
      TDS: hasTan,
      ITR: hasPan,
      VAT: hasVat,
      E_INVOICE: hasGst ? !!client.complianceApplicability.E_INVOICE : false,
      RCM: hasGst ? !!client.complianceApplicability.RCM : false,
      RULE_86B: hasGst ? !!client.complianceApplicability.RULE_86B : false,
    };
  }

  return {
    AUDIT: isCorp && hasPan,
    GST: hasGst,
    GSTR_9: false,
    GSTR_9C: false,
    TDS: hasTan,
    ITR: hasPan,
    VAT: hasVat,
    E_INVOICE: false,
    RCM: false,
    RULE_86B: false,
  };
}
