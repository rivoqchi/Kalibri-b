import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

export const ORDER_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

@Schema({ _id: false })
export class OrderMoneyEmbedded {
  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, default: 'UZS' })
  currency!: string;
}

export const OrderMoneyEmbeddedSchema =
  SchemaFactory.createForClass(OrderMoneyEmbedded);

@Schema({ _id: false })
export class OrderItemEmbedded {
  @Prop({ required: true })
  productId!: string;

  @Prop({ required: true })
  slug!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ type: OrderMoneyEmbeddedSchema, required: true })
  unitPrice!: OrderMoneyEmbedded;

  @Prop()
  imageUrl?: string;
}

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ type: [OrderItemEmbedded], default: [] })
  items!: OrderItemEmbedded[];

  @Prop({ required: true })
  partnerId!: string;

  @Prop({ required: true, trim: true })
  partnerName!: string;

  @Prop({ required: true, min: 1 })
  months!: number;

  @Prop({ required: true, min: 0 })
  percent!: number;

  @Prop({ required: true, min: 0 })
  monthlyAmount!: number;

  @Prop({ required: true, min: 0 })
  totalAmount!: number;

  @Prop({ required: true, default: 'UZS' })
  currency!: string;

  @Prop({
    required: true,
    enum: ORDER_STATUSES,
    default: 'pending',
    index: true,
  })
  status!: OrderStatus;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });
