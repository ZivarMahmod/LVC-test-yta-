// ===========================================
// LVC Media Hub — Ändringslogg
// ===========================================
import React, { useState, useEffect } from 'react';
import { changelogApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ChangelogPage() {
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await changelogApi.list();
      setEntries(data.entries || []);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!version || !title || !body) return;
    setSaving(true);
    try {
      if (editing) {
        await changelogApi.update(editing, version, title, body);
      } else {
        await changelogApi.create(version, title, body);
      }
      setShowForm(false);
      setEditing(null);
      setVersion('');
      setTitle('');
      setBody('');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry) => {
    setEditing(entry.id);
    setVersion(entry.version);
    setTitle(entry.title);
    setBody(entry.content);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Ta bort denna post?')) return;
    try {
      await changelogApi.remove(id);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(null);
    setVersion('');
    setTitle('');
    setBody('');
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Ändringslogg</h1>
        {isAdmin && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary btn-sm">
            + Ny post
          </button>
        )}
      </div>

      {showForm && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>
            {editing ? 'Redigera post' : 'Ny ändringslogg'}
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="Version (t.ex. v1.8.0)"
              value={version}
              onChange={e => setVersion(e.target.value)}
              style={{
                width: '140px', padding: '0.5rem 0.75rem', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: '0.9rem'
              }}
            />
            <input
              type="text"
              placeholder="Titel"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: '0.9rem'
              }}
            />
          </div>
          <textarea
            placeholder="Beskriv ändringarna..."
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            style={{
              width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--text)', fontSize: '0.9rem', resize: 'vertical',
              fontFamily: 'inherit', lineHeight: '1.5'
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
              {saving ? 'Sparar...' : editing ? 'Uppdatera' : 'Publicera'}
            </button>
            <button onClick={handleCancel} className="btn-secondary btn-sm">Avbryt</button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Inga ändringar publicerade än.
        </div>
      ) : (
        entries.map(entry => (
          <div key={entry.id} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '0.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <span style={{
                  display: 'inline-block', padding: '0.15rem 0.5rem',
                  borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600',
                  background: 'rgba(26,95,180,0.15)', color: 'var(--lvc-blue-light, #3584e4)',
                  marginRight: '0.5rem'
                }}>
                  {entry.version}
                </span>
                <span style={{ fontWeight: '600', fontSize: '1rem' }}>{entry.title}</span>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                  <button onClick={() => handleEdit(entry)} className="btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}>Redigera</button>
                  <button onClick={() => handleDelete(entry.id)} className="btn-danger btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}>Ta bort</button>
                </div>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}
              {entry.updatedAt && entry.updatedAt !== entry.createdAt && ' (redigerad)'}
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {entry.content}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
