const { app, BrowserWindow, ipcMain, dialog } = require('electron');

app.disableHardwareAcceleration();

// This comment is to test the git

const path = require('node:path');
const fs = require('node:fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('save-note', async (event, text) => {
    const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
    fs.writeFileSync(filePath, text, 'utf-8');
    return { success: true };
});

ipcMain.handle('load-note', async () => {
    const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
});

// NEW: Save As handler
ipcMain.handle('save-as', async (event, text) => {
    const result = await dialog.showSaveDialog({
        defaultPath: 'mynote.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (result.canceled) {
        return { success: false };
    }

    fs.writeFileSync(result.filePath, text, 'utf-8');
    return { success: true, filePath: result.filePath };
});

// NEW: New Note handler
ipcMain.handle('new-note', async (event) => {
    const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Discard Changes', 'Cancel'],
        defaultId: 1,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Start a new note anyway?'
    });

    // result.response === 0 means user clicked 'Discard Changes'
    return { confirmed: result.response === 0 };
});

// NEW: Open File handler
ipcMain.handle('open-file', async (event) => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (result.canceled) {
        return { success: false };
    }

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content, filePath };
});

// UPDATED: Smart Save handler
ipcMain.handle('smart-save', async (event, text, filePath) => {
    const targetPath = filePath || path.join(app.getPath('documents'), 'quicknote.txt');
    fs.writeFileSync(targetPath, text, 'utf-8');
    return { success: true, filePath: targetPath };
});
