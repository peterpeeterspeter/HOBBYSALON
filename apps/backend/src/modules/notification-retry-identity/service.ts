import NativeNotificationModule from '@medusajs/notification'
import type { Context, NotificationTypes } from '@medusajs/framework/types'
import { NotificationStatus } from '@medusajs/framework/utils'

/** Medusa 2.11.3 identity-only workaround; delivery/skip/update stay native.
 * No lock or claim: concurrent retries and uncertain pending recovery remain gates.
 */
export default class NotificationRetryIdentityService extends NativeNotificationModule.service {
  protected async createNotifications_(
    data: NotificationTypes.CreateNotificationDTO[],
    sharedContext: Context = {}
  ) {
    const keys = data.map((entry) => entry.idempotency_key).filter(Boolean) as string[]
    if (!keys.length) return super.createNotifications_(data, sharedContext)

    // Native batches cannot safely distinguish two entries with the same key.
    if (new Set(keys).size !== keys.length) {
      throw new Error('Notification retry identity: duplicate input idempotency key')
    }
    // One extra result suffices to detect ambiguous stored identities, without
    // silently accepting the internal service's default page size.
    const records = await this.notificationService_.list(
      { idempotency_key: keys },
      { take: keys.length + 1 },
      sharedContext
    )
    const byKey = new Map<string, (typeof records)[number]>()
    for (const record of records) {
      if (!record.id || !record.idempotency_key || !keys.includes(record.idempotency_key)) {
        throw new Error('Notification retry identity: missing or invalid persisted identity')
      }
      if (byKey.has(record.idempotency_key)) {
        throw new Error('Notification retry identity: duplicate persisted idempotency key')
      }
      byKey.set(record.idempotency_key, record)
    }
    const normalized = data.map((entry) => {
      if (!entry.idempotency_key) return entry
      const persisted = byKey.get(entry.idempotency_key)
      // A new key is an initial delivery, not a historical retry. An explicit
      // retry identity without its row must not silently create another row.
      if (!persisted && 'id' in entry) {
        throw new Error('Notification retry identity: explicit identity has no persisted record')
      }
      // Leave native pending/success skips untouched, and never mutate the DTO.
      return persisted?.status === NotificationStatus.FAILURE
        ? { ...entry, id: persisted.id }
        : entry
    })
    return super.createNotifications_(normalized, sharedContext)
  }
}
