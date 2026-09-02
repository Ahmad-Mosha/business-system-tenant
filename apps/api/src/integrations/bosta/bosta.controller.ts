import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionUser } from '../../auth/auth.guard';
import { BostaService } from './bosta.service';

@Controller('bosta')
export class BostaController {
  constructor(private readonly bostaService: BostaService) {}

  private user(req: Request): SessionUser {
    return req.user as SessionUser;
  }

  /**
   * List all live Bosta shipments for Prime Market.
   * Open to both ADMIN and MODERATOR.
   */
  @Get('shipments')
  async listShipments() {
    return this.bostaService.listDeliveries();
  }

  /**
   * Track any Bosta shipment live by tracking number.
   * Open to both ADMIN and MODERATOR.
   */
  @Get('track/:trackingNumber')
  async track(@Param('trackingNumber') trackingNumber: string) {
    const cleanTn = (trackingNumber ?? '').trim();
    if (!cleanTn) {
      throw new BadRequestException('Tracking number is required');
    }

    const result = await this.bostaService.track(cleanTn);
    if (!result) {
      throw new NotFoundException(`Shipment not found for tracking number: ${cleanTn}`);
    }
    return result;
  }

  /**
   * Get Bosta tracking information for an order.
   * Scoped so moderators can only see tracking for their assigned orders.
   */
  @Get('orders/:orderId')
  async getForOrder(
    @Req() req: Request,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.bostaService.getForOrder(this.user(req), orderId);
  }

  /**
   * Attach, update, or remove tracking number on an order.
   * Admins can update any; Moderators can update their assigned orders.
   */
  @Patch('orders/:orderId/tracking')
  async updateOrderTracking(
    @Req() req: Request,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: { trackingNumber?: string | null },
  ) {
    return this.bostaService.updateOrderTracking(
      this.user(req),
      orderId,
      body.trackingNumber ?? null,
    );
  }
}
