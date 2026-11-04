import { Container, Heading, Text } from "@medusajs/ui"

const STEPS = [
  {
    title: "Maak een locatie",
    text: "Dit is het adres waarvandaan je verstuurt. Meestal is dat je eigen adres.",
  },
  {
    title: "Voeg een verzendzone toe",
    text: "Kies de landen waarheen je verstuurt, bijvoorbeeld België en Nederland.",
  },
  {
    title: "Voeg een verzendoptie toe",
    text: "Geef de optie een naam en een prijs. Bijvoorbeeld: “Pakket, €6,95” of “Afhalen, gratis”.",
  },
]

/** Plain-language setup steps, shown on top of the shipping page. */
export const ShippingGuide = () => (
  <Container className="flex flex-col gap-y-4 px-6 py-4">
    <div>
      <Heading level="h2">Zo stel je verzending in</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Klanten kunnen je producten alleen bestellen als je minstens één
        verzendoptie hebt. Dat doe je in 3 stappen.
      </Text>
    </div>
    <ol className="flex flex-col gap-y-3">
      {STEPS.map((step, index) => (
        <li key={step.title} className="flex items-start gap-x-3">
          <span className="bg-ui-bg-base-hover text-ui-fg-base flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
            {index + 1}
          </span>
          <div>
            <Text size="small" weight="plus">
              {step.title}
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              {step.text}
            </Text>
          </div>
        </li>
      ))}
    </ol>
    <Text size="small" className="text-ui-fg-subtle">
      Verstuur je alle producten op dezelfde manier? Dan zijn verzendgroepen niet
      nodig. Het systeem maakt zelf een standaardgroep voor je aan.
    </Text>
  </Container>
)

/** Explains the zones and options section on a location page. */
export const ShippingZonesHint = () => (
  <Container className="flex flex-col gap-y-1 px-6 py-4">
    <Heading level="h2">Wat doe je op deze pagina?</Heading>
    <Text size="small" className="text-ui-fg-subtle">
      Hieronder voeg je een zone toe met de landen waarheen je verstuurt. In
      die zone maak je verzendopties met een naam en een prijs. Zonder
      verzendoptie kan een klant niet afrekenen.
    </Text>
  </Container>
)

/** Explains what a shipping group (profile) is. */
export const ShippingProfilesHint = () => (
  <Container className="flex flex-col gap-y-1 px-6 py-4">
    <Heading level="h2">Wat is een verzendgroep?</Heading>
    <Text size="small" className="text-ui-fg-subtle">
      Een verzendgroep is een groep producten die je op dezelfde manier
      verstuurt. Bijvoorbeeld “Klein pakket” voor garen en kralen, en “Groot
      pakket” voor een weefgetouw. Elke verzendoptie hoort bij één groep.
    </Text>
    <Text size="small" className="text-ui-fg-subtle">
      Verstuur je alles op dezelfde manier? Dan hoef je hier niets te doen.
    </Text>
  </Container>
)
