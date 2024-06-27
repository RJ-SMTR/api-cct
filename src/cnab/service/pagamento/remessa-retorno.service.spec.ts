import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SettingEntity } from 'src/settings/entities/setting.entity';
import { SettingsService } from 'src/settings/settings.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { RemessaRetornoService } from './remessa-retorno.service';

xdescribe('RemessaRetornoService', () => {
  let remessaRetornoService: RemessaRetornoService;
  let settingsService: SettingsService;
  let usersService: UsersService;

  beforeEach(async () => {
    const configServiceMock = {
      provide: ConfigService,
      useValue: {
        getOrThrow: jest.fn(),
      },
    } as Provider;
    const usersServiceMock = {
      provide: UsersService,
      useValue: {
        findOne: jest.fn(),
      },
    } as Provider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [RemessaRetornoService, configServiceMock, usersServiceMock],
    }).compile();

    remessaRetornoService = module.get<RemessaRetornoService>(
      RemessaRetornoService,
    );
    settingsService = module.get<SettingsService>(SettingsService);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(remessaRetornoService).toBeDefined();
  });

  xdescribe('generateSaveRemessa', () => {
    it('Deve gerar remessa com Transacoes da caixa e de outros bancos em lotes separados', async () => {
      // Arrange
      // const transacaoAg = new TransacaoAgrupado({
      //   id: 1,
        
      // })
      jest
        .spyOn(settingsService, 'findOneBySettingData')
        .mockResolvedValue({ value: 'true' } as SettingEntity);
      jest.spyOn(usersService, 'findOne').mockResolvedValue({ id: 1 } as User);
      jest
        .spyOn(global.Date, 'now')
        .mockImplementation(() => new Date('2023-01-01').valueOf());

      // Act
      await remessaRetornoService.generateSaveRemessa();

      // Assert
      expect(usersService.findOne).toBeCalledTimes(1);
    });
  });
});
