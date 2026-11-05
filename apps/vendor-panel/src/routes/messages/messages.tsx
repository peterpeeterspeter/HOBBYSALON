import { Container, Heading, Text } from "@medusajs/ui"
import { Inbox } from "@talkjs/react"

export const Messages = () => {
  return (
    <Container className="divide-y p-0 min-h-[700px]">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Berichten</Heading>
        </div>
      </div>

      <div className="px-6 py-4 h-[655px]">
        {__TALK_JS_APP_ID__ ? (
          <Inbox className="h-full" />
        ) : (
          <div className="flex flex-col items-center w-full h-full justify-center">
            <Heading>Berichten zijn nog niet actief</Heading>
            <Text className="text-ui-fg-subtle mt-4" size="small">
              Neem contact op met Hobbysalon om berichten te activeren.
            </Text>
          </div>
        )}
      </div>
    </Container>
  )
}
