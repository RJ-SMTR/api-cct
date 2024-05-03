import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';
import { EntityHelper } from 'src/utils/entity-helper';
import { Enum } from 'src/utils/enum';
import {
  Column,
  DeepPartial,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DetalheA } from './detalhe-a.entity';
import { HeaderArquivo } from './header-arquivo.entity';

@Entity()
export class Ocorrencia extends EntityHelper {
  constructor(ocorrencias?: DeepPartial<Ocorrencia>) {
    super();
    if (ocorrencias !== undefined) {
      Object.assign(this, ocorrencias);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Ocorrencia_id' })
  id: number;

  @ManyToOne(() => HeaderArquivo)
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoOcorrencia_headerArquivo_ManyToOne',
  })
  headerArquivo: HeaderArquivo;

  @ManyToOne(() => DetalheA)
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoOcorrencia_detalheA_ManyToOne',
  })
  detalheA: DetalheA;

  /** uniqueConstraintName: UQ_TransacaoOcorrencia_code */
  @Column({ type: String, unique: true, nullable: false, length: 2 })
  code: string;

  @Column({ type: String, unique: false, nullable: false, length: 100 })
  message: string;

  /**
   * @returns A list of new TransacaoOcorrencia. Without Transacao defined
   */
  public static newArray(ocorrenciaCodes: string): Ocorrencia[] {
    const codes = ocorrenciaCodes.trim();
    const codesList: string[] = [];
    for (let i = 0; i < codes.length; i += 2) {
      const code = codes.slice(i, i + 2);
      if (code.length > 0) {
        codesList.push(code);
      }
    }
    const ocorrencias: Ocorrencia[] = [];
    for (const code of codesList) {
      const message: string = Enum.getValue(OcorrenciaEnum, code, {
        defaultValue: `${code} - Código desconhecido.`,
      });
      ocorrencias.push(
        new Ocorrencia({
          code: code,
          message: message,
        }),
      );
    }
    return ocorrencias;
  }
}
