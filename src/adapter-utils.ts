import { PrismaMssql } from "@prisma/adapter-mssql";

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
  if (databaseUrl.includes(";")) {
    // Handle SQL Server semicolon format: sqlserver://localhost:1433;database=master;user=sa;password=pass;encrypt=true
    const [hostPart, ...paramParts] = databaseUrl.split(";");
    const hostMatch = hostPart.match(/sqlserver:\/\/([^:]+):?(\d+)?/);

    if (!hostMatch) {
      throw new Error("Invalid SQL Server connection string format");
    }

    const host = hostMatch[1];
    const port = parseInt(hostMatch[2]) || 1433;

    // Parse semicolon-separated parameters
    const params: Record<string, string> = {};
    paramParts.forEach((param) => {
      const [key, value] = param.split("=");
      if (key && value) {
        params[key.toLowerCase()] = value;
      }
    });

    return {
      server: host,
      port,
      user: params.user || "sa",
      password: params.password || "",
      database: params.database || "master",
      options: {
        encrypt: params.encrypt === "true",
        trustServerCertificate: params.trustservercertificate === "true",
      },
    };
  } else {
    // Handle standard URL format: sqlserver://user:pass@host:port?database=master&encrypt=true
    const url = new URL(databaseUrl);
    const params = new URLSearchParams(url.search);

    return {
      server: url.hostname,
      port: parseInt(url.port) || 1433,
      user: url.username,
      password: decodeURIComponent(url.password),
      database: params.get("database") || "master",
      options: {
        encrypt: params.get("encrypt") === "true",
        trustServerCertificate: params.get("trustServerCertificate") === "true",
      },
    };
  }
}

export function createMssqlConfig(
  host: string,
  port: number,
  username: string,
  password: string,
  database: string = "master"
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

export async function createMssqlAdapterFromUrl(
  databaseUrl: string
): Promise<PrismaMssql> {
  const config = createMssqlConfigFromUrl(databaseUrl);
  return new PrismaMssql(config);
}

export async function createMssqlAdapterFromConfig(
  config: MssqlConfig
): Promise<PrismaMssql> {
  return new PrismaMssql(config);
}

export function urlEncodePassword(password: string): string {
  return encodeURIComponent(password)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22")
    .replace(/{/g, "%7B")
    .replace(/}/g, "%7D");
}

export function escapeSqlServerPassword(password: string): string {
  // CLI-specific escaping: wrap problematic characters in curly braces
  return password.replace(/[;=[\]{}]/g, (char: string) => `{${char}}`);
}

export function createDatabaseUrl(
  host: string,
  port: number,
  username: string,
  password: string,
  database: string = "master"
): string {
  const encodedPassword = urlEncodePassword(password);
  return `sqlserver://${username}:${encodedPassword}@${host}:${port}?database=${database}&encrypt=true&trustServerCertificate=true`;
}

export function createCliDatabaseUrl(
  host: string,
  port: number,
  username: string,
  password: string,
  database: string = "master",
  engine: string = "sqlserver"
): string {
  const escapedPassword = escapeSqlServerPassword(password);
  return `${engine}://${host}:${String(
    port
  )};initial catalog=${database};user=${username};password=${escapedPassword};encrypt=true;trustServerCertificate=true;`;
}
