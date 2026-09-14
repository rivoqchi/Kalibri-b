import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly config: ConfigService) {}

  async afterInit(server: Server) {
    const redisUrl = this.config.get<string>('redisUrl');
    if (!redisUrl) {
      this.logger.warn('Realtime running without Redis adapter (single instance)');
      return;
    }

    try {
      const pubClient = new Redis(redisUrl, { lazyConnect: true });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      server.adapter(createAdapter(pubClient, subClient));
      this.logger.log('Socket.IO Redis adapter enabled');
    } catch (error) {
      this.logger.warn(`Redis adapter failed: ${String(error)}`);
    }
  }

  handleConnection(client: Socket) {
    const sessionId = client.handshake.auth?.sessionId as string | undefined;
    if (sessionId) {
      void client.join(`cart:${sessionId}`);
    }
    this.logger.debug(`Client connected: ${client.id}`);
  }

  @SubscribeMessage('cart:join')
  handleCartJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId?: string },
  ) {
    if (!body?.sessionId) return { ok: false };
    void client.join(`cart:${body.sessionId}`);
    return { ok: true, room: `cart:${body.sessionId}` };
  }

  @SubscribeMessage('product:subscribe')
  handleProductSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { slug?: string },
  ) {
    if (!body?.slug) return { ok: false };
    void client.join(`product:${body.slug}`);
    return { ok: true, room: `product:${body.slug}` };
  }

  emitProductUpdated(product: unknown) {
    const slug =
      typeof product === 'object' && product && 'slug' in product
        ? String((product as { slug: string }).slug)
        : null;
    this.server.emit('product:updated', product);
    if (slug) this.server.to(`product:${slug}`).emit('product:updated', product);
  }

  emitStockChanged(payload: unknown) {
    this.server.emit('stock:changed', payload);
  }

  emitCartUpdated(sessionId: string, cart: unknown) {
    this.server.to(`cart:${sessionId}`).emit('cart:updated', cart);
  }

  emitOrderCreated(sessionId: string, order: unknown) {
    this.server.to(`cart:${sessionId}`).emit('order:created', order);
    this.server.emit('order:created', { sessionId, order });
  }

  emitPriceChanged(payload: unknown) {
    this.server.emit('price:changed', payload);
  }
}
