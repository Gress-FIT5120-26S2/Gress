import dotenv from 'dotenv';

const environmentFile = process.env.KITCHMEMO_ENV_FILE
  ?? (process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development');

// Arthur: NarIyirm
// 中文：部署平台提供的变量优先；本地再按环境读取文件，并保留旧 .env 作为未迁移开发机的兼容回退。
// EN: Platform variables take priority; local environment files load next, with legacy .env retained as a compatibility fallback.
dotenv.config({ path: environmentFile, quiet: true });
dotenv.config({ quiet: true });
