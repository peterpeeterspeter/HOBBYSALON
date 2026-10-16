import NativeOrderModule from '@medusajs/order'
import * as NativeOrderModels from '@medusajs/order/dist/models'
import * as NativeOrderRepositories from '@medusajs/order/dist/repositories'
import { OrderService } from '@medusajs/order/dist/services'
import { Modules, ModulesSdkUtils, toMikroOrmEntities } from '@medusajs/framework/utils'
import { dirname, join } from 'node:path'
import OrderCommerceSerializationService from './service'

// Discovery now starts here, not in @medusajs/order. Explicitly retain every
// native 2.11.3 model and its custom repositories (including order/return/claim),
// OrderService, connection registration and the native migration directory.
const nativeDirectory = dirname(require.resolve('@medusajs/order'))
const models = toMikroOrmEntities(Object.values(NativeOrderModels))
const moduleModels = Object.fromEntries(models.map(model => [model.name, model]))
const migrationOptions = { moduleName: Modules.ORDER, pathToMigrations: join(nativeDirectory, 'migrations') }

export default {
  ...NativeOrderModule,
  service: OrderCommerceSerializationService,
  loaders: [
    ModulesSdkUtils.mikroOrmConnectionLoaderFactory({ moduleName: Modules.ORDER, moduleModels: models, migrationsPath: migrationOptions.pathToMigrations }),
    ModulesSdkUtils.moduleContainerLoaderFactory({ moduleModels, moduleServices: { OrderService }, moduleRepositories: NativeOrderRepositories }),
    ...(NativeOrderModule.loaders ?? [])
  ],
  runMigrations: ModulesSdkUtils.buildMigrationScript(migrationOptions),
  revertMigration: ModulesSdkUtils.buildRevertMigrationScript(migrationOptions),
  generateMigration: ModulesSdkUtils.buildGenerateMigrationScript({ ...migrationOptions, models })
}
