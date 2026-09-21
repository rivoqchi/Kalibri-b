import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { agentDebugLog } from '../common/utils/agent-debug-log.js';

@Injectable()
export class OrderCreateDebugInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      body?: Record<string, unknown>;
      user?: { sub?: string };
    }>();
    const body = req.body ?? {};
    const items = Array.isArray(body.items) ? body.items : [];
    const first = items[0] as Record<string, unknown> | undefined;
    const unitPrice = first?.unitPrice as Record<string, unknown> | undefined;

    // #region agent log
    agentDebugLog({
      hypothesisId: 'A,D,E',
      location: 'order-create-debug.interceptor.ts:pre',
      message: 'POST /api/orders body snapshot',
      data: {
        method: req.method,
        url: req.url,
        hasUser: Boolean(req.user?.sub),
        partnerId: body.partnerId,
        months: body.months,
        monthsType: typeof body.months,
        itemsLen: items.length,
        itemKeys: first ? Object.keys(first) : [],
        unitPrice,
        unitPriceKeys: unitPrice ? Object.keys(unitPrice) : [],
        hasUnitPriceId: Boolean(
          unitPrice && Object.prototype.hasOwnProperty.call(unitPrice, '_id'),
        ),
        unitPriceAmountType: typeof unitPrice?.amount,
        unitPriceCurrency: unitPrice?.currency,
        quantity: first?.quantity,
        quantityType: typeof first?.quantity,
        productIdLen:
          typeof first?.productId === 'string'
            ? first.productId.length
            : null,
      },
      runId: 'post-fix',
    });
    // #endregion

    return next.handle().pipe(
      tap(() => {
        // #region agent log
        agentDebugLog({
          hypothesisId: 'A',
          location: 'order-create-debug.interceptor.ts:ok',
          message: 'POST /api/orders succeeded',
          data: {
            unitPriceKeys: unitPrice ? Object.keys(unitPrice) : [],
            hasUnitPriceId: Boolean(
              unitPrice && Object.prototype.hasOwnProperty.call(unitPrice, '_id'),
            ),
          },
          runId: 'post-fix',
        });
        // #endregion
      }),
      catchError((err: unknown) => {
        const e = err as {
          status?: number;
          message?: string | string[];
          response?: { message?: string | string[]; statusCode?: number };
          name?: string;
        };
        // #region agent log
        agentDebugLog({
          hypothesisId: 'A,B,C,D,E',
          location: 'order-create-debug.interceptor.ts:error',
          message: 'POST /api/orders failed',
          data: {
            name: e?.name,
            status: e?.status ?? e?.response?.statusCode,
            message: e?.response?.message ?? e?.message,
            hasUnitPriceId: Boolean(
              unitPrice && Object.prototype.hasOwnProperty.call(unitPrice, '_id'),
            ),
          },
          runId: 'post-fix',
        });
        // #endregion
        return throwError(() => err);
      }),
    );
  }
}
