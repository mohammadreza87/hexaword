export interface ITile {
  q: number;
  r: number;
  s: number;
  letter?: string;
  isSelected: boolean;
  isValid: boolean;
  isLocked: boolean;
}

export class Tile implements ITile {
  constructor(
    public q: number,
    public r: number,
    public s: number,
    public letter?: string,
    public isSelected: boolean = false,
    public isValid: boolean = true,
    public isLocked: boolean = false
  ) {}

  get id(): string {
    return `${this.q},${this.r}`;
  }

  equals(other: ITile): boolean {
    return this.q === other.q && this.r === other.r;
  }

  clone(): Tile {
    return new Tile(
      this.q,
      this.r,
      this.s,
      this.letter,
      this.isSelected,
      this.isValid,
      this.isLocked
    );
  }
}
