import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `FATAL: Required environment variable ${name} is not set. Check your .env file.`,
    );
  }
  return value.trim();
}

/**
 * Phase 2 dev users — passwords sourced from environment variables.
 * Phase 3: migrate to a users table in Postgres.
 */
const DEV_USERS = [
  {
    userId: '1',
    username: 'admin',
    passwordHash: bcrypt.hashSync(requireEnv('DEV_ADMIN_PASSWORD'), 10),
    role: 'admin',
  },
  {
    userId: '2',
    username: 'viewer',
    passwordHash: bcrypt.hashSync(requireEnv('DEV_VIEWER_PASSWORD'), 10),
    role: 'viewer',
  },
];

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(username: string, password: string) {
    const user = DEV_USERS.find((u) => u.username === username);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    console.log(
      '[DEBUG LOGIN]',
      JSON.stringify({
        usernameExpected: user.username,
        usernameReceived: username,
        receivedPasswordLength: password?.length,
        passwordHash: user.passwordHash,
      }),
    );

    const valid = await bcrypt.compare(password, user.passwordHash);
    console.log('[DEBUG LOGIN RESULT]', valid);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.userId,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      username: user.username,
      role: user.role,
    };
  }
}
