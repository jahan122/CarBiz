"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("./db");
const isDev = !electron_1.app.isPackaged && Boolean(process.env.VITE_DEV_SERVER_URL);
let db;
let mainWindow = null;
function attachmentsDir() {
    const dir = node_path_1.default.join(electron_1.app.getPath('userData'), 'attachments');
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
function backupsDir() {
    const dir = node_path_1.default.join(electron_1.app.getPath('userData'), 'backups');
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
function runDailyAutoBackup(database) {
    try {
        const dir = backupsDir();
        const d = new Date();
        const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const target = node_path_1.default.join(dir, `auto-backup-${stamp}.db`);
        if (!node_fs_1.default.existsSync(target)) {
            void database.backupTo(target);
        }
        const files = node_fs_1.default
            .readdirSync(dir)
            .filter((f) => f.startsWith('auto-backup-') && f.endsWith('.db'))
            .sort();
        while (files.length > 30) {
            const oldest = files.shift();
            if (oldest)
                node_fs_1.default.unlinkSync(node_path_1.default.join(dir, oldest));
        }
    }
    catch {
        /* ignore */
    }
}
async function performRestore(backupPath) {
    if (!node_fs_1.default.existsSync(backupPath))
        throw new Error('Backup file not found');
    const currentPath = db.filePath;
    const preRestore = node_path_1.default.join(backupsDir(), `pre-restore-${Date.now()}.db`);
    await db.backupTo(preRestore);
    db.close();
    node_fs_1.default.copyFileSync(backupPath, currentPath);
    db = new db_1.CarDealsDb(currentPath);
    const count = db.listDeals().length;
    return { restored: true, count, sourceName: node_path_1.default.basename(backupPath) };
}
function createWindow() {
    electron_1.Menu.setApplicationMenu(null);
    const preloadPath = node_path_1.default.join(__dirname, 'preload.js');
    mainWindow = new electron_1.BrowserWindow({
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
        void electron_1.dialog.showErrorBox('Failed to Load Application UI', `URL: ${validatedURL}\nError (${errorCode}): ${errorDescription}`);
    });
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        const indexHtml = node_path_1.default.join(__dirname, '..', 'dist', 'index.html');
        void mainWindow.loadFile(indexHtml);
    }
}
function registerIpc() {
    // Deals
    electron_1.ipcMain.handle('deals:list', () => db.listDeals());
    electron_1.ipcMain.handle('deals:listDeleted', () => db.listDeletedDeals());
    electron_1.ipcMain.handle('deals:get', (_e, id) => db.getDealById(id));
    electron_1.ipcMain.handle('deals:create', (_e, input, sale) => db.createDeal(input, sale));
    electron_1.ipcMain.handle('deals:update', (_e, id, input) => db.updateDeal(id, input));
    electron_1.ipcMain.handle('deals:softDelete', (_e, id) => {
        db.softDeleteDeal(id);
    });
    electron_1.ipcMain.handle('deals:restore', (_e, id) => db.restoreDeal(id));
    electron_1.ipcMain.handle('deals:delete', (_e, id) => {
        db.deleteDeal(id);
    });
    electron_1.ipcMain.handle('deals:emptyRecycleBin', () => {
        db.emptyRecycleBin();
    });
    electron_1.ipcMain.handle('deals:markSold', (_e, id, sale) => db.markSold(id, sale));
    electron_1.ipcMain.handle('deals:revertSale', (_e, id) => db.revertSale(id));
    // File Handover & Transfer
    electron_1.ipcMain.handle('transfer:update', (_e, id, input) => db.updateTransfer(id, input));
    // Attachments (Disk + Webcam + In-App Preview)
    electron_1.ipcMain.handle('attachments:list', (_e, dealId) => db.listAttachments(dealId));
    electron_1.ipcMain.handle('attachments:pickAndAdd', async (_e, dealId, category, label) => {
        if (!mainWindow)
            return null;
        const res = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: 'Select Document or Photo',
            properties: ['openFile'],
            filters: [
                { name: 'Images & Documents', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        if (res.canceled || res.filePaths.length === 0)
            return null;
        const srcPath = res.filePaths[0];
        const ext = node_path_1.default.extname(srcPath);
        const baseName = node_path_1.default.basename(srcPath);
        const dealFolder = node_path_1.default.join(attachmentsDir(), `deal-${dealId}`);
        node_fs_1.default.mkdirSync(dealFolder, { recursive: true });
        const destName = `${Date.now()}-${category.toLowerCase()}${ext}`;
        const destPath = node_path_1.default.join(dealFolder, destName);
        node_fs_1.default.copyFileSync(srcPath, destPath);
        return db.addAttachment(dealId, {
            category,
            label: label || category,
            file_name: baseName,
            file_path: destPath,
        });
    });
    electron_1.ipcMain.handle('attachments:saveWebcam', (_e, dealId, category, label, dataUrl) => {
        const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl);
        if (!match)
            throw new Error('Invalid image capture data');
        const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
        const buffer = Buffer.from(match[2], 'base64');
        const dealFolder = node_path_1.default.join(attachmentsDir(), `deal-${dealId}`);
        node_fs_1.default.mkdirSync(dealFolder, { recursive: true });
        const fileName = `webcam-${category.toLowerCase()}-${Date.now()}.${ext}`;
        const destPath = node_path_1.default.join(dealFolder, fileName);
        node_fs_1.default.writeFileSync(destPath, buffer);
        return db.addAttachment(dealId, {
            category,
            label: label || category,
            file_name: fileName,
            file_path: destPath,
        });
    });
    electron_1.ipcMain.handle('attachments:readDataUrl', (_e, filePath) => {
        if (!filePath || !node_fs_1.default.existsSync(filePath))
            return null;
        const ext = node_path_1.default.extname(filePath).toLowerCase();
        const mimeMap = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf',
        };
        const mime = mimeMap[ext];
        if (!mime)
            return null;
        const b64 = node_fs_1.default.readFileSync(filePath).toString('base64');
        return `data:${mime};base64,${b64}`;
    });
    electron_1.ipcMain.handle('attachments:delete', (_e, id) => {
        const removed = db.deleteAttachment(id);
        if (removed && removed.file_path && node_fs_1.default.existsSync(removed.file_path)) {
            try {
                node_fs_1.default.unlinkSync(removed.file_path);
            }
            catch {
                /* ignore */
            }
        }
    });
    // Expenses
    electron_1.ipcMain.handle('expenses:list', (_e, dealId) => db.listExpenses(dealId));
    electron_1.ipcMain.handle('expenses:add', (_e, dealId, input) => db.addExpense(dealId, input));
    electron_1.ipcMain.handle('expenses:update', (_e, id, input) => db.updateExpense(id, input));
    electron_1.ipcMain.handle('expenses:delete', (_e, id) => {
        db.deleteExpense(id);
    });
    // Payments
    electron_1.ipcMain.handle('payments:list', (_e, dealId) => db.listPayments(dealId));
    electron_1.ipcMain.handle('payments:add', (_e, dealId, input) => db.addPayment(dealId, input));
    electron_1.ipcMain.handle('payments:update', (_e, id, input) => db.updatePayment(id, input));
    electron_1.ipcMain.handle('payments:delete', (_e, id) => {
        db.deletePayment(id);
    });
    // Multi-User Role-Based PIN Lock
    electron_1.ipcMain.handle('users:hasUsers', () => db.hasUsers());
    electron_1.ipcMain.handle('users:list', () => db.listUsers());
    electron_1.ipcMain.handle('users:create', (_e, input) => db.createUser(input));
    electron_1.ipcMain.handle('users:update', (_e, id, input) => db.updateUser(id, input));
    electron_1.ipcMain.handle('users:delete', (_e, id) => {
        db.deleteUser(id);
    });
    electron_1.ipcMain.handle('users:authenticate', (_e, pin, userId) => db.authenticatePin(pin, userId));
    // Business Profile
    electron_1.ipcMain.handle('settings:getBusinessProfile', () => db.getBusinessProfile());
    electron_1.ipcMain.handle('settings:setBusinessProfile', (_e, profile) => db.setBusinessProfile(profile));
    // Backup & Restore
    electron_1.ipcMain.handle('data:autoBackupFolder', () => backupsDir());
    electron_1.ipcMain.handle('data:listAutoBackups', () => {
        const dir = backupsDir();
        if (!node_fs_1.default.existsSync(dir))
            return [];
        return node_fs_1.default
            .readdirSync(dir)
            .filter((f) => f.endsWith('.db'))
            .sort()
            .reverse()
            .map((name) => {
            const full = node_path_1.default.join(dir, name);
            const stat = node_fs_1.default.statSync(full);
            return { name, path: full, size: stat.size, mtime: stat.mtime.toISOString() };
        });
    });
    electron_1.ipcMain.handle('data:export', async (_e, kind) => {
        if (!mainWindow)
            return { saved: false };
        const date = new Date().toISOString().slice(0, 10);
        const isDb = kind === 'db';
        const res = await electron_1.dialog.showSaveDialog(mainWindow, {
            title: isDb ? 'Backup Car Deals Database' : 'Export Car Deals to CSV',
            defaultPath: node_path_1.default.join(electron_1.app.getPath('documents'), isDb ? `car-deals-backup-${date}.db` : `car-deals-${date}.csv`),
            filters: [isDb ? { name: 'SQLite Database', extensions: ['db'] } : { name: 'CSV Spreadsheet', extensions: ['csv'] }],
        });
        if (res.canceled || !res.filePath)
            return { saved: false };
        if (isDb) {
            await db.backupTo(res.filePath);
        }
        else {
            node_fs_1.default.writeFileSync(res.filePath, db.exportCsv(), 'utf8');
        }
        return { saved: true, path: res.filePath };
    });
    electron_1.ipcMain.handle('data:restoreFromPath', async (_e, backupPath) => performRestore(backupPath));
    electron_1.ipcMain.handle('data:restoreFromBackup', async (_e, backupPath) => {
        if (backupPath) {
            return performRestore(backupPath);
        }
        if (!mainWindow)
            return { restored: false };
        const res = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: 'Select Backup Database File to Restore',
            properties: ['openFile'],
            filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        });
        if (res.canceled || res.filePaths.length === 0)
            return { restored: false };
        return performRestore(res.filePaths[0]);
    });
    electron_1.ipcMain.handle('data:pickAndRestore', async () => {
        if (!mainWindow)
            return { restored: false };
        const res = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: 'Select Backup Database File to Restore',
            properties: ['openFile'],
            filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        });
        if (res.canceled || res.filePaths.length === 0)
            return { restored: false };
        return performRestore(res.filePaths[0]);
    });
    // Printing / Save Receipt PDF
    electron_1.ipcMain.handle('receipt:savePdf', async (_e, html, defaultFileName) => {
        if (!mainWindow)
            return { saved: false };
        const res = await electron_1.dialog.showSaveDialog(mainWindow, {
            title: 'Save Receipt as PDF',
            defaultPath: node_path_1.default.join(electron_1.app.getPath('documents'), defaultFileName),
            filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        });
        if (res.canceled || !res.filePath)
            return { saved: false };
        const win = new electron_1.BrowserWindow({ show: false, webPreferences: { sandbox: true } });
        try {
            await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
            const pdfBuffer = await win.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
            });
            node_fs_1.default.writeFileSync(res.filePath, pdfBuffer);
            return { saved: true, path: res.filePath };
        }
        finally {
            win.close();
        }
    });
    electron_1.ipcMain.handle('receipt:printHtml', async (_e, html) => {
        const win = new electron_1.BrowserWindow({ show: false, webPreferences: { sandbox: true } });
        try {
            await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
            await new Promise((resolve) => {
                win.webContents.print({ silent: false, printBackground: true }, () => resolve());
            });
        }
        finally {
            win.close();
        }
    });
    electron_1.ipcMain.handle('shell:showInFolder', (_e, filePath) => {
        electron_1.shell.showItemInFolder(filePath);
    });
    electron_1.ipcMain.handle('shell:openExternal', async (_e, url) => {
        if (/^https?:\/\//i.test(url)) {
            await electron_1.shell.openExternal(url);
        }
    });
}
electron_1.app.whenReady().then(() => {
    electron_1.session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        if (permission === 'media') {
            callback(true);
            return;
        }
        callback(false);
    });
    db = new db_1.CarDealsDb(node_path_1.default.join(electron_1.app.getPath('userData'), 'car-deals.db'));
    runDailyAutoBackup(db);
    registerIpc();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('before-quit', () => {
    db?.close();
});
