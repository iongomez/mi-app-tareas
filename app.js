// ═══════════ TASK MANAGEMENT ═══════════

const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const subtitle = document.getElementById('subtitle');
const footer = document.getElementById('footer');
const clearBtn = document.getElementById('clearCompleted');
const taskCountBadge = document.getElementById('taskCountBadge');

const INITIAL_TASKS = [
  'Leche',
  'Huevos',
  'Pan',
  'Tomates',
  'Queso',
  'Yogur',
  'Manzanas',
  'Pollo',
  'Pasta',
  'Aceite de oliva',
];

let tasks = JSON.parse(localStorage.getItem('tasks') || 'null');

if (!tasks || tasks.length === 0) {
  tasks = INITIAL_TASKS.map((text, i) => ({ id: i + 1, text, completed: false }));
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function save() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function updateSubtitle() {
  const pending = tasks.filter(t => !t.completed).length;
  const total = tasks.length;

  subtitle.textContent = pending === 1
    ? '1 tarea pendiente'
    : `${pending} tareas pendientes`;

  taskCountBadge.textContent = `(${String(total).padStart(2, '0')})`;

  const hasCompleted = tasks.some(t => t.completed);
  footer.hidden = !hasCompleted;
}

let dragSrcId = null;
let placeholder = null;

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = 'task-item' + (task.completed ? ' completed' : '');
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
  text.addEventListener('click', toggle);
  check.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') toggle(); });

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

  // Drag & drop
  li.addEventListener('dragstart', e => {
    dragSrcId = task.id;
    e.dataTransfer.effectAllowed = 'move';

    const clone = li.cloneNode(true);
    clone.style.cssText = `
      width: ${li.offsetWidth}px;
      transform: scale(1.03) rotate(1.5deg);
      box-shadow: 0 12px 32px rgba(0,0,0,0.13);
      border-radius: 12px;
      position: absolute;
      top: -9999px;
      background: #fff;
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
    dragSrcId = null;
  });

  li.append(handle, check, text, deleteBtn);
  return li;
}

function render() {
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = '¡Sin tareas! Agrega una nueva tarea.';
    taskList.appendChild(empty);
  } else {
    tasks.forEach(task => taskList.appendChild(createTaskElement(task)));
  }

  updateSubtitle();
}

taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;

  tasks.push({ id: Date.now(), text, completed: false });
  save();
  render();
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
  if (!placeholder || dragSrcId === null) return;

  const draggingEl = taskList.querySelector('.dragging');
  taskList.insertBefore(draggingEl, placeholder);
  placeholder.remove();
  placeholder = null;

  tasks = [...taskList.querySelectorAll('.task-item')]
    .map(el => tasks.find(t => String(t.id) === el.dataset.id));

  save();
});

clearBtn.addEventListener('click', () => {
  tasks = tasks.filter(t => !t.completed);
  save();
  render();
});

render();

// ═══════════ CALENDAR ═══════════

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

let calYear, calMonth;

(function initCalendar() {
  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  renderCalendar();
})();

function renderCalendar() {
  document.getElementById('calendarTitle').textContent = `${MONTHS[calMonth]} ${calYear}`;

  const cal = document.getElementById('calendar');
  cal.innerHTML = '';

  // Day name headers
  const headerRow = document.createElement('div');
  headerRow.className = 'cal-row';
  DAYS.forEach(d => {
    const cell = document.createElement('span');
    cell.className = 'cal-cell cal-day-name';
    cell.textContent = d;
    headerRow.appendChild(cell);
  });
  cal.appendChild(headerRow);

  // Calculate layout
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // shift to Mon=0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  const totalCells = startOffset + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  const today = new Date();
  let dayIndex = 0;

  for (let row = 0; row < rows; row++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'cal-row';

    for (let col = 0; col < 7; col++) {
      const cell = document.createElement('span');
      cell.className = 'cal-cell';

      const i = row * 7 + col;

      if (i < startOffset) {
        // Previous month days
        cell.textContent = daysInPrevMonth - startOffset + i + 1;
        cell.classList.add('cal-other-month');
      } else if (dayIndex < daysInMonth) {
        dayIndex++;
        cell.textContent = dayIndex;

        if (
          dayIndex === today.getDate() &&
          calMonth === today.getMonth() &&
          calYear === today.getFullYear()
        ) {
          cell.classList.add('cal-today');
        }
      } else {
        // Next month days
        const nextDay = i - startOffset - daysInMonth + 1;
        cell.textContent = nextDay;
        cell.classList.add('cal-other-month');
      }

      rowEl.appendChild(cell);
    }

    cal.appendChild(rowEl);
  }
}

document.getElementById('calPrev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});

document.getElementById('calNext').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

// ═══════════ NUEVA TAREA BUTTON ═══════════

document.getElementById('btnNewTask').addEventListener('click', () => {
  taskInput.focus();
});
