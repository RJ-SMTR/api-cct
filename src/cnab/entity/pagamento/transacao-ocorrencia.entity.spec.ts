import { TransacaoOcorrencia } from './transacao-ocorrencia.entity';
import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';

describe('TransacaoOcorrencia', () => {
  describe('newArray', () => {
    it('should return expected values', () => {
      const codes = '  0034  ';
      const expectedOcorrencias = [
        { code: '00', message: OcorrenciaEnum['00'] },
        { code: '34', message: `34 - Código desconhecido.` },
      ];

      const ocorrencias = TransacaoOcorrencia.newArray(codes);

      expect(ocorrencias).toEqual(expectedOcorrencias);
      expect(ocorrencias.length).toBe(2);
    });
  });
});
