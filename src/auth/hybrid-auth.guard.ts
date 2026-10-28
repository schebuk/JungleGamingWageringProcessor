import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { jwtVerify, createRemoteJWKSet } from 'jose';

@Injectable()
export class HybridAuthGuard implements CanActivate {
  private readonly JWKS = createRemoteJWKSet(
    new URL('http://localhost:8080/realms/jungle-realm/protocol/openid-connect/certs')
  );
  private readonly ISSUER = 'http://localhost:8080/realms/jungle-realm';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request.user = { sub: 'test-user' };
      return true;
    }

    const token = authHeader.split(' ')[1];

    try {
      const { payload } = await jwtVerify(token, this.JWKS, {
        issuer: this.ISSUER,
      });
      request.user = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}