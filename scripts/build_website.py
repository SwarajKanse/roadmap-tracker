import glob
import re
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

BUILD_VERSION = "20261005_v6_2"

def clean_latex_and_math(text):
    if not text:
        return ""
    
    subs = [
        (r'\$?\\\s*rightarrow\$?', '&rarr;'),
        (r'\$?\\\s*Rightarrow\$?', '&rArr;'),
        (r'\$?\\\s*cdot\$?', '&middot;'),
        (r'\$?\\\s*times\$?', '&times;'),
        (r'\$?\\\s*approx\$?', '&asymp;'),
        (r'\$?\\\s*le(?![a-zA-Z])\$?', '&le;'),
        (r'\$?\\\s*ge(?![a-zA-Z])\$?', '&ge;'),
        (r'\$?\\\s*alpha\$?', '&alpha;'),
        (r'\$?\\\s*beta\$?', '&beta;'),
        (r'\$?\\\s*varepsilon\$?', '&epsilon;'),
        (r'\$?\\\s*epsilon\$?', '&epsilon;'),
        (r'\$?\\\s*theta\$?', '&theta;'),
        (r'\$?\\\s*sigma\$?', '&sigma;'),
        (r'\$?\\\s*lambda\$?', '&lambda;'),
    ]
    for p, r in subs:
        text = re.sub(p, f' {r} ', text)

    def math_repl(m):
        c = m.group(1).strip()
        c = re.sub(r'\^2', '<sup>2</sup>', c)
        c = re.sub(r'\^3', '<sup>3</sup>', c)
        c = re.sub(r'_0', '<sub>0</sub>', c)
        c = re.sub(r'_1', '<sub>1</sub>', c)
        c = re.sub(r'_i', '<sub>i</sub>', c)
        c = re.sub(r'\\cdot', '&middot;', c)
        if c.startswith('O(') or c.startswith('R<') or len(c) <= 20:
            return f'<code class="px-1 py-0.5 rounded bg-surface-container/80 font-mono text-[11px] text-primary border border-white/5">{c}</code>'
        return f'<span class="font-mono text-[11px] text-primary">{c}</span>'

    text = re.sub(r'\$([^\$]+)\$', math_repl, text)
    text = re.sub(r'\s{2,}', ' ', text).strip()
    return text

def format_cell_html(text):
    if not text:
        return ""
    
    text = clean_latex_and_math(text)
    
    # 1. Markdown links [text](url)
    def link_repl(m):
        label = m.group(1)
        url = m.group(2)
        if not url.startswith('http://') and not url.startswith('https://'):
            url = 'https://' + url
        return f'<a href="{url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 text-primary hover:text-primary-container underline underline-offset-2 transition-colors font-medium">{label}<span class="material-symbols-outlined text-[11px] inline-block align-middle ml-0.5">open_in_new</span></a>'
    
    text = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', link_repl, text)
    
    # 2. Parenthesized URLs
    def paren_url_repl(m):
        url = m.group(1).strip()
        label = "Resource"
        if "youtube.com" in url or "youtu.be" in url: label = "YouTube"
        elif "cs50" in url: label = "CS50"
        elif "khanacademy" in url: label = "Khan Academy"
        elif "leetcode" in url: label = "LeetCode"
        elif "huggingface" in url: label = "HuggingFace"
        elif "arxiv" in url: label = "Paper"
        elif "fast.ai" in url: label = "Fast.ai"
        elif "github" in url: label = "GitHub"
        full_url = url if url.startswith('http') else 'https://' + url
        return f'(<a href="{full_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 text-primary hover:text-primary-container underline underline-offset-2 transition-colors font-medium">[{label}]<span class="material-symbols-outlined text-[11px] inline-block align-middle ml-0.5">open_in_new</span></a>)'

    bare_domain_pattern = r'\(((?:https?://)?(?:www\.)?(?:youtube\.com|youtu\.be|cs50\.harvard\.edu|khanacademy\.org|arxiv\.org|immersivemath\.com|course\.fast\.ai|modelcontextprotocol\.io|docs\.spring\.io|docs\.langchain4j\.dev|developer\.confluent\.io|testcontainers\.com|docs\.ragas\.io|huggingface\.co|baeldung\.com|github\.com)[^\s\)]*)\)'
    text = re.sub(bare_domain_pattern, paren_url_repl, text)

    # 3. Bare URLs
    def raw_url_repl(m):
        url = m.group(0)
        full_url = url if url.startswith('http') else 'https://' + url
        label = "Link"
        if "youtube" in url: label = "YouTube"
        elif "huggingface" in url: label = "Docs"
        return f'<a href="{full_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 text-primary hover:text-primary-container underline underline-offset-2 transition-colors font-medium">[{label}]<span class="material-symbols-outlined text-[11px] inline-block align-middle ml-0.5">open_in_new</span></a>'

    text = re.sub(r'(?<!href=")(?<!">)(?:https?://[^\s<>`"\)]+)', raw_url_repl, text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong class="text-on-surface font-semibold">\1</strong>', text)
    text = re.sub(r'(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)', r'<em>\1</em>', text)
    text = re.sub(r'`([^`]+)`', r'<code class="px-1 py-0.5 rounded bg-surface-container font-mono text-[11px] text-primary border border-white/5">\1</code>', text)
    return text

def categorize_track(raw_name):
    n = raw_name.lower().strip()
    if 'dsa' in n or 'pattern' in n:
        return 'dsa', 'DSA (Java)', 'DSA'
    elif 'competitive' in n or 'codeforces' in n or 'contest' in n or 'cp' in n or 'cses' in n:
        return 'dsa', 'Competitive Programming', 'CP'
    elif 'ai/ml' in n or 'cs50p' in n or 'machine learning' in n or 'deep learning' in n or 'rag' in n or 'nlp' in n or 'vision' in n or 'karpathy' in n or 'micrograd' in n:
        return 'aiml', 'AI / ML Track', 'AI/ML'
    elif 'capstone' in n:
        return 'aiml', 'Capstone Project', 'CAPSTONE'
    elif 'spring' in n or 'backend' in n:
        return 'backend', 'Backend (Spring Boot)', 'SPRING'
    elif 'cloud' in n or 'devops' in n or 'docker' in n or 'aws' in n or 'kubernetes' in n:
        return 'backend', 'Cloud & DevOps', 'DEVOPS'
    elif 'sql' in n:
        return 'corecs', 'SQL Database', 'SQL'
    elif 'oops' in n:
        return 'corecs', 'Core CS (OOPs)', 'OOPS'
    elif 'dbms' in n:
        return 'corecs', 'Core CS (DBMS)', 'DBMS'
    elif 'os' in n or 'operating' in n:
        return 'corecs', 'Core CS (OS)', 'OS'
    elif 'cn' in n or 'network' in n:
        return 'corecs', 'Core CS (CN)', 'CN'
    elif 'lld' in n:
        return 'corecs', 'Core CS (LLD)', 'LLD'
    elif 'hld' in n or 'system design' in n or 'ddia' in n or 'alex xu' in n:
        return 'corecs', 'Core CS (HLD)', 'HLD'
    elif 'linux' in n or 'git' in n:
        return 'corecs', 'Core CS (Linux & Git)', 'GIT'
    elif 'core cs (java)' in n or 'java interview' in n:
        return 'corecs', 'Core CS (Java)', 'JAVA'
    elif 'aptitude' in n or 'quant' in n or 'verbal' in n or 'logical' in n:
        return 'aptitude', 'Aptitude', 'APT'
    elif 'mock' in n:
        return 'professional', 'Mock Interviews', 'MOCK'
    elif 'recruiting' in n or 'pipeline' in n or 'internship' in n or 'apply' in n:
        return 'professional', 'Recruiting Pipeline', 'PIPELINE'
    elif 'offer' in n or 'negotiation' in n:
        return 'professional', 'Offer Management', 'OFFER'
    elif 'placement' in n:
        return 'professional', 'Placement Execution', 'CAREER'
    elif 'portfolio' in n or 'archiving' in n:
        return 'professional', 'Portfolio & Archiving', 'PORTFOLIO'
    elif 'lens' in n or 'target company' in n:
        return 'professional', 'Target Company Lens', 'LENS'
    elif 'professional' in n or 'resume' in n or 'github' in n or 'blog' in n:
        return 'professional', 'Professional', 'PRO'
    else:
        return 'corecs', raw_name, 'CORE'

def parse_roadmap():
    roadmap_pattern = 'Roadmap/*Phase*.md'
    if not glob.glob(roadmap_pattern):
        roadmap_pattern = '../Roadmap/*Phase*.md'
    if not glob.glob(roadmap_pattern):
        roadmap_pattern = os.path.join(os.path.dirname(__file__), '../../Roadmap/*Phase*.md')
    files = sorted(glob.glob(roadmap_pattern))
    roadmap = []

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

        week_blocks = re.split(r'\n(?=##\s+Week\s+\d+)', content)
        for block in week_blocks[1:]:
            lines = [l.strip() for l in block.strip().split('\n')]
            header = lines[0]
            w_match = re.search(r'##\s+Week\s+(\d+)\s+[—-]\s+(.+)', header)
            if not w_match:
                continue
            w_num = int(w_match.group(1))
            w_title = w_match.group(2).strip()
            w_title_clean = re.sub(r'\*\*([^*]+)\*\*', r'\1', w_title)

            # Week Focus quote (first blockquote)
            w_focus = ""
            for l in lines[1:8]:
                if l.startswith('>'):
                    w_focus = re.sub(r'^[>\s]+', '', l).strip()
                    break

            # 1. Parse MUST Section
            must_hours = 0.0
            cap_hours = 27.0
            cap_label = "Normal"
            must_tasks = []

            m_sec = re.search(r'###\s*🔴\s*MUST[^\n]*\n(.*?)(?=###|\Z)', block, re.DOTALL)
            if m_sec:
                must_text = m_sec.group(1)
                tot_m = re.search(r'\*\*MUST total:\s*~?([\d\.]+)h\s*/\s*([\d\.]+)h cap(?:\s*\((.*?)\))?\*\*', must_text)
                if tot_m:
                    must_hours = float(tot_m.group(1))
                    cap_hours = float(tot_m.group(2))
                    if tot_m.group(3):
                        cap_label = tot_m.group(3).strip()
                    elif cap_hours == 0:
                        cap_label = "Buffer / Exam"
                    elif cap_hours >= 36:
                        cap_label = "Golden Window"
                    elif cap_hours <= 15:
                        cap_label = "Reduced"
                    else:
                        cap_label = "Standard"

                current_track_raw = "DSA (Java)"
                task_idx = 1

                for line in must_text.split('\n'):
                    line = line.strip()
                    if not line:
                        continue
                    tm = re.match(r'^\*\*([^*]+)\*\*\s*$', line)
                    if tm and 'MUST total' not in tm.group(1):
                        current_track_raw = tm.group(1).strip()
                        continue

                    nm = re.match(r'^\d+\.\s+\*\*([^*]+)\*\*\s+[—-]\s+(.*?)(?:\s+⏱\s*([\d\.]+)h)?$', line)
                    if nm:
                        title = nm.group(1).strip()
                        desc = nm.group(2).strip()
                        hours = float(nm.group(3)) if nm.group(3) else 2.0

                        prob_marker = ""
                        pm = re.search(r'\*\[(.*?)\]\*', desc)
                        if pm:
                            prob_marker = pm.group(1).strip()
                            desc = desc.replace(pm.group(0), '').strip()

                        ref = ""
                        lc_match = re.search(r'(?:LeetCode|LC)\s*#?([0-9,\s#&and]+)', desc, re.IGNORECASE)
                        if lc_match:
                            ref = f"LC #{lc_match.group(1).strip()}"

                        cat_id, cat_name, cat_tag = categorize_track(current_track_raw)
                        task_id = f"w{w_num}_must_{cat_id}_{task_idx}"
                        task_idx += 1

                        must_tasks.append({
                            'id': task_id,
                            'priority': 'must',
                            'priority_label': 'MUST',
                            'priority_icon': '🔴',
                            'track_id': cat_id,
                            'track_name': cat_name,
                            'track_tag': cat_tag,
                            'title': title,
                            'title_html': format_cell_html(title),
                            'desc': desc,
                            'desc_html': format_cell_html(desc),
                            'hours': hours,
                            'prob_marker': prob_marker,
                            'ref': ref,
                            'raw_text': line
                        })

            # 2. Parse SHOULD Section
            should_tasks = []
            s_sec = re.search(r'###\s*🟡\s*SHOULD[^\n]*\n(.*?)(?=###|\Z)', block, re.DOTALL)
            if s_sec:
                task_idx = 1
                for line in s_sec.group(1).split('\n'):
                    line = line.strip()
                    nm = re.match(r'^\d+\.\s+\*\*([^*]+)\*\*\s+[—-]\s+(.*?)(?:\s+⏱\s*([\d\.]+)h)?$', line)
                    if nm:
                        title_raw = nm.group(1).strip()
                        desc = nm.group(2).strip()
                        hours = float(nm.group(3)) if nm.group(3) else 1.5

                        if ':' in title_raw:
                            pfx, sub_title = title_raw.split(':', 1)
                            cat_id, cat_name, cat_tag = categorize_track(pfx.strip())
                            title = sub_title.strip()
                        else:
                            cat_id, cat_name, cat_tag = categorize_track(title_raw)
                            title = title_raw

                        task_id = f"w{w_num}_should_{cat_id}_{task_idx}"
                        task_idx += 1
                        should_tasks.append({
                            'id': task_id,
                            'priority': 'should',
                            'priority_label': 'SHOULD',
                            'priority_icon': '🟡',
                            'track_id': cat_id,
                            'track_name': cat_name,
                            'track_tag': cat_tag,
                            'title': title,
                            'title_html': format_cell_html(title),
                            'desc': desc,
                            'desc_html': format_cell_html(desc),
                            'hours': hours,
                            'raw_text': line
                        })

            # 3. Parse STRETCH Section
            stretch_tasks = []
            st_sec = re.search(r'###\s*🟢\s*STRETCH[^\n]*\n(.*?)(?=###|\Z)', block, re.DOTALL)
            if st_sec:
                task_idx = 1
                for line in st_sec.group(1).split('\n'):
                    line = line.strip()
                    nm = re.match(r'^\d+\.\s+\*\*([^*]+)\*\*\s+[—-]\s+(.*?)(?:\s+⏱\s*([\d\.]+)h)?$', line)
                    if nm:
                        title_raw = nm.group(1).strip()
                        desc = nm.group(2).strip()
                        hours = float(nm.group(3)) if nm.group(3) else 1.5

                        if ':' in title_raw:
                            pfx, sub_title = title_raw.split(':', 1)
                            cat_id, cat_name, cat_tag = categorize_track(pfx.strip())
                            title = sub_title.strip()
                        else:
                            cat_id, cat_name, cat_tag = categorize_track(title_raw)
                            title = title_raw

                        task_id = f"w{w_num}_stretch_{cat_id}_{task_idx}"
                        task_idx += 1
                        stretch_tasks.append({
                            'id': task_id,
                            'priority': 'stretch',
                            'priority_label': 'STRETCH',
                            'priority_icon': '🟢',
                            'track_id': cat_id,
                            'track_name': cat_name,
                            'track_tag': cat_tag,
                            'title': title,
                            'title_html': format_cell_html(title),
                            'desc': desc,
                            'desc_html': format_cell_html(desc),
                            'hours': hours,
                            'raw_text': line
                        })

            # 4. Parse Gate Section
            gates = []
            g_sec = re.search(r'###\s*✅[^\n]*\n(.*?)(?=###|\Z)', block, re.DOTALL)
            if g_sec:
                gate_idx = 1
                for line in g_sec.group(1).split('\n'):
                    line = line.strip()
                    if line.startswith('- ['):
                        m_tagged = re.match(r'^-\s+\[\s*\]\s+\[T:\s*(.*?)\]\s*(?:<!--\s*Supports:\s*\"(.*?)\"\s*-->\s*)?(.*)$', line)
                        if m_tagged:
                            target_task = m_tagged.group(1).strip()
                            supports = m_tagged.group(2).strip() if m_tagged.group(2) else ""
                            rest_text = m_tagged.group(3).strip()

                            evidence = ""
                            if 'Evidence:' in rest_text:
                                q_part, ev_part = rest_text.split('Evidence:', 1)
                                question = q_part.strip()
                                evidence = ev_part.strip()
                            else:
                                question = rest_text

                            gate_id = f"w{w_num}_gate_{gate_idx}"
                            gate_idx += 1
                            gates.append({
                                'id': gate_id,
                                'target_task': target_task,
                                'supports': supports,
                                'question': question,
                                'question_html': format_cell_html(question),
                                'evidence': evidence,
                                'evidence_html': format_cell_html(evidence),
                                'is_health': False,
                                'raw_text': line
                            })
                        else:
                            m_simple = re.match(r'^-\s+\[\s*\]\s+(.*)$', line)
                            if m_simple:
                                rest = m_simple.group(1).strip()
                                gate_id = f"w{w_num}_gate_{gate_idx}"
                                gate_idx += 1
                                is_h = 'Health & Guardrails' in rest
                                gates.append({
                                    'id': gate_id,
                                    'target_task': '',
                                    'supports': '',
                                    'question': rest,
                                    'question_html': format_cell_html(rest),
                                    'evidence': '',
                                    'evidence_html': '',
                                    'is_health': is_h,
                                    'raw_text': line
                                })

            # 5. Parse If Behind Section
            if_behind = {'protect': '', 'defer': '', 'raw': '', 'html': ''}
            ib_sec = re.search(r'###\s*🔄[^\n]*\n(.*?)(?=\n---|###|\Z)', block, re.DOTALL)
            if ib_sec:
                clean_lines = [re.sub(r'^[>\s]+', '', l).strip() for l in ib_sec.group(1).split('\n') if l.strip()]
                full_ib = ' '.join(clean_lines)
                if_behind['raw'] = full_ib
                if_behind['html'] = format_cell_html(full_ib)

                m_pd = re.search(r'Protect:\s*(.*?)\.\s*Defer:\s*(.*?)(?:\.|$)', full_ib)
                if m_pd:
                    if_behind['protect'] = m_pd.group(1).strip()
                    if_behind['defer'] = m_pd.group(2).strip()

            # 6. Build Days structure for Today's Queue & Heatmap
            day_order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            day_names = {
                'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday',
                'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'
            }
            days_tasks = {d: [] for d in day_order}

            weekday_tasks = []
            weekend_tasks = []
            for t in must_tasks:
                if t['track_id'] in ['professional', 'backend'] and any(k in t['title'].lower() for k in ['mock', 'contest', 'upsolving', 'capstone', 'machine coding', 'whiteboard']):
                    weekend_tasks.append(t)
                elif t['track_id'] == 'aiml' and 'capstone' in t['title'].lower():
                    weekend_tasks.append(t)
                else:
                    weekday_tasks.append(t)

            if weekday_tasks:
                for idx, t in enumerate(weekday_tasks):
                    d = day_order[idx % 5]
                    days_tasks[d].append(t)

            if weekend_tasks:
                for idx, t in enumerate(weekend_tasks):
                    d = 'Sat' if idx % 2 == 0 else 'Sun'
                    days_tasks[d].append(t)
            else:
                if len(must_tasks) > 5:
                    sat_cand = days_tasks['Fri'].pop() if days_tasks['Fri'] else None
                    if sat_cand: days_tasks['Sat'].append(sat_cand)
                    sun_cand = days_tasks['Thu'].pop() if len(days_tasks['Thu']) > 1 else None
                    if sun_cand: days_tasks['Sun'].append(sun_cand)

            if not days_tasks['Sat']:
                days_tasks['Sat'].append({
                    'id': f"w{w_num}_sat_review",
                    'priority': 'must',
                    'track_id': 'dsa',
                    'track_name': 'DSA & Problem Lab',
                    'track_tag': 'LAB',
                    'title': f"Week {w_num} Deep Practice & Problem Lab",
                    'title_html': f"Week {w_num} Deep Practice & Problem Lab",
                    'desc': "Review weekly patterns, execute contest problems or project sprints.",
                    'desc_html': "Review weekly patterns, execute contest problems or project sprints.",
                    'hours': 4.0,
                    'is_review': True
                })

            if not days_tasks['Sun']:
                days_tasks['Sun'].append({
                    'id': f"w{w_num}_sun_gate",
                    'priority': 'must',
                    'track_id': 'professional',
                    'track_name': 'Weekly Gate & Review',
                    'track_tag': 'GATE',
                    'title': f"Week {w_num} Gate Verification & Sunday Ritual",
                    'title_html': f"Week {w_num} Gate Verification & Sunday Ritual",
                    'desc': "Clear weekly gates, log hour calibration, and review retention items.",
                    'desc_html': "Clear weekly gates, log hour calibration, and review retention items.",
                    'hours': 2.5,
                    'is_review': True
                })

            days_data = []
            for d in day_order:
                days_data.append({
                    'day_code': d,
                    'day_name': day_names[d],
                    'tasks': days_tasks[d]
                })

            roadmap.append({
                'week_num': w_num,
                'title': w_title_clean,
                'phase_num': phase_num,
                'phase_title': phase_title,
                'focus': w_focus,
                'focus_html': format_cell_html(w_focus),
                'must_hours': must_hours,
                'cap_hours': cap_hours,
                'cap_label': cap_label,
                'must_tasks': must_tasks,
                'should_tasks': should_tasks,
                'stretch_tasks': stretch_tasks,
                'gates': gates,
                'if_behind': if_behind,
                'days': days_data,
                'total_tasks': len(must_tasks) + len(should_tasks) + len(stretch_tasks)
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

    # Clean titles & caps
    clean_week_title = re.sub(r'<[^>]*>', '', week['title']).replace('"', '&quot;').strip()
    must_hours = week['must_hours']
    cap_hours = week['cap_hours']
    cap_label = week['cap_label']
    total_week_tasks = week['total_tasks']

    cap_pct = min(100, int((must_hours / cap_hours * 100))) if cap_hours > 0 else 0

    # Label styling (Purple family)
    if "Golden" in cap_label:
        badge_style = "bg-primary/20 text-primary border-primary/40"
    elif "Reduced" in cap_label:
        badge_style = "bg-purple-500/15 text-purple-300 border-purple-500/30"
    elif "Buffer" in cap_label or cap_hours == 0:
        badge_style = "bg-violet-500/15 text-violet-300 border-violet-500/30"
    else:
        badge_style = "bg-primary/10 text-primary/80 border-primary/20"

    # Group MUST tasks by Track
    must_tasks_by_track = {}
    for t in week['must_tasks']:
        trk = t['track_name']
        if trk not in must_tasks_by_track:
            must_tasks_by_track[trk] = []
        must_tasks_by_track[trk].append(t)

    must_sections_html = []
    for trk_name, t_list in must_tasks_by_track.items():
        cards_html = []
        for t in t_list:
            task_id = t['id']
            track_class = t['track_id']
            track_tag = t['track_tag']
            title = t['title']
            desc_html = f'<div class="task-desc text-[12px] text-on-surface-variant leading-relaxed break-words font-normal pl-0.5 pt-0.5">{t["desc_html"]}</div>' if t.get('desc_html') else ''
            clean_title = re.sub(r'<[^>]*>', '', title).replace('"', '&quot;').strip()
            
            prob_badge = f'<span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant/30 text-[10px] font-mono text-primary font-semibold shrink-0">{t["prob_marker"]}</span>' if t.get('prob_marker') else ''
            ref_badge = f'<span class="task-ref font-mono text-[10px] text-on-surface-variant/70 shrink-0">{t["ref"]}</span>' if t.get('ref') else ''

            cards_html.append(f'''
            <div class="task-card group flex items-start justify-between px-4 sm:px-5 py-3.5 hover:bg-surface-container-highest/30 transition-colors duration-150 cursor-pointer rounded-lg border border-transparent hover:border-white/5" data-completed="false" data-hours="{t['hours']}" data-task-id="{task_id}" data-track="{track_class}">
              <div class="flex items-start gap-3.5 min-w-0 flex-1">
                <button role="checkbox" aria-checked="false" aria-label="Toggle task: {clean_title}" class="task-toggle-btn task-checkbox checkbox-spring shrink-0 mt-0.5 w-4 h-4 rounded-[3px] bg-surface-container-lowest border border-outline-variant/50 group-hover:border-primary flex items-center justify-center shadow-sm cursor-pointer" data-task-id="{task_id}" type="button">
                  <span class="material-symbols-outlined text-[13px] text-on-primary font-bold opacity-0 transition-opacity">check</span>
                </button>
                <div class="flex flex-col gap-1 min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2 min-w-0">
                    <span class="task-tag shrink-0 px-2 py-0.5 rounded bg-surface-container border border-outline-variant/20 font-label-caps text-[10px] text-on-surface-variant font-semibold uppercase">{track_tag}</span>
                    <span class="task-title font-body-md text-xs sm:text-[13px] text-on-surface font-semibold leading-snug break-words transition-all duration-150" title="{clean_title}">{t['title_html']}</span>
                    {prob_badge}
                    {ref_badge}
                  </div>
                  {desc_html}
                </div>
              </div>
              <div class="flex items-center gap-2.5 shrink-0 pl-3 pt-0.5">
                <span class="text-xs text-on-surface-variant/70 font-mono-metric-md">⏱ {t['hours']}h</span>
              </div>
            </div>''')

        joined_cards = "\n".join(cards_html)
        must_sections_html.append(f'''
        <div class="flex flex-col gap-1.5 pt-2">
          <div class="px-2 flex items-center justify-between text-xs font-mono font-semibold text-primary/90">
            <span class="flex items-center gap-2 uppercase tracking-wider">
              <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
              {trk_name}
            </span>
            <span class="text-on-surface-variant/60 font-normal">{len(t_list)} tasks</span>
          </div>
          <div class="divide-y divide-outline-variant/10 text-body bg-surface-container-lowest/40 rounded-xl border border-white/5 overflow-hidden">
            {joined_cards}
          </div>
        </div>''')

    must_sections_joined = "\n".join(must_sections_html)

    # SHOULD tasks list
    should_cards = []
    for t in week['should_tasks']:
        task_id = t['id']
        track_class = t['track_id']
        track_tag = t['track_tag']
        clean_title = re.sub(r'<[^>]*>', '', t['title']).replace('"', '&quot;').strip()
        desc_html = f'<div class="task-desc text-[12px] text-on-surface-variant leading-relaxed break-words font-normal pl-0.5 pt-0.5">{t["desc_html"]}</div>' if t.get('desc_html') else ''

        should_cards.append(f'''
        <div class="task-card group flex items-start justify-between px-4 sm:px-5 py-3 hover:bg-surface-container-highest/30 transition-colors duration-150 cursor-pointer" data-completed="false" data-hours="{t['hours']}" data-task-id="{task_id}" data-track="{track_class}">
          <div class="flex items-start gap-3.5 min-w-0 flex-1">
            <button role="checkbox" aria-checked="false" aria-label="Toggle task: {clean_title}" class="task-toggle-btn task-checkbox checkbox-spring shrink-0 mt-0.5 w-4 h-4 rounded-[3px] bg-surface-container-lowest border border-outline-variant/50 group-hover:border-purple-400 flex items-center justify-center shadow-sm cursor-pointer" data-task-id="{task_id}" type="button">
              <span class="material-symbols-outlined text-[13px] text-on-primary font-bold opacity-0 transition-opacity">check</span>
            </button>
            <div class="flex flex-col gap-1 min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 min-w-0">
                <span class="task-tag shrink-0 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-label-caps text-[10px] font-semibold uppercase">{track_tag}</span>
                <span class="task-title font-body-md text-xs sm:text-[13px] text-on-surface font-semibold leading-snug break-words transition-all duration-150" title="{clean_title}">{t['title_html']}</span>
              </div>
              {desc_html}
            </div>
          </div>
          <div class="flex items-center gap-2.5 shrink-0 pl-3 pt-0.5">
            <span class="text-xs text-purple-300/70 font-mono-metric-md">⏱ {t['hours']}h</span>
          </div>
        </div>''')

    should_cards_joined = "\n".join(should_cards) if should_cards else '<div class="p-4 text-xs font-mono text-on-surface-variant/60 text-center">No secondary depth tasks scheduled this week.</div>'

    # STRETCH tasks list
    stretch_cards = []
    for t in week['stretch_tasks']:
        task_id = t['id']
        track_class = t['track_id']
        track_tag = t['track_tag']
        clean_title = re.sub(r'<[^>]*>', '', t['title']).replace('"', '&quot;').strip()
        desc_html = f'<div class="task-desc text-[12px] text-on-surface-variant leading-relaxed break-words font-normal pl-0.5 pt-0.5">{t["desc_html"]}</div>' if t.get('desc_html') else ''

        stretch_cards.append(f'''
        <div class="task-card group flex items-start justify-between px-4 sm:px-5 py-3 hover:bg-surface-container-highest/30 transition-colors duration-150 cursor-pointer" data-completed="false" data-hours="{t['hours']}" data-task-id="{task_id}" data-track="{track_class}">
          <div class="flex items-start gap-3.5 min-w-0 flex-1">
            <button role="checkbox" aria-checked="false" aria-label="Toggle task: {clean_title}" class="task-toggle-btn task-checkbox checkbox-spring shrink-0 mt-0.5 w-4 h-4 rounded-[3px] bg-surface-container-lowest border border-outline-variant/50 group-hover:border-violet-400 flex items-center justify-center shadow-sm cursor-pointer" data-task-id="{task_id}" type="button">
              <span class="material-symbols-outlined text-[13px] text-on-primary font-bold opacity-0 transition-opacity">check</span>
            </button>
            <div class="flex flex-col gap-1 min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 min-w-0">
                <span class="task-tag shrink-0 px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20 font-label-caps text-[10px] font-semibold uppercase">{track_tag}</span>
                <span class="task-title font-body-md text-xs sm:text-[13px] text-on-surface font-semibold leading-snug break-words transition-all duration-150" title="{clean_title}">{t['title_html']}</span>
              </div>
              {desc_html}
            </div>
          </div>
          <div class="flex items-center gap-2.5 shrink-0 pl-3 pt-0.5">
            <span class="text-xs text-violet-300/70 font-mono-metric-md">⏱ {t['hours']}h</span>
          </div>
        </div>''')

    stretch_cards_joined = "\n".join(stretch_cards) if stretch_cards else '<div class="p-4 text-xs font-mono text-on-surface-variant/60 text-center">No stretch tasks scheduled this week.</div>'

    # Gates list
    gate_cards = []
    for g in week['gates']:
        gate_id = g['id']
        target_badge = f'<span class="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono text-[11px] font-semibold shrink-0">[T: {g["target_task"]}]</span>' if g['target_task'] else ''
        ev_box = f'<div class="mt-1 text-[11px] font-mono text-on-surface-variant flex items-center gap-1.5"><span class="text-primary font-semibold">Evidence:</span> <span>{g["evidence_html"]}</span></div>' if g['evidence'] else ''
        clean_q = re.sub(r'<[^>]*>', '', g['question']).replace('"', '&quot;').strip()

        gate_cards.append(f'''
        <div class="gate-card group flex items-start justify-between px-4 sm:px-5 py-3 hover:bg-surface-container-highest/30 transition-colors duration-150 cursor-pointer" data-completed="false" data-gate-id="{gate_id}">
          <div class="flex items-start gap-3.5 min-w-0 flex-1">
            <button role="checkbox" aria-checked="false" aria-label="Toggle gate: {clean_q}" class="gate-toggle-btn task-checkbox checkbox-spring shrink-0 mt-0.5 w-4 h-4 rounded-[3px] bg-surface-container-lowest border border-outline-variant/50 group-hover:border-primary flex items-center justify-center shadow-sm cursor-pointer" data-gate-id="{gate_id}" type="button">
              <span class="material-symbols-outlined text-[13px] text-on-primary font-bold opacity-0 transition-opacity">check</span>
            </button>
            <div class="flex flex-col gap-1 min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 min-w-0">
                {target_badge}
                <span class="gate-question font-body text-xs sm:text-[13px] text-on-surface leading-snug break-words transition-all duration-150">{g['question_html']}</span>
              </div>
              {ev_box}
            </div>
          </div>
        </div>''')

    gate_cards_joined = "\n".join(gate_cards)

    # Focus text
    focus_section_html = ""
    if week['focus_html']:
        focus_section_html = f'''
        <!-- Weekly Focus & Objectives Card -->
        <section class="p-4 sm:p-5 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200">
          <div class="flex items-center justify-between pb-3 mb-3 border-b border-outline-variant/15">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-primary">target</span>
              <h2 class="text-xs sm:text-sm font-semibold text-on-surface tracking-tight">Week Objective &amp; Target Output</h2>
            </div>
            <span class="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Target Output</span>
          </div>
          <div class="text-xs sm:text-sm font-medium text-on-surface leading-relaxed deliverable-text">{week['focus_html']}</div>
        </section>'''

    # If Behind box
    if_behind_html = ""
    if week['if_behind']['protect'] or week['if_behind']['raw']:
        protect_content = week['if_behind']['protect'] or "Core MUST tasks"
        defer_content = week['if_behind']['defer'] or "Secondary depth items"
        if_behind_html = f'''
        <!-- 🔄 If Behind / Life Interruption Protocol Box -->
        <section class="rounded-xl cockpit-glass border border-primary/20 overflow-hidden p-5 flex flex-col gap-3">
          <div class="flex items-center justify-between pb-2 border-b border-outline-variant/15">
            <div class="flex items-center gap-2">
              <span class="text-primary text-sm">🔄</span>
              <h3 class="text-sm font-semibold text-on-surface tracking-tight">If Behind / Life Interruption Protocol</h3>
            </div>
            <span class="text-[10px] font-mono text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">Triage Rule</span>
          </div>
          <p class="text-xs text-on-surface-variant leading-relaxed">When academic exams spike or weekly time slips, execute this contingency plan:</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div class="p-3.5 rounded-lg bg-primary/10 border border-primary/20 text-xs flex flex-col gap-1">
              <span class="font-mono text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <span>🛡️</span> <span>Protect (Non-Negotiable)</span>
              </span>
              <div class="text-on-surface font-medium leading-relaxed">{format_cell_html(protect_content)}</div>
            </div>
            <div class="p-3.5 rounded-lg bg-surface-container/60 border border-outline-variant/20 text-xs flex flex-col gap-1">
              <span class="font-mono text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>📦</span> <span>Defer (Safe to Shift)</span>
              </span>
              <div class="text-on-surface-variant font-medium leading-relaxed">{format_cell_html(defer_content)}</div>
            </div>
          </div>
        </section>'''

    prev_btn = f'''<a href="{prev_w}" class="h-8 w-8 rounded-lg cockpit-glass border border-outline-variant/20 hover:border-primary/40 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors shrink-0" title="Previous Week (W{(w_num-1):02d})"><span class="material-symbols-outlined text-[18px]">chevron_left</span></a>''' if prev_w else '<span class="h-8 w-8 rounded-lg cockpit-glass border border-outline-variant/10 opacity-30 flex items-center justify-center text-on-surface-variant shrink-0"><span class="material-symbols-outlined text-[18px]">chevron_left</span></span>'
    next_btn = f'''<a href="{next_w}" class="h-8 w-8 rounded-lg cockpit-glass border border-outline-variant/20 hover:border-primary/40 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors shrink-0" title="Next Week (W{(w_num+1):02d})"><span class="material-symbols-outlined text-[18px]">chevron_right</span></a>''' if next_w else '<span class="h-8 w-8 rounded-lg cockpit-glass border border-outline-variant/10 opacity-30 flex items-center justify-center text-on-surface-variant shrink-0"><span class="material-symbols-outlined text-[18px]">chevron_right</span></span>'

    html_content = f'''<!DOCTYPE html>
<html class="dark" data-theme="dark" lang="en">
<head>
  <meta charset="utf-8">
  <meta content="width=device-width, initial-scale=1.0" name="viewport">
  <title>अभ्यास &bull; Week {w_pad}</title>
  <meta name="google-site-verification" content="uKnD8wt6kniI25IpAMVkaCIqsAQ9eGbGhSE2MGY5CPc" />
  <link rel="icon" type="image/svg+xml" href="../favicon.svg">
  <meta name="description" content="Phase {week['phase_num']} Week {w_pad}: {clean_week_title}. Track MUST curriculum, weekly gates, and slippage calibration.">
  <meta property="og:title" content="अभ्यास &bull; Week {w_pad}">
  <meta property="og:description" content="Phase {week['phase_num']} Week {w_pad}: {clean_week_title}. Track daily tasks, deliverables, and technical notes.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://track.swarajkanse.me/weeks/week-{w_pad}.html">
  <meta property="og:site_name" content="अभ्यास">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" content="#121316">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Rozha+One&family=Yatra+One&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,400,0..1,0" rel="stylesheet">
  <link rel="stylesheet" href="../css/tailwind.min.css?v={BUILD_VERSION}">
  <link rel="stylesheet" href="../css/style.css?v={BUILD_VERSION}">
</head>
<body class="bg-background font-body text-on-surface antialiased selection:bg-primary selection:text-on-primary min-h-screen relative overflow-x-hidden transition-colors duration-200">

  <!-- Ambient Glow Overlay -->
  <div class="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[850px] h-[340px] bg-gradient-to-b from-primary/10 via-primary/3 to-transparent blur-3xl -z-10 dark:opacity-70 opacity-30"></div>
  <div class="pointer-events-none fixed top-24 right-0 w-[420px] h-[350px] bg-tertiary/5 blur-3xl -z-10"></div>

  <!-- Semi-Transparent Glassmorphism Top Bar -->
  <header class="sticky top-0 z-50 w-full backdrop-blur-md bg-background/25 select-none py-3 transition-all border-none">
    <div class="max-w-6xl mx-auto px-6 flex items-center justify-between gap-4">
      <a href="../index.html" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg cockpit-glass border border-outline-variant/20 hover:border-primary/40 text-on-surface-variant hover:text-on-surface transition-all duration-150 group shrink-0">
        <span class="material-symbols-outlined text-[20px] group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        <span class="font-calligraphy leading-none text-on-surface" style="font-size: 1.7rem;">अभ्यास</span>
      </a>

      <div class="flex flex-col items-center text-center min-w-0 flex-1 px-3">
        <span class="text-[11px] font-mono text-on-surface-variant uppercase tracking-wider">Phase {week['phase_num']} &bull; Week {w_pad}</span>
        <h1 class="font-headline text-sm sm:text-base font-bold text-on-surface tracking-tight truncate max-w-full">{week['title']}</h1>
      </div>

      <div id="week-header-actions" class="flex items-center gap-1.5 shrink-0 transition-opacity">
        {prev_btn}
        {next_btn}
      </div>
    </div>
  </header>

  <!-- Main Executive Console Content -->
  <main class="w-full pt-6 pb-16 min-h-screen">
    <div class="max-w-6xl mx-auto px-6">
      <div class="flex flex-col w-full gap-7">

        <!-- Executive Vitals Bar (Cap, Hour Calibration, Week Progress) -->
        <section class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          <!-- 1. Capacity & Cap Card -->
          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200 flex flex-col justify-between">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-xs text-on-surface-variant font-medium">Weekly MUST Budget</span>
              <span class="font-mono text-[10px] px-2 py-0.5 rounded border font-semibold {badge_style}">{cap_label}</span>
            </div>
            <div class="font-mono text-2xl font-bold tracking-tight text-on-surface">
              <span>{must_hours}h</span> <span class="text-xs text-on-surface-variant font-normal">/ {cap_hours}h cap</span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-surface-container overflow-hidden mt-3">
              <div class="h-full bg-primary rounded-full transition-all duration-500" style="width: {cap_pct}%"></div>
            </div>
          </div>

          <!-- 2. Hour Calibration & Slippage Calculator (Architecture §4.1) -->
          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200 flex flex-col justify-between">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-xs text-on-surface-variant font-medium">Hour Calibration</span>
              <span id="slippage-ratio-badge" style="display: none;"></span>
            </div>
            <div class="flex items-center gap-2">
              <input type="number" step="0.5" min="0" max="100" id="actual-hours-input" data-printed-hours="{must_hours}" placeholder="0.0" class="w-20 px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant/30 font-mono text-base text-on-surface font-semibold focus:border-primary focus:outline-none" />
              <span class="text-xs text-on-surface-variant">actual hours logged</span>
            </div>
            <div class="text-[10px] text-on-surface-variant/70 font-mono mt-2">Rule: slippage &gt; 1.25x triggers Scope-Cut Rung 2</div>
          </div>

          <!-- 3. Week Completion Progress -->
          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200 flex flex-col justify-between sm:col-span-2 md:col-span-1">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-xs text-on-surface-variant font-medium">Week Execution</span>
              <span class="font-mono text-xs font-semibold text-primary" id="progress-percent">0%</span>
            </div>
            <div class="font-mono text-2xl font-bold tracking-tight text-on-surface flex items-baseline gap-1.5">
              <span id="completed-count">0</span><span class="text-xs text-on-surface-variant font-normal">/ {total_week_tasks} tasks</span>
              <span class="text-xs text-on-surface-variant/70 font-normal ml-auto" id="logged-hours-label">0.0h</span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-surface-container overflow-hidden mt-3">
              <div class="h-full bg-primary rounded-full transition-all duration-500" id="week-progress-fill" style="width: 0%"></div>
            </div>
          </div>
        </section>

        {focus_section_html}

        <!-- Phase Navigation Tabs -->
        <section class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-mono">
          <span class="text-on-surface-variant font-medium pr-1 select-none">Weeks:</span>
          {phase_tabs_joined}
        </section>

        <!-- MUST — Critical Path Section -->
        <section class="flex flex-col gap-3" id="section-must">
          <div class="flex items-center justify-between pb-3 border-b border-outline-variant/15">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
              <h2 class="font-headline text-base sm:text-lg font-bold text-on-surface tracking-tight">MUST &mdash; Critical Path</h2>
              <span class="font-mono text-xs px-2.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-semibold">{len(week['must_tasks'])} Tasks &bull; ~{must_hours}h</span>
            </div>
            <span class="font-mono text-[11px] text-on-surface-variant/80 hidden sm:inline-block">Non-negotiable core curriculum</span>
          </div>

          <div class="flex flex-col gap-4">
            {must_sections_joined}
          </div>
        </section>

        <!-- SHOULD — Depth & Mastery Section -->
        <section class="rounded-xl cockpit-glass overflow-hidden shadow-xl border border-white/5 flex flex-col" id="section-should">
          <div class="px-5 py-3.5 border-b border-outline-variant/15 flex items-center justify-between gap-3 bg-surface-container-lowest/50">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
              <h3 class="font-headline text-sm font-semibold text-on-surface">SHOULD &mdash; Depth &amp; Mastery</h3>
              <span class="font-mono text-xs text-purple-300/80">({len(week['should_tasks'])} Tasks)</span>
            </div>
            <span class="font-mono text-[11px] text-on-surface-variant/70">Execute when MUST pace is on track</span>
          </div>
          <div class="divide-y divide-outline-variant/10 text-body">
            {should_cards_joined}
          </div>
        </section>

        <!-- STRETCH — If Ahead Section -->
        <section class="rounded-xl cockpit-glass overflow-hidden shadow-xl border border-white/5 flex flex-col" id="section-stretch">
          <div class="px-5 py-3.5 border-b border-outline-variant/15 flex items-center justify-between gap-3 bg-surface-container-lowest/50">
            <div class="flex items-center gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-violet-400/80"></span>
              <h3 class="font-headline text-sm font-semibold text-on-surface">STRETCH &mdash; If Ahead</h3>
              <span class="font-mono text-xs text-violet-300/80">({len(week['stretch_tasks'])} Tasks)</span>
            </div>
            <span class="font-mono text-[11px] text-on-surface-variant/70">Bonus reps &amp; competitive advantage</span>
          </div>
          <div class="divide-y divide-outline-variant/10 text-body">
            {stretch_cards_joined}
          </div>
        </section>

        <!-- ✅ Weekly Clearance Gate Section -->
        <section class="rounded-xl cockpit-glass overflow-hidden shadow-xl border border-primary/20 flex flex-col" id="section-gate">
          <div class="px-5 py-3.5 border-b border-outline-variant/15 flex items-center justify-between gap-3 bg-surface-container-lowest/50">
            <div class="flex items-center gap-2.5">
              <span class="material-symbols-outlined text-[20px] text-primary">verified_user</span>
              <h3 class="font-headline text-sm font-semibold text-on-surface">Weekly Clearance Gate</h3>
            </div>
            <span class="font-mono text-xs px-2.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold" id="gate-status-pill">0 / {len(week['gates'])} Cleared</span>
          </div>
          <div class="divide-y divide-outline-variant/10 text-body">
            {gate_cards_joined}
          </div>
        </section>

        {if_behind_html}

        <!-- Reflection & Technical Notes Journal -->
        <section class="rounded-xl cockpit-glass overflow-hidden shadow-xl border border-white/5 p-5 sm:p-6 flex flex-col gap-4" id="journal">
          <div class="flex items-center gap-2.5 pb-3 border-b border-outline-variant/15">
            <span class="material-symbols-outlined text-[18px] text-primary">edit_note</span>
            <h3 class="text-sm font-semibold text-on-surface tracking-tight">Week {w_pad} Technical Notes &amp; Journal</h3>
          </div>
          <div class="relative rounded-lg bg-surface-container-lowest/60 border border-outline-variant/20 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-all p-3.5">
            <textarea class="w-full bg-transparent font-mono text-xs text-on-surface leading-relaxed placeholder:text-outline/50 border-0 outline-none focus:outline-none focus:ring-0 focus:border-transparent resize-none overflow-hidden block" style="outline: none !important; box-shadow: none !important; border: none !important;" id="week-notes" placeholder="Type Markdown notes, LeetCode edge-cases, Kaggle validation scores, OA post-mortems..." rows="5"></textarea>
          </div>
          <div class="flex items-center gap-1.5 pt-1">
            <span class="px-2 py-0.5 rounded bg-surface-container border border-outline-variant/20 font-mono text-[10px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">#LeetCode</span>
            <span class="px-2 py-0.5 rounded bg-surface-container border border-outline-variant/20 font-mono text-[10px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">#Java</span>
            <span class="px-2 py-0.5 rounded bg-surface-container border border-outline-variant/20 font-mono text-[10px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">#DSA</span>
            <span class="px-2 py-0.5 rounded bg-surface-container border border-outline-variant/20 font-mono text-[10px] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">#Week{w_pad}</span>
          </div>
        </section>

      </div>
    </div>
  </main>

  <script src="../js/dashboard-summary.js?v={BUILD_VERSION}"></script>
  <script src="../js/app.js?v={BUILD_VERSION}"></script>
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
            task_count = w['total_tasks']
            must_h = w['must_hours']
            cap_h = w['cap_hours']

            week_tiles.append(f'''
            <a href="weeks/week-{padded}.html" class="p-3 rounded-lg cockpit-subglass flex flex-col justify-between hover:border-primary/50 transition-colors group cursor-pointer" id="dash-week-{num}">
              <div class="flex items-center justify-between mb-1.5">
                <span class="font-mono text-[11px] text-on-surface font-semibold">WEEK {padded}</span>
                <span class="material-symbols-outlined text-[15px] text-outline-variant group-hover:text-primary transition-colors">arrow_forward</span>
              </div>
              <span class="text-xs text-on-surface font-medium truncate mb-2">{title}</span>
              <div class="flex items-center justify-between">
                <span class="font-mono text-[10px] text-on-surface-variant week-task-count" id="dash-week-{num}-tasks">{task_count} Tasks &bull; {must_h}h</span>
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
  <title>अभ्यास</title>
  <meta name="google-site-verification" content="uKnD8wt6kniI25IpAMVkaCIqsAQ9eGbGhSE2MGY5CPc" />
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <meta name="description" content="अभ्यास: 50-Week Placement Engineering Roadmap. Track daily progress, streaks, and focus queues.">
  <meta property="og:title" content="अभ्यास">
  <meta property="og:description" content="अभ्यास: 50-Week Placement Engineering Roadmap. Track daily progress, streaks, and focus queues.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://track.swarajkanse.me/">
  <meta property="og:site_name" content="अभ्यास">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="अभ्यास">
  <meta name="twitter:description" content="अभ्यास: 50-Week Placement Engineering Roadmap.">
  <meta name="theme-color" content="#121316">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400;1,500;1,600&family=Rozha+One&family=Yatra+One&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,400,0..1,0" rel="stylesheet">
  <link rel="stylesheet" href="css/tailwind.min.css?v={BUILD_VERSION}">
  <link rel="stylesheet" href="css/style.css?v={BUILD_VERSION}">
</head>
<body class="bg-background font-body text-on-surface antialiased selection:bg-primary selection:text-on-primary min-h-screen relative overflow-x-hidden transition-colors duration-200">

  <!-- Subtle Ambient Glow Overlay -->
  <div class="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[850px] h-[340px] bg-gradient-to-b from-primary/10 via-primary/3 to-transparent blur-3xl -z-10 dark:opacity-70 opacity-30"></div>

  <!-- Main Executive Console Content -->
  <main class="w-full pt-8 sm:pt-10 pb-16 min-h-screen">
    <div class="max-w-6xl mx-auto px-6">
      <div class="flex flex-col w-full gap-7">

        <!-- Brand Masthead (Top Center अभ्यास) -->
        <header class="flex items-center justify-center pt-2 pb-2 select-none">
          <h1 class="font-calligraphy text-on-surface font-normal leading-none tracking-wide text-center" style="font-size: 3.5rem;">अभ्यास</h1>
        </header>

        <!-- 1. Executive Vitals Bar (Hero Metrics) -->
        <section class="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200 md:col-span-1">
            <div class="text-xs text-on-surface-variant font-medium mb-1">Target Countdown</div>
            <div class="font-mono text-2xl font-bold tracking-tight text-on-surface">
              <span id="vitals-countdown-val">487d</span> <span class="text-xs text-on-surface-variant font-normal">remaining</span>
            </div>
            <div class="mt-2 text-[11px] text-on-surface-variant">Target: July 2027</div>
          </div>

          <div class="p-4 rounded-xl cockpit-glass hover:border-primary/40 transition-all duration-200 md:col-span-3 flex flex-col justify-between">
            <div>
              <div class="text-xs text-on-surface-variant font-medium mb-1">Overall Progress</div>
              <div class="font-mono text-2xl font-bold text-on-surface tracking-tight" id="stat-pct-done">0.0%</div>
            </div>
            <div class="w-full h-1.5 rounded-full bg-surface-container overflow-hidden mt-3">
              <div class="h-full bg-primary rounded-full transition-all duration-500" id="global-progress-bar" style="width: 0%"></div>
            </div>
          </div>
        </section>

        <!-- 2. Activity Heatmap -->
        <section class="p-5 sm:p-6 rounded-2xl bg-[#1c1c1f] border border-white/[0.06] shadow-xl flex flex-col gap-4" id="telemetry">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-white text-lg sm:text-xl tracking-tight" id="heatmap-total-completed">0</span>
              <span class="text-xs sm:text-sm text-zinc-400 font-normal">tasks completion in past one year</span>
            </div>
            <div class="flex items-center gap-4 text-xs text-zinc-400 font-normal">
              <div>Total active days: <span class="text-white font-medium ml-1" id="heatmap-active-days">0</span></div>
              <div>Max streak: <span class="text-white font-medium ml-1" id="heatmap-max-streak">0</span></div>
            </div>
          </div>

          <div class="overflow-x-auto pb-1 no-scrollbar">
            <div class="flex items-start justify-between gap-1.5 sm:gap-2 select-none w-full min-w-[850px]" id="heatmap-months-container">
              <!-- Populated dynamically by app.js -->
            </div>
          </div>
        </section>

        <!-- 3. 10-Phase Placement Roadmap (Quiet Accordion) -->
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

        <!-- 5. Wisdom & Quote Matrix -->
        <section class="rounded-xl cockpit-glass border border-white/5 overflow-hidden" id="quote-matrix-card">
          <div class="p-7 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
            <div class="flex-1 flex flex-col justify-center relative min-h-[220px] md:h-[300px] w-full pr-4">
              <div id="quote-text-container" class="transition-opacity duration-300 ease-out opacity-100 flex flex-col justify-center">
                <p id="quote-text" class="quote-text-sanskrit text-[26px] sm:text-[32px] md:text-[36px] text-on-surface font-normal leading-[1.35] tracking-wide">
                  “कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।”
                </p>
                
                <div class="mt-4 flex items-center text-xs sm:text-sm text-primary/80 font-medium">
                  <span id="quote-author" class="quote-author-style">
                    — Shri Krishna
                  </span>
                </div>
              </div>

              <div class="absolute bottom-1 left-0 flex items-center gap-1.5" id="quote-dots-indicator"></div>
            </div>

            <div class="flex-shrink-0 flex items-center justify-end h-[300px]">
              <canvas id="quote-dot-canvas" class="h-[300px] object-contain rounded-lg transition-opacity duration-300 ease-in-out opacity-100 block"></canvas>
            </div>
          </div>
        </section>

      </div>
    </div>
  </main>

  <script src="js/dashboard-summary.js?v={BUILD_VERSION}"></script>
  <script src="js/quotes-data.js?v={BUILD_VERSION}"></script>
  <script src="js/quote-matrix.js?v={BUILD_VERSION}"></script>
  <script src="js/app.js?v={BUILD_VERSION}"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {{
      if (window.DASHBOARD_DATA) {{
        initDashboard(window.DASHBOARD_DATA);
      }} else if (window.ROADMAP_DATA) {{
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
    print("Parsing v6.2 roadmap files...")
    roadmap = parse_roadmap()
    print(f"Parsed {len(roadmap)} weeks.")

    # 1. Compact Dashboard Summary
    dashboard_data = []
    for w in roadmap:
        days_clean = []
        for d in w['days']:
            tasks_clean = []
            for t in d['tasks']:
                tasks_clean.append({
                    'id': t['id'],
                    'priority': t.get('priority', 'must'),
                    'track_id': t['track_id'],
                    'track_tag': t.get('track_tag', 'CORE'),
                    'title': t.get('title', ''),
                    'desc': t.get('desc', ''),
                    'hours': t.get('hours', 2.0),
                    'is_review': t.get('is_review', False)
                })
            days_clean.append({
                'day_code': d['day_code'],
                'day_name': d['day_name'],
                'tasks': tasks_clean
            })
        dashboard_data.append({
            'week_num': w['week_num'],
            'phase_num': w['phase_num'],
            'title': w['title'],
            'focus': w.get('focus', ''),
            'must_hours': w['must_hours'],
            'cap_hours': w['cap_hours'],
            'cap_label': w['cap_label'],
            'total_tasks': w['total_tasks'],
            'days': days_clean
        })

    with open('js/dashboard-summary.js', 'w', encoding='utf-8') as f:
        f.write("window.DASHBOARD_DATA = ")
        json.dump(dashboard_data, f, ensure_ascii=False, separators=(',', ':'))
        f.write(";\n")
    print("Written js/dashboard-summary.js (compact)")

    # 2. Legacy full roadmap dataset
    with open('js/roadmap-data.js', 'w', encoding='utf-8') as f:
        f.write("window.ROADMAP_DATA = ")
        json.dump(roadmap, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print("Written js/roadmap-data.js")

    dash_html = generate_dashboard(roadmap)
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(dash_html)
    print("Written index.html")

    os.makedirs('weeks', exist_ok=True)
    for w in roadmap:
        pad = f"{w['week_num']:02d}"
        filepath = f"weeks/week-{pad}.html"
        week_html = generate_week_page(w, len(roadmap), roadmap)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(week_html)
    print(f"Generated {len(roadmap)} weekly HTML pages in weeks/")

    # 3. Compile purged production Tailwind CSS bundle
    print("Compiling production Tailwind CSS bundle...")
    try:
        import subprocess
        res = subprocess.run(
            ["npx", "-y", "tailwindcss@3", "-i", "./css/tailwind-input.css", "-o", "./css/tailwind.min.css", "--minify"],
            capture_output=True,
            text=True,
            shell=True
        )
        if res.returncode == 0:
            print("Successfully compiled css/tailwind.min.css")
        else:
            print("Tailwind compile notice:", res.stderr or res.stdout)
    except Exception as e:
        print("Tailwind compile warning:", e)

if __name__ == '__main__':
    main()
