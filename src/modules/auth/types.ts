export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface RefreshSessionInput {
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface ForgotPasswordInput {
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  notificationPrefs?: Record<string, any>;
}

