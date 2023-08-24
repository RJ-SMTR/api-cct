import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { JaeTicketRevenueInterface } from '../interfaces/jae-ticket-revenue.interface';
import { JaeStopTimesInterface } from '../interfaces/jae-stop-times.interface';
import { JaeValidatorGtfsDataInterface } from '../interfaces/jae-validator-gtfs-data.interface';
import { JaeProfileInterface } from '../interfaces/jae-profile.interface';

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
    jaeProfiles: [
      {
        id: 1,
        permitCode: '213890329890312',
        plate: 'ABC1234',
        passValidatorId: '19003842273',
      },
      {
        id: 2,
        permitCode: '218302734908664',
        plate: 'DEF4567',
        passValidatorId: '18710349009',
      },
    ] as JaeProfileInterface[],
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
      ticketValue,
      highDemandProbability,
      startHour,
      endHour,
      jaeProfiles,
    } = this.getTicketRevenuesArgs();
    const tripIncomes: JaeTicketRevenueInterface[] = [];
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
            id: tripIncomes.length,
            dateTime: date.toISOString(),
            lat: stopTime.stop_id.stop_lat,
            lon: stopTime.stop_id.stop_lon,
            plate: profile.plate,
            passValidatorId: profile.passValidatorId,
            amount: ticketValue,
            transactions: this.generateRandomNumber(highDemandProbability),
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
      const lastDate = new Date(this.tripIncomes[0].dateTime);
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
  ): Promise<JaeTicketRevenueInterface[]> {
    await this.updateDataIfNeeded();
    const filteredTripIncomes = this.tripIncomes.filter(
      (i) => i.passValidatorId === passValidatorId,
    );
    return filteredTripIncomes;
  }

  public getProfiles() {
    return this.getTicketRevenuesArgs().jaeProfiles;
  }
}
