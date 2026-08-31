import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { UserRole } from '../db/schema.js';
import type { TokenPayload } from './auth.service.js';

export const PUBLIC = 'auth:public';
/** Marks an endpoint as reachable without a token. */
export const Public = () => SetMetadata(PUBLIC, true);

export const ROLES = 'auth:roles';
/** Restricts an endpoint to the listed roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

export interface AuthedRequest extends Request {
  user: TokenPayload;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      request.user = await this.jwt.verifyAsync<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Token is invalid or expired');
    }

    const allowed = this.reflector.getAllAndOverride<UserRole[]>(ROLES, targets);
    if (allowed?.length && !allowed.includes(request.user.role as UserRole)) {
      throw new ForbiddenException(`This endpoint is restricted to: ${allowed.join(', ')}`);
    }

    return true;
  }
}
