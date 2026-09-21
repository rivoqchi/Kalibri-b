import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './notification.schema.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly realtime: RealtimeGateway,
  ) {}

  private map(doc: NotificationDocument) {
    return {
      id: String(doc._id),
      message: doc.message,
      orderId: doc.orderId,
      audience: doc.audience,
      read: doc.read,
      createdAt:
        (doc as NotificationDocument & { createdAt?: Date }).createdAt?.toISOString?.() ??
        new Date().toISOString(),
    };
  }

  async createAdminOrderNotification(orderId: string) {
    const created = await this.notificationModel.create({
      message: 'Yangi buyurtma keldi',
      orderId,
      audience: 'admin',
      read: false,
    });
    const mapped = this.map(created);
    this.realtime.emitNotificationCreated(mapped);
    return mapped;
  }

  async listAdmin() {
    const docs = await this.notificationModel
      .find({ audience: 'admin' })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    return docs.map((doc) => this.map(doc));
  }

  async markRead(id: string) {
    const doc = await this.notificationModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Notification');
    doc.read = true;
    await doc.save();
    return this.map(doc);
  }
}
