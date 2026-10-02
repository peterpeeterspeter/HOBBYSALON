import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import * as zod from "zod"

import { Button, Heading, Input, toast } from "@medusajs/ui"
import { useFieldArray, useForm } from "react-hook-form"

import { Form } from "../../../../../components/common/form"
import {
  RouteFocusModal,
  useRouteModal,
} from "../../../../../components/modals"
import { KeyboundForm } from "../../../../../components/utilities/keybound-form"
import { useCreateOrderShipment } from "../../../../../hooks/api"
import {
  ExtendedAdminOrder,
  ExtendedAdminOrderFulfillment,
} from "../../../../../types/order"
import { CreateShipmentSchema } from "./constants"

type OrderCreateFulfillmentFormProps = {
  order: ExtendedAdminOrder
  fulfillment: ExtendedAdminOrderFulfillment
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

export function OrderCreateShipmentForm({
  order,
  fulfillment,
}: OrderCreateFulfillmentFormProps) {
  const { t } = useTranslation()
  const { handleSuccess } = useRouteModal()

  const { mutateAsync: createShipment, isPending: isMutating } =
    useCreateOrderShipment(order.id, fulfillment?.id)

  const form = useForm<zod.infer<typeof CreateShipmentSchema>>({
    defaultValues: {
      labels: [{ tracking_number: "", tracking_url: "", label_url: "" }],
    },
    resolver: zodResolver(CreateShipmentSchema),
  })

  const { fields: labels, append } = useFieldArray({
    name: "labels",
    control: form.control,
  })

  const handleSubmit = form.handleSubmit(async (data) => {
    const labelsPayload = data.labels
      .filter((l) => !!l.tracking_number?.trim())
      .map((l) => {
        const trackingNumber = l.tracking_number.trim()
        const trackingUrlRaw = (l.tracking_url ?? "").trim()
        const trackingUrl =
          trackingUrlRaw && isSafeHttpUrl(trackingUrlRaw)
            ? trackingUrlRaw
            : trackingUrlRaw
              ? ""
              : ""
        if (trackingUrlRaw && !trackingUrl) {
          throw new Error("Tracking-URL moet met http:// of https:// beginnen.")
        }
        return {
          tracking_number: trackingNumber,
          tracking_url: trackingUrl || `https://www.hobbysalon.be/account/orders`,
          label_url: (l.label_url ?? "").trim() || trackingUrl || `https://www.hobbysalon.be/account/orders`,
        }
      })

    if (!labelsPayload.length) {
      toast.error("Vul minstens één trackingnummer in.")
      return
    }

    await createShipment(
      {
        items:
          fulfillment?.items
            ?.map((i) => ({ id: i?.line_item_id, quantity: i.quantity }))
            .filter((item) => !!item.id) ?? [],
        labels: labelsPayload,
      },
      {
        onSuccess: () => {
          toast.success(t("orders.shipment.toastCreated"))
          handleSuccess(`/orders/${order.id}`)
        },
        onError: (e) => {
          toast.error(e.message)
        },
      }
    )
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm
        onSubmit={handleSubmit}
        className="flex h-full flex-col overflow-hidden"
      >
        <RouteFocusModal.Header>
          <div className="flex items-center justify-end gap-x-2">
            <RouteFocusModal.Close asChild>
              <Button size="small" variant="secondary">
                {t("actions.cancel")}
              </Button>
            </RouteFocusModal.Close>
            <Button size="small" type="submit" isLoading={isMutating}>
              {t("actions.save")}
            </Button>
          </div>
        </RouteFocusModal.Header>
        <RouteFocusModal.Body className="flex h-full w-full flex-col items-center divide-y overflow-y-auto">
          <div className="flex size-full flex-col items-center overflow-auto p-16">
            <div className="flex w-full max-w-[736px] flex-col justify-center px-2 pb-2">
              <div className="flex flex-col divide-y">
                <div className="flex flex-1 flex-col">
                  <Heading className="mb-4">
                    {t("orders.shipment.title")}
                  </Heading>

                  {labels.map((label, index) => (
                    <div key={label.id} className="mb-6 space-y-3">
                      <Form.Field
                        control={form.control}
                        name={`labels.${index}.tracking_number`}
                        render={({ field }) => {
                          return (
                            <Form.Item>
                              <Form.Label>Trackingnummer</Form.Label>
                              <Form.Control>
                                <Input
                                  {...field}
                                  placeholder="3SABCD123456789"
                                />
                              </Form.Control>
                              <Form.ErrorMessage />
                            </Form.Item>
                          )
                        }}
                      />
                      <Form.Field
                        control={form.control}
                        name={`labels.${index}.tracking_url`}
                        render={({ field }) => {
                          return (
                            <Form.Item>
                              <Form.Label>Tracking-URL (optioneel)</Form.Label>
                              <Form.Control>
                                <Input
                                  {...field}
                                  placeholder="https://www.dhl.com/shipment/1234567890"
                                />
                              </Form.Control>
                              <Form.ErrorMessage />
                            </Form.Item>
                          )
                        }}
                      />
                    </div>
                  ))}

                  <Button
                    type="button"
                    onClick={() =>
                      append({
                        tracking_number: "",
                        tracking_url: "",
                        label_url: "",
                      })
                    }
                    className="self-end"
                    variant="secondary"
                  >
                    Tracking toevoegen
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </RouteFocusModal.Body>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
