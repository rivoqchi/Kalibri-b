import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CartDocument = HydratedDocument<Cart>;

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

  @Prop({
    type: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true, default: 'UZS' },
    },
    required: true,
  })
  unitPrice!: { amount: number; currency: string };

  @Prop()
  imageUrl?: string;
}

@Schema({ timestamps: true, collection: 'carts' })
export class Cart {
  @Prop({ required: true, unique: true, index: true })
  sessionId!: string;

  @Prop({ type: [CartItemEmbedded], default: [] })
  items!: CartItemEmbedded[];
}

export const CartSchema = SchemaFactory.createForClass(Cart);
