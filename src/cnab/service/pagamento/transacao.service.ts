
import { Injectable, Logger } from '@nestjs/common';
import { TransacaoDTO } from '../../dto/pagamento/transacao.dto';
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { TransacaoRepository } from '../../repository/pagamento/transacao.repository';

import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { TransacaoStatus } from 'src/cnab/entity/pagamento/transacao-status.entity';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial } from 'typeorm';

@Injectable()
export class TransacaoService {
  private logger: Logger = new Logger('TransacaoService', {
    timestamp: true,
  });

  constructor(
    private transacaoRepository: TransacaoRepository,
  ) { }


  /**
   * getTransacaoFromOrdem()
   * 
   * **status** is Created.
   */
  public getTransacaoDTO(
    publicacao: ArquivoPublicacao,
    pagador: Pagador,
  ): Transacao {
    const transacao = new Transacao({
      dataOrdem: publicacao.dataOrdem,
      dataPagamento: null,
      idOrdemPagamento: publicacao.idOrdemPagamento,
      pagador: { id: pagador.id } as Pagador,
      status: new TransacaoStatus(TransacaoStatusEnum.created),
      ocorrencias: [],
    });
    return transacao;
  }

  public async saveMany(transacoes: DeepPartial<Transacao>[]): Promise<Transacao[]> {
    const insertResult = await this.transacaoRepository.insert(transacoes);
    return await this.transacaoRepository.findMany({
      where: insertResult.identifiers
    });
  }

  /**
   * Save Transacao if NSA not exists
   */
  public async saveIfNotExists(dto: TransacaoDTO): Promise<SaveIfNotExists<Transacao>> {
    return await this.transacaoRepository.saveDTOIfNotExists(dto);
  }

  /**
   * Save Transacao if NSA not exists
   */
  public async save(dto: TransacaoDTO): Promise<Transacao> {
    await validateDTO(TransacaoDTO, dto);
    return await this.transacaoRepository.save(dto);
  }

  public async getAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.findAll();
  }

  /**
   * Get all transacao where id not exists in headerArquivo yet (new CNABS)
   */
  public async findAllNewTransacao(): Promise<Transacao[]> {
    return await this.transacaoRepository.findAllNewTransacao();
  }
}