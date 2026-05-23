const SETTINGS_KEY = "bees-nippo:gh-settings";

export type GhSettings = {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  path: string;
};

const DEFAULTS: Omit<GhSettings, "owner" | "repo" | "token"> = {
  branch: "main",
  path: "public/data/data.json",
};

export function loadSettings(): GhSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<GhSettings>;
    if (!v.owner || !v.repo || !v.token) return null;
    return {
      owner: v.owner,
      repo: v.repo,
      token: v.token,
      branch: v.branch || DEFAULTS.branch,
      path: v.path || DEFAULTS.path,
    };
  } catch {
    return null;
  }
}

export function saveSettings(s: GhSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
}

export function defaultSettings(): Omit<GhSettings, "token"> {
  return {
    owner: "",
    repo: "",
    branch: DEFAULTS.branch,
    path: DEFAULTS.path,
  };
}

export function publicUrl(s: GhSettings): string {
  return `https://${s.owner}.github.io/${s.repo}/`;
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

type GhFileRes = {
  sha: string;
  content: string;
  encoding: string;
};

async function ghFetch(
  s: GhSettings,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `https://api.github.com${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${s.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
}

export async function verifyAccess(s: GhSettings): Promise<void> {
  const res = await ghFetch(s, `/repos/${s.owner}/${s.repo}`);
  if (res.status === 401) {
    throw new Error("トークンが無効です。Fine-grained PAT を確認してください。");
  }
  if (res.status === 404) {
    throw new Error(
      "リポジトリが見つかりません。owner/repo の綴り、もしくはトークンに Contents 権限があるか確認してください。",
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub API エラー: ${res.status}`);
  }
}

async function getCurrentSha(s: GhSettings): Promise<string | null> {
  const res = await ghFetch(
    s,
    `/repos/${s.owner}/${s.repo}/contents/${encodeURIComponent(s.path)}?ref=${encodeURIComponent(s.branch)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`既存ファイルの取得に失敗: ${res.status}`);
  }
  const json = (await res.json()) as GhFileRes;
  return json.sha;
}

export type PublishResult = {
  commitSha: string;
  commitUrl: string;
  workflowRunUrl: string | null;
};

export async function publishDataFile(
  s: GhSettings,
  jsonText: string,
  message: string,
): Promise<PublishResult> {
  const sha = await getCurrentSha(s);
  const body: Record<string, unknown> = {
    message,
    content: utf8ToBase64(jsonText),
    branch: s.branch,
  };
  if (sha) body.sha = sha;
  const res = await ghFetch(
    s,
    `/repos/${s.owner}/${s.repo}/contents/${encodeURIComponent(s.path)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`公開に失敗: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    commit: { sha: string; html_url: string };
  };
  return {
    commitSha: json.commit.sha,
    commitUrl: json.commit.html_url,
    workflowRunUrl: `https://github.com/${s.owner}/${s.repo}/actions`,
  };
}
