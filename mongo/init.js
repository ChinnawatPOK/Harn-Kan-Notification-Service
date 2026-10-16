const services = [
  {
    database: process.env.USER_SERVICE_DB,
    username: process.env.USER_SERVICE_DB_USER,
    password: process.env.USER_SERVICE_DB_PASSWORD,
  },
  {
    database: process.env.NOTIFICATION_SERVICE_DB,
    username: process.env.NOTIFICATION_SERVICE_DB_USER,
    password: process.env.NOTIFICATION_SERVICE_DB_PASSWORD,
  },
];

for (const service of services) {
  db.getSiblingDB(service.database).createUser({
    user: service.username,
    pwd: service.password,
    roles: [{ role: "readWrite", db: service.database }],
  });

  print(`Created user ${service.username} for database ${service.database}`);
}
