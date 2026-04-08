# Testes de Carga (Load Tests) 🚀

Este diretório contém a infraestrutura necessária para a execução de testes de carga e estresse utilizando **Docker Compose** e **Artillery**.

## Cenários Implementados

Os testes estão localizados na pasta `load-tests/` e utilizam o Artillery para simular tráfego real:

- **Login Scenario** (`login-scenario.yml`): Simula múltiplos usuários realizando login simultaneamente através do gateway para validar a capacidade de autenticação sob pressão.
- **Idempotency Scenario** (`idempotency-scenario.yml`): Valida comportamentos de idempotência, cache e consumo de mensagens por workers com replicas, em requisições de criação de usuários. Criar usuários gera mensagens para serem consumidas pelos workers. O objetivo é testar se o balcneamento entre as réplicas esta ocorrendo e se não existe comportamento de corrida entre as réplicas.

## Mecanismos de Load Balancing ⚖️

Para garantir a alta disponibilidade e distribuição de carga entre as múltiplas instâncias dos serviços, o ambiente utiliza dois mecanismos principais:

### 1. Traefik (HTTP Load Balancing)
O **Traefik** atua como o gateway de entrada e utiliza um algoritmo **Round-Robin** para distribuir as requisições HTTP entre as réplicas do `backend-api`.
- Quando múltiplas instâncias do backend estão ativas, o Traefik detecta automaticamente os novos containers e os adiciona ao pool de balanceamento.
- Cada nova requisição é direcionada para o próximo backend disponível na lista, garantindo uma distribuição equitativa do processamento.

### 2. RabbitMQ (Worker Load Balancing)
A distribuição de tarefas entre as réplicas dos **workers** é gerenciada pelo próprio **RabbitMQ**.
- O RabbitMQ distribui as mensagens da fila entre os workers conectados utilizando o conceito de **Competing Consumers**.
- Isso implementa um comportamento de **Round-Robin** no nível de mensagens: cada worker processa uma mensagem por vez, e o RabbitMQ entrega a próxima mensagem da fila para o primeiro worker que estiver disponível (ou seguindo a ordem de conexão se todos estiverem livres), evitando sobrecarga em uma única instância.

## Pré-requisitos

1. Docker e Docker Compose instalados.
2. Node.js e pnpm para instalar o Artillery (opcional se rodar via scripts do root).

## Comandos de Execução

### 1. Subir o Ambiente de Teste

Antes de rodar os testes, é necessário subir a stack completa (Backend, Frontend, Worker, DB, Redis, etc.) otimizada para o teste de carga:

```bash
# Na raiz do projeto
pnpm run docker:up:test-load
```

Este comando utiliza o arquivo `docker/test-load/docker-compose-test-load.yml` para orquestrar os containers e o Traefik como gateway no endereço http://localhost:8081.

### 2. Executar os Testes

Com o ambiente de pé, você pode executar os cenários individualmente a partir da raiz do projeto:

```bash
# Executar teste de login
pnpm run test:load:login

# Executar teste de idempotência
pnpm run test:load:idempotency
```

### 3. Gerar Relatórios

Para gerar um relatório HTML detalhado da execução:

```bash
pnpm run test:load:report
```

Os resultados serão salvos em `load-tests/report.json` e o relatório visual será gerado em seguida.

## Estrutura do Ambiente

- **Gateway (Traefik)**: http://localhost:8081
- **Backend**: Escalonado via Docker Compose para lidar com carga.
- **Payloads**: Dados de teste (como usuários) estão em `load-tests/data/users.csv`.

## Encerrar o Ambiente

Para limpar os recursos e parar os containers:

```bash
pnpm run docker:down:test-load
```
