import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles, type AuthedRequest } from '../auth/auth.guard.js';
import { CatalogueService } from './catalogue.service.js';
import {
  CreateListingDto,
  CreateProductDto,
  CreateVariantDto,
  ListingDto,
  ListProductsQuery,
  ProductDetailDto,
  ProductPageDto,
  UpdateProductDto,
  VariantDto,
} from './dto.js';

@ApiTags('Catalogue')
@ApiBearerAuth('bearer')
@Roles('ADMIN')
@Controller('products')
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @ApiOperation({
    summary: 'List products',
    description:
      'Newest filters first: search matches anywhere in the Arabic name, category narrows to one of the four, and archived products are hidden unless `active=false`.',
  })
  @ApiOkResponse({ type: ProductPageDto })
  list(@Req() req: AuthedRequest, @Query() query: ListProductsQuery) {
    return this.catalogue.list(req.user.tenantId, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Counts for the catalogue header',
    description: 'Active products per category, and how many channel listings exist in total.',
  })
  @ApiOkResponse({
    schema: { example: { byCategory: { COSMETICS: 58, HOME: 77 }, products: 135, listings: 0 } },
  })
  summary(@Req() req: AuthedRequest) {
    return this.catalogue.summary(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One product with its variants and channel mappings',
    description: 'The full record: every variant, and what each channel calls it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiNotFoundResponse({ description: 'No product with that id.' })
  get(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogue.get(req.user.tenantId, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Creates the product and one variant. A product with no size or colour still has a variant, because stock and orders always point at a variant.',
  })
  @ApiCreatedResponse({ type: ProductDetailDto })
  create(@Req() req: AuthedRequest, @Body() body: CreateProductDto) {
    return this.catalogue.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product',
    description:
      'Send only the fields that change. Set `active: false` to archive — products are never deleted, because order history keeps pointing at them.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProductDetailDto })
  @ApiNotFoundResponse({ description: 'No product with that id.' })
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.catalogue.update(req.user.tenantId, id, body);
  }

  @Post(':id/variants')
  @ApiOperation({
    summary: 'Add a variant',
    description: 'Each variant counts its own stock — one colour can run out while another remains.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Product id' })
  @ApiCreatedResponse({ type: VariantDto })
  @ApiNotFoundResponse({ description: 'No product with that id.' })
  @ApiConflictResponse({ description: 'That code is already used by another variant.' })
  addVariant(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateVariantDto,
  ) {
    return this.catalogue.addVariant(req.user.tenantId, id, body);
  }

  @Post('variants/:variantId/listings')
  @ApiOperation({
    summary: 'Map a channel identifier to a variant',
    description:
      'This is what an arriving noon settlement row or Easy Orders webhook resolves against. One external identifier maps to exactly one variant — mapping it twice is refused, because a sale landing on the wrong variant corrupts every number computed from it.',
  })
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiCreatedResponse({ type: ListingDto })
  @ApiNotFoundResponse({ description: 'No variant with that id.' })
  @ApiConflictResponse({ description: 'That channel identifier is already mapped to another variant.' })
  addListing(
    @Req() req: AuthedRequest,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() body: CreateListingDto,
  ) {
    return this.catalogue.addListing(req.user.tenantId, variantId, body);
  }

  @Delete('listings/:listingId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Remove a channel mapping',
    description:
      'Removes the link only. The variant, its stock and its order history are untouched — this is how a delisted or renamed channel SKU is handled.',
  })
  @ApiParam({ name: 'listingId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Removed.' })
  @ApiNotFoundResponse({ description: 'No listing with that id.' })
  removeListing(@Req() req: AuthedRequest, @Param('listingId', ParseUUIDPipe) listingId: string) {
    return this.catalogue.removeListing(req.user.tenantId, listingId);
  }
}
