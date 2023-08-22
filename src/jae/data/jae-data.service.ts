import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { JaeTicketRevenueInterface } from '../interfaces/jae-ticket-revenue.interface';
import { JaeStopTimesInterface } from '../interfaces/jae-stop-times.interface';
import { JaeValidatorGtfsDataInterface } from '../interfaces/jae-validator-gtfs-data.interface';

interface ITimeObj {
  hour: number;
  minute: number;
  second: number;
}

@Injectable()
export class JaeDataService {
  private tripIncomes: JaeTicketRevenueInterface[] = [];
  public ticketRevenuesArgs = {
    startHour: 10,
    endHour: 15,
    minutesInterval: 30,
    weeks: 4 * 3,
    highDemandProbability: 0.2,
    ticketValue: 4.3,
    tripsPerLicensee: 1,
    licenseeProfiles: [
      {
        id: '1',
        autorizacao: '213890329890312',
        placa: 'ABC1234',
        validador: '19003842273',
      },
      {
        id: '2',
        autorizacao: '218302734908664',
        placa: 'DEF4567',
        validador: '18710349009',
      },
    ],
  };
  private readonly baseUrlMobilidade = 'https://api.mobilidade.rio';
  private stopTimes: JaeStopTimesInterface[] = [];
  private vehicleData: JaeValidatorGtfsDataInterface[] = [];

  constructor(private readonly httpService: HttpService) {}

  private generateRandomNumber(probabilityHighValue: number): number {
    return Math.random() > probabilityHighValue
      ? Math.floor(Math.random() * 20)
      : 20 + Math.floor(Math.random() * 81);
  }

  public _getTicketRevenuesArgs() {
    return this.ticketRevenuesArgs;
  }

  public async _getStopTimes(
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

  private getLicensees() {
    return this._getTicketRevenuesArgs().licenseeProfiles;
  }

  private async setStopTimes() {
    const licenseesCount = this.getLicensees().length;
    const tripsPerLicensee = this._getTicketRevenuesArgs().tripsPerLicensee;
    this.stopTimes = await this._getStopTimes(
      tripsPerLicensee * licenseesCount,
    );
  }

  private getTimeObj(
    hour?: number,
    minute?: number,
    second?: number,
  ): ITimeObj {
    const response = {
      hour: hour === undefined ? 0 : hour,
      minute: minute === undefined ? 0 : minute,
      second: second === undefined ? 0 : second,
    } as ITimeObj;
    return response;
  }
  private getTreatedTimeObj(hour = 0, oldTime?: ITimeObj): ITimeObj {
    const timeObj = oldTime || this.getTimeObj();
    if (hour === 24) {
      timeObj.hour = 23;
      timeObj.minute = 59;
      timeObj.second = 59;
    }
    return timeObj;
  }

  private setTicketRevenues() {
    const now = new Date(Date.now());
    const timezoneOffset =
      (now.getHours() - now.getUTCHours()) * 60 +
      (now.getMinutes() - now.getUTCMinutes());
    const {
      minutesInterval,
      weeks,
      startHour,
      ticketValue,
      highDemandProbability,
    } = this._getTicketRevenuesArgs();
    const tripIncomes: JaeTicketRevenueInterface[] = [];
    this.vehicleData = [];
    const uniqueTripsList: string[] = [
      ...new Set(this.stopTimes.map((i) => i.trip_id.trip_id)),
    ];
    const licenseesLength = this.getLicensees().length;
    for (const tripIndex in uniqueTripsList) {
      const licenseeStepIndex = ~~(Number(tripIndex) / licenseesLength);
      const profile = this.getLicensees()[licenseeStepIndex];
      const tripId = uniqueTripsList[tripIndex];
      const stopTimes = this.stopTimes
        .filter((i) => i.trip_id.trip_id === tripId)
        .sort((a, b) => a.stop_sequence - b.stop_sequence);
      this.vehicleData.push({
        passValidatorId: profile.validador,
        data: [
          {
            trip: stopTimes[0].trip_id,
            stopTimes: stopTimes,
          },
        ],
      });
      for (let day = 0; day < weeks * 7; day++) {
        const endHour =
          this._getTicketRevenuesArgs().endHour - ~~timezoneOffset / 60;
        // if (day === 0 && endHour > now.getUTCHours()) {
        //   endHour = now.getUTCHours();
        // }
        const getCurrentMinute = (minuteIndex: number) =>
          endHour * 60 - minutesInterval * minuteIndex;
        for (
          let minuteIndex = 0;
          getCurrentMinute(minuteIndex) >= startHour * 60;
          minuteIndex++
        ) {
          // let endTime = this.getTimeObj(endHour);
          // if (minuteIndex === 0) {
          //   endTime = this.getTreatedTimeObj(endHour, endTime);
          // }
          const stopTimesCycleIndex = minuteIndex % stopTimes.length;
          const stopTime = stopTimes[stopTimesCycleIndex];
          const date = new Date(now);
          const nearestMinute = Math.round(date.getUTCMinutes() / 10) * 10;
          date.setUTCDate(date.getUTCDate() - day);
          date.setUTCHours(
            endHour,
            nearestMinute - minutesInterval * minuteIndex,
            0,
            0,
          );
          const newTripIncome: JaeTicketRevenueInterface = {
            codigo: tripIncomes.length,
            dataHora: date.toISOString(),
            latitude: stopTime.stop_id.stop_lat,
            longitude: stopTime.stop_id.stop_lon,
            placa: profile.placa,
            validador: profile.validador,
            valor: ticketValue,
            transacoes: this.generateRandomNumber(highDemandProbability),
          };
          tripIncomes.push(newTripIncome);
        }
      }
    }
    this.tripIncomes = tripIncomes;
  }

  private async updateDataIfNeeded() {
    if (this.stopTimes.length === 0) {
      await this.setStopTimes();
      this.setTicketRevenues();
    } else if (this.tripIncomes.length === 0) {
      this.setTicketRevenues();
    } else {
      const now = new Date(Date.now());
      const lastDate = new Date(this.tripIncomes[0].dataHora);
      const minutesDifference =
        (now.getTime() - lastDate.getTime()) / (1000 * 60);
      const { minutesInterval, startHour, endHour } =
        this._getTicketRevenuesArgs();
      if (
        minutesDifference >= minutesInterval &&
        now.getHours() >= startHour &&
        now.getHours() <= endHour
      ) {
        this.setTicketRevenues();
      }
    }
  }

  public async getTicketRevenuesByValidator(
    passValidatorId: string,
  ): Promise<string> {
    await this.updateDataIfNeeded();
    const filteredTripIncomes = this.tripIncomes.filter(
      (i) => i.validador === passValidatorId,
    );
    return JSON.stringify({ data: filteredTripIncomes });
  }

  public async getGtfsDataByValidator(
    passValidatorId: string,
  ): Promise<string> {
    await this.updateDataIfNeeded();
    const filteredTicketRevenue = this.vehicleData.filter(
      (i) => i.passValidatorId === passValidatorId,
    );
    return JSON.stringify({ data: filteredTicketRevenue });
  }

  public getProfiles() {
    return this._getTicketRevenuesArgs().licenseeProfiles;
  }
}
