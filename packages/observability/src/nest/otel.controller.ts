import {
  Controller,
  Post,
  Param,
  Req,
  Res,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import type * as fastify from "fastify";
import { OtelAuthGuard } from "./otel-auth.guard";
import { OtelProxyService } from "./otel-proxy.service";
import { SetMetadata } from "@nestjs/common";

const IS_PUBLIC_KEY = "isPublic";
const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Controller("otel")
@Public()
@UseGuards(OtelAuthGuard)
export class OtelController {
  constructor(private readonly otel: OtelProxyService) {}

  @Post("v1/:resource")
  async proxy(
    @Param("resource") resource: string,
    @Req() req: fastify.FastifyRequest,
    @Res() res: fastify.FastifyReply
  ) {
    const resourceName = resource.toLowerCase();
    if (!["traces", "metrics", "logs"].includes(resourceName)) {
      throw new NotFoundException(`Resource ${resource} not supported`);
    }

    const upstream = await this.otel.proxy(resourceName, req);

    res.status(upstream.status);
    upstream.headers.forEach((v, k) => {
      res.header(k, v);
    });

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  }
}
