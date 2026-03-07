// DOM references
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const subtitle = document.getElementById('subtitle');
const taskCountBadge = document.getElementById('taskCountBadge');
const widgetTitle = document.getElementById('widgetTitle');
const btnNewTask = document.getElementById('btnNewTask');
const moreBtn = document.getElementById('moreBtn');
const taskMenu = document.getElementById('taskMenu');

// ===== STATE =====
let currentView = 'inbox'; // 'inbox' | 'day'
let selectedDate = null;   // 'YYYY-MM-DD' or null
let droppedOnCalendar = false;

const INITIAL_TASKS = [
  'Hacer la compra para casa',
  'Llevar la moto al taller',
  'Limpiar el coche',
  'Revisar el correo',
  'Llamar al médico',
];

let tasks = JSON.parse(localStorage.getItem('focusTasks') || 'null');

if (!tasks || tasks.length === 0) {
  tasks = INITIAL_TASKS.map((text, i) => ({ id: i + 1, text, completed: false, date: null }));
  localStorage.setItem('focusTasks', JSON.stringify(tasks));
}

// ===== MIGRATION =====
function migrateTasks() {
  let migrated = false;
  tasks = tasks.map(t => {
    if (!('date' in t)) { migrated = true; return { ...t, date: null }; }
    return t;
  });
  if (migrated) save();
}
migrateTasks();

function save() {
  localStorage.setItem('focusTasks', JSON.stringify(tasks));
}

// ===== DATE HELPERS =====
function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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
    const todayTasks = tasks.filter(t => t.date === selectedDate);
    if (selectedDate === todayStr) {
      const overdue = getOverdueTasks();
      return [...overdue, ...todayTasks];
    }
    return todayTasks;
  }
  if (currentView === 'planned') {
    return tasks.filter(t => t.date !== null);
  }
  return tasks;
}

function switchToInbox() {
  currentView = 'inbox';
  selectedDate = null;
  document.getElementById('navInbox').classList.add('active');
  document.getElementById('navToday').classList.remove('active');
  document.getElementById('navPlanned').classList.remove('active');
  render();
  renderCalendar();
}

function switchToDay(isoDate) {
  currentView = 'day';
  selectedDate = isoDate;
  document.getElementById('navInbox').classList.remove('active');
  document.getElementById('navPlanned').classList.remove('active');
  document.getElementById('navToday').classList.toggle('active', isoDate === toISODate(new Date()));
  render();
  renderCalendar();
}

function switchToPlanned() {
  currentView = 'planned';
  selectedDate = null;
  document.getElementById('navInbox').classList.remove('active');
  document.getElementById('navToday').classList.remove('active');
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
            save();
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
  taskInput.focus();
  taskInput.scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('menuClearCompleted').addEventListener('click', () => {
  closeMenu();
  tasks = tasks.filter(t => !t.completed);
  save();
  render();
});

document.getElementById('menuClearAll').addEventListener('click', () => {
  closeMenu();
  tasks = [];
  save();
  render();
});

btnNewTask.addEventListener('click', () => {
  taskInput.focus();
  taskInput.scrollIntoView({ behavior: 'smooth' });
});

// ===== DATE POPOVER =====
let activeDatePopover = null;

function openDatePopover(task, anchorEl) {
  closeDatePopover();

  const popover = document.createElement('div');
  popover.className = 'date-popover';
  popover.addEventListener('click', e => e.stopPropagation());

  const input = document.createElement('input');
  input.type = 'date';
  if (task.date) input.value = task.date;

  input.addEventListener('change', () => {
    task.date = input.value || null;
    save();
    render();
    renderCalendar();
    closeDatePopover();
  });

  popover.appendChild(input);

  if (task.date) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'date-popover-remove';
    removeBtn.textContent = 'Quitar fecha';
    removeBtn.addEventListener('click', () => {
      task.date = null;
      save();
      render();
      renderCalendar();
      closeDatePopover();
    });
    popover.appendChild(removeBtn);
  }

  const rect = anchorEl.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.top = `${rect.bottom + 4}px`;
  popover.style.left = `${rect.left}px`;
  popover.style.zIndex = '200';

  document.body.appendChild(popover);
  activeDatePopover = popover;
  input.focus();
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
  deleteBtn.innerHTML = '&#x2715;';

  function toggle() {
    task.completed = !task.completed;
    li.classList.toggle('completed', task.completed);
    check.setAttribute('aria-checked', task.completed);
    save();
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
    // Place cursor at end
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
      save();
    } else if (!newText) {
      text.textContent = task.text; // restore if empty
    }
  }

  text.addEventListener('click', e => {
    e.stopPropagation();
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
      save();
      render();
    }, 180);
  });

  li.append(dateBtn, deleteBtn);

  // ===== DRAG & DROP =====
  li.addEventListener('dragstart', e => {
    // Cancel any active inline edit before dragging
    if (text.contentEditable === 'true') {
      text.contentEditable = 'false';
      text.classList.remove('editing');
      text.textContent = task.text;
    }

    dragSrcId = task.id;
    droppedOnCalendar = false;
    e.dataTransfer.effectAllowed = 'move';

    document.getElementById('calendar').classList.add('cal-drop-mode');

    const clone = li.cloneNode(true);
    clone.style.cssText = `
      width: ${li.offsetWidth}px;
      transform: scale(1.02);
      box-shadow: 0 8px 24px rgba(0,0,0,0.10);
      border-radius: 8px;
      position: absolute;
      top: -9999px;
      background: #fff;
      padding: 10px 0;
    `;
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, e.offsetX, e.offsetY);
    setTimeout(() => document.body.removeChild(clone), 0);

    placeholder = document.createElement('li');
    placeholder.className = 'task-placeholder';

    setTimeout(() => {
      placeholder.style.height = li.offsetHeight + 'px';
      li.after(placeholder);
      li.classList.add('dragging');
    }, 0);
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    if (placeholder && placeholder.parentNode) placeholder.remove();
    placeholder = null;

    document.getElementById('calendar').classList.remove('cal-drop-mode');
    document.querySelectorAll('.cal-cell.cal-drag-over').forEach(c => c.classList.remove('cal-drag-over'));

    dragSrcId = null;
  });

  return li;
}

function render() {
  taskList.innerHTML = '';
  const visible = getVisibleTasks();

  if (visible.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    if (currentView === 'inbox') empty.textContent = 'Inbox vacío. ¡Todo planificado!';
    else if (currentView === 'planned') empty.textContent = 'Sin tareas planificadas. ¡Arrastra tareas al calendario!';
    else empty.textContent = 'Sin tareas para este día.';
    taskList.appendChild(empty);
  } else if (currentView === 'planned') {
    const todayStr = toISODate(new Date());
    const overdue = visible.filter(t => t.date < todayStr && !t.completed);
    const upcoming = visible.filter(t => t.date >= todayStr);

    // Overdue section
    if (overdue.length > 0) {
      const header = document.createElement('li');
      header.className = 'task-date-group-header overdue';
      header.textContent = 'Retrasadas';
      taskList.appendChild(header);
      overdue.sort((a, b) => a.date.localeCompare(b.date))
        .forEach(task => taskList.appendChild(createTaskElement(task)));
    }

    // Future groups
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

  } else if (currentView === 'day' && selectedDate === toISODate(new Date())) {
    // Today: overdue first, then today's tasks
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

  } else {
    visible.forEach(task => taskList.appendChild(createTaskElement(task)));
  }

  updateSubtitle();
  renderUpcoming();
}

taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;

  tasks.push({
    id: Date.now(),
    text,
    completed: false,
    date: currentView === 'day' ? selectedDate : null,
  });
  save();
  render();
  renderCalendar();
  taskInput.value = '';
  taskInput.focus();
});

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

  if (insertBefore) taskList.insertBefore(placeholder, insertBefore);
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

  // Reorder visible tasks; keep non-visible tasks intact
  const visibleIds = new Set(getVisibleTasks().map(t => t.id));
  const reorderedVisible = [...taskList.querySelectorAll('.task-item')]
    .map(el => tasks.find(t => String(t.id) === el.dataset.id))
    .filter(Boolean);
  const nonVisible = tasks.filter(t => !visibleIds.has(t.id));
  tasks = [...reorderedVisible, ...nonVisible];

  save();
});

// ===== UPCOMING TASKS (widget "Planificadas") =====
function renderUpcoming() {
  const container = document.getElementById('upcomingList');
  const todayStr = toISODate(new Date());

  const upcoming = tasks
    .filter(t => t.date && t.date >= todayStr && !t.completed)
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

  // Group by date
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

// Init
renderCalendar();
render();
renderUpcoming();
