import { DatabaseConnection } from '../adapter';

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseConnection) => Promise<void>;
  down?: (db: DatabaseConnection) => Promise<void>;
}
