// Autentificarea paginii de administrare (doar Orlando).
// Parola stă în Vercel (ADMIN_PASSWORD). După login, browserul primește un cookie semnat
// (HMAC-SHA256 cu parola drept cheie): nu poate fi falsificat, nu e accesibil din JavaScript,
// expiră în 30 de zile, iar schimbarea parolei îl invalidează imediat.
import type { AstroCookies } from 'astro';
import { getSecret } from 'astro:env/server';

const COOKIE = 'nd_admin';
const DAYS = 30;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

/** Comparație în timp constant (nu dezvăluie, prin durată, câte caractere se potrivesc). */
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const adminConfigured = () => !!getSecret('ADMIN_PASSWORD');

export async function isAdmin(cookies: AstroCookies) {
  const secret = getSecret('ADMIN_PASSWORD');
  const value = cookies.get(COOKIE)?.value;
  if (!secret || !value) return false;
  const [exp, sig] = value.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return equal(sig, await sign(exp, secret));
}

/** Verifică parola; dacă e corectă, pune cookie-ul de sesiune. */
export async function login(cookies: AstroCookies, password: string, secure: boolean) {
  const secret = getSecret('ADMIN_PASSWORD');
  if (!secret || !equal(await sign(password, 'pw'), await sign(secret, 'pw'))) return false;
  const exp = String(Date.now() + DAYS * 86_400_000);
  cookies.set(COOKIE, `${exp}.${await sign(exp, secret)}`, {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: DAYS * 86_400,
  });
  return true;
}

export const logout = (cookies: AstroCookies) => cookies.delete(COOKIE, { path: '/' });
