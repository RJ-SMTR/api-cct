import { Injectable } from '@nestjs/common';
import { HeaderArquivoService } from './header-arquivo.service';
import { TransacaoService } from './transacao.service';

@Injectable()
export class CnabService {
  constructor(
    private readonly headerArquivoService: HeaderArquivoService,
    private readonly transacaoService: TransacaoService,
  ) { }

  public async updateTransacaoFromJae() {
    await this.transacaoService.updateTransacaoFromJae()
  }

  public async sendNewCNABs() {
    await this.headerArquivoService.saveRemessa()
  }

  public async getArquivoRetornoCNAB(){
    await this.headerArquivoService.saveArquivoRetorno();
    await this.headerArquivoService.compareRemessaToRetorno();
  }

}