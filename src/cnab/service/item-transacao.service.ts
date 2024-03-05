// WIP

import { Injectable } from '@nestjs/common';
import { ItemTransacaoRepository } from '../repository/item-transacao.repository';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';
import { ItemTransacao } from '../entity/item-transacao.entity';


@Injectable()
export class ItemTransacaoService {
  constructor(
    private itemtransacaoRepository: ItemTransacaoRepository   
  ) {}
  
  public async save(itemTransacaoDTO:ItemTransacaoDTO): Promise<ItemTransacao> {   
     return await this.itemtransacaoRepository.save(itemTransacaoDTO);
  }
}