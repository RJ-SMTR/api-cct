
class TransacaoService{


    private transacoesRepository: TransacoesRepository;

    private itemTransacaoRepository: ItemTransacoesRepository;

    private clienteFavorecidoService: ClienteFavorecidoService;

    private pagadorService: PagadorService;

    function insereTransacoes(){
        //metodo de inserir cliente Favorecido
       var listaCliente = clienteFavorecidoService.insere(); 
        //TransacoesFernanda buscar
       var transacoesFernanda = buscar;    
    
       //percorrer todas a transações e inserir na tabela transacao
       for(transacaoFernada :  transacoesFernanda) {         

        //metodo de consultar o pagador
        var pagador = pagadorService.getPagador(2):Pagador;
        transacao.idPagador = idPagador;
        transacao.nome = transacaoFernanda.nome;  
        //preencher o objeto transacao e inserir na base (id_pagador parte desse obj)

          var id_transacao = transacoesRepository.insert(transacao)

          //buscar todas as ordens de pagamento por idTransacaoFernanda 
          var ordensPgto = buscarOrder(transacaoFernada.idTransacaoFernanda);
          for(ordemPgto:ordensPgto){

             var id_cliente_favorecido = listaCliente.findByCPFCNPJ(ordemPgto.cpf_enpj);
             itemTransacao.id_cliente_favorecido =  id_cliente_favorecido;
             //insere o item detalhamento
             itemTransacao.id_transacao = id_transacao;
             itemTransacao.idClientFavorecido = idClienteFavorecido;
             itemTransacao.dt_transacao = ordemPgto.dt_transacao;

             itemTransacaoRepository.insere(itemTransacao);
          }        
      
       }

    }
}
