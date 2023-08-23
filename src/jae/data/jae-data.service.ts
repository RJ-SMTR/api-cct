import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { JaeTicketRevenueInterface } from '../interfaces/jae-ticket-revenue.interface';
import { JaeStopTimesInterface } from '../interfaces/jae-stop-times.interface';
import { JaeValidatorGtfsDataInterface } from '../interfaces/jae-validator-gtfs-data.interface';

@Injectable()
export class JaeDataService {
  private tripIncomes: JaeTicketRevenueInterface[] = [];
  private ticketRevenuesArgs = {
    startHour: 13,
    endHour: 18,
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

  private getLicensees() {
    return this.getTicketRevenuesArgs().licenseeProfiles;
  }

  private async setStopTimes() {
    const licenseesCount = this.getLicensees().length;
    const tripsPerLicensee = this.getTicketRevenuesArgs().tripsPerLicensee;
    this.stopTimes = await this.getStopTimes(tripsPerLicensee * licenseesCount);
  }

  private setTicketRevenues() {
    const now = new Date(Date.now());
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const {
      minutesInterval,
      weeks,
      ticketValue,
      highDemandProbability,
      startHour,
      endHour,
    } = this.getTicketRevenuesArgs();
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
        validador: profile.validador,
        data: [
          {
            trip: stopTimes[0].trip_id,
            stopTimes: stopTimes,
          },
        ],
      });
      for (let day = 0; day < weeks * 7; day++) {
        let endMinutes = endHour * 60;
        // let currentEndHour = endHour;
        if (day === 0 && endMinutes > nowMinutes) {
          endMinutes = nowMinutes;
          // currentEndHour = now.getUTCHours();
        }
        const diffMinutes = endMinutes - startHour * 60;
        const minuteSteps = diffMinutes / minutesInterval;
        const totalMinutes = ~~minuteSteps * minutesInterval;
        // if (startHour === 6 && day < 2 && tripIndex == '0') {
        //   console.log(`day: ${day}, index:${tripIndex}, diff: ${diffMinutes}`
        //   + `, steps: ${minuteSteps}, totalMin: ${totalMinutes}, start: ${startHour*60}`
        //   + `, end: ${endMinutes}`)
        // }
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
          // if (startHour === 6 && minuteStep < 4 && day <2 && tripIndex == '0') {
          //   console.log(`step: ${minuteStep}/${minuteSteps}, date: ${date.toUTCString()}`)
          // }
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
        this.getTicketRevenuesArgs();
      const currentMinute = now.getUTCHours() * 60 + now.getUTCMinutes();
      if (
        minutesDifference >= minutesInterval &&
        currentMinute >= startHour * 60 &&
        currentMinute <= endHour * 60
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
      (i) => i.validador === passValidatorId,
    );
    return JSON.stringify({ data: filteredTicketRevenue });
  }

  public getProfiles() {
    return this.getTicketRevenuesArgs().licenseeProfiles;
  }
}
