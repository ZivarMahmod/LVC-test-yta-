// ===========================================
// CorevoSports — Superadmin Page (filipadmin.corevo.se)
// ===========================================
import { useState, useEffect } from 'react';
import { supabase, supabaseAdmin, supabaseAdminKvittra } from '../utils/supabaseClient.js';
import './SuperadminPage.css';

const TABS = ['Organisationer', 'Branding', 'Features', 'Användare', 'Statistik'];

const TEMPLATES = {
  dark_blue: { name: 'Mörkt Blå', primary_color: '#1a5fb4', secondary_color: '#e8a825', background_color: '#0a1628', surface_color: '#111f3a', text_color: '#f4f5f7', font: 'DM Sans, system-ui, sans-serif' },
  dark_green: { name: 'Mörkt Grönt', primary_color: '#2ea043', secondary_color: '#f0c75e', background_color: '#0d1117', surface_color: '#161b22', text_color: '#f0f6fc', font: 'DM Sans, system-ui, sans-serif' },
  dark_red: { name: 'Mörkt Rött', primary_color: '#cf222e', secondary_color: '#f9826c', background_color: '#161616', surface_color: '#1e1e1e', text_color: '#f5f5f5', font: 'DM Sans, system-ui, sans-serif' },
  dark_purple: { name: 'Mörkt Lila', primary_color: '#8b5cf6', secondary_color: '#c084fc', background_color: '#0f0a1a', surface_color: '#1a1425', text_color: '#f3f0ff', font: 'DM Sans, system-ui, sans-serif' },
  light_clean: { name: 'Ljust Rent', primary_color: '#2563eb', secondary_color: '#f59e0b', background_color: '#f8fafc', surface_color: '#ffffff', text_color: '#1e293b', font: 'Inter, system-ui, sans-serif' },
};

// ---- Tab: Organisationer ----
function OrgsTab() {
  const [orgs, setOrgs] = useState([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [template, setTemplate] = useState('dark_blue');
  const [loading, setLoading] = useState(true);

  const fetchOrgs = async () => {
    const { data } = await supabaseAdminKvittra.from('organizations').select('*').order('created_at');
    setOrgs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrgs(); }, []);

  const createOrg = async (e) => {
    e.preventDefault();
    const tpl = TEMPLATES[template] || TEMPLATES.dark_blue;
    const { error } = await supabaseAdminKvittra.from('organizations').insert({
      name, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      branding_config: tpl, features_config: {},
    });
    if (error) { alert(error.message); return; }
    setName(''); setSlug('');
    fetchOrgs();
  };

  const toggleActive = async (org) => {
    await supabaseAdminKvittra.from('organizations').update({ is_active: !org.is_active }).eq('id', org.id);
    fetchOrgs();
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <form className="sa-form" onSubmit={createOrg}>
        <h3>Ny organisation</h3>
        <input placeholder="Namn (ex: Linköpings VK)" value={name} onChange={e => setName(e.target.value)} required />
        <input placeholder="Slug (ex: lvc)" value={slug} onChange={e => setSlug(e.target.value)} required />
        <select value={template} onChange={e => setTemplate(e.target.value)}>
          {Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
        </select>
        <button type="submit" className="btn-primary">Skapa</button>
      </form>

      <table className="sa-table">
        <thead><tr><th>Namn</th><th>Slug</th><th>Aktiv</th><th>Skapad</th><th></th></tr></thead>
        <tbody>
          {orgs.map(org => (
            <tr key={org.id}>
              <td>{org.name}</td>
              <td><code>/app/{org.slug}</code></td>
              <td>{org.is_active ? 'Ja' : 'Nej'}</td>
              <td>{new Date(org.created_at).toLocaleDateString('sv-SE')}</td>
              <td><button className="btn-sm" onClick={() => toggleActive(org)}>{org.is_active ? 'Inaktivera' : 'Aktivera'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Tab: Branding ----
function BrandingTab() {
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [branding, setBranding] = useState({});

  useEffect(() => {
    supabaseAdminKvittra.from('organizations').select('id, name, slug, branding_config').order('name').then(({ data }) => setOrgs(data || []));
  }, []);

  useEffect(() => {
    const org = orgs.find(o => o.id === selectedOrg);
    if (org) setBranding(org.branding_config || {});
  }, [selectedOrg, orgs]);

  const updateField = (key, value) => setBranding(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    const { error } = await supabaseAdminKvittra.from('organizations').update({ branding_config: branding }).eq('id', selectedOrg);
    if (error) alert(error.message);
    else alert('Sparat!');
  };

  const applyTemplate = (tplKey) => {
    setBranding(prev => ({ ...prev, ...TEMPLATES[tplKey] }));
  };

  const colorFields = [
    { key: 'primary_color', label: 'Primärfärg' },
    { key: 'secondary_color', label: 'Sekundärfärg' },
    { key: 'background_color', label: 'Bakgrund' },
    { key: 'surface_color', label: 'Yta' },
    { key: 'text_color', label: 'Text' },
  ];

  return (
    <div>
      <select className="sa-select" value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}>
        <option value="">Välj organisation</option>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>

      {selectedOrg && (
        <div className="sa-branding-grid">
          <div className="sa-branding-form">
            <div className="form-group">
              <label>Template</label>
              <select onChange={e => applyTemplate(e.target.value)}>
                <option value="">Välj template...</option>
                {Object.entries(TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Logo URL</label>
              <input value={branding.logo_url || ''} onChange={e => updateField('logo_url', e.target.value)} placeholder="https://..." />
            </div>

            {colorFields.map(({ key, label }) => (
              <div key={key} className="form-group color-row">
                <label>{label}</label>
                <div className="color-input">
                  <input type="color" value={branding[key] || '#000000'} onChange={e => updateField(key, e.target.value)} />
                  <input type="text" value={branding[key] || ''} onChange={e => updateField(key, e.target.value)} />
                </div>
              </div>
            ))}

            <div className="form-group">
              <label>Typsnitt</label>
              <input value={branding.font || ''} onChange={e => updateField('font', e.target.value)} />
            </div>

            <button className="btn-primary" onClick={save}>Spara branding</button>
          </div>

          <div className="sa-branding-preview" style={{ background: branding.background_color, color: branding.text_color, fontFamily: branding.font }}>
            <div style={{ background: branding.surface_color, padding: '1.5rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <h3 style={{ color: branding.primary_color, marginBottom: '0.5rem' }}>Förhandsvisning</h3>
              <p>Så här ser temat ut för kunden.</p>
              <button style={{ background: branding.primary_color, color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', marginTop: '0.5rem', marginRight: '0.5rem' }}>Primärknapp</button>
              <button style={{ background: branding.secondary_color, color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', marginTop: '0.5rem' }}>Sekundärknapp</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Tab: Features ----
function FeaturesTab() {
  const [orgs, setOrgs] = useState([]);
  const [features, setFeatures] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('__global__');
  const [newKey, setNewKey] = useState('');

  const fetchFeatures = async () => {
    const { data } = await supabaseAdminKvittra.from('features_config').select('*').order('feature_key');
    setFeatures(data || []);
  };

  useEffect(() => {
    supabaseAdminKvittra.from('organizations').select('id, name').order('name').then(({ data }) => setOrgs(data || []));
    fetchFeatures();
  }, []);

  const filtered = features.filter(f => {
    if (selectedOrg === '__global__') return f.org_id === null;
    return f.org_id === selectedOrg;
  });

  const toggleFeature = async (feature) => {
    await supabaseAdminKvittra.from('features_config').update({ is_enabled: !feature.is_enabled }).eq('id', feature.id);
    fetchFeatures();
  };

  const addFeature = async (e) => {
    e.preventDefault();
    if (!newKey) return;
    const orgId = selectedOrg === '__global__' ? null : selectedOrg;
    await supabaseAdminKvittra.from('features_config').insert({ org_id: orgId, feature_key: newKey, is_enabled: false });
    setNewKey('');
    fetchFeatures();
  };

  return (
    <div>
      <select className="sa-select" value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}>
        <option value="__global__">Globala features</option>
        {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>

      <table className="sa-table">
        <thead><tr><th>Feature</th><th>Aktiv</th><th></th></tr></thead>
        <tbody>
          {filtered.map(f => (
            <tr key={f.id}>
              <td><code>{f.feature_key}</code></td>
              <td>{f.is_enabled ? 'Ja' : 'Nej'}</td>
              <td><button className="btn-sm" onClick={() => toggleFeature(f)}>{f.is_enabled ? 'Stäng av' : 'Slå på'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="sa-form-inline" onSubmit={addFeature}>
        <input placeholder="feature_key" value={newKey} onChange={e => setNewKey(e.target.value)} />
        <button type="submit" className="btn-primary">Lägg till</button>
      </form>
    </div>
  );
}

// ---- Tab: Användare ----
const ROLE_OPTIONS = ['admin', 'coach', 'uploader', 'player'];

function UsersTab() {
  const [orgs, setOrgs] = useState([]);
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [roles, setRoles] = useState(['admin']);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null); // { email, tempPwd, roles, isNew }

  const fetchAll = async () => {
    const [orgsRes, membersRes] = await Promise.all([
      supabaseAdminKvittra.from('organizations').select('id, name').order('name'),
      supabaseAdminKvittra.from('organization_members').select(`
        id, user_id, roles, is_active, org_id, recovery_email,
        organizations:org_id ( name )
      `).order('created_at'),
    ]);
    setOrgs(orgsRes.data || []);
    setMembers(membersRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleRole = (role) => {
    setRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const createUser = async (e) => {
    e.preventDefault();
    if (!email || !selectedOrg || roles.length === 0) return;

    let userId;
    let tempPwd = null;
    let isNewUser = false;

    // 1. Check if auth user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === email);

    if (existing) {
      // User exists — reuse their ID
      userId = existing.id;
    } else {
      // New user — create auth account with temp password
      isNewUser = true;
      tempPwd = crypto.randomUUID().slice(0, 16);
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPwd,
        email_confirm: true,
        user_metadata: { name: email.split('@')[0] },
      });

      if (authErr) {
        alert('Kunde inte skapa användare: ' + authErr.message);
        return;
      }
      userId = authData.user.id;

      // Set role in profiles table for new users
      const profileRole = roles.includes('admin') ? 'admin'
        : roles.includes('coach') ? 'coach'
        : roles.includes('uploader') ? 'uploader'
        : 'viewer';

      await supabaseAdmin.from('profiles').update({
        role: profileRole,
        name: email.split('@')[0],
      }).eq('id', userId);
    }

    // 2. Check if already member of this org
    const { data: existingMember } = await supabaseAdminKvittra
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('org_id', selectedOrg)
      .maybeSingle();

    if (existingMember) {
      alert(`${email} är redan medlem i denna organisation.`);
      return;
    }

    // 3. Add to organization_members with roles + recovery_email
    const memberData = {
      user_id: userId,
      org_id: selectedOrg,
      roles,
    };
    if (recoveryEmail) memberData.recovery_email = recoveryEmail;

    const { error: memberErr } = await supabaseAdminKvittra.from('organization_members').insert(memberData);

    if (memberErr) {
      alert('Kunde inte lägga till i org: ' + memberErr.message);
      return;
    }

    setResult({ email, tempPwd, roles: [...roles], isNew: isNewUser });
    setEmail('');
    setRecoveryEmail('');
    setRoles(['admin']);
    fetchAll();
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <form className="sa-form" onSubmit={createUser}>
        <h3>Skapa användare</h3>

        <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)} required>
          <option value="">Välj organisation</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <div className="form-group">
          <label>Login E-post</label>
          <input type="email" placeholder="namn@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          <small className="form-hint">Används för inloggning</small>
        </div>

        <div className="form-group">
          <label>Recovery E-post (valfri)</label>
          <input type="email" placeholder="privat@example.com" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} />
          <small className="form-hint">Mottar reset-länk här</small>
        </div>

        <div className="form-group">
          <label>Roll</label>
          <div className="role-checkboxes">
            {ROLE_OPTIONS.map(role => (
              <label key={role} className="role-checkbox">
                <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={roles.length === 0}>Skapa användare</button>
      </form>

      {result && (
        <div className="sa-result-box">
          <div className="sa-result-header">
            <span>{result.isNew ? 'Ny användare skapad' : 'Tillagd i organisation'}</span>
            <button className="btn-sm" onClick={() => setResult(null)}>Stäng</button>
          </div>
          <div className="sa-result-row"><label>Email:</label> <span>{result.email}</span></div>
          <div className="sa-result-row"><label>Roll:</label> <span>{result.roles.join(', ')}</span></div>
          {result.tempPwd && (
            <div className="sa-result-row">
              <label>Temp-lösenord:</label>
              <code className="sa-result-pwd" onClick={() => { navigator.clipboard.writeText(result.tempPwd); }}>{result.tempPwd}</code>
              <button className="btn-sm" onClick={() => { navigator.clipboard.writeText(result.tempPwd); }}>Kopiera</button>
            </div>
          )}
          {!result.isNew && <p className="form-hint">Användaren har redan ett konto och kan logga in direkt.</p>}
        </div>
      )}

      <table className="sa-table">
        <thead><tr><th>User ID</th><th>Email</th><th>Organisation</th><th>Roller</th><th>Recovery</th><th>Aktiv</th></tr></thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id}>
              <td><code>{m.user_id?.slice(0, 8)}...</code></td>
              <td>{m.user_id?.slice(0, 8)}</td>
              <td>{m.organizations?.name || '—'}</td>
              <td>{(m.roles || []).join(', ')}</td>
              <td>{m.recovery_email || '—'}</td>
              <td>{m.is_active ? 'Ja' : 'Nej'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Tab: Statistik ----
function StatsTab() {
  const [stats, setStats] = useState({ orgs: 0, members: 0, matches: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const [orgsRes, membersRes, matchesRes] = await Promise.all([
        supabaseAdminKvittra.from('organizations').select('id', { count: 'exact', head: true }),
        supabaseAdminKvittra.from('organization_members').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabaseAdminKvittra.from('matches').select('org_id, organizations:org_id ( name )'),
      ]);

      const matchesByOrg = {};
      for (const m of (matchesRes.data || [])) {
        const name = m.organizations?.name || 'Okänd';
        matchesByOrg[name] = (matchesByOrg[name] || 0) + 1;
      }

      setStats({
        orgs: orgsRes.count || 0,
        members: membersRes.count || 0,
        matches: matchesByOrg,
      });
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return <div className="spinner" />;

  return (
    <div className="sa-stats">
      <div className="sa-stat-card">
        <span className="sa-stat-num">{stats.orgs}</span>
        <span className="sa-stat-label">Organisationer</span>
      </div>
      <div className="sa-stat-card">
        <span className="sa-stat-num">{stats.members}</span>
        <span className="sa-stat-label">Aktiva medlemmar</span>
      </div>

      <div className="sa-stat-card wide">
        <h3>Matcher per org</h3>
        {Object.entries(stats.matches).length === 0 && <p style={{ color: 'var(--text-muted)' }}>Inga matcher ännu</p>}
        {Object.entries(stats.matches).map(([name, count]) => (
          <div key={name} className="sa-stat-row">
            <span>{name}</span>
            <span className="sa-stat-num">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main ----
export default function SuperadminPage() {
  const [tab, setTab] = useState(TABS[0]);

  return (
    <div className="superadmin-page">
      <header className="sa-header">
        <h1>Kvittra Superadmin</h1>
        <p>filipadmin.corevo.se</p>
      </header>

      <nav className="sa-tabs">
        {TABS.map(t => (
          <button key={t} className={`sa-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      <main className="sa-content">
        {tab === 'Organisationer' && <OrgsTab />}
        {tab === 'Branding' && <BrandingTab />}
        {tab === 'Features' && <FeaturesTab />}
        {tab === 'Användare' && <UsersTab />}
        {tab === 'Statistik' && <StatsTab />}
      </main>
    </div>
  );
}
