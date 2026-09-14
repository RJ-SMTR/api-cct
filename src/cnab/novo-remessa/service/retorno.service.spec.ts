import { RetornoService } from './retorno.service';
import { OrdemPagamentoAgrupadoService } from './ordem-pagamento-agrupado.service';
import { DetalheAService } from 'src/cnab/service/pagamento/detalhe-a.service';
import { SftpService } from 'src/sftp/sftp.service';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { CustomLogger } from 'src/utils/custom-logger';
import { SftpBackupFolder } from 'src/sftp/enums/sftp-backup-folder.enum';

const parseMock = jest.fn();
jest.mock('src/cnab/utils/cnab/cnab-104-utils', () => ({
  parseCnab240Pagamento: (...args: any[]) => parseMock(...args),
}));

/** Silencia logs do CustomLogger nos testes. */
beforeAll(() => {
  (global as any).__localTzOffset = 0;
  for (const m of ['debug', 'log', 'warn', 'error'] as const) {
    jest.spyOn(CustomLogger.prototype, m).mockImplementation(() => undefined);
  }
});

/** Monta o objeto que o parser produziria para um registro do retorno. */
function makeRegistro(ocorrenciaDetalheA: string, cpf = '55032451720', valor = 4497.6) {
  return {
    detalheA: {
      ocorrencias: { value: ocorrenciaDetalheA.padEnd(10, ' ') },
      valorLancamento: { convertedValue: valor },
      codigoBancoDestino: { convertedValue: '104' },
      codigoAgenciaDestino: { convertedValue: '0001' },
      contaCorrenteDestino: { convertedValue: '123' },
    },
    detalheB: { numeroInscricao: { convertedValue: cpf } },
  } as any;
}
function makeLote(ocorrenciaHeaderLote: string, registros: any[] = []) {
  return { headerLote: { ocorrencias: { value: ocorrenciaHeaderLote.padEnd(10, ' ') } }, registros } as any;
}
/** historico "fake" como o getHistorico retornaria (linha de oph). */
function makeHistorico(id: number, statusRemessa: StatusRemessaEnum, opaId = 1) {
  return { id, statusRemessa, ordemPagamentoAgrupadoId: opaId } as any;
}

describe('RetornoService', () => {
  let service: RetornoService;
  let opaService: jest.Mocked<Pick<OrdemPagamentoAgrupadoService,
    'getHistorico' | 'saveStatusHistorico' | 'propagarPagamentoPaiParaFilhas'>>;
  let detalheAService: jest.Mocked<Pick<DetalheAService, 'getDetalheARetorno'>>;
  let sftpService: jest.Mocked<Pick<SftpService, 'moveToBackup' | 'getFirstRetornoPagamento'>>;

  beforeEach(() => {
    opaService = {
      getHistorico: jest.fn(),
      // replica o efeito colateral real: muta historico.statusRemessa
      saveStatusHistorico: jest.fn(async (h: any, s: any) => { h.statusRemessa = s; }),
      propagarPagamentoPaiParaFilhas: jest.fn(async () => 0),
    } as any;
    detalheAService = { getDetalheARetorno: jest.fn() } as any;
    sftpService = { moveToBackup: jest.fn(async () => undefined), getFirstRetornoPagamento: jest.fn() } as any;
    service = new RetornoService(opaService as any, detalheAService as any, sftpService as any);
  });

  /** helper: chama o metodo privado atualizarStatusRemessaHistorico */
  const atualizar = (lote: any, registro: any, detalheA: any) =>
    (service as any).atualizarStatusRemessaHistorico(lote, registro, detalheA);

  describe('atualizarStatusRemessaHistorico - maquina de estados', () => {
    it('PreparadoParaEnvio + header lote OK + detalheA "00" => AguardandoPagamento', async () => {
      opaService.getHistorico.mockResolvedValue([makeHistorico(10, StatusRemessaEnum.PreparadoParaEnvio)]);
      await atualizar(makeLote('00'), makeRegistro('00'), { id: 1 });
      expect(opaService.saveStatusHistorico).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10 }), StatusRemessaEnum.AguardandoPagamento);
    });

    it('PreparadoParaEnvio + detalheA "BD" => AguardandoPagamento', async () => {
      opaService.getHistorico.mockResolvedValue([makeHistorico(10, StatusRemessaEnum.PreparadoParaEnvio)]);
      await atualizar(makeLote('00'), makeRegistro('BD'), { id: 1 });
      expect(opaService.saveStatusHistorico).toHaveBeenCalledWith(expect.anything(), StatusRemessaEnum.AguardandoPagamento);
    });

    it('PreparadoParaEnvio + detalheA com erro ("AI") => NaoEfetivado', async () => {
      opaService.getHistorico.mockResolvedValue([makeHistorico(10, StatusRemessaEnum.PreparadoParaEnvio)]);
      await atualizar(makeLote('00'), makeRegistro('AI'), { id: 1 });
      expect(opaService.saveStatusHistorico).toHaveBeenCalledWith(expect.anything(), StatusRemessaEnum.NaoEfetivado);
    });

    it('PreparadoParaEnvio + header lote com erro => NaoEfetivado e ABORTA os demais historicos', async () => {
      opaService.getHistorico.mockResolvedValue([
        makeHistorico(10, StatusRemessaEnum.PreparadoParaEnvio),
        makeHistorico(11, StatusRemessaEnum.PreparadoParaEnvio),
      ]);
      await atualizar(makeLote('AG'), makeRegistro('00'), { id: 1 });
      expect(opaService.saveStatusHistorico).toHaveBeenCalledTimes(1);
      expect(opaService.saveStatusHistorico).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10 }), StatusRemessaEnum.NaoEfetivado);
      // nao propaga quando o header lote falhou (return antes)
      expect(opaService.propagarPagamentoPaiParaFilhas).not.toHaveBeenCalled();
    });

    it('AguardandoPagamento + "00", indice 0 => Efetivado', async () => {
      opaService.getHistorico.mockResolvedValue([makeHistorico(10, StatusRemessaEnum.AguardandoPagamento)]);
      await atualizar(makeLote('00'), makeRegistro('00'), { id: 1 });
      expect(opaService.saveStatusHistorico).toHaveBeenCalledWith(expect.anything(), StatusRemessaEnum.Efetivado);
    });

    it('AguardandoPagamento + "00": indice 0 => Efetivado, indices seguintes => PendenciaPaga', async () => {
      opaService.getHistorico.mockResolvedValue([
        makeHistorico(10, StatusRemessaEnum.AguardandoPagamento),
        makeHistorico(11, StatusRemessaEnum.AguardandoPagamento),
        makeHistorico(12, StatusRemessaEnum.AguardandoPagamento),
      ]);
      await atualizar(makeLote('00'), makeRegistro('00'), { id: 1 });
      expect(opaService.saveStatusHistorico).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ id: 10 }), StatusRemessaEnum.Efetivado);
      expect(opaService.saveStatusHistorico).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ id: 11 }), StatusRemessaEnum.PendenciaPaga);
      expect(opaService.saveStatusHistorico).toHaveBeenNthCalledWith(3,
        expect.objectContaining({ id: 12 }), StatusRemessaEnum.PendenciaPaga);
    });

    it('AguardandoPagamento + header lote com erro => NaoEfetivado', async () => {
      opaService.getHistorico.mockResolvedValue([makeHistorico(10, StatusRemessaEnum.AguardandoPagamento)]);
      await atualizar(makeLote('AG'), makeRegistro('00'), { id: 1 });
      expect(opaService.saveStatusHistorico).toHaveBeenCalledWith(expect.anything(), StatusRemessaEnum.NaoEfetivado);
    });

    it('AguardandoPagamento + detalheA com erro ("02") => NaoEfetivado', async () => {
      opaService.getHistorico.mockResolvedValue([makeHistorico(10, StatusRemessaEnum.AguardandoPagamento)]);
      await atualizar(makeLote('00'), makeRegistro('02'), { id: 1 });
      expect(opaService.saveStatusHistorico).toHaveBeenCalledWith(expect.anything(), StatusRemessaEnum.NaoEfetivado);
    });

    it('historico ja finalizado (Efetivado/NaoEfetivado/PendenciaPaga) => nao altera', async () => {
      opaService.getHistorico.mockResolvedValue([
        makeHistorico(10, StatusRemessaEnum.Efetivado),
        makeHistorico(11, StatusRemessaEnum.NaoEfetivado),
        makeHistorico(12, StatusRemessaEnum.PendenciaPaga),
      ]);
      await atualizar(makeLote('00'), makeRegistro('00'), { id: 1 });
      expect(opaService.saveStatusHistorico).not.toHaveBeenCalled();
    });
  });

  describe('propagacao para ordens filhas', () => {
    it('chama propagarPagamentoPaiParaFilhas com o id do detalheA apos o loop', async () => {
      opaService.getHistorico.mockResolvedValue([makeHistorico(10, StatusRemessaEnum.AguardandoPagamento)]);
      await atualizar(makeLote('00'), makeRegistro('00'), { id: 777 });
      expect(opaService.propagarPagamentoPaiParaFilhas).toHaveBeenCalledWith(777);
    });

    it('NAO propaga quando o header lote falhou (early return)', async () => {
      opaService.getHistorico.mockResolvedValue([makeHistorico(10, StatusRemessaEnum.PreparadoParaEnvio)]);
      await atualizar(makeLote('HF'), makeRegistro('00'), { id: 777 });
      expect(opaService.propagarPagamentoPaiParaFilhas).not.toHaveBeenCalled();
    });
  });

  describe('salvarRetorno', () => {
    const cnab = { name: 'retorno.ret', content: 'RAW' };

    it('registro com match => atualiza e move para o backup de sucesso', async () => {
      parseMock.mockReturnValue({ lotes: [makeLote('00', [makeRegistro('00')])] });
      detalheAService.getDetalheARetorno.mockResolvedValue([{ id: 1 } as any]);
      opaService.getHistorico.mockResolvedValue([makeHistorico(10, StatusRemessaEnum.AguardandoPagamento)]);

      await service.salvarRetorno(cnab);

      expect(opaService.saveStatusHistorico).toHaveBeenCalledWith(expect.anything(), StatusRemessaEnum.Efetivado);
      expect(sftpService.moveToBackup).toHaveBeenCalledWith('retorno.ret', SftpBackupFolder.RetornoSuccess, 'RAW');
    });

    it('registro sem match => nao altera nada, loga warn, ainda move para sucesso', async () => {
      parseMock.mockReturnValue({ lotes: [makeLote('00', [makeRegistro('00')])] });
      detalheAService.getDetalheARetorno.mockResolvedValue([]);

      await service.salvarRetorno(cnab);

      expect(opaService.saveStatusHistorico).not.toHaveBeenCalled();
      expect(CustomLogger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('sem detalheA correspondente'));
      expect(sftpService.moveToBackup).toHaveBeenCalledWith('retorno.ret', SftpBackupFolder.RetornoSuccess, 'RAW');
    });

    it('erro no processamento => loga error e move para o backup de falha', async () => {
      parseMock.mockReturnValue({ lotes: [makeLote('00', [makeRegistro('00')])] });
      detalheAService.getDetalheARetorno.mockRejectedValue(new Error('boom'));

      await service.salvarRetorno(cnab);

      expect(CustomLogger.prototype.error).toHaveBeenCalled();
      expect(sftpService.moveToBackup).toHaveBeenCalledWith('retorno.ret', SftpBackupFolder.RetornoFailure, 'RAW');
    });
  });
});
