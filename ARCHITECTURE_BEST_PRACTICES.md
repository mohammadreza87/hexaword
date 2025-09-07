# HexaWord - Best Practices Architecture

## Clean Architecture / Domain-Driven Design Structure

```
src/
├── domain/                 # Core Business Logic (No dependencies)
│   ├── entities/
│   │   ├── Word.ts
│   │   ├── Puzzle.ts
│   │   ├── Cell.ts
│   │   └── Player.ts
│   ├── value-objects/
│   │   ├── Coordinate.ts
│   │   ├── Direction.ts
│   │   └── Score.ts
│   ├── repositories/       # Interfaces only
│   │   ├── IPuzzleRepository.ts
│   │   ├── IWordRepository.ts
│   │   └── IPlayerRepository.ts
│   └── services/          # Domain services
│       ├── PuzzleGenerator.ts
│       └── WordValidator.ts
│
├── application/           # Use Cases / Application Services
│   ├── use-cases/
│   │   ├── GeneratePuzzle.ts
│   │   ├── SubmitWord.ts
│   │   ├── SaveProgress.ts
│   │   └── GetLeaderboard.ts
│   ├── dto/              # Data Transfer Objects
│   │   ├── PuzzleDTO.ts
│   │   └── GameStateDTO.ts
│   └── interfaces/       # Port interfaces
│       ├── IRenderer.ts
│       ├── IStateManager.ts
│       └── IEventBus.ts
│
├── infrastructure/       # External Dependencies
│   ├── repositories/     # Concrete implementations
│   │   ├── RedisPuzzleRepository.ts
│   │   ├── ApiWordRepository.ts
│   │   └── RedisPlayerRepository.ts
│   ├── rendering/
│   │   ├── CanvasRenderer.ts
│   │   └── WebGLRenderer.ts
│   ├── state/
│   │   ├── RedisStateManager.ts
│   │   └── LocalStorageStateManager.ts
│   └── api/
│       ├── DevvitApiClient.ts
│       └── RestApiClient.ts
│
├── presentation/         # UI Layer
│   ├── controllers/
│   │   ├── GameController.ts
│   │   └── MenuController.ts
│   ├── views/
│   │   ├── GameView.ts
│   │   └── LeaderboardView.ts
│   └── components/
│       ├── HexGrid.tsx
│       └── WordList.tsx
│
├── shared/              # Cross-cutting concerns
│   ├── errors/
│   │   └── DomainErrors.ts
│   ├── events/
│   │   └── EventBus.ts
│   └── utils/
│       └── Logger.ts
│
└── main/               # Composition Root
    ├── DIContainer.ts  # Dependency Injection
    ├── App.ts         # Application setup
    └── index.ts       # Entry point
```

## Key Principles

### 1. **Dependency Inversion Principle**
```typescript
// ❌ Bad (Current)
class CrosswordGenerator {
  private placementService: WordPlacementService;
  
  constructor() {
    this.placementService = new WordPlacementService(); // Direct dependency
  }
}

// ✅ Good (Best Practice)
interface IPlacementStrategy {
  placeWords(words: Word[]): PlacementResult;
}

class CrosswordGenerator {
  constructor(
    private placementStrategy: IPlacementStrategy, // Injected interface
    private validator: IWordValidator
  ) {}
}
```

### 2. **Single Responsibility Principle**
```typescript
// ❌ Bad (Current)
class HexaWordGame {
  // Does everything: rendering, state, game logic, UI
}

// ✅ Good (Best Practice)
class GameController {
  constructor(
    private gameUseCase: GeneratePuzzleUseCase,
    private view: IGameView,
    private eventBus: IEventBus
  ) {}
  
  // Only coordinates between layers
}
```

### 3. **Repository Pattern**
```typescript
// Domain layer (no implementation details)
interface IPuzzleRepository {
  save(puzzle: Puzzle): Promise<void>;
  findById(id: string): Promise<Puzzle | null>;
  findDaily(): Promise<Puzzle | null>;
}

// Infrastructure layer (implementation)
class RedisPuzzleRepository implements IPuzzleRepository {
  constructor(private redis: RedisClient) {}
  
  async save(puzzle: Puzzle): Promise<void> {
    await this.redis.set(`puzzle:${puzzle.id}`, puzzle.serialize());
  }
}
```

### 4. **Use Case Pattern**
```typescript
class GeneratePuzzleUseCase {
  constructor(
    private puzzleRepo: IPuzzleRepository,
    private wordRepo: IWordRepository,
    private generator: IPuzzleGenerator
  ) {}
  
  async execute(request: GeneratePuzzleRequest): Promise<PuzzleDTO> {
    // 1. Fetch words
    const words = await this.wordRepo.getWords(request.theme);
    
    // 2. Generate puzzle
    const puzzle = this.generator.generate(words);
    
    // 3. Save puzzle
    await this.puzzleRepo.save(puzzle);
    
    // 4. Return DTO
    return PuzzleDTO.fromDomain(puzzle);
  }
}
```

### 5. **Dependency Injection Container**
```typescript
// main/DIContainer.ts
class DIContainer {
  private services = new Map<string, any>();
  
  register<T>(token: string, factory: () => T): void {
    this.services.set(token, factory);
  }
  
  resolve<T>(token: string): T {
    const factory = this.services.get(token);
    if (!factory) throw new Error(`Service ${token} not registered`);
    return factory();
  }
}

// main/index.ts
const container = new DIContainer();

// Register services
container.register('IWordRepository', () => 
  new ApiWordRepository(config.apiUrl)
);

container.register('IPuzzleGenerator', () => 
  new ConstraintSolverGenerator()
);

container.register('GeneratePuzzleUseCase', () => 
  new GeneratePuzzleUseCase(
    container.resolve('IWordRepository'),
    container.resolve('IPuzzleGenerator')
  )
);
```

## Refactored Example: Word Placement

### Domain Layer
```typescript
// domain/entities/Puzzle.ts
export class Puzzle {
  private constructor(
    private readonly id: PuzzleId,
    private cells: Map<Coordinate, Cell>,
    private words: Word[]
  ) {}
  
  static create(words: Word[]): Puzzle {
    // Domain logic only
  }
  
  placeWord(word: Word, start: Coordinate, direction: Direction): void {
    // Business rules
    if (!this.canPlaceWord(word, start, direction)) {
      throw new WordPlacementError('Invalid placement');
    }
    // ...
  }
}

// domain/value-objects/Coordinate.ts
export class Coordinate {
  constructor(
    readonly q: number,
    readonly r: number
  ) {
    // Validation
    if (!this.isValid()) {
      throw new InvalidCoordinateError();
    }
  }
  
  equals(other: Coordinate): boolean {
    return this.q === other.q && this.r === other.r;
  }
}
```

### Application Layer
```typescript
// application/use-cases/GeneratePuzzle.ts
export class GeneratePuzzleUseCase {
  constructor(
    private puzzleGenerator: IPuzzleGenerator,
    private puzzleRepository: IPuzzleRepository,
    private eventBus: IEventBus
  ) {}
  
  async execute(command: GeneratePuzzleCommand): Promise<Result<PuzzleDTO>> {
    try {
      // Generate puzzle
      const puzzle = await this.puzzleGenerator.generate(
        command.words,
        command.config
      );
      
      // Save to repository
      await this.puzzleRepository.save(puzzle);
      
      // Publish event
      await this.eventBus.publish(
        new PuzzleGeneratedEvent(puzzle.id)
      );
      
      // Return DTO
      return Result.ok(PuzzleDTO.fromDomain(puzzle));
    } catch (error) {
      return Result.fail(error);
    }
  }
}
```

### Infrastructure Layer
```typescript
// infrastructure/rendering/CanvasRenderer.ts
export class CanvasRenderer implements IRenderer {
  constructor(
    private canvas: HTMLCanvasElement,
    private config: RenderConfig
  ) {}
  
  render(puzzle: PuzzleDTO): void {
    // Canvas-specific rendering
  }
}

// infrastructure/repositories/RedisPuzzleRepository.ts
export class RedisPuzzleRepository implements IPuzzleRepository {
  constructor(private redis: RedisClient) {}
  
  async save(puzzle: Puzzle): Promise<void> {
    const data = this.serialize(puzzle);
    await this.redis.set(`puzzle:${puzzle.id}`, data);
  }
  
  async findById(id: string): Promise<Puzzle | null> {
    const data = await this.redis.get(`puzzle:${id}`);
    return data ? this.deserialize(data) : null;
  }
}
```

### Presentation Layer
```typescript
// presentation/controllers/GameController.ts
export class GameController {
  constructor(
    private generatePuzzleUseCase: GeneratePuzzleUseCase,
    private submitWordUseCase: SubmitWordUseCase,
    private view: IGameView
  ) {
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.view.on('generate', async (config) => {
      const result = await this.generatePuzzleUseCase.execute({
        words: config.words,
        difficulty: config.difficulty
      });
      
      if (result.isSuccess) {
        this.view.renderPuzzle(result.value);
      } else {
        this.view.showError(result.error);
      }
    });
  }
}
```

## Benefits of This Architecture

1. **Testability**: Each layer can be tested in isolation
2. **Maintainability**: Clear separation of concerns
3. **Flexibility**: Easy to swap implementations
4. **Scalability**: Can add features without touching core domain
5. **Team Collaboration**: Clear boundaries between layers

## Migration Path

### Phase 1: Create Domain Layer
- Extract entities and value objects
- Define repository interfaces
- Move business logic to domain services

### Phase 2: Add Application Layer
- Create use cases for each user action
- Define DTOs for data transfer
- Add application services

### Phase 3: Refactor Infrastructure
- Implement repository pattern
- Create adapters for external services
- Add dependency injection

### Phase 4: Update Presentation
- Separate controllers from views
- Implement MVP/MVC pattern
- Add proper event handling

## Testing Strategy

```typescript
// Domain tests (no mocks needed)
describe('Puzzle', () => {
  it('should place word correctly', () => {
    const puzzle = Puzzle.create([]);
    const word = new Word('TEST');
    const coord = new Coordinate(0, 0);
    
    puzzle.placeWord(word, coord, Direction.HORIZONTAL);
    
    expect(puzzle.hasWord(word)).toBe(true);
  });
});

// Application tests (mock infrastructure)
describe('GeneratePuzzleUseCase', () => {
  it('should generate and save puzzle', async () => {
    const mockRepo = mock<IPuzzleRepository>();
    const mockGenerator = mock<IPuzzleGenerator>();
    
    const useCase = new GeneratePuzzleUseCase(
      mockGenerator,
      mockRepo,
      mockEventBus
    );
    
    const result = await useCase.execute(command);
    
    expect(mockRepo.save).toHaveBeenCalled();
    expect(result.isSuccess).toBe(true);
  });
});
```

## Conclusion

The current architecture is a good start but lacks:
- Proper abstraction layers
- Dependency injection
- Domain-driven design
- Use case pattern
- Repository pattern

Following these best practices will make the codebase:
- More testable
- More maintainable
- More scalable
- Easier to understand
- Better for team collaboration