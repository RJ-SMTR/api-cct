import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { isToday, startOfDay } from 'date-fns';
import { IFetchTicketRevenues } from 'src/ticket-revenues/interfaces/fetch-ticket-revenues.interface';
import { ITicketRevenue } from 'src/ticket-revenues/interfaces/ticket-revenue.interface';
import { getDateYMDString } from 'src/utils/date-utils';
import { IPaginationOptions } from 'src/utils/types/pagination-options';
import { IMockProbability } from '../../utils/interfaces/mock-probability.interface';
import { JaeProfileInterface } from '../interfaces/jae-profile.interface';
import { JaeStopTimesInterface } from '../interfaces/jae-stop-times.interface';
import { JaeValidatorGtfsDataInterface } from '../interfaces/jae-validator-gtfs-data.interface';

@Injectable()
export class JaeDataService implements OnModuleInit {
  private logger: Logger = new Logger('JaeDataService', { timestamp: true });
  private ticketRevenues: ITicketRevenue[] = [];
  private ticketRevenuesArgs = {
    startHour: 6,
    endHour: 12,
    minutesInterval: 60,
    weeks: 4 * 3,
    highDemandProbability: 0.2,
    ticketTransactionValue: 4.3,
    tripsPerLicensee: 1,
    jaeProfiles: [
      {
        // Henrique
        id: 1,
        permitCode: '213890329890312',
        vehiclePlate: 'ABC1234',
        passValidatorId: '19003842273',
        vehicleId: '102373241',
      },
      {
        // Outro usuário
        id: 2,
        permitCode: '319274392832023',
        vehiclePlate: 'GHI8901',
        passValidatorId: '187103490390',
        vehicleId: '102373242',
      },
    ] as JaeProfileInterface[],
    ticketTransactionTypes: [
      {
        id: 1,
        bigqueryName: 'Débito',
        name: 'debit',
        probability: 0.125,
      },
      {
        id: 2,
        name: 'recharge',
        bigqueryName: 'Recarga',
        probability: 0.125,
      },
      {
        id: 98,
        bigqueryName: 'Riocard',
        name: 'riocard',
        probability: 0.125,
      },
      {
        id: 6,
        bigqueryName: 'Bloqueio',
        name: 'blocked',
        probability: 0.125,
      },
      {
        id: 99,
        bigqueryName: 'Botoeria',
        name: 'button',
        probability: 0.125,
      },
      {
        id: 21,
        bigqueryName: 'Gratuidade',
        name: 'free',
        probability: 0.125,
      },
      {
        id: 3,
        bigqueryName: 'Cancelamento',
        name: 'cancelled',
        probability: 0.125,
      },
      {
        id: 4,
        bigqueryName: 'Integração',
        name: 'integration',
        probability: 0.125,
      },
    ] as IMockProbability[],
    ticketPaymentTypes: [
      {
        id: 1,
        bigqueryName: 'Cartão',
        name: 'card',
        probability: 0.33,
      },
      {
        id: 2,
        bigqueryName: 'QRCode',
        name: 'qrcode',
        probability: 0.33,
      },
      {
        id: 3,
        bigqueryName: 'NFC',
        name: 'nfc',
        probability: 0.33,
      },
    ] as IMockProbability[],
    transportIntegrationTypes: [
      {
        id: 3,
        bigqueryName: 'Bu municipal',
        name: 'bu municipal',
        probability: 0.2,
      },
      {
        id: 2,
        bigqueryName: 'Integração',
        name: 'integration',
        probability: 0.2,
      },
      {
        id: 1,
        bigqueryName: 'Transferência',
        name: 'transfer',
        probability: 0.2,
      },
      {
        id: 0,
        bigqueryName: 'Sem integração',
        name: 'no integration',
        probability: 0.2,
      },
      {
        id: 4,
        bigqueryName: 'Bu intermunicipal',
        name: 'bu municipal',
        probability: 0.2,
      },
    ] as IMockProbability[],
  };
  private readonly baseUrlMobilidade = 'https://api.mobilidade.rio';
  private stopTimes: JaeStopTimesInterface[] = [];
  private vehicleData: JaeValidatorGtfsDataInterface[] = [];

  constructor(private readonly httpService: HttpService) {}

  onModuleInit() {
    async () => {
      this.logger.log('onModuleInit(): initializing mocked data');
      await this.updateDataIfNeeded();
    };
  }

  private generateRandomNumber(probabilityHighValue: number): number {
    return Math.random() > probabilityHighValue
      ? Math.floor(Math.random() * 20)
      : 20 + Math.floor(Math.random() * 81);
  }

  private getItemByProbability(probabilities: IMockProbability[]): any {
    const totalWeight = probabilities.reduce(
      (total, object) => total + object.probability,
      0,
    );
    const randomNum = Math.random() * totalWeight;
    let currentPosition = 0;
    let chosenObject: any = null;
    for (const object of probabilities) {
      if (
        randomNum >= currentPosition &&
        randomNum < currentPosition + object.probability
      ) {
        chosenObject = object;
        break;
      }
      currentPosition += object.probability;
    }
    return chosenObject;
  }

  private getTicketRevenuesArgs() {
    return this.ticketRevenuesArgs;
  }

  private async getStopTimes(
    uniqueTrips: number,
  ): Promise<JaeStopTimesInterface[]> {
    let uniqueTripsList: string[] = [];
    try {
      const axiosResponse = await this.httpService.axiosRef.get(
        this.baseUrlMobilidade + '/gtfs/stop_times',
      );
      const stopTimes: JaeStopTimesInterface[] = axiosResponse.data.results;
      uniqueTripsList = [
        ...new Set(stopTimes.map((i: any) => i.trip_id.trip_id)),
      ];
    } catch (error) {
      throw error;
    }
    try {
      const axiosResponse = await this.httpService.axiosRef.get(
        this.baseUrlMobilidade + '/gtfs/stop_times',
        {
          params: {
            tirp_id: uniqueTripsList.slice(0, uniqueTrips).join(','),
          },
        },
      );
      const stopTimes: JaeStopTimesInterface[] = axiosResponse.data.results;
      return stopTimes;
    } catch (error) {
      throw error;
    }
  }

  private async setStopTimes() {
    const { tripsPerLicensee, jaeProfiles } = this.getTicketRevenuesArgs();
    this.stopTimes = await this.getStopTimes(
      jaeProfiles.length * tripsPerLicensee,
    );
  }

  private setTicketRevenues() {
    const now = new Date(Date.now());
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const {
      minutesInterval,
      weeks,
      ticketTransactionValue,
      highDemandProbability,
      startHour,
      endHour,
      jaeProfiles,
      ticketTransactionTypes,
      ticketPaymentTypes,
      transportIntegrationTypes,
    } = this.getTicketRevenuesArgs();
    const ticketRevenues: ITicketRevenue[] = [];
    this.vehicleData = [];
    const uniqueTripsList: string[] = [
      ...new Set(this.stopTimes.map((i) => i.trip_id.trip_id)),
    ];
    const licenseesLength = jaeProfiles.length;
    for (const tripIndex in uniqueTripsList) {
      const licenseeStepIndex = ~~(Number(tripIndex) / licenseesLength);
      const profile = jaeProfiles[licenseeStepIndex];
      const tripId = uniqueTripsList[tripIndex];
      const stopTimes = this.stopTimes
        .filter((i) => i.trip_id.trip_id === tripId)
        .sort((a, b) => a.stop_sequence - b.stop_sequence);
      this.vehicleData.push({
        validador: profile.passValidatorId,
        data: [
          {
            trip: stopTimes[0].trip_id,
            stopTimes: stopTimes,
          },
        ],
      });
      for (let day = 0; day < weeks * 7; day++) {
        let endMinutes = endHour * 60;
        if (day === 0 && endMinutes > nowMinutes) {
          endMinutes = nowMinutes;
        }
        const diffMinutes = endMinutes - startHour * 60;
        const minuteSteps = diffMinutes / minutesInterval;
        const totalMinutes = ~~minuteSteps * minutesInterval;
        if (diffMinutes < 0) {
          continue;
        }
        for (let minuteStep = 0; minuteStep <= minuteSteps; minuteStep++) {
          const stopTimesCycleIndex = minuteStep % stopTimes.length;
          const stopTime = stopTimes[stopTimesCycleIndex];
          const date = new Date(now);
          const currentMinute = minutesInterval * minuteStep;
          const currentHour = Math.floor(currentMinute / 60);
          date.setUTCDate(date.getUTCDate() - day);
          date.setUTCHours(startHour, totalMinutes - currentMinute);
          const newTripIncome: ITicketRevenue = {
            transactionId: ticketRevenues.length.toString(),
            transactionDateTime: date.toISOString(),
            transactionValue: ticketTransactionValue,
            transactionLat: stopTime.stop_id.stop_lat,
            transactionLon: stopTime.stop_id.stop_lon,
            vehicleId: profile.vehicleId,
            permitCode: profile.permitCode,
            transactionType: this.getItemByProbability(ticketTransactionTypes)
              .id,
            paymentMediaType: this.getItemByProbability(ticketPaymentTypes).id,
            transportIntegrationType: this.getItemByProbability(
              transportIntegrationTypes,
            ).id,
            bqDataVersion: '0',
            processingHour: currentHour,
            transportType: this.getItemByProbability(transportIntegrationTypes)
              .id,

            // Not needed fields
            clientId: `${ticketRevenues.length}`,
            stopId: Number(stopTime.stop_id.stop_id),
            integrationId: '0',
            partitionDate: getDateYMDString(date),
            processingDateTime: date.toISOString(),
            captureDateTime: date.toISOString(),
            vehicleService: '0',
            directionId: 0,
            stopLat: stopTime.stop_id.stop_lat,
            stopLon: stopTime.stop_id.stop_lon,
          };
          const transactions = this.generateRandomNumber(highDemandProbability);
          for (let i = 0; i < transactions; i++) {
            ticketRevenues.push({
              ...newTripIncome,
              transactionType: this.getItemByProbability(ticketTransactionTypes)
                .bigqueryName,
              paymentMediaType:
                this.getItemByProbability(ticketPaymentTypes).bigqueryName,
              transportIntegrationType: this.getItemByProbability(
                transportIntegrationTypes,
              ).bigqueryName,
            });
          }
          ticketRevenues.push(newTripIncome);
        }
      }
    }
    this.ticketRevenues = ticketRevenues;
    this.logger.log('setTicketRevenues(): mocked data generated');
  }

  async updateDataIfNeeded() {
    if (this.stopTimes.length === 0) {
      await this.setStopTimes();
      this.logger.debug(
        'updateDataIfNeeded(): generating mocked data - no stopTimes',
      );
      this.setTicketRevenues();
    } else if (this.ticketRevenues.length === 0) {
      this.logger.debug(
        'updateDataIfNeeded(): generating mocked data - no ticketRevenues',
      );
      this.setTicketRevenues();
    } else {
      const now = new Date(Date.now());
      const lastDate = new Date(
        this.ticketRevenues[0].transactionDateTime as string,
      );
      const minutesDifference =
        (now.getTime() - lastDate.getTime()) / (1000 * 60);
      const { minutesInterval, startHour, endHour } =
        this.getTicketRevenuesArgs();
      const currentMinute = now.getUTCHours() * 60 + now.getUTCMinutes();
      if (
        minutesDifference >= minutesInterval &&
        currentMinute >= startHour * 60 &&
        currentMinute <= endHour * 60
      ) {
        this.logger.debug(
          'updateDataIfNeeded(): generating mocked data - time has passed',
        );
        this.setTicketRevenues();
      }
    }
  }
  public async getTicketRevenues(
    args?: IFetchTicketRevenues,
  ): Promise<ITicketRevenue[]> {
    const permitCode = args?.permitCode;
    const startDate = args?.startDate;
    const endDate = args?.endDate;
    const getToday = args?.getToday;

    await this.updateDataIfNeeded();
    const filteredTicketRevenues = this.ticketRevenues.filter((i) => {
      const itemDate = startOfDay(new Date(i.partitionDate));
      const hasPermitCode: boolean = i.permitCode === permitCode;
      const isFromStartDateIfExists: boolean =
        !startDate || itemDate >= startDate;
      const isToEndDateIfExists: boolean = !endDate || itemDate <= endDate;
      const isTodayIfEnabled: boolean = !getToday || isToday(itemDate);
      return (
        hasPermitCode &&
        ((isFromStartDateIfExists && isToEndDateIfExists) || isTodayIfEnabled)
      );
    });
    return filteredTicketRevenues;
  }
  public async getTicketRevenuesMocked(
    pagination?: IPaginationOptions,
  ): Promise<ITicketRevenue[]> {
    await this.updateDataIfNeeded();
    const profiles = this.getTicketRevenuesArgs().jaeProfiles;
    let filteredTicketRevenues = this.ticketRevenues.filter(
      (i) => i.permitCode === profiles[0].permitCode,
    );
    if (pagination) {
      const sliceStart = pagination?.limit * (pagination?.page - 1);
      filteredTicketRevenues = filteredTicketRevenues.slice(
        sliceStart,
        sliceStart + pagination.limit,
      );
    }
    return filteredTicketRevenues;
  }

  public getProfiles() {
    return this.getTicketRevenuesArgs().jaeProfiles;
  }
}
