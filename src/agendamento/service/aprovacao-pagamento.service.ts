import { Injectable } from "@nestjs/common";
import { Nullable } from "src/utils/types/nullable.type";
import { AprovacaoPagamentoDTO } from "../domain/dto/aprovacao-pagamento.dto";
import { AprovacaoPagamentoRepository } from "../repository/aprovacao-pagamento.repository";
import { AprovacaoPagamentoConvert } from "../convert/aprovacao-pagamento.convert";
import { UsersService } from "src/users/users.service";

@Injectable()
export class AprovacaoPagamentoService {
   
  constructor(
    private aprovacaoPagamentoRepository: AprovacaoPagamentoRepository,
    private aprovacaoPagamentoConvert: AprovacaoPagamentoConvert,
    private readonly usersService: UsersService,
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

  async approvePayment(id:number, userId:number, password:string) {
    const user = await this.usersService.findOne({ id: userId });
    return await this.aprovacaoPagamentoRepository.approvePayment(id, user, password);
  }

  async delete(id:number) {
    await this.aprovacaoPagamentoRepository.delete(id);
  }

}