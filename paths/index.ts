import path from "path";

import {pkgUpSync} from "pkg-up";

const pkgPath = pkgUpSync({ cwd: import.meta.url });
if (!pkgPath) throw new Error('Can not find package.json');

export const ROOT_DIR = path.dirname(pkgPath);

export const RULES_PATH = path.join(ROOT_DIR, "./rules");