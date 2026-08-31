import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { type AuthedRequest, Public } from './auth.guard.js';
import { LoginDto, LoginResponseDto, UserDto } from './dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign in and get a token',
    description:
      'Returns a bearer token. Copy `accessToken` into the **Authorize** button at the top of this page, then every other endpoint here will work.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Email or password is incorrect.' })
  login(@Body() body: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Who the current token belongs to',
    description: 'Useful for checking that the token in the Authorize box is working.',
  })
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired token.' })
  me(@Req() req: AuthedRequest) {
    return { id: req.user.sub, email: req.user.email, role: req.user.role };
  }
}
