// ===== SUPABASE AUTH =====
const SUPABASE_URL = 'https://ipnfxeifwldhnxqebwla.supabase.co';
const SUPABASE_KEY = 'sb_publishable_S0g2nl5ZrcoteqDgtx3rtQ_Ztj7wbIg';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function signInWithGoogle() {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) console.error('Error signing in:', error.message);
}

async function signOut() {
  closeSignOutPopover();
  await supabaseClient.auth.signOut();
}

function showLoginScreen() {
  document.getElementById('loginOverlay').hidden = false;
  document.getElementById('appRoot').hidden = true;
}

function hideLoginScreen() {
  document.getElementById('loginOverlay').hidden = true;
  document.getElementById('appRoot').hidden = false;
}

function updateUserUI(user) {
  const avatarEl = document.getElementById('sidebarUserAvatar');
  const nameEl = document.getElementById('sidebarUserName');
  const meta = user.user_metadata || {};

  const name = meta.full_name || meta.name || user.email || 'Usuario';
  const avatarUrl = meta.avatar_url || meta.picture;

  nameEl.textContent = name.split(' ')[0];

  avatarEl.innerHTML = '';
  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = name;
    avatarEl.appendChild(img);
  } else {
    const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    avatarEl.textContent = initials || '?';
  }
}

// ===== SIGN OUT POPOVER =====
let signOutPopover = null;

function openSignOutPopover() {
  if (signOutPopover) { closeSignOutPopover(); return; }

  const anchor = document.getElementById('sidebarUserSection');
  const rect = anchor.getBoundingClientRect();

  const popover = document.createElement('div');
  popover.className = 'signout-popover';
  popover.style.bottom = `${window.innerHeight - rect.top + 6}px`;
  popover.style.left = `${rect.left}px`;

  const btn = document.createElement('button');
  btn.className = 'signout-btn';
  btn.textContent = 'Cerrar sesión';
  btn.addEventListener('click', signOut);

  popover.appendChild(btn);
  popover.addEventListener('click', e => e.stopPropagation());
  document.body.appendChild(popover);
  signOutPopover = popover;
}

function closeSignOutPopover() {
  if (signOutPopover) {
    signOutPopover.remove();
    signOutPopover = null;
  }
}

document.addEventListener('click', closeSignOutPopover);

// ===== INIT =====
supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    hideLoginScreen();
    updateUserUI(session.user);
  } else {
    showLoginScreen();
  }
});

supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) {
    hideLoginScreen();
    updateUserUI(session.user);
  } else {
    showLoginScreen();
  }
});
