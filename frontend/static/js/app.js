// ── API CLIENT ──────────────────────────────────────────────────────────────
const BASE_URL = '/api';

const api = {
  token: () => localStorage.getItem('token'),

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token()) h['Authorization'] = `Bearer ${this.token()}`;
    return h;
  },

  async request(method, path, body = null) {
    const opts = { method, headers: this.headers() };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(BASE_URL + path, opts);

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.app?.showAuth();
      return null;
    }

    if (res.status === 204) return null;

    const data = await res.json();
    if (!res.ok) {
      let errorMessage = 'Request failed';

      if (typeof data.detail === 'string') {
        errorMessage = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMessage = data.detail.map(err => err.msg).join(', ');
      } else if (data.message) {
        errorMessage = data.message;
      }

      throw new Error(errorMessage);
    }
    return data;
  },

  get: (path) => api.request('GET', path),
  post: (path, body) => api.request('POST', path, body),
  put: (path, body) => api.request('PUT', path, body),
  delete: (path) => api.request('DELETE', path),

  // Auth
  signup: (data) => api.post('/auth/register', data),
  verifyOtp: (data) => api.post('/auth/verify-otp', data),
  resendOtp: (data) => api.post('/auth/resend-otp', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),

  // Projects
  getProjects: () => api.get('/projects'),
  getProject: (id) => api.get(`/projects/${id}`),
  createProject: (data) => api.post('/projects', data),
  updateProject: (id, data) => api.put(`/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/projects/${id}`),
  addMember: (pid, data) => api.post(`/projects/${pid}/members`, data),
  removeMember: (pid, uid) => api.delete(`/projects/${pid}/members/${uid}`),

  // Tasks
  getTasks: (pid, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/projects/${pid}/tasks${q ? '?' + q : ''}`);
  },
  createTask: (pid, data) => api.post(`/projects/${pid}/tasks`, data),
  updateTask: (pid, tid, data) => api.put(`/projects/${pid}/tasks/${tid}`, data),
  deleteTask: (pid, tid) => api.delete(`/projects/${pid}/tasks/${tid}`),

  // Users
  getUsers: () => api.get('/users'),
  getDashboardStats: () => api.get('/users/dashboard/stats'),
};


// ── STATE ────────────────────────────────────────────────────────────────────
const state = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  projects: [],
  currentProject: null,
  tasks: [],
  users: [],
  currentPage: 'dashboard',
};


// ── UTILS ────────────────────────────────────────────────────────────────────
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function el(tag, cls = '', inner = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (inner) e.innerHTML = inner;
  return e;
}

function avatar(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(due, status) {
  if (!due || status === 'done') return false;
  return new Date(due) < new Date();
}

function statusBadge(s) {
  const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  return `<span class="badge badge-${s}">${labels[s] || s}</span>`;
}

function priorityBadge(p) {
  return `<span class="badge badge-${p}">● ${p}</span>`;
}

function showAlert(msg, type = 'error', container = null) {
  const div = el('div', `alert alert-${type}`, msg);
  const target = container || $('#alert-container');
  if (target) {
    target.innerHTML = '';
    target.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }
}


// ── MODAL ────────────────────────────────────────────────────────────────────
function openModal(title, bodyHTML, onSubmit, submitLabel = 'Save') {
  const overlay = el('div', 'modal-overlay');
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close" id="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div id="modal-alert"></div>
        ${bodyHTML}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" id="cancel-modal">Cancel</button>
        <button class="btn btn-primary btn-sm" id="submit-modal" style="width:auto">${submitLabel}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#close-modal').onclick = close;
  overlay.querySelector('#cancel-modal').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  overlay.querySelector('#submit-modal').onclick = async () => {
    const btn = overlay.querySelector('#submit-modal');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      await onSubmit(overlay, close);
    } catch (e) {
      showAlert(e.message, 'error', overlay.querySelector('#modal-alert'));
      btn.disabled = false;
      btn.textContent = submitLabel;
    }
  };

  return overlay;
}


// ── AUTH ─────────────────────────────────────────────────────────────────────
// ── LANDING PAGE ─────────────────────────────────────────────────────────────
function renderLandingPage() {
  document.body.innerHTML = `
    <div class="landing-page">
      <nav class="landing-nav">
        <div class="landing-logo">
          <span style="font-size:24px">✦</span> TeamTask
        </div>
        <div class="landing-menu">
          <a href="#">Home</a>
          <a href="#">Projects</a>
          <a href="#">Communications</a>
          <a href="#">Pricing</a>
          <a href="#">Blog</a>
        </div>
        <div class="landing-actions">
          <button class="btn btn-ghost btn-sm" id="btn-show-login">Log in</button>
          <button class="btn btn-primary btn-sm" style="width:auto" id="btn-show-signup">Sign Up</button>
        </div>
      </nav>

      <header class="hero">
        <div class="hero-content">
          <h1>TeamTask: Your Team's Hub for Streamlined Workflows.</h1>
          <p>Effortless Collaboration, Higher Productivity. Manage your tasks and projects with a beautiful, unified interface.</p>
          <div class="hero-btns">
            <button class="btn btn-primary" style="width:auto;padding:14px 28px" id="hero-get-started">GET STARTED FREE</button>
            <button class="btn btn-ghost" style="width:auto;padding:14px 28px">Watch Demo</button>
          </div>
        </div>
        <div class="hero-image">
          <img src="https://img.freepik.com/free-vector/flat-hand-drawn-project-management-concept_23-2148834525.jpg" alt="Team Work">
        </div>
      </header>

      <section class="features">
        <div class="feature-card">
          <div class="feature-icon">📁</div>
          <h3>Visual Task Management</h3>
          <p>Manage tasks with flexible Kanban boards. (Image of generic empty Kanban boards)</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">💬</div>
          <h3>Real-time Chat</h3>
          <p>Collaborate with your team instantly with built-in messaging features.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>Detailed Reporting</h3>
          <p>Get insights into your team's performance with advanced analytics.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">☁️</div>
          <h3>File Sharing</h3>
          <p>Store and share important documents directly within your projects.</p>
        </div>
      </section>
    </div>`;

  $('#btn-show-login').onclick = showLoginModal;
  $('#btn-show-signup').onclick = showSignupModal;
  $('#hero-get-started').onclick = showSignupModal;
}

function showLoginModal() {
  openModal('Log In', `
    <form id="login-form">
      <div class="form-group">
        <label>Email address</label>
        <input type="email" id="login-email" required placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="login-password" required placeholder="••••••••">
      </div>
    </form>
  `, async (modal, close) => {
    const email = modal.querySelector('#login-email').value;
    const password = modal.querySelector('#login-password').value;
    const data = await api.login({ email, password });
    if (data) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      state.user = data.user;
      close();
      renderApp();
    }
  }, 'Sign In');
}

function showSignupModal() {
  openModal('Create Account', `
    <form id="signup-form">
      <div class="form-group">
        <label>Full Name</label>
        <input type="text" id="signup-name" required placeholder="John Doe">
      </div>
      <div class="form-group">
        <label>Email address</label>
        <input type="email" id="signup-email" required placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="signup-password" required placeholder="Min. 6 characters">
      </div>
      <div class="form-group">
        <label>Role</label>
        <select id="signup-role">
          <option value="member">Team Member</option>
          <option value="admin">Administrator</option>
        </select>
      </div>
    </form>
  `, async (modal, close) => {
    const data = await api.signup({
      name: modal.querySelector('#signup-name').value,
      email: modal.querySelector('#signup-email').value,
      password: modal.querySelector('#signup-password').value,
      role: modal.querySelector('#signup-role').value,
    });
    if (data) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      state.user = data.user;
      close();
      renderApp();
    }
  }, 'Create Account');
}

async function handleLogin() {
  const btn = $('#auth-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in…';
  try {
    const data = await api.login({ email: $('#email').value, password: $('#password').value });
    if (data) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      state.user = data.user;
      renderApp();
    }
  } catch (e) {
    showAlert(e.message, 'error', $('#auth-alert'));
    btn.disabled = false;
    btn.textContent = 'Sign In →';
  }
}

async function handleSignup() {
  const btn = $('#auth-submit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating account…';
  try {
    const data = await api.signup({
      name: $('#name').value,
      email: $('#email').value,
      password: $('#password').value,
      role: $('#role').value,
    });

    if (data) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      state.user = data.user;
      renderApp();
    }
  } catch (e) {
    showAlert(e.message, 'error', $('#auth-alert'));
    btn.disabled = false;
    btn.textContent = 'Create Account →';
  }
}

// ── APP SHELL ─────────────────────────────────────────────────────────────────
function renderApp() {
  document.body.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <span style="font-size:28px">✦</span> TeamTask
        </div>
        <div class="sidebar-profile">
          <div class="user-avatar" style="width:40px; height:40px; border-radius:10px; font-size:14px">${avatar(state.user?.name)}</div>
          <div class="user-info">
            <div class="user-name" style="font-size:14px">${state.user?.name}</div>
            <div class="user-role" style="font-size:11px">${state.user?.role}</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <a href="#" class="nav-item active" data-page="dashboard">🏠 Dashboard</a>
          <a href="#" class="nav-item" data-page="teams">👥 Teams</a>
          <a href="#" class="nav-item" data-page="employees">👤 Employees</a>
          <a href="#" class="nav-item" data-page="projects">📁 Projects</a>
          <a href="#" class="nav-item" data-page="my-tasks">✅ Tasks</a>
          <a href="#" class="nav-item" data-page="reports">📊 Reports</a>
          <a href="#" class="nav-item" data-page="support">🎧 Support</a>
          
          ${state.user?.role === 'admin' ? `
          <div class="nav-section-label">Admin</div>
          <a href="#" class="nav-item" data-page="users">👮 All Users</a>` : ''}
        </nav>
        <div class="sidebar-footer">
          <a href="#" class="nav-item" data-page="settings" style="margin-bottom:8px">⚙️ Settings</a>
          <button class="btn btn-ghost" style="width:100%; justify-content:flex-start" id="logout-btn">⎋ Sign Out</button>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div class="topbar-search">
            <input type="text" placeholder="Search tasks, projects, etc.">
          </div>
          <div class="topbar-actions">
            <div style="font-size: 13px; font-weight:600">${state.user?.name}</div>
            <div class="user-avatar" style="width:34px;height:34px">${avatar(state.user?.name)}</div>
          </div>
        </div>
        <div id="alert-container"></div>
        <div id="page-content"></div>
      </main>
    </div>`;

  $$('.nav-item').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      navigateTo(btn.dataset.page);
    };
  });

  $('#logout-btn').onclick = () => {
    localStorage.clear();
    state.user = null;
    renderLandingPage();
  };

  navigateTo('dashboard');
}

function setActivePage(page) {
  $$('[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  state.currentPage = page;
}

async function navigateTo(page, params = {}) {
  setActivePage(page);
  const content = $('#page-content');
  content.innerHTML = '<div class="page-loading"><div class="spinner"></div><p>Loading…</p></div>';

  try {
    if (page === 'dashboard') await renderDashboard();
    else if (page === 'projects') await renderProjects();
    else if (page === 'project') await renderProject(params.id);
    else if (page === 'my-tasks') await renderMyTasks();
    else if (page === 'users') await renderUsers();
  } catch (e) {
    content.innerHTML = `<div class="content"><div class="alert alert-error">Error: ${e.message}</div></div>`;
  }
}


// ── DASHBOARD ─────────────────────────────────────────────────────────────────
// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const stats = await api.getDashboardStats();
  const projects = await api.getProjects();
  state.projects = projects || [];

  $('#page-content').innerHTML = `
    <div style="padding: 32px">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px">
        <div>
          <h1 style="font-size:24px; font-weight:800">My Tasks Overview | ${state.user?.name}</h1>
          <div style="font-size:13px; color:var(--text-secondary)">Dashboard</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px; font-weight:700">🕒 ${new Date().toLocaleString()}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">My Projects</div>
          <div class="stat-value">${stats?.total_projects ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">My Tasks</div>
          <div class="stat-value">${stats?.total_tasks ?? 0}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px">${stats?.tasks_in_progress ?? 0} pending · <span style="color:var(--danger)">${stats?.overdue_tasks ?? 0} overdue</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">My Upcoming Deadlines</div>
          <div class="stat-value">—</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">My Performance Rate</div>
          <div class="stat-value">94%</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px">
            <h2 style="font-size:16px; font-weight:800">MY TASKS KANBAN BOARD</h2>
            <div class="tasks-filters">
              <button class="filter-chip active">All</button>
              <button class="filter-chip">Filter</button>
            </div>
          </div>
          <div id="kanban-container"></div>
        </div>
        
        <div>
          <div class="section-card">
            <div class="section-card-header">Recent Activity</div>
            <div class="section-card-body">
              <div class="activity-list">
                <div class="activity-item">
                  <div class="activity-avatar" style="background: #8b5cf6">SL</div>
                  <div class="activity-content">
                    <div class="activity-msg"><b>Sarah L.</b> completed <b>Login Mockups</b></div>
                    <div class="activity-time">24 mins ago</div>
                  </div>
                </div>
                <div class="activity-item">
                  <div class="activity-avatar" style="background: #3b82f6">MB</div>
                  <div class="activity-content">
                    <div class="activity-msg"><b>Michael B.</b> moved <b>API Integration</b> to In Progress</div>
                    <div class="activity-time">1 hour ago</div>
                  </div>
                </div>
                <div class="activity-item">
                  <div class="activity-avatar" style="background: #10b981">JD</div>
                  <div class="activity-content">
                    <div class="activity-msg"><b>John Doe</b> added a comment to <b>Database Setup</b></div>
                    <div class="activity-time">3 hours ago</div>
                  </div>
                </div>
                <div class="activity-item">
                  <div class="activity-avatar" style="background: #f59e0b">AK</div>
                  <div class="activity-content">
                    <div class="activity-msg"><b>Anna K.</b> created new project <b>Website Redesign</b></div>
                    <div class="activity-time">Yesterday</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  renderDashboardKanban();
}

async function renderDashboardKanban() {
  // Aggregate tasks from all projects for the current user
  let allTasks = [];
  for (const p of state.projects) {
    try {
      const tasks = await api.getTasks(p.id, { assignee_id: state.user?.id });
      if (tasks) allTasks = allTasks.concat(tasks);
    } catch (_) { }
  }

  const cols = { todo: [], in_progress: [], under_review: [], done: [] };
  allTasks.forEach(t => { 
    const s = t.status === 'done' ? 'done' : (t.status === 'in_progress' ? 'in_progress' : 'todo');
    if (cols[s]) cols[s].push(t); 
  });

  const labels = { todo: 'To Do', in_progress: 'In Progress', under_review: 'Under Review', done: 'Completed' };
  
  $('#kanban-container').innerHTML = `
    <div class="kanban-board-v2">
      ${Object.entries(cols).map(([status, items]) => `
        <div class="kanban-col-v2">
          <div class="kanban-col-title">
            ${labels[status]}
            <span class="count-pill">${items.length}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:16px">
            ${items.length === 0 ? '<div class="empty-state" style="font-size:11px; padding:20px">No tasks</div>' :
              items.map(t => {
                const progress = t.status === 'done' ? 100 : (t.status === 'in_progress' ? 50 : 0);
                return `
                <div class="kanban-card">
                  <div class="card-tags">
                    <span class="card-tag tag-${t.priority}">${t.priority}</span>
                  </div>
                  <div class="kanban-card-title">${t.title}</div>
                  
                  <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px">Progress</div>
                  <div class="card-progress">
                    <div class="card-progress-bar" style="width: ${progress}%"></div>
                  </div>

                  <div class="kanban-card-meta">
                    <div style="display:flex; align-items:center; gap:8px">
                      <div class="user-avatar" style="width:24px; height:24px; font-size:10px; border-radius:6px">${avatar(state.user?.name)}</div>
                      <span style="font-size:12px; font-weight:700; color:var(--text-primary)">${state.user?.name}</span>
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); display:flex; align-items:center; gap:4px">
                      <span>📅</span>
                      <span>${formatDate(t.due_date)}</span>
                    </div>
                  </div>
                </div>`;
              }).join('')
            }
          </div>
        </div>`).join('')}
    </div>`;
}


// ── PROJECTS ──────────────────────────────────────────────────────────────────
function projectCard(p) {
  return `
      <div class="project-card" data-id="${p.id}">
      <div class="project-card-header">
        <div class="project-name">${p.name}</div>
        <span class="badge badge-member">${p.task_count ?? 0} tasks</span>
      </div>
      <div class="project-desc">${p.description || '<em style="opacity:.5">No description</em>'}</div>
      <div class="project-meta">
        <span class="project-owner">
          <span style="width:20px;height:20px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white">${avatar(p.owner?.name)}</span>
          ${p.owner?.name}
        </span>
        <span>👥 ${p.members?.length ?? 0} members</span>
      </div>
    </div>`;
}

async function renderProjects() {
  const projects = await api.getProjects();
  state.projects = projects || [];

  $('#page-content').innerHTML = `
    <div style="padding: 32px">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px">
        <div>
          <h1 style="font-size:24px; font-weight:800">Projects</h1>
          <div style="font-size:13px; color:var(--text-secondary)">Manage your team's workspaces</div>
        </div>
        <button class="btn btn-primary btn-sm" style="width:auto" id="new-project-btn">+ New Project</button>
      </div>

      ${state.projects.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📁</div><p>No projects yet.</p><button class="btn btn-primary btn-sm" id="create-first">Create Your First Project</button></div>'
        : `<div class="projects-grid">${state.projects.map(projectCard).join('')}</div>`
      }
    </div>`;

  $('#new-project-btn')?.addEventListener('click', openCreateProjectModal);
  $('#create-first')?.addEventListener('click', openCreateProjectModal);
  $$('.project-card').forEach(card => {
    card.addEventListener('click', () => navigateTo('project', { id: card.dataset.id }));
  });
}

function openCreateProjectModal() {
  openModal('Create New Project', `
      <div class="form-group">
      <label>Project Name *</label>
      <input type="text" id="proj-name" placeholder="e.g. Website Redesign">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="proj-desc" placeholder="What is this project about?"></textarea>
    </div>`, async (modal, close) => {
    const name = modal.querySelector('#proj-name').value.trim();
    if (!name) throw new Error('Project name is required');
    await api.createProject({ name, description: modal.querySelector('#proj-desc').value });
    close();
    navigateTo(state.currentPage);
  }, 'Create Project');
}


// ── PROJECT DETAIL ────────────────────────────────────────────────────────────
async function renderProject(projectId) {
  const [project, tasks, users] = await Promise.all([
    api.getProject(projectId),
    api.getTasks(projectId),
    api.getUsers(),
  ]);
  state.currentProject = project;
  state.tasks = tasks || [];
  state.users = users || [];

  const isOwnerOrAdmin = state.user?.role === 'admin' || project.owner_id === state.user?.id;

  $('#page-content').innerHTML = `
    <div style="padding: 32px">
      <div class="breadcrumb">
        <a href="#" onclick="navigateTo('projects');return false">Projects</a>
        <span>›</span>
        <span>${project.name}</span>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px">
        <h1 style="font-size:24px; font-weight:800">${project.name}</h1>
        <div class="topbar-actions">
          <button class="btn btn-primary btn-sm" id="new-task-btn">+ New Task</button>
          ${isOwnerOrAdmin ? `<button class="btn btn-ghost btn-sm" id="edit-project-btn">Edit</button>` : ''}
          ${isOwnerOrAdmin ? `<button class="btn btn-icon btn-sm" id="delete-project-btn" title="Delete project">🗑</button>` : ''}
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 300px; gap:24px; align-items:start">
        <div>
          <div class="tasks-header">
            <div class="tasks-filters">
              <button class="filter-chip active" data-status="">All</button>
              <button class="filter-chip" data-status="todo">To Do</button>
              <button class="filter-chip" data-status="in_progress">In Progress</button>
              <button class="filter-chip" data-status="done">Done</button>
            </div>
            <div class="tasks-filters">
              <button class="filter-chip active" data-view="list" id="view-list">≡ List</button>
              <button class="filter-chip" data-view="kanban" id="view-kanban">⊞ Board</button>
            </div>
          </div>
          <div id="task-container"></div>
        </div>

        <div>
          <div class="section-card">
            <div class="section-card-header">About</div>
            <div class="section-card-body" style="font-size:13px; color:var(--text-secondary)">
              ${project.description || '<em>No description</em>'}
            </div>
          </div>
          <div class="section-card">
            <div class="section-card-header">
              Members
              ${isOwnerOrAdmin ? `<button class="btn btn-ghost btn-sm" id="add-member-btn">+ Add</button>` : ''}
            </div>
            <div class="section-card-body">
              <div class="members-list" id="members-list">
                ${project.members.map(m => `
                  <div class="member-row">
                    <div class="user-avatar">${avatar(m.user?.name)}</div>
                    <div class="member-info">
                      <div class="member-name">${m.user?.name}</div>
                      <div class="member-email">${m.user?.email}</div>
                    </div>
                    <span class="badge badge-${m.role}">${m.role}</span>
                  </div>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  renderTaskList(state.tasks);

  // Filter chips
  let activeStatus = '';
  $$('.filter-chip[data-status]').forEach(chip => {
    chip.onclick = async () => {
      $$('.filter-chip[data-status]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeStatus = chip.dataset.status;
      const filtered = activeStatus
        ? state.tasks.filter(t => t.status === activeStatus)
        : state.tasks;
      if (currentView === 'kanban') renderKanban(filtered);
      else renderTaskList(filtered);
    };
  });

  let currentView = 'list';
  $('#view-list').onclick = () => {
    currentView = 'list';
    $$('[data-view]').forEach(b => b.classList.remove('active'));
    $('#view-list').classList.add('active');
    renderTaskList(activeStatus ? state.tasks.filter(t => t.status === activeStatus) : state.tasks);
  };
  $('#view-kanban').onclick = () => {
    currentView = 'kanban';
    $$('[data-view]').forEach(b => b.classList.remove('active'));
    $('#view-kanban').classList.add('active');
    renderKanban(activeStatus ? state.tasks.filter(t => t.status === activeStatus) : state.tasks);
  };

  $('#new-task-btn').onclick = () => openCreateTaskModal(projectId);
  $('#add-member-btn')?.addEventListener('click', () => openAddMemberModal(projectId));
  $('#edit-project-btn')?.addEventListener('click', () => openEditProjectModal(project));
  $('#delete-project-btn')?.addEventListener('click', () => confirmDeleteProject(project));
}

function renderTaskList(tasks) {
  const container = $('#task-container');
  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>No tasks here.</p></div>`;
    return;
  }
  container.innerHTML = `<div class="task-list">${tasks.map(taskCard).join('')}</div>`;
  container.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.onclick = (e) => {
      e.stopPropagation();
      const taskId = cb.dataset.tid;
      const pid = cb.dataset.pid;
      const status = cb.dataset.status === 'done' ? 'todo' : 'done';
      toggleTaskDone(pid, taskId, status);
    };
  });
  container.querySelectorAll('.task-edit-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const task = state.tasks.find(t => t.id == btn.dataset.tid);
      if (task) openEditTaskModal(task);
    };
  });
  container.querySelectorAll('.task-delete-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteTask(btn.dataset.pid, btn.dataset.tid);
    };
  });
}

function taskCard(t) {
  const overdue = isOverdue(t.due_date, t.status);
  return `
    <div class="task-card">
      <div class="task-checkbox ${t.status === 'done' ? 'done' : ''}"
           data-tid="${t.id}" data-pid="${t.project_id}" data-status="${t.status}">
        ${t.status === 'done' ? '✓' : ''}
      </div>
      <div class="task-info">
        <div class="task-title ${t.status === 'done' ? 'done' : ''}">${t.title}</div>
        <div class="task-meta">
          ${statusBadge(t.status)}
          ${priorityBadge(t.priority)}
          ${t.due_date ? `<span class="${overdue ? 'badge badge-overdue' : ''}">📅 ${formatDate(t.due_date)}${overdue ? ' Overdue' : ''}</span>` : ''}
        </div>
        ${t.assignees && t.assignees.length ? `
          <div style="margin-top:8px;display:flex;gap:4px">
            ${t.assignees.map(a => `<div class="user-avatar" style="width:24px;height:24px;font-size:10px" title="${a.name}">${avatar(a.name)}</div>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="task-actions">
        <button class="btn btn-icon btn-sm task-edit-btn" data-tid="${t.id}" title="Edit">✏</button>
        <button class="btn btn-icon btn-sm task-delete-btn" data-pid="${t.project_id}" data-tid="${t.id}" title="Delete">🗑</button>
      </div>
    </div>`;
}

function renderKanban(tasks) {
  const cols = { todo: [], in_progress: [], done: [] };
  tasks.forEach(t => { if (cols[t.status]) cols[t.status].push(t); });

  const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
  const colors = { todo: 'var(--text-muted)', in_progress: 'var(--accent)', done: 'var(--success)' };

  $('#task-container').innerHTML = `
    <div class="kanban-board">
      ${
        Object.entries(cols).map(([status, items]) => `
        <div class="kanban-col">
          <div class="kanban-col-header" style="color:${colors[status]}">
            ${labels[status]}
            <span class="count-pill">${items.length}</span>
          </div>
          <div class="kanban-tasks">
            ${items.length === 0 ? '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px">Empty</div>' :
            items.map(t => `
                <div class="kanban-task">
                  <div class="kanban-task-title">${t.title}</div>
                  <div class="kanban-task-meta">
                    ${priorityBadge(t.priority)}
                  </div>
                  ${t.assignees && t.assignees.length ? `
                    <div style="margin-top:8px;display:flex;gap:4px;justify-content:flex-end">
                      ${t.assignees.map(a => `<div class="user-avatar" style="width:20px;height:20px;font-size:9px" title="${a.name}">${avatar(a.name)}</div>`).join('')}
                    </div>
                  ` : ''}
                </div>`).join('')
          }
          </div>
        </div>`).join('')
  }
    </div>`;
}


// ── MY TASKS ──────────────────────────────────────────────────────────────────
async function renderMyTasks() {
  const projects = await api.getProjects();
  state.projects = projects || [];

  let allTasks = [];
  for (const p of state.projects) {
    try {
      const tasks = await api.getTasks(p.id, { assignee_id: state.user?.id });
      if (tasks) allTasks = allTasks.concat(tasks.map(t => ({ ...t, _projectName: p.name })));
    } catch (_) { }
  }

  $('#page-content').innerHTML = `
    <div style="padding: 32px">
      <div style="margin-bottom:24px">
        <h1 style="font-size:24px; font-weight:800">My Tasks</h1>
        <div style="font-size:13px; color:var(--text-secondary)">All tasks assigned to you across all projects</div>
      </div>

      ${allTasks.length === 0
        ? '<div class="empty-state"><div class="empty-icon">✅</div><p>No tasks assigned to you yet.</p></div>'
        : `<div class="task-list">${allTasks.map(t => `
            <div class="task-card">
              <div class="task-checkbox ${t.status === 'done' ? 'done' : ''}"
                   data-tid="${t.id}" data-pid="${t.project_id}" data-status="${t.status}">
                ${t.status === 'done' ? '✓' : ''}
              </div>
              <div class="task-info">
                <div class="task-title ${t.status === 'done' ? 'done' : ''}">${t.title}</div>
                <div class="task-meta">
                  ${statusBadge(t.status)}
                  ${priorityBadge(t.priority)}
                  <span style="color:var(--accent); font-weight:600">📁 ${t._projectName}</span>
                  ${t.due_date ? `<span>📅 ${formatDate(t.due_date)}</span>` : ''}
                </div>
              </div>
            </div>`).join('')}</div>`
      }
    </div>`;

  $$('.task-checkbox').forEach(cb => {
    cb.onclick = () => toggleTaskDone(cb.dataset.pid, cb.dataset.tid,
      cb.dataset.status === 'done' ? 'todo' : 'done');
  });
}


// ── USERS (ADMIN) ─────────────────────────────────────────────────────────────
async function renderUsers() {
  if (state.user?.role !== 'admin') {
    $('#page-content').innerHTML = '<div class="content"><div class="alert alert-error">Admin access required</div></div>';
    return;
  }
  const users = await api.getUsers();

  $('#page-content').innerHTML = `
    <div style="padding: 32px">
      <div style="margin-bottom:24px">
        <h1 style="font-size:24px; font-weight:800">All Users</h1>
        <div style="font-size:13px; color:var(--text-secondary)">Manage system users and their roles</div>
      </div>

      <div class="section-card">
        <div class="section-card-body table-wrapper">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <div class="user-avatar" style="width:30px;height:30px;font-size:11px">${avatar(u.name)}</div>
                      <span style="font-weight:600">${u.name}</span>
                    </div>
                  </td>
                  <td style="color:var(--text-secondary)">${u.email}</td>
                  <td><span class="badge badge-${u.role}">${u.role}</span></td>
                  <td><span class="badge ${u.is_active ? 'badge-done' : 'badge-high'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style="color:var(--text-muted)">${formatDate(u.created_at)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}


// ── TASK ACTIONS ──────────────────────────────────────────────────────────────
function openCreateTaskModal(projectId) {
  const memberOptions = (state.currentProject?.members || [])
    .map(m => `<option value="${m.user_id}">${m.user?.name}</option>`).join('');

  openModal('Create Task', `
    <div class="form-group">
      <label>Title *</label>
      <input type="text" id="task-title" placeholder="What needs to be done?">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="task-desc" placeholder="Add details…"></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Status</label>
        <select id="task-status">
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div class="form-group">
        <label>Priority</label>
        <select id="task-priority">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Assignees (Ctrl+Click to select multiple)</label>
        <select id="task-assignee" multiple size="3" style="height:auto">
          ${memberOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Due Date</label>
        <input type="date" id="task-due">
      </div>
    </div>`, async (modal, close) => {
    const title = modal.querySelector('#task-title').value.trim();
    if (!title) throw new Error('Title is required');
    const assignees = Array.from(modal.querySelector('#task-assignee').selectedOptions).map(opt => parseInt(opt.value));
    await api.createTask(projectId, {
      title,
      description: modal.querySelector('#task-desc').value,
      status: modal.querySelector('#task-status').value,
      priority: modal.querySelector('#task-priority').value,
      assignee_ids: assignees,
      due_date: modal.querySelector('#task-due').value || null,
    });
    const tasks = await api.getTasks(projectId);
    state.tasks = tasks || [];
    close();
    renderTaskList(state.tasks);
  }, 'Create Task');
}

function openEditTaskModal(task) {
  const assigneeIds = (task.assignees || []).map(a => a.id);
  const memberOptions = (state.currentProject?.members || [])
    .map(m => `<option value="${m.user_id}" ${assigneeIds.includes(m.user_id) ? 'selected' : ''}>${m.user?.name}</option>`).join('');

  openModal('Edit Task', `
    <div class="form-group">
      <label>Title *</label>
      <input type="text" id="task-title" value="${task.title}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="task-desc">${task.description || ''}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Status</label>
        <select id="task-status">
          <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
          <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
        </select>
      </div>
      <div class="form-group">
        <label>Priority</label>
        <select id="task-priority">
          <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
          <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
        </select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group">
        <label>Assignees (Ctrl+Click to select multiple)</label>
        <select id="task-assignee" multiple size="3" style="height:auto">
          ${memberOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Due Date</label>
        <input type="date" id="task-due" value="${task.due_date || ''}">
      </div>
    </div>`, async (modal, close) => {
    const title = modal.querySelector('#task-title').value.trim();
    if (!title) throw new Error('Title is required');
    const assignees = Array.from(modal.querySelector('#task-assignee').selectedOptions).map(opt => parseInt(opt.value));
    await api.updateTask(task.project_id, task.id, {
      title,
      description: modal.querySelector('#task-desc').value,
      status: modal.querySelector('#task-status').value,
      priority: modal.querySelector('#task-priority').value,
      assignee_ids: assignees,
      due_date: modal.querySelector('#task-due').value || null,
    });
    const tasks = await api.getTasks(task.project_id);
    state.tasks = tasks || [];
    close();
    renderTaskList(state.tasks);
  }, 'Save Changes');
}

async function toggleTaskDone(projectId, taskId, newStatus) {
  await api.updateTask(projectId, taskId, { status: newStatus });
  const tasks = await api.getTasks(projectId);
  state.tasks = tasks || [];
  renderTaskList(state.tasks);
}

async function deleteTask(projectId, taskId) {
  if (!confirm('Delete this task?')) return;
  await api.deleteTask(projectId, taskId);
  state.tasks = state.tasks.filter(t => t.id != taskId);
  renderTaskList(state.tasks);
}


// ── PROJECT ACTIONS ───────────────────────────────────────────────────────────
function openEditProjectModal(project) {
  openModal('Edit Project', `
    <div class="form-group">
      <label>Project Name *</label>
      <input type="text" id="proj-name" value="${project.name}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="proj-desc">${project.description || ''}</textarea>
    </div>`, async (modal, close) => {
    const name = modal.querySelector('#proj-name').value.trim();
    if (!name) throw new Error('Name is required');
    await api.updateProject(project.id, { name, description: modal.querySelector('#proj-desc').value });
    close();
    navigateTo('project', { id: project.id });
  }, 'Save Changes');
}

async function confirmDeleteProject(project) {
  if (!confirm(`Delete project "${project.name}" ? This will delete all tasks too.`)) return;
  await api.deleteProject(project.id);
  navigateTo('projects');
}

function openAddMemberModal(projectId) {
  const existingIds = (state.currentProject?.members || []).map(m => m.user_id);
  const available = state.users.filter(u => !existingIds.includes(u.id));

  if (!available.length) {
    showAlert('All users are already members of this project', 'error');
    return;
  }

  openModal('Add Member', `
    <div class="form-group">
      <label>Select User</label>
      <select id="add-user-id">
        ${available.map(u => `<option value="${u.id}">${u.name} (${u.email})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Role in Project</label>
      <select id="add-user-role">
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
    </div>`, async (modal, close) => {
    const userId = parseInt(modal.querySelector('#add-user-id').value);
    const role = modal.querySelector('#add-user-role').value;
    await api.addMember(projectId, { user_id: userId, role });
    close();
    navigateTo('project', { id: projectId });
  }, 'Add Member');
}

async function removeMember(projectId, userId) {
  if (!confirm('Remove this member?')) return;
  await api.removeMember(projectId, userId);
  navigateTo('project', { id: projectId });
}


// ── INIT ──────────────────────────────────────────────────────────────────────
window.app = {
  showAuth: renderLandingPage,
  navigateTo,
  removeMember,
};

// ── INITIALIZATION ────────────────────────────────────────────────────────────
window.onload = () => {
  if (state.user && localStorage.getItem('token')) {
    renderApp();
  } else {
    renderLandingPage();
  }
};
