import 'dotenv/config';
import app from './app.js';
import { env } from './modules/config/env.js';

const port = Number(env.PORT || 4000);
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
