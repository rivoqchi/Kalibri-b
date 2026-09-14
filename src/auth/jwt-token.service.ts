import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';

export type JwtPayload = {
  sub: string;
  role: 'user' | 'admin';
  telegramId: number;
};

@Injectable()
export class JwtTokenService {
  private readonly secret: Uint8Array;

  constructor(private readonly config: ConfigService) {
    const jwtSecret = this.config.getOrThrow<string>('jwtSecret');
    this.secret = new TextEncoder().encode(jwtSecret);
  }

  async sign(payload: JwtPayload): Promise<string> {
    return new SignJWT({
      role: payload.role,
      telegramId: payload.telegramId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime('365d')
      .sign(this.secret);
  }

  async verify(token: string): Promise<JwtPayload> {
    const { payload } = await jwtVerify(token, this.secret);
    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') {
      throw new Error('Invalid token subject');
    }
    const role = payload.role === 'admin' ? 'admin' : 'user';
    const telegramId = Number(payload.telegramId);
    if (!Number.isFinite(telegramId)) {
      throw new Error('Invalid telegramId');
    }
    return { sub, role, telegramId };
  }
}
