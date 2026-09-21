import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CartDocument = HydratedDocument<Cart>;

@Schema({ _id: false })
export class CartMoneyEmbedded {
  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, default: 'UZS' })
  currency!: string;
}

export const CartMoneyEmbeddedSchema =
  SchemaFactory.createForClass(CartMoneyEmbedded);

@Schema({ _id: false })
export class CartItemEmbedded {
  @Prop({ required: true })
  productId!: string;

  @Prop({ required: true })
  slug!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ type: CartMoneyEmbeddedSchema, required: true })
  unitPrice!: CartMoneyEmbedded;

  @Prop()
  imageUrl?: string;
}

@Schema({ timestamps: true, collection: 'carts' })
export class Cart {
  @Prop()
  userId?: string;

  @Prop()
  sessionId?: string;

  @Prop({ type: [CartItemEmbedded], default: [] })
  items!: CartItemEmbedded[];
}

export const CartSchema = SchemaFactory.createForClass(Cart);

CartSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'string' } } },
);
CartSchema.index(
  { sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sessionId: { $type: 'string' },
      userId: { $exists: false },
    },
  },
);
