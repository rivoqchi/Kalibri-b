import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/** Strip Mongo subdoc `_id` from cart money objects before ValidationPipe. */
@Injectable()
export class OrderCreateSanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      body?: {
        items?: Array<{
          unitPrice?: { amount?: unknown; currency?: unknown; _id?: unknown };
        }>;
      };
    }>();
    const items = req.body?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        const price = item?.unitPrice;
        if (price && typeof price === 'object') {
          item.unitPrice = {
            amount: Number(price.amount),
            currency:
              typeof price.currency === 'string' && price.currency
                ? price.currency
                : 'UZS',
          };
        }
      }
    }
    return next.handle();
  }
}
