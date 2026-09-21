import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Order,
  OrderDocument,
  type OrderStatus,
} from './order.schema.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { PartnersService } from '../partners/partners.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { CartService } from '../cart/cart.service.js';
import { isAdminRole } from '../users/user-role.js';
import { agentDebugLog } from '../common/utils/agent-debug-log.js';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly partnersService: PartnersService,
    private readonly notificationsService: NotificationsService,
    private readonly realtime: RealtimeGateway,
    private readonly cartService: CartService,
  ) {}

  private map(doc: OrderDocument) {
    const createdAt =
      (doc as OrderDocument & { createdAt?: Date }).createdAt?.toISOString?.() ??
      new Date().toISOString();
    const updatedAt =
      (doc as OrderDocument & { updatedAt?: Date }).updatedAt?.toISOString?.() ??
      createdAt;

    return {
      id: String(doc._id),
      userId: doc.userId,
      items: (doc.items ?? []).map((item) => ({
        productId: item.productId,
        slug: item.slug,
        name: item.name,
        quantity: item.quantity,
        unitPrice: {
          amount: item.unitPrice.amount,
          currency: item.unitPrice.currency,
        },
        imageUrl: item.imageUrl,
      })),
      partnerId: doc.partnerId,
      partnerName: doc.partnerName,
      months: doc.months,
      percent: doc.percent,
      monthlyAmount: doc.monthlyAmount,
      totalAmount: doc.totalAmount,
      currency: doc.currency,
      status: doc.status,
      createdAt,
      updatedAt,
    };
  }

  private calcMonthly(price: number, months: number, percent: number) {
    return (price * (1 + percent / 100)) / months;
  }

  async create(userId: string, dto: CreateOrderDto) {
    if (!dto.items?.length) {
      // #region agent log
      agentDebugLog({
        hypothesisId: 'C',
        location: 'orders.service.ts:create',
        message: 'reject empty items',
        data: {},
        runId: 'pre-fix',
      });
      // #endregion
      throw new BadRequestException('Savat bo\'sh');
    }

    const partner = await this.partnersService.findById(dto.partnerId);
    if (!partner.isActive) {
      // #region agent log
      agentDebugLog({
        hypothesisId: 'B',
        location: 'orders.service.ts:create',
        message: 'reject inactive partner',
        data: { partnerId: dto.partnerId },
        runId: 'pre-fix',
      });
      // #endregion
      throw new BadRequestException('Hamkor');
    }

    const monthOption = partner.months.find((m) => m.month === dto.months);
    if (!monthOption) {
      // #region agent log
      agentDebugLog({
        hypothesisId: 'B',
        location: 'orders.service.ts:create',
        message: 'reject months not on partner',
        data: {
          partnerId: dto.partnerId,
          months: dto.months,
          partnerMonths: partner.months.map((m) => m.month),
        },
        runId: 'pre-fix',
      });
      // #endregion
      throw new BadRequestException('Oy');
    }

    const items = dto.items.map((item) => ({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      quantity: item.quantity,
      unitPrice: {
        amount: item.unitPrice.amount,
        currency: item.unitPrice.currency || 'UZS',
      },
      imageUrl: item.imageUrl,
    }));

    const currency = items[0]?.unitPrice.currency ?? 'UZS';
    const totalAmount = items.reduce(
      (sum, item) => sum + item.unitPrice.amount * item.quantity,
      0,
    );
    if (totalAmount <= 0) {
      // #region agent log
      agentDebugLog({
        hypothesisId: 'C,D',
        location: 'orders.service.ts:create',
        message: 'reject totalAmount <= 0',
        data: {
          totalAmount,
          firstUnit: items[0]?.unitPrice,
        },
        runId: 'pre-fix',
      });
      // #endregion
      throw new BadRequestException('Narx');
    }

    const monthlyAmount = this.calcMonthly(
      totalAmount,
      monthOption.month,
      monthOption.percent,
    );

    const created = await this.orderModel.create({
      userId,
      items,
      partnerId: partner.id,
      partnerName: partner.name,
      months: monthOption.month,
      percent: monthOption.percent,
      monthlyAmount,
      totalAmount,
      currency,
      status: 'pending',
    });

    const order = this.map(created);
    await this.cartService.clearForUser(userId);
    await this.notificationsService.createAdminOrderNotification(order.id);
    this.realtime.emitOrderCreated(userId, order);
    return order;
  }

  async listForUser(userId: string) {
    const docs = await this.orderModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((doc) => this.map(doc));
  }

  async listAdmin() {
    const docs = await this.orderModel.find().sort({ createdAt: -1 }).exec();
    return docs.map((doc) => this.map(doc));
  }

  async findOne(id: string, userId: string, role?: string | null) {
    const doc = await this.orderModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Buyurtma');
    if (!isAdminRole(role) && doc.userId !== userId) {
      throw new ForbiddenException('Buyurtma');
    }
    return this.map(doc);
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    userId: string,
    role?: string | null,
  ) {
    const doc = await this.orderModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Buyurtma');

    const admin = isAdminRole(role);

    if (admin) {
      if (status !== 'confirmed' && status !== 'cancelled') {
        throw new BadRequestException('Status');
      }
    } else {
      if (doc.userId !== userId) {
        throw new ForbiddenException('Buyurtma');
      }
      if (doc.status !== 'pending') {
        throw new BadRequestException('Status');
      }
      if (status !== 'cancelled') {
        throw new ForbiddenException('Status');
      }
    }

    doc.status = status;
    await doc.save();
    return this.map(doc);
  }
}
