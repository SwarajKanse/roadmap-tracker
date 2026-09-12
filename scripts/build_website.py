import glob
import re
import json
import os
import sys

def format_cell_html(text):
    if not text:
        return ""
    
    # 1. Escape basic HTML entities first
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    # 2. Convert markdown links [text](url)
    def link_repl(m):
        label = m.group(1)
        url = m.group(2)
        if not url.startswith('http://') and not url.startswith('https://'):
            url = 'https://' + url
        return f'<a href="{url}" target="_blank" rel="noopener noreferrer" class="task-link">{label}</a>'
    
    text = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', link_repl, text)
    
    # 3. Convert raw URLs not already in href
    def raw_url_repl(m):
        url = m.group(0)
        full_url = url if url.startswith('http') else 'https://' + url
        trailing = ""
        while full_url and full_url[-1] in '.,;:)\"`\'':
            trailing = full_url[-1] + trailing
            full_url = full_url[:-1]
            url = url[:-1]
        return f'<a href="{full_url}" target="_blank" rel="noopener noreferrer" class="task-link">{url}</a>{trailing}'

    bare_url_regex = r'(?<!href=")(?<!">)(?:https?://[^\s<>`"\)]+|(?:youtube\.com|cs50\.harvard\.edu|khanacademy\.org|arxiv\.org|immersivemath\.com|course\.fast\.ai|modelcontextprotocol\.io|docs\.spring\.io|docs\.langchain4j\.dev|developer\.confluent\.io|testcontainers\.com|docs\.ragas\.io|huggingface\.co|baeldung\.com)[^\s<>`"\)]*)'
    text = re.sub(bare_url_regex, raw_url_repl, text)
    
    # 4. Bold: **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    
    # 5. Italic: *text*
    text = re.sub(r'(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    
    # 6. Inline code: `code`
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    
    return text

def categorize_track(col_name):
    name_lower = col_name.lower()
    if 'dsa' in name_lower or 'modern java' in name_lower:
        return 'dsa', 'DSA & Java'
    elif 'ai/ml' in name_lower or ('capstone' in name_lower and 'ai' in name_lower):
        return 'aiml', 'AI / ML'
    elif 'core cs' in name_lower or 'oops' in name_lower or 'dbms' in name_lower or 'os' in name_lower or 'cn' in name_lower or 'lld' in name_lower or 'hld' in name_lower or 'ddia' in name_lower:
        return 'corecs', 'Core CS'
    elif 'aptitude' in name_lower or 'backend' in name_lower or 'spring' in name_lower:
        if 'spring' in name_lower or 'backend' in name_lower:
            return 'backend', 'Java Backend'
        return 'aptitude', 'Aptitude'
    return 'other', col_name

def parse_roadmap():
    roadmap_pattern = 'Roadmap/*Phase*.md'
    if not glob.glob(roadmap_pattern):
        roadmap_pattern = '../Roadmap/*Phase*.md'
    if not glob.glob(roadmap_pattern):
        roadmap_pattern = os.path.join(os.path.dirname(__file__), '../../Roadmap/*Phase*.md')
    files = sorted(glob.glob(roadmap_pattern))
    roadmap = []
    
    day_order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    day_full_names = {
        'Mon': 'Monday',
        'Tue': 'Tuesday',
        'Wed': 'Wednesday',
        'Thu': 'Thursday',
        'Fri': 'Friday',
        'Sat': 'Saturday',
        'Sun': 'Sunday'
    }

    for f in files:
        with open(f, 'r', encoding='utf-8') as fp:
            content = fp.read()
            
        p_match = re.search(r'^#\s+Phase\s+(\d+)\s+[—-]\s+(.+)', content, re.MULTILINE)
        if p_match:
            phase_num = int(p_match.group(1))
            phase_title = f"Phase {phase_num}: " + p_match.group(2).strip()
        else:
            phase_num = len(roadmap) // 5 + 1
            phase_title = f"Phase {phase_num}"
            
        week_blocks = re.split(r'\n(?=## Week \d+)', content)
        for block in week_blocks[1:]:
            lines = [l.strip() for l in block.strip().split('\n')]
            header = lines[0]
            w_match = re.search(r'##\s+Week\s+(\d+)\s+[—-]\s+(.+)', header)
            if not w_match:
                continue
            w_num = int(w_match.group(1))
            w_title = w_match.group(2).strip()
            w_title_clean = re.sub(r'\*\*([^*]+)\*\*', r'\1', w_title)
            
            table_lines = [l for l in lines if l.startswith('|') and l.endswith('|')]
            if not table_lines:
                continue
                
            col_headers = [c.strip() for c in table_lines[0].split('|')[1:-1]]
            col_meta = []
            for col in col_headers[1:]:
                cat_id, cat_name = categorize_track(col)
                col_meta.append({
                    'original': col,
                    'cat_id': cat_id,
                    'cat_name': cat_name
                })
                
            days_data = []
            for r in table_lines[2:]:
                cells = [c.strip() for c in r.split('|')[1:-1]]
                if not cells or len(cells) < len(col_headers):
                    continue
                day_code = cells[0]
                if day_code not in day_order:
                    continue
                    
                day_tasks = []
                for idx, cell in enumerate(cells[1:]):
                    if idx >= len(col_meta):
                        break
                    cell_trimmed = cell.strip()
                    if not cell_trimmed or cell_trimmed == '-':
                        continue
                    
                    track_code = col_meta[idx]['cat_id']
                    task_id = f"w{w_num}_{day_code.lower()}_{track_code}"
                    
                    if cell_trimmed.lower() in ['rest', 'catch up', 'rest / catch up', 'open — catch up']:
                        day_tasks.append({
                            'id': task_id,
                            'track_original': col_meta[idx]['original'],
                            'track_id': col_meta[idx]['cat_id'],
                            'track_name': col_meta[idx]['cat_name'],
                            'raw_text': cell_trimmed,
                            'html': '<em>(Open — catch up or rest)</em>' if 'open' in cell_trimmed.lower() else '<em>Rest / Catch up</em>',
                            'is_rest': True
                        })
                    else:
                        day_tasks.append({
                            'id': task_id,
                            'track_original': col_meta[idx]['original'],
                            'track_id': col_meta[idx]['cat_id'],
                            'track_name': col_meta[idx]['cat_name'],
                            'raw_text': cell_trimmed,
                            'html': format_cell_html(cell_trimmed),
                            'is_rest': False
                        })
                        
                days_data.append({
                    'day_code': day_code,
                    'day_name': day_full_names[day_code],
                    'tasks': day_tasks
                })
                
            deliverables = []
            notes = []
            for l in lines:
                if l.startswith('|') or l.startswith('##') or l.startswith('---'):
                    continue
                if l.startswith('**Deliverable') or l.startswith('**Checkpoint'):
                    deliv_id = f"w{w_num}_deliv_{len(deliverables) + 1}"
                    deliverables.append({
                        'id': deliv_id,
                        'raw_text': l,
                        'html': format_cell_html(l)
                    })
                elif l.startswith('>') or l.startswith('Next:') or l.startswith('Run a 1-hour') or l.startswith('Phase'):
                    notes.append(format_cell_html(l))
                elif deliverables and l.startswith('- '):
                    deliv_id = f"w{w_num}_deliv_{len(deliverables) + 1}"
                    deliverables.append({
                        'id': deliv_id,
                        'raw_text': l[2:],
                        'html': format_cell_html(l[2:])
                    })
            
            if not deliverables:
                for l in lines:
                    if 'deliverable' in l.lower() and not l.startswith('|'):
                        deliv_id = f"w{w_num}_deliv_1"
                        deliverables.append({
                            'id': deliv_id,
                            'raw_text': l,
                            'html': format_cell_html(l)
                        })
                        
            roadmap.append({
                'week_num': w_num,
                'title': w_title_clean,
                'phase_num': phase_num,
                'phase_title': phase_title,
                'days': days_data,
                'deliverables': deliverables,
                'notes': notes
            })
            
    roadmap.sort(key=lambda x: x['week_num'])
    return roadmap

def generate_week_page(week, total_weeks, all_weeks):
    w_num = week['week_num']
    w_pad = f"{w_num:02d}"
    
    prev_w = f"week-{(w_num - 1):02d}.html" if w_num > 1 else None
    next_w = f"week-{(w_num + 1):02d}.html" if w_num < total_weeks else None
    
    select_options = []
    for ow in all_weeks:
        num = ow['week_num']
        selected = 'selected' if num == w_num else ''
        select_options.append(f'<option value="week-{num:02d}.html" {selected}>Week {num}: {ow["title"][:35]}</option>')
    select_html = "\n".join(select_options)

    days_html = []
    for day in week['days']:
        tasks_html = []
        is_weekend = day['day_code'] in ['Sat', 'Sun']
        for t in day['tasks']:
            task_id = t['id']
            track_class = t['track_id']
            track_name = t['track_name']
            content_html = t['html']
            rest_class = 'is-rest' if t['is_rest'] else ''
            
            if track_class == 'dsa':
                duration = '1.5h'
            elif is_weekend and track_class == 'aiml':
                duration = '4.0h'
            elif track_class in ['aptitude', 'backend']:
                duration = '2.5h'
            else:
                duration = '2.5h'
            
            defer_btn = f'<button type="button" class="btn-defer" data-task-id="{task_id}" title="Defer to Weekend Lab (Preserves 4h limit)">⏳ Defer</button>' if not is_weekend else ''

            tasks_html.append(f'''
            <div class="task-item {rest_class}" data-task-id="{task_id}" data-track="{track_class}">
              <label class="custom-checkbox">
                <input type="checkbox" class="task-checkbox" data-task-id="{task_id}">
                <div class="checkbox-visual">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              </label>
              <div class="task-content">
                <div class="task-meta">
                  <span class="track-tag {track_class}">{track_name}</span>
                  <span class="time-estimate-pill">⏱️ {duration}</span>
                  {defer_btn}
                </div>
                <div class="task-text">{content_html}</div>
              </div>
            </div>''')
            
        day_tasks_joined = "\n".join(tasks_html)
        budget_badge = '<span class="day-budget-pill weekend">⚡ 8h Deep Focus</span>' if is_weekend else '<span class="day-budget-pill weekday">⏱️ 4h Budget</span>'
        weekend_deferred_box = f'<div class="weekend-deferred-container" data-day="{day["day_code"]}"></div>' if is_weekend else ''
        
        days_html.append(f'''
        <div class="day-card" data-day="{day['day_code']}">
          <div class="day-card-header">
            <div class="day-title-group">
              <span class="day-title">{day['day_name']}</span>
              {budget_badge}
            </div>
            <span class="day-progress">0/{len(day['tasks'])} done</span>
          </div>
          {weekend_deferred_box}
          <div class="tasks-list">
            {day_tasks_joined}
          </div>
        </div>''')

    all_days_html = "\n".join(days_html)

    deliverables_html = ""
    if week['deliverables']:
        deliv_items = []
        for d in week['deliverables']:
            deliv_items.append(f'''
            <div class="deliverable-item" data-task-id="{d['id']}">
              <label class="custom-checkbox">
                <input type="checkbox" class="task-checkbox" data-task-id="{d['id']}">
                <div class="checkbox-visual">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
              </label>
              <div class="deliverable-text">{d['html']}</div>
            </div>''')
        
        deliv_joined = "\n".join(deliv_items)
        deliverables_html = f'''
        <div class="deliverables-section">
          <div class="deliverables-header">
            <span class="deliverables-icon">🎯</span>
            <span class="deliverables-title">Weekly Deliverables &amp; Checkpoints</span>
            <span class="deliverables-badge">Milestone</span>
          </div>
          <div class="deliverables-list">
            {deliv_joined}
          </div>
        </div>'''

    notes_html = f'''
    <div class="notes-section">
      <div class="notes-header">
        <span class="notes-title">📝 Week {w_num} Notes &amp; Reflection</span>
        <span class="notes-save-status" id="notes-save-status">Auto-saved to browser</span>
      </div>
      <textarea id="week-notes" class="notes-textarea" placeholder="Record tricky problem gotchas, math derivations, or Spring AI architecture takeaways for this week..."></textarea>
    </div>'''

    prev_link = f'<a href="{prev_w}" class="nav-btn" id="nav-prev">&larr; Week {w_num - 1}</a>' if prev_w else '<span class="nav-btn disabled">&larr; First</span>'
    next_link = f'<a href="{next_w}" class="nav-btn" id="nav-next">Week {w_num + 1} &rarr;</a>' if next_w else '<span class="nav-btn disabled">Last &rarr;</span>'

    html_content = f'''<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Week {w_pad} Checklist &bull; {week['title']}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>

  <!-- Top Sticky Navigation -->
  <header class="top-nav">
    <div class="top-nav-inner">
      <div class="nav-left">
        <a href="../index.html" class="brand-link">
          <span>&larr;</span>
          <span>Cockpit Dashboard</span>
        </a>
      </div>

      <div class="nav-center">
        {prev_link}
        <select id="week-select-dropdown" class="week-select" aria-label="Jump to week">
          {select_html}
        </select>
        {next_link}
      </div>

      <div class="nav-right">
        <div id="nav-auth-badge" class="auth-badge unlocked" title="Authentication Status">
          <span class="auth-dot"></span>
          <span>Authorized</span>
        </div>
        <div class="sync-badge saving" title="Cloud Sync Status - Live across all devices">
          <span class="sync-dot"></span>
          <span class="sync-text">Connecting to cloud...</span>
        </div>
        <button class="icon-btn" onclick="AppState.toggleTheme()" title="Toggle Dark/Light Mode" aria-label="Toggle Theme">
          🌓
        </button>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="container">
    <header class="week-header">
      <div class="phase-pill">{week['phase_title']}</div>
      <h1 class="week-title">Week {w_pad} &mdash; {week['title']}</h1>
      <p class="week-subtitle">Structured 36-hour weekly plan: Weekdays 4.0h (2 subjects) &bull; Weekends 8.0h (3 subjects).</p>
    </header>

    <!-- Progress Card -->
    <section class="progress-card" aria-label="Week Progress">
      <div class="progress-header">
        <span class="progress-label">Week Completion</span>
        <span class="progress-stats" id="week-progress-stats">0 of 0 completed (0%)</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" id="week-progress-fill"></div>
      </div>
    </section>

    <!-- Controls Bar -->
    <div class="controls-bar">
      <div class="filter-group" aria-label="Filter by track">
        <button class="filter-pill track-filter-pill active" data-track="all">All Tracks</button>
        <button class="filter-pill track-filter-pill" data-track="dsa">DSA</button>
        <button class="filter-pill track-filter-pill" data-track="aiml">AI / ML</button>
        <button class="filter-pill track-filter-pill" data-track="corecs">Core CS</button>
        <button class="filter-pill track-filter-pill" data-track="backend">Backend / Aptitude</button>
      </div>

      <div class="action-group">
        <button class="btn-subtle" id="btn-copy-summary" title="Copy progress to clipboard">📋 Copy Summary</button>
      </div>
    </div>

    <!-- Daily Task Cards -->
    <div class="days-container" id="days-container">
      {all_days_html}
    </div>

    <!-- Deliverables Section -->
    {deliverables_html}

    <!-- Notes Scratchpad -->
    {notes_html}

    <!-- Bottom Navigation -->
    <nav class="bottom-nav">
      {prev_link}
      <a href="../index.html" class="nav-btn">&uarr; Back to Dashboard</a>
      {next_link}
    </nav>
  </main>

  <script src="../js/app.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {{
      initWeekPage({w_num});
    }});
  </script>
</body>
</html>'''

    return html_content

def generate_dashboard(roadmap):
    phases_dict = {}
    for w in roadmap:
        p_num = w['phase_num']
        if p_num not in phases_dict:
            phases_dict[p_num] = {
                'title': w['phase_title'],
                'weeks': []
            }
        phases_dict[p_num]['weeks'].append(w)

    phases_html = []
    for p_num in sorted(phases_dict.keys()):
        p_info = phases_dict[p_num]
        weeks_tiles = []
        for w in p_info['weeks']:
            num = w['week_num']
            padded = f"{num:02d}"
            title = w['title']
            
            weeks_tiles.append(f'''
            <a href="weeks/week-{padded}.html" class="week-tile" id="dash-week-{num}">
              <div class="week-tile-num">WEEK {padded}</div>
              <div class="week-tile-name">{title}</div>
              <div class="week-tile-progress">
                <span>0 tasks</span>
                <span>0%</span>
              </div>
            </a>''')
            
        weeks_grid_html = "\n".join(weeks_tiles)
        phases_html.append(f'''
        <div class="phase-card">
          <div class="phase-card-header">
            <h2 class="phase-card-title">{p_info['title']}</h2>
            <span class="phase-progress-pill">Weeks {p_info['weeks'][0]['week_num']}–{p_info['weeks'][-1]['week_num']}</span>
          </div>
          <div class="weeks-grid">
            {weeks_grid_html}
          </div>
        </div>''')

    all_phases_html = "\n".join(phases_html)

    html_content = f'''<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI + Java Roadmap Checklist &bull; 50-Week Placement Cockpit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>

  <!-- Top Sticky Navigation Bar -->
  <header class="top-nav">
    <div class="top-nav-inner">
      <div class="nav-left">
        <a href="index.html" class="brand-link">
          <span class="brand-badge">50 WEEKS</span>
          <span>Placement Engineering Cockpit</span>
        </a>
      </div>

      <div class="nav-right">
        <div id="nav-auth-badge" class="auth-badge unlocked" title="Authentication Status">
          <span class="auth-dot"></span>
          <span>Authorized</span>
        </div>
        <div class="sync-badge saving" title="Cloud Sync Status - Live across all devices">
          <span class="sync-dot"></span>
          <span class="sync-text">Connecting to cloud...</span>
        </div>
        <button class="icon-btn" onclick="AppState.toggleTheme()" title="Toggle Dark/Light Mode" aria-label="Toggle Theme">
          🌓
        </button>
      </div>
    </div>
  </header>

  <!-- Container -->
  <main class="container">
    <section class="dashboard-hero">
      <div class="cockpit-identity-badge">
        <span class="dot"></span>
        <span>Swaraj Kanse &bull; B.E. AI&amp;DS, TSEC &bull; Placement Target: July 2027</span>
      </div>
      <h1 class="dashboard-title">50-Week Placement Checklist</h1>
      <p class="dashboard-desc">
        Your daily execution cockpit for mastering DSA in Java, modern AI &amp; GenAI engineering, Core CS, and production Spring Boot systems. 36 hours a week structured with strict time frames and continuous momentum.
      </p>
    </section>

    <!-- TODAY'S MISSION / ACTIVE COMMAND CENTER (Zero Friction) -->
    <section class="today-focus-card" id="today-focus-card">
      <div class="today-focus-header">
        <div class="today-badge-group">
          <span class="pulse-indicator"></span>
          <span class="today-badge">Today's Focus</span>
          <span class="today-day-title" id="today-day-title">Loading today's schedule...</span>
          <span class="day-budget-pill weekday" id="today-budget-pill">⏱️ 4h Budget</span>
        </div>
        <div class="today-nav-actions">
          <select id="today-day-picker" class="today-day-picker" aria-label="Switch Active Day"></select>
          <a href="weeks/week-01.html" id="today-open-week-link" class="today-open-week-btn">
            <span>Open Week Checklist</span> &rarr;
          </a>
        </div>
      </div>

      <div class="today-tasks-list" id="today-tasks-list">
        <!-- Injected dynamically by app.js with real checkboxes & defer buttons -->
      </div>

      <div class="today-focus-footer">
        <div class="today-progress-bar-wrap">
          <div class="today-progress-bar-fill" id="today-progress-bar-fill" style="width: 0%;"></div>
        </div>
        <div class="today-footer-meta">
          <span id="today-progress-text">0 of 0 tasks completed</span>
          <span class="today-hint">Changes sync to Supabase &amp; update your streak instantly</span>
        </div>
      </div>
    </section>

    <!-- STREAK ENGINE & ACTIVITY HEATMAP -->
    <section class="streak-heatmap-section" id="streak-heatmap-section">
      <div class="streak-strip-grid">
        <div class="streak-stat-card">
          <span class="streak-stat-label">Active Streak</span>
          <div class="streak-stat-val flame">
            <span>🔥</span>
            <span id="streak-current-val">0 Days</span>
          </div>
        </div>
        <div class="streak-stat-card">
          <span class="streak-stat-label">Longest Streak</span>
          <div class="streak-stat-val">
            <span>🏆</span>
            <span id="streak-longest-val">0 Days</span>
          </div>
        </div>
        <div class="streak-stat-card">
          <span class="streak-stat-label">Total Days Active</span>
          <div class="streak-stat-val">
            <span>📅</span>
            <span id="streak-total-val">0 Days</span>
          </div>
        </div>
        <div class="streak-stat-card">
          <span class="streak-stat-label">Today's Status</span>
          <div id="streak-today-status" style="margin-top: 0.25rem;">
            <span class="status-badge-pending">⏳ Pending</span>
          </div>
        </div>
      </div>

      <div class="heatmap-header">
        <div class="heatmap-title">
          <span>⚡</span>
          <span>Rolling Activity Matrix (Past 16 Weeks)</span>
        </div>
        <div class="heatmap-legend">
          <span>Less</span>
          <span class="legend-cell" style="background: var(--heat-lvl-0);"></span>
          <span class="legend-cell" style="background: var(--heat-lvl-1);"></span>
          <span class="legend-cell" style="background: var(--heat-lvl-2);"></span>
          <span class="legend-cell" style="background: var(--heat-lvl-3);"></span>
          <span>More</span>
        </div>
      </div>

      <div class="activity-heatmap-grid" id="activity-heatmap-grid">
        <!-- Populated dynamically by app.js -->
      </div>
    </section>

    <!-- Global Progress Bar -->
    <section class="progress-card" style="margin-bottom: 1.75rem;">
      <div class="progress-header">
        <span class="progress-label">Overall 50-Week Placement Roadmap Completion</span>
        <span class="progress-stats" id="stat-pct-done">0%</span>
      </div>
      <div class="progress-bar-bg" style="height: 10px;">
        <div class="progress-bar-fill" id="global-progress-bar"></div>
      </div>
    </section>

    <!-- Stats Grid -->
    <div class="global-stats-grid">
      <div class="stat-card">
        <div class="stat-val accent" id="stat-tasks-done">0 / 0</div>
        <div class="stat-label">Tasks Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" id="stat-weeks-done">0 / {len(roadmap)}</div>
        <div class="stat-label">Weeks Finished</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">{len(phases_dict)} Phases</div>
        <div class="stat-label">Full Curriculum</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">July 2027</div>
        <div class="stat-label">Target Placement Drive</div>
      </div>
    </div>

    <!-- Study Schedule & Time Allocation Banner -->
    <section class="schedule-banner-card">
      <div class="schedule-banner-header">
        <div class="schedule-banner-title">
          <span>⏱️</span>
          <span>Daily Time Allocation &amp; Multi-Subject Schedule</span>
        </div>
        <span class="schedule-total-badge">36 Hours / Week Total</span>
      </div>
      <div class="schedule-grid">
        <div class="schedule-item">
          <div class="schedule-badge weekday">📅 Weekdays (Mon &ndash; Fri)</div>
          <div class="schedule-hours">4.0 hrs / day</div>
          <ul class="schedule-breakdown">
            <li><span class="time-tag">1.5h</span> <span><strong>DSA (Java)</strong> &bull; Daily problem reps &amp; Striver TUF+ sheet</span></li>
            <li><span class="time-tag">2.5h</span> <span><strong>Core Focus Track</strong> &bull; AI/ML (Mon/Wed/Fri) or Core CS (Tue/Thu)</span></li>
          </ul>
        </div>
        <div class="schedule-item">
          <div class="schedule-badge weekend">⚡ Weekends (Sat &ndash; Sun)</div>
          <div class="schedule-hours">8.0 hrs / day</div>
          <ul class="schedule-breakdown">
            <li><span class="time-tag">1.5h</span> <span><strong>DSA (Java)</strong> &bull; Weekly contest problems, revision &amp; hard drills</span></li>
            <li><span class="time-tag">2.5h</span> <span><strong>Aptitude / Backend</strong> &bull; Quant, Logical, Verbal mocks / Spring Boot</span></li>
            <li><span class="time-tag">4.0h</span> <span><strong>AI/ML Hands-On Lab</strong> &bull; Kaggle, scratch code, papers &amp; projects</span></li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Phases Grid -->
    <section class="phases-container">
      {all_phases_html}
    </section>
  </main>

  <script src="js/roadmap-data.js"></script>
  <script src="js/app.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {{
      if (window.ROADMAP_DATA) {{
        initDashboard(window.ROADMAP_DATA);
      }}
    }});
  </script>
</body>
</html>'''

    return html_content

def main():
    tracker_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    os.chdir(tracker_root)
    print("Parsing roadmap files...")
    roadmap = parse_roadmap()
    print(f"Parsed {len(roadmap)} weeks.")

    # 1. Output js/roadmap-data.js
    with open('js/roadmap-data.js', 'w', encoding='utf-8') as f:
        f.write("window.ROADMAP_DATA = ")
        json.dump(roadmap, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print("Written js/roadmap-data.js")

    # 2. Output index.html
    dash_html = generate_dashboard(roadmap)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(dash_html)
    print("Written index.html")

    # 3. Output individual week pages: weeks/week-01.html ... weeks/week-50.html
    for w in roadmap:
        pad = f"{w['week_num']:02d}"
        filepath = f"weeks/week-{pad}.html"
        week_html = generate_week_page(w, len(roadmap), roadmap)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(week_html)
    print(f"Generated {len(roadmap)} weekly HTML pages in weeks/")

if __name__ == '__main__':
    main()
