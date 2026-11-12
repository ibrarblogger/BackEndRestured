export interface NotificationPreferences {
  orderNew: boolean;
  kitchenReady: boolean;
  stockLow: boolean;
  reservationNew: boolean;
  systemAlerts: boolean;
  emailEnabled: boolean;
  soundEnabled: boolean;
}

export interface CreateNotificationInput {
  branchId?: string;
  userId?: string | null;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

