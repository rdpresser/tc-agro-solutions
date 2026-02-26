import type { TokenInfo } from '@/types';

export function decodeToken(token: string): TokenInfo | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return {
      email: decoded.email || decoded.Email || '',
      name: decoded.name || decoded.Name || decoded.unique_name || '',
      role: decoded.role || decoded.Role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || 'user',
      sub: decoded.sub || decoded.nameid || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || '',
      exp: decoded.exp || 0,
    };
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const info = decodeToken(token);
  if (!info?.exp) return true;
  return Date.now() >= info.exp * 1000;
}
