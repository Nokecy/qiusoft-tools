import { fetch } from 'undici';

export type GithubRepo = { owner: string; name: string };

export function parseGithub(repo: string): GithubRepo | null {
  const m = repo.match(/^github:([^/]+)\/(.+)$/);
  if (m) return { owner: m[1], name: m[2] };
  return null;
}

export async function githubResolveSha(opts: {
  repo: GithubRepo;
  ref: string;
  token?: string;
}): Promise<string | null> {
  const url = `https://api.github.com/repos/${opts.repo.owner}/${opts.repo.name}/commits/${encodeURIComponent(
    opts.ref
  )}`;
  const headers: Record<string, string> = {
    'User-Agent': 'shared-cli',
    Accept: 'application/vnd.github+json',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const json = (await res.json()) as { sha?: string };
  return typeof json?.sha === 'string' ? json.sha : null;
}

export async function githubDownloadZip(opts: {
  repo: GithubRepo;
  ref: string;
  token?: string;
}): Promise<ArrayBuffer> {
  const url = `https://api.github.com/repos/${opts.repo.owner}/${opts.repo.name}/zipball/${encodeURIComponent(
    opts.ref
  )}`;
  const headers: Record<string, string> = {
    'User-Agent': 'shared-cli',
    Accept: 'application/vnd.github+json',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub zip download failed: ${res.status} ${res.statusText} ${text}`.trim());
  }
  return await res.arrayBuffer();
}
