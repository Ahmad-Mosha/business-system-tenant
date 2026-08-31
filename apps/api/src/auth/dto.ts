import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { USER_ROLES, type UserRole } from '../db/schema.js';

export class LoginDto {
  @ApiProperty({ example: 'admin@primemarket.local', description: 'Case-insensitive.' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email: string;

  @ApiProperty({ example: 'change-me-now', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;
}

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'admin@primemarket.local' })
  email: string;

  @ApiProperty({ example: 'Owner' })
  name: string;

  @ApiProperty({
    enum: USER_ROLES,
    description:
      'ADMIN sees and does everything. MODERATOR handles customers and their own orders, and never sees money.',
  })
  role: UserRole;
}

export class LoginResponseDto {
  @ApiProperty({
    description:
      'Bearer token. Paste it into the Authorize box at the top of this page to call protected endpoints.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({ example: 43200, description: 'Seconds until the token expires.' })
  expiresIn: number;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}
