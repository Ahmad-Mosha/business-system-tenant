import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public, Roles, SESSION_COOKIE } from './auth.guard';

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // one working day

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.signIn(body?.email ?? '', body?.password ?? '');
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true, // not readable from JavaScript
      sameSite: 'lax', // survives normal navigation, blocks cross-site posts
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });
    return user;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  /** Who the current session belongs to. */
  @Get('me')
  me(@Req() req: Request) {
    return req.user;
  }

  @Roles('ADMIN')
  @Get('users')
  users() {
    return this.auth.listAssignees();
  }
}
