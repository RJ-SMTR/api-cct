import { RemessaService } from './remessa.service';
import { OrdemPagamentoAgrupadoService } from './ordem-pagamento-agrupado.service';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';

describe('RemessaService', () => {
  let service: RemessaService;
  let ordemPagamentoAgrupadoService: jest.Mocked<Pick<OrdemPagamentoAgrupadoService, 'getHistoricosOrdem' | 'saveStatusHistorico'>>;

  beforeEach(() => {
    ordemPagamentoAgrupadoService = {
      getHistoricosOrdem: jest.fn(),
      saveStatusHistorico: jest.fn(),
    } as any;
    service = new RemessaService(
      ordemPagamentoAgrupadoService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  /** helper: chama o metodo privado atualizaStatusRemessa */
  const atualizar = (opa: any, status: StatusRemessaEnum) => (service as any).atualizaStatusRemessa(opa, status);

  describe('atualizaStatusRemessa', () => {
    it('propaga o erro quando saveStatusHistorico falha, em vez de engoli-lo', async () => {
      ordemPagamentoAgrupadoService.getHistoricosOrdem.mockResolvedValue([{ id: 10 } as any]);
      ordemPagamentoAgrupadoService.saveStatusHistorico.mockRejectedValue(new Error('db indisponivel'));

      await expect(atualizar({ id: 1 }, StatusRemessaEnum.PreparadoParaEnvio)).rejects.toThrow('db indisponivel');
    });

    it('chama saveStatusHistorico com o ultimo historico da lista', async () => {
      ordemPagamentoAgrupadoService.getHistoricosOrdem.mockResolvedValue([{ id: 10 } as any, { id: 11 } as any]);
      ordemPagamentoAgrupadoService.saveStatusHistorico.mockResolvedValue(undefined as any);

      await atualizar({ id: 1 }, StatusRemessaEnum.PreparadoParaEnvio);

      expect(ordemPagamentoAgrupadoService.saveStatusHistorico).toHaveBeenCalledWith(
        expect.objectContaining({ id: 11 }),
        StatusRemessaEnum.PreparadoParaEnvio,
      );
    });

    it('nao chama saveStatusHistorico quando nao ha historico', async () => {
      ordemPagamentoAgrupadoService.getHistoricosOrdem.mockResolvedValue(null as any);

      await atualizar({ id: 1 }, StatusRemessaEnum.PreparadoParaEnvio);

      expect(ordemPagamentoAgrupadoService.saveStatusHistorico).not.toHaveBeenCalled();
    });
  });
});
