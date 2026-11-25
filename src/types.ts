export type DealStatus = 'ACTIVE' | 'SOLD';
export type TransferStatus = 'PENDING' | 'WITH_AGENT' | 'COMPLETED';
export type UserRole = 'OWNER' | 'STAFF';

export interface AppUser {
  id: number;
  name: string;
  role: UserRole;
  can_view_profit: boolean;
  can_manage_payments: boolean;
  can_mark_sold: boolean;
  can_delete: boolean;
  created_at: string;
}

export interface CreateUserInput {
  name: string;
  pin: string;
  role: UserRole;
  can_view_profit?: boolean;
  can_manage_payments?: boolean;
  can_mark_sold?: boolean;
  can_delete?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  pin?: string;
  role?: UserRole;
  can_view_profit?: boolean;
  can_manage_payments?: boolean;
  can_mark_sold?: boolean;
  can_delete?: boolean;
}

export type AttachmentCategory =
  | 'CNIC_FRONT'
  | 'CNIC_BACK'
  | 'REGISTRATION_BOOK'
  | 'SMART_CARD'
  | 'OTHER';

export const ATTACHMENT_CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  CNIC_FRONT: 'CNIC (Front)',
  CNIC_BACK: 'CNIC (Back)',
  REGISTRATION_BOOK: 'Registration Book',
  SMART_CARD: 'Smart Card',
  OTHER: 'Other Document / Photo',
};

export const EXPENSE_CATEGORIES = [
  'Mechanic/Repair',
  'Denting/Painting',
  'Parts',
  'Detailing',
  'Commission',
  'Documentation/Tax',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type PaymentDirection = 'OUT_TO_SELLER' | 'IN_FROM_BUYER';
export type PaymentType = 'Advance' | 'Installment' | 'Final Balance' | 'Token' | 'Other';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Online/JazzCash/EasyPaisa' | 'Other';

export const PAYMENT_TYPES: readonly PaymentType[] = ['Advance', 'Installment', 'Final Balance', 'Token', 'Other'];
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['Cash', 'Bank Transfer', 'Cheque', 'Online/JazzCash/EasyPaisa', 'Other'];

export interface CarDeal {
  id: number;
  status: DealStatus;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  color: string | null;
  horse_power: string | null;
  registration_number: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  mileage: number | null;
  bought_from_location: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  seller_name: string | null;
  seller_father_name: string | null;
  seller_contact: string | null;
  seller_cnic: string | null;
  seller_address: string | null;
  sale_date: string | null;
  sale_price: number | null;
  purchaser_name: string | null;
  purchaser_father_name: string | null;
  purchaser_contact: string | null;
  purchaser_cnic: string | null;
  purchaser_address: string | null;
  transfer_status: TransferStatus;
  transfer_agent_name: string | null;
  transfer_agent_contact: string | null;
  file_handover_date: string | null;
  transfer_completed_date: string | null;
  transfer_cost: number;
  transfer_notes: string | null;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface DealWithTotals extends CarDeal {
  total_expenses: number;
  paid_to_seller: number;
  received_from_buyer: number;
  attachment_count: number;
}

export interface Expense {
  id: number;
  car_deal_id: number;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  created_by?: string | null;
}

export interface Payment {
  id: number;
  car_deal_id: number;
  direction: PaymentDirection;
  payment_type: PaymentType;
  method: PaymentMethod;
  amount: number;
  date: string;
  notes: string;
  created_by?: string | null;
}

export interface DealAttachment {
  id: number;
  car_deal_id: number;
  category: AttachmentCategory;
  label: string;
  file_name: string;
  file_path: string;
  created_at: string;
}

export interface BusinessProfile {
  business_name: string;
  tagline: string;
  owner_name: string;
  father_name: string;
  cnic: string;
  phone: string;
  address: string;
}

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  business_name: '',
  tagline: '',
  owner_name: 'Sultan Ansari',
  father_name: 'Masood Hussain Ansari',
  cnic: '42101-6548938-7',
  phone: '0333-3048451',
  address: 'H.No C-39, Block 16, Gulistan-e-Jauhar, Karachi',
};

export interface BackupFileInfo {
  name: string;
  path: string;
  size: number;
  mtime: string;
}

export interface NewDealInput {
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  year?: number | string | null;
  color?: string | null;
  horse_power?: string | null;
  registration_number?: string | null;
  chassis_number?: string | null;
  engine_number?: string | null;
  mileage?: number | string | null;
  bought_from_location?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | string | null;
  seller_name?: string | null;
  seller_father_name?: string | null;
  seller_contact?: string | null;
  seller_cnic?: string | null;
  seller_address?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

export interface SaleInput {
  sale_date?: string | null;
  sale_price?: number | string | null;
  purchaser_name?: string | null;
  purchaser_father_name?: string | null;
  purchaser_contact?: string | null;
  purchaser_cnic?: string | null;
  purchaser_address?: string | null;
}

export interface TransferInput {
  transfer_status?: TransferStatus;
  transfer_agent_name?: string | null;
  transfer_agent_contact?: string | null;
  file_handover_date?: string | null;
  transfer_completed_date?: string | null;
  transfer_cost?: number | string | null;
  transfer_notes?: string | null;
}

export type DealFormData = NewDealInput;
export type SaleFormData = SaleInput;
export type TransferFormData = TransferInput;

export interface CarDealsApi {
  listDeals(): Promise<DealWithTotals[]>;
  listDeletedDeals(): Promise<DealWithTotals[]>;
  getDeal(id: number): Promise<DealWithTotals>;
  createDeal(input: NewDealInput, sale?: SaleInput | null): Promise<DealWithTotals>;
  updateDeal(id: number, input: NewDealInput): Promise<DealWithTotals>;
  softDeleteDeal(id: number): Promise<void>;
  restoreDeal(id: number): Promise<DealWithTotals>;
  deleteDeal(id: number): Promise<void>;
  emptyRecycleBin(): Promise<void>;
  markSold(id: number, sale: SaleInput): Promise<DealWithTotals>;
  revertSale(id: number): Promise<DealWithTotals>;

  updateTransfer(id: number, input: TransferInput): Promise<DealWithTotals>;

  listAttachments(dealId: number): Promise<DealAttachment[]>;
  pickAndAddAttachment(dealId: number, category: AttachmentCategory, label?: string): Promise<DealAttachment | null>;
  pickAndSaveAttachment(dealId: number, category: AttachmentCategory, label?: string): Promise<DealAttachment | null>;
  saveWebcamAttachment(dealId: number, category: AttachmentCategory, label: string, dataUrl: string): Promise<DealAttachment>;
  readAttachmentDataUrl(filePath: string): Promise<string | null>;
  getAttachmentDataUrl(filePath: string): Promise<string | null>;
  deleteAttachment(id: number): Promise<void>;

  listExpenses(dealId: number): Promise<Expense[]>;
  addExpense(dealId: number, input: { category: ExpenseCategory; description: string; amount: string | number; date: string; created_by?: string }): Promise<Expense>;
  updateExpense(id: number, input: { category: ExpenseCategory; description: string; amount: string | number; date: string }): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;

  listPayments(dealId: number): Promise<Payment[]>;
  addPayment(dealId: number, input: {
    direction: PaymentDirection;
    payment_type: PaymentType;
    method: PaymentMethod;
    amount: string | number;
    date: string;
    notes: string;
    created_by?: string;
  }): Promise<Payment>;
  updatePayment(id: number, input: {
    direction: PaymentDirection;
    payment_type: PaymentType;
    method: PaymentMethod;
    amount: string | number;
    date: string;
    notes: string;
  }): Promise<Payment>;
  deletePayment(id: number): Promise<void>;

  hasUsers(): Promise<boolean>;
  listUsers(): Promise<AppUser[]>;
  createUser(input: CreateUserInput): Promise<AppUser>;
  updateUser(id: number, input: UpdateUserInput): Promise<AppUser>;
  deleteUser(id: number): Promise<void>;
  authenticatePin(pin: string, userId?: number): Promise<AppUser | null>;

  getBusinessProfile(): Promise<BusinessProfile>;
  setBusinessProfile(profile: Partial<BusinessProfile>): Promise<BusinessProfile>;

  listAutoBackups(): Promise<BackupFileInfo[]>;
  autoBackupFolder(): Promise<string>;
  backupOrExport(kind: 'db' | 'csv'): Promise<{ saved: boolean; path?: string }>;
  restoreFromPath(backupPath: string): Promise<{ restored: boolean; count?: number; sourceName?: string }>;
  restoreFromBackup(backupPath?: string): Promise<{ restored: boolean; count?: number; sourceName?: string }>;
  pickAndRestore(): Promise<{ restored: boolean; count?: number; sourceName?: string }>;

  saveReceiptPdf(html: string, defaultFileName: string): Promise<{ saved: boolean; path?: string }>;
  printReceiptHtml(html: string): Promise<void>;
  showInFolder(filePath: string): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
}

declare global {
  interface Window {
    api?: CarDealsApi;
  }
}