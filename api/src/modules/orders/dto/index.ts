import { IsEnum, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 'Починить кран на кухне' })
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiProperty({ example: 'Течёт кран, нужен сантехник' })
  @IsString()
  @Length(10, 2000)
  description: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetFrom?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  budgetTo?: number;

  @ApiProperty({ required: false, default: 'KZT' })
  @IsOptional()
  @IsString()
  budgetCurrency?: string;

  @ApiProperty({ required: false, default: 'project' })
  @IsOptional()
  @IsString()
  budgetUnit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  photos?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  deadline?: Date;
}

export class CreateResponseDto {
  @ApiProperty({ example: 'Готов приехать сегодня после 17:00' })
  @IsString()
  @Length(10, 1000)
  message: string;

  @ApiProperty({ example: 8000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ required: false, default: 'KZT' })
  @IsOptional()
  @IsString()
  currency?: string;
}
