import { CnabDetalheE_104V030 } from './extrato/cnab-detalhe-e-104-v030.interface';
import { CnabDetalheA_104 } from './pagamento/cnab-detalhe-a-104.interface';
import { CnabDetalheB_104 } from './pagamento/cnab-detalhe-b-104.interface';

export interface CnabRegistros104 {
  detalheA?: CnabDetalheA_104;
  detalheB?: CnabDetalheB_104;
  detalheE?: CnabDetalheE_104V030;
}
