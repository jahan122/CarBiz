import { contextBridge, ipcRenderer } from 'electron';
import type {
  AttachmentCategory,
  BusinessProfile,
  CreateUserInput,
  ExpenseInput,
  NewDealInput,
  PaymentInput,
  SaleInput,
  TransferInput,
  UpdateDealInput,
  UpdateUserInput,
} from './db';

contextBridge.exposeInMainWorld('api', {
  listDeals: () => ipcRenderer.invoke('deals:list'),
  listDeletedDeals: () => ipcRenderer.invoke('deals:listDeleted'),
  getDeal: (id: number) => ipcRenderer.invoke('deals:get', id),
  createDeal: (input: NewDealInput, sale?: SaleInput | null) => ipcRenderer.invoke('deals:create', input, sale),
  updateDeal: (id: number, input: UpdateDealInput) => ipcRenderer.invoke('deals:update', id, input),
  softDeleteDeal: (id: number) => ipcRenderer.invoke('deals:softDelete', id),
  restoreDeal: (id: number) => ipcRenderer.invoke('deals:restore', id),
  deleteDeal: (id: number) => ipcRenderer.invoke('deals:delete', id),
  emptyRecycleBin: () => ipcRenderer.invoke('deals:emptyRecycleBin'),
  markSold: (id: number, sale: SaleInput) => ipcRenderer.invoke('deals:markSold', id, sale),
  revertSale: (id: number) => ipcRenderer.invoke('deals:revertSale', id),

  updateTransfer: (id: number, input: TransferInput) => ipcRenderer.invoke('transfer:update', id, input),

  listAttachments: (dealId: number) => ipcRenderer.invoke('attachments:list', dealId),
  pickAndAddAttachment: (dealId: number, category: AttachmentCategory, label?: string) =>
    ipcRenderer.invoke('attachments:pickAndAdd', dealId, category, label),
  pickAndSaveAttachment: (dealId: number, category: AttachmentCategory, label?: string) =>
    ipcRenderer.invoke('attachments:pickAndAdd', dealId, category, label),
  saveWebcamAttachment: (dealId: number, category: AttachmentCategory, label: string, dataUrl: string) =>
    ipcRenderer.invoke('attachments:saveWebcam', dealId, category, label, dataUrl),
  readAttachmentDataUrl: (filePath: string) => ipcRenderer.invoke('attachments:readDataUrl', filePath),
  getAttachmentDataUrl: (filePath: string) => ipcRenderer.invoke('attachments:readDataUrl', filePath),
  deleteAttachment: (id: number) => ipcRenderer.invoke('attachments:delete', id),

  listExpenses: (dealId: number) => ipcRenderer.invoke('expenses:list', dealId),
  addExpense: (dealId: number, input: ExpenseInput) => ipcRenderer.invoke('expenses:add', dealId, input),
  updateExpense: (id: number, input: ExpenseInput) => ipcRenderer.invoke('expenses:update', id, input),
  deleteExpense: (id: number) => ipcRenderer.invoke('expenses:delete', id),

  listPayments: (dealId: number) => ipcRenderer.invoke('payments:list', dealId),
  addPayment: (dealId: number, input: PaymentInput) => ipcRenderer.invoke('payments:add', dealId, input),
  updatePayment: (id: number, input: PaymentInput) => ipcRenderer.invoke('payments:update', id, input),
  deletePayment: (id: number) => ipcRenderer.invoke('payments:delete', id),

  hasUsers: () => ipcRenderer.invoke('users:hasUsers'),
  listUsers: () => ipcRenderer.invoke('users:list'),
  createUser: (input: CreateUserInput) => ipcRenderer.invoke('users:create', input),
  updateUser: (id: number, input: UpdateUserInput) => ipcRenderer.invoke('users:update', id, input),
  deleteUser: (id: number) => ipcRenderer.invoke('users:delete', id),
  authenticatePin: (pin: string, userId?: number) => ipcRenderer.invoke('users:authenticate', pin, userId),

  getBusinessProfile: () => ipcRenderer.invoke('settings:getBusinessProfile'),
  setBusinessProfile: (profile: Partial<BusinessProfile>) => ipcRenderer.invoke('settings:setBusinessProfile', profile),

  listAutoBackups: () => ipcRenderer.invoke('data:listAutoBackups'),
  autoBackupFolder: () => ipcRenderer.invoke('data:autoBackupFolder'),
  backupOrExport: (kind: 'db' | 'csv') => ipcRenderer.invoke('data:export', kind),
  restoreFromPath: (backupPath: string) => ipcRenderer.invoke('data:restoreFromPath', backupPath),
  restoreFromBackup: (backupPath?: string) => ipcRenderer.invoke('data:restoreFromBackup', backupPath),
  pickAndRestore: () => ipcRenderer.invoke('data:pickAndRestore'),

  saveReceiptPdf: (html: string, defaultFileName: string) => ipcRenderer.invoke('receipt:savePdf', html, defaultFileName),
  printReceiptHtml: (html: string) => ipcRenderer.invoke('receipt:printHtml', html),
  showInFolder: (filePath: string) => ipcRenderer.invoke('shell:showInFolder', filePath),
  openExternalUrl: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
});