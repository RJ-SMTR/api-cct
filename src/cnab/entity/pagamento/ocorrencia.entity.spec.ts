import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';
import { Ocorrencia } from './ocorrencia.entity';

describe('Ocorrencia', () => {
  describe('formatToUserErrors', () => {
    it('Deve esconder 2 erros técnicos, e mostrar 1 erro genérico no lugar', () => {
      const ocorrencias = [
        Ocorrencia.fromEnum(OcorrenciaEnum['AG']),
        Ocorrencia.fromEnum(OcorrenciaEnum['02']),
        Ocorrencia.fromEnum(OcorrenciaEnum['03']),
      ];

      const expectedOutput = [
        Ocorrencia.fromEnum(OcorrenciaEnum['AG']),
        Ocorrencia.fromEnum(OcorrenciaEnum['  ']),
      ];

      const formattedErrors = Ocorrencia.toUserErrors(ocorrencias);
      expect(formattedErrors).toEqual(expectedOutput);
    });
  });
});
