# /be-entity

Cria uma entidade TypeORM + interface de repositório + factory pattern, seguindo o padrão de `packages/database`.

## Uso
```
/be-entity <nome> [campos]
```

**Campos** são passados como lista separada por vírgulas, com tipo opcional após `:`:
- `name`, `email:string`, `active:boolean`, `price:number`, `role:enum`, `description:text`, `userId:uuid-fk`, `createdAt:timestamp`

**Tipos suportados:**
| Tipo no comando | TypeORM `@Column` type | TypeScript type |
|---|---|---|
| `string` (padrão) | `varchar` | `string` |
| `text` | `text` | `string` |
| `number` | `numeric` | `number` |
| `boolean` | `boolean` | `boolean` |
| `enum` | `enum` | `enum` (perguntar valores) |
| `uuid-fk` | `uuid` | `string` (foreign key) |
| `timestamp` | `timestamptz` | `Date` |
| `jsonb` | `jsonb` | `Record<string, unknown>` |

**Exemplos:**
- `/be-entity subscription name,status:enum,userId:uuid-fk,expiresAt:timestamp`
- `/be-entity product name,price:number,description:text,active:boolean`
- `/be-entity audit-log action,payload:jsonb,userId:uuid-fk`

---

## Processo

### 1. Leia os arquivos de referência

Sempre leia antes de gerar:
- `packages/database/src/entities/agent.entity.ts` — padrão de entidade
- `packages/database/src/repositories/agent.repository.ts` — padrão de repositório
- `packages/database/src/index.ts` — para saber onde registrar exports

### 2. Perguntas antes de gerar

Se algum campo for `enum`, pergunte os valores possíveis antes de prosseguir.
Se algum campo for `uuid-fk`, pergunte para qual entidade referencia (para configurar o `@ManyToOne` corretamente).

### 3. Crie `packages/database/src/entities/<nome>.entity.ts`

```typescript
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  // ManyToOne, JoinColumn — se houver foreign keys
} from 'typeorm';
import { uuidv7 } from 'uuid';

// Se houver enum:
// export enum <Nome>Status { ACTIVE = 'active', INACTIVE = 'inactive' }

@Entity('<nome>s') // nome da tabela em snake_case plural
export class <Nome>Entity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv7();
  }

  // campos gerados a partir dos argumentos
  // exemplo string:
  @Column({ type: 'varchar' })
  name: string;

  // exemplo boolean com default:
  @Column({ type: 'boolean', default: true })
  active: boolean;

  // exemplo enum:
  @Column({ type: 'enum', enum: <Nome>Status, default: <Nome>Status.ACTIVE })
  status: <Nome>Status;

  // exemplo foreign key:
  @Column({ type: 'uuid' })
  userId: string;

  // @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  // @JoinColumn({ name: 'userId' })
  // user: UserEntity;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
```

### 4. Crie `packages/database/src/repositories/<nome>.repository.ts`

```typescript
import { DataSource, Repository } from 'typeorm';
import { <Nome>Entity } from '../entities/<nome>.entity';

// Interface pública do repositório
export interface <Nome>Repository {
  findAll(): Promise<<Nome>Entity[]>;
  findById(id: string): Promise<<Nome>Entity | null>;
  // adicionar métodos específicos do domínio conforme campos
  // ex: findByUserId(userId: string): Promise<<Nome>Entity[]>;
  save(entity: Partial<<Nome>Entity>): Promise<<Nome>Entity>;
  remove(id: string): Promise<void>;
}

// Token de injeção
export const <NOME>_REPOSITORY = Symbol('<NOME>_REPOSITORY');

// Factory
export function create<Nome>Repository(
  dataSource: DataSource,
): <Nome>Repository {
  const repo: Repository<<Nome>Entity> = dataSource.getRepository(<Nome>Entity);

  return {
    findAll: () => repo.find({ order: { createdAt: 'DESC' } }),

    findById: (id) => repo.findOne({ where: { id } }),

    save: (entity) => repo.save(entity),

    remove: async (id) => {
      await repo.delete(id);
    },
  };
}
```

### 5. Atualize `packages/database/src/index.ts`

Adicione os exports da nova entidade e repositório:

```typescript
export { <Nome>Entity } from './entities/<nome>.entity';
export {
  <Nome>Repository,
  <NOME>_REPOSITORY,
  create<Nome>Repository,
} from './repositories/<nome>.repository';
```

### 6. Registre a entidade no DataSource

Leia o arquivo de configuração do DataSource em `packages/database/src/` e adicione `<Nome>Entity` na lista de `entities`.

### 7. Execute a geração da migration

```bash
pnpm migrate:generate "Add<Nome>Table"
```

Se o ambiente Docker não estiver rodando, avise o usuário que precisa executar `pnpm docker:up` antes.

### 8. Oriente o uso no módulo NestJS

Mostre ao usuário como registrar a entidade e o repositório no módulo que vai consumi-la:

```typescript
// No módulo NestJS que usa a entidade:
import { DatabaseModule } from '@turborepo/database';
import { <Nome>Entity } from '@turborepo/database';
import { <NOME>_REPOSITORY, create<Nome>Repository } from '@turborepo/database';

@Module({
  imports: [DatabaseModule.forFeature([<Nome>Entity])],
  providers: [
    {
      provide: <NOME>_REPOSITORY,
      useFactory: (dataSource: DataSource) => create<Nome>Repository(dataSource),
      inject: [DataSource],
    },
    <Nome>Service,
  ],
})
export class <Nome>Module {}

// No service:
constructor(
  @Inject(<NOME>_REPOSITORY)
  private readonly <nome>Repository: <Nome>Repository,
) {}
```

---

## Regras obrigatórias

- **Nunca** `@PrimaryGeneratedColumn()` — sempre `@PrimaryColumn({ type: 'uuid' })` + `@BeforeInsert()` com `uuidv7()`
- **Nunca** `synchronize: true` — sempre gerar migration explícita
- Nomes de tabela em `snake_case` plural na annotation `@Entity()`
- Colunas de timestamp sempre com `type: 'timestamptz'` (com timezone)
- Interface do repositório separada da implementação — o service depende da interface, não da classe concreta
- Token de injeção como `Symbol()` nomeado — nunca string literal
- Exports adicionados em `packages/database/src/index.ts` antes de finalizar
