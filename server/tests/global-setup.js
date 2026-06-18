import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// Roda UMA vez antes de toda a suíte. Recria um banco descartável a partir
// das migrações commitadas, garantindo isolamento total do dev.db.
export default function setup() {
  rmSync('prisma/test.db', { force: true });
  rmSync('prisma/test.db-journal', { force: true });
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
