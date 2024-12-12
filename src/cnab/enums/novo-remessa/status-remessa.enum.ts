export enum StatusRemessaEnum {
  Criado = 0,//Criado no CCT
  EnviadoBanco = 1,//Aguardando Pagamento
  AguardandoPagamento = 2, //primeiro retorno
  Efetivado = 3,//Segundo retorno
  NaoEfetivado = 4 //Retorno com Erro
}
