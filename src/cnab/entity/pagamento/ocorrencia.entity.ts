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

  @ManyToOne(() => DetalheA, { nullable: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_TransacaoOcorrencia_detalheA_ManyToOne',
  })
  detalheA: DetalheA | null;

  @Column({ type: String, unique: false, nullable: false, length: 2 })
  code: string;

  @Column({ type: String, unique: false, nullable: false, length: 100 })
  message: string;

  public static getCodesList(ocorrenciaCodes: string) {
    const codes = ocorrenciaCodes.replace(/ /gm, '');
    const codesList: string[] = [];
    for (let i = 0; i < codes.length; i += 2) {
      const code = codes.slice(i, i + 2);
      if (code.length > 0) {
        codesList.push(code);
      }
    }
    return codesList;
  }

  /**
   * @returns A list of new TransacaoOcorrencia. Without Transacao defined
   */
  public static newList(ocorrenciaCodes: string): Ocorrencia[] {
    const codesList = Ocorrencia.getCodesList(ocorrenciaCodes);
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

  public static getErrorCodes(ocorrenciaCodes: string) {
    const codesList = Ocorrencia.getCodesList(ocorrenciaCodes);
    const errors = codesList.filter((c) => !['00', 'BD'].includes(c));
    return errors;
  }
}
