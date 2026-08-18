import {
  changePasswordRequestSchema,
  loginRequestSchema,
  type ChangePasswordRequest,
  type CurrentUser,
  type LoginRequest,
} from '@app/contracts';
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ENV, type Env } from '../../config/env.js';
import { ZodValidationPipe } from '../../shared/zod-validation.pipe.js';
import { AuthContext } from './auth-context.js';
import { CurrentAuth, CurrentSession, Public } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE } from './session.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Deliberately strict: this is the endpoint an attacker would brute-force. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CurrentUser> {
    const result = await this.auth.login(body.email, body.password, {
      userAgent: req.header('user-agent'),
      ipAddress: req.ip,
      correlationId: req.correlationId,
    });

    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.COOKIE_SECURE,
      expires: result.expiresAt,
      path: '/',
    });

    return toCurrentUser(result.auth);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentAuth() auth: AuthContext,
    @CurrentSession() session: { id: string; token: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(session.token, auth, req.correlationId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  me(@CurrentAuth() auth: AuthContext): CurrentUser {
    return toCurrentUser(auth);
  }

  @Post('change-password')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(
    @Body(new ZodValidationPipe(changePasswordRequestSchema)) body: ChangePasswordRequest,
    @CurrentAuth() auth: AuthContext,
    @CurrentSession() session: { id: string; token: string },
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.changePassword(
      auth,
      session.id,
      body.currentPassword,
      body.newPassword,
      req.correlationId,
    );
  }
}

function toCurrentUser(auth: AuthContext): CurrentUser {
  return {
    id: auth.user.id,
    email: auth.user.email,
    name: auth.user.name,
    organizationId: auth.user.organizationId,
    organizationName: auth.user.organizationName,
    roles: [...auth.roles],
    grants: auth.toGrantList(),
    mustChangePassword: auth.user.mustChangePassword,
  };
}
