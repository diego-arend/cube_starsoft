import "reflect-metadata";

// Ensure JWT env defaults for tests that import config at module initialization
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "testsecret";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? "refreshsecret";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? String(3600);
process.env.JWT_REFRESH_EXPIRES_IN =
  process.env.JWT_REFRESH_EXPIRES_IN ?? String(60 * 60 * 24 * 7);
