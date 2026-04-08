import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/decorators/public.decorator";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";

@ApiTags("Health")
@Controller()
export class AppController {
  @Get("health")
  @Public()
  @ApiOperation({ summary: "Get health status" })
  @ApiOkResponse({ description: "Status object" })
  getHealth() {
    // The health endpoint returns only the backend status
    return { status: "ok" };
  }

  @Get("error-test")
  @Public()
  getErrorTest() {
    throw new Error("Generic failure for testing the data contract");
  }
}
