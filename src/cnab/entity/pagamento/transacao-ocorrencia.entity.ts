import { EntityHelper } from 'src/utils/entity-helper';
import {
  Column,
  DeepPartial,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transacao } from './transacao.entity';
import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';
import { Enum } from 'src/utils/enum';

@Entity()
export class TransacaoOcorrencia extends EntityHelper {
  constructor(ocorrencias?: DeepPartial<TransacaoOcorrencia>) {
    super();
    if (ocorrencias !== undefined) {
      Object.assign(this, ocorrencias);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Ocorrencia_id' })
  id: number;

  @ManyToOne(() => Transacao)
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoOcorrencia_transacao_ManyToOne',
  })
  transacao: Transacao;

  /** uniqueConstraintName: UQ_TransacaoOcorrencia_code */
  @Column({ type: String, unique: true, nullable: false, length: 2 })
  code: string;

  @Column({ type: String, unique: false, nullable: false, length: 100 })
  message: string;

  /**
   * @returns A list of new TransacaoOcorrencia. Without Transacao defined
   */
  public static newArray(ocorrenciaCodes: string): TransacaoOcorrencia[] {
    const codes = ocorrenciaCodes.trim();
    const codesList: string[] = [];
    for (let i = 0; i < codes.length; i += 2) {
      const code = codes.slice(i, i + 2);
      if (code.length > 0) {
        codesList.push(code);
      }
    }
    const ocorrencias: TransacaoOcorrencia[] = [];
    for (const code of codesList) {
      const message: string = Enum.getValue(OcorrenciaEnum, code, {
        defaultValue: `${code} - Código desconhecido.`,
      });
      ocorrencias.push(
        new TransacaoOcorrencia({
          code: code,
          message: message,
        }),
      );
    }
    return ocorrencias;
  }
}
