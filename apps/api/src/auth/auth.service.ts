import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

/**
 * Phase 2 dev users — hardcoded for bootstrapping.
 * Phase 3: migrate to a users table in Postgres.
 */
const DEV_USERS = [
  {
    userId: '1',
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin', 10),
    role: 'admin',
  },
  {
    userId: '2',
    username: 'viewer',
    passwordHash: bcrypt.hashSync('viewer', 10),
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

    const valid = await bcrypt.compare(password, user.passwordHash);
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
