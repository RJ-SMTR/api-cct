export interface AgenteBigqueryUser {
  id_cliente: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string;
  tipo_documento: string;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
}
