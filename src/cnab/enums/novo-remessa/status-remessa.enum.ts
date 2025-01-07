export enum StatusRemessaEnum {
  Criado = 0,//Criado no CCT
  EnviadoBanco = 1,//Remessa enviado
  AguardandoPagamento = 2, //Aguardando Pagamento // Primeiro retorno
  Efetivado = 3,//Segundo retorno
  NaoEfetivado = 4 //Retorno com Erro
}


export function getStatusRemessaEnumByValue(value: StatusRemessaEnum): string | undefined {
  return Object.keys(StatusRemessaEnum)
    .find(key => StatusRemessaEnum[key as keyof typeof StatusRemessaEnum] === value);
}