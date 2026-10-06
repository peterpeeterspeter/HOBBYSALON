import NativeNotificationModule from '@medusajs/notification'
import { Notification, NotificationProvider } from '@medusajs/notification/dist/models'
import { NotificationProviderService } from '@medusajs/notification/dist/services'
import { Modules, ModulesSdkUtils, toMikroOrmEntities } from '@medusajs/framework/utils'
import { dirname, join } from 'node:path'
import NotificationRetryIdentityService from './service'

// Local discovery cannot find resources adjacent to the native package. Build
// its standard infrastructure explicitly; do not switch discoveryPath back to
// native, which would also silently switch the selected service back to native.
const nativeDirectory = dirname(require.resolve('@medusajs/notification'))
const models = toMikroOrmEntities([Notification, NotificationProvider])
const moduleModels = Object.fromEntries(models.map((model) => [model.name, model]))
const migrationOptions = {
  moduleName: Modules.NOTIFICATION,
  pathToMigrations: join(nativeDirectory, 'migrations')
}

export default {
  ...NativeNotificationModule,
  service: NotificationRetryIdentityService,
  loaders: [
    ModulesSdkUtils.mikroOrmConnectionLoaderFactory({
      moduleName: Modules.NOTIFICATION,
      moduleModels: models,
      migrationsPath: migrationOptions.pathToMigrations
    }),
    ModulesSdkUtils.moduleContainerLoaderFactory({
      moduleModels,
      moduleServices: { NotificationProviderService }
    }),
    ...(NativeNotificationModule.loaders ?? [])
  ],
  runMigrations: ModulesSdkUtils.buildMigrationScript(migrationOptions),
  revertMigration: ModulesSdkUtils.buildRevertMigrationScript(migrationOptions),
  generateMigration: ModulesSdkUtils.buildGenerateMigrationScript({
    ...migrationOptions, models
  })
}
