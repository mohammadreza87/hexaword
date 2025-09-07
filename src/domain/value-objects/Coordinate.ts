/**
 * Value Object: Coordinate
 * Represents an immutable hexagonal coordinate in cube coordinate system
 */
export class Coordinate {
  public readonly q: number;
  public readonly r: number;
  public readonly s: number;

  constructor(q: number, r: number, s?: number) {
    this.q = q;
    this.r = r;
    this.s = s ?? (-q - r);
    
    // Validation: cube coordinates must sum to 0
    if (Math.abs(this.q + this.r + this.s) > 0.0001) {
      throw new Error(`Invalid hexagonal coordinate: q=${q}, r=${r}, s=${this.s}`);
    }
    
    Object.freeze(this);
  }

  /**
   * Creates a coordinate from axial coordinates (q, r)
   */
  static fromAxial(q: number, r: number): Coordinate {
    return new Coordinate(q, r);
  }

  /**
   * Creates a coordinate from cube coordinates
   */
  static fromCube(q: number, r: number, s: number): Coordinate {
    return new Coordinate(q, r, s);
  }

  /**
   * Checks equality with another coordinate
   */
  equals(other: Coordinate): boolean {
    return this.q === other.q && this.r === other.r && this.s === other.s;
  }

  /**
   * Adds another coordinate (vector addition)
   */
  add(other: Coordinate): Coordinate {
    return new Coordinate(this.q + other.q, this.r + other.r);
  }

  /**
   * Subtracts another coordinate (vector subtraction)
   */
  subtract(other: Coordinate): Coordinate {
    return new Coordinate(this.q - other.q, this.r - other.r);
  }

  /**
   * Multiplies by a scalar
   */
  multiply(scalar: number): Coordinate {
    return new Coordinate(this.q * scalar, this.r * scalar);
  }

  /**
   * Calculates distance to another coordinate
   */
  distanceTo(other: Coordinate): number {
    return (Math.abs(this.q - other.q) + 
            Math.abs(this.r - other.r) + 
            Math.abs(this.s - other.s)) / 2;
  }

  /**
   * Gets neighboring coordinate in a given direction
   */
  neighbor(direction: Direction): Coordinate {
    return this.add(direction.toCoordinate());
  }

  /**
   * Converts to string for use as map key
   */
  toString(): string {
    return `${this.q},${this.r}`;
  }

  /**
   * Creates from string
   */
  static fromString(str: string): Coordinate {
    const [q, r] = str.split(',').map(Number);
    return new Coordinate(q, r);
  }
}

/**
 * Value Object: Direction
 * Represents one of the six hexagonal directions
 */
export class Direction {
  private constructor(
    public readonly index: number,
    public readonly name: string,
    private readonly offset: Coordinate
  ) {
    Object.freeze(this);
  }

  // Six hexagonal directions (pointy-top orientation)
  static readonly EAST = new Direction(0, 'East', new Coordinate(1, 0));
  static readonly SOUTHEAST = new Direction(1, 'Southeast', new Coordinate(1, -1));
  static readonly SOUTHWEST = new Direction(2, 'Southwest', new Coordinate(0, -1));
  static readonly WEST = new Direction(3, 'West', new Coordinate(-1, 0));
  static readonly NORTHWEST = new Direction(4, 'Northwest', new Coordinate(-1, 1));
  static readonly NORTHEAST = new Direction(5, 'Northeast', new Coordinate(0, 1));

  // Readable directions for word placement (subset)
  static readonly HORIZONTAL = Direction.EAST;
  static readonly VERTICAL = Direction.SOUTHEAST;
  static readonly DIAGONAL = Direction.SOUTHWEST;

  static readonly ALL = [
    Direction.EAST,
    Direction.SOUTHEAST,
    Direction.SOUTHWEST,
    Direction.WEST,
    Direction.NORTHWEST,
    Direction.NORTHEAST
  ];

  static readonly READABLE = [
    Direction.HORIZONTAL,
    Direction.VERTICAL,
    Direction.DIAGONAL
  ];

  /**
   * Gets direction by index
   */
  static fromIndex(index: number): Direction {
    const dir = Direction.ALL[index % 6];
    if (!dir) {
      throw new Error(`Invalid direction index: ${index}`);
    }
    return dir;
  }

  /**
   * Converts to coordinate offset
   */
  toCoordinate(): Coordinate {
    return this.offset;
  }

  /**
   * Gets opposite direction
   */
  opposite(): Direction {
    return Direction.fromIndex(this.index + 3);
  }

  /**
   * Rotates direction clockwise
   */
  rotateClockwise(): Direction {
    return Direction.fromIndex(this.index + 1);
  }

  /**
   * Rotates direction counter-clockwise
   */
  rotateCounterClockwise(): Direction {
    return Direction.fromIndex(this.index - 1);
  }
}