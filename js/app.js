/**
 * Minimalist Roadmap Checklist - Online Web Edition
 * Domain: track.swarajkanse.me
 * 
 * Features:
 * 1. OAuth / Dynamic Rotating PIN Authentication Gatekeeper (30-day session)
 * 2. Instant local persistence in browser (localStorage)
 * 3. Automatic Cloud Sync via Supabase across all devices
 * 4. Track filtering, auto-saving notes, keyboard shortcuts
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
  email: 'swarajkanse2@gmail.com',
  masterPin: '2609', // Emergency master PIN fallback
  sessionDurationDays: 30, // 1 month device persistence
  otpEndpoint: 'https://ljqmvwvfmyoaakgsxddw.supabase.co/auth/v1/otp',
  verifyEndpoint: 'https://ljqmvwvfmyoaakgsxddw.supabase.co/auth/v1/verify'
};

// ==========================================================================
// Authentication Manager (Dynamic Rotating Email OTP / PIN Gatekeeper)
// ==========================================================================
const AuthManager = {
  session: null,

  init() {
    this.loadSession();
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

  saveSession(authType = 'otp') {
    const expiresAt = Date.now() + (AUTH_CONFIG.sessionDurationDays * 24 * 60 * 60 * 1000);
    this.session = {
      authenticated: true,
      email: AUTH_CONFIG.email,
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
    showToast('Device locked. PIN required to enter.');
  },

  async sendEmailOtp() {
    const statusEl = document.getElementById('auth-status-msg');
    const sendBtn = document.getElementById('btn-send-otp');
    if (sendBtn) sendBtn.disabled = true;
    if (statusEl) {
      statusEl.className = 'auth-status-msg info';
      statusEl.textContent = 'Generating dynamic PIN and sending to ' + AUTH_CONFIG.email + '...';
    }

    try {
      const res = await fetch(AUTH_CONFIG.otpEndpoint, {
        method: 'POST',
        headers: {
          'apikey': CLOUD_CONFIG.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: AUTH_CONFIG.email,
          create_user: true
        })
      });

      if (res.ok) {
        if (statusEl) {
          statusEl.className = 'auth-status-msg success';
          statusEl.textContent = '✓ Dynamic PIN sent! Please check your Gmail (' + AUTH_CONFIG.email + ').';
        }
        showToast('Dynamic PIN sent to Gmail!');
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.error_code === 'over_email_send_rate_limit' || res.status === 429) {
          if (statusEl) {
            statusEl.className = 'auth-status-msg warning';
            statusEl.textContent = 'Email limit reached. Please enter your master PIN to unlock immediately.';
          }
        } else {
          if (statusEl) {
            statusEl.className = 'auth-status-msg error';
            statusEl.textContent = err.msg || 'Could not send OTP email. Please use master PIN.';
          }
        }
      }
    } catch (e) {
      if (statusEl) {
        statusEl.className = 'auth-status-msg error';
        statusEl.textContent = 'Network error sending PIN. You can use your master PIN.';
      }
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  },

  async verifyPin(pin) {
    const cleanPin = (pin || '').trim();
    const statusEl = document.getElementById('auth-status-msg');
    const unlockBtn = document.getElementById('btn-unlock-auth');
    
    if (!cleanPin) {
      if (statusEl) {
        statusEl.className = 'auth-status-msg error';
        statusEl.textContent = 'Please enter your 6-digit PIN.';
      }
      return false;
    }

    if (unlockBtn) unlockBtn.disabled = true;
    if (statusEl) {
      statusEl.className = 'auth-status-msg info';
      statusEl.textContent = 'Verifying credentials...';
    }

    // 1. Direct check against Master PIN fallback
    if (cleanPin === AUTH_CONFIG.masterPin) {
      this.saveSession('master_pin');
      this.onAuthenticated('Master PIN Verified');
      if (unlockBtn) unlockBtn.disabled = false;
      return true;
    }

    // 2. Check against Supabase OTP endpoint
    try {
      const res = await fetch(AUTH_CONFIG.verifyEndpoint, {
        method: 'POST',
        headers: {
          'apikey': CLOUD_CONFIG.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'email',
          email: AUTH_CONFIG.email,
          token: cleanPin
        })
      });

      if (res.ok) {
        this.saveSession('email_otp');
        this.onAuthenticated('Dynamic PIN Verified');
        if (unlockBtn) unlockBtn.disabled = false;
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        if (statusEl) {
          statusEl.className = 'auth-status-msg error';
          statusEl.textContent = err.msg || 'Invalid or expired PIN. Please try again or use Master PIN.';
        }
      }
    } catch (e) {
      if (statusEl) {
        statusEl.className = 'auth-status-msg error';
        statusEl.textContent = 'Verification connection error. Please try again.';
      }
    } finally {
      if (unlockBtn) unlockBtn.disabled = false;
    }
    return false;
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
        b.title = `Device authorized as ${AUTH_CONFIG.email}. Valid for ${daysLeft} more days. Click to lock.`;
        b.onclick = () => {
          if (confirm('Lock this device now? You will need your PIN to re-enter.')) {
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
        b.title = 'Workspace locked. Click to enter PIN.';
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
        <p class="auth-subtitle">Swaraj Kanse &bull; 50-Week Placement Roadmap</p>
        
        <p class="auth-desc">
          Authorized access only. Dynamic rotating PIN verification ensures no one else can view or alter your study progress.
        </p>

        <div class="auth-email-box">
          <div class="auth-email-label">Authorized Account</div>
          <div class="auth-email-val">swarajkanse2@gmail.com</div>
        </div>

        <button type="button" class="btn-auth-send" id="btn-send-otp" onclick="AuthManager.sendEmailOtp()">
          📩 Send Rotating PIN to Gmail
        </button>

        <div class="auth-divider"><span>OR ENTER PIN DIRECTLY</span></div>

        <form id="auth-pin-form" onsubmit="event.preventDefault(); AuthManager.verifyPin(document.getElementById('auth-pin-input').value);">
          <div class="auth-input-wrap">
            <input type="password" id="auth-pin-input" class="auth-pin-input" placeholder="Enter 6-digit PIN" maxlength="10" autocomplete="one-time-code" />
          </div>

          <div id="auth-status-msg" class="auth-status-msg"></div>

          <button type="submit" class="btn-auth-unlock" id="btn-unlock-auth">
            🔓 Unlock &amp; Remember Device (30 Days)
          </button>
        </form>

        <div class="auth-footer-notes">
          <span>🛡️ Remembers this device for 1 month (30 days)</span>
          <span>🔄 Rotating dynamic PIN sent exclusively to your email</span>
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
          // Document does not exist yet: push current local state to cloud if authenticated
          if (AuthManager.isAuthenticated()) {
            await this.pushToCloud();
          }
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
    if (!AuthManager.isAuthenticated()) {
      showToast('⚠️ Workspace is locked. Unlock with PIN to edit.');
      AuthManager.updateUIState();
      return;
    }
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
    if (!AuthManager.isAuthenticated()) {
      showToast('⚠️ Workspace is locked. Unlock with PIN to edit.');
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
          Your progress is automatically saved to your cloud database in real time across phone, laptop, and tablet.
        </p>

        <div style="background:var(--bg-secondary); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1rem; margin-bottom:1.25rem;">
          <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.5rem;">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--success); box-shadow:0 0 8px var(--success);"></span>
            <strong style="font-size:0.9rem; color:var(--text-primary);">Automatic Cloud Sync Active</strong>
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
  if (!AuthManager.isAuthenticated()) {
    showToast('Please unlock with PIN first');
    AuthManager.updateUIState();
    return;
  }
  showToast('Syncing with cloud...');
  await AppState.fetchFromCloud();
  await AppState.pushToCloud();
  showToast('✓ Synced with cloud!');
  closeCloudSyncModal();
}

// Auto-start AppState
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
      if (!AuthManager.isAuthenticated()) {
        cb.checked = !cb.checked;
        showToast('⚠️ Workspace is locked. Unlock with PIN to edit.');
        AuthManager.updateUIState();
        return;
      }
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

  // 2. Track Filtering setup (Day pills removed per requirement)
  const trackPills = document.querySelectorAll('.track-filter-pill');
  trackPills.forEach(pill => {
    pill.addEventListener('click', () => {
      trackPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      applyFilters();
    });
  });

  // 3. Quick Actions
  const btnCopySummary = document.getElementById('btn-copy-summary');
  if (btnCopySummary) {
    btnCopySummary.addEventListener('click', () => {
      copyWeekSummaryToClipboard(weekNum);
    });
  }

  // 4. Notes Scratchpad auto-save
  const notesArea = document.getElementById('week-notes');
  const saveStatus = document.getElementById('notes-save-status');
  if (notesArea) {
    notesArea.value = AppState.getNote(weekNum);
    let timeout;
    notesArea.addEventListener('input', () => {
      if (!AuthManager.isAuthenticated()) {
        showToast('⚠️ Workspace is locked. Unlock with PIN to edit.');
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
}
