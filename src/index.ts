import { app } from './app';
import { env } from './modules/config/env';

const port = Number(env.PORT || 4000);
app.listen(port, () => {});
