export type AuthFeedback = {
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
};

export type AuthProviderStatus = {
  enabled: boolean;
  ready: boolean;
  configured?: boolean;
  message?: string;
};

export type AuthProviders = {
  local: AuthProviderStatus;
  google: AuthProviderStatus;
};
