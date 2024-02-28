class TransacaoListener{
     
    private transacaoService:TransacaoService;

    //rodar as 09:00 e as 14:00 
    function JobTransaction(){
        transacaoService.insereTransacoes();
    }

}