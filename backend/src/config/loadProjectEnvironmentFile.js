import { config as loadEnvironmentFile } from 'dotenv'
import { fileURLToPath } from 'node:url'

// Loads saas/.env (the project root), whatever directory the command was started from.
// Values already set in the real environment (for example by docker compose) are not overwritten.
const projectEnvironmentFilePath = fileURLToPath(new URL('../../../.env', import.meta.url))

loadEnvironmentFile({ path: projectEnvironmentFilePath })
