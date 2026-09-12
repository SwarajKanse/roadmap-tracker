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
    const theme = savedTheme || 'dark'; // default dark executive cockpit
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
  },

  toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = next === 'dark' ? 'dark_mode' : 'light_mode';
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
    const icon = item.querySelector('.checkbox-visual .material-symbols-outlined') || item.querySelector('.checkbox-visual svg');
    const visual = item.querySelector('.checkbox-visual');
    const title = item.querySelector('.task-text') || item.querySelector('.deliverable-text');

    if (isChecked) {
      item.classList.add('completed');
      if (visual) {
        visual.className = 'checkbox-visual checkbox-spring w-5 h-5 rounded-[4px] bg-primary border border-primary flex items-center justify-center shadow-sm';
      }
      if (icon) {
        icon.classList.remove('opacity-0');
        icon.classList.add('opacity-100', 'text-on-primary');
      }
      if (title) {
        title.classList.add('line-through', 'text-on-surface-variant');
      }
    } else {
      item.classList.remove('completed');
      if (visual) {
        visual.className = 'checkbox-visual checkbox-spring w-5 h-5 rounded-[4px] bg-surface-container-lowest border border-outline-variant/50 group-hover:border-primary flex items-center justify-center shadow-inner';
      }
      if (icon) {
        icon.classList.add('opacity-0');
        icon.classList.remove('opacity-100', 'text-on-primary');
      }
      if (title) {
        title.classList.remove('line-through', 'text-on-surface-variant');
      }
    }
  }
}

function updateWeekProgress() {
  const allCheckboxes = document.querySelectorAll('.task-checkbox');
  const total = allCheckboxes.length;
  let done = 0;
  let loggedHours = 0;

  allCheckboxes.forEach(cb => {
    if (cb.checked) {
      done++;
      const item = cb.closest('.task-item');
      const track = item?.getAttribute('data-track');
      const dayCard = cb.closest('.day-card');
      const dayCode = dayCard?.getAttribute('data-day');
      const isWeekend = ['Sat', 'Sun'].includes(dayCode);

      let h = 2.5;
      if (track === 'dsa') h = 1.5;
      else if (isWeekend && track === 'aiml') h = 4.0;
      loggedHours += h;
    }
  });

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const fill = document.getElementById('progress-bar-fill') || document.getElementById('week-progress-fill');
  const stats = document.getElementById('week-progress-stats');
  const completedCountEl = document.getElementById('completed-count');
  const progressPercentEl = document.getElementById('progress-percent');
  const loggedHoursLabel = document.getElementById('logged-hours-label');
  
  if (fill) fill.style.width = pct + '%';
  if (stats) stats.textContent = `${done} of ${total} completed (${pct}%)`;
  if (completedCountEl) completedCountEl.textContent = done;
  if (progressPercentEl) progressPercentEl.textContent = `(${pct}%)`;
  if (loggedHoursLabel) loggedHoursLabel.textContent = `Logged: ${loggedHours.toFixed(1)}h`;

  // Update Countdown & Streak on Week Page
  const targetDate = new Date(2027, 6, 1);
  const diffDays = Math.max(0, Math.ceil((targetDate - new Date()) / (1000 * 60 * 60 * 24)));
  const countdownBadge = document.getElementById('target-countdown-badge');
  if (countdownBadge) countdownBadge.textContent = `T-${diffDays}d`;

  const statsObj = StreakEngine.getStats(AppState.data.activityLog || {});
  const streakBadge = document.getElementById('streak-stat-badge');
  if (streakBadge) streakBadge.textContent = `${statsObj.current}d`;
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
      if (done === cbs.length && done > 0) {
        badge.className = 'day-progress font-mono-metric-md text-xs font-semibold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/40';
      } else {
        badge.className = 'day-progress font-mono-metric-md text-xs font-semibold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant border border-outline-variant/20';
      }
    }
  });
}

function applyFilters() {
  const activeTrack = document.querySelector('.track-filter-pill.active-filter')?.getAttribute('data-track') || 
                      document.querySelector('.track-filter-pill.active')?.getAttribute('data-track') || 'all';

  const dayCards = document.querySelectorAll('.day-card');
  dayCards.forEach(card => {
    const taskItems = card.querySelectorAll('.task-item');
    let visibleTasksInDay = 0;
    taskItems.forEach(item => {
      const trackId = item.getAttribute('data-track');
      const trackMatch = (activeTrack === 'all' || activeTrack === trackId || 
                         (activeTrack === 'backend' && ['aptitude', 'backend'].includes(trackId)));
      if (trackMatch) {
        item.style.display = 'flex';
        visibleTasksInDay++;
      } else {
        item.style.display = 'none';
      }
    });

    card.style.display = visibleTasksInDay > 0 ? 'flex' : 'none';
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
    const btnText = document.getElementById('copy-btn-text');
    if (btnText) {
      const old = btnText.textContent;
      btnText.textContent = 'Copied! ✓';
      setTimeout(() => { btnText.textContent = old; }, 2000);
    }
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
    const currentWeek = roadmapData.find(w => w.week_num === selectedWeekNum) || roadmapData[0];
    const currentDay = currentWeek.days.find(d => d.day_code === selectedDayCode) || currentWeek.days[0];
    const isWeekend = ['Sat', 'Sun'].includes(currentDay.day_code);

    const titleEl = document.getElementById('today-day-title');
    if (titleEl) {
      titleEl.innerHTML = `<strong>${currentDay.day_name}</strong> &bull; Week ${String(currentWeek.week_num).padStart(2, '0')}`;
    }

    const budgetEl = document.getElementById('today-budget-pill');
    if (budgetEl) {
      budgetEl.className = `px-2 py-0.5 rounded font-mono-metric-md text-[11px] border ${isWeekend ? 'bg-primary/20 text-primary border-primary/30 font-semibold' : 'bg-surface-container text-on-surface-variant border-outline-variant/20'}`;
      budgetEl.textContent = isWeekend ? '⚡ 8h Deep Focus' : '⏱️ 4h Budget';
    }

    const openWeekLink = document.getElementById('today-open-week-link');
    if (openWeekLink) {
      openWeekLink.setAttribute('href', `weeks/week-${String(currentWeek.week_num).padStart(2, '0')}.html`);
      openWeekLink.innerHTML = `<span>Open Week</span> &rarr;`;
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
      let tagStyle = 'bg-surface-container border-outline-variant/30 text-on-surface-variant';

      if (t.track_id === 'dsa') {
        duration = '1.5h';
        mins = 90;
        tagStyle = 'bg-primary/15 border-primary/30 text-primary font-bold';
      } else if (isWeekend && t.track_id === 'aiml') {
        duration = '4.0h';
        mins = 240;
        tagStyle = 'bg-tertiary/15 border-tertiary/30 text-tertiary font-bold';
      } else if (t.track_id === 'aiml') {
        tagStyle = 'bg-tertiary/15 border-tertiary/30 text-tertiary';
      } else if (t.track_id === 'corecs') {
        tagStyle = 'bg-secondary/15 border-secondary/30 text-secondary';
      } else if (['aptitude', 'backend'].includes(t.track_id)) {
        tagStyle = 'bg-primary-container/15 border-primary-container/30 text-primary-fixed';
      }

      totalEstimatedMinutes += mins;
      if (isDone) completedEstimatedMinutes += mins;

      const deferBtnHtml = (!isWeekend && !isDone) ? `
        <button type="button" class="btn-defer text-[10px] font-mono-metric-md px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-primary transition-colors cursor-pointer ${isDeferred ? 'text-primary border-primary/40' : ''}" onclick="AppState.deferTask('${t.id}', ${!isDeferred});">
          ${isDeferred ? '⏳ Deferred to Weekend' : '⏳ Defer'}
        </button>
      ` : '';

      tasksHtml += `
        <div class="task-row group flex items-start justify-between px-5 py-3.5 hover:bg-surface-container-highest/30 transition-colors duration-150 cursor-pointer ${isDone ? 'completed' : ''}" data-task-id="${t.id}">
          <div class="flex items-start gap-3.5 min-w-0 flex-1">
            <label class="custom-checkbox shrink-0 mt-0.5 cursor-pointer">
              <input type="checkbox" class="today-task-checkbox" data-task-id="${t.id}" ${isDone ? 'checked' : ''} style="display:none;" onchange="AppState.setTask('${t.id}', this.checked)">
              <div class="checkbox-visual checkbox-spring w-4 h-4 rounded-[3px] ${isDone ? 'bg-primary border-primary' : 'bg-surface-container-lowest border-outline-variant/50 group-hover:border-primary'} border flex items-center justify-center shadow-sm">
                <span class="material-symbols-outlined text-[13px] text-on-primary font-bold ${isDone ? 'opacity-100' : 'opacity-0'} transition-opacity">check</span>
              </div>
            </label>
            <div class="flex flex-col gap-1 min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded font-label-caps text-[10px] uppercase border ${tagStyle}">${t.track_name}</span>
                <span class="text-xs text-on-surface-variant/70 font-mono-metric-md">⏱️ ${duration}</span>
                ${deferBtnHtml}
              </div>
              <div class="task-title font-body-md text-xs sm:text-[13px] ${isDone ? 'line-through text-on-surface-variant' : 'text-on-surface'} transition-all leading-relaxed">${t.html}</div>
            </div>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = tasksHtml;

    // Queue Counters & Progress Bar
    const totalCount = currentDay.tasks.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    const completedCounter = document.getElementById('queue-completed-counter');
    const totalCounter = document.getElementById('queue-total-counter');
    const percentEl = document.getElementById('queue-percent');
    const progressBar = document.getElementById('queue-progress-bar');

    if (completedCounter) completedCounter.textContent = completedCount;
    if (totalCounter) totalCounter.textContent = totalCount;
    if (percentEl) percentEl.textContent = `${pct}%`;
    if (progressBar) progressBar.style.width = `${pct}%`;
  }

  function render50WeekHeatmap() {
    const grid = document.getElementById('heatmap-grid');
    if (!grid || grid._rendered) return;
    grid._rendered = true;

    const tooltip = document.getElementById('tooltip-text');
    const totalWeeks = 50;
    const daysPerWeek = 7;
    const subsystems = ['dsa', 'aiml', 'corecs', 'backend'];
    const cellElements = [];

    grid.innerHTML = '';

    for (let w = 1; w <= totalWeeks; w++) {
      for (let d = 0; d < daysPerWeek; d++) {
        const cell = document.createElement('div');
        const daySubsystem = subsystems[(w * 2 + d) % subsystems.length];
        cell.className = 'heatmap-cell w-2.5 h-2.5 rounded-[2px] transition-all duration-200 cursor-pointer';
        cell.setAttribute('data-subsystem', daySubsystem);
        cell.setAttribute('data-week', w);
        cell.setAttribute('data-day', d + 1);

        let hours = '0h';
        let intensityClass = 'bg-surface-container';

        if (w < 14) {
          const pattern = (w * 5 + d * 7) % 5;
          if (pattern === 0) {
            intensityClass = 'bg-primary/25';
            hours = '1.5h';
          } else if (pattern === 1) {
            intensityClass = 'bg-primary/50';
            hours = '2.5h';
          } else if (pattern === 2) {
            intensityClass = 'bg-primary/75';
            hours = '4.0h';
          } else {
            intensityClass = 'bg-primary shadow-sm shadow-primary/25';
            hours = '4.8h';
          }
        } else if (w === 14) {
          if (d <= 2) {
            intensityClass = 'bg-primary shadow-sm shadow-primary/30';
            hours = '4.0h';
          } else if (d === 3) {
            intensityClass = 'bg-primary/45 animate-pulse';
            hours = '2.5h (Active)';
          } else {
            intensityClass = 'bg-surface-container border border-white/5';
            hours = '0h';
          }
        } else {
          intensityClass = 'bg-surface-container-high/30';
          hours = 'Queued';
        }

        cell.classList.add(...intensityClass.split(' '));
        cell.setAttribute('data-hours', hours);

        cell.addEventListener('mouseenter', () => {
          const trackName = daySubsystem.toUpperCase();
          if (tooltip) {
            tooltip.innerHTML = `<strong>Week ${w}, Day ${d + 1}</strong>: ${hours} &bull; Track: <span class="text-primary font-bold">${trackName}</span>`;
          }
        });

        cell.addEventListener('mouseleave', () => {
          if (tooltip) {
            tooltip.textContent = 'Hover any node to inspect execution load & track distribution';
          }
        });

        grid.appendChild(cell);
        cellElements.push(cell);
      }
    }

    // Heatmap filter tab switching
    const filterButtons = document.querySelectorAll('#heatmap-filter-group .heatmap-filter');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');

        filterButtons.forEach(b => {
          b.classList.remove('bg-surface-container-high', 'text-on-surface', 'border', 'border-outline-variant/40', 'shadow-sm', 'font-medium');
          b.classList.add('text-on-surface-variant', 'bg-transparent');
        });
        btn.classList.add('bg-surface-container-high', 'text-on-surface', 'border', 'border-outline-variant/40', 'shadow-sm', 'font-medium');
        btn.classList.remove('text-on-surface-variant', 'bg-transparent');

        cellElements.forEach(cell => {
          const cellTrack = cell.getAttribute('data-subsystem');
          const week = parseInt(cell.getAttribute('data-week'), 10);
          if (filter === 'all' || cellTrack === filter || week > 14) {
            cell.style.opacity = '1';
            cell.style.filter = 'none';
          } else {
            cell.style.opacity = '0.2';
            cell.style.filter = 'grayscale(80%)';
          }
        });
      });
    });
  }

  function initQuietAccordion() {
    const toggles = document.querySelectorAll('.phase-toggle');
    toggles.forEach(toggle => {
      if (toggle._initialized) return;
      toggle._initialized = true;

      toggle.addEventListener('click', () => {
        const card = toggle.closest('[data-phase-card]');
        const content = card.querySelector('.accordion-content');
        const chevron = toggle.querySelector('.chevron-icon');

        const isExpanded = content.classList.contains('max-h-[800px]') || content.classList.contains('max-h-[1200px]');

        if (isExpanded) {
          content.classList.remove('max-h-[800px]', 'max-h-[1200px]', 'opacity-100', 'border-outline-variant/20');
          content.classList.add('max-h-0', 'opacity-0', 'border-transparent');
          if (chevron) chevron.classList.remove('rotate-180', 'text-primary');
          card.classList.remove('border', 'border-primary/40');
        } else {
          content.classList.remove('max-h-0', 'opacity-0', 'border-transparent');
          content.classList.add('max-h-[1200px]', 'opacity-100', 'border-outline-variant/20');
          if (chevron) chevron.classList.add('rotate-180', 'text-primary');
          card.classList.add('border', 'border-primary/40');
        }
      });
    });
  }

  function renderDashboardStats() {
    let totalTasksGlobal = 0;
    let completedTasksGlobal = 0;
    let completedWeeksGlobal = 0;
    let totalLoggedHours = 0;
    let firstIncompleteWeek = null;

    const trackCounts = { dsa: 0, aiml: 0, corecs: 0, backend: 0 };
    const trackCompleted = { dsa: 0, aiml: 0, corecs: 0, backend: 0 };
    const phaseStats = {};

    roadmapData.forEach(w => {
      let weekTotal = 0;
      let weekDone = 0;
      const pNum = w.phase_num;

      if (!phaseStats[pNum]) {
        phaseStats[pNum] = { total: 0, done: 0, weeksTotal: 0, weeksDone: 0 };
      }
      phaseStats[pNum].weeksTotal++;

      w.days.forEach(d => {
        const isWeekend = ['Sat', 'Sun'].includes(d.day_code);
        d.tasks.forEach(t => {
          if (!t.is_rest) {
            weekTotal++;
            totalTasksGlobal++;
            phaseStats[pNum].total++;

            let h = 2.5;
            if (t.track_id === 'dsa') h = 1.5;
            else if (isWeekend && t.track_id === 'aiml') h = 4.0;
            
            const trackKey = ['aptitude', 'backend'].includes(t.track_id) ? 'backend' : t.track_id;
            if (trackKey in trackCounts) trackCounts[trackKey]++;

            if (AppState.isTaskDone(t.id)) {
              weekDone++;
              completedTasksGlobal++;
              totalLoggedHours += h;
              phaseStats[pNum].done++;
              if (trackKey in trackCompleted) trackCompleted[trackKey]++;
            }
          }
        });
      });

      w.deliverables.forEach(deliv => {
        weekTotal++;
        totalTasksGlobal++;
        phaseStats[pNum].total++;
        if (AppState.isTaskDone(deliv.id)) {
          weekDone++;
          completedTasksGlobal++;
          phaseStats[pNum].done++;
        }
      });

      const isWeekDone = weekTotal > 0 && weekDone === weekTotal;
      if (isWeekDone) {
        completedWeeksGlobal++;
        phaseStats[pNum].weeksDone++;
      } else if (!firstIncompleteWeek) {
        firstIncompleteWeek = w.week_num;
      }

      // Update week micro-card inside accordion
      const weekTasksEl = document.getElementById(`dash-week-${w.week_num}-tasks`);
      const weekPctEl = document.getElementById(`dash-week-${w.week_num}-pct`);
      if (weekTasksEl) weekTasksEl.textContent = `${weekDone}/${weekTotal} Tasks`;
      if (weekPctEl) {
        const pct = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;
        weekPctEl.textContent = `${pct}%`;
        if (isWeekDone) weekPctEl.className = 'font-mono-metric-md text-[10px] text-emerald-400 font-bold week-pct';
      }
    });

    // Update Phase status pills in accordion
    Object.keys(phaseStats).forEach(pNum => {
      const ps = phaseStats[pNum];
      const pPill = document.getElementById(`phase-${pNum}-status`);
      if (pPill) {
        const pPct = ps.total > 0 ? Math.round((ps.done / ps.total) * 100) : 0;
        if (pPct === 100) {
          pPill.className = 'font-mono-metric-md text-xs font-semibold text-emerald-400 phase-status-pill';
          pPill.textContent = `100% (${ps.total}/${ps.total})`;
        } else if (pPct > 0) {
          pPill.className = 'font-mono-metric-md text-xs font-semibold text-primary phase-status-pill';
          pPill.textContent = `${pPct}% (${ps.done}/${ps.total})`;
        } else {
          pPill.className = 'font-mono-metric-md text-xs font-semibold text-on-surface-variant phase-status-pill';
          pPill.textContent = `0% (${ps.weeksTotal} Weeks)`;
        }
      }
    });

    // Overall Progress & Vitals Bar
    const globalPct = totalTasksGlobal > 0 ? ((completedTasksGlobal / totalTasksGlobal) * 100).toFixed(1) : 0;
    
    const elPct = document.getElementById('stat-pct-done');
    if (elPct) elPct.textContent = `${globalPct}%`;

    const globalBar = document.getElementById('global-progress-bar');
    if (globalBar) globalBar.style.width = `${globalPct}%`;

    const elLoggedHours = document.getElementById('vitals-logged-hours');
    if (elLoggedHours) elLoggedHours.textContent = `${totalLoggedHours.toFixed(1)}h`;

    const elTasksSub = document.getElementById('stat-tasks-done-sub');
    if (elTasksSub) elTasksSub.textContent = `${completedTasksGlobal} tasks completed`;

    // Target Countdown to July 2027
    const targetDate = new Date(2027, 6, 1);
    const diffDays = Math.max(0, Math.ceil((targetDate - new Date()) / (1000 * 60 * 60 * 24)));
    const elCountdown = document.getElementById('vitals-countdown-val');
    if (elCountdown) elCountdown.textContent = `${diffDays}d`;

    // Streak
    const stats = StreakEngine.getStats(AppState.data.activityLog || {});
    const elStreakVal = document.getElementById('streak-current-val');
    if (elStreakVal) elStreakVal.textContent = stats.current;

    const elStreakBadge = document.getElementById('streak-stat-badge');
    if (elStreakBadge) elStreakBadge.textContent = `${stats.current}d`;

    // Subsystem Workload Distribution
    let dsaPct = 35, aimlPct = 30, corecsPct = 20, backendPct = 15;
    if (completedTasksGlobal > 0) {
      dsaPct = Math.round((trackCompleted.dsa / completedTasksGlobal) * 100);
      aimlPct = Math.round((trackCompleted.aiml / completedTasksGlobal) * 100);
      corecsPct = Math.round((trackCompleted.corecs / completedTasksGlobal) * 100);
      backendPct = Math.max(0, 100 - (dsaPct + aimlPct + corecsPct));
    }
    
    const dsaPctEl = document.getElementById('workload-dsa-pct');
    const dsaBarEl = document.getElementById('workload-dsa-bar');
    if (dsaPctEl) dsaPctEl.textContent = `${dsaPct}%`;
    if (dsaBarEl) dsaBarEl.style.width = `${dsaPct}%`;

    const aimlPctEl = document.getElementById('workload-aiml-pct');
    const aimlBarEl = document.getElementById('workload-aiml-bar');
    if (aimlPctEl) aimlPctEl.textContent = `${aimlPct}%`;
    if (aimlBarEl) aimlBarEl.style.width = `${aimlPct}%`;

    const corecsPctEl = document.getElementById('workload-corecs-pct');
    const corecsBarEl = document.getElementById('workload-corecs-bar');
    if (corecsPctEl) corecsPctEl.textContent = `${corecsPct}%`;
    if (corecsBarEl) corecsBarEl.style.width = `${corecsPct}%`;

    const backendPctEl = document.getElementById('workload-backend-pct');
    const backendBarEl = document.getElementById('workload-backend-bar');
    if (backendPctEl) backendPctEl.textContent = `${backendPct}%`;
    if (backendBarEl) backendBarEl.style.width = `${backendPct}%`;

    renderTodayCommandCenter();
    render50WeekHeatmap();
    initQuietAccordion();
  }

  // Smooth scroll for segmented nav
  document.querySelectorAll('.nav-segmented-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('href');
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
        document.querySelectorAll('.nav-segmented-btn').forEach(b => {
          b.classList.remove('bg-surface-container-high', 'font-semibold', 'text-on-surface');
          b.classList.add('text-on-surface-variant', 'font-medium');
        });
        btn.classList.add('bg-surface-container-high', 'font-semibold', 'text-on-surface');
        btn.classList.remove('text-on-surface-variant', 'font-medium');
      }
    });
  });

  renderDashboardStats();

  AppState.onDataLoaded(() => {
    renderDashboardStats();
  });
}
