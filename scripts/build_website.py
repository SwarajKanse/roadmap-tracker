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
        return f'<a href="{url}" target="_blank" rel="noopener noreferrer" class="task-link text-primary hover:underline font-medium">{label}</a>'
    
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
        return f'<a href="{full_url}" target="_blank" rel="noopener noreferrer" class="task-link text-primary hover:underline font-medium">{url}</a>{trailing}'

    bare_url_regex = r'(?<!href=")(?<!">)(?:https?://[^\s<>`"\)]+|(?:youtube\.com|cs50\.harvard\.edu|khanacademy\.org|arxiv\.org|immersivemath\.com|course\.fast\.ai|modelcontextprotocol\.io|docs\.spring\.io|docs\.langchain4j\.dev|developer\.confluent\.io|testcontainers\.com|docs\.ragas\.io|huggingface\.co|baeldung\.com)[^\s<>`"\)]*)'
    text = re.sub(bare_url_regex, raw_url_repl, text)
    
    # 4. Bold: **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong class="text-on-surface font-semibold">\1</strong>', text)
    
    # 5. Italic: *text*
    text = re.sub(r'(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    
    # 6. Inline code: `code`
    text = re.sub(r'`([^`]+)`', r'<code class="px-1.5 py-0.5 rounded bg-surface-container font-mono-metric-md text-[11px] text-primary border border-outline-variant/20">\1</code>', text)
    
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

COMMON_TAILWIND_CONFIG = """
<script id="tailwind-config">
    tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            "inverse-on-surface": "#2f3034",
            "primary-fixed": "#e1e0ff",
            "outline-variant": "#464554",
            "on-secondary-container": "#afb6bd",
            "inverse-primary": "#494bd6",
            "surface-container-highest": "#343538",
            "on-background": "#e3e2e6",
            "on-primary-fixed-variant": "#2f2ebe",
            "on-surface": "#e3e2e6",
            "surface-container": "#1f1f23",
            "on-secondary-fixed": "#161c22",
            "on-tertiary-container": "#1c2b3c",
            "surface-dim": "#121316",
            "on-secondary-fixed-variant": "#41474e",
            "surface": "#121316",
            "background": "#121316",
            "error": "#ffb4ab",
            "surface-tint": "#c0c1ff",
            "secondary-fixed-dim": "#c1c7cf",
            "on-primary-fixed": "#07006c",
            "tertiary": "#b9c8de",
            "secondary-container": "#41474e",
            "on-error": "#690005",
            "error-container": "#93000a",
            "surface-container-high": "#292a2d",
            "primary": "#c0c1ff",
            "tertiary-fixed": "#d4e4fa",
            "on-surface-variant": "#c7c4d7",
            "secondary": "#c1c7cf",
            "on-primary": "#1000a9",
            "tertiary-fixed-dim": "#b9c8de",
            "surface-container-lowest": "#0d0e11",
            "primary-fixed-dim": "#c0c1ff",
            "on-tertiary": "#233143",
            "primary-container": "#8083ff",
            "tertiary-container": "#8392a6",
            "on-tertiary-fixed": "#0d1c2d",
            "inverse-surface": "#e3e2e6",
            "on-error-container": "#ffdad6",
            "surface-container-low": "#1b1b1f",
            "on-secondary": "#2b3137",
            "on-tertiary-fixed-variant": "#39485a",
            "on-primary-container": "#0d0096",
            "secondary-fixed": "#dde3eb",
            "surface-variant": "#343538",
            "outline": "#908fa0",
            "surface-bright": "#38393d"
          },
          borderRadius: {
            "DEFAULT": "0.125rem",
            "lg": "0.25rem",
            "xl": "0.5rem",
            "full": "0.75rem"
          },
          fontFamily: {
            "headline-lg": ["Space Grotesk", "Plus Jakarta Sans", "sans-serif"],
            "headline-md": ["Space Grotesk", "Plus Jakarta Sans", "sans-serif"],
            "headline-sm": ["Plus Jakarta Sans", "sans-serif"],
            "body-lg": ["Inter", "sans-serif"],
            "body-md": ["Inter", "sans-serif"],
            "body-sm": ["Inter", "sans-serif"],
            "mono-metric-lg": ["JetBrains Mono", "monospace"],
            "mono-metric-md": ["JetBrains Mono", "monospace"],
            "label-kbd": ["JetBrains Mono", "monospace"],
            "label-caps": ["JetBrains Mono", "monospace"]
          }
        }
      }
    };
</script>
"""

def generate_week_page(week, total_weeks, all_weeks):
    w_num = week['week_num']
    w_pad = f"{w_num:02d}"
    
    prev_w = f"week-{(w_num - 1):02d}.html" if w_num > 1 else None
    next_w = f"week-{(w_num + 1):02d}.html" if w_num < total_weeks else None
    
    # Phase week tabs
    phase_weeks = [ow for ow in all_weeks if ow['phase_num'] == week['phase_num']]
    if not phase_weeks:
        phase_weeks = all_weeks[max(0, w_num - 3):min(total_weeks, w_num + 2)]
    phase_tabs_html = []
    for pw in phase_weeks:
        pwn = pw['week_num']
        if pwn == w_num:
            phase_tabs_html.append(f'''<span class="px-3 py-1 rounded bg-primary/20 text-primary font-semibold border border-primary/40 shadow-sm flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>W{pwn:02d} Active</span>''')
        else:
            phase_tabs_html.append(f'''<a href="week-{pwn:02d}.html" class="px-2.5 py-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors">W{pwn:02d}</a>''')
    phase_tabs_joined = "\n".join(phase_tabs_html)

    # 50-week select options
    select_options = []
    for ow in all_weeks:
        num = ow['week_num']
        selected = 'selected' if num == w_num else ''
        select_options.append(f'<option value="week-{num:02d}.html" {selected}>Week {num:02d}: {ow["title"][:32]}</option>')
    select_html = "\n".join(select_options)

    # Calculate track counts
    total_tasks = sum(len(d['tasks']) for d in week['days'])
    dsa_count = sum(sum(1 for t in d['tasks'] if t['track_id'] == 'dsa') for d in week['days'])
    aiml_count = sum(sum(1 for t in d['tasks'] if t['track_id'] == 'aiml') for d in week['days'])
    corecs_count = sum(sum(1 for t in d['tasks'] if t['track_id'] == 'corecs') for d in week['days'])
    backend_count = sum(sum(1 for t in d['tasks'] if t['track_id'] in ['aptitude', 'backend']) for d in week['days'])

    # Weekly Deliverable / Flight Checkpoint text
    if week['deliverables']:
        deliv_text = "<br>".join([f"&bull; {d['html']}" for d in week['deliverables']])
    else:
        deliv_text = f"Complete all scheduled DSA problem reps, AI/ML theory and implementations, and Core CS modules for Week {w_pad}."

    # Days HTML separation: Weekdays vs Weekend
    weekday_cards = []
    weekend_cards = []

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
                badge_style = 'bg-primary/10 border-primary/30 text-primary'
            elif is_weekend and track_class == 'aiml':
                duration = '4.0h'
                badge_style = 'bg-tertiary/15 border-tertiary/30 text-tertiary font-bold'
            elif track_class == 'aiml':
                duration = '2.5h'
                badge_style = 'bg-tertiary/15 border-tertiary/30 text-tertiary'
            elif track_class == 'corecs':
                duration = '2.5h'
                badge_style = 'bg-secondary/15 border-secondary/30 text-secondary'
            elif track_class in ['aptitude', 'backend']:
                duration = '2.5h'
                badge_style = 'bg-primary-container/15 border-primary-container/30 text-primary-fixed'
            else:
                duration = '2.5h'
                badge_style = 'bg-surface-container border-outline-variant/30 text-on-surface-variant'
            
            defer_btn = f'<button type="button" class="btn-defer text-[10px] font-mono-metric-md px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-primary transition-colors cursor-pointer" data-task-id="{task_id}" title="Defer to Weekend Lab (Preserves 4h limit)">⏳ Defer</button>' if not is_weekend else ''

            tasks_html.append(f'''
            <div class="task-item group relative rounded-lg cockpit-subglass p-3.5 border border-outline-variant/20 hover:border-primary/40 transition-all flex items-start justify-between gap-3 {rest_class}" data-task-id="{task_id}" data-track="{track_class}">
              <div class="flex items-start gap-3 min-w-0 flex-1">
                <label class="custom-checkbox shrink-0 mt-0.5 cursor-pointer">
                  <input type="checkbox" class="task-checkbox" data-task-id="{task_id}" style="display:none;">
                  <div class="checkbox-visual checkbox-spring w-5 h-5 rounded-[4px] bg-surface-container-lowest border border-outline-variant/50 group-hover:border-primary flex items-center justify-center shadow-inner">
                    <span class="material-symbols-outlined text-[13px] text-on-primary font-bold opacity-0 transition-opacity">check</span>
                  </div>
                </label>
                <div class="task-content flex flex-col gap-1 min-w-0 flex-1">
                  <div class="task-meta flex items-center gap-2 flex-wrap">
                    <span class="track-tag {track_class} px-2 py-0.5 rounded font-label-caps text-[10px] font-bold uppercase tracking-wide border {badge_style}">{track_name} &bull; {duration}</span>
                    <span class="time-estimate-pill text-[11px] font-mono-metric-md text-on-surface-variant/70">⏱️ {duration}</span>
                    {defer_btn}
                  </div>
                  <div class="task-text font-body-md text-xs sm:text-[13px] text-on-surface transition-all leading-relaxed">{content_html}</div>
                </div>
              </div>
            </div>''')
            
        day_tasks_joined = "\n".join(tasks_html)
        
        if is_weekend:
            budget_badge = '<span class="px-2 py-0.5 rounded bg-primary/15 text-primary font-mono-metric-md text-[11px] border border-primary/30 font-semibold flex items-center gap-1"><span>⚡</span> 8.0h Deep Focus Lab</span>'
            deferred_box = f'<div class="weekend-deferred-container" data-day="{day["day_code"]}"></div>'
            card_html = f'''
            <div class="day-card rounded-xl cockpit-glass border border-primary/20 hover:border-primary/40 transition-all p-4 sm:p-5 flex flex-col gap-3.5 shadow-md" data-day="{day['day_code']}">
              <div class="flex items-center justify-between pb-3 border-b border-outline-variant/15">
                <div class="flex items-center gap-2.5">
                  <h3 class="text-base font-bold text-on-surface tracking-tight font-headline-sm">{day['day_name']}</h3>
                  {budget_badge}
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="day-progress font-mono-metric-md text-xs font-semibold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant border border-outline-variant/20">0 / {len(day['tasks'])} done</span>
                </div>
              </div>
              {deferred_box}
              <div class="tasks-list flex flex-col gap-2.5">
                {day_tasks_joined}
              </div>
            </div>'''
            weekend_cards.append(card_html)
        else:
            is_wed = day['day_code'] == 'Wed'
            wed_active_indicator = '<span class="h-2 w-2 rounded-full bg-primary animate-ping ml-1"></span>' if is_wed else ''
            card_border = 'border-primary/40' if is_wed else 'border-outline-variant/20'
            budget_badge = '<span class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono-metric-md text-[11px] border border-outline-variant/20">4.0h Budget</span>'
            card_html = f'''
            <div class="day-card rounded-xl cockpit-glass border {card_border} hover:border-primary/30 transition-all p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm" data-day="{day['day_code']}">
              <div class="flex items-center justify-between pb-3 border-b border-outline-variant/15">
                <div class="flex items-center gap-2.5">
                  <h3 class="text-base font-bold text-on-surface tracking-tight font-headline-sm flex items-center">
                    {day['day_name']}
                    {wed_active_indicator}
                  </h3>
                  {budget_badge}
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="day-progress font-mono-metric-md text-xs font-semibold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant border border-outline-variant/20">0 / {len(day['tasks'])} done</span>
                </div>
              </div>
              <div class="tasks-list flex flex-col gap-2.5">
                {day_tasks_joined}
              </div>
            </div>'''
            weekday_cards.append(card_html)

    weekday_cards_html = "\n".join(weekday_cards)
    weekend_cards_html = "\n".join(weekend_cards)

    # Deliverables section (if multiple or dedicated)
    deliverables_html = ""
    if week['deliverables'] and len(week['deliverables']) > 1:
        deliv_items = []
        for d in week['deliverables']:
            deliv_items.append(f'''
            <div class="deliverable-item group relative rounded-lg cockpit-subglass p-3 border border-outline-variant/20 hover:border-primary/40 transition-all flex items-start gap-3" data-task-id="{d['id']}">
              <label class="custom-checkbox shrink-0 mt-0.5 cursor-pointer">
                <input type="checkbox" class="task-checkbox" data-task-id="{d['id']}" style="display:none;">
                <div class="checkbox-visual checkbox-spring w-4 h-4 rounded-[3px] bg-surface-container-lowest border border-outline-variant/50 group-hover:border-primary flex items-center justify-center shadow-inner">
                  <span class="material-symbols-outlined text-[12px] text-on-primary font-bold opacity-0 transition-opacity">check</span>
                </div>
              </label>
              <div class="deliverable-text font-body-md text-xs text-on-surface leading-relaxed flex-1">{d['html']}</div>
            </div>''')
        deliv_joined = "\n".join(deliv_items)
        deliverables_html = f'''
        <div class="rounded-xl cockpit-glass border border-outline-variant/20 p-4 sm:p-5 flex flex-col gap-3">
          <div class="flex items-center gap-2 text-xs font-mono-metric-md font-bold text-primary uppercase tracking-wider">
            <span>🎯</span>
            <span>Detailed Weekly Checkpoints &amp; Milestones</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {deliv_joined}
          </div>
        </div>'''

    prev_link_btn = f'''<a href="{prev_w}" class="h-8 w-8 rounded-lg border border-outline-variant/30 hover:border-primary/50 cockpit-subglass flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all shrink-0 cursor-pointer" title="Previous Week (W{(w_num-1):02d})"><span class="material-symbols-outlined text-[18px]">chevron_left</span></a>''' if prev_w else '<span class="h-8 w-8 rounded-lg border border-outline-variant/15 opacity-40 cockpit-subglass flex items-center justify-center text-on-surface-variant/40 shrink-0"><span class="material-symbols-outlined text-[18px]">chevron_left</span></span>'
    next_link_btn = f'''<a href="{next_w}" class="h-8 w-8 rounded-lg border border-outline-variant/30 hover:border-primary/50 cockpit-subglass flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all shrink-0 cursor-pointer" title="Next Week (W{(w_num+1):02d})"><span class="material-symbols-outlined text-[18px]">chevron_right</span></a>''' if next_w else '<span class="h-8 w-8 rounded-lg border border-outline-variant/15 opacity-40 cockpit-subglass flex items-center justify-center text-on-surface-variant/40 shrink-0"><span class="material-symbols-outlined text-[18px]">chevron_right</span></span>'

    # Note hashtags
    tags = ["#LeetCode", f"#Week{w_pad}", "#Java", "#DSA", "#SpringAI"]
    note_tags_html = "".join([f'<span class="px-2.5 py-1 rounded-md bg-surface-container border border-outline-variant/20 font-mono-metric-md text-[11px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">{t}</span>' for t in tags])

    html_content = f'''<!DOCTYPE html>
<html class="dark" data-theme="dark" lang="en">
<head>
  <meta charset="utf-8">
  <meta content="width=device-width, initial-scale=1.0" name="viewport">
  <title>Week {w_pad} Checklist &bull; {week['title']} &bull; SK Cockpit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  {COMMON_TAILWIND_CONFIG}
  <link rel="stylesheet" href="../css/style.css">
</head>
<body class="bg-background font-body-md text-on-surface antialiased selection:bg-primary selection:text-on-primary min-h-screen relative overflow-x-hidden transition-colors duration-200 flex flex-col">

  <!-- Subtle Ambient Glow Overlay (Raycast/Linear aesthetic) -->
  <div class="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[850px] h-[340px] bg-gradient-to-b from-primary/10 via-primary/3 to-transparent blur-3xl -z-10 dark:opacity-70 opacity-30"></div>
  <div class="pointer-events-none fixed top-24 right-0 w-[420px] h-[350px] bg-tertiary/5 blur-3xl -z-10"></div>

  <!-- 1. Executive Top Header (Code 2 Architecture + Code 1 Color Palette) -->
  <header class="sticky top-0 z-50 w-full bg-surface/90 backdrop-blur-xl border-b border-outline-variant/20 dark:border-white/5 transition-colors">
    <div class="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      <!-- Brand & Identity -->
      <div class="flex items-center gap-4 shrink-0">
        <a href="../index.html" class="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant/30 hover:border-primary/50 cockpit-subglass text-xs font-mono-metric-md text-on-surface-variant hover:text-on-surface transition-all cursor-pointer">
          <span class="material-symbols-outlined text-[16px] group-hover:-translate-x-0.5 transition-transform text-on-surface-variant">arrow_back</span>
          <span class="font-medium hidden sm:inline">Back to Dashboard</span>
        </a>
        <div class="h-4 w-px bg-outline-variant/30 hidden md:block"></div>
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-mono-metric-md font-bold text-xs tracking-wider shadow-[0_0_12px_rgba(192,193,255,0.2)]">
            SK
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-on-surface tracking-tight font-headline-sm">COCKPIT</span>
              <span class="text-[10px] font-mono-metric-md uppercase px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-semibold border border-outline-variant/25">Phase {week['phase_num']}</span>
            </div>
            <p class="text-[11px] font-mono-metric-md text-on-surface-variant hidden sm:block">Swaraj Kanse &bull; B.E. AI&amp;DS &bull; TSEC</p>
          </div>
        </div>
      </div>

      <!-- Telemetry Status Badges -->
      <div class="flex items-center gap-2.5 sm:gap-3 shrink-0">
        <!-- Live T-Minus / Target Date -->
        <div class="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-md cockpit-subglass border border-outline-variant/20 text-xs font-mono-metric-md text-on-surface">
          <span class="text-on-surface-variant">Target:</span>
          <span class="text-primary font-medium">July 2027</span>
          <span class="text-outline-variant/60">&bull;</span>
          <span class="text-on-surface-variant" id="target-countdown-badge">T-Minus</span>
        </div>
        <!-- Streak Badge -->
        <div class="flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface-container border border-outline-variant/20 text-xs font-mono-metric-md text-on-surface">
          <span class="material-symbols-outlined text-[15px] text-error">local_fire_department</span>
          <span class="font-bold text-on-surface" id="streak-stat-badge">0d</span>
          <span class="hidden sm:inline text-on-surface-variant font-normal">Streak</span>
        </div>
        <!-- Cloud Sync Pill -->
        <div class="sync-badge saving flex items-center gap-1.5 px-2.5 py-1 rounded-md cockpit-subglass border border-outline-variant/20 text-[11px] font-mono-metric-md cursor-pointer hover:border-primary/40 transition-colors" title="Supabase Live Cloud Sync">
          <span class="h-2 w-2 rounded-full bg-primary animate-pulse sync-dot"></span>
          <span class="sync-text hidden md:inline text-on-surface-variant">Synced to Supabase</span>
          <span class="sync-text md:hidden text-on-surface-variant">Synced</span>
        </div>
        <!-- Theme Switcher -->
        <button type="button" class="p-1.5 rounded-lg border border-outline-variant/20 cockpit-subglass hover:border-primary/40 text-on-surface-variant hover:text-on-surface transition-all active:scale-95 cursor-pointer" onclick="AppState.toggleTheme()" title="Toggle Visual Theme" aria-label="Toggle Theme">
          <span class="material-symbols-outlined text-[18px]">dark_mode</span>
        </button>
      </div>
    </div>
  </header>

  <!-- 2. Sub-Navigation / Week Switcher & Executive Stats Ribbon -->
  <div class="w-full bg-surface-container-lowest/90 border-b border-outline-variant/20">
    <div class="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <!-- Week Switcher Strip -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
        {prev_link_btn}
        <!-- Phase Week Tabs -->
        <div class="flex items-center gap-1 bg-surface-container/80 p-1 rounded-lg border border-outline-variant/20 shrink-0 font-mono-metric-md text-xs">
          {phase_tabs_joined}
        </div>
        {next_link_btn}
        
        <!-- Jump to Week Dropdown -->
        <select id="week-select-dropdown" class="bg-surface-container border border-outline-variant/30 rounded-lg text-xs font-mono-metric-md text-on-surface px-2 py-1 focus:outline-none focus:border-primary cursor-pointer hidden sm:block" aria-label="Jump to any week">
          {select_html}
        </select>

        <div class="h-4 w-px bg-outline-variant/30 mx-1 hidden sm:block"></div>
        <div class="flex flex-col shrink-0">
          <span class="text-xs font-semibold text-on-surface tracking-tight flex items-center gap-1.5">
            Week {w_pad}: {week['title']}
          </span>
          <span class="text-[10px] font-mono-metric-md text-on-surface-variant">{week['phase_title']}</span>
        </div>
      </div>

      <!-- Execution Telemetry Summary & Action -->
      <div class="flex items-center gap-3 shrink-0 flex-wrap">
        <!-- Progress Counter -->
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg cockpit-subglass border border-outline-variant/20">
          <span class="text-xs font-mono-metric-md text-on-surface-variant">Tasks:</span>
          <span class="font-mono-metric-md text-sm font-bold text-on-surface" id="completed-count">0</span>
          <span class="font-mono-metric-md text-xs text-on-surface-variant" id="total-count">/ {total_tasks}</span>
          <span class="text-xs font-mono-metric-md font-semibold text-primary ml-0.5" id="progress-percent">(0%)</span>
          <div class="w-16 h-1.5 bg-surface-container-lowest rounded-full overflow-hidden ml-1.5 border border-outline-variant/20 hidden sm:block">
            <div class="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-300" id="progress-bar-fill" style="width: 0%;"></div>
          </div>
        </div>
        <!-- Budget Hours Tracker -->
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg cockpit-subglass border border-outline-variant/20 text-xs font-mono-metric-md">
          <span class="text-on-surface-variant hidden sm:inline">Allocated: <strong class="text-on-surface">36.0h</strong></span>
          <span class="text-outline-variant/60 hidden sm:inline">&bull;</span>
          <span class="text-primary font-semibold" id="logged-hours-label">Logged: 0.0h</span>
        </div>
        <!-- Copy Summary Button -->
        <button type="button" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-xs font-mono-metric-md font-medium text-on-surface transition-all shadow-sm active:scale-95 cursor-pointer" id="btn-copy-summary">
          <span class="material-symbols-outlined text-[15px]">content_copy</span>
          <span id="copy-btn-text">Copy Summary</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Main Workstation Layout -->
  <main class="flex-1 max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

    <!-- 3. Weekly Milestone Flight Checkpoint -->
    <div class="relative overflow-hidden rounded-xl cockpit-glass border border-primary/30 p-4 sm:p-5 shadow-lg shadow-black/20">
      <div class="absolute -right-8 -top-8 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div class="flex items-start gap-3.5">
          <div class="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shrink-0 shadow-inner">
            <span class="text-lg">🎯</span>
          </div>
          <div>
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="text-xs font-mono-metric-md font-bold uppercase tracking-wider text-primary">Flight Checkpoint &bull; W{w_pad} Deliverable</span>
              <span class="text-[11px] font-mono-metric-md px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-semibold">Priority 1 Target</span>
            </div>
            <div class="text-sm font-medium text-on-surface leading-relaxed">
              {deliv_text}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 self-start md:self-center">
          <div class="px-3 py-1.5 rounded-lg bg-surface-container-lowest/80 border border-outline-variant/20 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-tertiary">flag</span>
            <div class="flex flex-col text-left">
              <span class="text-[9px] font-mono-metric-md uppercase text-on-surface-variant">Artifact Gate</span>
              <span class="text-xs font-mono-metric-md font-bold text-on-surface">Weekly Milestone</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Filters & Budget Legend Strip -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
      <!-- Filter Chips -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none" id="filter-container">
        <button type="button" class="filter-btn track-filter-pill active-filter px-3 py-1.5 rounded-lg bg-primary/20 text-primary font-mono-metric-md text-xs font-semibold border border-primary/30 transition-all cursor-pointer" data-track="all">
          All ({total_tasks})
        </button>
        <button type="button" class="filter-btn track-filter-pill px-3 py-1.5 rounded-lg cockpit-glass hover:bg-surface-container-high text-on-surface-variant font-mono-metric-md text-xs font-medium border border-outline-variant/20 transition-all cursor-pointer" data-track="dsa">
          DSA &amp; Java ({dsa_count})
        </button>
        <button type="button" class="filter-btn track-filter-pill px-3 py-1.5 rounded-lg cockpit-glass hover:bg-surface-container-high text-on-surface-variant font-mono-metric-md text-xs font-medium border border-outline-variant/20 transition-all cursor-pointer" data-track="aiml">
          AI / ML ({aiml_count})
        </button>
        <button type="button" class="filter-btn track-filter-pill px-3 py-1.5 rounded-lg cockpit-glass hover:bg-surface-container-high text-on-surface-variant font-mono-metric-md text-xs font-medium border border-outline-variant/20 transition-all cursor-pointer" data-track="corecs">
          Core CS ({corecs_count})
        </button>
        <button type="button" class="filter-btn track-filter-pill px-3 py-1.5 rounded-lg cockpit-glass hover:bg-surface-container-high text-on-surface-variant font-mono-metric-md text-xs font-medium border border-outline-variant/20 transition-all cursor-pointer" data-track="backend">
          Aptitude &amp; Backend ({backend_count})
        </button>
      </div>
      <!-- Schedule Cadence Label -->
      <div class="flex items-center gap-2 text-xs font-mono-metric-md text-on-surface-variant self-end sm:self-center">
        <span class="material-symbols-outlined text-[15px] text-outline">tune</span>
        <span>Standard Cycle: Weekdays 4.0h &bull; Weekend 8.0h Lab</span>
      </div>
    </div>

    <!-- 4. Ultra-Clean Structured Day Schedule (2-Column Responsive Layout) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5" id="days-container">
      <!-- Weekday Cards (Monday to Friday, 4.0h each) -->
      {weekday_cards_html}

      <!-- Weekend Section Header / Divider spanning full width -->
      <div class="lg:col-span-2 flex items-center gap-3 py-2">
        <div class="h-px flex-1 bg-outline-variant/25"></div>
        <div class="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-xs font-mono-metric-md text-primary">
          <span>⚡</span>
          <span class="font-bold">Weekend High-Load Execution</span>
          <span class="text-primary/70">&bull; 8.0h Daily Deep Focus Lab</span>
        </div>
        <div class="h-px flex-1 bg-outline-variant/25"></div>
      </div>

      <!-- Weekend Cards (Saturday & Sunday, 8.0h each) -->
      {weekend_cards_html}
    </div>

    <!-- Optional Extended Deliverables Section -->
    {deliverables_html}

    <!-- 5. Reflection & Technical Notes Journal -->
    <div class="rounded-xl cockpit-glass border border-outline-variant/20 p-5 sm:p-6 flex flex-col gap-4 shadow-sm" id="journal">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-outline-variant/15">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-[18px]">terminal</span>
          </div>
          <div>
            <h3 class="text-sm font-bold text-on-surface tracking-tight font-headline-sm">Week {w_pad} Reflection &amp; Technical Notes</h3>
            <p class="text-[11px] font-mono-metric-md text-on-surface-variant">Persistent markdown workspace for algorithmic edge-cases &amp; training notes</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container border border-outline-variant/20 text-xs font-mono-metric-md text-on-surface-variant">
            <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span id="notes-save-status">Auto-saved to Supabase &bull; Live</span>
          </div>
        </div>
      </div>
      <div class="relative rounded-lg bg-surface-container-lowest border border-outline-variant/20 focus-within:border-primary/50 transition-colors p-3.5">
        <textarea class="w-full bg-transparent font-mono-metric-md text-xs text-on-surface leading-relaxed placeholder:text-on-surface-variant/50 focus:outline-none resize-none" id="week-notes" placeholder="Type Markdown notes, LeetCode edge-cases, system design takeaways, Kaggle validation scores..." rows="7"></textarea>
      </div>
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div class="flex flex-wrap items-center gap-1.5" id="notes-tags-container">
          {note_tags_html}
        </div>
        <button type="button" class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg cockpit-subglass hover:bg-surface-container-high border border-outline-variant/30 text-xs font-mono-metric-md text-on-surface transition-all self-end sm:self-auto cursor-pointer active:scale-95" id="export-notes-btn">
          <span class="material-symbols-outlined text-[15px] text-primary">download</span>
          <span>Export Markdown (.md)</span>
        </button>
      </div>
    </div>

    <!-- Bottom Navigation -->
    <nav class="flex items-center justify-between pt-2 pb-4">
      {prev_link_btn}
      <a href="../index.html" class="flex items-center gap-2 px-4 py-2 rounded-lg cockpit-subglass hover:bg-surface-container-high border border-outline-variant/25 text-xs font-mono-metric-md text-on-surface transition-all cursor-pointer">
        <span>&uarr;</span>
        <span>Back to Dashboard</span>
      </a>
      {next_link_btn}
    </nav>
  </main>

  <!-- 6. Executive Footer -->
  <footer class="w-full bg-surface-container-lowest/90 border-t border-outline-variant/20 py-4 mt-8">
    <div class="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono-metric-md text-xs text-on-surface-variant">
      <div class="flex items-center gap-2">
        <span class="font-semibold text-on-surface">Swaraj Kanse</span>
        <span class="text-outline-variant/60">&bull;</span>
        <span>Week {w_pad} Execution Protocol</span>
        <span class="text-outline-variant/60">&bull;</span>
        <span class="text-primary">Target July 2027</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        <span class="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">Supabase Synchronized</span>
      </div>
    </div>
  </footer>

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
        weeks = p_info['weeks']
        w_start = weeks[0]['week_num']
        w_end = weeks[-1]['week_num']
        
        # Build week cards for accordion
        week_tiles = []
        for w in weeks:
            num = w['week_num']
            padded = f"{num:02d}"
            title = w['title']
            task_count = sum(len(d['tasks']) for d in w['days'])
            
            week_tiles.append(f'''
            <a href="weeks/week-{padded}.html" class="p-3 rounded-lg cockpit-subglass flex flex-col justify-between hover:border-primary/50 transition-colors group cursor-pointer" id="dash-week-{num}">
              <div class="flex items-center justify-between mb-1.5">
                <span class="font-mono-metric-md text-[11px] text-on-surface font-semibold">WEEK {padded}</span>
                <span class="material-symbols-outlined text-[15px] text-outline-variant group-hover:text-primary transition-colors">arrow_forward</span>
              </div>
              <span class="text-xs text-on-surface font-medium truncate mb-2">{title}</span>
              <div class="flex items-center justify-between">
                <span class="font-mono-metric-md text-[10px] text-on-surface-variant week-task-count" id="dash-week-{num}-tasks">{task_count} Tasks</span>
                <span class="font-mono-metric-md text-[10px] text-primary font-bold week-pct" id="dash-week-{num}-pct">0%</span>
              </div>
            </a>''')

        weeks_grid_html = "\n".join(week_tiles)

        # Default expand Phase 1
        is_expanded = (p_num == 1)
        expanded_card_style = "border border-primary/40 bg-surface-container-low/95" if is_expanded else "cockpit-glass"
        content_class = "max-h-[800px] opacity-100 border-outline-variant/20" if is_expanded else "max-h-0 opacity-0 border-transparent"
        chevron_class = "rotate-180 text-primary" if is_expanded else "text-on-surface-variant"

        phases_html.append(f'''
        <div class="rounded-xl {expanded_card_style} overflow-hidden transition-all duration-200 phase-accordion-card shadow-sm" data-phase-card="{p_num}">
          <button type="button" class="phase-toggle w-full px-5 py-4 flex items-center justify-between text-left hover:bg-surface-container-high/40 transition-colors cursor-pointer" data-phase="{p_num}">
            <div class="flex items-center gap-3.5">
              <span class="w-6 h-6 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-primary shadow-sm font-mono-metric-md text-xs font-bold">
                {p_num:02d}
              </span>
              <div>
                <span class="font-label-caps text-[10px] text-primary font-bold uppercase tracking-wider block">Phase {p_num:02d} &bull; Weeks {w_start:02d}–{w_end:02d}</span>
                <h4 class="font-headline-sm text-sm sm:text-base font-semibold text-on-surface">{p_info['title']}</h4>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <span class="font-mono-metric-md text-xs font-semibold text-primary phase-status-pill" id="phase-{p_num}-status">0% ({len(weeks)} Weeks)</span>
              <span class="chevron-icon material-symbols-outlined text-[20px] transition-transform duration-200 {chevron_class}">expand_more</span>
            </div>
          </button>
          
          <div class="phase-content accordion-content {content_class} px-5 border-t text-xs text-on-surface-variant bg-surface-container-lowest/50">
            <div class="py-4 flex flex-col gap-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                {weeks_grid_html}
              </div>
            </div>
          </div>
        </div>''')

    all_phases_html = "\n".join(phases_html)

    html_content = f'''<!DOCTYPE html>
<html class="dark" data-theme="dark" lang="en">
<head>
  <meta charset="utf-8">
  <meta content="width=device-width, initial-scale=1.0" name="viewport">
  <title>ORBIT // Executive Cockpit &bull; 50-Week Placement Engineering</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  {COMMON_TAILWIND_CONFIG}
  <link rel="stylesheet" href="css/style.css">
</head>
<body class="bg-background font-body-md text-on-surface antialiased selection:bg-primary selection:text-on-primary min-h-screen relative overflow-x-hidden transition-colors duration-200">

  <!-- Subtle Ambient Glow Overlay (Raycast/Linear aesthetic) -->
  <div class="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[850px] h-[340px] bg-gradient-to-b from-primary/10 via-primary/3 to-transparent blur-3xl -z-10 dark:opacity-70 opacity-30"></div>
  <div class="pointer-events-none fixed top-24 right-0 w-[420px] h-[350px] bg-tertiary/5 blur-3xl -z-10"></div>

  <!-- Header Navigation -->
  <header class="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-md border-b border-outline-variant/20 dark:border-white/5 transition-colors">
    <div class="h-16 max-w-6xl mx-auto px-6 flex items-center justify-between gap-4">
      <!-- Brand & Mission Tag -->
      <div class="flex items-center gap-3 shrink-0">
        <div class="flex items-center gap-2 px-2.5 py-1 rounded bg-surface-container-low/90 border border-outline-variant/30 dark:border-white/10">
          <span class="font-headline-sm text-xs font-bold text-on-surface tracking-wide">Cockpit</span>
          <span class="text-[10px] font-mono-metric-md text-primary font-bold uppercase tracking-wider">50 WEEKS</span>
        </div>
      </div>

      <!-- Center Segmented Pill Navigation -->
      <nav class="flex items-center bg-surface-container-lowest/80 dark:bg-black/40 p-1 rounded-full border border-outline-variant/25 dark:border-white/10 shadow-inner">
        <a href="#today" data-path="today" class="nav-segmented-btn px-3.5 py-1 rounded-full text-xs font-semibold text-on-surface bg-surface-container-high transition-all shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.08)] cursor-pointer">Today</a>
        <a href="#roadmap" data-path="roadmap" class="nav-segmented-btn px-3.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition-colors text-xs font-medium cursor-pointer">Roadmap</a>
        <a href="#telemetry" data-path="telemetry" class="nav-segmented-btn px-3.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition-colors text-xs font-medium cursor-pointer">Telemetry</a>
        <a href="#schedule" data-path="schedule" class="nav-segmented-btn px-3.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition-colors text-xs font-medium cursor-pointer">Schedule</a>
      </nav>

      <!-- Right Vitals & Interactive Controls -->
      <div class="flex items-center gap-2.5 shrink-0">
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low/90 border border-outline-variant/20 dark:border-white/5">
          <span class="material-symbols-outlined text-[14px] text-error">local_fire_department</span>
          <span class="font-mono-metric-md text-xs font-semibold text-on-surface" id="streak-stat-badge">0d</span>
        </div>
        
        <!-- Cloud Sync Pill -->
        <div class="sync-badge saving flex items-center gap-1.5 px-2 py-1 cursor-pointer" title="Supabase Live Cloud Sync">
          <span class="h-2 w-2 rounded-full bg-primary animate-pulse sync-dot"></span>
        </div>

        <button type="button" class="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all active:scale-95 border border-transparent hover:border-outline-variant/20 flex items-center justify-center cursor-pointer" id="theme-toggle-btn" aria-label="Toggle visual theme">
          <span class="material-symbols-outlined text-[19px]" id="theme-icon">dark_mode</span>
        </button>
        
        <button type="button" class="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center hover:ring-2 ring-primary/30 transition-all shadow-sm cursor-pointer" aria-label="Executive Profile">
          <span class="font-mono-metric-md text-xs font-bold text-primary">SK</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Main Executive Console Content -->
  <main class="w-full pt-20 pb-16 min-h-screen">
    <div class="max-w-6xl mx-auto px-6">
      <div class="flex flex-col w-full gap-7">

        <!-- 1. Executive Vitals Bar (Hero Metrics) -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200">
            <div class="text-xs text-on-surface-variant font-medium mb-1">Target Countdown</div>
            <div class="font-mono-metric-lg text-2xl font-bold tracking-tight text-on-surface">
              <span id="vitals-countdown-val">487d</span> <span class="text-xs text-on-surface-variant font-normal">remaining</span>
            </div>
            <div class="mt-2 text-[11px] text-on-surface-variant">Target: July 2027 Drive</div>
          </div>

          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200">
            <div class="text-xs text-on-surface-variant font-medium mb-1">Consistency</div>
            <div class="font-mono-metric-lg text-2xl font-bold text-on-surface">
              <span id="streak-current-val">0</span> <span class="text-xs text-on-surface-variant font-normal">days</span>
            </div>
            <div class="mt-2 text-[11px] text-on-surface-variant">Active consecutive streak</div>
          </div>

          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200">
            <div class="text-xs text-on-surface-variant font-medium mb-1">Overall Progress</div>
            <div class="font-mono-metric-lg text-2xl font-bold text-on-surface tracking-tight" id="stat-pct-done">0.0%</div>
            <div class="w-full h-1 rounded-full bg-surface-container overflow-hidden mt-3">
              <div class="h-full bg-primary rounded-full transition-all duration-500" id="global-progress-bar" style="width: 0%"></div>
            </div>
          </div>

          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200">
            <div class="text-xs text-on-surface-variant font-medium mb-1">Focus Time</div>
            <div class="font-mono-metric-lg text-2xl font-bold text-on-surface" id="vitals-logged-hours">0.0h</div>
            <div class="mt-2 text-[11px] text-on-surface-variant" id="stat-tasks-done-sub">0 tasks completed</div>
          </div>
        </section>

        <!-- 2. Today's Execution Queue (Immediate Priority Workspace) -->
        <section class="rounded-xl cockpit-glass overflow-hidden shadow-xl" id="today">
          <!-- Queue Header Bar -->
          <div class="px-5 py-4 border-b border-outline-variant/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest/50">
            <div class="flex items-center gap-3">
              <h2 class="font-headline-sm text-base font-semibold text-on-surface">Today</h2>
              <span class="text-outline-variant/40">&bull;</span>
              <span class="text-xs text-on-surface-variant" id="today-day-title">Loading schedule...</span>
              <span class="px-2 py-0.5 rounded bg-surface-container text-primary font-mono-metric-md text-[11px] border border-outline-variant/20" id="today-budget-pill">⏱️ 4h Budget</span>
            </div>
            <div class="flex items-center gap-3">
              <select id="today-day-picker" class="bg-surface-container border border-outline-variant/30 rounded-lg text-xs font-mono-metric-md text-on-surface px-2.5 py-1 focus:outline-none focus:border-primary cursor-pointer" aria-label="Switch Active Day"></select>
              <a href="weeks/week-01.html" id="today-open-week-link" class="text-xs font-mono-metric-md text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                <span>Open Week</span> &rarr;
              </a>
              <div class="flex items-center gap-2 text-on-surface-variant font-mono-metric-md text-xs pl-2 border-l border-outline-variant/20">
                <span class="text-on-surface font-semibold" id="queue-completed-counter">0</span> of <span id="queue-total-counter">0</span> completed
                <span class="text-primary text-[11px] font-semibold ml-1" id="queue-percent">0%</span>
              </div>
            </div>
          </div>

          <!-- Micro Progress Bar for Execution Queue -->
          <div class="w-full bg-surface-container h-1 overflow-hidden">
            <div class="h-full bg-primary transition-all duration-300 ease-out" id="queue-progress-bar" style="width: 0%"></div>
          </div>

          <!-- Task List dynamically rendered -->
          <div class="divide-y divide-outline-variant/10 text-body-md" id="today-tasks-list">
            <!-- Dynamic task items injected by app.js -->
          </div>
        </section>

        <!-- 3. Subsystem Workload Distribution (Balance & Burn Velocity) -->
        <section class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs uppercase tracking-wider text-on-surface-variant font-medium">Workload Balance</h3>
            <span class="text-xs text-on-surface-variant" id="workload-summary-label">Across 50 Weeks</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-xl cockpit-glass">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium text-on-surface">DSA &amp; Java</span>
                <span class="font-mono-metric-md text-xs text-on-surface-variant" id="workload-dsa-pct">35%</span>
              </div>
              <div class="w-full h-1 rounded-full bg-surface-container overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-300" id="workload-dsa-bar" style="width: 35%"></div>
              </div>
            </div>

            <div class="p-3.5 rounded-xl cockpit-glass">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium text-on-surface">Applied AI &amp; ML</span>
                <span class="font-mono-metric-md text-xs text-on-surface-variant" id="workload-aiml-pct">30%</span>
              </div>
              <div class="w-full h-1 rounded-full bg-surface-container overflow-hidden">
                <div class="h-full bg-tertiary rounded-full transition-all duration-300" id="workload-aiml-bar" style="width: 30%"></div>
              </div>
            </div>

            <div class="p-3.5 rounded-xl cockpit-glass">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium text-on-surface">Core CS</span>
                <span class="font-mono-metric-md text-xs text-on-surface-variant" id="workload-corecs-pct">20%</span>
              </div>
              <div class="w-full h-1 rounded-full bg-surface-container overflow-hidden">
                <div class="h-full bg-secondary rounded-full transition-all duration-300" id="workload-corecs-bar" style="width: 20%"></div>
              </div>
            </div>

            <div class="p-3.5 rounded-xl cockpit-glass">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium text-on-surface">Backend &amp; Aptitude</span>
                <span class="font-mono-metric-md text-xs text-on-surface-variant" id="workload-backend-pct">15%</span>
              </div>
              <div class="w-full h-1 rounded-full bg-surface-container overflow-hidden">
                <div class="h-full bg-surface-container-high rounded-full transition-all duration-300" id="workload-backend-bar" style="width: 15%"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- 4. 50-Week Execution Cadence (Heatmap Matrix with interactive subsystem filters) -->
        <section class="p-5 rounded-xl cockpit-glass flex flex-col gap-4 shadow-xl" id="telemetry">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <h3 class="font-headline-sm text-base font-semibold text-on-surface">Activity</h3>
              <span class="text-xs text-on-surface-variant" id="tooltip-text">Hover any node to inspect execution load &amp; track distribution</span>
            </div>
            <div class="flex items-center gap-1.5 overflow-x-auto py-0.5 text-xs" id="heatmap-filter-group">
              <button type="button" class="heatmap-filter px-3 py-1 rounded-full text-on-surface bg-surface-container-high border border-outline-variant/40 font-mono-metric-md text-[11px] font-medium shadow-sm transition-all cursor-pointer" data-filter="all">All</button>
              <button type="button" class="heatmap-filter px-3 py-1 rounded-full text-on-surface-variant hover:text-on-surface bg-transparent font-mono-metric-md text-[11px] transition-all cursor-pointer" data-filter="dsa">DSA</button>
              <button type="button" class="heatmap-filter px-3 py-1 rounded-full text-on-surface-variant hover:text-on-surface bg-transparent font-mono-metric-md text-[11px] transition-all cursor-pointer" data-filter="aiml">AI/ML</button>
              <button type="button" class="heatmap-filter px-3 py-1 rounded-full text-on-surface-variant hover:text-on-surface bg-transparent font-mono-metric-md text-[11px] transition-all cursor-pointer" data-filter="corecs">Core CS</button>
              <button type="button" class="heatmap-filter px-3 py-1 rounded-full text-on-surface-variant hover:text-on-surface bg-transparent font-mono-metric-md text-[11px] transition-all cursor-pointer" data-filter="backend">Backend</button>
            </div>
          </div>

          <!-- Matrix Display (50 Weeks x 7 Days Grid Representation) -->
          <div class="overflow-x-auto pb-2 relative">
            <div class="min-w-[800px] flex flex-col gap-1.5">
              <!-- Month / Phase Markers Bar -->
              <div class="flex text-[10px] font-mono-metric-md text-on-surface-variant/65 pl-6 mb-1 justify-between pr-2">
                <span>W01 (Jul)</span>
                <span>W06 (Aug)</span>
                <span>W11 (Sep)</span>
                <span class="text-primary font-bold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  W14 (Current)
                </span>
                <span>W20 (Nov)</span>
                <span>W26 (Dec)</span>
                <span>W34 (Feb)</span>
                <span>W42 (Apr)</span>
                <span>W50 (Jun 2027)</span>
              </div>

              <!-- Heatmap Columns container -->
              <div class="flex gap-2 items-center">
                <div class="flex flex-col gap-1 text-[9px] font-mono-metric-md text-on-surface-variant/60 w-5 shrink-0 select-none">
                  <span>M</span>
                  <span>W</span>
                  <span>F</span>
                  <span>S</span>
                </div>
                <!-- Week Cells dynamically rendered via JS -->
                <div class="grid grid-flow-col grid-rows-7 gap-1 flex-1" id="heatmap-grid">
                  <!-- Populated dynamically by app.js -->
                </div>
              </div>
            </div>
          </div>

          <!-- Heatmap Footer Metrics -->
          <div class="pt-3 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant">
            <div class="text-xs text-on-surface-variant">50-week execution matrix</div>
            <div class="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <span>Less</span>
              <span class="w-2.5 h-2.5 rounded-[2px] bg-surface-container"></span>
              <span class="w-2.5 h-2.5 rounded-[2px] bg-primary/25"></span>
              <span class="w-2.5 h-2.5 rounded-[2px] bg-primary/50"></span>
              <span class="w-2.5 h-2.5 rounded-[2px] bg-primary"></span>
              <span>More</span>
            </div>
          </div>
        </section>

        <!-- 5. Daily Time Allocation & Schedule Protocol Banner -->
        <section class="p-5 rounded-xl cockpit-glass flex flex-col gap-3.5 shadow-sm" id="schedule">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-lg">⏱️</span>
              <h3 class="font-headline-sm text-base font-semibold text-on-surface">Daily Time Allocation Protocol</h3>
            </div>
            <span class="px-2.5 py-1 rounded bg-primary/20 text-primary font-mono-metric-md text-xs font-bold border border-primary/30">36 Hours / Week Total</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div class="p-4 rounded-lg cockpit-subglass border border-outline-variant/20 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="font-headline-sm text-xs font-bold text-on-surface uppercase tracking-wide">📅 Weekdays (Mon &ndash; Fri)</span>
                <span class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono-metric-md text-[11px]">4.0 hrs / day</span>
              </div>
              <ul class="text-xs text-on-surface-variant space-y-1.5 pt-1">
                <li class="flex items-start gap-2">
                  <span class="font-mono-metric-md font-bold text-primary shrink-0">1.5h</span>
                  <span><strong>DSA (Java)</strong> &bull; Problem reps &amp; Striver TUF+ sheet topics</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="font-mono-metric-md font-bold text-primary shrink-0">2.5h</span>
                  <span><strong>Core Focus</strong> &bull; Applied AI/ML (Mon/Wed/Fri) or Core CS (Tue/Thu)</span>
                </li>
              </ul>
            </div>

            <div class="p-4 rounded-lg cockpit-subglass border border-primary/30 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="font-headline-sm text-xs font-bold text-primary uppercase tracking-wide">⚡ Weekends (Sat &ndash; Sun)</span>
                <span class="px-2 py-0.5 rounded bg-primary/20 text-primary font-mono-metric-md text-[11px] font-bold">8.0 hrs / day</span>
              </div>
              <ul class="text-xs text-on-surface-variant space-y-1.5 pt-1">
                <li class="flex items-start gap-2">
                  <span class="font-mono-metric-md font-bold text-primary shrink-0">1.5h</span>
                  <span><strong>DSA (Java)</strong> &bull; Weekly contest problems, revision &amp; hard drills</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="font-mono-metric-md font-bold text-primary shrink-0">2.5h</span>
                  <span><strong>Aptitude / Backend</strong> &bull; Quant, Logical, Verbal mocks or Spring Boot</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="font-mono-metric-md font-bold text-primary shrink-0">4.0h</span>
                  <span><strong>AI/ML Hands-On Lab</strong> &bull; Kaggle, scratch code, papers &amp; projects</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- 6. 10-Phase Placement Roadmap (Quiet Accordion Architecture) -->
        <section class="flex flex-col gap-3" id="roadmap">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="font-headline-sm text-base font-semibold text-on-surface">10-Phase Placement Roadmap</h3>
            </div>
            <span class="text-xs text-on-surface-variant">50 Weeks &bull; Full Curriculum</span>
          </div>

          <div class="flex flex-col gap-2.5" id="roadmap-accordion">
            {all_phases_html}
          </div>
        </section>

      </div>
    </div>
  </main>

  <!-- Executive Footer -->
  <footer class="w-full border-t border-outline-variant/20 dark:border-white/5 bg-surface-container-lowest/90 backdrop-blur-md py-6 transition-colors">
    <div class="max-w-6xl mx-auto px-6 flex items-center justify-between text-on-surface-variant text-xs font-mono-metric-md">
      <div>Swaraj Kanse &bull; B.E. AI&amp;DS, TSEC</div>
      <div>Target July 2027 &bull; Supabase Synchronized</div>
    </div>
  </footer>

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
