import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { JwtAuthGuard, type AuthedRequest } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { isAdminRole } from '../users/user-role.js';
import { OrderCreateDebugInterceptor } from './order-create-debug.interceptor.js';
import { OrderCreateSanitizeInterceptor } from './order-create-sanitize.interceptor.js';
import { agentDebugLog } from '../common/utils/agent-debug-log.js';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(OrderCreateSanitizeInterceptor, OrderCreateDebugInterceptor)
  create(@Req() req: AuthedRequest, @Body() dto: CreateOrderDto) {
    // #region agent log
    agentDebugLog({
      hypothesisId: 'A',
      location: 'orders.controller.ts:create',
      message: 'CreateOrderDto passed ValidationPipe',
      data: {
        partnerId: dto.partnerId,
        months: dto.months,
        itemsLen: dto.items?.length,
        firstAmount: dto.items?.[0]?.unitPrice?.amount,
        firstCurrency: dto.items?.[0]?.unitPrice?.currency,
      },
      runId: 'post-fix',
    });
    // #endregion
    return this.ordersService.create(req.user!.sub, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: AuthedRequest) {
    if (isAdminRole(req.user?.role)) {
      return this.ordersService.listAdmin();
    }
    return this.ordersService.listForUser(req.user!.sub);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList() {
    return this.ordersService.listAdmin();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.ordersService.findOne(id, req.user!.sub, req.user?.role);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(
      id,
      dto.status,
      req.user!.sub,
      req.user?.role,
    );
  }
}
