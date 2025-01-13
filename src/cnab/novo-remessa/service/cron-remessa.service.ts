import { Injectable } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule/dist/scheduler.registry";

import { CronJob, CronJobParameters } from "cron";
import { CustomLogger } from "src/utils/custom-logger";
import { OrdemPagamentoAgrupadoService } from "./ordem-pagamento-agrupado.service";
import { RemessaService } from "./remessa.service";


interface ICronJob {
    name: string;
    cronJobParameters: CronJobParameters;
}


/**
 * CronJob tasks and management
 */
@Injectable()
export class CronRemessaService {
    private logger = new CustomLogger(CronRemessaService.name, { timestamp: true });

    public jobsConfig: ICronJob[] = [];

    constructor(
        private schedulerRegistry: SchedulerRegistry,
        private ordemPagamentoAgrupadoService: OrdemPagamentoAgrupadoService,
        private remessaService: RemessaService
    ) { }

    async onModuleLoad() {

       //Todo: Definir dia/hora     
       this.jobsConfig.push({      
        name: "AgrupamentoOrdensPagamento",cronJobParameters: {cronTime: '0 6 * * *',onTick: async () => this.agrupamentoOrdensPagamento()},
       });

       this.jobsConfig.push({      
        name: "VLT",cronJobParameters: {cronTime: '0 7 * * *',onTick: async () => this.geracaoRemessaVLT()},
       });
       
       //Todo: Definir dia/hora
       this.jobsConfig.push({      
        name: "Consorcios",cronJobParameters: {cronTime: '0 7 * * *',onTick: async () => this.geracaoRemessaConsorcios()},
       });

       //Todo: Definir dia/hora
       this.jobsConfig.push({      
        name: "Vans",cronJobParameters: {cronTime: '0 7 * * *',onTick: async () => this.geracaoRemessaVans()},
       });

       this.executeJobs();
    }

    //Agru
    //TODO: Definir dia e Hora para rodar
    private async agrupamentoOrdensPagamento(){
        const dataInicial = new Date()
        const dataFinal = new Date()
        const dataPagamento = new Date()
        this.ordemPagamentoAgrupadoService.prepararPagamentoAgrupados(dataInicial,dataFinal,dataPagamento,"cett");
    }

    private async geracaoRemessaVLT(){
        const dataInicial = new Date()
        const dataFinal = new Date()       
        this.remessaService.prepararRemessa(dataInicial, dataFinal,["VLT"]) //preparação remessa
        const list = await this.remessaService.gerarCnabText(new Date()) //Adicionar data pagamento - geração txt
        this.remessaService.enviarRemessa(list) //envio
    }

    private async geracaoRemessaConsorcios(){

    }

    private async geracaoRemessaVans(){
    }


    executeJobs(){
        for (const jobConfig of this.jobsConfig) {
            this.startCron(jobConfig);
            this.logger.log(`Tarefa agendada: ${jobConfig.name}, ${jobConfig.cronJobParameters.cronTime}`);
        }
    }

    private startCron(jobConfig: ICronJob) {
        const job = new CronJob(jobConfig.cronJobParameters);
        this.schedulerRegistry.addCronJob(jobConfig.name, job);
        job.start();
    }


    configVLT(){

    }

    configConsorcios(){
        
    }

    configVan(){
        
    }

}