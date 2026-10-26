import { Client, ClientComplianceApplicability, ComplianceApplicabilityKey } from '../types';

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

export function resolveClientApplicability(client?: Partial<Client> | null): ClientComplianceApplicability {
  const hasGst = !!(client?.gstin && client.gstin.trim().length >= 5);
  const hasTan = !!(client?.tan && client.tan.trim().length >= 4);
  const hasVat = !!(client?.vatNumber && client.vatNumber.trim().length >= 3);
  const isCorp = client?.category === 'PVT_LTD' || client?.category === 'LLP';

  if (client?.complianceApplicability) {
    return {
      AUDIT: !!client.complianceApplicability.AUDIT,
      GST: !!client.complianceApplicability.GST,
      GSTR_9: client.complianceApplicability.GSTR_9 !== undefined ? !!client.complianceApplicability.GSTR_9 : hasGst,
      GSTR_9C: client.complianceApplicability.GSTR_9C !== undefined ? !!client.complianceApplicability.GSTR_9C : (isCorp && hasGst),
      TDS: !!client.complianceApplicability.TDS,
      ITR: client.complianceApplicability.ITR !== undefined ? !!client.complianceApplicability.ITR : true,
      VAT: !!client.complianceApplicability.VAT,
      E_INVOICE: !!client.complianceApplicability.E_INVOICE,
      RCM: !!client.complianceApplicability.RCM,
      RULE_86B: !!client.complianceApplicability.RULE_86B,
    };
  }

  return {
    AUDIT: isCorp,
    GST: hasGst,
    GSTR_9: hasGst,
    GSTR_9C: isCorp && hasGst,
    TDS: hasTan || isCorp,
    ITR: true,
    VAT: hasVat,
    E_INVOICE: isCorp && hasGst,
    RCM: hasGst,
    RULE_86B: false,
  };
}
