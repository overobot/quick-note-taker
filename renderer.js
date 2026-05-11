window.addEventListener('DOMContentLoaded', async () => {
    const textarea = document.getElementById('note');
    const saveBtn = document.getElementById('save');
    const statusEl = document.getElementById('save_status');

    const savedNote = await window.electronAPI.loadNote();
    textarea.value = savedNote;
    let lastSavedText = textarea.value;
    let currentFilePath = null; // Track current file path for Save As functionality

    // Manual save (updated to use smartSave)
    saveBtn.addEventListener('click', async () => {
        try {
            const result = await window.electronAPI.smartSave(textarea.value, currentFilePath);
            lastSavedText = textarea.value;
            currentFilePath = result.filePath; // Update current file path after save
            statusEl.textContent = `Saved to: ${result.filePath}`;
            alert('Note saved successfully!');
        } catch (err) {
            console.error('Save failed:', err);
            statusEl.textContent = 'Save failed';
        }
    });

    async function autoSave() {
        const currentText = textarea.value;
        if (currentText === lastSavedText) {
            statusEl.textContent = 'No changes to save';
            return;
        }
        try {
            await window.electronAPI.saveNote(currentText);
            lastSavedText = currentText;
            const now = new Date().toLocaleTimeString();
            statusEl.textContent = `Auto-saved at ${now}`;
        } catch (err) {
            console.error('Auto-save failed:', err);
            statusEl.textContent = 'Auto-save failed';
        }
    }

    let debounceTimer;
    textarea.addEventListener('input', () => {
        statusEl.textContent = 'Changes detected - auto-saving in 5 seconds...';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(autoSave, 5000);
    });

    // NEW: Save As button
    const saveAsBtn = document.getElementById('save-as');

    saveAsBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.saveAs(textarea.value);
        if (result.success) {
            lastSavedText = textarea.value;
            currentFilePath = result.filePath;
            statusEl.textContent = `Saved to: ${result.filePath}`;            
        } else {
            statusEl.textContent = 'Save As cancelled.';
        }
    });

    // NEW: New Note button
    const newNoteBtn = document.getElementById('new-note');

    newNoteBtn.addEventListener('click', async () => {
        // If no unsaved changes, clear immediately
        if (textarea.value === lastSavedText) {
            textarea.value = '';
            lastSavedText = '';
            statusEl.textContent = 'New note started.';
            return;
        }

        // If there are unsaved changes, ask the user first
        const result = await window.electronAPI.newNote();
        if (result.confirmed) {
            textarea.value = '';
            lastSavedText = '';
            statusEl.textContent = 'New note started.';
        } else {
            statusEl.textContent = 'New note cancelled.';
        }
    });

    // NEW: Open File button
    const openFileBtn = document.getElementById('open-file');

    openFileBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.openFile();
        if (result.success) {
            textarea.value = result.content;
            lastSavedText = result.content;
            currentFilePath = result.filePath;
            statusEl.textContent = `Opened: ${result.filePath}`;
        } else {
            statusEl.textContent = 'Open cancelled.';
        }
    });

});