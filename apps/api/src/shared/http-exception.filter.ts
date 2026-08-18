import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from './errors.js';
import { rootLogger } from './logger.js';

/**
 * Every failure leaves the API in one shape: { error: { code, message, details? } }.
 * Unexpected errors are logged in full and reported without internal detail.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof DomainError) {
      res.status(exception.status).json({
        error: { code: exception.code, message: exception.message },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'error' in body) {
        res.status(exception.getStatus()).json(body);
        return;
      }
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
      res.status(exception.getStatus()).json({
        error: {
          code: httpCodeFor(exception.getStatus()),
          message: Array.isArray(message) ? message.join(', ') : message,
        },
      });
      return;
    }

    rootLogger.error(
      { err: exception, correlationId: req.correlationId, path: req.path },
      'Unhandled exception',
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side' },
    });
  }
}

function httpCodeFor(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'NOT_AUTHENTICATED';
    case 403:
      return 'PERMISSION_DENIED';
    case 404:
      return 'NOT_FOUND';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return 'REQUEST_FAILED';
  }
}
