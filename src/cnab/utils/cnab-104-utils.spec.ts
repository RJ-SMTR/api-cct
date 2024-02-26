import * as fs from 'fs';
import * as path from 'path';
import { ICnab240_104DetalheA } from '../interfaces/cnab-240/104/cnab-240-104-detalhe-a.interface';
import { ICnab240_104DetalheB } from '../interfaces/cnab-240/104/cnab-240-104-detalhe-b.interface';
import { ICnab240_104File } from '../interfaces/cnab-240/104/cnab-240-104-file.interface';
import { ICnab240_104Lote } from '../interfaces/cnab-240/104/cnab-240-104-lote.interface';
import { cnab240_104DetalheATemplateTest } from '../test/templates/240/104/cnab-240-104-detalhe-a-template-test.const';
import { cnab240_104DetalheBTemplateTest } from '../test/templates/240/104/cnab-240-104-detalhe-b-template-test.const';
import { cnab240_104HeaderArquivoTemplateTest } from '../test/templates/240/104/cnab-240-104-header-arquivo-template-test.const';
import { cnab240_104HeaderLoteTemplateTest } from '../test/templates/240/104/cnab-240-104-header-lote-template-test.const';
import { cnab240_104TrailerArquivoTemplateTest } from '../test/templates/240/104/cnab-240-104-trailer-arquivo-template-test.const';
import { cnab240_104TrailerLoteTemplateTest } from '../test/templates/240/104/cnab-240-104-trailer-lote-template-test.const';
import { getCnabFileFrom104, stringifyCnab104File } from './cnab-104-utils';

describe('cnab-104-utils.ts', () => {
  const sc = structuredClone;
  const templatesPath = path.join(__dirname, '..', 'test', 'templates');
  const headerArquivo = cnab240_104HeaderArquivoTemplateTest;
  const trailerArquivo = cnab240_104TrailerArquivoTemplateTest;
  const headerLote = cnab240_104HeaderLoteTemplateTest;
  const trailerLote = cnab240_104TrailerLoteTemplateTest;
  const detalheA = cnab240_104DetalheATemplateTest;
  const detalheB = cnab240_104DetalheBTemplateTest;

  describe('stringifyCnab104File()', () => {
    it('should return string version correctly', () => {
      // Arrange
      const lote: ICnab240_104Lote = {
        headerLote: sc(headerLote),
        registros: [
          {
            detalheA: sc(detalheA),
            detalheB: sc(detalheB),
          },
          {
            detalheA: sc(detalheA),
            detalheB: sc(detalheB),
          },
        ],
        trailerLote: sc(trailerLote),
      };

      const file: ICnab240_104File = {
        headerArquivo: sc(headerArquivo),
        lotes: [sc(lote), sc(lote)],
        trailerArquivo: sc(trailerArquivo),
      };
      file.lotes[1].registros.push({
        detalheA: sc(detalheA),
        detalheB: sc(detalheB),
      });

      const expectedResponseFilePath = path.join(
        templatesPath,
        '240',
        '104',
        'example-240-104.rem',
      );
      const expectedResponse = fs
        .readFileSync(expectedResponseFilePath, 'utf-8')
        .replace(/\r\n/g, '\n');

      // Act
      const response = stringifyCnab104File(file).replace(/\r\n/g, '\n');

      // Assert
      expect(response).toEqual(expectedResponse);
    });
  });

  describe('getCnabFileFrom104()', () => {
    it('should set CnabFields in the right places', () => {
      // Arrange
      const lote: ICnab240_104Lote = {
        headerLote: sc(headerLote),
        registros: [
          {
            detalheA: sc(detalheA),
            detalheB: sc(detalheB),
          },
          {
            detalheA: sc(detalheA),
            detalheB: sc(detalheB),
          },
        ],
        trailerLote: sc(trailerLote),
      };
      const lote0 = sc(lote);
      const lote1 = sc(lote);

      lote0.headerLote.usoExclusivoFebraban.value = 'L0H';
      (
        lote0.registros[0].detalheA as ICnab240_104DetalheA
      ).usoExclusivoFebraban.value = 'L0R0A';
      (
        lote0.registros[1].detalheB as ICnab240_104DetalheB
      ).usoExclusivoFebraban.value = 'L0R1B';

      lote1.trailerLote.usoExclusivoFebraban.value = 'L1T';
      (
        lote1.registros[0].detalheB as ICnab240_104DetalheB
      ).usoExclusivoFebraban.value = 'L1R0B';
      (
        lote1.registros[1].detalheA as ICnab240_104DetalheA
      ).usoExclusivoFebraban.value = 'L1R1A';

      const file: ICnab240_104File = {
        headerArquivo: sc(headerArquivo),
        lotes: [sc(lote0), sc(lote1)],
        trailerArquivo: sc(trailerArquivo),
      };

      // Act
      const response = getCnabFileFrom104(file);

      // Assert
      expect(response.headerArquivo.fields).toEqual(headerArquivo);
      expect(
        response.lotes[0].headerLote.fields.usoExclusivoFebraban.value,
      ).toEqual('L0H');
      expect(
        response.lotes[0].registros[0].fields.usoExclusivoFebraban.value,
      ).toEqual('L0R0A');
      expect(
        response.lotes[0].registros[3].fields.usoExclusivoFebraban.value,
      ).toEqual('L0R1B');
      expect(
        response.lotes[1].registros[1].fields.usoExclusivoFebraban.value,
      ).toEqual('L1R0B');
      expect(
        response.lotes[1].registros[2].fields.usoExclusivoFebraban.value,
      ).toEqual('L1R1A');
      expect(
        response.lotes[1].trailerLote.fields.usoExclusivoFebraban.value,
      ).toEqual('L1T');
      expect(response.trailerArquivo.fields).toEqual(trailerArquivo);
    });
  });
});
