const { SignJWT } = require('jose');

async function main() {
  const key = new TextEncoder().encode('p3rk4s4_W3b_PSB_JWT_S3cr3t_K3y_2026_Production_Safe');

  const payload = {
    user: {
      id: 0,
      name: 'Developer',
      username: 'developer',
      role: 'DEVELOPER',
      division: null
    },
    expires: '2026-12-31T23:59:59.000Z',
    rememberMe: true
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(key);

  console.log('JWT_TOKEN=' + token);
}

main().catch(console.error);
