export type ReportFormat = 'json' | 'csv' | 'excel' | 'pdf';

export interface ReportFilterInput {
  branchId?: string;
  startDate?: string;
  endDate?: string;
  format?: ReportFormat;
  limit?: number;
}

export interface ReportColumn {
  key: string;
  header: string;
  isCurrency?: boolean;
}

export interface ReportTableResult<
  TRow extends Record<string, unknown> = Record<string, unknown>,
  TSummary extends Record<string, unknown> = Record<string, unknown>,
> {
  title: string;
  filename: string;
  branchId: string;
  currency: string;
  currencySymbol: string;
  period: {
    startDate: string;
    endDate: string;
  };
  generatedAt: string;
  summary: TSummary;
  columns: ReportColumn[];
  rows: TRow[];
  extra?: Record<string, unknown>;
}

