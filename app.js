const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const subtitle = document.getElementById('subtitle');
const footer = document.getElementById('footer');
const clearBtn = document.getElementById('clearCompleted');

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
    ? '1 producto pendiente'
    : `${pending} productos pendientes`;

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
  deleteBtn.setAttribute('aria-label', 'Eliminar producto');
  deleteBtn.innerHTML = '&#x2715;';

  // Toggle completed
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

  // Delete
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

    // Clon elevado como imagen del drag
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
    empty.textContent = 'La lista está vacía. ¡Agrega productos!';
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

  const draggingEl = taskList.querySelector('.dragging');
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

  // Sync tasks array to the new DOM order
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
