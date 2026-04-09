import { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../utils/apiSwitch.js';

export default function AdminActivityTab() {
  const [activeData, setActiveData] = useState({ online: [], recent: [], totalOnline: 0, totalRecent: 0 });
  const intervalRef = useRef(null);

  const fetchActiveUsers = async () => {
    try {
      const data = await adminApi.getActiveUsers();
      setActiveData(data);
    } catch {}
  };

  // Auto-uppdatera var 15:e sekund
  useEffect(() => {
    fetchActiveUsers();
    intervalRef.current = setInterval(fetchActiveUsers, 15000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="admin-section">
      <h2>Aktiva användare</h2>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        Uppdateras automatiskt var 15:e sekund.
      </p>

      {/* Online nu */}
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
        Online nu ({activeData.totalOnline})
      </h3>
      {activeData.online.length === 0 ? (
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Inga användare online just nu</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Användare</th>
                <th>Roll</th>
                <th>Senast aktiv</th>
                <th>Sida</th>
              </tr>
            </thead>
            <tbody>
              {activeData.online.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td><span className="role-badge" style={{ fontSize: '0.7rem' }}>{u.role}</span></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {u.agoSeconds < 10 ? 'Just nu' : `${u.agoSeconds}s sedan`}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.path}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Nyligen aktiva */}
      {activeData.recent.length > 0 && (
        <>
          <h3 style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            Nyligen aktiva ({activeData.totalRecent})
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Användare</th>
                  <th>Roll</th>
                  <th>Senast aktiv</th>
                </tr>
              </thead>
              <tbody>
                {activeData.recent.map(u => {
                  const mins = Math.round(u.agoSeconds / 60);
                  return (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td><span className="role-badge" style={{ fontSize: '0.7rem' }}>{u.role}</span></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {mins} min sedan
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
