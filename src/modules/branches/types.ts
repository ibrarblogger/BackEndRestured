export interface CreateBranchInput {
  name: string;
  code: string;
  address: string;
  phone: string;
  email?: string;
  currency?: string;
  timezone?: string;
  taxRatePercent?: number;
  serviceChargePercent?: number;
  orderNumberPrefix?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  businessHours?: Record<string, any>;
  isActive?: boolean;
  actorUserId?: string;
}

export type UpdateBranchInput = Partial<CreateBranchInput>;
