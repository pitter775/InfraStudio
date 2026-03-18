export type MockUserRole = "admin" | "manager" | "viewer";

export type MockUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: MockUserRole;
  status: "ativo" | "pendente";
};

export const mockUsers: MockUser[] = [
  {
    id: "usr_admin_001",
    name: "Patricia Alves",
    email: "admin@infrastudio.com",
    password: "admin123",
    role: "admin",
    status: "ativo",
  },
  {
    id: "usr_manager_001",
    name: "Bruno Costa",
    email: "gestor@infrastudio.com",
    password: "gestor123",
    role: "manager",
    status: "ativo",
  },
  {
    id: "usr_viewer_001",
    name: "Camila Rocha",
    email: "viewer@infrastudio.com",
    password: "viewer123",
    role: "viewer",
    status: "pendente",
  },
];
