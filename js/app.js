/**
 * Minimalist Roadmap Checklist - Online Web Edition
 * Domain: track.swarajkanse.me
 * 
 * Features:
 * 1. Instant local persistence in browser (localStorage)
 * 2. Permanent Cloud Sync via private GitHub Gist (syncs across laptop, phone, anywhere!)
 * 3. One-click Backup (JSON export) & Restore (JSON import)
 * 4. Day & Track filtering, auto-saving notes, keyboard shortcuts
 */

const STORAGE_KEY = 'study_roadmap_checklist_v1';
const THEME_KEY = 'study_roadmap_theme';
const GIST_KEY = 'study_roadmap_gist_config';

const AppState = {
  data: {
    tasks: {},
    notes: {},
    lastModified: null
  },
  gistConnected: false,
  gistConfig: { token: '', gistId: '' },
  syncTimeout: null,
  onDataLoadedCallbacks: [],

  async init() {
    // 1. Load from browser storage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.data.tasks = parsed.tasks || {};
        this.data.notes = parsed.notes || {};
        this.data.lastModified = parsed.lastModified || null;
      }
      const savedGist = localStorage.getItem(GIST_KEY);
      if (savedGist) {
        this.gistConfig = JSON.parse(savedGist);
      }
    } catch (e) {
      console.warn('Storage load warning:', e);
    }

    this.initTheme();
    this.initCloudSyncModal();

    // 2. Fetch from GitHub Gist Cloud if connected
    if (this.gistConfig.token) {
      await this.syncWithGist();
    } else {
      this.refreshBadgeStatus();
    }
  },

  async syncWithGist() {
    this.updateSyncBadge('saving', 'Syncing with cloud...');
    try {
      const gistData = await this.fetchFromGist();
      if (gistData) {
        this.gistConnected = true;
        this.reconcileData(gistData);
        this.saveLocal();
        this.refreshBadgeStatus();
        this.notifyDataUpdated();
        return;
      }
    } catch (e) {
      console.warn('Cloud sync error:', e);
      this.gistConnected = false;
    }
    this.refreshBadgeStatus();
  },

  reconcileData(incoming) {
    if (!incoming) return;
    const incomingTasks = incoming.tasks || {};
    const incomingNotes = incoming.notes || {};

    // Union of completed tasks so nothing is ever lost
    for (const [id, done] of Object.entries(incomingTasks)) {
      if (done) this.data.tasks[id] = true;
    }

    // Merge notes (prefer non-empty)
    for (const [w, note] of Object.entries(incomingNotes)) {
      if (note && !this.data.notes[w]) {
        this.data.notes[w] = note;
      }
    }

    if (incoming.lastModified) {
      this.data.lastModified = incoming.lastModified;
    }
  },

  refreshBadgeStatus() {
    if (this.gistConnected) {
      this.updateSyncBadge('online', 'Synced to GitHub Cloud');
    } else {
      this.updateSyncBadge('offline', 'Saved in Browser (Click to enable Cloud Sync)');
    }
  },

  saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  },

  isTaskDone(id) {
    return !!this.data.tasks[id];
  },

  setTask(id, done) {
    if (done) {
      this.data.tasks[id] = true;
    } else {
      delete this.data.tasks[id];
    }
    this.data.lastModified = new Date().toISOString();
    this.saveLocal();
    this.scheduleCloudSync();
  },

  getNote(weekNum) {
    return this.data.notes[weekNum] || '';
  },

  setNote(weekNum, text) {
    this.data.notes[weekNum] = text;
    this.data.lastModified = new Date().toISOString();
    this.saveLocal();
    this.scheduleCloudSync();
  },

  scheduleCloudSync() {
    if (!this.gistConfig.token) return;
    this.updateSyncBadge('saving', 'Saving to cloud...');
    clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.pushToGist();
      this.refreshBadgeStatus();
    }, 500);
  },

  // --- GitHub Gist Cloud Sync ---
  async fetchFromGist() {
    const { token, gistId } = this.gistConfig;
    if (!token) return null;

    if (!gistId) {
      return await this.initGist();
    }

    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.ok) {
      const gist = await res.json();
      const file = gist.files['study_roadmap_progress.json'];
      if (file && file.content) {
        return JSON.parse(file.content);
      }
    }
    return null;
  },

  async initGist() {
    const { token } = this.gistConfig;
    if (!token) return null;

    // Check user's gists to see if study_roadmap_progress exists
    const listRes = await fetch('https://api.github.com/gists', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (listRes.ok) {
      const gists = await listRes.json();
      const existing = gists.find(g => g.files && g.files['study_roadmap_progress.json']);
      if (existing) {
        this.gistConfig.gistId = existing.id;
        localStorage.setItem(GIST_KEY, JSON.stringify(this.gistConfig));
        return JSON.parse(existing.files['study_roadmap_progress.json'].content || '{}');
      }
    }

    // Create new private gist
    const createRes = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        description: 'AI + Java Roadmap Placement Tracker Progress',
        public: false,
        files: {
          'study_roadmap_progress.json': {
            content: JSON.stringify(this.data, null, 2)
          }
        }
      })
    });

    if (createRes.ok) {
      const newGist = await createRes.json();
      this.gistConfig.gistId = newGist.id;
      localStorage.setItem(GIST_KEY, JSON.stringify(this.gistConfig));
      return this.data;
    }
    return null;
  },

  async pushToGist() {
    const { token, gistId } = this.gistConfig;
    if (!token || !gistId) return;

    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          files: {
            'study_roadmap_progress.json': {
              content: JSON.stringify(this.data, null, 2)
            }
          }
        })
      });
      if (res.ok) {
        this.gistConnected = true;
        this.refreshBadgeStatus();
      }
    } catch (e) {
      console.warn('Failed to push to Gist:', e);
    }
  },

  updateSyncBadge(status, text) {
    const badges = document.querySelectorAll('.sync-badge');
    badges.forEach(badge => {
      badge.className = `sync-badge ${status}`;
      const label = badge.querySelector('.sync-text');
      if (label) label.textContent = text;
      badge.onclick = () => openCloudSyncModal();
      badge.style.cursor = 'pointer';
    });
  },

  initCloudSyncModal() {
    if (document.getElementById('cloud-sync-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'cloud-sync-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <h2 class="modal-title">☁️ Cloud Sync Settings</h2>
        <p class="modal-desc">
          Keep your progress safely backed up to your private GitHub account so you never lose data when clearing browser cache, and can access it from your phone and laptop at <code>track.swarajkanse.me</code>.
        </p>

        <div class="modal-input-group">
          <label class="modal-label">GitHub Personal Access Token (classic)</label>
          <input type="password" id="gist-token-input" class="modal-input" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx">
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">
            Generate one on GitHub: <a href="https://github.com/settings/tokens" target="_blank" class="task-link">github.com/settings/tokens</a> with only the <strong>gist</strong> permission.
          </p>
        </div>

        <div id="cloud-sync-status" style="font-size:0.8rem; margin-bottom:1rem; padding:0.5rem 0.75rem; border-radius:var(--radius-sm); display:none;"></div>

        <div class="modal-actions">
          <button class="nav-btn" onclick="closeCloudSyncModal()">Close</button>
          <button class="nav-btn" id="btn-disconnect-gist" style="color:var(--warning); display:none;" onclick="disconnectGist()">Disconnect</button>
          <button class="nav-btn" style="background:var(--accent-primary); color:white; border-color:var(--accent-primary);" onclick="saveGistToken()">Connect &amp; Sync</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeCloudSyncModal();
    });
  },

  onDataLoaded(cb) {
    this.onDataLoadedCallbacks.push(cb);
  },

  notifyDataUpdated() {
    this.onDataLoadedCallbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
  },

  initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    showToast(`Switched to ${next} mode`);
  }
};

// Modal handlers
function openCloudSyncModal() {
  const modal = document.getElementById('cloud-sync-modal');
  if (!modal) return;
  const tokenInput = document.getElementById('gist-token-input');
  const disconnectBtn = document.getElementById('btn-disconnect-gist');
  const statusDiv = document.getElementById('cloud-sync-status');

  if (AppState.gistConfig.token) {
    tokenInput.value = AppState.gistConfig.token;
    disconnectBtn.style.display = 'inline-flex';
    statusDiv.style.display = 'block';
    statusDiv.style.background = 'var(--success-bg)';
    statusDiv.style.color = 'var(--success)';
    statusDiv.innerHTML = `✓ Connected to private GitHub Gist (${AppState.gistConfig.gistId || 'Active'})`;
  } else {
    tokenInput.value = '';
    disconnectBtn.style.display = 'none';
    statusDiv.style.display = 'none';
  }
  modal.classList.add('open');
}

function closeCloudSyncModal() {
  const modal = document.getElementById('cloud-sync-modal');
  if (modal) modal.classList.remove('open');
}

async function saveGistToken() {
  const token = document.getElementById('gist-token-input').value.trim();
  if (!token) {
    alert('Please enter a valid GitHub token');
    return;
  }
  AppState.gistConfig.token = token;
  localStorage.setItem(GIST_KEY, JSON.stringify(AppState.gistConfig));
  showToast('Connecting to private GitHub Gist...');
  await AppState.syncWithGist();
  closeCloudSyncModal();
  showToast('✓ Cloud Sync connected successfully!');
}

function disconnectGist() {
  if (confirm('Disconnect GitHub Cloud Sync on this browser?')) {
    AppState.gistConfig = { token: '', gistId: '' };
    localStorage.removeItem(GIST_KEY);
    AppState.gistConnected = false;
    AppState.refreshBadgeStatus();
    closeCloudSyncModal();
    showToast('Cloud sync disconnected');
  }
}

// Auto-start
AppState.init();

// --- Toast Notification ---
function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

// --- Week Page Controller ---
function initWeekPage(weekNum) {
  function syncUI() {
    const checkboxes = document.querySelectorAll('.task-checkbox');
    checkboxes.forEach(cb => {
      const taskId = cb.getAttribute('data-task-id');
      const isDone = AppState.isTaskDone(taskId);
      cb.checked = isDone;
      updateTaskItemVisual(cb, isDone);
    });

    const notesArea = document.getElementById('week-notes');
    if (notesArea && !notesArea._userTyping) {
      notesArea.value = AppState.getNote(weekNum);
    }

    updateWeekProgress();
    updateDayProgress();
  }

  AppState.onDataLoaded(() => {
    syncUI();
  });

  // 1. Checkboxes setup
  const checkboxes = document.querySelectorAll('.task-checkbox');
  checkboxes.forEach(cb => {
    const taskId = cb.getAttribute('data-task-id');
    cb.checked = AppState.isTaskDone(taskId);
    updateTaskItemVisual(cb, cb.checked);

    cb.addEventListener('change', () => {
      const checked = cb.checked;
      AppState.setTask(taskId, checked);
      updateTaskItemVisual(cb, checked);
      updateWeekProgress();
      updateDayProgress();
      
      if (checked && isWeekAllDone()) {
        showToast('🎉 Awesome! Week complete! Saved.');
      }
    });
  });

  updateWeekProgress();
  updateDayProgress();

  // 2. Filtering setup
  const dayPills = document.querySelectorAll('.day-filter-pill');
  dayPills.forEach(pill => {
    pill.addEventListener('click', () => {
      dayPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      applyFilters();
    });
  });

  const trackPills = document.querySelectorAll('.track-filter-pill');
  trackPills.forEach(pill => {
    pill.addEventListener('click', () => {
      trackPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      applyFilters();
    });
  });

  // 3. Quick Actions
  const btnMarkAll = document.getElementById('btn-mark-all');
  if (btnMarkAll) {
    btnMarkAll.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        const taskId = cb.getAttribute('data-task-id');
        cb.checked = true;
        AppState.setTask(taskId, true);
        updateTaskItemVisual(cb, true);
      });
      updateWeekProgress();
      updateDayProgress();
      showToast('Marked all tasks complete');
    });
  }

  const btnClearAll = document.getElementById('btn-clear-all');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      if (confirm('Reset all checkboxes for this week?')) {
        checkboxes.forEach(cb => {
          const taskId = cb.getAttribute('data-task-id');
          cb.checked = false;
          AppState.setTask(taskId, false);
          updateTaskItemVisual(cb, false);
        });
        updateWeekProgress();
        updateDayProgress();
        showToast('Week reset');
      }
    });
  }

  const btnCopySummary = document.getElementById('btn-copy-summary');
  if (btnCopySummary) {
    btnCopySummary.addEventListener('click', () => {
      copyWeekSummaryToClipboard(weekNum);
    });
  }

  // 4. Notes / Scratchpad auto-save
  const notesArea = document.getElementById('week-notes');
  const saveStatus = document.getElementById('notes-save-status');
  if (notesArea) {
    notesArea.value = AppState.getNote(weekNum);
    let timeout;
    notesArea.addEventListener('input', () => {
      notesArea._userTyping = true;
      if (saveStatus) saveStatus.textContent = 'Saving...';
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        AppState.setNote(weekNum, notesArea.value);
        notesArea._userTyping = false;
        if (saveStatus) saveStatus.textContent = 'Saved to browser & cloud';
      }, 400);
    });
  }

  // 5. Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
    
    if (e.key === 'ArrowLeft' || e.key === '[') {
      const prevBtn = document.getElementById('nav-prev');
      if (prevBtn && prevBtn.getAttribute('href')) {
        window.location.href = prevBtn.getAttribute('href');
      }
    } else if (e.key === 'ArrowRight' || e.key === ']') {
      const nextBtn = document.getElementById('nav-next');
      if (nextBtn && nextBtn.getAttribute('href')) {
        window.location.href = nextBtn.getAttribute('href');
      }
    } else if (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 't') {
      AppState.toggleTheme();
    }
  });

  const weekSelect = document.getElementById('week-select-dropdown');
  if (weekSelect) {
    weekSelect.addEventListener('change', (e) => {
      const target = e.target.value;
      if (target) window.location.href = target;
    });
  }
}

function updateTaskItemVisual(checkbox, isChecked) {
  const item = checkbox.closest('.task-item') || checkbox.closest('.deliverable-item');
  if (item) {
    if (isChecked) {
      item.classList.add('completed');
    } else {
      item.classList.remove('completed');
    }
  }
}

function updateWeekProgress() {
  const allCheckboxes = document.querySelectorAll('.task-checkbox');
  const total = allCheckboxes.length;
  let done = 0;
  allCheckboxes.forEach(cb => {
    if (cb.checked) done++;
  });

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  
  const fill = document.getElementById('week-progress-fill');
  const stats = document.getElementById('week-progress-stats');
  
  if (fill) fill.style.width = pct + '%';
  if (stats) stats.textContent = `${done} of ${total} completed (${pct}%)`;
}

function isWeekAllDone() {
  const allCheckboxes = document.querySelectorAll('.task-checkbox');
  return allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);
}

function updateDayProgress() {
  const dayCards = document.querySelectorAll('.day-card');
  dayCards.forEach(card => {
    const cbs = card.querySelectorAll('.task-checkbox');
    const badge = card.querySelector('.day-progress');
    if (badge && cbs.length > 0) {
      let done = 0;
      cbs.forEach(cb => { if (cb.checked) done++; });
      badge.textContent = `${done}/${cbs.length} done`;
    }
  });
}

function applyFilters() {
  const activeDay = document.querySelector('.day-filter-pill.active')?.getAttribute('data-day') || 'all';
  const activeTrack = document.querySelector('.track-filter-pill.active')?.getAttribute('data-track') || 'all';

  const dayCards = document.querySelectorAll('.day-card');
  dayCards.forEach(card => {
    const dayCode = card.getAttribute('data-day');
    const dayMatch = (activeDay === 'all' || activeDay === dayCode);
    
    if (!dayMatch) {
      card.style.display = 'none';
      return;
    }

    const taskItems = card.querySelectorAll('.task-item');
    let visibleTasksInDay = 0;
    taskItems.forEach(item => {
      const trackId = item.getAttribute('data-track');
      const trackMatch = (activeTrack === 'all' || activeTrack === trackId);
      if (trackMatch) {
        item.style.display = 'flex';
        visibleTasksInDay++;
      } else {
        item.style.display = 'none';
      }
    });

    card.style.display = visibleTasksInDay > 0 ? 'block' : 'none';
  });
}

function copyWeekSummaryToClipboard(weekNum) {
  const allCheckboxes = document.querySelectorAll('.task-checkbox');
  const total = allCheckboxes.length;
  let done = 0;
  const completedList = [];
  const pendingList = [];

  allCheckboxes.forEach(cb => {
    const taskId = cb.getAttribute('data-task-id');
    const label = cb.closest('.task-item, .deliverable-item')?.querySelector('.task-text, .deliverable-text')?.innerText.trim() || taskId;
    if (cb.checked) {
      done++;
      completedList.push(`- [x] ${label}`);
    } else {
      pendingList.push(`- [ ] ${label}`);
    }
  });

  const pct = Math.round((done / total) * 100);
  const text = `# Week ${weekNum} Progress: ${done}/${total} (${pct}%)\n\n## Completed:\n${completedList.join('\n') || 'None'}\n\n## Pending:\n${pendingList.join('\n') || 'None'}\n`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('Summary copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy summary');
  });
}

// --- Dashboard (index.html) Controller ---
function initDashboard(roadmapData) {
  function renderDashboardStats() {
    let totalTasksGlobal = 0;
    let completedTasksGlobal = 0;
    let completedWeeksGlobal = 0;
    let firstIncompleteWeek = null;

    roadmapData.forEach(w => {
      let weekTotal = 0;
      let weekDone = 0;

      w.days.forEach(d => {
        d.tasks.forEach(t => {
          if (!t.is_rest) {
            weekTotal++;
            totalTasksGlobal++;
            if (AppState.isTaskDone(t.id)) {
              weekDone++;
              completedTasksGlobal++;
            }
          }
        });
      });

      w.deliverables.forEach(deliv => {
        weekTotal++;
        totalTasksGlobal++;
        if (AppState.isTaskDone(deliv.id)) {
          weekDone++;
          completedTasksGlobal++;
        }
      });

      const isWeekDone = weekTotal > 0 && weekDone === weekTotal;
      if (isWeekDone) {
        completedWeeksGlobal++;
      } else if (!firstIncompleteWeek) {
        firstIncompleteWeek = w.week_num;
      }

      // Update week tile
      const tile = document.getElementById(`dash-week-${w.week_num}`);
      if (tile) {
        const pct = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;
        const progressText = tile.querySelector('.week-tile-progress');
        if (progressText) {
          progressText.innerHTML = `<span>${weekDone}/${weekTotal}</span><span>${pct}%</span>`;
        }
        if (isWeekDone) {
          tile.classList.add('completed');
        } else {
          tile.classList.remove('completed');
        }
      }
    });

    const globalPct = totalTasksGlobal > 0 ? Math.round((completedTasksGlobal / totalTasksGlobal) * 100) : 0;
    
    const elTasks = document.getElementById('stat-tasks-done');
    if (elTasks) elTasks.textContent = `${completedTasksGlobal} / ${totalTasksGlobal}`;

    const elPct = document.getElementById('stat-pct-done');
    if (elPct) elPct.textContent = `${globalPct}%`;

    const elWeeks = document.getElementById('stat-weeks-done');
    if (elWeeks) elWeeks.textContent = `${completedWeeksGlobal} / ${roadmapData.length}`;

    const globalBar = document.getElementById('global-progress-bar');
    if (globalBar) globalBar.style.width = `${globalPct}%`;

    const resumeBtn = document.getElementById('btn-resume-week');
    if (resumeBtn) {
      const targetWeek = firstIncompleteWeek || 1;
      const padded = String(targetWeek).padStart(2, '0');
      resumeBtn.setAttribute('href', `weeks/week-${padded}.html`);
      resumeBtn.innerHTML = `Continue Week ${targetWeek} &rarr;`;
    }
  }

  renderDashboardStats();

  AppState.onDataLoaded(() => {
    renderDashboardStats();
  });

  // Export / Backup Progress
  const btnExport = document.getElementById('btn-export-data');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(AppState.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roadmap-progress-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Progress exported to JSON backup file');
    });
  }

  // Import Progress
  const fileInput = document.getElementById('file-import-data');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed && typeof parsed.tasks === 'object') {
            AppState.data.tasks = parsed.tasks || {};
            AppState.data.notes = parsed.notes || {};
            AppState.data.lastModified = new Date().toISOString();
            AppState.saveLocal();
            if (AppState.gistConfig.token) await AppState.pushToGist();
            showToast('Progress imported & saved!');
            setTimeout(() => window.location.reload(), 800);
          } else {
            alert('Invalid backup file format');
          }
        } catch (err) {
          alert('Could not parse backup JSON file');
        }
      };
      reader.readAsText(file);
    });
  }

  // Reset All
  const btnResetAll = document.getElementById('btn-reset-all');
  if (btnResetAll) {
    btnResetAll.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset all checklist progress?')) {
        AppState.data = { tasks: {}, notes: {}, lastModified: new Date().toISOString() };
        AppState.saveLocal();
        if (AppState.gistConfig.token) await AppState.pushToGist();
        showToast('All progress reset');
        setTimeout(() => window.location.reload(), 500);
      }
    });
  }
}
