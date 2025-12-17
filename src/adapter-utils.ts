import { PrismaMssql } from '@prisma/adapter-mssql';

export interface MssqlConfig {
  server: string;
  port: number;
  user: string;
  password: string;
  database: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
}

export interface DatabaseUrlConfig {
  url: string;
}

export function createMssqlConfigFromUrl(databaseUrl: string): MssqlConfig {
  const url = new URL(databaseUrl);
  const params = new URLSearchParams(url.search);
  
  return {
    server: url.hostname,
    port: parseInt(url.port) || 1433,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: params.get('database') || 'master',
    options: {
      encrypt: params.get('encrypt') === 'true',
      trustServerCertificate: params.get('trustServerCertificate') === 'true',
    },
  };
}

export function createMssqlConfig(
  host: string,
  port: number,
  username: string,
  password: string,
  database: string = 'master'
): MssqlConfig {
  return {
    server: host,
    port,
    user: username,
    password,
    database,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  };
}

export async function createMssqlAdapterFromUrl(databaseUrl: string): Promise<PrismaMssql> {
  const config = createMssqlConfigFromUrl(databaseUrl);
  return new PrismaMssql(config);
}

export async function createMssqlAdapterFromConfig(config: MssqlConfig): Promise<PrismaMssql> {
  return new PrismaMssql(config);
}

export function urlEncodePassword(password: string): string {
  return encodeURIComponent(password)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
    .replace(/{/g, '%7B')
    .replace(/}/g, '%7D');
}

export function createDatabaseUrl(
  host: string,
  port: number,
  username: string,
  password: string,
  database: string = 'master'
): string {
  const encodedPassword = urlEncodePassword(password);
  return `sqlserver://${username}:${encodedPassword}@${host}:${port}?database=${database}&encrypt=true&trustServerCertificate=true`;
}