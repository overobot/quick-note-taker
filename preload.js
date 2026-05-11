const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveNote: (text) => ipcRenderer.invoke('save-note', text),
    loadNote: () => ipcRenderer.invoke('load-note'),
    saveAs: (text) => ipcRenderer.invoke('save-as', text), // NEW: Expose Save As function
    newNote: () => ipcRenderer.invoke('new-note'), // NEW: Expose New Note function
    openFile: () => ipcRenderer.invoke('open-file'), // NEW: Expose Open File function
    smartSave: (text, filePath) => ipcRenderer.invoke('smart-save', text, filePath), // UPDATED: Expose Smart Save function
    onMenuAction: (channel, callback) => ipcRenderer.on(channel, callback),

    getNotes: () => ipcRenderer.invoke('get-notes'),
    saveNoteJson: (note) => ipcRenderer.invoke('save-note-json', note),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id)
});