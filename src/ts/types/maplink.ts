export type ResourceMatrix = Record<string, number[][]>;
export interface NamedMatrix {
  type: 'resource' | 'enemy';
  map: ResourceMatrix;
}
