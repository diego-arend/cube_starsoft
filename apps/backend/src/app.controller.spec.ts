import { describe, it, expect, beforeEach } from "vitest";

import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("health", () => {
    it("should return health status object", () => {
      expect(appController.getHealth()).toEqual({ status: "ok" });
    });
  });
});
