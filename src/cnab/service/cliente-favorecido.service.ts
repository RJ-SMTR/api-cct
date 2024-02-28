import { UsersService } from 'src/users/users.service';
import { ClienteFavorecido } from './../entitys/cliente-favorecido.entity';

class ClienteFavorecidoService{

    private clienteFavorecido: ClienteFavorecidoRepository;

    private userService: UsersService;

    function insertClienteFavorecido(){
         
       // userService.get

        for{
        //veirificar se o usuario já existe na base
            ClienteFavorecido.findByCpfCnj(cpf_cnpj);

            
            // de/para  ->  user / Cliente   
            
            //se não existir 

            clienteFavorecido.insere();

            //Se exitir 
            ClienteFavorecido.atualiza();
        }
    } 

}