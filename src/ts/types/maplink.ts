type ResourceMatrix = Record<string, number[][]>;
type NamedMatrix = {
    type: 'resource' | 'enemy';
    map: Record<string, number[][]>;
};
