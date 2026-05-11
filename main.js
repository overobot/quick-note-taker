const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');

app.disableHardwareAcceleration();

const path = require('node:path');
const fs = require('node:fs');

// NEW: Path for the notes JSON file
const notesFilePath = path.join(app.getPath('documents'), 'notes.json');

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

    // NEW: Hide window instead of closing
    win.on('close', (event) => {
        event.preventDefault();   // stop the window from actually closing
        win.hide();               // hide it instead
    });
}

app.whenReady().then(() => {
    createWindow();

    // NEW: App Menu
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Note',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        BrowserWindow.getFocusedWindow().webContents.send('menu-new-note');
                    }
                },
                {
                    label: 'Open File',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        BrowserWindow.getFocusedWindow().webContents.send('menu-open-file');
                    }
                },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        BrowserWindow.getFocusedWindow().webContents.send('menu-save');
                    }
                },
                {
                    label: 'Save As',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        BrowserWindow.getFocusedWindow().webContents.send('menu-save-as');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    // Create tray icon
    tray = new Tray(path.join(__dirname, 'icon.png'));

    // Tray context menu
    const trayMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                BrowserWindow.getAllWindows()[0].show();
            }
        },
        {
            label: 'Quit',
            click: () => app.quit()
        }
    ]);

    tray.setToolTip('Quick Note Taker');
    tray.setContextMenu(trayMenu);

    // NEW: Double-click tray icon to show window
    tray.on('double-click', () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// NEW: Helper — read all notes from the JSON file
function readNotes() {
    if (!fs.existsSync(notesFilePath)) {
        return [];    // return empty array if file does not exist yet
    }
    const raw = fs.readFileSync(notesFilePath, 'utf-8');
    return JSON.parse(raw);
}

// NEW: Helper — write all notes to the JSON file
function writeNotes(notes) {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf-8');
}

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

// NEW: Get all notes
ipcMain.handle('get-notes', async () => {
    return readNotes();
});

// NEW: Save a note (create or update)
ipcMain.handle('save-note-json', async (event, note) => {
    const notes = readNotes();
    const index = notes.findIndex(n => n.id === note.id);
    const now = new Date().toISOString();

    if (index === -1) {
        // Note does not exist yet — create it
        notes.push({ ...note, createdAt: now, updatedAt: now });
    } else {
        // Note already exists — update it
        notes[index] = { ...notes[index], ...note, updatedAt: now };
    }

    writeNotes(notes);
    return { success: true };
});

// NEW: Delete a note
ipcMain.handle('delete-note', async (event, id) => {
    const notes = readNotes();
    const filtered = notes.filter(n => n.id !== id);
    writeNotes(filtered);
    return { success: true };
});


