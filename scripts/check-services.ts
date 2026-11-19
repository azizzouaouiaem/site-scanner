import { checkServices } from "../src/lib/commerce/check-services";
import { sql } from "../src/lib/commerce/store";
checkServices()
  .then(async (result) => {
    console.log(JSON.stringify(result, null, 2));
    if (process.env.DATABASE_URL || process.env.POSTGRES_URL)
      await sql().end({ timeout: 2 });
  })
  .catch(() => {
    console.error("Service check failed");
    process.exitCode = 1;
  });
