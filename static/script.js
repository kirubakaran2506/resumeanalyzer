/* ═══════════════════════════════════════════════
   ResumeAI — Frontend Logic
   Handles: upload, drag & drop, API calls,
            result rendering, animations
═══════════════════════════════════════════════ */
'use strict';

// ── Elements ───────────────────────────────────────────
const uploadZone     = document.getElementById('uploadZone');
const fileInput      = document.getElementById('fileInput');
const browseBtn      = document.getElementById('browseBtn');
const uploadDefault  = document.getElementById('uploadDefault');
const uploadSelected = document.getElementById('uploadSelected');
const fileNameEl     = document.getElementById('fileName');
const removeFileBtn  = document.getElementById('removeFile');
const analyzeBtn     = document.getElementById('analyzeBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMsgEl   = document.getElementById('loadingMsg');
const loadingBarEl   = document.getElementById('loadingBar');
const dashboard      = document.getElementById('dashboard');
const hero           = document.getElementById('hero');
const resetBtn       = document.getElementById('resetBtn');
const toast          = document.getElementById('toast');
const toastMsg       = document.getElementById('toastMsg');

let selectedFile = null;

// ── Upload Interactions ────────────────────────────────
browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
uploadZone.addEventListener('click', () => { if (!selectedFile) fileInput.click(); });
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

// Drag & Drop
['dragenter','dragover'].forEach(evt =>
  uploadZone.addEventListener(evt, e => { e.preventDefault(); uploadZone.classList.add('drag-over'); })
);
['dragleave','drop'].forEach(evt =>
  uploadZone.addEventListener(evt, e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); })
);
uploadZone.addEventListener('drop', e => {
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});

// Remove file
removeFileBtn.addEventListener('click', e => {
  e.stopPropagation();
  resetUpload();
});

// ── File Validation ────────────────────────────────────
function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf','txt','text'].includes(ext)) {
    showToast('Only PDF or TXT files are supported.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File size exceeds 10MB limit.');
    return;
  }
  selectedFile = file;
  fileNameEl.textContent = file.name;
  uploadDefault.style.display = 'none';
  uploadSelected.style.display = 'block';
}

function resetUpload() {
  selectedFile = null;
  fileInput.value = '';
  uploadSelected.style.display = 'none';
  uploadDefault.style.display = 'block';
}

// ── Analyze ────────────────────────────────────────────
analyzeBtn.addEventListener('click', () => {
  if (!selectedFile) return;
  runAnalysis(selectedFile);
});

async function runAnalysis(file) {
  const fd = new FormData();
  fd.append('resume', file);
  showLoading();

  try {
    const res  = await fetch('/analyze', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed.');
    hideLoading();
    renderResults(data);
  } catch (err) {
    hideLoading();
    showToast(err.message || 'Something went wrong. Please try again.');
  }
}

// ── Loading Sequence ───────────────────────────────────
const STEPS = [
  { msg: 'Extracting text from document…',   pct: 18, chip: 'ls1' },
  { msg: 'Detecting skills with NLP…',        pct: 42, chip: 'ls2' },
  { msg: 'Computing resume score…',           pct: 62, chip: 'ls3' },
  { msg: 'Matching job roles…',               pct: 80, chip: 'ls4' },
  { msg: 'Generating improvement tips…',      pct: 94, chip: 'ls5' },
];

function showLoading() {
  loadingOverlay.style.display = 'flex';
  loadingBarEl.style.width = '0%';
  // reset chips
  STEPS.forEach(s => {
    const el = document.getElementById(s.chip);
    if (el) el.classList.remove('active');
  });
  const first = document.getElementById('ls1');
  if (first) first.classList.add('active');

  let i = 0;
  loadingOverlay._iv = setInterval(() => {
    if (i < STEPS.length) {
      loadingMsgEl.textContent = STEPS[i].msg;
      loadingBarEl.style.width = STEPS[i].pct + '%';
      // activate chip
      if (i > 0) {
        const prev = document.getElementById(STEPS[i-1].chip);
        if (prev) prev.classList.remove('active');
      }
      const cur = document.getElementById(STEPS[i].chip);
      if (cur) cur.classList.add('active');
      i++;
    } else {
      clearInterval(loadingOverlay._iv);
    }
  }, 650);
}

function hideLoading() {
  clearInterval(loadingOverlay._iv);
  loadingBarEl.style.width = '100%';
  setTimeout(() => { loadingOverlay.style.display = 'none'; }, 250);
}

// ── Render Results ─────────────────────────────────────
function renderResults(data) {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    hero.style.display = 'none';
    dashboard.style.display = 'block';
    renderScore(data);
    renderSkills(data.skill_categories, data.flat_skills);
    renderJobs(data.job_matches);
    renderTips(data.tips);
    renderStats(data);
  }, 150);
}

// ── Score Card ─────────────────────────────────────────
function renderScore({ score, score_label, score_color, breakdown }) {
  // Animate number
  animCount(document.getElementById('scoreNumber'), 0, score, 1400);

  // SVG ring
  const fill = document.getElementById('scFill');
  const circ = 2 * Math.PI * 68; // r=68 → ≈427
  fill.style.strokeDasharray  = circ;
  fill.style.strokeDashoffset = circ;
  setTimeout(() => {
    fill.style.strokeDashoffset = circ - (score / 100) * circ;
  }, 200);

  // Grade + description
  document.getElementById('scoreBadge').textContent = score_label;
  document.getElementById('scoreBadge').style.color = score_color;

  const descs = {
    'Excellent': 'Outstanding resume. Top-tier candidate.',
    'Good':      'Strong resume with minor gaps.',
    'Average':   'Solid foundation, needs refinement.',
    'Needs Work':'Several areas need improvement.',
    'Poor':      'Significant restructuring recommended.'
  };
  const descEl = document.getElementById('scoreDesc');
  if (descEl) descEl.textContent = descs[score_label] || '';

  // Breakdown bars
  const maxMap = { Skills:30, 'Contact Info':15, Experience:20, Education:10, Achievements:10, 'Action Verbs':10, Completeness:5 };
  const list = document.getElementById('breakdownList');
  list.innerHTML = '';
  Object.entries(breakdown).forEach(([key, val]) => {
    const max = maxMap[key] || 10;
    const pct = Math.round((val / max) * 100);
    const row = document.createElement('div');
    row.className = 'bd-row';
    row.innerHTML = `
      <span class="bd-name">${key}</span>
      <div class="bd-bar-wrap"><div class="bd-bar" data-pct="${pct}" style="width:0%"></div></div>
      <span class="bd-val">${val}</span>`;
    list.appendChild(row);
  });
  requestAnimationFrame(() => {
    document.querySelectorAll('.bd-bar').forEach(b => {
      setTimeout(() => { b.style.width = b.dataset.pct + '%'; }, 400);
    });
  });
}

// ── Skills Card ────────────────────────────────────────
const CAT_COLORS = {
  'Programming Languages': { border:'rgba(232,255,71,.25)', color:'#e8ff47', bg:'rgba(232,255,71,.07)' },
  'Web & Frontend':        { border:'rgba(71,200,255,.25)', color:'#47c8ff', bg:'rgba(71,200,255,.07)' },
  'Backend & Frameworks':  { border:'rgba(255,107,71,.25)', color:'#ff6b47', bg:'rgba(255,107,71,.07)' },
  'Data & AI/ML':          { border:'rgba(200,168,255,.25)', color:'#c8a8ff', bg:'rgba(200,168,255,.07)' },
  'Databases':             { border:'rgba(74,255,140,.25)', color:'#4aff8c', bg:'rgba(74,255,140,.07)' },
  'Cloud & DevOps':        { border:'rgba(255,200,71,.25)', color:'#ffc847', bg:'rgba(255,200,71,.07)' },
  'Tools & Practices':     { border:'rgba(255,255,255,.15)', color:'#aaaaaa', bg:'rgba(255,255,255,.04)' },
};

function renderSkills(cats, flat) {
  document.getElementById('skillCount').textContent = flat.length;
  const body = document.getElementById('skillsBody');
  body.innerHTML = '';
  if (!flat.length) {
    body.innerHTML = '<p style="color:var(--text-2);font-size:13px;font-family:var(--f-mono)">No skills detected. Ensure your PDF contains selectable text.</p>';
    return;
  }
  Object.entries(cats).forEach(([cat, skills]) => {
    const colors = CAT_COLORS[cat] || { border:'var(--border)', color:'var(--text-2)', bg:'var(--bg-3)' };
    const sec = document.createElement('div');
    sec.innerHTML = `<div class="skill-cat-name">${cat}</div>`;
    const tags = document.createElement('div');
    tags.className = 'skill-tags';
    skills.forEach((skill, i) => {
      const t = document.createElement('span');
      t.className = 'stag';
      t.textContent = skill;
      t.style.cssText = `border-color:${colors.border};color:${colors.color};background:${colors.bg};animation-delay:${i*0.05}s`;
      tags.appendChild(t);
    });
    sec.appendChild(tags);
    body.appendChild(sec);
  });
}

// ── Jobs Card ──────────────────────────────────────────
function renderJobs(jobs) {
  const body = document.getElementById('jobsBody');
  body.innerHTML = '';
  if (!jobs.length) {
    body.innerHTML = '<p style="color:var(--text-2);font-size:13px;font-family:var(--f-mono)">No strong matches found. Add more technical skills to your resume.</p>';
    return;
  }
  jobs.forEach((job, i) => {
    const row = document.createElement('div');
    row.className = 'job-row';
    row.innerHTML = `
      <span class="job-emoji">${job.icon}</span>
      <div class="job-info">
        <div class="job-title">${job.title}</div>
        <div class="job-sub">Compatibility score</div>
      </div>
      <span class="job-pct" id="jp_${i}">0%</span>`;
    body.appendChild(row);
    animCount(document.getElementById(`jp_${i}`), 0, job.match, 1300, '%');
  });
}

// ── Tips Card ──────────────────────────────────────────
function renderTips(tips) {
  const ul = document.getElementById('tipsList');
  ul.innerHTML = '';
  if (!tips.length) {
    ul.innerHTML = '<li style="color:var(--text-2);font-family:var(--f-mono);font-size:13px">Your resume looks solid! Keep updating it regularly.</li>';
    return;
  }
  tips.forEach((tip, i) => {
    const li = document.createElement('li');
    li.className = 'tip-row';
    li.style.animationDelay = (i * 0.07) + 's';
    li.innerHTML = `<span class="tip-num">${String(i+1).padStart(2,'0')}</span><span>${tip}</span>`;
    ul.appendChild(li);
  });
}

// ── Stats Footer ───────────────────────────────────────
function renderStats(data) {
  animCount(document.getElementById('wordCount'),  0, data.word_count,         1100);
  animCount(document.getElementById('charCount'),  0, data.char_count,         1100);
  animCount(document.getElementById('skillTotal'), 0, data.flat_skills.length, 900);
  animCount(document.getElementById('jobCount'),   0, data.job_matches.length, 800);
}

// ── Reset ──────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  dashboard.style.display = 'none';
  hero.style.display = 'grid';
  resetUpload();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Toast ──────────────────────────────────────────────
function showToast(msg) {
  toastMsg.textContent = msg;
  toast.style.display = 'flex';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.display = 'none'; }, 5000);
}

// ── Helpers ────────────────────────────────────────────
function animCount(el, from, to, dur, suffix = '') {
  if (!el) return;
  const start = performance.now();
  (function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * ease) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  })(start);
}
