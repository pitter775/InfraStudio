export type UserRole = "admin" | "manager" | "viewer";

export type UserStatus = "ativo" | "pendente";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  provider?: string;
  providerId?: string;
  isMaster?: boolean;
  currentProjectId?: string | null;
  memberships?: Array<{
    projetoId: string | null;
    projetoNome?: string | null;
    projetoSlug?: string | null;
    papel: UserRole;
  }>;
};
