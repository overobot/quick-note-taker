window.addEventListener('DOMContentLoaded', async () => {
    const textarea = document.getElementById('note');
    const titleInput = document.getElementById('note-title');
    const saveBtn = document.getElementById('save');
    const saveAsBtn = document.getElementById('save-as');
    const openFileBtn = document.getElementById('open-file');
    const newNoteBtn = document.getElementById('new-note');
    const noteList = document.getElementById('note-list');
    const statusEl = document.getElementById('save_status');

    //const savedNote = await window.electronAPI.loadNote();
    //textarea.value = savedNote;
    //let lastSavedText = textarea.value;
    let currentFilePath = null; // Track current file path for Save As functionality

    //State
    let notes = [];
    let currentNoteId = null;
    let lastSavedContent = '';
    let debounceTimer;

    // UPDATED: Load all notes on startup
    notes = await window.electronAPI.getNotes();

    if (notes.length > 0) {
        // Open the most recently updated note
        const mostRecent = notes.reduce((a, b) =>
            new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b
        );
        await switchNote(mostRecent.id);
    } else {
        // No notes yet — trigger New Note automatically
        newNoteBtn.click();
    }

    renderNoteList();

    // UPDATED: Save button
    saveBtn.addEventListener('click', async () => {
        await saveCurrentNote();
    });

    async function autoSave() {
        const currentText = textarea.value;
        if (currentText === lastSavedContent) {
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

    // UPDATED: Auto-save with debounce
    textarea.addEventListener('input', () => {
        statusEl.textContent = 'Unsaved changes...';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveCurrentNote, 5000);
    });

    // Also auto-save when title changes
    titleInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveCurrentNote, 5000);
    });

    // NEW: Save As button
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

    // UPDATED: New Note button — creates a new note in JSON storage
    newNoteBtn.addEventListener('click', async () => {
        if (textarea.value !== lastSavedContent) {
            const result = await window.electronAPI.newNote();
            if (!result.confirmed) return;
        }

        // Create a new note object
        const newNote = {
            id: Date.now().toString(),
            title: 'Untitled',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await window.electronAPI.saveNoteJson(newNote);
        notes.unshift(newNote);       // add to the top of the list

        currentNoteId = newNote.id;
        titleInput.value = '';
        textarea.value = '';
        lastSavedContent = '';

        renderNoteList();
        titleInput.focus();           // move cursor to title field
        statusEl.textContent = 'New note created.';
    });

    // NEW: Open File button
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

    // NEW: Menu action listeners
    window.electronAPI.onMenuAction('menu-new-note', () => {
        newNoteBtn.click();    // reuse the existing button logic
    });

    window.electronAPI.onMenuAction('menu-open-file', () => {
        openFileBtn.click();   // reuse the existing button logic
    });

    window.electronAPI.onMenuAction('menu-save', () => {
        saveBtn.click();       // reuse the existing button logic
    });

    window.electronAPI.onMenuAction('menu-save-as', () => {
        saveAsBtn.click();     // reuse the existing button logic
    });

    // NEW: Render the note list in the sidebar
    function renderNoteList() {
        noteList.innerHTML = '';    // clear existing list

        notes.forEach(note => {
            const item = document.createElement('div');
            item.className = 'note-item' + (note.id === currentNoteId ? ' active' : '');
            item.innerHTML = `
            <button class="note-item-delete" data-id="${note.id}">✕</button>
            <div class="note-item-title">${note.title || 'Untitled'}</div>
            <div class="note-item-date">${new Date(note.updatedAt).toLocaleDateString()}</div>
        `;

            // Click note to open it
            item.addEventListener('click', async (e) => {
                if (e.target.classList.contains('note-item-delete')) return;
                await switchNote(note.id);
            });

            // Delete button
            item.querySelector('.note-item-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteNote(note.id);
            });

            noteList.appendChild(item);
        });
    }

    // NEW: Switch to a different note (with unsaved changes warning)
    async function switchNote(id) {
        // Check for unsaved changes first
        if (textarea.value !== lastSavedContent) {
            const result = await window.electronAPI.newNote();
            if (!result.confirmed) return;    // user cancelled — stay on current note
        }

        // Load the selected note
        const note = notes.find(n => n.id === id);
        if (!note) return;

        currentNoteId = note.id;
        titleInput.value = note.title || '';
        textarea.value = note.content || '';
        lastSavedContent = note.content || '';
        statusEl.textContent = '';

        renderNoteList();    // refresh sidebar to show active state
    }

    // NEW: Save the currently open note to JSON
    async function saveCurrentNote() {
        if (!currentNoteId) return;

        const note = {
            id: currentNoteId,
            title: titleInput.value || 'Untitled',
            content: textarea.value
        };

        await window.electronAPI.saveNoteJson(note);
        lastSavedContent = textarea.value;

        // Update the note in the local array too
        const index = notes.findIndex(n => n.id === currentNoteId);
        if (index !== -1) {
            notes[index] = { ...notes[index], ...note, updatedAt: new Date().toISOString() };
        }

        renderNoteList();
        statusEl.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
    }

    // NEW: Delete a note
    async function deleteNote(id) {
        const result = await window.electronAPI.newNote();  // reuse warning dialog
        if (!result.confirmed) return;

        await window.electronAPI.deleteNote(id);
        notes = notes.filter(n => n.id !== id);

        // If we deleted the current note, clear the editor
        if (currentNoteId === id) {
            currentNoteId = null;
            titleInput.value = '';
            textarea.value = '';
            lastSavedContent = '';
            statusEl.textContent = 'Note deleted.';
        }

        renderNoteList();
    }


});