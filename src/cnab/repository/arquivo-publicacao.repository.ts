import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ArquivoPublicacao } from "../entity/arquivo-publicacao.entity";
import { ArquivoPublicacaoDTO } from "../dto/arquivo-publicacao.dto";

@Injectable()
export class ArquivoPublicacaoRepository {
  private logger: Logger = new Logger('ArquivoPublicacaoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ArquivoPublicacao)
    private arquivoPublicacaoRepository: Repository<ArquivoPublicacao>,
  ) { }

  public async save(dto: ArquivoPublicacaoDTO): Promise<ArquivoPublicacao> {
    return this.arquivoPublicacaoRepository.save(dto);
  }
}