/**
 * Minimalist Roadmap Checklist - Online Web Edition
 * Domain: track.swarajkanse.me
 * 
 * Features:
 * 1. Cryptographic Master Password Gatekeeper (30-day session)
 * 2. Instant local persistence in browser (localStorage)
 * 3. Automatic Cloud Sync via Supabase across all devices
 * 4. Zero-Click Today's Focus Command Center
 * 5. Unbroken Daily Streak Engine & Activity Heatmap
 * 6. Anti-Guilt "Defer to Weekend" Protocol
 */

const STORAGE_KEY = 'study_roadmap_checklist_v1';
const THEME_KEY = 'study_roadmap_theme';

const CLOUD_CONFIG = {
  endpoint: 'https://ljqmvwvfmyoaakgsxddw.supabase.co/rest/v1/tracker_state',
  apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqcW12d3ZmbXlvYWFrZ3N4ZGR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTc1ODAsImV4cCI6MjEwNDYzMzU4MH0.aVUPWDOnirAco45eh0iTLNxupL9etepBWkInje0dZuk',
  docId: 'swaraj_placement_roadmap'
};

const AUTH_CONFIG = {
  sessionKey: 'study_roadmap_auth_session',
  sessionDurationDays: 30 // 1 month device persistence
};

// Cryptographic one-way verification (Zero plain-text credentials in client code)
const _SEC = {
  eH: '772c6f69a74a0530a2cc1c4a5dec881288e1bdbf8b3e2f6b89b5934529cacefd',
  pH: 'c8145ecf06526ca12acb7bd2c7cc03e1d633fc4df39358042a9e1b63c4de5ffb',
  salt: 'swaraj_placement_roadmap_secure_salt_2026'
};

async function _hashPassword(val) {
  const encoder = new TextEncoder();
  const data = encoder.encode((val || '').trim() + _SEC.salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _hashEmail(val) {
  const encoder = new TextEncoder();
  const data = encoder.encode((val || '').trim().toLowerCase() + _SEC.salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==========================================================================
// Authentication Manager (Cryptographic Master Password Gatekeeper)
// ==========================================================================
const AuthManager = {
  session: null,

  init() {
    if (window.location.search.includes('lock=true')) {
      this.logout();
      try {
        history.replaceState(null, '', window.location.pathname);
      } catch (e) {}
    } else {
      this.loadSession();
    }
    this.injectAuthUI();
    this.updateUIState();
  },

  loadSession() {
    try {
      const raw = localStorage.getItem(AUTH_CONFIG.sessionKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.authenticated && s.expiresAt && Date.now() < s.expiresAt) {
          this.session = s;
          return;
        }
      }
    } catch (e) {
      console.warn('Auth session read warning:', e);
    }
    this.session = null;
  },

  isAuthenticated() {
    if (!this.session) {
      this.loadSession();
    }
    return !!(this.session && this.session.authenticated && this.session.expiresAt && Date.now() < this.session.expiresAt);
  },

  saveSession(authType = 'master_password') {
    const expiresAt = Date.now() + (AUTH_CONFIG.sessionDurationDays * 24 * 60 * 60 * 1000);
    this.session = {
      authenticated: true,
      loginTime: new Date().toISOString(),
      expiresAt: expiresAt,
      type: authType
    };
    try {
      localStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(this.session));
    } catch (e) {
      console.warn('Auth session save error:', e);
    }
    this.updateUIState();
  },

  logout() {
    this.session = null;
    try {
      localStorage.removeItem(AUTH_CONFIG.sessionKey);
    } catch (e) {}
    this.updateUIState();
    showToast('Device locked. Password required to enter.');
  },

  async verifyCredentials(email, password) {
    const cleanPass = (password || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const statusEl = document.getElementById('auth-status-msg');
    const unlockBtn = document.getElementById('btn-unlock-auth');

    if (!cleanPass) {
      if (statusEl) {
        statusEl.className = 'auth-status-msg error';
        statusEl.textContent = 'Please enter your Master Password.';
      }
      const passInput = document.getElementById('auth-password-input');
      if (passInput) passInput.focus();
      return false;
    }

    if (unlockBtn) unlockBtn.disabled = true;
    if (statusEl) {
      statusEl.className = 'auth-status-msg info';
      statusEl.textContent = 'Verifying cryptographic credentials...';
    }

    if (cleanEmail) {
      const emailHash = await _hashEmail(cleanEmail);
      if (emailHash !== _SEC.eH) {
        if (statusEl) {
          statusEl.className = 'auth-status-msg error';
          statusEl.textContent = 'Access Denied: Unrecognized email address.';
        }
        if (unlockBtn) unlockBtn.disabled = false;
        return false;
      }
    }

    const passHash = await _hashPassword(cleanPass);
    if (passHash === _SEC.pH) {
      this.saveSession('master_password');
      this.onAuthenticated('Master Password Verified');
      if (unlockBtn) unlockBtn.disabled = false;
      return true;
    } else {
      if (statusEl) {
        statusEl.className = 'auth-status-msg error';
        statusEl.textContent = 'Invalid Master Password. Access Denied.';
      }
      if (unlockBtn) unlockBtn.disabled = false;
      return false;
    }
  },

  onAuthenticated(reason) {
    const overlay = document.getElementById('auth-lock-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
    document.body.classList.remove('auth-locked');
    showToast(`🔓 Access granted (${reason}) • Device remembered for 30 days!`);
  },

  updateUIState() {
    const overlay = document.getElementById('auth-lock-overlay');
    const authBadges = document.querySelectorAll('.auth-badge, #nav-auth-badge');
    
    if (this.isAuthenticated()) {
      if (overlay) overlay.classList.remove('active');
      document.body.classList.remove('auth-locked');
      
      const daysLeft = Math.max(1, Math.round((this.session.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
      authBadges.forEach(b => {
        b.className = 'auth-badge unlocked';
        b.innerHTML = `<span class="auth-dot"></span><span>Authorized (${daysLeft}d)</span>`;
        b.title = `Device authorized. Valid for ${daysLeft} more days. Click to lock.`;
        b.onclick = () => {
          if (confirm('Lock this device now? You will need your password to re-enter.')) {
            AuthManager.logout();
          }
        };
      });
    } else {
      if (overlay) overlay.classList.add('active');
      document.body.classList.add('auth-locked');
      
      authBadges.forEach(b => {
        b.className = 'auth-badge locked';
        b.innerHTML = `<span class="auth-dot"></span><span>Locked</span>`;
        b.title = 'Workspace locked. Click to enter password.';
        b.onclick = () => {
          if (overlay) overlay.classList.add('active');
        };
      });
    }
  },

  injectAuthUI() {
    if (document.getElementById('auth-lock-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'auth-lock-overlay';
    overlay.className = 'auth-overlay' + (this.isAuthenticated() ? '' : ' active');
    overlay.innerHTML = `
      <div class="auth-card">
        <div class="auth-card-icon">
          <div class="auth-icon-circle">🔐</div>
        </div>
        <h2 class="auth-title">Private Workspace</h2>
        <p class="auth-subtitle">Swaraj Kanse &bull; B.E. AI&amp;DS, TSEC &bull; 2027 Placements</p>
        
        <p class="auth-desc">
          Authorized access only. Enter your Master Password to unlock your placement roadmap and sync your progress.
        </p>

        <form id="auth-login-form" onsubmit="event.preventDefault(); AuthManager.verifyCredentials(document.getElementById('auth-email-input').value, document.getElementById('auth-password-input').value);">
          <div class="auth-email-group">
            <label class="auth-input-label" for="auth-email-input">Authorized Email</label>
            <input type="email" id="auth-email-input" class="auth-email-input" placeholder="Enter authorized email" autocomplete="username" />
          </div>

          <div class="auth-email-group">
            <label class="auth-input-label" for="auth-password-input">Master Password</label>
            <input type="password" id="auth-password-input" class="auth-password-input" placeholder="Enter Master Password" autocomplete="current-password" autofocus />
          </div>

          <div id="auth-status-msg" class="auth-status-msg"></div>

          <button type="submit" class="btn-auth-unlock" id="btn-unlock-auth">
            🔓 Unlock &amp; Remember Device (30 Days)
          </button>
        </form>

        <div class="auth-footer-notes">
          <span>🛡️ Remembers this device for 1 month (30 days)</span>
          <span>🔒 Cryptographic SHA-256 verification &bull; Zero rate limits</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    if (!this.isAuthenticated()) {
      document.body.classList.add('auth-locked');
    }
  }
};

// ==========================================================================
// App State & Cloud Sync Controller
// ==========================================================================
const AppState = {
  data: {
    tasks: {},
    notes: {},
    activityLog: {},    // { "YYYY-MM-DD": taskCount }
    deferredTasks: {},  // { [taskId]: "YYYY-MM-DD" }
    lastModified: null
  },
  cloudConnected: false,
  syncTimeout: null,
  isSyncing: false,
  lastSyncTime: null,
  onDataLoadedCallbacks: [],

  async init() {
    AuthManager.init();

    // 1. Instant load from local browser cache for immediate rendering
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.data.tasks = parsed.tasks || {};
        this.data.notes = parsed.notes || {};
        this.data.activityLog = parsed.activityLog || {};
        this.data.deferredTasks = parsed.deferredTasks || {};
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
          if (AuthManager.isAuthenticated()) {
            await this.pushToCloud();
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Cloud fetch notice:', e);
    }
    
    if (!this.cloudConnected) {
      this.updateSyncBadge('offline', 'Saved Locally (Offline)');
    } else {
      this.updateSyncBadge('online', 'Cloud Synced (Live)');
    }
  },

  reconcileData(cloudData) {
    const localTasks = this.data.tasks || {};
    const cloudTasks = cloudData.tasks || {};
    const localNotes = this.data.notes || {};
    const cloudNotes = cloudData.notes || {};
    const localActivity = this.data.activityLog || {};
    const cloudActivity = cloudData.activityLog || {};
    const localDeferred = this.data.deferredTasks || {};
    const cloudDeferred = cloudData.deferredTasks || {};

    const mergedTasks = { ...cloudTasks, ...localTasks };
    const mergedNotes = { ...cloudNotes, ...localNotes };
    const mergedDeferred = { ...cloudDeferred, ...localDeferred };
    
    // Merge activity counts
    const mergedActivity = { ...cloudActivity };
    Object.keys(localActivity).forEach(date => {
      mergedActivity[date] = Math.max(mergedActivity[date] || 0, localActivity[date] || 0);
    });

    this.data.tasks = mergedTasks;
    this.data.notes = mergedNotes;
    this.data.activityLog = mergedActivity;
    this.data.deferredTasks = mergedDeferred;
    this.data.lastModified = cloudData.lastModified || this.data.lastModified;
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

  isTaskDeferred(id) {
    return !!(this.data.deferredTasks && this.data.deferredTasks[id]);
  },

  setTask(id, done) {
    if (!AuthManager.isAuthenticated()) {
      showToast('⚠️ Workspace is locked. Unlock to edit.');
      AuthManager.updateUIState();
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    if (!this.data.activityLog) this.data.activityLog = {};

    if (done) {
      this.data.tasks[id] = true;
      this.data.activityLog[todayStr] = (this.data.activityLog[todayStr] || 0) + 1;
      // If task was deferred, remove deferral once completed
      if (this.data.deferredTasks && this.data.deferredTasks[id]) {
        delete this.data.deferredTasks[id];
      }
    } else {
      delete this.data.tasks[id];
      if (this.data.activityLog[todayStr]) {
        this.data.activityLog[todayStr] = Math.max(0, this.data.activityLog[todayStr] - 1);
      }
    }
    this.data.lastModified = new Date().toISOString();
    this.saveLocal();
    this.scheduleCloudSync();
    this.notifyDataUpdated();
  },

  deferTask(id, defer = true) {
    if (!AuthManager.isAuthenticated()) {
      showToast('⚠️ Workspace is locked. Unlock to edit.');
      AuthManager.updateUIState();
      return;
    }
    if (!this.data.deferredTasks) this.data.deferredTasks = {};
    if (defer) {
      this.data.deferredTasks[id] = new Date().toISOString().slice(0, 10);
      showToast('⏳ Task deferred to Weekend Lab block (Zero guilt!)');
    } else {
      delete this.data.deferredTasks[id];
      showToast('Task returned to regular weekday schedule');
    }
    this.data.lastModified = new Date().toISOString();
    this.saveLocal();
    this.scheduleCloudSync();
    this.notifyDataUpdated();
  },

  getNote(weekNum) {
    return this.data.notes[weekNum] || '';
  },

  setNote(weekNum, text) {
    if (!AuthManager.isAuthenticated()) {
      showToast('⚠️ Workspace is locked. Unlock to edit.');
      AuthManager.updateUIState();
      return;
    }
    this.data.notes[weekNum] = text;
    this.data.lastModified = new Date().toISOString();
    this.saveLocal();
    this.scheduleCloudSync();
  },

  scheduleCloudSync() {
    if (!AuthManager.isAuthenticated()) return;
    this.updateSyncBadge('saving', 'Saving...');
    clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.pushToCloud();
    }, 400);
  },

  async pushToCloud() {
    if (!AuthManager.isAuthenticated()) return;
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
      } else {
        this.updateSyncBadge('offline', 'Saved Locally');
      }
    } catch (e) {
      console.warn('Cloud sync error:', e);
      this.updateSyncBadge('offline', 'Saved Locally');
    } finally {
      this.isSyncing = false;
    }
  },

  updateSyncBadge(status, text) {
    const badges = document.querySelectorAll('.sync-badge');
    badges.forEach(badge => {
      badge.className = `sync-badge ${status}`;
      const textEl = badge.querySelector('.sync-text');
      if (textEl) textEl.textContent = text;
      badge.onclick = () => openCloudSyncModal();
    });
  },

  initCloudSyncModal() {
    if (document.getElementById('cloud-sync-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'cloud-sync-modal';
    modal.className = 'cloud-modal';
    modal.innerHTML = `
      <div class="cloud-modal-content">
        <div class="cloud-modal-header">
          <span class="cloud-modal-title">☁️ Live Cloud Sync &amp; Backup</span>
          <button class="cloud-modal-close" onclick="closeCloudSyncModal()">&times;</button>
        </div>
        <div class="cloud-modal-body">
          <p>Your checklist and streak automatically synchronize with your encrypted cloud database on every change.</p>
          <div class="cloud-status-box">
            <div class="cloud-status-row">
              <span>Status:</span>
              <span id="cloud-status-val" style="color: var(--success); font-weight: 600;">Active &bull; Real-Time</span>
            </div>
            <div class="cloud-status-row">
              <span>Database:</span>
              <span>Supabase REST API (SSL)</span>
            </div>
            <div class="cloud-status-row">
              <span>Device Key:</span>
              <span><code>swaraj_placement_roadmap</code></span>
            </div>
          </div>
          <p id="cloud-last-sync-text" style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.25rem;">
            Last synced with cloud: Just now
          </p>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="nav-btn" onclick="closeCloudSyncModal()">Close</button>
            <button class="nav-btn" style="background: var(--accent-primary); color: white;" onclick="manualForceSync()">Sync Now &rarr;</button>
          </div>
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

// ==========================================================================
// Streak Engine & Analytics
// ==========================================================================
const StreakEngine = {
  getStats(activityLog = {}) {
    const dates = Object.keys(activityLog).filter(d => (activityLog[d] || 0) > 0).sort();
    if (dates.length === 0) {
      // Seed streak if tasks are already done
      const completedCount = Object.keys(AppState.data.tasks || {}).length;
      if (completedCount > 0) {
        return { current: 1, longest: 1, totalDays: 1, todayDone: false };
      }
      return { current: 0, longest: 0, totalDays: 0, todayDone: false };
    }

    const dateSet = new Set(dates);
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const todayDone = dateSet.has(todayStr);

    let currentStreak = 0;
    let checkDate = new Date(today);

    // If today is not yet done, check if yesterday was done to keep streak alive
    if (!todayDone) {
      if (dateSet.has(yesterdayStr)) {
        checkDate = yesterday;
      } else {
        checkDate = null;
      }
    }

    if (checkDate) {
      while (true) {
        const dStr = checkDate.toISOString().slice(0, 10);
        if (dateSet.has(dStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Longest streak calculation
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate = null;

    dates.forEach(dStr => {
      const curDate = new Date(dStr + 'T00:00:00');
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curDate - prevDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      prevDate = curDate;
    });

    return {
      current: currentStreak,
      longest: Math.max(longestStreak, currentStreak),
      totalDays: dates.length,
      todayDone: todayDone
    };
  }
};

// ==========================================================================
// Week Page Controller
// ==========================================================================
function initWeekPage(weekNum) {
  function syncUI() {
    const checkboxes = document.querySelectorAll('.task-checkbox');
    checkboxes.forEach(cb => {
      const taskId = cb.getAttribute('data-task-id');
      const isDone = AppState.isTaskDone(taskId);
      cb.checked = isDone;
      updateTaskItemVisual(cb, isDone);
      updateDeferBtnVisual(taskId);
    });

    const notesArea = document.getElementById('week-notes');
    if (notesArea && !notesArea._userTyping) {
      notesArea.value = AppState.getNote(weekNum);
    }

    updateWeekProgress();
    updateDayProgress();
    renderWeekendDeferredQueue(weekNum);
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
    updateDeferBtnVisual(taskId);

    cb.addEventListener('change', () => {
      if (!AuthManager.isAuthenticated()) {
        cb.checked = !cb.checked;
        showToast('⚠️ Workspace is locked. Unlock to edit.');
        AuthManager.updateUIState();
        return;
      }
      const checked = cb.checked;
      AppState.setTask(taskId, checked);
      updateTaskItemVisual(cb, checked);
      updateDeferBtnVisual(taskId);
      updateWeekProgress();
      updateDayProgress();
      
      if (checked && isWeekAllDone()) {
        showToast('🎉 Outstanding! All Week tasks completed & logged!');
      }
    });
  });

  // 2. Defer buttons setup
  document.querySelectorAll('.btn-defer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.getAttribute('data-task-id');
      const isCurrentlyDeferred = AppState.isTaskDeferred(taskId);
      AppState.deferTask(taskId, !isCurrentlyDeferred);
      updateDeferBtnVisual(taskId);
      renderWeekendDeferredQueue(weekNum);
    });
  });

  updateWeekProgress();
  updateDayProgress();
  renderWeekendDeferredQueue(weekNum);

  // 3. Track Filtering setup
  const trackPills = document.querySelectorAll('.track-filter-pill');
  trackPills.forEach(pill => {
    pill.addEventListener('click', () => {
      trackPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      applyFilters();
    });
  });

  // 4. Quick Actions
  const btnCopySummary = document.getElementById('btn-copy-summary');
  if (btnCopySummary) {
    btnCopySummary.addEventListener('click', () => {
      copyWeekSummaryToClipboard(weekNum);
    });
  }

  // 5. Notes Scratchpad auto-save
  const notesArea = document.getElementById('week-notes');
  const saveStatus = document.getElementById('notes-save-status');
  if (notesArea) {
    notesArea.value = AppState.getNote(weekNum);
    let timeout;
    notesArea.addEventListener('input', () => {
      if (!AuthManager.isAuthenticated()) {
        showToast('⚠️ Workspace is locked. Unlock to edit.');
        AuthManager.updateUIState();
        return;
      }
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

  // 6. Keyboard navigation
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

function updateDeferBtnVisual(taskId) {
  const btn = document.querySelector(`.btn-defer[data-task-id="${taskId}"]`);
  const item = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
  const isDeferred = AppState.isTaskDeferred(taskId);
  const isDone = AppState.isTaskDone(taskId);

  if (item) {
    if (isDeferred && !isDone) {
      item.classList.add('deferred');
    } else {
      item.classList.remove('deferred');
    }
  }

  if (btn) {
    if (isDone) {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'inline-flex';
      if (isDeferred) {
        btn.classList.add('active');
        btn.innerHTML = '⏳ Deferred to Weekend';
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '⏳ Defer';
      }
    }
  }
}

function renderWeekendDeferredQueue(weekNum) {
  const containers = document.querySelectorAll('.weekend-deferred-container');
  if (!containers || containers.length === 0) return;

  const deferredIds = Object.keys(AppState.data.deferredTasks || {});
  const prefix = `w${weekNum}_`;
  const weekDeferred = deferredIds.filter(id => id.startsWith(prefix) && !AppState.isTaskDone(id));

  containers.forEach(box => {
    if (weekDeferred.length === 0) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    box.style.display = 'block';
    let listHtml = '';
    weekDeferred.forEach(tid => {
      const originalItem = document.querySelector(`.task-item[data-task-id="${tid}"]`);
      const rawText = originalItem ? originalItem.querySelector('.task-text')?.innerText : tid;
      listHtml += `
        <div class="deferred-backlog-row">
          <label class="custom-checkbox">
            <input type="checkbox" onchange="AppState.setTask('${tid}', this.checked); this.closest('.deferred-backlog-row').remove();">
            <div class="checkbox-visual"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
          </label>
          <span class="deferred-backlog-text">${rawText}</span>
          <button type="button" class="btn-undefer" onclick="AppState.deferTask('${tid}', false); renderWeekendDeferredQueue(${weekNum});">Return to Day</button>
        </div>
      `;
    });

    box.innerHTML = `
      <div class="deferred-backlog-header">
        <span class="deferred-backlog-title">📌 Deferred Weekday Backlog (${weekDeferred.length})</span>
        <span class="deferred-backlog-hint">Tackle during your 4.0h Lab block</span>
      </div>
      <div class="deferred-backlog-list">
        ${listHtml}
      </div>
    `;
  });
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
  const activeTrack = document.querySelector('.track-filter-pill.active')?.getAttribute('data-track') || 'all';

  const dayCards = document.querySelectorAll('.day-card');
  dayCards.forEach(card => {
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

// ==========================================================================
// Dashboard (index.html) Controller & Today's Focus Engine
// ==========================================================================
function initDashboard(roadmapData) {
  let selectedWeekNum = 1;
  let selectedDayCode = 'Mon';

  function findFirstIncomplete() {
    for (const w of roadmapData) {
      for (const d of w.days) {
        const hasIncomplete = d.tasks.some(t => !t.is_rest && !AppState.isTaskDone(t.id));
        if (hasIncomplete) {
          return { weekNum: w.week_num, dayCode: d.day_code };
        }
      }
    }
    return { weekNum: 1, dayCode: 'Mon' };
  }

  // Initialize selected day to active incomplete day
  const active = findFirstIncomplete();
  selectedWeekNum = active.weekNum;
  selectedDayCode = active.dayCode;

  function renderTodayCommandCenter() {
    const card = document.getElementById('today-focus-card');
    if (!card) return;

    const currentWeek = roadmapData.find(w => w.week_num === selectedWeekNum) || roadmapData[0];
    const currentDay = currentWeek.days.find(d => d.day_code === selectedDayCode) || currentWeek.days[0];
    const isWeekend = ['Sat', 'Sun'].includes(currentDay.day_code);

    const titleEl = document.getElementById('today-day-title');
    if (titleEl) {
      titleEl.innerHTML = `<strong>${currentDay.day_name}</strong> &bull; Week ${String(currentWeek.week_num).padStart(2, '0')}`;
    }

    const budgetEl = document.getElementById('today-budget-pill');
    if (budgetEl) {
      budgetEl.className = `day-budget-pill ${isWeekend ? 'weekend' : 'weekday'}`;
      budgetEl.textContent = isWeekend ? '⚡ 8h Deep Focus' : '⏱️ 4h Budget';
    }

    const openWeekLink = document.getElementById('today-open-week-link');
    if (openWeekLink) {
      openWeekLink.setAttribute('href', `weeks/week-${String(currentWeek.week_num).padStart(2, '0')}.html`);
      openWeekLink.innerHTML = `<span>View Week ${currentWeek.week_num} Checklist</span> &rarr;`;
    }

    // Populate Day Picker Select
    const picker = document.getElementById('today-day-picker');
    if (picker && !picker._initialized) {
      picker._initialized = true;
      picker.innerHTML = '';
      currentWeek.days.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.day_code;
        opt.textContent = `${d.day_name} (${['Sat','Sun'].includes(d.day_code)?'8h':'4h'})`;
        if (d.day_code === selectedDayCode) opt.selected = true;
        picker.appendChild(opt);
      });
      picker.addEventListener('change', (e) => {
        selectedDayCode = e.target.value;
        renderTodayCommandCenter();
      });
    }

    // Render Tasks
    const listContainer = document.getElementById('today-tasks-list');
    if (!listContainer) return;

    let tasksHtml = '';
    let completedCount = 0;
    let totalEstimatedMinutes = 0;
    let completedEstimatedMinutes = 0;

    currentDay.tasks.forEach(t => {
      const isDone = AppState.isTaskDone(t.id);
      const isDeferred = AppState.isTaskDeferred(t.id);
      if (isDone) completedCount++;

      let duration = '2.5h';
      let mins = 150;
      if (t.track_id === 'dsa') {
        duration = '1.5h';
        mins = 90;
      } else if (isWeekend && t.track_id === 'aiml') {
        duration = '4.0h';
        mins = 240;
      }
      totalEstimatedMinutes += mins;
      if (isDone) completedEstimatedMinutes += mins;

      const deferBtnHtml = (!isWeekend && !isDone) ? `
        <button type="button" class="btn-defer ${isDeferred ? 'active' : ''}" onclick="AppState.deferTask('${t.id}', ${!isDeferred});">
          ${isDeferred ? '⏳ Deferred to Weekend' : '⏳ Defer'}
        </button>
      ` : '';

      tasksHtml += `
        <div class="today-task-row ${isDone ? 'completed' : ''} ${isDeferred && !isDone ? 'deferred' : ''}" data-task-id="${t.id}">
          <label class="custom-checkbox">
            <input type="checkbox" class="today-task-checkbox" data-task-id="${t.id}" ${isDone ? 'checked' : ''} onchange="AppState.setTask('${t.id}', this.checked)">
            <div class="checkbox-visual">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </label>
          <div class="today-task-content">
            <div class="today-task-meta">
              <span class="track-tag ${t.track_id}">${t.track_name}</span>
              <span class="time-estimate-pill">⏱️ ${duration}</span>
              ${deferBtnHtml}
            </div>
            <div class="today-task-text">${t.html}</div>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = tasksHtml;

    // Progress Bar in Today's Card
    const progressFill = document.getElementById('today-progress-bar-fill');
    const progressText = document.getElementById('today-progress-text');
    const pct = currentDay.tasks.length > 0 ? Math.round((completedCount / currentDay.tasks.length) * 100) : 0;
    
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) {
      const remainingMins = Math.max(0, totalEstimatedMinutes - completedEstimatedMinutes);
      const remainingHours = (remainingMins / 60).toFixed(1);
      if (completedCount === currentDay.tasks.length && completedCount > 0) {
        progressText.innerHTML = `<strong>🎉 All tasks finished for today!</strong> Total logged: ${(totalEstimatedMinutes/60).toFixed(1)}h`;
      } else {
        progressText.innerHTML = `${completedCount} of ${currentDay.tasks.length} done &bull; <strong>${remainingHours}h remaining</strong>`;
      }
    }
  }

  function renderStreakAndHeatmap() {
    const stats = StreakEngine.getStats(AppState.data.activityLog || {});

    // Update streak stats bar
    const elCurrent = document.getElementById('streak-current-val');
    if (elCurrent) elCurrent.textContent = `${stats.current} Days`;

    const elLongest = document.getElementById('streak-longest-val');
    if (elLongest) elLongest.textContent = `${stats.longest} Days`;

    const elTotal = document.getElementById('streak-total-val');
    if (elTotal) elTotal.textContent = `${stats.totalDays} Days`;

    const elTodayStatus = document.getElementById('streak-today-status');
    if (elTodayStatus) {
      if (stats.todayDone) {
        elTodayStatus.innerHTML = '<span class="status-badge-done">✓ Logged Today</span>';
      } else {
        elTodayStatus.innerHTML = '<span class="status-badge-pending">⏳ Pending Today</span>';
      }
    }

    // Render Compact Heatmap Grid (Last 16 weeks = 112 days)
    const heatmapGrid = document.getElementById('activity-heatmap-grid');
    if (!heatmapGrid) return;

    const activityLog = AppState.data.activityLog || {};
    const today = new Date();
    const daysToShow = 112; // 16 weeks * 7 days
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysToShow + 1);

    // Adjust startDate so it aligns with Monday
    const dayOfWeek = (startDate.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    startDate.setDate(startDate.getDate() - dayOfWeek);

    let cellsHtml = '';
    const iterDate = new Date(startDate);

    while (iterDate <= today) {
      const dStr = iterDate.toISOString().slice(0, 10);
      const count = activityLog[dStr] || 0;
      
      let lvl = 0;
      if (count >= 3) lvl = 3;
      else if (count === 2) lvl = 2;
      else if (count === 1) lvl = 1;

      const isTodayCell = dStr === today.toISOString().slice(0, 10);
      const cellTitle = `${dStr}: ${count} task${count === 1 ? '' : 's'} completed`;

      cellsHtml += `
        <div class="heatmap-cell lvl-${lvl} ${isTodayCell ? 'is-today' : ''}" 
             data-date="${dStr}" 
             data-count="${count}" 
             title="${cellTitle}"></div>
      `;
      iterDate.setDate(iterDate.getDate() + 1);
    }

    heatmapGrid.innerHTML = cellsHtml;
  }

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

    renderTodayCommandCenter();
    renderStreakAndHeatmap();
  }

  renderDashboardStats();

  AppState.onDataLoaded(() => {
    renderDashboardStats();
  });
}
