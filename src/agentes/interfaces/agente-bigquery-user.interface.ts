export interface AgenteBigqueryUser {
  numero_identificacao: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string;
  tipo_documento: string;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  datetime_ultima_atualizacao?: string | null;
}
