export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Item {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  created_at: string;
}

export interface ItemCreate {
  name: string;
  description?: string | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
