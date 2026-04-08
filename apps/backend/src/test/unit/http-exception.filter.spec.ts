import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ArgumentsHost, Logger } from "@nestjs/common";

// Minimal local shape matching Nest's HttpArgumentsHost for tests
type LocalHttpArgumentsHost<T = unknown> = {
  getResponse: () => T;
  getRequest: () => unknown;
  getNext: () => unknown;
};
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { HttpExceptionFilter } from "../../shared/filters/http-exception.filter";

type MockResponse = {
  status: (...args: unknown[]) => { send: (body: unknown) => void };
  send: (body: unknown) => void;
};

function mockResponse(): MockResponse {
  const send = vi.fn();
  const status = vi.fn(() => ({ send })) as unknown as (...args: unknown[]) => {
    send: (...args: unknown[]) => void;
  };
  return { status, send };
}

function mockHost(res: MockResponse): ArgumentsHost {
  // Provide a minimal ArgumentsHost implementation for tests
  const httpHost: LocalHttpArgumentsHost<MockResponse> = {
    getResponse: () => res,
    getRequest: () => ({}) as unknown,
    getNext: () => ({}) as unknown,
  };
  const host: any = { switchToHttp: () => httpHost };
  return host as ArgumentsHost;
}

describe("HttpExceptionFilter", () => {
  beforeEach(() => {
    // Prevent server error logging from polluting test output; assert via spy if needed.
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => void 0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("formats BadRequestException with string message", () => {
    const filter = new HttpExceptionFilter();
    const res = mockResponse();
    const host = mockHost(res);
    const ex = new BadRequestException("Invalid payload");
    filter.catch(ex, host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: "Invalid payload",
      code: "BAD_REQUEST",
      details: {},
    });
  });

  it("formats BadRequestException with validation details (normalized)", () => {
    const filter = new HttpExceptionFilter();
    const res = mockResponse();
    const host = mockHost(res);
    const details = { email: { _errors: ["invalid format"] } };
    const ex = new BadRequestException(details);
    filter.catch(ex, host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: "Validation failed",
      code: "BAD_REQUEST",
      details: { email: "invalid format" },
    });
  });

  it("normalizes nested Zod validation details", () => {
    const filter = new HttpExceptionFilter();
    const res = mockResponse();
    const host = mockHost(res);
    const details = {
      address: { street: { _errors: ["required"] } },
      email: { _errors: ["invalid"] },
    };
    const ex = new BadRequestException(details as any);
    filter.catch(ex, host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      message: "Validation failed",
      code: "BAD_REQUEST",
      details: { "address.street": "required", email: "invalid" },
    });
  });

  it("formats UnauthorizedException", () => {
    const filter = new HttpExceptionFilter();
    const res = mockResponse();
    const host = mockHost(res);
    const ex = new UnauthorizedException("Invalid credentials");
    filter.catch(ex, host);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({
      message: "Invalid credentials",
      code: "UNAUTHORIZED",
      details: {},
    });
  });

  it("formats NotFoundException", () => {
    const filter = new HttpExceptionFilter();
    const res = mockResponse();
    const host = mockHost(res);
    const ex = new NotFoundException("User not found");
    filter.catch(ex, host);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      message: "User not found",
      code: "NOT_FOUND",
      details: {},
    });
  });

  it("formats ConflictException", () => {
    const filter = new HttpExceptionFilter();
    const res = mockResponse();
    const host = mockHost(res);
    const ex = new ConflictException("Email already in use");
    filter.catch(ex, host);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith({
      message: "Email already in use",
      code: "CONFLICT",
      details: {},
    });
  });

  it("formats generic Error as 500", () => {
    const filter = new HttpExceptionFilter();
    const res = mockResponse();
    const host = mockHost(res);
    const ex = new Error("boom");
    filter.catch(ex, host);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      message: "boom",
      code: "INTERNAL_SERVER_ERROR",
      details: {},
    });
  });
});
