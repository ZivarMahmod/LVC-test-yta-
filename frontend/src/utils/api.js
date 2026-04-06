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
  },

  async changePassword(currentPassword, newPassword) {
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunde inte byta lösenord');
    return data;
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
  },

  async restore(id) {
    const res = await apiFetch(`/api/videos/${id}/restore`, { method: 'PATCH' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Kunde inte återställa videon');
    }
    return res.json();
  },

  async permanentDelete(id) {
    const res = await apiFetch(`/api/videos/${id}/permanent`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Kunde inte radera videon');
    }
    return res.json();
  },

  async uploadDvw(videoId, file) {
    const formData = new FormData();
    formData.append('dvw', file);
    const res = await apiFetch(`/api/videos/${videoId}/dvw`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Kunde inte ladda upp DVW-fil');
    return res.json();
  },
  async updateTitle(videoId, title) {
    const res = await apiFetch(`/api/videos/${videoId}/title`, {
      method: 'PATCH',
      body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error('Kunde inte uppdatera titel');
    return res.json();
  },

  async uploadChunk(formData) {
    const res = await apiFetch('/api/videos/upload/chunk', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Chunk-uppladdning misslyckades');
    return res.json();
  },
  async uploadComplete(data) {
    const res = await apiFetch('/api/videos/upload/complete', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Kunde inte slutföra uppladdning');
    return res.json();
  }
};

// -------- Admin API --------
export const adminApi = {
  async getActiveUsers() {
    const res = await apiFetch('/api/admin/active-users');
    if (!res.ok) throw new Error('Kunde inte hämta aktiva användare');
    return res.json();
  },
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
  },

  async getThumbnailLibrary(teamId = null) {
    const params = teamId ? `?teamId=${teamId}` : '';
    const res = await apiFetch(`/api/thumbnail-library${params}`);
    if (!res.ok) throw new Error('Kunde inte hämta thumbnails');
    return res.json();
  },
  async uploadThumbnailLibrary(file, teamId) {
    const formData = new FormData();
    formData.append('images', file);
    formData.append('teamId', teamId);
    const res = await apiFetch('/api/admin/thumbnail-library', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Kunde inte ladda upp thumbnail');
    return res.json();
  },
  async deleteThumbnailLibrary(id) {
    const res = await apiFetch(`/api/admin/thumbnail-library/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Kunde inte ta bort thumbnail');
    return res.json();
  },
  async getDeletedVideos() {
    const res = await apiFetch('/api/admin/deleted-videos');
    if (!res.ok) throw new Error('Kunde inte hämta borttagna videor');
    return res.json();
  },
  async addUserTeam(userId, teamId) {
    const res = await apiFetch(`/api/admin/users/${userId}/teams`, {
      method: 'POST',
      body: JSON.stringify({ teamId: parseInt(teamId) })
    });
    if (!res.ok) throw new Error('Kunde inte lägga till lag');
    return res.json();
  },
  async removeUserTeam(userId, teamId) {
    const res = await apiFetch(`/api/admin/users/${userId}/teams/${teamId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Kunde inte ta bort lag');
    return res.json();
  }
};

// -------- Review API --------
export const reviewApi = {
  async getInbox() {
    const res = await apiFetch('/api/reviews/inbox');
    if (!res.ok) throw new Error('Kunde inte hämta inbox');
    return res.json();
  },
  async getCoachOverview() {
    const res = await apiFetch('/api/reviews/coach-overview');
    if (!res.ok) throw new Error('Kunde inte hämta översikt');
    return res.json();
  },
  async getVideoReviews(videoId) {
    const res = await apiFetch(`/api/reviews/video/${videoId}`);
    if (!res.ok) throw new Error('Kunde inte hämta reviews');
    return res.json();
  },
  async getTeamPlayers() {
    const res = await apiFetch('/api/reviews/team-players');
    if (!res.ok) throw new Error('Kunde inte hämta spelare');
    return res.json();
  },
  async create(data) {
    const res = await apiFetch('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Kunde inte skapa review');
    return res.json();
  },
  async acknowledge(reviewId, password) {
    const res = await apiFetch(`/api/reviews/${reviewId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    if (!res.ok) throw new Error('Kunde inte bekräfta review');
    return res.json();
  }
};

export const changelogApi = {
  async list() {
    const res = await apiFetch('/api/changelog');
    if (!res.ok) throw new Error('Kunde inte hämta ändringslogg');
    return res.json();
  },
  async create(version, title, content) {
    const res = await apiFetch('/api/changelog', {
      method: 'POST',
      body: JSON.stringify({ version, title, content })
    });
    if (!res.ok) throw new Error('Kunde inte skapa post');
    return res.json();
  },
  async update(id, version, title, content) {
    const res = await apiFetch('/api/changelog/' + id, {
      method: 'PUT',
      body: JSON.stringify({ version, title, content })
    });
    if (!res.ok) throw new Error('Kunde inte uppdatera post');
    return res.json();
  },
  async remove(id) {
    const res = await apiFetch('/api/changelog/' + id, { method: 'DELETE' });
    if (!res.ok) throw new Error('Kunde inte ta bort post');
    return res.json();
  }
}

export const multiScoutApi = {
  async fetch(ids) {
    const res = await apiFetch('/api/videos/multi-scout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (!res.ok) throw new Error('Kunde inte hämta scout-data');
    return res.json();
  }
};

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

export const settingsApi = {
  async getSkillNames() {
    const res = await apiFetch('/api/settings/skill-names');
    if (!res.ok) return null;
    return res.json();
  },
  async updateSkillNames(data) {
    const res = await apiFetch('/api/admin/settings/skill-names', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Kunde inte spara');
    return res.json();
  },
  async getMusicUrl() {
    const res = await apiFetch('/api/settings/music-url');
    if (!res.ok) return null;
    return res.json();
  },
  async updateMusicUrl(url) {
    const res = await apiFetch('/api/admin/settings/music-url', {
      method: 'PUT',
      body: JSON.stringify({ url })
    });
    if (!res.ok) throw new Error('Kunde inte spara');
    return res.json();
  }
};

export const userApi = {
  async getPreferences() {
    const res = await apiFetch('/api/auth/user/preferences');
    if (!res.ok) return {};
    return res.json();
  },
  async updatePreferences(prefs) {
    const res = await apiFetch('/api/auth/user/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs)
    });
    if (!res.ok) throw new Error('Kunde inte spara inställningar');
    return res.json();
  }
};

export const playerStatsApi = {
  async getHistory(playerId, teamId = null) {
    const params = teamId ? `?teamId=${teamId}` : '';
    const res = await apiFetch(`/api/videos/player-stats/${playerId}${params}`);
    if (!res.ok) throw new Error('Kunde inte hämta spelarhistorik');
    return res.json();
  }
};

export const documentApi = {
  async list(videoId) {
    const res = await apiFetch(`/api/videos/${videoId}/documents`);
    if (!res.ok) throw new Error('Kunde inte hämta dokument');
    return res.json();
  },
  async upload(videoId, file, name, type) {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    if (type) formData.append('type', type);
    const res = await apiFetch(`/api/videos/${videoId}/documents`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Kunde inte ladda upp dokument');
    return res.json();
  },
  async remove(docId) {
    const res = await apiFetch(`/api/videos/documents/${docId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Kunde inte ta bort dokument');
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
