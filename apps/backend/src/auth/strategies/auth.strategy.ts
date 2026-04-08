export interface AuthStrategyResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  role?: string;
}

export interface AuthStrategy<T = unknown> {
  name: string;
  login(payload: T): Promise<AuthStrategyResult>;
  refresh(refreshToken: string): Promise<AuthStrategyResult>;
}
