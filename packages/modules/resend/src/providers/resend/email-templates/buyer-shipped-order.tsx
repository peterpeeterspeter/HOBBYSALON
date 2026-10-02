interface EmailTemplateProps {
  data: {
    user_name: string
    host: string
    order_id: string
    order_address?: string
    order: {
      id: string
      display_id: string
      trackingNumber: string
      items: any[]
      currency_code: string
      item_total: number
      shipping_methods: {
        amount: number
        name: string
      }[]
      total: number
      email: string
      shipping_address: {
        first_name: string
        last_name: string
        company: string
        address_1: string
        address_2: string
        city: string
        province: string
        postal_code: string
        phone: string
      }
    }
    store_name: string
    storefront_url: string
  }
}

export const BuyerOrderShippedEmailTemplate: React.FC<
  Readonly<EmailTemplateProps>
> = ({ data }) => {
  const orderUrl =
    data.order_address || `${data.host}/account/orders/${data.order.id}`

  return (
    <div>
      <h1>Je bestelling #{data.order.display_id} is verzonden!</h1>
      <p>
        Tracking: <strong>{data.order.trackingNumber}</strong>
      </p>
      <p>Het pakket is onderweg en komt zo bij je toe.</p>
      <div>
        <p>
          <strong>Afleveradres:</strong>
        </p>
        <p>
          {data.order.shipping_address.first_name}{" "}
          {data.order.shipping_address.last_name}
          ,<br />
          {data.order.shipping_address?.company
            ? `${data.order.shipping_address.company}, `
            : ""}
          {data.order.shipping_address.address_1}
          {data.order.shipping_address.address_2},{" "}
          {data.order.shipping_address.postal_code}{" "}
          {data.order.shipping_address.city}
          {data.order.shipping_address.province
            ? `, ${data.order.shipping_address.province}`
            : ""}
          <br />
          {data.order.email}, {data.order.shipping_address.phone}
        </p>
      </div>
      <p>
        <a href={orderUrl}>Bekijk bestelling</a>
        {" — "}
        {orderUrl}
      </p>

      <p>
        Je ontvangt deze e-mail omdat je een aankoop deed op {data.store_name}.
        Vragen? Neem contact op met support.
      </p>
      <div style={{ marginTop: 32 }}>
        <div>Met vriendelijke groet,</div>
        <div style={{ fontWeight: 600 }}>Het {data.store_name}-team</div>
        <div style={{ color: "#888", marginTop: 4 }}>{data.storefront_url}</div>
      </div>
    </div>
  )
}
