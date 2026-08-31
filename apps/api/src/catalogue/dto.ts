import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CATEGORIES, CHANNELS, type Category, type Channel } from '../db/schema.js';

export class ListProductsQuery {
  @ApiPropertyOptional({
    description:
      'Matches anywhere in the product name. Arabic works — the catalogue is Arabic.',
    example: 'برفان',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: Category;

  @ApiPropertyOptional({
    description: 'Archived products are hidden unless this is false.',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ListingDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: CHANNELS })
  channel: Channel;

  @ApiProperty({
    description: "What the channel calls it. noon: Partner SKU. Easy Orders: product UUID.",
    example: 'PSKU_346654_30978416496639656616_X',
  })
  externalId: string;

  @ApiProperty({
    description: "The channel's own variant identifier. Empty when it has none.",
    example: 'ZC4A8351AEA45AE94D399Z-1',
  })
  externalVariantId: string;

  @ApiPropertyOptional({ nullable: true, description: 'What the channel displays. Never used for matching.' })
  label: string | null;
}

export class VariantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'Size, colour, design. Empty for a product that has no variations.',
    example: { size: '250ml', color: 'أزرق' },
  })
  attributes: Record<string, string>;

  @ApiPropertyOptional({ nullable: true, description: 'Our own optional code. Never a channel SKU.' })
  code: string | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty({ type: [ListingDto] })
  listings: ListingDto[];
}

export class ProductDto {
  @ApiProperty({ format: 'uuid', description: 'The identity. Channel SKUs are never the identity.' })
  id: string;

  @ApiProperty({ example: 'برفان تيندر 40 مل' })
  name: string;

  @ApiProperty({ enum: CATEGORIES })
  category: Category;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ description: 'Archived products stay, so order history keeps pointing at them.' })
  active: boolean;

  @ApiProperty({ description: 'How many variants hold stock for this product.', example: 1 })
  variantCount: number;

  @ApiProperty({ description: 'How many channels list it.', example: 0 })
  listingCount: number;
}

export class ProductDetailDto extends ProductDto {
  @ApiProperty({ type: [VariantDto] })
  variants: VariantDto[];
}

export class ProductPageDto {
  @ApiProperty({ type: [ProductDto] })
  items: ProductDto[];

  @ApiProperty({ description: 'Total matching the filters, ignoring limit and offset.', example: 135 })
  total: number;

  @ApiProperty({ example: 50 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Arabic, exactly as the business writes it.',
    example: 'برفان تيندر 40 مل',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES)
  category: Category;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'برفان تيندر 40 مل' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: Category;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Set false to archive. Products are never deleted.' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateVariantDto {
  @ApiPropertyOptional({
    description: 'Size, colour, design as a map. Each variant holds its own stock.',
    example: { size: '250ml', color: 'أزرق' },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Our own optional code. Must be unique.', example: 'PM-0001-BLU' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;
}

export class CreateListingDto {
  @ApiProperty({ enum: CHANNELS })
  @IsIn(CHANNELS)
  channel: Channel;

  @ApiProperty({
    description:
      "The channel's identifier for this item. noon: Partner SKU. Easy Orders: product UUID. Amazon: ASIN or seller SKU.",
    example: 'PSKU_346654_30978416496639656616_X',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  externalId: string;

  @ApiPropertyOptional({
    description: "The channel's variant identifier, when it has one.",
    example: 'ZC4A8351AEA45AE94D399Z-1',
    default: '',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalVariantId?: string;

  @ApiPropertyOptional({ description: 'What the channel displays. For recognition only.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  label?: string;
}
