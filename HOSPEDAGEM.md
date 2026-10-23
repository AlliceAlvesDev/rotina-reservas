# Acesso pelo navegador

Somente o servidor precisa executar Python. Usuários acessam pelo navegador e não instalam Python nem o aplicativo em seus computadores.

## Hospedagem com Docker

No servidor escolhido, com Docker instalado, execute a partir da pasta do projeto:

```sh
docker build -t rotina-reservas .
docker run -d --name rotina-reservas --restart unless-stopped -p 127.0.0.1:8501:8501 rotina-reservas
docker inspect --format '{{.State.Health.Status}}' rotina-reservas
```

Aguarde o estado `healthy`. O serviço fica ligado à interface local do servidor. Configure o proxy reverso da empresa para encaminhar o endereço de acesso à porta 8501, com suporte a WebSocket. Use HTTPS e o mecanismo de autenticação da empresa para acesso remoto. A aplicação não inclui login próprio; escolha o servidor e o controle de acesso antes de expô-la na internet.

Em provedores de contêiner, use este Dockerfile e configure a porta de destino 8501. Se a plataforma fornecer a variável `PORT`, ela será respeitada. Não monte diretórios de planilhas: o aplicativo processa uploads em memória, sem gravá-los intencionalmente em disco. O servidor de hospedagem recebe os arquivos; isso não é processamento apenas no navegador. Políticas de retenção da infraestrutura devem ser verificadas com o responsável pelo servidor.

## Validação após publicar

Verifique o healthcheck e acesse o endereço HTTPS configurado. Envie duas planilhas de teste sem dados reais, confira os pedidos somente em cada lado e baixe o ZIP e a mensagem. Repita a validação no navegador de uma máquina usuária. Não use os arquivos privados do desenvolvimento como exemplos públicos.

Preparar os arquivos de hospedagem não cria um endereço público. O servidor ou provedor, a conta de implantação e o endereço ainda precisam ser definidos.
