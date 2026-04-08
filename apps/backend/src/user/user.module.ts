import { Module, DynamicModule } from "@nestjs/common";
import { DatabaseModule, UserEntity } from "@turborepo/database";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { RedisModule } from "@turborepo/redis";

@Module({})
export class UserModule {
  static forRoot(): DynamicModule {
    return {
      module: UserModule,
      imports: [DatabaseModule.forFeature([UserEntity]), RedisModule],
      controllers: [UserController],
      providers: [UserService],
      exports: [UserService],
    };
  }
}
