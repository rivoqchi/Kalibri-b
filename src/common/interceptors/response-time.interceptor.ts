import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const started = Date.now();
    const response = context.switchToHttp().getResponse<{
      setHeader: (key: string, value: string) => void;
    }>();

    return next.handle().pipe(
      map((data) => {
        response.setHeader('X-Response-Time', `${Date.now() - started}ms`);
        response.setHeader('X-Cache-Hint', 'public, s-maxage=60, stale-while-revalidate=300');
        return data;
      }),
    );
  }
}
