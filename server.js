require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieSession({
  name: 'primz_admin_session',
  secret: process.env.SESSION_SECRET || 'change_this_secret_before_deploying',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  httpOnly: true,
  sameSite: 'lax'
}));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Public static site (index.html, privacy.html). admin.html is NOT in here on purpose.
app.use(express.static(path.join(__dirname, 'public')));

// These are client-rendered pages inside index.html, but need a real server
// route too so a direct visit or a page refresh on these URLs still works.
app.get(['/realestate', '/creators', '/localbusiness'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- Public: receive custom requests from the site ----------
app.post('/api/requests', async (req, res) => {
  const { name, contact, needs, segment } = req.body || {};

  if (!name || !contact || !needs) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { error } = await supabase
    .from('custom_requests')
    .insert([{ name, contact, needs, segment: segment || 'general' }]);

  if (error) {
    console.error('Supabase insert error:', error.message);
    return res.status(500).json({ error: 'Could not save request' });
  }

  res.json({ ok: true });
});

// ---------- Admin: login ----------
app.get('/admin/login', (req, res) => {
  res.send(loginPage());
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password && process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
    req.session.authed = true;
    return res.redirect('/admin');
  }
  res.send(loginPage('Incorrect password.'));
});

app.get('/admin/logout', (req, res) => {
  req.session = null;
  res.redirect('/admin/login');
});

// ---------- Admin: panel (password protected, not linked anywhere on the public site) ----------
app.get('/admin', (req, res) => {
  if (!req.session || !req.session.authed) {
    return res.redirect('/admin/login');
  }
  res.send(adminPage());
});

app.get('/api/admin/requests', async (req, res) => {
  if (!req.session || !req.session.authed) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, error } = await supabase
    .from('custom_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase select error:', error.message);
    return res.status(500).json({ error: 'Could not load requests' });
  }

  res.json({ data });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Primz server running on port ${PORT}`));

// ---------- Inline admin HTML (kept out of /public so it's never served as a static file) ----------

function pageShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#0a0a0a; --surface:#131313; --border:#262626; --bordersoft:#1e1e1e;
    --text:#fafafa; --textdim:#8c8c8c; --textfaint:#565656;
    box-sizing:border-box;
    padding-top:env(safe-area-inset-top,0px); padding-bottom:env(safe-area-inset-bottom,0px);
  }
  *{box-sizing:inherit;margin:0;padding:0;}
  html,body{height:100%;background:var(--bg);color:var(--text);}
  body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased;}
  a{color:var(--text);}
  .wrap{max-width:960px;margin:0 auto;padding:48px 28px;}
  h1{font-size:24px;font-weight:700;letter-spacing:0.02em;margin-bottom:24px;}
  .field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;max-width:320px;}
  label{font-size:13px;color:var(--textdim);}
  input{background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:12px 14px;color:var(--text);font-family:inherit;font-size:14.5px;}
  input:focus{outline:none;border-color:var(--textdim);}
  button{font-family:inherit;font-size:14.5px;font-weight:500;padding:11px 20px;border-radius:9px;border:1px solid var(--text);background:var(--text);color:var(--bg);cursor:pointer;transition:transform .12s ease, filter .12s ease;}
  button:active{transform:scale(0.96);filter:brightness(0.88);}
  .error{color:#ff6b6b;font-size:13.5px;margin-bottom:16px;}
  table{width:100%;border-collapse:collapse;margin-top:20px;}
  th,td{text-align:left;padding:14px 12px;border-bottom:1px solid var(--bordersoft);font-size:14px;vertical-align:top;}
  th{color:var(--textfaint);font-weight:500;font-size:12.5px;text-transform:uppercase;letter-spacing:0.05em;}
  td.needs{color:var(--textdim);max-width:360px;}
  .segment-tag{display:inline-block;font-size:12px;color:var(--textdim);border:1px solid var(--border);border-radius:6px;padding:2px 8px;}
  .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;}
  .logout{font-size:13.5px;color:var(--textdim);}
  .empty{color:var(--textfaint);font-size:14px;margin-top:24px;}
</style>
</head>
<body>
<div class="wrap">${bodyHtml}</div>
</body>
</html>`;
}

function loginPage(errorMsg) {
  return pageShell('Admin login — Primz', `
    <h1>Primz Admin</h1>
    ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
    <form method="POST" action="/admin/login">
      <div class="field">
        <label>Password</label>
        <input type="password" name="password" required autofocus>
      </div>
      <button type="submit">Log in</button>
    </form>
  `);
}

function adminPage() {
  return pageShell('Requests — Primz Admin', `
    <div class="topbar">
      <h1 style="margin:0;">Custom requests</h1>
      <a class="logout" href="/admin/logout">Log out</a>
    </div>
    <div id="content">Loading...</div>
    <script>
      fetch('/api/admin/requests')
        .then(r => r.json())
        .then(({ data }) => {
          const el = document.getElementById('content');
          if (!data || data.length === 0) {
            el.innerHTML = '<p class="empty">No requests yet.</p>';
            return;
          }
          const rows = data.map(r => \`
            <tr>
              <td>\${new Date(r.created_at).toLocaleString()}</td>
              <td>\${escapeHtml(r.name || '')}</td>
              <td>\${escapeHtml(r.contact || '')}</td>
              <td><span class="segment-tag">\${escapeHtml(r.segment || 'general')}</span></td>
              <td class="needs">\${escapeHtml(r.needs || '')}</td>
            </tr>
          \`).join('');
          el.innerHTML = \`
            <table>
              <thead>
                <tr><th>Received</th><th>Name</th><th>Contact</th><th>Segment</th><th>Needs</th></tr>
              </thead>
              <tbody>\${rows}</tbody>
            </table>
          \`;
        })
        .catch(() => {
          document.getElementById('content').innerHTML = '<p class="empty">Could not load requests.</p>';
        });

      function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }
    </script>
  `);
}
