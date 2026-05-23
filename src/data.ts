import { type DataFile, type DailyReport, type Project } from "./types";
import {
  encryptJson,
  isEncryptedBlob,
  type EncryptedBlob,
} from "./crypto";

const DRAFT_KEY = "bees-nippo:draft";
const PASSWORD_KEY = "bees-nippo:password";

export type LoadResult =
  | { kind: "plain"; data: DataFile }
  | { kind: "encrypted"; blob: EncryptedBlob }
  | { kind: "empty" };

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function previousDateKey(dateKey: string, data: DataFile): string | null {
  const keys = Object.keys(data.reports)
    .filter((k) => k < dateKey)
    .sort();
  return keys.length > 0 ? keys[keys.length - 1] : null;
}

export function latestReportDate(data: DataFile): string | null {
  const keys = Object.keys(data.reports).sort();
  return keys.length > 0 ? keys[keys.length - 1] : null;
}

export async function loadData(): Promise<LoadResult> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/data.json`, {
      cache: "no-store",
    });
    if (!res.ok) return { kind: "empty" };
    const json = (await res.json()) as unknown;
    if (isEncryptedBlob(json)) {
      return { kind: "encrypted", blob: json };
    }
    const file = json as DataFile;
    return {
      kind: "plain",
      data: {
        projects: file.projects ?? [],
        reports: file.reports ?? {},
      },
    };
  } catch {
    return { kind: "empty" };
  }
}

export function rememberPassword(pw: string, persistent: boolean): void {
  const store = persistent ? localStorage : sessionStorage;
  const other = persistent ? sessionStorage : localStorage;
  store.setItem(PASSWORD_KEY, pw);
  other.removeItem(PASSWORD_KEY);
}

export function recallPassword(): string | null {
  return (
    sessionStorage.getItem(PASSWORD_KEY) ??
    localStorage.getItem(PASSWORD_KEY)
  );
}

export function forgetPassword(): void {
  sessionStorage.removeItem(PASSWORD_KEY);
  localStorage.removeItem(PASSWORD_KEY);
}

export function loadDraft(): DataFile | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DataFile;
  } catch {
    return null;
  }
}

export function saveDraft(data: DataFile): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}

function sortedData(data: DataFile): DataFile {
  return {
    projects: [...data.projects].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    reports: Object.fromEntries(
      Object.entries(data.reports).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(data: DataFile, filename = "data.json"): void {
  downloadText(JSON.stringify(sortedData(data), null, 2), filename);
}

export async function downloadEncryptedJson(
  data: DataFile,
  password: string,
  filename = "data.json",
): Promise<void> {
  const blob = await encryptJson(sortedData(data), password);
  downloadText(JSON.stringify(blob, null, 2), filename);
}


export function createId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function activeProjectsOn(data: DataFile, dateKey: string) {
  return data.projects.filter((p) => {
    if (p.createdAt > dateKey) return false;
    if (p.status === "done" && p.completedAt && p.completedAt < dateKey) return false;
    return true;
  });
}

export function previousNoteFor(
  data: DataFile,
  projectId: string,
  dateKey: string,
): string | null {
  const dates = Object.keys(data.reports)
    .filter((k) => k < dateKey)
    .sort();
  for (let i = dates.length - 1; i >= 0; i--) {
    const e = data.reports[dates[i]].entries.find(
      (x) => x.projectId === projectId,
    );
    if (e) return e.note;
  }
  return null;
}

export function ensureTodayReport(data: DataFile, dateKey: string): DataFile {
  const prevKey = previousDateKey(dateKey, data);
  const carry: Record<string, string> = {};
  if (prevKey) {
    for (const e of data.reports[prevKey].entries) {
      carry[e.projectId] = e.note;
    }
  }
  const existing = data.reports[dateKey];
  const existingIds = new Set(existing?.entries.map((e) => e.projectId) ?? []);
  const todayActive = activeProjectsOn(data, dateKey);
  const additions = todayActive
    .filter((p) => !existingIds.has(p.id))
    .map((p) => ({ projectId: p.id, note: carry[p.id] ?? "" }));
  if (existing && additions.length === 0) return data;
  const next: DailyReport = {
    oneLiner: existing?.oneLiner ?? "",
    entries: [...(existing?.entries ?? []), ...additions],
  };
  return {
    ...data,
    reports: { ...data.reports, [dateKey]: next },
  };
}

export function mergeDraftWithInitial(
  initial: DataFile,
  draft: DataFile | null,
): DataFile {
  if (!draft) return initial;
  const projectMap = new Map<string, Project>();
  for (const p of initial.projects) projectMap.set(p.id, p);
  for (const p of draft.projects) projectMap.set(p.id, p);
  const reports: Record<string, DailyReport> = {
    ...initial.reports,
    ...draft.reports,
  };
  return {
    projects: Array.from(projectMap.values()),
    reports,
  };
}
