const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const subtitle = document.getElementById('subtitle');
const footer = document.getElementById('footer');
const clearBtn = document.getElementById('clearCompleted');

const INITIAL_TASKS = [
  'Instalar Claude Code: npm install -g @anthropic-ai/claude-code',
  'Configurar la API key de Anthropic (claude config)',
  'Leer la documentación oficial en docs.anthropic.com/claude-code',
  'Aprender los comandos básicos: /help, /clear, /cost, /status',
  'Entender los modos de permisos (auto-approve, ask, deny)',
  'Practicar edición de archivos con Read, Edit y Write',
  'Aprender a usar Bash para comandos del sistema',
  'Crear un CLAUDE.md en un proyecto propio',
  'Explorar los hooks de configuración en settings',
  'Aprender el modo Plan con /plan antes de hacer cambios grandes',
  'Usar Glob y Grep para buscar en el codebase',
  'Probar el agente con tareas complejas de múltiples archivos',
  'Aprender sobre memoria persistente en ~/.claude/projects/',
  'Explorar los skills disponibles con /help',
  'Hacer un proyecto real de principio a fin con Claude Code',
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

    placeholder = document.createElement('li');
    placeholder.className = 'task-placeholder';

    setTimeout(() => {
      placeholder.style.height = li.offsetHeight + 'px';
      li.classList.add('dragging');
      li.after(placeholder);
    }, 0);
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    if (placeholder && placeholder.parentNode) placeholder.remove();
    placeholder = null;
    dragSrcId = null;
    render();
  });

  li.append(handle, check, text, deleteBtn);
  return li;
}

function render() {
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'No hay tareas. ¡Agrega una!';
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

  let insertIndex = 0;
  for (const node of taskList.children) {
    if (node === placeholder) break;
    if (node.classList.contains('task-item') && !node.classList.contains('dragging')) insertIndex++;
  }

  const fromIndex = tasks.findIndex(t => t.id === dragSrcId);
  const [removed] = tasks.splice(fromIndex, 1);
  tasks.splice(insertIndex, 0, removed);

  placeholder.remove();
  placeholder = null;

  save();
  render();
});

clearBtn.addEventListener('click', () => {
  tasks = tasks.filter(t => !t.completed);
  save();
  render();
});

render();
