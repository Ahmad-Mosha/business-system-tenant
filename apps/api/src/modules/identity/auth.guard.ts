import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { NotAuthenticatedError, PermissionDeniedError } from '../../shared/errors.js';
import { AuthContext } from './auth-context.js';
import { IdentityService } from './identity.service.js';
import { SESSION_COOKIE, SessionService } from './session.service.js';

const PUBLIC_KEY = 'auth:public';
const PERMISSION_KEY = 'auth:permission';

/** Opts a route out of authentication. Used only for login and health. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/**
 * Declares which permission a route requires. The guard proves the user holds it;
 * the service still resolves the *scope* when it builds its query.
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.auth) throw new NotAuthenticatedError();
    return request.auth;
  },
);

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { id: string; token: string } => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.sessionId || !request.sessionToken) throw new NotAuthenticatedError();
    return { id: request.sessionId, token: request.sessionToken };
  },
);

/**
 * Applied globally: routes are private unless explicitly marked @Public. Forgetting a
 * decorator therefore locks a route down rather than exposing it.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly identity: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) throw new NotAuthenticatedError();

    const session = await this.sessions.resolve(token);
    if (!session) throw new NotAuthenticatedError();

    const auth = await this.identity.loadAuthContext(session.userId);
    if (!auth) throw new NotAuthenticatedError();

    request.auth = auth;
    request.sessionId = session.sessionId;
    request.sessionToken = token;

    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, targets);
    if (permission && !auth.scopeFor(permission)) {
      throw new PermissionDeniedError(permission);
    }

    return true;
  }
}
