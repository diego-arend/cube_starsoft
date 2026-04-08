import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { INestApplication } from "@nestjs/common";
import { RedisService } from "@turborepo/redis";
import { Server, ServerOptions } from "socket.io";

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connectToRedis(app: INestApplication): Promise<void> {
    const redisService = app.get(RedisService);
    const pubClient = redisService.getInternalClient();

    if (!pubClient) {
      // Redis indisponível ou em fallback — usar adapter padrão em memória.
      // Acontece quando REDIS_ENABLED=false ou Redis está fora do ar.
      return;
    }

    // @socket.io/redis-adapter precisa de dois clientes separados:
    // um para PUBLISH e outro para SUBSCRIBE.
    // ioredis não permite os dois modos no mesmo client.
    const subClient = pubClient.duplicate();
    await subClient.connect();

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
