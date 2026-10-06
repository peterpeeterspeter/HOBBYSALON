import NativePaymentModule from '@medusajs/payment'
import { AccountHolder, Capture, Payment, PaymentCollection, PaymentProvider, PaymentSession, Refund, RefundReason } from '@medusajs/payment/dist/models'
import PaymentProviderService from './financial-provider'
import { Modules, ModulesSdkUtils, toMikroOrmEntities } from '@medusajs/framework/utils'
import { dirname, join } from 'node:path'
import PaymentCaptureRecoveryService from './service'

// A wrapper changes discovery location; preserve the original native model,
// connection, container, provider and migration infrastructure explicitly.
const nativeDirectory = dirname(require.resolve('@medusajs/payment'))
const models = toMikroOrmEntities([AccountHolder, Capture, Payment, PaymentCollection, PaymentProvider, PaymentSession, Refund, RefundReason])
const moduleModels = Object.fromEntries(models.map(model => [model.name, model]))
const migrationOptions = { moduleName: Modules.PAYMENT, pathToMigrations: join(nativeDirectory, 'migrations') }

export default {
  ...NativePaymentModule,
  service: PaymentCaptureRecoveryService,
  loaders: [
    ModulesSdkUtils.mikroOrmConnectionLoaderFactory({ moduleName: Modules.PAYMENT, moduleModels: models, migrationsPath: migrationOptions.pathToMigrations }),
    ModulesSdkUtils.moduleContainerLoaderFactory({ moduleModels, moduleServices: { PaymentProviderService } }),
    ...(NativePaymentModule.loaders ?? [])
  ],
  runMigrations: ModulesSdkUtils.buildMigrationScript(migrationOptions),
  revertMigration: ModulesSdkUtils.buildRevertMigrationScript(migrationOptions),
  generateMigration: ModulesSdkUtils.buildGenerateMigrationScript({ ...migrationOptions, models })
}
