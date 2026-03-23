export interface SourceContainer {
  buildings: LogBuildings[];
  citizen: LogCitizen[];
}
export interface LogCitizen {
  entityId: string | undefined;
  userName: string | undefined;
}
export interface LogBuildings {
  buildingName: string;
  buildingNickname?: string | undefined;
  entityId: string | undefined;
}
