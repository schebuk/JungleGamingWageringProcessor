import { defineConfig } from '@mikro-orm/postgresql';

export default defineConfig({
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  dbName: 'jungle_db',
  user: 'jungle_user',
  password: 'jungle_pass',
  host: 'localhost',
  port: 5432,
  debug: true,
});