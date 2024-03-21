import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ArquivoPublicacao } from "../entity/arquivo-publicacao.entity";
import { ArquivoPublicacaoDTO } from "../dto/arquivo-publicacao.dto";
import { logWarn } from "src/utils/log-utils";
import { SaveIfNotExists } from "src/utils/types/save-if-not-exists.type";

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

  /**
   * Save if detalheARetornoId not exists yet.
   */
  public async saveIfNotExists(dto: ArquivoPublicacaoDTO, updateIfExists?: boolean): Promise<SaveIfNotExists<ArquivoPublicacao>> {
    const METHOD = 'saveIfNotExists()';
    const existing = await this.arquivoPublicacaoRepository.findOne({
      where: { idDetalheARetorno: dto.idDetalheARetorno }
    });
    if (existing) {
      const itemResult = updateIfExists
        ? await this.arquivoPublicacaoRepository.save({ ...dto, id: existing.id })
        : existing;
      logWarn(this.logger, 'detalheARetorno já existe no Arq.Pub. Ignorando...', METHOD);
      return {
        isNewItem: false,
        item: itemResult,
      };
    } else {
      return {
        isNewItem: true,
        item: await this.arquivoPublicacaoRepository.save(dto),
      };
    }
  }
}