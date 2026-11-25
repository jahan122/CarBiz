import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  CarDealsDb,
  type AttachmentCategory,
  type BusinessProfile,
  type CreateUserInput,
  type ExpenseInput,
  type NewDealInput,
  type PaymentInput,
  type SaleInput,
  type TransferInput,
  type UpdateDealInput,
  type UpdateUserInput,
} from './db';

const isDev = !app.isPackaged && Boolean(process.env.VITE_DEV_SERVER_URL);
let db: CarDealsDb;
let mainWindow: BrowserWindow | null = null;

function attachmentsDir(): string {
  const dir = path.join(app.getPath('userData'), 'attachments');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function backupsDir(): string {
  const dir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runDailyAutoBackup(database: CarDealsDb): void {
  try {
    const dir = backupsDir();
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const target = path.join(dir, `auto-backup-${stamp}.db`);
    if (!fs.existsSync(target)) {
      void database.backupTo(target);
    }
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('auto-backup-') && f.endsWith('.db'))
      .sort();
    while (files.length > 30) {
      const oldest = files.shift();
      if (oldest) fs.unlinkSync(path.join(dir, oldest));
    }
  } catch {
    /* ignore */
  }
}

async function performRestore(
  backupPath: string,
): Promise<{ restored: boolean; count: number; sourceName: string }> {
  if (!fs.existsSync(backupPath)) throw new Error('Backup file not found');
  const currentPath = db.filePath;
  const preRestore = path.join(backupsDir(), `pre-restore-${Date.now()}.db`);
  await db.backupTo(preRestore);
  db.close();
  fs.copyFileSync(backupPath, currentPath);
  db = new CarDealsDb(currentPath);
  const count = db.listDeals().length;
  return { restored: true, count, sourceName: path.basename(backupPath) };
}

function createWindow(): void {
  Menu.setApplicationMenu(null);

  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1024,
    minHeight: 660,
    backgroundColor: '#f8fafc',
    title: 'Car Deals Manager',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    mainWindow?.show();
    void dialog.showErrorBox(
      'Failed to Load Application UI',
      `URL: ${validatedURL}\nError (${errorCode}): ${errorDescription}`,
    );
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexHtml = path.join(__dirname, '..', 'dist', 'index.html');
    void mainWindow.loadFile(indexHtml);
  }
}

function registerIpc(): void {
  // Deals
  ipcMain.handle('deals:list', () => db.listDeals());
  ipcMain.handle('deals:listDeleted', () => db.listDeletedDeals());
  ipcMain.handle('deals:get', (_e, id: number) => db.getDealById(id));
  ipcMain.handle('deals:create', (_e, input: NewDealInput, sale?: SaleInput | null) => db.createDeal(input, sale));
  ipcMain.handle('deals:update', (_e, id: number, input: UpdateDealInput) => db.updateDeal(id, input));
  ipcMain.handle('deals:softDelete', (_e, id: number) => {
    db.softDeleteDeal(id);
  });
  ipcMain.handle('deals:restore', (_e, id: number) => db.restoreDeal(id));
  ipcMain.handle('deals:delete', (_e, id: number) => {
    db.deleteDeal(id);
  });
  ipcMain.handle('deals:emptyRecycleBin', () => {
    db.emptyRecycleBin();
  });
  ipcMain.handle('deals:markSold', (_e, id: number, sale: SaleInput) => db.markSold(id, sale));
  ipcMain.handle('deals:revertSale', (_e, id: number) => db.revertSale(id));

  // File Handover & Transfer
  ipcMain.handle('transfer:update', (_e, id: number, input: TransferInput) => db.updateTransfer(id, input));

  // Attachments (Disk + Webcam + In-App Preview)
  ipcMain.handle('attachments:list', (_e, dealId: number) => db.listAttachments(dealId));
  ipcMain.handle('attachments:pickAndAdd', async (_e, dealId: number, category: AttachmentCategory, label?: string) => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Document or Photo',
      properties: ['openFile'],
      filters: [
        { name: 'Images & Documents', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const srcPath = res.filePaths[0];
    const ext = path.extname(srcPath);
    const baseName = path.basename(srcPath);
    const dealFolder = path.join(attachmentsDir(), `deal-${dealId}`);
    fs.mkdirSync(dealFolder, { recursive: true });
    const destName = `${Date.now()}-${category.toLowerCase()}${ext}`;
    const destPath = path.join(dealFolder, destName);
    fs.copyFileSync(srcPath, destPath);
    return db.addAttachment(dealId, {
      category,
      label: label || category,
      file_name: baseName,
      file_path: destPath,
    });
  });

  ipcMain.handle(
    'attachments:saveWebcam',
    (_e, dealId: number, category: AttachmentCategory, label: string, dataUrl: string) => {
      const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl);
      if (!match) throw new Error('Invalid image capture data');
      const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      const buffer = Buffer.from(match[2], 'base64');
      const dealFolder = path.join(attachmentsDir(), `deal-${dealId}`);
      fs.mkdirSync(dealFolder, { recursive: true });
      const fileName = `webcam-${category.toLowerCase()}-${Date.now()}.${ext}`;
      const destPath = path.join(dealFolder, fileName);
      fs.writeFileSync(destPath, buffer);
      return db.addAttachment(dealId, {
        category,
        label: label || category,
        file_name: fileName,
        file_path: destPath,
      });
    },
  );

  ipcMain.handle('attachments:readDataUrl', (_e, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    const mime = mimeMap[ext];
    if (!mime) return null;
    const b64 = fs.readFileSync(filePath).toString('base64');
    return `data:${mime};base64,${b64}`;
  });

  ipcMain.handle('attachments:delete', (_e, id: number) => {
    const removed = db.deleteAttachment(id);
    if (removed && removed.file_path && fs.existsSync(removed.file_path)) {
      try {
        fs.unlinkSync(removed.file_path);
      } catch {
        /* ignore */
      }
    }
  });

  // Expenses
  ipcMain.handle('expenses:list', (_e, dealId: number) => db.listExpenses(dealId));
  ipcMain.handle('expenses:add', (_e, dealId: number, input: ExpenseInput) => db.addExpense(dealId, input));
  ipcMain.handle('expenses:update', (_e, id: number, input: ExpenseInput) => db.updateExpense(id, input));
  ipcMain.handle('expenses:delete', (_e, id: number) => {
    db.deleteExpense(id);
  });

  // Payments
  ipcMain.handle('payments:list', (_e, dealId: number) => db.listPayments(dealId));
  ipcMain.handle('payments:add', (_e, dealId: number, input: PaymentInput) => db.addPayment(dealId, input));
  ipcMain.handle('payments:update', (_e, id: number, input: PaymentInput) => db.updatePayment(id, input));
  ipcMain.handle('payments:delete', (_e, id: number) => {
    db.deletePayment(id);
  });

  // Multi-User Role-Based PIN Lock
  ipcMain.handle('users:hasUsers', () => db.hasUsers());
  ipcMain.handle('users:list', () => db.listUsers());
  ipcMain.handle('users:create', (_e, input: CreateUserInput) => db.createUser(input));
  ipcMain.handle('users:update', (_e, id: number, input: UpdateUserInput) => db.updateUser(id, input));
  ipcMain.handle('users:delete', (_e, id: number) => {
    db.deleteUser(id);
  });
  ipcMain.handle('users:authenticate', (_e, pin: string, userId?: number) => db.authenticatePin(pin, userId));

  // Business Profile
  ipcMain.handle('settings:getBusinessProfile', () => db.getBusinessProfile());
  ipcMain.handle('settings:setBusinessProfile', (_e, profile: Partial<BusinessProfile>) => db.setBusinessProfile(profile));

  // Backup & Restore
  ipcMain.handle('data:autoBackupFolder', () => backupsDir());
  ipcMain.handle('data:listAutoBackups', () => {
    const dir = backupsDir();
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .sort()
      .reverse()
      .map((name) => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        return { name, path: full, size: stat.size, mtime: stat.mtime.toISOString() };
      });
  });

  ipcMain.handle('data:export', async (_e, kind: 'db' | 'csv') => {
    if (!mainWindow) return { saved: false };
    const date = new Date().toISOString().slice(0, 10);
    const isDb = kind === 'db';
    const res = await dialog.showSaveDialog(mainWindow, {
      title: isDb ? 'Backup Car Deals Database' : 'Export Car Deals to CSV',
      defaultPath: path.join(app.getPath('documents'), isDb ? `car-deals-backup-${date}.db` : `car-deals-${date}.csv`),
      filters: [isDb ? { name: 'SQLite Database', extensions: ['db'] } : { name: 'CSV Spreadsheet', extensions: ['csv'] }],
    });
    if (res.canceled || !res.filePath) return { saved: false };
    if (isDb) {
      await db.backupTo(res.filePath);
    } else {
      fs.writeFileSync(res.filePath, db.exportCsv(), 'utf8');
    }
    return { saved: true, path: res.filePath };
  });

  ipcMain.handle('data:restoreFromPath', async (_e, backupPath: string) => performRestore(backupPath));

  ipcMain.handle('data:restoreFromBackup', async (_e, backupPath?: string) => {
    if (backupPath) {
      return performRestore(backupPath);
    }
    if (!mainWindow) return { restored: false };
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Backup Database File to Restore',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return { restored: false };
    return performRestore(res.filePaths[0]);
  });

  ipcMain.handle('data:pickAndRestore', async () => {
    if (!mainWindow) return { restored: false };
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Backup Database File to Restore',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return { restored: false };
    return performRestore(res.filePaths[0]);
  });

  // Printing / Save Receipt PDF
  ipcMain.handle('receipt:savePdf', async (_e, html: string, defaultFileName: string) => {
    if (!mainWindow) return { saved: false };
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Receipt as PDF',
      defaultPath: path.join(app.getPath('documents'), defaultFileName),
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    });
    if (res.canceled || !res.filePath) return { saved: false };

    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
      });
      fs.writeFileSync(res.filePath, pdfBuffer);
      return { saved: true, path: res.filePath };
    } finally {
      win.close();
    }
  });

  ipcMain.handle('receipt:printHtml', async (_e, html: string) => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await new Promise<void>((resolve) => {
        win.webContents.print({ silent: false, printBackground: true }, () => resolve());
      });
    } finally {
      win.close();
    }
  });

  ipcMain.handle('shell:showInFolder', (_e, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) {
      await shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(false);
  });

  db = new CarDealsDb(path.join(app.getPath('userData'), 'car-deals.db'));
  runDailyAutoBackup(db);
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  db?.close();
});