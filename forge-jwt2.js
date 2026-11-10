const { SignJWT } = require('jose');

async function main() {
  const keys = [
    'p3rk4s4_W3b_PSB_JWT_S3cr3t_K3y_2026_Production_Safe',
    'rahasia-perkasa-networks-2026',
    'p3rk4s4_W3b_PSB_JWT_S3cr3t_K3y_2026',
    'perkasa-networks-jwt-secret-2026',
    'PerkasaNetworks2026SecretKey'
  ];

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

  for (const key of keys) {
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(new TextEncoder().encode(key));
    console.log('KEY=' + key);
    console.log('TOKEN=' + token);
    console.log('---');
  }
}

main().catch(console.error);
