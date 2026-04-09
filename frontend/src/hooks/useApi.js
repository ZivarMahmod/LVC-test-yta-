// ===========================================
// LVC Media Hub — SWR API Hooks
// Cachning och automatisk revalidering av API-data
// ===========================================
import useSWR from 'swr';
import { teamApi, videoApi, scoutApi, changelogApi, adminApi } from '../utils/apiSwitch.js';

// -------- Publika hooks --------

export function useTeams() {
  return useSWR('teams', () => teamApi.listTeams(), {
    revalidateOnFocus: false,
    dedupingInterval: 30000
  });
}

export function useSeasons(teamId) {
  return useSWR(teamId ? `seasons-${teamId}` : null, () => teamApi.listSeasons(teamId), {
    revalidateOnFocus: false,
    dedupingInterval: 30000
  });
}

export function useVideos(page, limit, search, teamId, seasonId) {
  const key = `videos-${page}-${limit}-${search || ''}-${teamId || ''}-${seasonId || ''}`;
  return useSWR(key, () => videoApi.list(page, limit, search, teamId, seasonId), {
    revalidateOnFocus: false,
    dedupingInterval: 10000
  });
}

export function useVideo(id) {
  return useSWR(id ? `video-${id}` : null, () => videoApi.getOne(id), {
    revalidateOnFocus: false,
    dedupingInterval: 15000
  });
}

export function useScout(id) {
  return useSWR(id ? `scout-${id}` : null, () => scoutApi.getScout(id), {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    shouldRetryOnError: false
  });
}

export function useChangelog() {
  return useSWR('changelog', () => changelogApi.list(), {
    revalidateOnFocus: false,
    dedupingInterval: 60000
  });
}

// -------- Admin hooks --------

export function useAdminUsers() {
  return useSWR('admin-users', () => adminApi.listUsers(), {
    revalidateOnFocus: false,
    dedupingInterval: 15000
  });
}

export function useAdminTeams() {
  return useSWR('admin-teams', () => adminApi.listTeams(), {
    revalidateOnFocus: false,
    dedupingInterval: 30000
  });
}

export function useAdminSeasons(teamId) {
  return useSWR(teamId ? `admin-seasons-${teamId}` : 'admin-seasons', () => adminApi.listSeasons(teamId), {
    revalidateOnFocus: false,
    dedupingInterval: 30000
  });
}
