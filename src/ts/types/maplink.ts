export type ResourceMatrix = Record<string, number[][]>;
export type NamedMatrix = {
    type: 'resource' | 'enemy';
    map: ResourceMatrix;
};
