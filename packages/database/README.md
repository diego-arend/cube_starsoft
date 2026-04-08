# @turborepo/database

## Propósito

Suporte compartilhado de banco de dados para o monorepo. Este pacote centraliza a conectividade com o banco e a integração com o TypeORM para aplicações NestJS.

## O que fornece

- `DatabaseModule` — um módulo global do NestJS com duas helpers:
  - `forRoot()` — configura o TypeORM usando a configuração tipada de `@turborepo/config`.
  - `forFeature(entities)` — helper para registrar repositórios TypeORM para um conjunto de entidades.
- `DatabaseLifecycleService` — hooks de ciclo de vida para gerenciar startup/shutdown das conexões com o BD.
- Entidades, repositórios, DTOs e interfaces usados comumente pelas apps do workspace (ex.: entidade `User`, `Document`, base repository).
- Schemas Zod e DTOs compartilhados: `UserPublicSchema`, `OffsetPaginationSchema`, `CreateUserSchema`, etc.
- Utilitários CLI e scripts de migração

---

O pacote inclui scripts para gerenciar o esquema do banco de dados:

- `pnpm run migrate:generate` — gera uma nova migration baseada nas mudanças das entidades.
- `pnpm run migrate:run` — aplica as migrations pendentes.
- `pnpm run seed:users` — popula o banco com dados iniciais.

**Configuração para CLI**:
Diferente do tempo de execução (onde o `Backend` injeta as configurações), os scripts de CLI dependem de um arquivo `.env` local no diretório `packages/database/`.

- Este arquivo é gerado automaticamente pelo comando `pnpm generate-envs` na raiz do monorepo (ou via `pnpm build`/`pnpm dev`).
- O `data-source.ts` carrega automaticamente esse arquivo, garantindo que as migrations funcionem de forma isolada, inclusive em containers de produção.

## Padrão de providers & tokens (genérico)

- Resumo do padrão: ao expor repositórios a partir de um módulo compartilhado, frequentemente registramos um **token em tempo de execução** (um `Symbol` ou string) que representa a _abstração_ do repositório (interface). O módulo também registra a implementação concreta do repositório e a associa ao token.

- Por que usar este padrão?
  - **Abstração & testabilidade**: consumidores podem depender do token + interface (p.ex., `IUserRepository`) e os testes podem `overrideProvider` do token com um mock facilmente.
  - **Compatibilidade com código existente**: registrar a classe concreta com `useExisting` apontando para o token garante que código que injeta a classe continue funcionando sem criar múltiplas instâncias.
  - **Comportamento singleton**: providers do Nest são singletons por padrão — a factory que cria o repositório é executada uma vez e a mesma instância é reutilizada.

- Como geralmente é registrado (conceitual):

```ts
// providers no módulo de feature
providers: [
  {
    provide: ENTITY_REPOSITORY_TOKEN, // Symbol('ENTITY_REPOSITORY')
    useFactory: (repo) => new ConcreteEntityRepository(repo),
    inject: [getRepositoryToken(Entity)],
  },
  {
    provide: ConcreteEntityRepository,
    useExisting: ENTITY_REPOSITORY_TOKEN, // reusa a mesma instância
  },
];
```

- Exemplos de injeção (genéricos):

```ts
// preferido: depender da abstração (token + interface)
constructor(@Inject(ENTITY_REPOSITORY_TOKEN) private repo: IEntityRepository) {}

// compatibilidade: injetar a classe concreta diretamente
constructor(private repo: ConcreteEntityRepository) {}
```

- Notas de teste / mocking:
  - Use `overrideProvider(ENTITY_REPOSITORY_TOKEN)` em testes para trocar por um mock; já que a classe concreta usa `useExisting`, a sobrescrita afeta tanto a injeção por token quanto por classe.
  - Se precisar de um repositório por-request ou scoped (raro), prefira obter repositórios via `manager.getRepository(...)` dentro de código transacional, ao invés de alterar o escopo global do provider.

## Adicionar uma nova entidade (padrão mínimo)

Abaixo está um padrão mínimo prático para adicionar **Entity**, **DTOs/Schemas**, **Repository** e registrar o token/provider no `DatabaseModule`.

1. Entidade (ex.: `OrderEntity`)

```ts
import { Entity, Column, PrimaryColumn, BeforeInsert } from "typeorm";
import { v7 as uuidv7 } from "uuid";

@Entity("orders")
export class OrderEntity {
  @PrimaryColumn()
  id!: string;

  @Column()
  status!: string;

  @Column("jsonb", { nullable: true })
  payload?: Record<string, unknown>;

  @BeforeInsert()
  private beforeInsert() {
    if (!this.id) this.id = uuidv7();
  }
}
```

2. DTO / Schema (Zod + types)

```ts
import { z } from "zod";

export const CreateOrderSchema = z.object({
  payload: z.record(z.unknown()),
});
export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;

export const OrderPublicSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  payload: z.record(z.unknown()).optional(),
});
export type OrderPublicDto = z.infer<typeof OrderPublicSchema>;
```

3. Repositório mínimo + token

```ts
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OrderEntity } from "../entities/order.entity";
import { BaseRepository } from "./base.repository";

export const ORDER_REPOSITORY = Symbol("ORDER_REPOSITORY");

export interface IOrderRepository {
  save(entity: Partial<OrderEntity>, manager?: any): Promise<OrderEntity>;
  findAll(): Promise<OrderPublicDto[]>;
}

export class OrderRepository
  extends BaseRepository<OrderEntity, OrderPublicDto>
  implements IOrderRepository
{
  constructor(@InjectRepository(OrderEntity) repo: Repository<OrderEntity>) {
    super(repo);
  }

  async save(entity: Partial<OrderEntity>, manager?: any) {
    // aceita optional EntityManager para compatibilidade com transações
    const repo = manager ? manager.getRepository(OrderEntity) : this.repo;
    return repo.save(entity as any);
  }
}
```

4. Registrar provider no `DatabaseModule.forFeature([...])`

```ts
// dentro do DatabaseModule.forFeature
providers.push({
  provide: ORDER_REPOSITORY,
  useFactory: (repo: Repository<OrderEntity>) => new OrderRepository(repo),
  inject: [getRepositoryToken(OrderEntity)],
});
providers.push({
  provide: OrderRepository,
  useExisting: ORDER_REPOSITORY as any,
});
```

5. Injeção e uso (ex.: `OrderService`)

```ts
import { Inject } from "@nestjs/common";
import type { IOrderRepository } from "@turborepo/database";
import { ORDER_REPOSITORY } from "@turborepo/database";

@Injectable()
export class OrderService {
  constructor(@Inject(ORDER_REPOSITORY) private repo: IOrderRepository) {}

  async create(data: CreateOrderDto) {
    return this.repo.save({ ...data, status: "pending" });
  }
}
```

## Política de localização de DTOs e repositórios

- Para manter **uma fonte única de verdade**, as entidades devem incluir seus **DTOs/schemas (p.ex. Zod)** e os **repositórios** correspondentes dentro do pacote `@turborepo/database`.
- Módulos de feature (ex.: `apps/backend/src/user`, `apps/backend/src/document`) **devem importar** tipos, schemas e tokens do `@turborepo/database` em vez de duplicá-los localmente. Isso evita divergências entre validação, serialização e persistência.
- Exporte sempre os DTOs/schemas e tokens do `packages/database/src/index.ts` para facilitar consumo, por exemplo:

```ts
export * from "./dto/document.dto";
export { DOCUMENT_REPOSITORY } from "./repositories/document.repository";
```

- Benefícios: consistência, menor duplicação, testes mais simples (mocks via token) e documentação / OpenAPI mais previsível.

Dicas rápidas

- Garanta que os métodos que podem participar de transações aceitem um `EntityManager?` opcional.
- Exporte o token e a classe do pacote (`index.ts`) se quiser que consumidores os importem diretamente.

## Configuração

- As configurações de conexão com o banco vêm do `@turborepo/config` (chaves em estilo env como `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD` e `DATABASE_NAME`).
- O pacote intencionalmente depende da configuração centralizada e não expõe opções avançadas do TypeORM; apps que precisarem de configuração TypeORM específica devem prover seu próprio módulo TypeORM ou estender o pacote internamente.

## Scripts de migração e manutenção

- O pacote expõe scripts para gerar e aplicar migrations; use estes scripts em CI ou no desenvolvimento local para gerenciar evolução do esquema.
- Os arquivos de migration ficam em `packages/database/src/migrations` e são versionados no controle de fonte.

**Gerar e aplicar a migration para a tabela `documents`**

1. Gerar uma migration (local/CI):

```bash
pnpm run migrate:generate "Create documents table"
```

Isto irá criar um arquivo em `packages/database/src/migrations/<name>` com a migration gerada.

2. Aplicar/run migrations (local/CI):

```bash
pnpm run migrate:run
```

Isto aplica todas as migrations pendentes usando o `data-source.ts` configurado para o ambiente.

> Observação: já incluí uma migration de exemplo para a tabela `documents` em `packages/database/src/migrations/20251217_create_documents.ts`. Revise o arquivo e, se necessário, gere uma nova migration via `pnpm run migrate:generate` se você mudar a entidade.

Nota: o helper `migrate:generate` executa o CLI do TypeORM via `ts-node` para carregar o `data-source.ts` em TypeScript e escrever a migration em `packages/database/src/migrations` (ele remove flags do pnpm como `--silent` do nome fornecido).

## Migrações automáticas no startup da app

- Executar migrations automaticamente na inicialização da aplicação está desativado por padrão. Isso mantém ambientes determinísticos (especialmente produção) e evita alterações acidentais no esquema que devem ser controladas via CI/CD.
- A instalação automática de extensões do Postgres (ex.: `uuid-ossp`, `pgcrypto`, `vector`) também é desativada em tempo de execução para evitar necessidade de privilégios elevados; isso é controlado via `installExtensions: false` na configuração.
- Se precisar rodar migrations no startup (não recomendado em produção), defina a variável `DATABASE_MIGRATIONS_RUN=true` ou configure `database.migrations_run: true` no `config.yaml`.

## Observações & restrições

- Este pacote depende do TypeORM e do driver Postgres; peer dependencies incluem NestJS e pacotes do TypeORM.
- Evite acessar `process.env` diretamente para configurações do BD — prefira os valores centralizados de `@turborepo/config`.
- Se uma aplicação precisa de uma configuração TypeORM não padrão, prefira gerenciar seu próprio módulo TypeORM em vez de alterar o comportamento do pacote compartilhado.
- IDs: a geração de UUID v7 é realizada na aplicação (sem dependência de extensão do BD) usando a biblioteca oficial `uuid` (v11+). Um gerador interno foi removido para confiar na biblioteca mantida upstream, garantindo conformidade com a especificação e correções de segurança.

## Decorator `@Transactional` (guia detalhado de uso)

O pacote fornece um decorador `@Transactional()` que executa o método dentro de uma transação TypeORM usando `AppDataSource`. O decorador injeta um `EntityManager` no método decorado (por padrão como último argumento), permitindo que o corpo do método execute operações de repositório dentro do contexto transacional.

## Notas de implementação importantes (evite armadilhas comuns)

- O decorador **não** faz automaticamente com que instâncias singleton de repositórios participem da transação. Se um repositório singleton chamar `this.repo.save(...)` (o repositório vinculado ao manager padrão), essas chamadas não usarão o `EntityManager` da transação.
- Para garantir que operações participem da transação, implemente métodos de repositório que recebam um `EntityManager?` opcional e usem `manager.getRepository(Entity)` quando `manager` for fornecido.
- Nunca armazene um `EntityManager` ou `QueryRunner` como estado em um provider singleton — passe-o explicitamente nos calls.

## Padrão recomendado para repositório

```ts
// no repositório
async save(entity: Partial<UserEntity>, manager?: EntityManager) {
  const repo = manager ? manager.getRepository(UserEntity) : this.repo;
  return repo.save(entity);
}
```

## Paginação (offset)

Este pacote agora fornece utilitários para paginação por offset usados por repositórios e serviços:

- `DEFAULT_LIMIT = 20`, `MAX_LIMIT = 100` — defaults aplicados automaticamente.
- `OffsetPaginationSchema` (Zod) — validador/coercer para query params: `page`, `limit`, `sort`, `order`.
- `PaginationOptions` — tipo usado internamente pelos repositórios (`page`, `limit`, `skip`, `take`, `order`).
- `PaginatedResult<T>` — formato retornado pelos repositórios: `{ data: T[], meta: { total, page, limit, pages }}`.

Exemplo de uso no repositório (impl. já disponível em `BaseRepository.findPaginated`):

```ts
const res = await repo.findPaginated({
  page: 2,
  limit: 25,
  order: { createdAt: "DESC" },
});
// res => { data: [...], meta: { total: 123, page: 2, limit: 25, pages: 5 } }
```

Já existem implementações de exemplo:

- `DocumentRepository.findPublicByOwnerPaginated(ownerId, opts)`
- `UserRepository.findAllPaginated(opts)`

Recomenda-se validar `sort`/`order` em nível de serviço antes de passá-los ao repositório para evitar injeção de campos maliciosos.
Uso recomendado no serviço com `@Transactional`

---

```ts
import { Transactional } from "@turborepo/database";
import type { EntityManager } from "typeorm";

@Injectable()
class UserService {
  constructor(private userRepo: UserRepository) {}

  @Transactional()
  async createUser(payload: CreateUserDto, manager?: EntityManager) {
    // passe o manager para os repositórios para que usem o contexto transacional
    const user = await this.userRepo.save(payload, manager);
    await this.outboxRepo.save(
      { type: "USER_CREATED", payload: user },
      manager
    );
    return user;
  }
}
```

## Dicas de teste

- Testes unitários: mocke métodos de repositório e verifique que são chamados com o `manager` fornecido ao testar métodos transacionais. Alternativamente, invoque os métodos do repositório passando um `EntityManager` falso/mock.
- Testes de integração: execute o método decorado com `@Transactional()` e verifique que o estado do BD é efetivamente commitado/rollbackado como esperado.

## Quando usar providers scope

- Se precisar que um provider mantenha estado por request (raro), use `scope: Scope.REQUEST`. Use isso somente quando necessário — a abordagem preferida é passar `EntityManager` como argumento dos métodos.

## Checklist (rápido)

- [ ] Métodos do repositório aceitam `EntityManager?` e usam `manager.getRepository(...)` quando fornecido.
- [ ] Não armazene `EntityManager` em estado de providers singleton.
- [ ] Testes verificam que métodos transacionais passam o manager para os repositórios.
- [ ] Considere `Scope.REQUEST` apenas quando o estado por-request for realmente necessário.

## Notas

- O decorador preserva o `this` e realiza rollback em caso de exceção. Por padrão, ele usa `AppDataSource.manager.transaction` (não detecta automaticamente transações criadas externamente).

## Padrões de uso avançado

Abaixo estão alguns exemplos e padrões comuns em sistemas de produção que trabalham com transações. Não são exaustivos, mas ilustram como usar o decorador e quando estratégias manuais são preferíveis.

1. Transações aninhadas (savepoints) — abordagem manual
   - O decorador inicia sempre uma transação; se você precisar de transações aninhadas ou savepoints, é possível criá-los manualmente usando as APIs de `QueryRunner` disponíveis via `EntityManager.queryRunner`.
   - Exemplo (savepoint manual dentro de um escopo transacional):

```ts
import { EntityManager } from 'typeorm';

class Worker {
	@Transactional({ injectManagerIndex: 0 })
	async topLevel(manager: EntityManager) {
		// operações que devem acontecer de forma atômica
		await manager.save(...);

		// chama uma sub-operação complexa que deve usar um savepoint
		await this.withSavepoint(manager, async (m) => {
			await m.save(...);
			// se falhar, apenas este savepoint será revertido
		});
	}

	async withSavepoint(manager: EntityManager, cb: (manager: EntityManager) => Promise<void>) {
		if (!manager.queryRunner) throw new Error('savepoint requires an active queryRunner');
		await manager.queryRunner.createSavepoint('sp1');
		try {
			await cb(manager);
			await manager.queryRunner.releaseSavepoint('sp1');
		} catch (err) {
			await manager.queryRunner.rollbackSavepoint('sp1');
			throw err; // propaga para que a lógica de nível superior trate commit/rollback
		}
	}
}
```

2. Padrão Outbox (efeito colateral controlado pelo BD)
   - Quando sua transação precisa acionar eventos externos (brokers, chamadas HTTP) de forma segura, prefira o padrão outbox:
     - Persista as mudanças de domínio e uma linha na tabela outbox na mesma transação.
     - Um worker separado lê a outbox e publica os eventos; isto desacopla I/O externo da transação e garante semantics de entrega ao menos-uma-vez.
   - Exemplo:

```ts
class MyService {
  @Transactional()
  async createOrder(payload: CreateOrderDto, manager?: EntityManager) {
    const repo = manager.getRepository(OrderEntity);
    const order = await repo.save({ ...payload, status: "pending" });
    await manager
      .getRepository(OutboxEntity)
      .save({ type: "ORDER_CREATED", payload: order });
    // seguro: o publisher externo processará a outbox após o commit
    return order;
  }
}
```

3. Repositórios do manager vs. repositório global injetado
   - Dentro de uma transação, prefira criar uma instância do repositório via `manager.getRepository` em vez de usar uma instância global injetada ligada ao manager padrão.
   - Isso garante que todas as operações compartilhem o mesmo contexto transacional e evita escritas concorrentes fora da transação.

4. Operações em lotes / chunked
   - Operações longas em lote devem ser divididas em pequenas transações (ex.: 100–1000 linhas por lote) para reduzir locks e pressão de memória.
   - Exemplo:

```ts
@Transactional()
async processBatch(items: ItemDto[], manager?: EntityManager) {
	const repo = manager.getRepository(ItemEntity);
	for (const chunk of chunkArray(items, 100)) {
		await repo.save(chunk);
	}
}
```

5. Combinar o decorador com transações manuais
   - Se precisar de um `QueryRunner` customizado ou recursos avançados, você pode usar `TransactionManager` ou chamar `AppDataSource.createQueryRunner()` manualmente. O decorador cobre o caso comum; se precisar de comportamento especializado, use transações manuais.

## Quando evitar `@Transactional()` (detalhado)

- I/O de longa duração: evite chamadas externas longas (APIs, upload S3) dentro de uma transação — faça-as após o commit. Se precisar acoplar com mudanças no BD, use uma transação curta e o padrão Outbox.
- Leitura/analytics não-crítico: queries somente-leitura ou agregações pesadas não devem ficar dentro de uma transação a menos que você precise de snapshot consistente.
- Operações de alta frequência e curta duração: se o método é chamado muitas vezes por segundo e cada chamada inicia uma transação, avalie o uso de batching para reduzir overhead.
- Reset de contadores/métricas: evite transações para contadores se você puder usar recursos atômicos do BD ou outro armazenamento (Redis, etc.).
- Operações cross-service: se uma operação precisa coordenar múltiplos serviços num commit em vários passos, prefira padrões Saga/Compensating Transaction em vez de transações distribuídas longas.

## Dicas avançadas

- Se precisar de reentrância (chamar um método `@Transactional` a partir de outro escopo transacional), prefira dividir a lógica em helpers privados que recebam `EntityManager` explicitamente — evite aninhar decoradores para não confundir qual transação está em uso.
- Use transações curtas por questões de performance e estabilidade de conexões.
- Evite realizar selects grandes dentro de uma transação — busque apenas as linhas necessárias e trabalhe com ids quando possível.
