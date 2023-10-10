import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JaeTicketRevenueInterface } from '../interfaces/jae-ticket-revenue.interface';
import { JaeStopTimesInterface } from '../interfaces/jae-stop-times.interface';
import { JaeValidatorGtfsDataInterface } from '../interfaces/jae-validator-gtfs-data.interface';
import { JaeProfileInterface } from '../interfaces/jae-profile.interface';
import { IPaginationOptions } from 'src/utils/types/pagination-options';

interface ProbabilityInterface {
  name: string | null;
  probability: number;
  bigqueryName: string | null;
  id: number;
}

@Injectable()
export class JaeDataService implements OnModuleInit {
  private logger: Logger = new Logger('JaeDataService', { timestamp: true });
  private ticketRevenues: JaeTicketRevenueInterface[] = [];
  private ticketRevenuesArgs = {
    startHour: 13,
    endHour: 18,
    minutesInterval: 30,
    weeks: 4 * 3,
    highDemandProbability: 0.2,
    ticketTransactionValue: 4.3,
    tripsPerLicensee: 1,
    jaeProfiles: [
      {
        id: 2,
        permitCode: 'permitCode_mock',
        vehiclePlate: 'GHI8901',
        passValidatorId: '187103490390',
        vehicleOrderNumberId: 102373242,
      },
      {
        id: 1,
        permitCode: '213890329890312',
        vehiclePlate: 'ABC1234',
        passValidatorId: '19003842273',
        vehicleOrderNumberId: 102373241,
      },
    ] as JaeProfileInterface[],
    ticketTransactionTypes: [
      {
        name: 'full',
        probability: 0.6,
        bigqueryName: 'inteira',
        id: 1,
      },
      {
        name: 'half',
        probability: 0.2,
        bigqueryName: 'meia',
        id: 2,
      },
      {
        name: 'free',
        probability: 0.2,
        bigqueryName: 'gratuidade',
        id: 3,
      },
    ] as ProbabilityInterface[],
    ticketPaymentMediaTypes: [
      {
        name: 'phone',
        probability: 0.8,
        bigqueryName: 'telefone',
        id: 1,
      },
      {
        name: 'card',
        probability: 0.2,
        bigqueryName: 'cartao',
        id: 2,
      },
    ] as ProbabilityInterface[],
    transportIntegrationTypes: [
      {
        name: null,
        probability: 0.5,
        bigqueryName: null,
        id: 1,
      },
      {
        name: 'van',
        probability: 0.3,
        bigqueryName: 'van',
        id: 2,
      },
      {
        name: 'bus_supervia',
        probability: 0.2,
        bigqueryName: 'supervia',
        id: 3,
      },
    ] as ProbabilityInterface[],
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

  private getItemByProbability(probabilities: ProbabilityInterface[]): any {
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
      ticketPaymentMediaTypes,
      transportIntegrationTypes,
    } = this.getTicketRevenuesArgs();
    const ticketRevenues: JaeTicketRevenueInterface[] = [];
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
          date.setUTCDate(date.getUTCDate() - day);
          date.setUTCHours(startHour, totalMinutes - currentMinute);
          const newTripIncome: JaeTicketRevenueInterface = {
            id: ticketRevenues.length,
            transactionDateTime: date.toISOString(),
            transactionValue: ticketTransactionValue,
            transactionLat: stopTime.stop_id.stop_lat,
            transactionLon: stopTime.stop_id.stop_lon,
            vehicleOrderNumberId: profile.vehicleOrderNumberId,
            permitCode: profile.permitCode,

            // Not needed fields
            clientId: `${ticketRevenues.length}`,
            stopId: stopTime.stop_id.stop_id,
            integrationId: 0,
            individualIntegrationId: 0,
            dateIndex: date.toISOString(),
            processingDateTime: date.toISOString(),
            captureDateTime: date.toISOString(),
            vehicleService: 0,
            directionId: 0,
            stopLat: stopTime.stop_id.stop_lat,
            stopLon: stopTime.stop_id.stop_lon,
          };
          const transactions = this.generateRandomNumber(highDemandProbability);
          for (let i = 0; i < transactions; i++) {
            ticketRevenues.push({
              ...newTripIncome,
              transactionType: this.getItemByProbability(ticketTransactionTypes)
                .name,
              paymentMediaType: this.getItemByProbability(
                ticketPaymentMediaTypes,
              ).name,
              transportIntegrationType: this.getItemByProbability(
                transportIntegrationTypes,
              ).name,
            });
          }
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
      const lastDate = new Date(this.ticketRevenues[0].transactionDateTime);
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
  public async getTicketRevenuesByPermitCode(
    permitCode?: string,
  ): Promise<JaeTicketRevenueInterface[]> {
    await this.updateDataIfNeeded();
    const filteredTicketRevenues = this.ticketRevenues.filter(
      (i) => i.permitCode === permitCode,
    );
    return filteredTicketRevenues;
  }
  public async getTicketRevenuesMocked(
    pagination?: IPaginationOptions,
  ): Promise<JaeTicketRevenueInterface[]> {
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
