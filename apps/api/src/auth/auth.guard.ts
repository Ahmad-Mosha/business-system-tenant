import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { UserRole } from './user.entity';

export const SESSION_COOKIE = 'pm_session';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/** Marks an endpoint reachable without a session. */
export const Public = () => SetMetadata('isPublic', true);

/** Restricts an endpoint to the listed roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

declare module 'express' {
  interface Request {
    user?: SessionUser;
  }
}

/**
 * Applied globally: every endpoint requires a session unless marked `@Public()`,
 * so a new controller is protected by default rather than by remembering to
 * protect it.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('isPublic', targets)) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('not signed in');

    try {
      req.user = await this.jwt.verifyAsync<SessionUser>(token);
    } catch {
      throw new UnauthorizedException('session expired');
    }

    const roles = this.reflector.getAllAndOverride<UserRole[]>('roles', targets);
    if (roles?.length && !roles.includes(req.user.role)) {
      throw new ForbiddenException('not permitted for your role');
    }
    return true;
  }
}
