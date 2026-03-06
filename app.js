// DOM references
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const subtitle = document.getElementById('subtitle');
const taskCountBadge = document.getElementById('taskCountBadge');
const btnNewTask = document.getElementById('btnNewTask');

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
  subtitle.textContent = pending === 1
    ? '1 tarea pendiente'
    : `${pending} tareas pendientes`;
  taskCountBadge.textContent = `(${tasks.length})`;
}

// ===== CALENDAR =====
let calDate = new Date();

function renderCalendar() {
  const calTitle = document.getElementById('calTitle');
  const calEl = document.getElementById('calendar');

  const year = calDate.getFullYear();
  const month = calDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  calTitle.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  // Monday-first: 0=Mon…6=Sun
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  const dayNames = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

  let html = `<div class="cal-row cal-header">${
    dayNames.map(d => `<span class="cal-cell">${d}</span>`).join('')
  }</div>`;

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  let nextMonthDay = 1;

  for (let cell = 0; cell < totalCells; cell++) {
    if (cell % 7 === 0) html += '<div class="cal-row cal-week">';

    if (cell < startOffset) {
      const prevDay = daysInPrevMonth - startOffset + cell + 1;
      html += `<span class="cal-cell cal-prev-month">${prevDay}</span>`;
    } else {
      const dayNum = cell - startOffset + 1;
      if (dayNum <= daysInMonth) {
        const isToday = isCurrentMonth && dayNum === todayDate;
        html += `<span class="cal-cell${isToday ? ' cal-today' : ''}">${dayNum}</span>`;
      } else {
        html += `<span class="cal-cell cal-next-month">${nextMonthDay}</span>`;
        nextMonthDay++;
      }
    }

    if (cell % 7 === 6) html += '</div>';
  }

  calEl.innerHTML = html;
}

document.getElementById('calPrev').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById('calNext').addEventListener('click', () => {
  calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
});

// "+ Nueva tarea" focuses the input
btnNewTask.addEventListener('click', () => {
  taskInput.focus();
  taskInput.scrollIntoView({ behavior: 'smooth' });
});

// ===== TASKS =====
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
  check.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') toggle();
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

  // Drag & drop
  li.addEventListener('dragstart', e => {
    dragSrcId = task.id;
    e.dataTransfer.effectAllowed = 'move';

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
    dragSrcId = null;
  });

  li.append(handle, check, text, deleteBtn);
  return li;
}

function render() {
  taskList.innerHTML = '';
  tasks.forEach(task => taskList.appendChild(createTaskElement(task)));
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

// Init
renderCalendar();
render();
