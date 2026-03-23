import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: '+77001234567' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Некорректный номер телефона' })
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+77001234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'Код должен содержать 6 цифр' })
  code: string;
}

export class RegisterDto {
  @ApiProperty({ example: '+77001234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Алибек Джаксыбеков' })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({ example: 'client', enum: ['client', 'specialist'] })
  @IsString()
  role: string;

  @ApiProperty({ example: 'Алматы', required: false })
  @IsOptional()
  @IsString()
  city?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}
