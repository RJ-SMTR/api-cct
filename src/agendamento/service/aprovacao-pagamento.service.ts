import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Nullable } from "src/utils/types/nullable.type";
import { AprovacaoPagamentoDTO } from "../domain/dto/aprovacao-pagamento.dto";
import { AprovacaoPagamento } from "../domain/entity/aprovacao-pagamento.entity";
import { AprovacaoPagamentoRepository } from "../repository/aprovacao-pagamento.repository";
import { AprovacaoPagamentoConvert } from "../convert/aprovacao-pagamento.convert";

@Injectable()
export class AprovacaoPagamentoService {
   
  constructor(
    @InjectRepository(AprovacaoPagamento)
    private aprovacaoPagamentoRepository: AprovacaoPagamentoRepository,
    private aprovacaoPagamentoConvert: AprovacaoPagamentoConvert
  ) {}

  async findAll(): Promise<AprovacaoPagamentoDTO[]> {      
    const entities = await this.aprovacaoPagamentoRepository.findAll();

    return Promise.all(
      entities.map(p => this.aprovacaoPagamentoConvert.convertEntityToDTO(p))
    );
  }

  async findById(id: number): Promise<Nullable<AprovacaoPagamentoDTO>> { 
    const entity = await this.aprovacaoPagamentoRepository.findOne({id: id});
    return entity? this.aprovacaoPagamentoConvert.convertEntityToDTO(entity):null;
  }

  async save(aprovacaoPagamento: AprovacaoPagamentoDTO):Promise<AprovacaoPagamentoDTO> {    
    return this.aprovacaoPagamentoConvert.convertEntityToDTO(await this.aprovacaoPagamentoRepository.save(aprovacaoPagamento));   
  }

  async delete(id:number) {
    await this.aprovacaoPagamentoRepository.delete(id);
  }

}