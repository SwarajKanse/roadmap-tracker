/**
 * Minimalist Roadmap Checklist - Online Web Edition
 * Domain: track.swarajkanse.me
 * 
 * Features:
 * 1. Instant local persistence in browser (localStorage)
 * 2. Automatic, zero-login Cloud Sync via Supabase (syncs across laptop, phone, anywhere!)
 * 3. One-click Backup (JSON export) & Restore (JSON import)
 * 4. Day & Track filtering, auto-saving notes, keyboard shortcuts
 */

const STORAGE_KEY = 'study_roadmap_checklist_v1';
const THEME_KEY = 'study_roadmap_theme';

const CLOUD_CONFIG = {
  endpoint: 'https://ljqmvwvfmyoaakgsxddw.supabase.co/rest/v1/tracker_state',
  apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqcW12d3ZmbXlvYWFrZ3N4ZGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTc1ODAsImV4cCI6MjEwNDYzMzU4MH0.aVUPWDOnirAco45eh0iTLNxupL9etepBWkInje0dZuk',
  docId: 'swaraj_placement_roadmap'
};

const AppState = {
  data: {
    tasks: {},
    notes: {},
    lastModified: null
  },
  cloudConnected: false,
  syncTimeout: null,
  isSyncing: false,
  lastSyncTime: null,
  onDataLoadedCallbacks: [],

  async init() {
    // 1. Instant load from local browser cache for immediate rendering
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.data.tasks = parsed.tasks || {};
        this.data.notes = parsed.notes || {};
        this.data.lastModified = parsed.lastModified || null;
      }
    } catch (e) {
      console.warn('Storage load warning:', e);
    }

    this.initTheme();
    this.initCloudSyncModal();

    // 2. Fetch and synchronize with cloud database
    await this.fetchFromCloud();

    // 3. Auto-sync on window focus (when switching between mobile/desktop/tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.fetchFromCloud();
      }
    });

    window.addEventListener('online', () => {
      this.fetchFromCloud();
    });
  },

  async fetchFromCloud() {
    if (this.isSyncing) return;
    this.updateSyncBadge('saving', 'Syncing...');
    try {
      const res = await fetch(`${CLOUD_CONFIG.endpoint}?id=eq.${CLOUD_CONFIG.docId}`, {
        headers: {
          'apikey': CLOUD_CONFIG.apiKey,
          'Authorization': `Bearer ${CLOUD_CONFIG.apiKey}`
        }
      });

      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0 && rows[0].data) {
          this.cloudConnected = true;
          this.lastSyncTime = new Date();
          this.reconcileData(rows[0].data);
          this.saveLocal();
          this.notifyDataUpdated();
          this.updateSyncBadge('online', 'Cloud Synced (Live)');
          return;
        } else {
          // Document does not exist yet: push current local state to cloud
          await this.pushToCloud();
          return;
        }
      }
    } catch (e) {
      console.warn('Cloud fetch notice:', e);
    }
    
    // Offline or network unreachable
    if (!this.cloudConnected) {
      this.updateSyncBadge('offline', 'Saved Locally (Offline)');
    } else {
      this.updateSyncBadge('online', 'Cloud Synced (Live)');
    }
  },

  reconcileData(incoming) {
    if (!incoming) return;
    const localTime = this.data.lastModified ? new Date(this.data.lastModified).getTime() : 0;
    const cloudTime = incoming.lastModified ? new Date(incoming.lastModified).getTime() : 0;

    if (cloudTime >= localTime) {
      // Cloud is newer or equal: adopt cloud state
      this.data.tasks = incoming.tasks || {};
      this.data.notes = incoming.notes || {};
      this.data.lastModified = incoming.lastModified;
    } else {
      // Local has newer changes made offline: push local changes to cloud
      this.scheduleCloudSync();
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
    this.updateSyncBadge('saving', 'Saving...');
    clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.pushToCloud();
    }, 400);
  },

  async pushToCloud() {
    this.isSyncing = true;
    try {
      const res = await fetch(CLOUD_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'apikey': CLOUD_CONFIG.apiKey,
          'Authorization': `Bearer ${CLOUD_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: CLOUD_CONFIG.docId,
          data: this.data,
          updated_at: new Date().toISOString()
        })
      });

      if (res.ok) {
        this.cloudConnected = true;
        this.lastSyncTime = new Date();
        this.updateSyncBadge('online', 'Cloud Synced (Live)');
      }
    } catch (e) {
      console.warn('Push to cloud notice:', e);
      this.updateSyncBadge('offline', 'Saved Locally (Offline)');
    } finally {
      this.isSyncing = false;
    }
  },

  initCloudSyncModal() {
    if (document.getElementById('cloud-sync-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'cloud-sync-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card">
        <h2 class="modal-title">☁️ Live Cloud Sync</h2>
        <p class="modal-desc">
          Your progress is automatically saved to your cloud database in real time. Open <code>track.swarajkanse.me</code> on any phone, tablet, or browser—no login or token required.
        </p>

        <div style="background:var(--bg-secondary); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1rem; margin-bottom:1.25rem;">
          <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.5rem;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--success); box-shadow:0 0 8px var(--success);"></span>
            <strong style="font-size:0.9rem; color:var(--text-primary);">Automatic Sync Active</strong>
          </div>
          <p style="font-size:0.8rem; color:var(--text-secondary); margin:0;" id="cloud-last-sync-text">
            Continuous background sync enabled across all devices.
          </p>
        </div>

        <div class="modal-actions" style="justify-content:space-between;">
          <button class="nav-btn" style="background:var(--accent-primary); color:white; border-color:var(--accent-primary);" onclick="manualForceSync()">Sync Now</button>
          <button class="nav-btn" onclick="closeCloudSyncModal()">Close</button>
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

// Modal helpers
function openCloudSyncModal() {
  const modal = document.getElementById('cloud-sync-modal');
  if (!modal) return;
  const syncText = document.getElementById('cloud-last-sync-text');
  if (syncText && AppState.lastSyncTime) {
    syncText.textContent = `Last synced with cloud: ${AppState.lastSyncTime.toLocaleTimeString()}`;
  }
  modal.classList.add('open');
}

function closeCloudSyncModal() {
  const modal = document.getElementById('cloud-sync-modal');
  if (modal) modal.classList.remove('open');
}

async function manualForceSync() {
  showToast('Syncing with cloud...');
  await AppState.fetchFromCloud();
  await AppState.pushToCloud();
  showToast('✓ Synced with cloud!');
  closeCloudSyncModal();
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
