# /be-test

Gera testes Vitest para services, controllers, guards e filtros do backend NestJS.

## Uso
```
/be-test [arquivo]
```

- Se `arquivo` for fornecido, usa-o como alvo
- Se não for fornecido, usa o arquivo atualmente aberto no editor
- Cria o arquivo `.spec.ts` no mesmo diretório do arquivo testado

**Exemplos:**
- `/be-test` — testa o arquivo aberto
- `/be-test apps/backend/src/agent/agent.service.ts`
- `/be-test apps/backend/src/auth/guards/auth.guard.ts`
- `/be-test apps/backend/src/agent/agent.controller.ts`
- `/be-test apps/backend/src/shared/filters/http-exception.filter.ts`

---

## Processo

### 1. Leia o arquivo alvo e suas dependências diretas

Leia o arquivo completamente. Identifique:

**Para services:**
- Dependências injetadas no constructor (repositórios, outros services, Redis, etc.)
- Cada método público e sua lógica de negócio
- Casos de sucesso e de erro em cada método
- Exceções NestJS lançadas (`NotFoundException`, `UnauthorizedException`, etc.)
- Chamadas a repositórios, Redis, RabbitMQ ou LLM

**Para controllers:**
- Métodos HTTP e suas rotas
- Parâmetros de entrada (`@Param`, `@Body`, `@Query`, `@Request`)
- Dependências injetadas (services)
- Decorators de guard (`@Public()` ou ausência = autenticado)

**Para guards:**
- Lógica de `canActivate()`
- Dependências (Reflector, Redis, etc.)
- Casos que retornam `true` / `false` / lançam exceção

**Para filtros:**
- Tipo de exceção capturada
- Formato da resposta de erro gerada

### 2. Leia testes existentes para calibrar o padrão

Sempre leia pelo menos um `.spec.ts` existente antes de gerar:
- `apps/backend/src/auth/auth.service.spec.ts` (se existir)
- `apps/backend/src/shared/filters/http-exception.filter.spec.ts`
- Qualquer `.spec.ts` próximo ao arquivo alvo

### 3. Gere o arquivo `.spec.ts`

#### Estrutura base — Service:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { <Nome>Service } from './<nome>.service';
import { <NOME>_REPOSITORY } from '@turborepo/database';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Mock do repositório
const mockRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
};

describe('<Nome>Service', () => {
  let service: <Nome>Service;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <Nome>Service,
        {
          provide: <NOME>_REPOSITORY,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<<Nome>Service>(<Nome>Service);
  });

  describe('findAll', () => {
    it('deve retornar lista de <nome>s', async () => {
      const items = [{ id: '1', name: 'Test' }];
      mockRepository.findAll.mockResolvedValueOnce(items);

      const result = await service.findAll();

      expect(result).toEqual(items);
      expect(mockRepository.findAll).toHaveBeenCalledOnce();
    });
  });

  describe('findById', () => {
    it('deve retornar <nome> quando encontrado', async () => {
      const item = { id: '1', name: 'Test' };
      mockRepository.findById.mockResolvedValueOnce(item);

      const result = await service.findById('1');

      expect(result).toEqual(item);
    });

    it('deve lançar NotFoundException quando não encontrado', async () => {
      mockRepository.findById.mockResolvedValueOnce(null);

      await expect(service.findById('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ... demais métodos
});
```

#### Estrutura base — Controller:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { <Nome>Controller } from './<nome>.controller';
import { <Nome>Service } from './<nome>.service';
import { APP_GUARD } from '@nestjs/core';

// Mock do guard global para não bloquear os testes
const mockAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };

const mock<Nome>Service = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

describe('<Nome>Controller', () => {
  let controller: <Nome>Controller;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [<Nome>Controller],
      providers: [
        { provide: <Nome>Service, useValue: mock<Nome>Service },
        { provide: APP_GUARD, useValue: mockAuthGuard },
      ],
    }).compile();

    controller = module.get<<Nome>Controller>(<Nome>Controller);
  });

  describe('findAll', () => {
    it('deve chamar service.findAll e retornar resultado', async () => {
      const items = [{ id: '1' }];
      mock<Nome>Service.findAll.mockResolvedValueOnce(items);

      const result = await controller.findAll();

      expect(result).toEqual(items);
      expect(mock<Nome>Service.findAll).toHaveBeenCalledOnce();
    });
  });

  // ... demais métodos
});
```

#### Estrutura base — Guard:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './auth.guard';

// Mock de ExecutionContext
function createMockContext(overrides: {
  headers?: Record<string, string>;
  isPublic?: boolean;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: overrides.headers ?? {},
        user: undefined,
      }),
    }),
    getHandler: vi.fn(),
    getClass: vi.fn(),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard, Reflector],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('deve permitir rotas marcadas com @Public()', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = createMockContext({});

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('deve lançar UnauthorizedException sem token', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const ctx = createMockContext({ headers: {} });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

#### Estrutura base — Filtro:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';

function createMockHost(send: ReturnType<typeof vi.fn>): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: vi.fn().mockReturnThis(),
        send,
      }),
      getRequest: () => ({ url: '/test' }),
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('deve retornar statusCode e message da HttpException', () => {
    const send = vi.fn();
    const host = createMockHost(send);
    const exception = new HttpException('Não autorizado', HttpStatus.UNAUTHORIZED);

    filter.catch(exception, host);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Não autorizado',
      }),
    );
  });
});
```

---

### 4. Casos de teste a cobrir por tipo

**Services:**
- Happy path de cada método público
- `NotFoundException` quando `findById` retorna null
- `BadRequestException` / `UnauthorizedException` conforme a lógica
- Verificação de que o repositório/dependência foi chamado com os argumentos corretos
- Comportamento quando dependência rejeita (simula falha de DB/Redis)

**Controllers:**
- Cada método delega corretamente para o service
- Parâmetros são passados corretamente ao service
- Retorno do controller corresponde ao retorno do service

**Guards:**
- Rota marcada com `@Public()` → `true`
- Rota protegida sem token → `UnauthorizedException`
- Rota protegida com token inválido → `UnauthorizedException`
- Rota protegida com token válido + usuário no Redis → `true`

**Filtros:**
- `HttpException` com status e mensagem corretos
- Formato do corpo da resposta de erro

---

### 5. Mocks comuns do projeto

```typescript
// Mock RedisService
const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  sRem: vi.fn(),
};

// Mock Logger (evitar logs nos testes)
vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

// Mock RabbitMQ publisher
const mockPublisher = { publish: vi.fn() };

// Mock repositório TypeORM genérico
const mockRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
};
```

---

### 6. Após gerar

- Informe o caminho do arquivo criado
- Liste os casos de teste em formato de checklist
- Se identificou dependências externas que precisam de mock real (ex: banco em memória), mencione e proponha alternativas

---

## Regras obrigatórias

- Vitest (`vi`, `describe`, `it`, `expect`) — **nunca Jest**
- `@nestjs/testing` com `Test.createTestingModule()` — não instanciar classes manualmente
- `vi.clearAllMocks()` no `beforeEach` sempre que houver mocks
- Guard global mockado nos testes de controller para não bloquear chamadas
- Arquivo `.spec.ts` (não `.spec.tsx`) no mesmo diretório do arquivo testado
- Sem `console.log` nos testes
- Nomes de teste em português descritivos: `'deve lançar NotFoundException quando ...'`
