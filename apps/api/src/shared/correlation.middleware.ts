import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { newId } from './ids.js';

/**
 * One id per request, echoed back on the response and carried into audit events, so a
 * user-visible failure can be traced to its log lines and its audit trail.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-correlation-id');
    const id = incoming && incoming.length <= 128 ? incoming : newId();
    req.correlationId = id;
    res.setHeader('x-correlation-id', id);
    next();
  }
}
