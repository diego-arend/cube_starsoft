# /be-module

Scaffolda um módulo NestJS completo seguindo os padrões de `apps/backend`.

## Uso
```
/be-module <nome>
```

**Exemplos:**
- `/be-module subscription`
- `/be-module billing`
- `/be-module report`

---

## Processo

### 1. Leia os arquivos de referência antes de gerar

Sempre leia estes arquivos para calibrar no padrão atual:
- `apps/backend/src/agent/agent.module.ts`
- `apps/backend/src/agent/agent.service.ts`
- `apps/backend/src/agent/agent.controller.ts`
- `apps/backend/src/app.module.ts` — para saber onde registrar o novo módulo

---

### 2. Crie os 3 arquivos em `apps/backend/src/<nome>/`

#### `<nome>.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@turborepo/database';
import { <Nome>Controller } from './<nome>.controller';
import { <Nome>Service } from './<nome>.service';
// importar entidade relevante se existir: import { <Entidade>Entity } from '@turborepo/database';

@Module({
  imports: [
    // DatabaseModule.forFeature([<Entidade>Entity]), // descomentar quando a entidade existir
  ],
  controllers: [<Nome>Controller],
  providers: [<Nome>Service],
  exports: [<Nome>Service],
})
export class <Nome>Module {}
```

#### `<nome>.service.ts`

```typescript
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class <Nome>Service {
  private readonly logger = new Logger(<Nome>Service.name);

  // Adicionar injeção de repositório quando entidade existir:
  // constructor(
  //   @Inject(<NOME>_REPOSITORY)
  //   private readonly <nome>Repository: <Nome>Repository,
  // ) {}

  async findAll(): Promise<unknown[]> {
    this.logger.log('findAll');
    // implementação
    return [];
  }

  async findById(id: string): Promise<unknown> {
    this.logger.log(`findById: ${id}`);
    // implementação
    throw new NotFoundException(`<Nome> ${id} não encontrado`);
  }

  async create(data: unknown): Promise<unknown> {
    this.logger.log('create');
    // implementação
    return data;
  }

  async update(id: string, data: unknown): Promise<unknown> {
    this.logger.log(`update: ${id}`);
    // implementação
    return data;
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`remove: ${id}`);
    // implementação
  }
}
```

#### `<nome>.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { <Nome>Service } from './<nome>.service';

@ApiTags('<nome>s')
@ApiBearerAuth()
@Controller('<nome>s')
export class <Nome>Controller {
  constructor(private readonly <nome>Service: <Nome>Service) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos os <nome>s' })
  @ApiResponse({ status: 200, description: 'Lista retornada com sucesso' })
  findAll() {
    return this.<nome>Service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar <nome> por ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: '<Nome> encontrado' })
  @ApiResponse({ status: 404, description: '<Nome> não encontrado' })
  findById(@Param('id') id: string) {
    return this.<nome>Service.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar <nome>' })
  @ApiResponse({ status: 201, description: '<Nome> criado com sucesso' })
  create(@Body() body: unknown, @Request() req: { user: { sub: string } }) {
    return this.<nome>Service.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar <nome>' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: '<Nome> atualizado' })
  @ApiResponse({ status: 404, description: '<Nome> não encontrado' })
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.<nome>Service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover <nome>' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: '<Nome> removido' })
  @ApiResponse({ status: 404, description: '<Nome> não encontrado' })
  remove(@Param('id') id: string) {
    return this.<nome>Service.remove(id);
  }
}
```

---

### 3. Registre o módulo no `app.module.ts`

Leia `apps/backend/src/app.module.ts` e adicione `<Nome>Module` na lista de `imports`:

```typescript
import { <Nome>Module } from './<nome>/<nome>.module';

@Module({
  imports: [
    // ... módulos existentes
    <Nome>Module,
  ],
})
export class AppModule {}
```

---

### 4. Após gerar

Informe o usuário:
- Arquivos criados com caminhos completos
- Linha adicionada no `app.module.ts`
- Próximos passos sugeridos:
  - Criar a entidade com `/be-entity <nome> [campos]` se precisar persistência
  - Adicionar DTOs/schemas Zod para os endpoints de criação/atualização
  - Gerar testes com `/be-test apps/backend/src/<nome>/<nome>.service.ts`

---

## Regras obrigatórias

- `private readonly logger = new Logger(<Nome>Service.name)` em todo service — nunca `console.log`
- Todos os endpoints com decorators Swagger (`@ApiOperation`, `@ApiResponse` mínimo)
- Controller sempre com `@ApiTags()` e `@ApiBearerAuth()`
- Erros como exceções NestJS (`NotFoundException`, `BadRequestException`, etc.) — nunca `throw new Error()`
- Imports de `@nestjs/common`, `@nestjs/swagger` — nunca paths relativos para esses pacotes
- Se o endpoint for público (sem auth), adicionar `@Public()` do `@/auth/decorators/public.decorator`
- Módulo exporta o service para uso em outros módulos
