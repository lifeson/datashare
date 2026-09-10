export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}