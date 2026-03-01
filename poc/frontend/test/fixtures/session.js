const DEFAULT_OWNER_ID = '11111111-1111-1111-1111-111111111111';

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function createFakeJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  return `${unsignedToken}.signature`;
}

export function buildUserSession({
  role = 'Admin',
  ownerId = DEFAULT_OWNER_ID,
  email,
  name,
  sub,
  tokenRoles
} = {}) {
  const normalizedRole = String(role || 'Admin');
  const normalizedEmail =
    email ||
    (normalizedRole.toLowerCase() === 'producer' ? 'producer@tcagro.com' : 'admin@tcagro.com');
  const normalizedSub = sub || ownerId;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    sub: normalizedSub,
    email: normalizedEmail,
    name: name || (normalizedRole.toLowerCase() === 'producer' ? 'Producer User' : 'Admin User'),
    role: tokenRoles || [normalizedRole],
    exp: nowInSeconds + 60 * 60
  };

  return {
    token: createFakeJwt(payload),
    user: {
      email: normalizedEmail,
      name: payload.name,
      role: normalizedRole,
      sub: normalizedSub,
      ownerId
    }
  };
}

export function buildAdminSession() {
  return buildUserSession({
    role: 'Admin',
    email: 'admin@tcagro.com',
    name: 'Admin User',
    ownerId: DEFAULT_OWNER_ID,
    sub: DEFAULT_OWNER_ID,
    tokenRoles: ['Admin']
  });
}

export function buildProducerSession(ownerId = DEFAULT_OWNER_ID) {
  return buildUserSession({
    role: 'Producer',
    email: 'producer@tcagro.com',
    name: 'Producer User',
    ownerId,
    sub: ownerId,
    tokenRoles: ['Producer']
  });
}

export async function applySession(page, session) {
  await page.addInitScript(
    ({ token, user }) => {
      window.sessionStorage.setItem('agro_token', token);
      window.sessionStorage.setItem('agro_user', JSON.stringify(user));
    },
    {
      token: session.token,
      user: session.user
    }
  );
}

export async function clearSession(page) {
  await page.addInitScript(() => {
    window.sessionStorage.removeItem('agro_token');
    window.sessionStorage.removeItem('agro_user');
  });
}

export const TEST_OWNER_IDS = {
  alpha: '00000000-0000-0000-0000-000000000001',
  zulu: '00000000-0000-0000-0000-000000000002'
};
