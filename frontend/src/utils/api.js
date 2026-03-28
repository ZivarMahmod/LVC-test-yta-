// ===========================================
// LVC Media Hub — API-verktyg
// Hanterar CSRF, automatisk token-refresh, fetch
// ===========================================

let csrfToken = null;

// Hämta CSRF-token
async function fetchCsrfToken() {
  try {
    const res = await fetch('/api/auth/csrf-token', { credentials: 'include' });
    const data = await res.json();
    csrfToken = data.csrfToken;
  } catch {
    console.error('Kunde inte hämta CSRF-token');
  }
}

// Bas-fetch med credentials + CSRF
async function apiFetch(url, options = {}) {
  // Hämta CSRF-token om vi inte har en
  if (!csrfToken && options.method && options.method !== 'GET') {
    await fetchCsrfToken();
  }

  const config = {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.headers || {}),
    }
  };

  // Lägg till CSRF-token för state-changing requests
  if (options.method && options.method !== 'GET') {
    config.headers['X-CSRF-Token'] = csrfToken || '';
  }

  // Lägg till Content-Type om det inte är FormData
  if (!(options.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }

  let res = await fetch(url, config);

  // Om 401 — försök refresha token
  if (res.status === 401 && !options._retried) {
    const refreshed = await refreshToken();
    if (refreshed) {
      // Hämta ny CSRF-token efter refresh
      await fetchCsrfToken();
      config.headers['X-CSRF-Token'] = csrfToken || '';
      res = await fetch(url, { ...config, _retried: true });
    }
  }

  return res;
}

// Refresh token
async function refreshToken() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    return res.ok;
  } catch {
    return false;
  }
}

// -------- Auth API --------
export const authApi = {
  async login(identifier, password) {
    await fetchCsrfToken();
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    return res.json();
  },

  async logout() {
    const res = await apiFetch('/api/auth/logout', { method: 'POST' });
    csrfToken = null;
    return res.json();
  },

  async validateInvite(token) {
    const res = await apiFetch('/api/auth/invite/' + token);
    return res.json();
  },

  async register(token, username, password, name) {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ token, username, password, name })
    });
    return res.json();
  },

  async me() {
    const res = await apiFetch('/api/auth/me');
    if (!res.ok) throw new Error('Ej autentiserad');
    return res.json();
  },

  async refresh() {
    return refreshToken();
  }
};

// -------- Video API --------
export const videoApi = {
  async list(page = 1, limit = 20, search = '', teamId = null, seasonId = null) {
    const params = new URLSearchParams({ page, limit, ...(search && { search }) });
    if (teamId) params.append('teamId', teamId);
    if (seasonId) params.append('seasonId', seasonId);
    const res = await apiFetch(`/api/videos?${params}`);
    if (!res.ok) throw new Error('Kunde inte hämta videor');
    return res.json();
  },

  async getOne(id) {
    const res = await apiFetch(`/api/videos/${id}`);
    if (!res.ok) throw new Error('Kunde inte hämta video');
    return res.json();
  },

  async upload(formData, onProgress) {
    await fetchCsrfToken();

    const doUpload = () => new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/videos/upload');
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-CSRF-Token', csrfToken || '');

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ data, status: xhr.status });
          } else {
            resolve({ data, status: xhr.status });
          }
        } catch {
          reject(new Error('Ogiltigt svar från servern'));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Nätverksfel vid uppladdning')));
      xhr.addEventListener('abort', () => reject(new Error('Uppladdning avbruten')));

      xhr.send(formData);
    });

    // BUG FIX #10: Om 401 — refresha token och försök en gång till
    let result = await doUpload();

    if (result.status === 401) {
      const refreshed = await refreshToken();
      if (refreshed) {
        await fetchCsrfToken();
        // Notera: FormData kan inte skickas igen efter konsumtion i vissa browsers
        // men detta hanteras normalt korrekt i moderna browsers
        result = await doUpload();
      }
    }

    if (result.status >= 200 && result.status < 300) {
      return result.data;
    }
    throw new Error(result.data?.error || 'Uppladdning misslyckades');
  },

  async uploadThumbnail(id, file) {
    const formData = new FormData();
    formData.append('thumbnail', file);
    const res = await apiFetch('/api/videos/' + id + '/thumbnail', {
      method: 'POST',
      body: formData
    });
    return res.json();
  },

  async remove(id) {
    const res = await apiFetch(`/api/videos/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Kunde inte ta bort videon');
    }
    return res.json();
  }
};

// -------- Admin API --------
export const adminApi = {
  async listUsers() {
    const res = await apiFetch('/api/admin/users');
    if (!res.ok) throw new Error('Kunde inte hämta användare');
    return res.json();
  },

  async createUser(userData) {
    const res = await apiFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunde inte skapa användare');
    return data;
  },

  async updateUser(id, userData) {
    const res = await apiFetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunde inte uppdatera användare');
    return data;
  },

  async deleteUser(id) {
    const res = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunde inte ta bort användare');
    return data;
  },

  async uploadHistory(page = 1, limit = 20) {
    const params = new URLSearchParams({ page, limit });
    const res = await apiFetch(`/api/admin/uploads?${params}`);
    if (!res.ok) throw new Error('Kunde inte hämta uppladdningshistorik');
    return res.json();
  },

  async listTeams() {
    const res = await apiFetch('/api/admin/teams');
    if (!res.ok) throw new Error('Kunde inte hämta lag');
    return res.json();
  },

  async createTeam(name) {
    const res = await apiFetch('/api/admin/teams', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunde inte skapa lag');
    return data;
  },

  async deleteTeam(id) {
    const res = await apiFetch(`/api/admin/teams/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunde inte ta bort lag');
    return data;
  },

  async listSeasons(teamId = null) {
    const params = teamId ? `?teamId=${teamId}` : '';
    const res = await apiFetch(`/api/admin/seasons${params}`);
    if (!res.ok) throw new Error('Kunde inte hämta säsonger');
    return res.json();
  },

  async createSeason(name, teamId) {
    const res = await apiFetch('/api/admin/seasons', {
      method: 'POST',
      body: JSON.stringify({ name, teamId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunde inte skapa säsong');
    return data;
  },

  async deleteSeason(id) {
    const res = await apiFetch(`/api/admin/seasons/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunde inte ta bort säsong');
    return data;
  },

  async assignVideo(videoId, teamId, seasonId) {
    const res = await apiFetch(`/api/admin/videos/${videoId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ teamId, seasonId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunde inte tilldela video');
    return data;
  }
};

export const changelogApi = {
  async getChangelog() {
    const res = await apiFetch('/api/changelog');
    if (!res.ok) throw new Error('Kunde inte hämta ändringslogg');
    return res.json();
  }
};

// Scout-tillägg (läggs till videoApi manuellt nedan)
// -------- Team API (publik, kräver bara inloggning) --------
export const teamApi = {
  async listTeams() {
    const res = await apiFetch('/api/videos/teams');
    if (!res.ok) throw new Error('Kunde inte hämta lag');
    return res.json();
  },

  async listSeasons(teamId) {
    const res = await apiFetch(`/api/videos/teams/${teamId}/seasons`);
    if (!res.ok) throw new Error('Kunde inte hämta säsonger');
    return res.json();
  }
};

export const scoutApi = {
  async getScout(id) {
    const res = await apiFetch(`/api/videos/${id}/scout`);
    if (!res.ok) throw new Error('Ingen scout-fil');
    return res.json();
  },

  async updateOffset(id, offset) {
    const res = await apiFetch(`/api/videos/${id}/offset`, {
      method: 'PATCH',
      body: JSON.stringify({ offset })
    });
    if (!res.ok) throw new Error('Kunde inte uppdatera offset');
    return res.json();
  }
};


// Invite API (admin)
export const teamAdminApi = {
  async uploadThumbnail(teamId, file) {
    const formData = new FormData();
    formData.append('thumbnail', file);
    const res = await apiFetch('/api/admin/teams/' + teamId + '/thumbnail', {
      method: 'POST',
      body: formData
    });
    return res.json();
  }
};

export const inviteApi = {
  async create(role, maxUses) {
    const res = await apiFetch('/api/admin/invites', {
      method: 'POST',
      body: JSON.stringify({ role, maxUses })
    });
    return res.json();
  },

  async list() {
    const res = await apiFetch('/api/admin/invites');
    return res.json();
  },

  async uploadThumbnail(id, file) {
    const formData = new FormData();
    formData.append('thumbnail', file);
    const res = await apiFetch('/api/videos/' + id + '/thumbnail', {
      method: 'POST',
      body: formData
    });
    return res.json();
  },

  async remove(id) {
    const res = await apiFetch('/api/admin/invites/' + id, {
      method: 'DELETE'
    });
    return res.json();
  }
};
