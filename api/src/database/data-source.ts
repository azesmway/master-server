import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

export const AppDataSource = new DataSource({
  type:         'postgres',
  url:          process.env.DATABASE_URL,
  host:         process.env.DB_HOST     ?? 'localhost',
  port:         parseInt(process.env.DB_PORT ?? '5432', 10),
  database:     process.env.DB_NAME     ?? 'master_db',
  username:     process.env.DB_USER     ?? 'master_user',
  password:     process.env.DB_PASSWORD ?? '',
  entities:     [join(__dirname, '../**/*.entity.{ts,js}')],
  migrations:   [join(__dirname, 'migrations/*.{ts,js}')],
  synchronize:  false,
  logging:      process.env.NODE_ENV !== 'production',
  ssl:          process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});
