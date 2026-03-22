export interface SourceContainer {
  buildings: LogBuildings[];
  citizen: LogCitizen[];
}
export interface LogCitizen {
  entityId?: string;
  userName?: string;
}
export interface LogBuildings {
  buildingName?: string;
  buildingNickname?: string | undefined;
  entityId?: string | undefined;
}
