export const postgres = {
  host: process.env.POSTGRES_HOST || "localhost",
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "postgres",
  database: process.env.POSTGRES_DB || "openskimap",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
};

export const frontend = {
  path: process.env.FRONTEND_PATH,
};
