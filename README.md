# HexaWord - Hexagonal Crossword Puzzle Game

A modern, interactive hexagonal crossword puzzle game built for Reddit's Devvit platform. Players solve word puzzles on a hexagonal grid with beautiful animations, daily rewards, and social sharing features.

## Features

### Core Gameplay
- **Hexagonal Grid System**: Unique hexagonal crossword puzzles with interconnected words
- **Progressive Difficulty**: Multiple levels with increasing complexity
- **Deterministic Generation**: Seeded puzzle generation ensures consistent puzzles per Reddit post
- **Real-time Validation**: Instant feedback on word placement and correctness

### Game Mechanics
- **Hint System**: Purchase hints using in-game coins to reveal letters or target specific words
- **Booster System**: Special power-ups to help solve challenging puzzles
- **Score Tracking**: Points awarded based on word difficulty and solving speed
- **Level Progression**: Unlock new levels as you complete puzzles

### Rewards & Economy
- **Coin System**: Earn and spend coins for hints and boosters
- **Daily Rewards**: Spin the Wheel of Fortune for daily bonuses
- **Achievement System**: Track progress and earn rewards for milestones

### Visual Experience
- **Dynamic Color Palettes**: Each level features unique color schemes
- **Smooth Animations**: GSAP-powered animations for delightful interactions
- **Responsive Design**: Adapts to different screen sizes and devices
- **Theme Support**: Light and dark mode options

### Social Features
- **Share Progress**: Share your achievements and puzzle completions
- **Reddit Integration**: Deep integration with Reddit's platform features
- **Persistent Progress**: Save and sync progress across sessions

### Dynamic Splash Experience
- **Custom Splash Metadata**: Populate Devvit Web posts with `appDisplayName`, `heading`, and a descriptive `buttonLabel`
- **Lightweight Media**: Keep splash images under 2MB and host them in `client/public` or via HTTPS for quick loading
- **Clear CTA**: Use actionable button copy such as “Start Playing” to launch the puzzle immediately
- **Contextual Details**: Surface the shared level's clue and letter bank in the splash description to set expectations
- **Consistent Branding**: Reuse your HexaWord iconography and palette so shared links feel cohesive with the main app

## Tech Stack

- **Frontend**: TypeScript, Vite, GSAP animations
- **Backend**: Express.js, Redis for state management
- **Platform**: Reddit Devvit Web
- **Styling**: Tailwind CSS with custom design tokens
- **Testing**: Vitest for unit and integration tests

## Project Structure

```
hexaword/
├── src/
│   ├── client/          # Frontend application
│   │   ├── components/  # UI components (GameUI, WheelOfFortune, etc.)
│   │   ├── services/    # Client services (API, storage, animations)
│   │   └── styles/      # CSS and styling
│   ├── server/          # Backend Express server
│   │   ├── routes/      # API endpoints (game, coins, hints, etc.)
│   │   ├── middleware/  # Error handling and logging
│   │   └── core/        # Server utilities
│   ├── web-view/        # Game rendering engine
│   │   ├── engine/      # Hex rendering and grid system
│   │   ├── services/    # Game services (generator, animations, colors)
│   │   └── components/  # Game components
│   ├── shared/          # Shared code between client and server
│   │   ├── game/        # Domain logic and services
│   │   ├── types/       # TypeScript type definitions
│   │   └── utils/       # Utility functions (RNG, validation)
│   ├── levels/          # Level data and configurations
│   └── tests/           # Test suites
├── tools/               # Build scripts and utilities
└── dist/               # Build output

```

## Getting Started

### Prerequisites
- Node.js 22 or higher
- npm 10+
- Reddit Developer account

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd hexaword
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your Reddit app credentials
```

### Development

Start the development server with hot reload:
```bash
npm run dev
```

This starts three processes:
- Client build watcher (Vite)
- Server build watcher (Vite)
- Devvit playtest environment

### Building

Build the project for production:
```bash
npm run build
```

This command:
1. Generates level data (`build:levels`)
2. Builds the client bundle (`build:client`)
3. Builds the server bundle (`build:server`)

### Testing

Run the test suite:
```bash
npm test                  # Run all tests
npm run test:ui          # Run tests with UI
npm run test:coverage    # Generate coverage report
npm run test:determinism # Test puzzle generation determinism
```

### Deployment

Deploy to Reddit Devvit:
```bash
npm run deploy  # Upload current build
npm run launch  # Deploy and publish for review
```

## Available Scripts

- `npm run dev` - Start development environment
- `npm run build` - Build for production
- `npm run deploy` - Upload to Devvit
- `npm run launch` - Build, deploy, and publish
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run test suite
- `npm run login` - Authenticate with Reddit

## Game Architecture

### Deterministic Puzzle Generation
The game uses seeded random number generation to ensure that the same puzzle is generated for each Reddit post, providing a consistent experience for all players viewing the same post.

### Layered Architecture
- **Domain Layer**: Pure business logic for game rules and mechanics
- **Application Layer**: Service orchestration and use cases
- **Infrastructure Layer**: External integrations (Reddit API, storage)
- **Presentation Layer**: UI components and rendering

### State Management
- **Client State**: Local storage for progress and preferences
- **Server State**: Redis for persistent game state and leaderboards
- **Sync Strategy**: Automatic merging of local and remote progress

## API Endpoints

### Game Routes
- `GET /api/game/init` - Initialize game with level data
- `POST /api/game/submit` - Submit word attempt
- `GET /api/game/progress` - Get player progress
- `POST /api/game/complete` - Mark level as complete

### Economy Routes
- `GET /api/coins/balance` - Get coin balance
- `POST /api/coins/spend` - Spend coins on hints/boosters
- `POST /api/coins/earn` - Award coins for achievements

### Social Routes
- `POST /api/share` - Share game progress
- `GET /api/daily-reward` - Check/claim daily rewards

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

BSD-3-Clause License - See LICENSE file for details

## Acknowledgments

- Built with Reddit's Devvit platform
- Uses Honeycomb Grid for hexagonal grid calculations
- Animations powered by GSAP
- Word lists curated for family-friendly gameplay