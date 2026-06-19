const BASE = '/api';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function readCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

async function csrfToken() {
  let token = readCookie('nc_csrf');
  if (!token) {
    await fetch(`${BASE}/csrf`, { credentials: 'include' });
    token = readCookie('nc_csrf');
  }
  return token ?? '';
}

async function parse(res, path) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `${path} falhou (${res.status})`, res.status, data);
  }
  return data;
}

export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  return parse(res, `GET ${path}`);
}

export async function apiPost(path, body) {
  const token = await csrfToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return parse(res, `POST ${path}`);
}
