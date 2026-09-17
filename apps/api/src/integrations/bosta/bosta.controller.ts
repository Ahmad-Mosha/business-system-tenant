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
import { problem } from '../../problem';

@Controller('bosta')
export class BostaController {
  constructor(private readonly bostaService: BostaService) {}

  private user(req: Request): SessionUser {
    return req.user as SessionUser;
  }

  /**
   * Admins see the account board; moderators see their assigned orders only.
   */
  @Get('shipments')
  async listShipments(@Req() req: Request) {
    return this.bostaService.listDeliveries(this.user(req));
  }

  /**
   * Track a Bosta shipment live within the signed-in user's order scope.
   */
  @Get('track/:trackingNumber')
  async track(@Req() req: Request, @Param('trackingNumber') trackingNumber: string) {
    const cleanTn = (trackingNumber ?? '').trim();
    if (!cleanTn) {
      throw new BadRequestException('Tracking number is required');
    }

    const result = await this.bostaService.trackForUser(this.user(req), cleanTn);
    if (!result) {
      throw new NotFoundException(
        problem('shipment.notFound', `Shipment not found for tracking number: ${cleanTn}`, { trackingNumber: cleanTn }),
      );
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
