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
        return f'<a href="{url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-medium">{label}</a>'
    
    text = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', link_repl, text)
    
    # 3. Convert raw URLs not already in href
    def raw_url_repl(m):
        url = m.group(0)
        full_url = url if url.startswith('http') else 'https://' + url
        display_label = "Resource"
        if "youtube.com" in url or "youtu.be" in url:
            display_label = "YouTube"
        elif "cs50.harvard.edu" in url:
            display_label = "CS50"
        elif "leetcode.com" in url:
            display_label = "LeetCode"
        elif "arxiv.org" in url:
            display_label = "Paper"
        trailing = ""
        while full_url and full_url[-1] in '.,;:)\"`\'':
            trailing = full_url[-1] + trailing
            full_url = full_url[:-1]
            url = url[:-1]
        return f'<a href="{full_url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-medium">[{display_label}]</a>{trailing}'

    bare_url_regex = r'(?<!href=")(?<!">)(?:https?://[^\s<>`"\)]+|(?:youtube\.com|cs50\.harvard\.edu|khanacademy\.org|arxiv\.org|immersivemath\.com|course\.fast\.ai|modelcontextprotocol\.io|docs\.spring\.io|docs\.langchain4j\.dev|developer\.confluent\.io|testcontainers\.com|docs\.ragas\.io|huggingface\.co|baeldung\.com)[^\s<>`"\)]*)'
    text = re.sub(bare_url_regex, raw_url_repl, text)
    
    # 4. Bold: **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong class="text-on-surface font-semibold">\1</strong>', text)
    
    # 5. Italic: *text*
    text = re.sub(r'(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    
    # 6. Inline code: `code`
    text = re.sub(r'`([^`]+)`', r'<code class="px-1 py-0.5 rounded bg-surface-container font-mono text-[11px] text-primary border border-white/5">\1</code>', text)
    
    return text

def clean_urls_and_sources(text):
    if not text:
        return ""
    # Replace long youtube links with clean [YouTube] or [Playlist]
    t = re.sub(r'\(https?://(?:www\.)?youtube\.com/[^\s)]+\)', ' [YouTube]', text)
    t = re.sub(r'\(https?://(?:www\.)?youtu\.be/[^\s)]+\)', ' [YouTube]', t)
    t = re.sub(r'\(youtube\.com/[^\s)]+\)', ' [YouTube]', t)
    # Clean other markdown links: [Text](url) -> [Text]
    t = re.sub(r'\[([^\]]+)\]\(https?://[^\s)]+\)', r'[\1]', t)
    # Clean bare urls
    t = re.sub(r'https?://[^\s)]+', '', t)
    # Clean up double spaces or awkward punctuation
    t = re.sub(r'\s{2,}', ' ', t).strip()
    return t

def parse_task_content(cell_text):
    if not cell_text:
        return {"ref": "", "title": "", "desc": ""}
    
    raw = cell_text.strip()
    clean = clean_urls_and_sources(raw)
    
    ref = ""
    title = ""
    desc = ""
    
    # 1. Check for LeetCode reference
    lc_match = re.search(r'(?:LeetCode|LC)\s*#?([0-9,\s#&and]+)', clean, re.IGNORECASE)
    if lc_match:
        ref = f"LeetCode #{lc_match.group(1).strip()}"
    
    # 2. Check for **Bold Prefix** — Content
    m_bold = re.match(r'^\*\*([^*]+)\*\*\s*[:—–-]\s*(.+)$', clean)
    if m_bold:
        prefix = m_bold.group(1).strip()
        rest = m_bold.group(2).strip()
        
        is_course_ref = bool(re.search(r'(?:CS50P|Corey Schafer|3Blue1Brown|Quant|Verbal|Logical|TUF|Module|PSet|Week|Ep\.)', prefix, re.IGNORECASE))
        
        if is_course_ref:
            if not ref:
                ref = prefix
            if ' + ' in rest and len(rest) > 50:
                parts = rest.split(' + ', 1)
                title = parts[0].strip()
                desc = parts[1].strip()
            elif ' — ' in rest or ' – ' in rest:
                parts = re.split(r'\s*[—–]\s*', rest, maxsplit=1)
                title = parts[0].strip()
                desc = parts[1].strip()
            else:
                title = rest
                desc = ""
        else:
            title = prefix
            desc = rest
            if not ref:
                m_sub = re.match(r'^\*\*([^*]+)\*\*\s*[:—–-]?\s*(.*)$', rest)
                if m_sub:
                    ref = m_sub.group(1).strip()
                    desc = m_sub.group(2).strip()
    elif ' — ' in clean or ' – ' in clean:
        parts = re.split(r'\s*[—–]\s*', clean, maxsplit=1)
        title = re.sub(r'\*\*([^*]+)\*\*', r'\1', parts[0].strip())
        desc = parts[1].strip()
    elif ' + ' in clean and len(clean) > 60:
        parts = clean.split(' + ', 1)
        title = re.sub(r'\*\*([^*]+)\*\*', r'\1', parts[0].strip())
        desc = parts[1].strip()
    else:
        title = re.sub(r'\*\*([^*]+)\*\*', r'\1', clean)
        desc = ""
        
    title = re.sub(r'\*\*([^*]+)\*\*', r'\1', title).strip()
    
    yt_m = re.search(r'\((?:freeCodeCamp\.org|YouTube|youtube)[^)]+\)', title)
    if yt_m:
        yt_note = yt_m.group(0).strip('()')
        title = title[:yt_m.start()].strip() + title[yt_m.end():].strip()
        if desc:
            desc = f"{desc} • {yt_note}"
        else:
            desc = yt_note
            
    title = re.sub(r'\s{2,}', ' ', title).strip()
    title = title.rstrip(' :—–-')
    
    if not title:
        title = clean[:60]
        
    return {
        "ref": ref,
        "title": format_cell_html(title),
        "desc": format_cell_html(desc) if desc else ""
    }

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
                    
                    parsed = parse_task_content(cell_trimmed)
                    
                    if cell_trimmed.lower() in ['rest', 'catch up', 'rest / catch up', 'open — catch up']:
                        day_tasks.append({
                            'id': task_id,
                            'track_original': col_meta[idx]['original'],
                            'track_id': col_meta[idx]['cat_id'],
                            'track_name': col_meta[idx]['cat_name'],
                            'raw_text': cell_trimmed,
                            'ref': '',
                            'title': 'Rest / Catch up',
                            'desc': '',
                            'html': '<em>Rest / Catch up</em>',
                            'is_rest': True
                        })
                    else:
                        day_tasks.append({
                            'id': task_id,
                            'track_original': col_meta[idx]['original'],
                            'track_id': col_meta[idx]['cat_id'],
                            'track_name': col_meta[idx]['cat_name'],
                            'raw_text': cell_trimmed,
                            'ref': parsed['ref'],
                            'title': parsed['title'],
                            'desc': parsed['desc'],
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
            "surface-dim": "#121316",
            "surface": "#121316",
            "background": "#121316",
            "surface-container-lowest": "#0d0e11",
            "surface-container-low": "#1b1b1f",
            "surface-container": "#1f1f23",
            "surface-container-high": "#292a2d",
            "surface-container-highest": "#343538",
            "on-surface": "#e3e2e6",
            "on-surface-variant": "#c7c4d7",
            "outline-variant": "#464554",
            "outline": "#908fa0",
            "primary": "#c0c1ff",
            "primary-container": "#8083ff",
            "on-primary": "#1000a9",
            "tertiary": "#b9c8de",
            "secondary": "#c1c7cf",
            "error": "#ffb4ab"
          },
          borderRadius: {
            "DEFAULT": "0.25rem",
            "lg": "0.5rem",
            "xl": "0.75rem",
            "full": "9999px"
          },
          fontFamily: {
            "headline": ["Space Grotesk", "Plus Jakarta Sans", "sans-serif"],
            "body": ["Inter", "sans-serif"],
            "mono": ["JetBrains Mono", "monospace"]
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

    # Calculate track counts
    total_tasks = sum(len(d['tasks']) for d in week['days'])
    dsa_count = sum(sum(1 for t in d['tasks'] if t['track_id'] == 'dsa') for d in week['days'])
    aiml_count = sum(sum(1 for t in d['tasks'] if t['track_id'] == 'aiml') for d in week['days'])
    corecs_count = sum(sum(1 for t in d['tasks'] if t['track_id'] == 'corecs') for d in week['days'])
    backend_count = sum(sum(1 for t in d['tasks'] if t['track_id'] in ['aptitude', 'backend']) for d in week['days'])

    # Weekly Deliverable text
    if week['deliverables']:
        deliv_text = "<br>".join([d['html'] for d in week['deliverables']])
    else:
        deliv_text = f"Complete all scheduled DSA problem reps, AI/ML theory and implementations, and Core CS modules for Week {w_pad}."

    # Days HTML: Weekdays vs Weekend
    weekday_cards = []
    weekend_cards = []

    for day in week['days']:
        tasks_html = []
        is_weekend = day['day_code'] in ['Sat', 'Sun']
        for t in day['tasks']:
            task_id = t['id']
            track_class = t['track_id']
            track_name = t['track_name']
            ref = t.get('ref', '')
            title = t.get('title', '')
            desc = t.get('desc', '')
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

            ref_badge = f'<span class="font-mono text-[11px] text-slate-400">{ref}</span>' if ref else ''
            desc_html = f'<p class="task-desc text-xs text-slate-400 leading-relaxed mt-0.5">{desc}</p>' if desc else ''
            defer_btn = f'''<button type="button" class="btn-defer shrink-0 p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer" data-task-id="{task_id}" title="Defer to Weekend Lab"><span class="material-symbols-outlined text-[16px]">more_vert</span></button>''' if not is_weekend else ''

            tasks_html.append(f'''
            <div class="task-card group relative rounded-lg bg-surface-container p-3.5 border border-white/[0.06] hover:border-white/15 transition-all flex items-start justify-between gap-3 {rest_class}" data-completed="false" data-hours="{duration.replace('h','')}" data-task-id="{task_id}" data-track="{track_class}">
              <div class="flex items-start gap-3 min-w-0 flex-1">
                <button aria-label="Toggle task" class="task-toggle-btn task-checkbox mt-0.5 h-5 w-5 rounded border border-white/20 hover:border-white/40 bg-white/5 flex items-center justify-center shrink-0 transition-colors cursor-pointer" data-task-id="{task_id}" type="button">
                  <span class="material-symbols-outlined text-[14px] opacity-0 text-white font-bold">check</span>
                </button>
                <div class="flex flex-col gap-1 min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 rounded font-mono text-[11px] font-semibold tracking-wide border {badge_style}">{track_name} &bull; {duration}</span>
                    {ref_badge}
                  </div>
                  <p class="task-title text-sm font-medium text-slate-200 transition-all leading-snug">{title}</p>
                  {desc_html}
                </div>
              </div>
              {defer_btn}
            </div>''')
            
        day_tasks_joined = "\n".join(tasks_html)
        
        if is_weekend:
            budget_badge = '<span class="px-2.5 py-0.5 rounded bg-primary/15 text-primary font-mono text-[11px] border border-primary/30 font-semibold flex items-center gap-1"><span>⚡</span> 8.0h Deep Focus Lab</span>'
            deferred_box = f'<div class="weekend-deferred-container" data-day="{day["day_code"]}"></div>'
            card_html = f'''
            <div class="day-card rounded-xl bg-surface-container-low border border-primary/20 hover:border-primary/35 transition-all p-4 sm:p-5 flex flex-col gap-3.5 shadow-md" data-day="{day['day_code']}">
              <div class="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div class="flex items-center gap-2.5">
                  <h3 class="text-base font-bold text-white tracking-tight">{day['day_name']}</h3>
                  {budget_badge}
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="day-badge day-progress px-2 py-0.5 rounded font-mono text-xs font-semibold bg-white/[0.05] text-slate-400 border border-white/10">0 / {len(day['tasks'])} done</span>
                </div>
              </div>
              {deferred_box}
              <div class="flex flex-col gap-2.5">
                {day_tasks_joined}
              </div>
            </div>'''
            weekend_cards.append(card_html)
        else:
            budget_badge = '<span class="px-2 py-0.5 rounded bg-white/[0.06] text-slate-400 font-mono text-[11px] border border-white/[0.06]">4.0h Budget</span>'
            card_html = f'''
            <div class="day-card rounded-xl bg-surface-container-low border border-white/[0.08] hover:border-white/[0.14] transition-all p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm" data-day="{day['day_code']}">
              <div class="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div class="flex items-center gap-2.5">
                  <h3 class="text-base font-bold text-white tracking-tight">{day['day_name']}</h3>
                  {budget_badge}
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="day-badge day-progress px-2 py-0.5 rounded font-mono text-xs font-semibold bg-white/[0.05] text-slate-400 border border-white/10">0 / {len(day['tasks'])} done</span>
                </div>
              </div>
              <div class="flex flex-col gap-2.5">
                {day_tasks_joined}
              </div>
            </div>'''
            weekday_cards.append(card_html)

    weekday_cards_html = "\n".join(weekday_cards)
    weekend_cards_html = "\n".join(weekend_cards)

    prev_btn = f'''<a href="{prev_w}" class="h-8 w-8 rounded-lg border border-white/[0.08] hover:border-white/20 bg-surface-container-low flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0" title="Previous Week (W{(w_num-1):02d})"><span class="material-symbols-outlined text-[18px]">chevron_left</span></a>''' if prev_w else '<span class="h-8 w-8 rounded-lg border border-white/[0.06] opacity-40 bg-surface-container-low flex items-center justify-center text-slate-600 shrink-0"><span class="material-symbols-outlined text-[18px]">chevron_left</span></span>'
    next_btn = f'''<a href="{next_w}" class="h-8 w-8 rounded-lg border border-white/[0.08] hover:border-white/20 bg-surface-container-low flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0" title="Next Week (W{(w_num+1):02d})"><span class="material-symbols-outlined text-[18px]">chevron_right</span></a>''' if next_w else '<span class="h-8 w-8 rounded-lg border border-white/[0.06] opacity-40 bg-surface-container-low flex items-center justify-center text-slate-600 shrink-0"><span class="material-symbols-outlined text-[18px]">chevron_right</span></span>'

    html_content = f'''<!DOCTYPE html>
<html class="dark" data-theme="dark" lang="en">
<head>
  <meta charset="utf-8">
  <meta content="width=device-width, initial-scale=1.0" name="viewport">
  <title>Week {w_pad} Execution &bull; SK Cockpit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  {COMMON_TAILWIND_CONFIG}
  <link rel="stylesheet" href="../css/style.css">
</head>
<body class="bg-surface font-sans text-slate-200 antialiased min-h-screen flex flex-col selection:bg-primary/30 selection:text-primary">

  <!-- 1. Executive Top Header (Code 2 Exact Architecture) -->
  <header class="sticky top-0 z-50 w-full bg-[#080B10]/90 backdrop-blur-xl border-b border-white/[0.08]">
    <div class="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      <!-- Brand & Identity -->
      <div class="flex items-center gap-4 shrink-0">
        <a href="../index.html" class="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/20 bg-surface-container-low hover:bg-surface-container transition-all text-xs font-mono text-slate-300">
          <span class="material-symbols-outlined text-[16px] group-hover:-translate-x-0.5 transition-transform text-slate-400">arrow_back</span>
          <span class="font-medium hidden sm:inline">Back to Dashboard</span>
        </a>
        <div class="h-4 w-px bg-white/10 hidden md:block"></div>
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-mono font-bold text-xs tracking-wider shadow-[0_0_12px_rgba(192,193,255,0.2)]">
            SK
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-white tracking-tight">COCKPIT</span>
              <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 font-semibold border border-white/[0.06]">Phase {week['phase_num']}</span>
            </div>
            <p class="text-[11px] font-mono text-slate-400 hidden sm:block">Swaraj Kanse &bull; B.E. AI&amp;DS</p>
          </div>
        </div>
      </div>

      <!-- Telemetry Status Badges -->
      <div class="flex items-center gap-2.5 sm:gap-3 shrink-0">
        <div class="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface-container-low border border-white/[0.08] text-xs font-mono text-slate-300">
          <span class="text-slate-500">Target:</span>
          <span class="text-primary font-medium">July 2027</span>
          <span class="text-slate-600">&bull;</span>
          <span class="text-slate-400" id="target-countdown-badge">T-Minus</span>
        </div>
        <div class="flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface-container-low border border-white/[0.08] text-xs font-mono text-amber-300">
          <span class="text-xs">🔥</span>
          <span class="font-semibold" id="streak-stat-badge">0d</span>
          <span class="hidden sm:inline text-amber-400/80 font-normal">Streak</span>
        </div>
        <div class="sync-badge saving flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container-low border border-white/[0.08] text-[11px] font-mono text-emerald-300 cursor-pointer">
          <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse sync-dot"></span>
          <span class="hidden md:inline sync-text">Synced to Supabase</span>
          <span class="md:hidden sync-text">Synced</span>
        </div>
        <button type="button" class="p-1.5 rounded-md border border-white/[0.08] bg-surface-container-low hover:bg-surface-container text-slate-400 hover:text-white transition-colors cursor-pointer" onclick="AppState.toggleTheme()" title="Toggle Visual Theme">
          <span class="material-symbols-outlined text-[18px]">dark_mode</span>
        </button>
      </div>
    </div>
  </header>

  <!-- 2. Sub-Navigation / Week Switcher & Executive Stats Ribbon -->
  <div class="w-full bg-[#0B0F16] border-b border-white/[0.08]">
    <div class="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <!-- Week Switcher Strip -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
        {prev_btn}
        <div class="flex items-center gap-1 bg-surface-container-low/80 p-1 rounded-lg border border-white/[0.06] shrink-0 font-mono text-xs">
          {phase_tabs_joined}
        </div>
        {next_btn}
        <div class="h-4 w-px bg-white/10 mx-1 hidden sm:block"></div>
        <div class="flex flex-col shrink-0">
          <span class="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
            Week {w_pad}: {week['title']}
          </span>
          <span class="text-[10px] font-mono text-slate-400">{week['phase_title']}</span>
        </div>
      </div>

      <!-- Execution Telemetry Summary & Action -->
      <div class="flex items-center gap-3 shrink-0 flex-wrap">
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low border border-white/[0.08]">
          <span class="text-xs font-mono text-slate-400">Tasks:</span>
          <span class="font-mono text-sm font-bold text-white" id="completed-count">0</span>
          <span class="font-mono text-xs text-slate-500" id="total-count">/ {total_tasks}</span>
          <span class="text-xs font-mono font-semibold text-primary ml-0.5" id="progress-percent">(0%)</span>
          <div class="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden ml-1.5 border border-white/10 hidden sm:block">
            <div class="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-300" id="progress-bar-fill" style="width: 0%;"></div>
          </div>
        </div>
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low border border-white/[0.08] text-xs font-mono">
          <span class="text-slate-400 hidden sm:inline">Allocated: <strong class="text-slate-200">36.0h</strong></span>
          <span class="text-slate-600 hidden sm:inline">&bull;</span>
          <span class="text-emerald-400 font-semibold" id="logged-hours-label">Logged: 0.0h</span>
        </div>
        <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-mono font-medium text-white transition-all shadow-sm active:scale-95 cursor-pointer" id="copy-summary-btn" type="button">
          <span class="material-symbols-outlined text-[15px]">content_copy</span>
          <span id="copy-btn-text">Copy Summary</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Main Workstation Layout -->
  <main class="flex-1 max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

    <!-- 3. Weekly Milestone Flight Checkpoint -->
    <div class="relative overflow-hidden rounded-xl bg-surface-container-low border border-primary/30 p-4 sm:p-5 shadow-lg shadow-black/30">
      <div class="absolute -right-8 -top-8 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div class="flex items-start gap-3.5">
          <div class="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shrink-0 shadow-inner">
            <span class="text-lg">🎯</span>
          </div>
          <div>
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="text-xs font-mono font-bold uppercase tracking-wider text-primary">Flight Checkpoint &bull; W{w_pad} Deliverable</span>
              <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-semibold">Priority 1 Target</span>
            </div>
            <p class="text-sm font-medium text-slate-200 leading-relaxed">
              {deliv_text}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 self-start md:self-center">
          <div class="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-white/10 flex items-center gap-2">
            <span class="material-symbols-outlined text-[16px] text-amber-400">flag</span>
            <div class="flex flex-col text-left">
              <span class="text-[9px] font-mono uppercase text-slate-400">Artifact Gate</span>
              <span class="text-xs font-mono font-bold text-amber-300">Milestone Checkpoint</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Filters & Budget Legend Strip -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none" id="filter-container">
        <button class="filter-btn active-filter px-3 py-1.5 rounded-lg bg-white/15 text-white font-mono text-xs font-semibold border border-white/20 transition-all cursor-pointer" data-filter="all" type="button">
          All ({total_tasks})
        </button>
        <button class="filter-btn px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary font-mono text-xs font-medium border border-primary/20 transition-all cursor-pointer" data-filter="dsa" type="button">
          DSA &amp; Java ({dsa_count})
        </button>
        <button class="filter-btn px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-tertiary font-mono text-xs font-medium border border-tertiary/20 transition-all cursor-pointer" data-filter="aiml" type="button">
          AI / ML ({aiml_count})
        </button>
        <button class="filter-btn px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-secondary font-mono text-xs font-medium border border-secondary/20 transition-all cursor-pointer" data-filter="corecs" type="button">
          Core CS ({corecs_count})
        </button>
        <button class="filter-btn px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-sky-300/90 font-mono text-xs font-medium border border-sky-500/20 transition-all cursor-pointer" data-filter="aptitude" type="button">
          Aptitude &amp; Backend ({backend_count})
        </button>
      </div>
      <div class="flex items-center gap-2 text-xs font-mono text-slate-400 self-end sm:self-center">
        <span class="material-symbols-outlined text-[15px] text-slate-500">tune</span>
        <span>Standard Cycle: Weekdays 4.0h &bull; Weekend 8.0h Lab</span>
      </div>
    </div>

    <!-- 4. Ultra-Clean Structured Day Schedule (Code 2 Exact Architecture) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5" id="days-container">
      {weekday_cards_html}

      <!-- Weekend Section Header / Divider -->
      <div class="lg:col-span-2 flex items-center gap-3 py-1">
        <div class="h-px flex-1 bg-white/[0.08]"></div>
        <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-mono text-primary">
          <span>⚡</span>
          <span class="font-bold">Weekend High-Load Execution</span>
          <span class="text-primary/80">&bull; 8.0h Daily Deep Focus Lab</span>
        </div>
        <div class="h-px flex-1 bg-white/[0.08]"></div>
      </div>

      {weekend_cards_html}
    </div>

    <!-- 5. Reflection & Technical Notes Journal -->
    <div class="rounded-xl bg-surface-container-low border border-white/[0.08] p-5 sm:p-6 flex flex-col gap-4 shadow-sm" id="journal">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-[18px]">terminal</span>
          </div>
          <div>
            <h3 class="text-sm font-bold text-white tracking-tight">Week {w_pad} Reflection &amp; Technical Notes</h3>
            <p class="text-[11px] font-mono text-slate-400">Persistent markdown workspace for algorithmic edge-cases &amp; training notes</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container border border-white/[0.06] text-xs font-mono text-slate-300">
            <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span id="save-status">Auto-saved to Supabase &bull; Live</span>
          </div>
        </div>
      </div>
      <div class="relative rounded-lg bg-surface-container-lowest border border-white/[0.08] focus-within:border-primary/50 transition-colors p-3.5">
        <textarea class="w-full bg-transparent font-mono text-xs text-slate-200 leading-relaxed placeholder:text-slate-600 focus:outline-none resize-none" id="week-notes" placeholder="Type Markdown notes, LeetCode edge-cases, Kaggle validation scores..." rows="8"></textarea>
      </div>
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] font-mono text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">#LeetCode</span>
          <span class="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] font-mono text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">#Java</span>
          <span class="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] font-mono text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">#DSA</span>
          <span class="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] font-mono text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">#Week{w_pad}</span>
        </div>
        <button class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-white/[0.08] hover:border-white/20 text-xs font-mono text-slate-200 transition-all self-end sm:self-auto cursor-pointer" id="export-notes-btn" type="button">
          <span class="material-symbols-outlined text-[15px] text-primary">download</span>
          <span>Export Markdown (.md)</span>
        </button>
      </div>
    </div>

    <!-- Bottom Navigation -->
    <nav class="flex items-center justify-between pt-2 pb-4">
      {prev_btn}
      <a href="../index.html" class="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container border border-white/[0.08] text-xs font-mono text-slate-300 transition-all">
        <span>&uarr; Back to Dashboard</span>
      </a>
      {next_btn}
    </nav>
  </main>

  <!-- 6. Footer -->
  <footer class="w-full bg-[#080B10] border-t border-white/[0.08] py-4 mt-8">
    <div class="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs text-slate-400">
      <div class="flex items-center gap-2">
        <span class="font-semibold text-slate-300">Swaraj Kanse</span>
        <span class="text-slate-600">&bull;</span>
        <span>Week {w_pad} Execution Protocol</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
        <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Supabase Synchronized</span>
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
        
        week_tiles = []
        for w in weeks:
            num = w['week_num']
            padded = f"{num:02d}"
            title = w['title']
            task_count = sum(len(d['tasks']) for d in w['days'])
            
            week_tiles.append(f'''
            <a href="weeks/week-{padded}.html" class="p-3 rounded-lg cockpit-subglass flex flex-col justify-between hover:border-primary/50 transition-colors group cursor-pointer" id="dash-week-{num}">
              <div class="flex items-center justify-between mb-1.5">
                <span class="font-mono text-[11px] text-on-surface font-semibold">WEEK {padded}</span>
                <span class="material-symbols-outlined text-[15px] text-outline-variant group-hover:text-primary transition-colors">arrow_forward</span>
              </div>
              <span class="text-xs text-on-surface font-medium truncate mb-2">{title}</span>
              <div class="flex items-center justify-between">
                <span class="font-mono text-[10px] text-on-surface-variant week-task-count" id="dash-week-{num}-tasks">{task_count} Tasks</span>
                <span class="font-mono text-[10px] text-primary font-bold week-pct" id="dash-week-{num}-pct">0%</span>
              </div>
            </a>''')

        weeks_grid_html = "\n".join(week_tiles)

        is_expanded = (p_num == 1)
        expanded_card_style = "border border-primary/40 bg-surface-container-low/95" if is_expanded else "cockpit-glass"
        content_class = "max-h-[800px] opacity-100 border-outline-variant/20" if is_expanded else "max-h-0 opacity-0 border-transparent"
        chevron_class = "rotate-180 text-primary" if is_expanded else "text-on-surface-variant"

        phases_html.append(f'''
        <div class="rounded-xl {expanded_card_style} overflow-hidden transition-all duration-200 phase-accordion-card shadow-sm" data-phase-card="{p_num}">
          <button type="button" class="phase-toggle w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-surface-container-high/40 transition-colors cursor-pointer" data-phase="{p_num}">
            <div class="flex items-center gap-3.5">
              <span class="w-5 h-5 rounded-full bg-surface-container border border-outline-variant/40 flex items-center justify-center text-primary font-mono text-[10px] font-bold shadow-sm">
                {p_num}
              </span>
              <div>
                <span class="font-mono text-[10px] text-on-surface-variant font-semibold block uppercase">Phase {p_num:02d} &bull; Weeks {w_start:02d}–{w_end:02d}</span>
                <h4 class="font-headline text-sm sm:text-base font-semibold text-on-surface">{p_info['title']}</h4>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <span class="font-mono text-xs font-semibold text-primary phase-status-pill" id="phase-{p_num}-status">0% ({len(weeks)} Weeks)</span>
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
  <title>ORBIT // Executive Cockpit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
  {COMMON_TAILWIND_CONFIG}
  <link rel="stylesheet" href="css/style.css">
</head>
<body class="bg-background font-body text-on-surface antialiased selection:bg-primary selection:text-on-primary min-h-screen relative overflow-x-hidden transition-colors duration-200">

  <!-- Subtle Ambient Glow Overlay (Code 1 Exact) -->
  <div class="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[850px] h-[340px] bg-gradient-to-b from-primary/10 via-primary/3 to-transparent blur-3xl -z-10 dark:opacity-70 opacity-30"></div>
  <div class="pointer-events-none fixed top-24 right-0 w-[420px] h-[350px] bg-tertiary/5 blur-3xl -z-10"></div>

  <!-- Main Executive Console Content -->
  <main class="w-full pt-8 sm:pt-10 pb-16 min-h-screen">
    <div class="max-w-6xl mx-auto px-6">
      <div class="flex flex-col w-full gap-7">

        <!-- 1. Executive Vitals Bar (Hero Metrics - Code 1 Exact) -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200">
            <div class="text-xs text-on-surface-variant font-medium mb-1">Target Countdown</div>
            <div class="font-mono text-2xl font-bold tracking-tight text-on-surface">
              <span id="vitals-countdown-val">487d</span> <span class="text-xs text-on-surface-variant font-normal">remaining</span>
            </div>
            <div class="mt-2 text-[11px] text-on-surface-variant">Target: July 2027</div>
          </div>

          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200">
            <div class="text-xs text-on-surface-variant font-medium mb-1">Consistency</div>
            <div class="font-mono text-2xl font-bold text-on-surface">
              <span id="streak-current-val">0</span> <span class="text-xs text-on-surface-variant font-normal">days</span>
            </div>
            <div class="mt-2 text-[11px] text-on-surface-variant">Active streak</div>
          </div>

          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200">
            <div class="text-xs text-on-surface-variant font-medium mb-1">Overall Progress</div>
            <div class="font-mono text-2xl font-bold text-on-surface tracking-tight" id="stat-pct-done">0.0%</div>
            <div class="w-full h-1 rounded-full bg-surface-container overflow-hidden mt-3">
              <div class="h-full bg-primary rounded-full transition-all duration-500" id="global-progress-bar" style="width: 0%"></div>
            </div>
          </div>

          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200">
            <div class="text-xs text-on-surface-variant font-medium mb-1">Focus Time</div>
            <div class="font-mono text-2xl font-bold text-on-surface" id="vitals-logged-hours">0.0h</div>
            <div class="mt-2 text-[11px] text-on-surface-variant" id="stat-tasks-done-sub">Logged this week</div>
          </div>
        </section>

        <!-- 2. Today's Execution Queue (Code 1 Exact Architecture) -->
        <section class="rounded-xl cockpit-glass overflow-hidden shadow-xl" id="today">
          <div class="px-5 py-4 border-b border-outline-variant/15 flex items-center justify-between gap-3 bg-surface-container-lowest/50">
            <div class="flex items-center gap-3">
              <h2 class="font-headline text-base font-semibold text-on-surface">Today</h2>
              <span class="text-outline-variant/40">&bull;</span>
              <span class="text-xs text-on-surface-variant" id="today-day-title">Loading schedule...</span>
            </div>
            <div class="flex items-center gap-2 text-on-surface-variant font-mono text-xs">
              <span class="text-on-surface font-semibold" id="queue-completed-counter">0</span> of <span id="queue-total-counter">0</span> completed
              <span class="text-primary text-[11px] font-semibold ml-1" id="queue-percent">0%</span>
            </div>
          </div>

          <!-- Micro Progress Bar -->
          <div class="w-full bg-surface-container h-1 overflow-hidden">
            <div class="h-full bg-primary transition-all duration-300 ease-out" id="queue-progress-bar" style="width: 0%"></div>
          </div>

          <!-- Task List (Code 1 Exact 1-line Rows) -->
          <div class="divide-y divide-outline-variant/10 text-body" id="today-tasks-list">
            <!-- Populated dynamically by app.js -->
          </div>
        </section>


        <!-- 3. LeetCode-Style Activity Heatmap -->
        <section class="p-5 sm:p-6 rounded-2xl bg-[#1c1c1f] border border-white/[0.06] shadow-xl flex flex-col gap-4" id="telemetry">
          <!-- Top Stats Header (Exact LeetCode Style) -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-white text-lg sm:text-xl tracking-tight" id="heatmap-total-completed">0</span>
              <span class="text-xs sm:text-sm text-zinc-400 font-normal">tasks completion in past one year</span>
              <span class="text-xs text-zinc-500 hover:text-zinc-300 cursor-help transition-colors" title="Tasks completion in the past one year">ⓘ</span>
            </div>
            <div class="flex items-center gap-4 text-xs text-zinc-400 font-normal">
              <div>Total active days: <span class="text-white font-medium ml-1" id="heatmap-active-days">0</span></div>
              <div>Max streak: <span class="text-white font-medium ml-1" id="heatmap-max-streak">0</span></div>
            </div>
          </div>

          <!-- Heatmap Container (Grouped by Month with Month Labels at Bottom) -->
          <div class="overflow-x-auto pb-1 no-scrollbar">
            <div class="flex items-start justify-between gap-1.5 sm:gap-2.5 select-none w-full min-w-[720px]" id="heatmap-months-container">
              <!-- Populated dynamically by app.js -->
            </div>
          </div>
        </section>

        <!-- 5. 10-Phase Placement Roadmap (Quiet Accordion - Code 1 Exact) -->
        <section class="flex flex-col gap-3" id="roadmap">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="font-headline text-base font-semibold text-on-surface">Roadmap</h3>
            </div>
            <span class="text-xs text-on-surface-variant">Phase 1 of 10</span>
          </div>

          <div class="flex flex-col gap-2.5" id="roadmap-accordion">
            {all_phases_html}
          </div>
        </section>

      </div>
    </div>
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

    with open('js/roadmap-data.js', 'w', encoding='utf-8') as f:
        f.write("window.ROADMAP_DATA = ")
        json.dump(roadmap, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print("Written js/roadmap-data.js")

    dash_html = generate_dashboard(roadmap)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(dash_html)
    print("Written index.html")

    for w in roadmap:
        pad = f"{w['week_num']:02d}"
        filepath = f"weeks/week-{pad}.html"
        week_html = generate_week_page(w, len(roadmap), roadmap)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(week_html)
    print(f"Generated {len(roadmap)} weekly HTML pages in weeks/")

if __name__ == '__main__':
    main()
