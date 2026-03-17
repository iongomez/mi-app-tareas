// DOM references
const taskList = document.getElementById('taskList');
const subtitle = document.getElementById('subtitle');
const taskCountBadge = document.getElementById('taskCountBadge');
const widgetTitle = document.getElementById('widgetTitle');
const moreBtn = document.getElementById('moreBtn');
const taskMenu = document.getElementById('taskMenu');
const calendarWidgetEl = document.getElementById('calendarWidget');
const eventsWidgetEl = document.getElementById('eventsWidget');
const timeGridWidget = document.getElementById('timeGridWidget');

// ===== STATE =====
let currentView = 'inbox'; // 'inbox' | 'day'
let selectedDate = null;   // 'YYYY-MM-DD' or null
let droppedOnCalendar = false;
let currentUserId = null;
let tasks = [];

// ===== SUPABASE DB =====
async function dbLoad() {
  const { data, error } = await supabaseClient
    .from('tareas')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) { console.error('[DB] load:', error); return; }
  tasks = data.map(row => ({
    id: row.id,
    text: row.text,
    completed: row.completed,
    date: row.date,
    scheduled_time: row.scheduled_time || null,
  }));
}

async function dbAdd(task) {
  if (DEV_MODE) return { id: 'dev-' + Date.now(), text: task.text, completed: false, date: task.date, scheduled_time: task.scheduled_time || null };
  const { data, error } = await supabaseClient
    .from('tareas')
    .insert({ user_id: currentUserId, text: task.text, completed: false, date: task.date })
    .select()
    .single();
  if (error) { console.error('[DB] add:', error); return null; }
  return data;
}

function dbUpdate(id, changes) {
  if (DEV_MODE) return;
  supabaseClient.from('tareas').update(changes).eq('id', id)
    .then(({ error }) => { if (error) console.error('[DB] update:', error); });
}

function dbDelete(id) {
  if (DEV_MODE) return;
  supabaseClient.from('tareas').delete().eq('id', id)
    .then(({ error }) => { if (error) console.error('[DB] delete:', error); });
}

function dbDeleteMany(ids) {
  if (DEV_MODE) return;
  if (!ids.length) return;
  supabaseClient.from('tareas').delete().in('id', ids)
    .then(({ error }) => { if (error) console.error('[DB] deleteMany:', error); });
}

// ===== TAREAS INERTES =====
// Solo visibles en DEV_MODE (localhost). No se persisten en base de datos.
const DEV_TASKS = () => {
  const today = toISODate(new Date());
  const tomorrow = toISODate(new Date(Date.now() + 86400000));
  const nextWeek = toISODate(new Date(Date.now() + 7 * 86400000));
  const inTwoWeeks = toISODate(new Date(Date.now() + 14 * 86400000));
  return [
    { id: 'dev-1', text: 'Revisar diseño del dashboard (Dev)', completed: false, date: null, scheduled_time: null },
    { id: 'dev-2', text: 'Escribir los casos de uso (Dev)', completed: false, date: null, scheduled_time: null },
    { id: 'dev-3', text: 'Tarea completada de ejemplo (Dev)', completed: true, date: null, scheduled_time: null },
    { id: 'dev-4', text: 'Llamada con el equipo (Dev)', completed: false, date: today, scheduled_time: null },
    { id: 'dev-5', text: 'Revisar pull requests (Dev)', completed: false, date: today, scheduled_time: null },
    { id: 'dev-6', text: 'Demo con cliente (Dev)', completed: false, date: tomorrow, scheduled_time: null },
    { id: 'dev-7', text: 'Retrospectiva del sprint (Dev)', completed: false, date: nextWeek, scheduled_time: null },
    { id: 'dev-8', text: 'Planificación Q2 (Dev)', completed: false, date: inTwoWeeks, scheduled_time: null },
    { id: 'dev-9', text: 'Daily standup (Dev)', completed: false, date: today, scheduled_time: '09:00' },
    { id: 'dev-10', text: 'Revisión de diseño (Dev)', completed: false, date: tomorrow, scheduled_time: '10:30' },
  ];
};

// Called from auth.js when user signs in
async function loadTasks(userId) {
  currentUserId = userId;
  if (DEV_MODE) { tasks = DEV_TASKS(); } else { await dbLoad(); }
  render();
  renderCalendar();
}

// Called from auth.js when user signs out
function clearTasks() {
  tasks = [];
  currentUserId = null;
  render();
  renderCalendar();
}

// ===== TIME GRID CONSTANTS =====
const TIME_SLOTS = [];
for (let mins = 8 * 60; mins < 19 * 60; mins += 30) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
}

// ===== DATE HELPERS =====
function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun,1=Mon,...
  const diff = (day === 0) ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ===== TIME GRID STATE =====
let currentWeekStart = getWeekStart(new Date());
let timeDayDate = toISODate(new Date());

function formatDateLabel(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const todayStr = toISODate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toISODate(tomorrow);

  if (isoDate === todayStr) return 'Hoy';
  if (isoDate === tomorrowStr) return 'Mañana';
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatShortDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isoDate === toISODate(new Date())) return 'Hoy';
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function getDatesWithTasks() {
  const dates = new Set();
  tasks.forEach(t => { if (t.date) dates.add(t.date); });
  return dates;
}

function isOverdue(task) {
  if (!task.date || task.completed) return false;
  return task.date < toISODate(new Date());
}

function getOverdueTasks() {
  const todayStr = toISODate(new Date());
  return tasks.filter(t => t.date && t.date < todayStr && !t.completed);
}

// ===== VIEW SYSTEM =====
function getVisibleTasks() {
  const todayStr = toISODate(new Date());
  if (currentView === 'inbox') return tasks.filter(t => t.date === null);
  if (currentView === 'day') {
    const todayTasks = tasks.filter(t => t.date === selectedDate && !t.scheduled_time);
    if (selectedDate === todayStr) {
      const overdue = getOverdueTasks();
      return [...overdue, ...todayTasks];
    }
    return todayTasks;
  }
  if (currentView === 'planned') {
    return tasks.filter(t => t.date !== null && !t.scheduled_time);
  }
  if (currentView === 'week' || currentView === 'timeday') {
    return tasks.filter(t => t.date === null);
  }
  return tasks;
}

function switchToInbox() {
  currentView = 'inbox';
  selectedDate = null;
  hideTimeGrid();
  document.getElementById('navInbox').classList.add('active');
  document.getElementById('navToday').classList.remove('active');
  document.getElementById('navPlanned').classList.remove('active');
  document.getElementById('navWeek').classList.remove('active');
  document.getElementById('navTimeDay').classList.remove('active');
  render();
  renderCalendar();
}

function switchToDay(isoDate) {
  currentView = 'day';
  selectedDate = isoDate;
  hideTimeGrid();
  document.getElementById('navInbox').classList.remove('active');
  document.getElementById('navPlanned').classList.remove('active');
  document.getElementById('navWeek').classList.remove('active');
  document.getElementById('navTimeDay').classList.remove('active');
  document.getElementById('navToday').classList.toggle('active', isoDate === toISODate(new Date()));
  render();
  renderCalendar();
}

function switchToPlanned() {
  currentView = 'planned';
  selectedDate = null;
  hideTimeGrid();
  document.getElementById('navInbox').classList.remove('active');
  document.getElementById('navToday').classList.remove('active');
  document.getElementById('navWeek').classList.remove('active');
  document.getElementById('navTimeDay').classList.remove('active');
  document.getElementById('navPlanned').classList.add('active');
  render();
  renderCalendar();
}

function updateSubtitle() {
  const visible = getVisibleTasks();
  const pending = visible.filter(t => !t.completed).length;
  taskCountBadge.textContent = `(${visible.length})`;

  if (currentView === 'inbox') {
    widgetTitle.textContent = 'Inbox';
    subtitle.textContent = pending === 1 ? '1 tarea pendiente' : `${pending} tareas pendientes`;
  } else if (currentView === 'day' && selectedDate) {
    const label = formatDateLabel(selectedDate);
    widgetTitle.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    subtitle.textContent = pending === 1 ? '1 tarea pendiente' : `${pending} tareas pendientes`;
  } else if (currentView === 'planned') {
    widgetTitle.textContent = 'Planificadas';
    subtitle.textContent = pending === 1 ? '1 tarea pendiente' : `${pending} tareas pendientes`;
  } else if (currentView === 'week' || currentView === 'timeday') {
    widgetTitle.textContent = 'Inbox';
    subtitle.textContent = pending === 1 ? '1 tarea pendiente' : `${pending} tareas pendientes`;
  }
}

// ===== SIDEBAR NAV =====
document.getElementById('navInbox').addEventListener('click', e => {
  e.preventDefault();
  switchToInbox();
});

document.getElementById('navToday').addEventListener('click', e => {
  e.preventDefault();
  switchToDay(toISODate(new Date()));
});

document.getElementById('navPlanned').addEventListener('click', e => {
  e.preventDefault();
  switchToPlanned();
});

// ===== CALENDAR =====
let calDate = new Date();

function renderCalendar() {
  const calTitle = document.getElementById('calTitle');
  const calEl = document.getElementById('calendar');
  const datesWithTasks = getDatesWithTasks();
  const overdueSet = new Set(getOverdueTasks().map(t => t.date));

  const year = calDate.getFullYear();
  const month = calDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  calTitle.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const todayStr = toISODate(new Date());
  const dayNames = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

  calEl.innerHTML = '';

  // Header row
  const headerRow = document.createElement('div');
  headerRow.className = 'cal-row cal-header';
  dayNames.forEach(d => {
    const cell = document.createElement('span');
    cell.className = 'cal-cell';
    cell.textContent = d;
    headerRow.appendChild(cell);
  });
  calEl.appendChild(headerRow);

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  let nextMonthDay = 1;
  let row = null;

  for (let cell = 0; cell < totalCells; cell++) {
    if (cell % 7 === 0) {
      row = document.createElement('div');
      row.className = 'cal-row cal-week';
      calEl.appendChild(row);
    }

    const span = document.createElement('span');
    span.className = 'cal-cell';

    if (cell < startOffset) {
      const prevDay = daysInPrevMonth - startOffset + cell + 1;
      span.classList.add('cal-prev-month');
      span.textContent = prevDay;
    } else {
      const dayNum = cell - startOffset + 1;
      if (dayNum <= daysInMonth) {
        const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        span.dataset.date = isoDate;
        span.textContent = dayNum;

        if (isoDate === todayStr) span.classList.add('cal-today');
        if (datesWithTasks.has(isoDate)) span.classList.add('cal-has-tasks');
        if (overdueSet.has(isoDate)) span.classList.add('cal-overdue');
        if (isoDate === selectedDate) span.classList.add('cal-selected');

        span.addEventListener('click', () => switchToDay(isoDate));

        // Drop target
        span.addEventListener('dragover', e => {
          if (dragSrcId === null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          document.querySelectorAll('.cal-cell.cal-drag-over').forEach(c => c.classList.remove('cal-drag-over'));
          span.classList.add('cal-drag-over');
        });

        span.addEventListener('dragleave', () => {
          span.classList.remove('cal-drag-over');
        });

        span.addEventListener('drop', e => {
          e.preventDefault();
          if (dragSrcId === null) return;
          const task = tasks.find(t => t.id === dragSrcId);
          if (task) {
            task.date = isoDate;
            droppedOnCalendar = true;
            dbUpdate(task.id, { date: isoDate });
            render();
            renderCalendar();
          }
        });
      } else {
        span.classList.add('cal-next-month');
        span.textContent = nextMonthDay;
        nextMonthDay++;
      }
    }

    row.appendChild(span);
  }
}

document.getElementById('calPrev').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById('calNext').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
});

// Transformación del ghost al entrar/salir de la zona del calendario
const calendarWidget = document.getElementById('calendar');
calendarWidget.addEventListener('dragenter', () => {
  if (dragSrcId === null || !dragGhost) return;
  dragGhost.classList.add('drag-ghost--cal');
});
calendarWidget.addEventListener('dragleave', e => {
  if (!dragGhost) return;
  if (!calendarWidget.contains(e.relatedTarget)) {
    dragGhost.classList.remove('drag-ghost--cal');
  }
});

// ===== TASK MENU POPOVER =====
function openMenu() {
  taskMenu.hidden = false;
  moreBtn.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
  taskMenu.hidden = true;
  moreBtn.setAttribute('aria-expanded', 'false');
}

moreBtn.addEventListener('click', e => {
  e.stopPropagation();
  taskMenu.hidden ? openMenu() : closeMenu();
});

document.addEventListener('click', () => {
  closeMenu();
  closeDatePopover();
});

taskMenu.addEventListener('click', e => e.stopPropagation());

document.getElementById('menuAddTask').addEventListener('click', () => {
  closeMenu();
  const addInput = taskList.querySelector('.task-add-input');
  if (addInput) { addInput.focus(); addInput.scrollIntoView({ behavior: 'smooth' }); }
});

document.getElementById('menuClearCompleted').addEventListener('click', () => {
  closeMenu();
  const ids = tasks.filter(t => t.completed).map(t => t.id);
  tasks = tasks.filter(t => !t.completed);
  dbDeleteMany(ids);
  render();
});

document.getElementById('menuClearAll').addEventListener('click', () => {
  closeMenu();
  const ids = tasks.map(t => t.id);
  tasks = [];
  dbDeleteMany(ids);
  render();
});

// ===== DATE POPOVER =====
let activeDatePopover = null;

function openDatePopover(task, anchorEl) {
  closeDatePopover();

  let popDate = task.date ? new Date(task.date + 'T00:00:00') : new Date();

  const popover = document.createElement('div');
  popover.className = 'date-popover';
  popover.addEventListener('click', e => e.stopPropagation());

  function applyDate(isoDate) {
    task.date = isoDate || null;
    dbUpdate(task.id, { date: task.date });
    render();
    renderCalendar();
    closeDatePopover();
  }

  // === TOP: text input ===
  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'date-popover-text-input';
  textInput.placeholder = 'dd/mm/aaaa';
  textInput.autocomplete = 'off';
  if (task.date) {
    const [y, m, d] = task.date.split('-');
    textInput.value = `${d}/${m}/${y}`;
  }

  textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const parts = textInput.value.trim().split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts;
        const iso = `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        if (!isNaN(new Date(iso + 'T00:00:00').getTime())) { applyDate(iso); return; }
      }
      textInput.classList.add('date-popover-text-input--error');
      setTimeout(() => textInput.classList.remove('date-popover-text-input--error'), 500);
    }
    if (e.key === 'Escape') closeDatePopover();
  });

  // === MIDDLE: quick actions ===
  const actionsRow = document.createElement('div');
  actionsRow.className = 'date-popover-actions';

  const todayBtn = document.createElement('button');
  todayBtn.className = 'date-popover-action-btn';
  todayBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="7.05" y2="7.05"/><line x1="16.95" y1="16.95" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="7.05" y2="16.95"/><line x1="16.95" y1="7.05" x2="19.78" y2="4.22"/></svg> Hoy`;
  todayBtn.addEventListener('click', () => applyDate(toISODate(new Date())));

  const inboxBtn = document.createElement('button');
  inboxBtn.className = 'date-popover-action-btn';
  inboxBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg> Inbox`;
  inboxBtn.addEventListener('click', () => applyDate(null));

  actionsRow.append(todayBtn, inboxBtn);

  // === BOTTOM: mini calendar ===
  const calSection = document.createElement('div');
  calSection.className = 'date-popover-cal';

  const calNav = document.createElement('div');
  calNav.className = 'date-popover-cal-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'date-popover-cal-nav-btn';
  prevBtn.innerHTML = '&#8249;';

  const monthLabel = document.createElement('span');
  monthLabel.className = 'date-popover-cal-month';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'date-popover-cal-nav-btn';
  nextBtn.innerHTML = '&#8250;';

  calNav.append(prevBtn, monthLabel, nextBtn);

  const calGrid = document.createElement('div');
  calGrid.className = 'date-popover-cal-grid';

  function renderMiniCal() {
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const year = popDate.getFullYear();
    const month = popDate.getMonth();
    monthLabel.textContent = `${monthNames[month]} ${year}`;
    calGrid.innerHTML = '';

    const headerRow = document.createElement('div');
    headerRow.className = 'date-popover-cal-row';
    ['Lu','Ma','Mi','Ju','Vi','Sa','Do'].forEach(d => {
      const cell = document.createElement('span');
      cell.className = 'date-popover-cal-cell date-popover-cal-cell--header';
      cell.textContent = d;
      headerRow.appendChild(cell);
    });
    calGrid.appendChild(headerRow);

    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = toISODate(new Date());
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    let row = null;
    for (let i = 0; i < totalCells; i++) {
      if (i % 7 === 0) {
        row = document.createElement('div');
        row.className = 'date-popover-cal-row';
        calGrid.appendChild(row);
      }
      const span = document.createElement('span');
      span.className = 'date-popover-cal-cell';

      const dayNum = i - startOffset + 1;
      if (i < startOffset || dayNum > daysInMonth) {
        span.classList.add('date-popover-cal-cell--other');
      } else {
        const iso = `${year}-${String(month + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
        span.textContent = dayNum;
        if (iso === todayStr) span.classList.add('date-popover-cal-cell--today');
        if (iso === task.date) span.classList.add('date-popover-cal-cell--selected');
        span.addEventListener('click', () => applyDate(iso));
      }
      row.appendChild(span);
    }
  }

  prevBtn.addEventListener('click', () => { popDate = new Date(popDate.getFullYear(), popDate.getMonth() - 1, 1); renderMiniCal(); });
  nextBtn.addEventListener('click', () => { popDate = new Date(popDate.getFullYear(), popDate.getMonth() + 1, 1); renderMiniCal(); });

  calSection.append(calNav, calGrid);
  renderMiniCal();

  popover.append(textInput, actionsRow, calSection);

  const rect = anchorEl.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.top = `${rect.bottom + 6}px`;
  popover.style.right = `${window.innerWidth - rect.right}px`;
  popover.style.zIndex = '200';

  document.body.appendChild(popover);
  activeDatePopover = popover;
  textInput.focus();
}

function closeDatePopover() {
  if (activeDatePopover) {
    activeDatePopover.remove();
    activeDatePopover = null;
  }
}

// ===== TASKS =====
let dragSrcId = null;
let placeholder = null;
let dragGhost = null;
let ghostOffsetX = 0;
let ghostOffsetY = 0;

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = 'task-item'
    + (task.completed ? ' completed' : '')
    + (task.date ? ' has-date' : '')
    + (isOverdue(task) ? ' overdue' : '');
  li.dataset.id = task.id;
  li.draggable = true;

  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  handle.innerHTML = '&#8942;&#8942;';
  handle.setAttribute('aria-hidden', 'true');

  const check = document.createElement('div');
  check.className = 'task-check';
  check.setAttribute('role', 'checkbox');
  check.setAttribute('aria-checked', task.completed);
  check.setAttribute('tabindex', '0');

  const text = document.createElement('span');
  text.className = 'task-text';
  text.textContent = task.text;

  li.append(handle, check, text);

  // Date chip (only in inbox view so you know when a task is scheduled)
  if (task.date && currentView === 'inbox') {
    const chip = document.createElement('span');
    chip.className = 'task-date-chip';
    chip.textContent = formatShortDate(task.date);
    li.appendChild(chip);
  }

  // Date button (calendar icon)
  const dateBtn = document.createElement('button');
  dateBtn.className = 'date-btn';
  dateBtn.setAttribute('aria-label', 'Asignar fecha');
  dateBtn.title = task.date ? formatDateLabel(task.date) : 'Asignar fecha';
  dateBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  dateBtn.addEventListener('click', e => {
    e.stopPropagation();
    openDatePopover(task, dateBtn);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.setAttribute('aria-label', 'Eliminar tarea');
  deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`;

  function toggle() {
    task.completed = !task.completed;
    li.classList.toggle('completed', task.completed);
    check.setAttribute('aria-checked', task.completed);
    dbUpdate(task.id, { completed: task.completed });
    updateSubtitle();
  }

  check.addEventListener('click', toggle);
  check.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') toggle();
  });

  // ===== INLINE EDITING =====
  function startEditing() {
    text.contentEditable = 'true';
    text.classList.add('editing');
    text.focus();
    const range = document.createRange();
    range.selectNodeContents(text);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function finishEditing() {
    if (text.contentEditable !== 'true') return;
    text.contentEditable = 'false';
    text.classList.remove('editing');
    const newText = text.textContent.trim();
    if (newText && newText !== task.text) {
      task.text = newText;
      dbUpdate(task.id, { text: newText });
    } else if (!newText) {
      text.textContent = task.text;
    }
  }

  text.addEventListener('click', e => {
    e.stopPropagation();
    closeDatePopover();
    if (!task.completed) startEditing();
  });

  text.addEventListener('blur', finishEditing);

  text.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); text.blur(); }
    if (e.key === 'Escape') {
      text.textContent = task.text;
      text.contentEditable = 'false';
      text.classList.remove('editing');
    }
  });

  deleteBtn.addEventListener('click', () => {
    li.style.opacity = '0';
    li.style.transform = 'translateX(16px)';
    li.style.transition = 'opacity 0.18s, transform 0.18s';
    setTimeout(() => {
      tasks = tasks.filter(t => t.id !== task.id);
      dbDelete(task.id);
      render();
    }, 180);
  });

  // Sun button: assign to today (hidden if already today)
  const todayStr = toISODate(new Date());
  if (task.date !== todayStr) {
    const todayBtn = document.createElement('button');
    todayBtn.className = 'today-btn';
    todayBtn.setAttribute('aria-label', 'Hacer hoy');
    todayBtn.title = 'Hacer hoy';
    todayBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="7.05" y2="7.05"/><line x1="16.95" y1="16.95" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="7.05" y2="16.95"/><line x1="16.95" y1="7.05" x2="19.78" y2="4.22"/></svg>`;
    todayBtn.addEventListener('click', e => {
      e.stopPropagation();
      closeDatePopover();
      task.date = todayStr;
      dbUpdate(task.id, { date: todayStr });
      render();
      renderCalendar();
    });
    li.append(todayBtn);
  }

  li.append(dateBtn, deleteBtn);

  // ===== DRAG & DROP =====
  li.addEventListener('dragstart', e => {
    if (text.contentEditable === 'true') {
      text.contentEditable = 'false';
      text.classList.remove('editing');
      text.textContent = task.text;
    }

    dragSrcId = task.id;
    droppedOnCalendar = false;
    e.dataTransfer.effectAllowed = 'move';

    document.getElementById('calendar').classList.add('cal-drop-mode');
    timeGridWidget.classList.add('tgv-drop-mode');

    // Ghost personalizado que sigue al cursor
    ghostOffsetX = e.offsetX;
    ghostOffsetY = e.offsetY;
    dragGhost = li.cloneNode(true);
    dragGhost.className = 'drag-ghost';
    dragGhost.style.cssText = `
      width: ${li.offsetWidth}px;
      left: ${e.clientX - ghostOffsetX}px;
      top: ${e.clientY - ghostOffsetY}px;
    `;
    document.body.appendChild(dragGhost);

    // Imagen de arrastre transparente para suprimir el ghost nativo
    const blank = document.createElement('div');
    blank.style.cssText = 'width:1px;height:1px;opacity:0.01;position:fixed;top:-10px;left:-10px';
    document.body.appendChild(blank);
    e.dataTransfer.setDragImage(blank, 0, 0);
    setTimeout(() => document.body.removeChild(blank), 0);

    placeholder = document.createElement('li');
    placeholder.className = 'task-placeholder';

    setTimeout(() => {
      placeholder.style.height = li.offsetHeight + 'px';
      li.after(placeholder);
      li.classList.add('dragging');
    }, 0);
  });

  li.addEventListener('drag', e => {
    if (dragGhost && e.clientX !== 0) {
      dragGhost.style.left = (e.clientX - ghostOffsetX) + 'px';
      dragGhost.style.top = (e.clientY - ghostOffsetY) + 'px';
    }
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    if (placeholder && placeholder.parentNode) placeholder.remove();
    placeholder = null;

    if (dragGhost) { dragGhost.remove(); dragGhost = null; }

    document.getElementById('calendar').classList.remove('cal-drop-mode');
    timeGridWidget.classList.remove('tgv-drop-mode');
    document.querySelectorAll('.cal-cell.cal-drag-over').forEach(c => c.classList.remove('cal-drag-over'));

    dragSrcId = null;
  });

  return li;
}

function render() {
  taskList.innerHTML = '';
  const visible = getVisibleTasks();

  if (visible.length === 0) {
    // Add row va primero, en la misma posición que aparecería la primera tarea
    taskList.appendChild(createAddRow());

    const empty = document.createElement('li');
    empty.className = 'empty-state';

    const content = {
      inbox:   { title: 'Inbox vacío',            desc: 'Añade tu primera tarea con el campo de abajo' },
      planned: { title: 'Sin tareas planificadas', desc: 'Arrastra tareas al calendario para organizarlas' },
      day:     { title: 'Día despejado',           desc: 'No hay tareas para este día' },
      week:    { title: 'Inbox vacío',             desc: 'Arrastra tareas al bloque de tiempo' },
      timeday: { title: 'Inbox vacío',             desc: 'Arrastra tareas al bloque de tiempo' },
    };

    const { title, desc } = content[currentView] || content.day;
    empty.innerHTML = `
      <div class="empty-state-icon"><img src="img/Empty-state.png" alt="" width="72" height="72"></div>
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-desc">${desc}</div>
    `;
    taskList.appendChild(empty);
  } else if (currentView === 'planned') {
    const todayStr = toISODate(new Date());
    const overdue = visible.filter(t => t.date < todayStr && !t.completed && !t.scheduled_time);
    const upcoming = visible.filter(t => t.date >= todayStr && !t.scheduled_time);

    if (overdue.length > 0) {
      const header = document.createElement('li');
      header.className = 'task-date-group-header overdue';
      header.textContent = 'Retrasadas';
      taskList.appendChild(header);
      overdue.sort((a, b) => a.date.localeCompare(b.date))
        .forEach(task => taskList.appendChild(createTaskElement(task)));
    }

    const groups = {};
    upcoming
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(t => {
        if (!groups[t.date]) groups[t.date] = [];
        groups[t.date].push(t);
      });

    Object.entries(groups).forEach(([date, groupTasks]) => {
      const header = document.createElement('li');
      header.className = 'task-date-group-header';
      const raw = formatDateLabel(date);
      header.textContent = raw.charAt(0).toUpperCase() + raw.slice(1);
      taskList.appendChild(header);
      groupTasks.forEach(task => taskList.appendChild(createTaskElement(task)));
    });
    taskList.appendChild(createAddRow());

  } else if (currentView === 'day' && selectedDate === toISODate(new Date())) {
    const todayStr = toISODate(new Date());
    const overdue = visible.filter(t => t.date < todayStr);
    const todayTasks = visible.filter(t => t.date === todayStr);

    if (overdue.length > 0) {
      const header = document.createElement('li');
      header.className = 'task-date-group-header overdue';
      header.textContent = 'Retrasadas';
      taskList.appendChild(header);
      overdue.sort((a, b) => a.date.localeCompare(b.date))
        .forEach(task => taskList.appendChild(createTaskElement(task)));

      if (todayTasks.length > 0) {
        const todayHeader = document.createElement('li');
        todayHeader.className = 'task-date-group-header';
        todayHeader.textContent = 'Hoy';
        taskList.appendChild(todayHeader);
      }
    }

    todayTasks.forEach(task => taskList.appendChild(createTaskElement(task)));
    taskList.appendChild(createAddRow());

  } else {
    visible.forEach(task => taskList.appendChild(createTaskElement(task)));
    taskList.appendChild(createAddRow());
  }

  updateSubtitle();
  renderUpcoming();
}

// ===== INLINE ADD ROW =====
function createAddRow() {
  const li = document.createElement('li');
  li.className = 'task-add-row';

  const icon = document.createElement('span');
  icon.className = 'task-add-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Añadir tarea';
  input.className = 'task-add-input';
  input.autocomplete = 'off';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'task-add-btn';
  btn.textContent = 'Añadir';
  btn.disabled = true;

  li.append(icon, input, btn);

  li.addEventListener('click', e => {
    if (e.target !== input && e.target !== btn) input.focus();
  });

  input.addEventListener('focus', () => li.classList.add('active'));

  input.addEventListener('input', () => {
    btn.disabled = input.value.trim() === '';
  });

  input.addEventListener('blur', () => {
    if (!input.value.trim()) li.classList.remove('active');
  });

  btn.addEventListener('mousedown', e => e.preventDefault());

  async function submitTask() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    btn.disabled = true;
    const created = await dbAdd({ text, date: currentView === 'day' ? selectedDate : null });
    if (!created) return;
    tasks.push({ id: created.id, text: created.text, completed: created.completed, date: created.date, scheduled_time: created.scheduled_time || null });
    render();
    renderCalendar();
    requestAnimationFrame(() => {
      const newInput = taskList.querySelector('.task-add-input');
      if (newInput) newInput.focus();
    });
  }

  btn.addEventListener('click', submitTask);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitTask(); }
    if (e.key === 'Escape') { input.value = ''; input.blur(); }
  });

  return li;
}

taskList.addEventListener('dragover', e => {
  e.preventDefault();
  if (!placeholder) return;

  const siblings = [...taskList.querySelectorAll('.task-item:not(.dragging)')];
  const mouseY = e.clientY;

  let insertBefore = null;
  for (const sibling of siblings) {
    const rect = sibling.getBoundingClientRect();
    if (mouseY < rect.top + rect.height / 2) {
      insertBefore = sibling;
      break;
    }
  }

  const addRow = taskList.querySelector('.task-add-row');
  if (insertBefore) taskList.insertBefore(placeholder, insertBefore);
  else if (addRow) taskList.insertBefore(placeholder, addRow);
  else taskList.appendChild(placeholder);
});

taskList.addEventListener('drop', e => {
  e.preventDefault();
  if (!placeholder || dragSrcId === null || droppedOnCalendar) return;

  const draggingEl = taskList.querySelector('.dragging');
  if (!draggingEl) return;
  taskList.insertBefore(draggingEl, placeholder);
  placeholder.remove();
  placeholder = null;

  // Reorder in memory (not persisted — no order column)
  const visibleIds = new Set(getVisibleTasks().map(t => t.id));
  const reorderedVisible = [...taskList.querySelectorAll('.task-item')]
    .map(el => tasks.find(t => String(t.id) === el.dataset.id))
    .filter(Boolean);
  const nonVisible = tasks.filter(t => !visibleIds.has(t.id));
  tasks = [...reorderedVisible, ...nonVisible];
});

// ===== UPCOMING TASKS (widget "Planificadas") =====
function renderUpcoming() {
  const container = document.getElementById('upcomingList');
  const todayStr = toISODate(new Date());

  const upcoming = tasks
    .filter(t => t.date && t.date >= todayStr && !t.completed && !t.scheduled_time)
    .sort((a, b) => a.date.localeCompare(b.date));

  container.innerHTML = '';

  if (upcoming.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-widget';
    empty.innerHTML = `
      <div class="empty-widget-icon">&#128197;</div>
      <div class="empty-widget-title">Sin tareas planificadas</div>
      <div class="empty-widget-desc">Arrastra tareas al calendario para verlas aquí</div>
    `;
    container.appendChild(empty);
    return;
  }

  const groups = {};
  upcoming.forEach(t => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });

  Object.entries(groups).forEach(([date, groupTasks]) => {
    const section = document.createElement('div');
    section.className = 'upcoming-group';

    const label = document.createElement('div');
    label.className = 'upcoming-date-label';
    const raw = formatDateLabel(date);
    label.textContent = raw.charAt(0).toUpperCase() + raw.slice(1);
    section.appendChild(label);

    groupTasks.forEach(task => {
      const item = document.createElement('div');
      item.className = 'upcoming-item';
      item.textContent = task.text;
      item.addEventListener('click', () => switchToDay(date));
      section.appendChild(item);
    });

    container.appendChild(section);
  });
}

// ===== TIME GRID — NAV LISTENERS =====
document.getElementById('navWeek').addEventListener('click', e => {
  e.preventDefault();
  switchToWeekView();
});

document.getElementById('navTimeDay').addEventListener('click', e => {
  e.preventDefault();
  switchToTimeDayView(toISODate(new Date()));
});

// ===== TIME GRID — SHOW/HIDE =====
function showTimeGrid() {
  calendarWidgetEl.hidden = true;
  eventsWidgetEl.hidden = true;
  timeGridWidget.hidden = false;
}

function hideTimeGrid() {
  calendarWidgetEl.hidden = false;
  eventsWidgetEl.hidden = false;
  timeGridWidget.hidden = true;
}

// ===== TIME GRID — SWITCH VIEWS =====
function switchToWeekView() {
  currentView = 'week';
  showTimeGrid();
  document.getElementById('navInbox').classList.remove('active');
  document.getElementById('navToday').classList.remove('active');
  document.getElementById('navPlanned').classList.remove('active');
  document.getElementById('navWeek').classList.add('active');
  document.getElementById('navTimeDay').classList.remove('active');
  render();
  renderCalendar();
  renderTimeGrid();
}

function switchToTimeDayView(date) {
  currentView = 'timeday';
  timeDayDate = date;
  showTimeGrid();
  document.getElementById('navInbox').classList.remove('active');
  document.getElementById('navToday').classList.remove('active');
  document.getElementById('navPlanned').classList.remove('active');
  document.getElementById('navWeek').classList.remove('active');
  document.getElementById('navTimeDay').classList.add('active');
  render();
  renderCalendar();
  renderTimeGrid();
}

// ===== TIME GRID — RENDER DISPATCHER =====
function renderTimeGrid() {
  if (currentView === 'week') {
    renderWeekGrid();
  } else if (currentView === 'timeday') {
    renderTimeDayGrid();
  }
}

// ===== TIME GRID — FORMAT WEEK LABEL =====
function formatWeekLabel(weekStart) {
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4); // Friday
  const startDay = weekStart.getDate();
  const endDay = end.getDate();
  const endMonth = monthNames[end.getMonth()];
  const endYear = end.getFullYear();
  if (weekStart.getMonth() === end.getMonth()) {
    return `${startDay}–${endDay} ${endMonth} ${endYear}`;
  } else {
    const startMonth = monthNames[weekStart.getMonth()];
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
  }
}

function formatTimeDayLabel(isoDate) {
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const todayStr = toISODate(new Date());
  const prefix = isoDate === todayStr ? 'Hoy, ' : '';
  return `${prefix}${dayNames[date.getDay()]} ${d} ${monthNames[m - 1]} ${y}`;
}

// ===== TIME GRID — WEEK GRID =====
function renderWeekGrid() {
  const todayStr = toISODate(new Date());
  const dayNames = ['Lun','Mar','Mié','Jue','Vie'];

  // Build array of 5 dates (Mon–Fri)
  const weekDates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    weekDates.push(toISODate(d));
  }

  timeGridWidget.innerHTML = '';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'tgv-toolbar';

  const toggle = document.createElement('div');
  toggle.className = 'tgv-toggle';

  const weekBtn = document.createElement('button');
  weekBtn.className = 'tgv-toggle-btn tgv-toggle-btn--active';
  weekBtn.textContent = 'Semana';
  weekBtn.addEventListener('click', () => switchToWeekView());

  const dayBtn = document.createElement('button');
  dayBtn.className = 'tgv-toggle-btn';
  dayBtn.textContent = 'Día';
  dayBtn.addEventListener('click', () => switchToTimeDayView(toISODate(new Date())));

  toggle.append(weekBtn, dayBtn);

  const nav = document.createElement('div');
  nav.className = 'tgv-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'tgv-nav-btn';
  prevBtn.innerHTML = '&#8249;';
  prevBtn.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderWeekGrid();
  });

  const navLabel = document.createElement('span');
  navLabel.className = 'tgv-nav-label';
  navLabel.textContent = formatWeekLabel(currentWeekStart);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'tgv-nav-btn';
  nextBtn.innerHTML = '&#8250;';
  nextBtn.addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderWeekGrid();
  });

  nav.append(prevBtn, navLabel, nextBtn);
  toolbar.append(toggle, nav);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'tgv-grid';

  // Header row
  const headerRow = document.createElement('div');
  headerRow.className = 'tgv-header-row';

  const corner = document.createElement('div');
  corner.className = 'tgv-corner';
  headerRow.appendChild(corner);

  weekDates.forEach((isoDate, i) => {
    const [, , d] = isoDate.split('-').map(Number);
    const hdr = document.createElement('div');
    hdr.className = 'tgv-day-hdr';
    hdr.addEventListener('click', () => switchToTimeDayView(isoDate));

    const nameEl = document.createElement('span');
    nameEl.className = 'tgv-day-name';
    nameEl.textContent = dayNames[i];

    const numEl = document.createElement('span');
    numEl.className = 'tgv-day-num' + (isoDate === todayStr ? ' today' : '');
    numEl.textContent = d;

    hdr.append(nameEl, numEl);
    headerRow.appendChild(hdr);
  });

  // Body
  const body = document.createElement('div');
  body.className = 'tgv-body';

  // Time labels column
  const timeCol = document.createElement('div');
  timeCol.className = 'tgv-time-col';
  TIME_SLOTS.forEach(slot => {
    const lbl = document.createElement('div');
    lbl.className = 'tgv-time-lbl';
    lbl.textContent = slot;
    timeCol.appendChild(lbl);
  });

  // Slot columns
  const slotsRow = document.createElement('div');
  slotsRow.className = 'tgv-slots';

  weekDates.forEach(isoDate => {
    const col = document.createElement('div');
    col.className = 'tgv-slot-col';

    TIME_SLOTS.forEach(time => {
      const block = createTimeBlock(isoDate, time);
      col.appendChild(block);
    });

    slotsRow.appendChild(col);
  });

  body.append(timeCol, slotsRow);
  grid.append(headerRow, body);
  timeGridWidget.append(toolbar, grid);
}

// ===== TIME GRID — DAY GRID =====
function renderTimeDayGrid() {
  const todayStr = toISODate(new Date());
  const isoDate = timeDayDate;

  timeGridWidget.innerHTML = '';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'tgv-toolbar';

  const toggle = document.createElement('div');
  toggle.className = 'tgv-toggle';

  const weekBtn = document.createElement('button');
  weekBtn.className = 'tgv-toggle-btn';
  weekBtn.textContent = 'Semana';
  weekBtn.addEventListener('click', () => switchToWeekView());

  const dayBtnEl = document.createElement('button');
  dayBtnEl.className = 'tgv-toggle-btn tgv-toggle-btn--active';
  dayBtnEl.textContent = 'Día';
  dayBtnEl.addEventListener('click', () => switchToTimeDayView(toISODate(new Date())));

  toggle.append(weekBtn, dayBtnEl);

  const nav = document.createElement('div');
  nav.className = 'tgv-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'tgv-nav-btn';
  prevBtn.innerHTML = '&#8249;';
  prevBtn.addEventListener('click', () => {
    const [y, m, d] = timeDayDate.split('-').map(Number);
    const prev = new Date(y, m - 1, d - 1);
    switchToTimeDayView(toISODate(prev));
  });

  const navLabel = document.createElement('span');
  navLabel.className = 'tgv-nav-label';
  navLabel.textContent = formatTimeDayLabel(isoDate);
  navLabel.style.minWidth = '180px';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'tgv-nav-btn';
  nextBtn.innerHTML = '&#8250;';
  nextBtn.addEventListener('click', () => {
    const [y, m, d] = timeDayDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    switchToTimeDayView(toISODate(next));
  });

  nav.append(prevBtn, navLabel, nextBtn);
  toolbar.append(toggle, nav);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'tgv-grid';

  // Header row (single day)
  const headerRow = document.createElement('div');
  headerRow.className = 'tgv-header-row';

  const corner = document.createElement('div');
  corner.className = 'tgv-corner';
  headerRow.appendChild(corner);

  const [, , dayNum] = isoDate.split('-').map(Number);
  const hdr = document.createElement('div');
  hdr.className = 'tgv-day-hdr';

  const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const [hy, hm, hd] = isoDate.split('-').map(Number);
  const dateObj = new Date(hy, hm - 1, hd);

  const nameEl = document.createElement('span');
  nameEl.className = 'tgv-day-name';
  nameEl.textContent = dayNames[dateObj.getDay()];

  const numEl = document.createElement('span');
  numEl.className = 'tgv-day-num' + (isoDate === todayStr ? ' today' : '');
  numEl.textContent = dayNum;

  hdr.append(nameEl, numEl);
  headerRow.appendChild(hdr);

  // Body
  const body = document.createElement('div');
  body.className = 'tgv-body';

  const timeCol = document.createElement('div');
  timeCol.className = 'tgv-time-col';
  TIME_SLOTS.forEach(slot => {
    const lbl = document.createElement('div');
    lbl.className = 'tgv-time-lbl';
    lbl.textContent = slot;
    timeCol.appendChild(lbl);
  });

  const slotsRow = document.createElement('div');
  slotsRow.className = 'tgv-slots';

  const col = document.createElement('div');
  col.className = 'tgv-slot-col';

  TIME_SLOTS.forEach(time => {
    const block = createTimeBlock(isoDate, time);
    col.appendChild(block);
  });

  slotsRow.appendChild(col);
  body.append(timeCol, slotsRow);
  grid.append(headerRow, body);
  timeGridWidget.append(toolbar, grid);
}

// ===== TIME GRID — BLOCK FACTORY =====
function createTimeBlock(isoDate, time) {
  const block = document.createElement('div');
  block.className = 'tgv-block';
  block.dataset.date = isoDate;
  block.dataset.time = time;

  // Render any tasks already in this slot
  tasks.filter(t => t.date === isoDate && t.scheduled_time === time).forEach(task => {
    block.appendChild(createTimeBlockCard(task));
  });

  // Drag-over highlight
  block.addEventListener('dragover', e => {
    if (dragSrcId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    block.classList.add('tgv-block--hover');
  });

  block.addEventListener('dragleave', e => {
    if (!block.contains(e.relatedTarget)) {
      block.classList.remove('tgv-block--hover');
    }
  });

  block.addEventListener('drop', e => {
    e.preventDefault();
    block.classList.remove('tgv-block--hover');
    if (dragSrcId === null) return;
    const task = tasks.find(t => t.id === dragSrcId);
    if (task) {
      task.date = isoDate;
      task.scheduled_time = time;
      droppedOnCalendar = true;
      dbUpdate(task.id, { date: isoDate, scheduled_time: time });
      render();
      renderCalendar();
      renderTimeGrid();
    }
    dragSrcId = null;
  });

  return block;
}

// ===== TIME GRID — TASK CARD =====
function createTimeBlockCard(task) {
  const card = document.createElement('div');
  card.className = 'tgv-task-card' + (task.completed ? ' completed' : '');
  card.draggable = true;

  const textSpan = document.createElement('span');
  textSpan.className = 'tgv-task-text';
  textSpan.textContent = task.text;

  const unscheduleBtn = document.createElement('button');
  unscheduleBtn.className = 'tgv-unschedule-btn';
  unscheduleBtn.title = 'Quitar del bloque';
  unscheduleBtn.innerHTML = '&times;';
  unscheduleBtn.addEventListener('click', e => {
    e.stopPropagation();
    task.scheduled_time = null;
    dbUpdate(task.id, { scheduled_time: null });
    render();
    renderCalendar();
    renderTimeGrid();
  });

  card.append(textSpan, unscheduleBtn);

  card.addEventListener('dragstart', e => {
    dragSrcId = task.id;
    droppedOnCalendar = false;
    e.dataTransfer.effectAllowed = 'move';
    timeGridWidget.classList.add('tgv-drop-mode');
    card.classList.add('tgv-card-dragging');

    const blank = document.createElement('div');
    blank.style.cssText = 'width:1px;height:1px;opacity:0.01;position:fixed;top:-10px;left:-10px';
    document.body.appendChild(blank);
    e.dataTransfer.setDragImage(blank, 0, 0);
    setTimeout(() => document.body.removeChild(blank), 0);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('tgv-card-dragging');
    timeGridWidget.classList.remove('tgv-drop-mode');
    dragSrcId = null;
  });

  return card;
}

// Init — tasks load via auth.js → loadTasks() after sign-in
renderCalendar();
render();
