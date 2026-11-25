import { SEED_MUNPIA_PROJECT } from '../data/seedProject';
import type { NovelProject } from '../types/novelPlanner';
import { STORAGE_KEY, migrateProjectToV2, parseProjectBackupJson } from './munpiaEngine';

const DB_NAME = 'munpia_forge_idb_v1';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';
const SNAPSHOT_KEY = 'projects_snapshot';

interface WorkspaceSnapshot {
  projects: NovelProject[];
  savedAt: string;
}

export interface LoadProjectsResult {
  projects: NovelProject[];
  savedAt: string | null;
  migratedFromLocalStorage: boolean;
  usedIndexedDb: boolean;
}

export interface MasterBackupPayload {
  format: 'munpia-forge-master-backup';
  version: 2;
  exportedAt: string;
  projectCount: number;
  projects: NovelProject[];
}

export function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

export function formatSaveTimeHHMMSS(isoString: string | null): string {
  if (!isoString) return '--:--:--';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

async function idbGetSnapshot(): Promise<WorkspaceSnapshot | null> {
  const db = await openWorkspaceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(SNAPSHOT_KEY);
    req.onsuccess = () => {
      const val = req.result as WorkspaceSnapshot | undefined;
      resolve(val && Array.isArray(val.projects) ? val : null);
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
    tx.oncomplete = () => db.close();
  });
}

async function idbPutSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
  const db = await openWorkspaceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(snapshot, SNAPSHOT_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB write failed'));
    };
  });
}

function readLegacyLocalStorageProjects(): NovelProject[] | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((proj) => migrateProjectToV2(proj));
    }
  } catch {
    // Ignore malformed legacy localStorage
  }
  return null;
}

/**
 * Loads all projects from IndexedDB. On first launch, if legacy `localStorage`
 * data exists, automatically migrates it into IndexedDB safely.
 */
export async function loadProjectsFromIndexedDb(): Promise<LoadProjectsResult> {
  const seedProjects = [migrateProjectToV2(SEED_MUNPIA_PROJECT)];

  if (!isIndexedDbAvailable()) {
    const legacy = readLegacyLocalStorageProjects();
    return {
      projects: legacy ?? seedProjects,
      savedAt: new Date().toISOString(),
      migratedFromLocalStorage: false,
      usedIndexedDb: false,
    };
  }

  try {
    const existing = await idbGetSnapshot();
    if (existing && existing.projects.length > 0) {
      return {
        projects: existing.projects.map((p) => migrateProjectToV2(p)),
        savedAt: existing.savedAt || new Date().toISOString(),
        migratedFromLocalStorage: false,
        usedIndexedDb: true,
      };
    }

    const legacy = readLegacyLocalStorageProjects();
    const initialProjects = legacy ?? seedProjects;
    const savedAt = new Date().toISOString();
    await idbPutSnapshot({ projects: initialProjects, savedAt });

    return {
      projects: initialProjects,
      savedAt,
      migratedFromLocalStorage: Boolean(legacy),
      usedIndexedDb: true,
    };
  } catch {
    const legacy = readLegacyLocalStorageProjects();
    return {
      projects: legacy ?? seedProjects,
      savedAt: new Date().toISOString(),
      migratedFromLocalStorage: false,
      usedIndexedDb: false,
    };
  }
}

/**
 * Persists all projects into IndexedDB (with graceful localStorage fallback)
 * and returns the saved ISO timestamp.
 */
export async function saveProjectsToIndexedDb(
  projects: NovelProject[]
): Promise<{ savedAt: string; usedIndexedDb: boolean }> {
  const savedAt = new Date().toISOString();

  if (isIndexedDbAvailable()) {
    try {
      await idbPutSnapshot({ projects, savedAt });
      return { savedAt, usedIndexedDb: true };
    } catch {
      // Fall through to localStorage backup on unexpected quota/browser error
    }
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Ignore storage quota errors
  }
  return { savedAt, usedIndexedDb: false };
}

/**
 * Serializes all projects in the workspace into a single master backup JSON string.
 */
export function serializeMasterBackup(projects: NovelProject[]): string {
  const payload: MasterBackupPayload = {
    format: 'munpia-forge-master-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    projectCount: projects.length,
    projects,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Parses either a full workspace master backup JSON (`{ projects: [...] }` or `NovelProject[]`)
 * OR a single-project backup JSON seamlessly.
 */
export function parseMasterBackupJson(
  rawJson: string
): { ok: true; projects: NovelProject[]; isMasterBackup: boolean } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: '유효한 백업 JSON 형식이 아닙니다.' };
    }

    const rawList: unknown[] | null = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { projects?: unknown[] }).projects)
        ? (parsed as { projects: unknown[] }).projects
        : null;

    if (rawList) {
      if (rawList.length === 0) {
        return { ok: false, error: '마스터 백업 파일에 저장된 작품 프로젝트가 없습니다.' };
      }
      const validated: NovelProject[] = [];
      for (const item of rawList) {
        const res = parseProjectBackupJson(JSON.stringify(item));
        if (!res.ok) {
          return { ok: false, error: `마스터 백업 내 프로젝트 검증 실패: ${res.error}` };
        }
        validated.push(res.data);
      }
      return { ok: true, projects: validated, isMasterBackup: true };
    }

    const single = parseProjectBackupJson(rawJson);
    if (!single.ok) {
      return { ok: false, error: single.error };
    }
    return { ok: true, projects: [single.data], isMasterBackup: false };
  } catch (err) {
    return {
      ok: false,
      error: `마스터 백업 파일 파싱 실패: ${err instanceof Error ? err.message : 'JSON 형식을 확인하세요.'}`,
    };
  }
}
