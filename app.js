/* ===================================================================
   PA S4PD — Logik Aplikasi
=================================================================== */

const API = (window.PA_CONFIG && window.PA_CONFIG.API_URL) || '';

const CAT_COLORS = {
  'Mesyuarat':    '#2563EB',
  'Lawatan':      '#059669',
  'Majlis Rasmi': '#DC2626',
  'Bengkel':      '#7C3AED'
};

const PAKAIAN_CLASS = {
  'Baju Batik':    'badge-batik',
  'Baju Korporat': 'badge-korporat',
  'Baju Kerja':    'badge-kerja',
  'Uniform':       'badge-uniform',
  'Kasual':        'badge-kasual'
};

const MAX_FILE = 10 * 1024 * 1024; // 10MB
const OK_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const OK_EXT = ['pdf', 'png', 'jpg', 'jpeg'];

const state = {
  role: null,      // 'admin' | 'guest'
  code: null,
  events: [],      // data mentah dari Sheet
  calendar: null,
  editingId: null,
  attach: { mode: 'empty' } // empty | keep | new | remove
};

const $ = function (id) { return document.getElementById(id); };

/* ============================ API ============================ */

async function callApi(payload) {
  if (!API || API.indexOf('TAMPAL') === 0) {
    throw new Error('URL API belum ditetapkan dalam config.js');
  }
  payload.code = state.code;
  const res = await fetch(API, {
    method: 'POST',
    // text/plain mengelak CORS preflight untuk Apps Script.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Ralat tidak diketahui.');
  return data;
}

/* ============================ AUTH / GERBANG ============================ */

function initGate() {
  // Sesi sedia ada?
  const saved = sessionStorage.getItem('pa_s4pd');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      state.role = s.role; state.code = s.code;
      enterApp();
      return;
    } catch (e) { /* abaikan, papar gerbang */ }
  }

  $('gate-btn').addEventListener('click', submitGate);
  $('gate-code').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submitGate();
  });
  $('gate-code').focus();
}

async function submitGate() {
  const code = $('gate-code').value.trim();
  const msg = $('gate-msg');
  if (!code) { msg.textContent = 'Sila masukkan kod akses.'; return; }

  $('gate-btn').disabled = true;
  $('gate-btn').textContent = 'Menyemak…';
  msg.textContent = '';

  try {
    state.code = code;
    const res = await callApi({ action: 'verify' });
    if (!res.role) {
      msg.textContent = 'Kod akses tidak sah.';
      state.code = null;
      return;
    }
    state.role = res.role;
    sessionStorage.setItem('pa_s4pd', JSON.stringify({ role: res.role, code: code }));
    enterApp();
  } catch (err) {
    msg.textContent = err.message;
    state.code = null;
  } finally {
    $('gate-btn').disabled = false;
    $('gate-btn').textContent = 'Masuk';
  }
}

function logout() {
  sessionStorage.removeItem('pa_s4pd');
  location.reload();
}

/* ============================ MASUK APP ============================ */

function enterApp() {
  $('gate').hidden = true;
  $('app').hidden = false;

  const isAdmin = state.role === 'admin';
  const badge = $('role-badge');
  badge.textContent = isAdmin ? 'Admin' : 'Tatapan';
  badge.className = 'role-badge' + (isAdmin ? ' admin' : '');

  // Tunjuk butang admin sahaja jika admin.
  $('btn-add').hidden = !isAdmin;
  $('btn-report').hidden = !isAdmin;

  buildLegend();
  bindAppEvents();
  initCalendar();
  loadEvents();
}

function buildLegend() {
  const html = Object.keys(CAT_COLORS).map(function (k) {
    return '<span class="legend-item"><span class="legend-dot" style="background:' +
      CAT_COLORS[k] + '"></span>' + k + '</span>';
  }).join('');
  $('legend').innerHTML = html;
}

function bindAppEvents() {
  $('btn-logout').addEventListener('click', logout);
  $('btn-add').addEventListener('click', function () { openForm(null); });
  $('btn-report').addEventListener('click', generateReport);

  $('search').addEventListener('input', applyFilters);
  $('f-kategori').addEventListener('change', applyFilters);
  $('f-pakaian').addEventListener('change', applyFilters);
  $('f-mod').addEventListener('change', applyFilters);

  $('btn-save').addEventListener('click', saveEvent);
  $('btn-edit').addEventListener('click', function () { openForm(state.editingId); });
  $('btn-delete').addEventListener('click', deleteCurrent);

  $('i-fail').addEventListener('change', onFileSelected);
  $('attach-info').addEventListener('click', onAttachInfoClick);

  // Tutup modal (backdrop / butang [data-close])
  document.querySelectorAll('[data-close]').forEach(function (el) {
    el.addEventListener('click', closeModals);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModals();
  });
}

/* ============================ KALENDAR ============================ */

function initCalendar() {
  state.calendar = new FullCalendar.Calendar($('calendar'), {
    locale: 'ms',
    initialView: 'dayGridMonth',
    height: 'auto',
    firstDay: 1,
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    buttonText: { today: 'Hari Ini' },
    dayMaxEvents: 3,
    eventClick: function (info) {
      info.jsEvent.preventDefault();
      openDetail(info.event.extendedProps.raw);
    }
  });
  state.calendar.render();
}

async function loadEvents() {
  try {
    const res = await callApi({ action: 'list' });
    state.events = res.data || [];
    applyFilters();
  } catch (err) {
    toast(err.message, true);
  }
}

function renderEvents(list) {
  const cal = state.calendar;
  cal.removeAllEvents();
  list.forEach(function (ev) {
    const color = CAT_COLORS[ev.kategori] || '#64748B';
    cal.addEvent({
      title: ev.agenda || '(Tiada agenda)',
      start: ev.tarikhMula,
      end: addDay(ev.tarikhAkhir || ev.tarikhMula), // end eksklusif → +1 hari
      allDay: true,
      backgroundColor: color,
      extendedProps: { raw: ev }
    });
  });
}

// FullCalendar all-day end bersifat eksklusif; tambah 1 hari supaya julat dipapar inklusif.
// Nota: semua kiraan dalam UTC supaya bebas zon waktu pelayar (elak off-by-one di UTC+8).
function addDay(dateStr) {
  if (!dateStr) return undefined;
  const p = dateStr.split('-');
  const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* ============================ CARIAN & PENAPIS ============================ */

function applyFilters() {
  const q = $('search').value.trim().toLowerCase();
  const fk = $('f-kategori').value;
  const fp = $('f-pakaian').value;
  const fm = $('f-mod').value;

  const filtered = state.events.filter(function (ev) {
    if (fk && ev.kategori !== fk) return false;
    if (fp && ev.pakaian !== fp) return false;
    if (fm && ev.modPerjalanan !== fm) return false;
    if (q) {
      const hay = [ev.agenda, ev.tempat, ev.pic, ev.jawatanPic].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  renderEvents(filtered);
}

/* ============================ MODAL: DETAIL ============================ */

function openDetail(ev) {
  state.editingId = ev.id;

  const cat = $('d-kategori');
  cat.textContent = ev.kategori || '—';
  cat.style.background = CAT_COLORS[ev.kategori] || '#64748B';

  $('d-agenda').textContent = ev.agenda || '(Tiada agenda)';
  $('d-tarikh').textContent = formatRange(ev.tarikhMula, ev.tarikhAkhir);
  $('d-masa').textContent = ev.masa || '—';
  $('d-tempat').textContent = ev.tempat || '—';

  $('d-pakaian').innerHTML = ev.pakaian
    ? '<span class="badge ' + (PAKAIAN_CLASS[ev.pakaian] || 'badge-kerja') + '">' + esc(ev.pakaian) + '</span>'
    : '—';
  $('d-mod').innerHTML = ev.modPerjalanan
    ? '<span class="badge badge-mod">' + esc(ev.modPerjalanan) + '</span>'
    : '—';

  const picText = ev.pic
    ? esc(ev.pic) + (ev.jawatanPic ? ' <span style="color:var(--ink-faint)">· ' + esc(ev.jawatanPic) + '</span>' : '')
    : '—';
  $('d-pic').innerHTML = picText;

  // Butang call
  const call = $('d-call');
  if (ev.telefon) {
    call.style.display = '';
    call.href = 'tel:' + ev.telefon.replace(/\s+/g, '');
    $('d-call-label').textContent = 'Hubungi ' + (ev.pic || 'PIC') + ' · ' + ev.telefon;
  } else {
    call.style.display = 'none';
  }

  // Lampiran
  const attachBox = $('d-attach');
  if (ev.attachmentUrl) {
    const id = fileIdFromUrl(ev.attachmentUrl);
    $('d-attach-link').href = ev.attachmentUrl;
    const thumb = $('d-attach-thumb');
    if (id) {
      thumb.style.display = '';
      thumb.src = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w600';
      thumb.onerror = function () { thumb.style.display = 'none'; };
    } else {
      thumb.style.display = 'none';
    }
    attachBox.hidden = false;
  } else {
    attachBox.hidden = true;
  }

  // Butang admin
  const foot = document.querySelector('#modal-detail .modal-foot');
  foot.hidden = state.role !== 'admin';

  $('modal-detail').hidden = false;
}

function formatRange(mula, akhir) {
  if (!mula) return '—';
  if (!akhir || akhir === mula) return prettyDate(mula);
  return prettyDate(mula) + ' – ' + prettyDate(akhir);
}

function prettyDate(s) {
  if (!s) return '';
  const bulan = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
  const p = s.split('-');
  if (p.length !== 3) return s;
  return parseInt(p[2], 10) + ' ' + bulan[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

/* ============================ MODAL: BORANG ============================ */

function openForm(id) {
  closeModals();
  state.editingId = id;
  $('form-title').textContent = id ? 'Edit Jadual' : 'Kemaskini Jadual';
  $('form-msg').textContent = '';

  const fields = ['tarikhMula','tarikhAkhir','agenda','kategori','masaMula','masaTamat','tempat','pakaian','mod','pic','jawatanPic','telefon'];
  fields.forEach(function (f) { $('i-' + f).value = ''; });

  // Reset keadaan lampiran.
  $('i-fail').value = '';
  state.attach = { mode: 'empty' };

  if (id) {
    const ev = state.events.find(function (e) { return e.id === id; });
    if (ev) {
      $('i-tarikhMula').value = ev.tarikhMula || '';
      $('i-tarikhAkhir').value = ev.tarikhAkhir || '';
      $('i-agenda').value = ev.agenda || '';
      $('i-kategori').value = ev.kategori || '';
      splitMasa(ev.masa || '');
      $('i-tempat').value = ev.tempat || '';
      $('i-pakaian').value = ev.pakaian || '';
      $('i-mod').value = ev.modPerjalanan || '';
      $('i-pic').value = ev.pic || '';
      $('i-jawatanPic').value = ev.jawatanPic || '';
      $('i-telefon').value = ev.telefon || '';
      if (ev.attachmentUrl) state.attach = { mode: 'keep', url: ev.attachmentUrl };
    }
  }
  renderAttachInfo();
  $('modal-form').hidden = false;
}

/* ---- Lampiran ---- */

async function onFileSelected() {
  const file = $('i-fail').files[0];
  if (!file) return;

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const typeOk = OK_TYPES.indexOf(file.type) !== -1 || OK_EXT.indexOf(ext) !== -1;
  if (!typeOk) {
    $('form-msg').textContent = 'Jenis fail tidak dibenarkan. Hanya PDF, JPG atau PNG.';
    $('i-fail').value = '';
    return;
  }
  if (file.size > MAX_FILE) {
    $('form-msg').textContent = 'Fail terlalu besar (maks 10MB). Saiz fail: ' + (file.size / 1048576).toFixed(1) + 'MB.';
    $('i-fail').value = '';
    return;
  }

  $('form-msg').textContent = '';
  try {
    const base64 = await readFileBase64(file);
    state.attach = {
      mode: 'new',
      base64: base64,
      filename: file.name,
      mimetype: file.type || 'application/octet-stream'
    };
    renderAttachInfo();
  } catch (err) {
    $('form-msg').textContent = err.message;
    $('i-fail').value = '';
  }
}

function onAttachInfoClick(e) {
  const act = e.target.getAttribute('data-attach');
  if (!act) return;
  e.preventDefault();
  if (act === 'remove') state.attach = { mode: 'remove' };
  if (act === 'undo-remove') state.attach = { mode: 'keep', url: state.attach.url };
  if (act === 'cancel-new') { $('i-fail').value = ''; state.attach = state.attach.url ? { mode: 'keep', url: state.attach.url } : { mode: 'empty' }; }
  renderAttachInfo();
}

function renderAttachInfo() {
  const box = $('attach-info');
  const a = state.attach;
  let html = '';

  if (a.mode === 'new') {
    html = '<span class="attach-pill ok"><svg viewBox="0 0 24 24" class="ic-sm"><path d="M20 6L9 17l-5-5"/></svg>Fail baru: ' +
      esc(a.filename) + '</span> <a href="#" data-attach="cancel-new" class="attach-act">Batal</a>';
    // Sembunyikan input fail bila dah pilih, supaya kemas.
    box.hidden = false;
  } else if (a.mode === 'keep') {
    html = '<span class="attach-pill"><svg viewBox="0 0 24 24" class="ic-sm"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
      'Lampiran sedia ada</span> <a href="' + esc(a.url) + '" target="_blank" rel="noopener" class="attach-act">Lihat</a>' +
      ' <a href="#" data-attach="remove" class="attach-act danger">Buang</a>';
    box.hidden = false;
  } else if (a.mode === 'remove') {
    html = '<span class="attach-pill warn">Lampiran akan dibuang apabila disimpan</span> ' +
      '<a href="#" data-attach="undo-remove" class="attach-act">Undur</a>';
    box.hidden = false;
  } else {
    box.hidden = true;
  }
  box.innerHTML = html;

  // Sembunyikan input fail jika fail baru dipilih atau ada lampiran dikekalkan.
  $('i-fail').style.display = (a.mode === 'new') ? 'none' : '';
}

function readFileBase64(file) {
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () {
      const s = String(r.result);
      const i = s.indexOf(',');
      resolve(i === -1 ? s : s.slice(i + 1));
    };
    r.onerror = function () { reject(new Error('Gagal membaca fail.')); };
    r.readAsDataURL(file);
  });
}

function fileIdFromUrl(url) {
  if (!url) return '';
  let m = url.match(/\/d\/([-\w]+)/);
  if (m) return m[1];
  m = url.match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

async function saveEvent() {
  const ev = {
    tarikhMula:    $('i-tarikhMula').value,
    tarikhAkhir:   $('i-tarikhAkhir').value || $('i-tarikhMula').value,
    agenda:        $('i-agenda').value.trim(),
    kategori:      $('i-kategori').value,
    masa:          joinMasa(),
    tempat:        $('i-tempat').value.trim(),
    pakaian:       $('i-pakaian').value,
    modPerjalanan: $('i-mod').value,
    pic:           $('i-pic').value.trim(),
    jawatanPic:    $('i-jawatanPic').value.trim(),
    telefon:       $('i-telefon').value.trim()
  };

  const msg = $('form-msg');
  if (!ev.tarikhMula) { msg.textContent = 'Sila isi Tarikh Mula.'; return; }
  if (!ev.agenda)     { msg.textContent = 'Sila isi Agenda.'; return; }
  if (!ev.kategori)   { msg.textContent = 'Sila pilih Kategori.'; return; }
  if (ev.tarikhAkhir < ev.tarikhMula) { msg.textContent = 'Tarikh Akhir tidak boleh sebelum Tarikh Mula.'; return; }

  $('btn-save').disabled = true;
  const a = state.attach;
  $('btn-save').textContent = (a.mode === 'new') ? 'Memuat naik…' : 'Menyimpan…';

  // Bina arahan lampiran untuk backend.
  let attachment = null;
  if (a.mode === 'new')    attachment = { base64: a.base64, filename: a.filename, mimetype: a.mimetype };
  if (a.mode === 'remove') attachment = { remove: true };

  try {
    if (state.editingId) {
      await callApi({ action: 'update', id: state.editingId, event: ev, attachment: attachment });
      toast('Jadual dikemaskini.');
    } else {
      await callApi({ action: 'add', event: ev, attachment: attachment });
      toast('Jadual ditambah.');
    }
    closeModals();
    await loadEvents();
  } catch (err) {
    msg.textContent = err.message;
  } finally {
    $('btn-save').disabled = false;
    $('btn-save').textContent = 'Simpan';
  }
}

async function deleteCurrent() {
  const ev = state.events.find(function (e) { return e.id === state.editingId; });
  const nama = ev ? ev.agenda : 'event ini';
  if (!confirm('Padam "' + nama + '"? Tindakan ini tidak boleh dibatalkan.')) return;

  try {
    await callApi({ action: 'delete', id: state.editingId });
    toast('Jadual dipadam.');
    closeModals();
    await loadEvents();
  } catch (err) {
    toast(err.message, true);
  }
}

/* ============================ LAPORAN PDF ============================ */

function generateReport() {
  const view = state.calendar.view;
  const start = view.currentStart; // awal bulan dipapar
  const year = start.getFullYear();
  const month = start.getMonth();

  const bulanNama = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];

  // Saring event yang BERMULA dalam bulan dipapar.
  const inMonth = state.events.filter(function (ev) {
    if (!ev.tarikhMula) return false;
    const d = new Date(ev.tarikhMula + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  }).sort(function (a, b) { return a.tarikhMula.localeCompare(b.tarikhMula); });

  if (inMonth.length === 0) {
    toast('Tiada program untuk ' + bulanNama[month] + ' ' + year + '.', true);
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Header rasmi
  doc.setFillColor(10, 68, 89);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('LAPORAN PERGERAKAN BULANAN', 14, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('PA S4PD · Sektor Perancangan & Pengurusan PPD', 14, 19);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text(bulanNama[month] + ' ' + year, pageW - 14, 15, { align: 'right' });

  // Ringkasan statistik
  const byCat = {};
  inMonth.forEach(function (ev) { byCat[ev.kategori] = (byCat[ev.kategori] || 0) + 1; });
  const ringkasan = Object.keys(byCat).map(function (k) { return k + ': ' + byCat[k]; }).join('   |   ');

  doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('Jumlah program: ' + inMonth.length, 14, 35);
  doc.setFontSize(9); doc.setTextColor(90, 90, 90);
  doc.text(ringkasan, 14, 41);

  // Jadual
  const rows = inMonth.map(function (ev, i) {
    return [
      i + 1,
      formatRange(ev.tarikhMula, ev.tarikhAkhir),
      ev.agenda || '',
      ev.kategori || '',
      ev.tempat || '',
      ev.masa || '',
      ev.pakaian || '',
      (ev.pic || '') + (ev.jawatanPic ? '\n(' + ev.jawatanPic + ')' : '')
    ];
  });

  doc.autoTable({
    startY: 46,
    head: [['#', 'Tarikh', 'Agenda', 'Kategori', 'Tempat', 'Masa', 'Pakaian', 'PIC']],
    body: rows,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, valign: 'middle' },
    headStyles: { fillColor: [15, 93, 122], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [243, 247, 249] },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 34 } },
    margin: { left: 14, right: 14 }
  });

  // Footer setiap halaman
  const pages = doc.internal.getNumberOfPages();
  const tarikhJana = new Date().toLocaleDateString('ms-MY');
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text('Dijana pada ' + tarikhJana, 14, h - 8);
    doc.text('Halaman ' + p + ' / ' + pages, pageW - 14, h - 8, { align: 'right' });
  }

  doc.save('Laporan_PA_S4PD_' + bulanNama[month] + '_' + year + '.pdf');
  toast('Laporan dijana.');
}

/* ============================ UTIL ============================ */

// Gabungkan dua pemilih masa jadi satu string untuk simpanan.
function joinMasa() {
  const mula = $('i-masaMula').value;
  const tamat = $('i-masaTamat').value;
  if (mula && tamat) return mula + ' - ' + tamat;
  if (mula) return mula;
  if (tamat) return tamat;
  return '';
}

// Pecahkan string masa simpanan kembali ke dua pemilih (untuk edit).
function splitMasa(masa) {
  $('i-masaMula').value = '';
  $('i-masaTamat').value = '';
  const pad = function (t) { const p = t.split(':'); return (p[0].length < 2 ? '0' : '') + p[0] + ':' + p[1]; };
  let m = masa.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (m) { $('i-masaMula').value = pad(m[1]); $('i-masaTamat').value = pad(m[2]); return; }
  m = masa.match(/(\d{1,2}:\d{2})/);
  if (m) $('i-masaMula').value = pad(m[1]);
}

function closeModals() {
  $('modal-detail').hidden = true;
  $('modal-form').hidden = true;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
}

/* ============================ MULA ============================ */
document.addEventListener('DOMContentLoaded', initGate);

// Daftar service worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('service-worker.js').catch(function () {});
  });
}
