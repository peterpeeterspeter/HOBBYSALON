import { Heading, Input, RadioGroup, Text } from '@medusajs/ui';
import { UseFormReturn } from 'react-hook-form';

import { Form } from '../../../../../components/common/form';
import { Combobox } from '../../../../../components/inputs/combobox';
import { useComboboxData } from '../../../../../hooks/use-combobox-data';
import { fetchQuery } from '../../../../../lib/client';
import { VendorExtendedAdminServiceZone } from '../../../../../types/stock-location';
import { FulfillmentSetType, ShippingOptionPriceType } from '../../../common/constants';
import { CreateShippingOptionSchema } from './schema';

type CreateShippingOptionDetailsFormProps = {
  form: UseFormReturn<CreateShippingOptionSchema>;
  isReturn?: boolean;
  zone: VendorExtendedAdminServiceZone;
  type: FulfillmentSetType;
};

export const CreateShippingOptionDetailsForm = ({
  form,
  isReturn = false,
  zone,
  type
}: CreateShippingOptionDetailsFormProps) => {
  const isPickup = type === FulfillmentSetType.Pickup;

  const shippingProfiles = useComboboxData({
    queryFn: () =>
      fetchQuery(`/vendor/shipping-profiles`, {
        method: 'GET'
      }),
    queryKey: ['shipping_profiles_create_shipping_option'],
    getOptions: data =>
      (data.shipping_profiles || []).map((profile: any) => ({
        label: profile.name.includes(':') ? profile.name.split(':')[1] : profile.name,
        value: profile.id
      }))
  });

  // const fulfillmentProviders = useComboboxData({
  //   queryFn: (params) =>
  //     sdk.admin.fulfillmentProvider.list({
  //       ...params,
  //       stock_location_id: locationId,
  //     }),
  //   queryKey: ['fulfillment_providers'],
  //   getOptions: (data) =>
  //     data.fulfillment_providers.map((provider) => ({
  //       label: formatProvider(provider.id),
  //       value: provider.id,
  //     })),
  // });

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto">
      <div className="flex w-full max-w-[720px] flex-col gap-y-8 px-6 py-16">
        <div>
          <Heading>
            {isPickup
              ? `Afhaaloptie toevoegen voor ${zone.name}`
              : isReturn
                ? `Retouroptie toevoegen voor ${zone.name}`
                : `Verzendoptie toevoegen voor ${zone.name}`}
          </Heading>
          <Text
            size="small"
            className="text-ui-fg-subtle"
          >
            Een verzendoptie is een manier om een bestelling bij je klant te
            krijgen, met een naam en een prijs. De klant kiest de optie bij het
            afrekenen.
          </Text>
        </div>

        <div className="bg-ui-bg-subtle border-ui-border-base flex flex-col gap-y-2 rounded-lg border px-4 py-3">
          <Text size="small" weight="plus">
            Zo vul je dit in
          </Text>
          <ol className="text-ui-fg-subtle list-decimal pl-5 text-sm">
            {!isPickup && (
              <li>Kies bij prijstype “Vaste prijs”, tenzij je een koppeling met een vervoerder hebt.</li>
            )}
            <li>Geef de optie een naam die je klant begrijpt, bijvoorbeeld “Pakket België en Nederland”.</li>
            <li>Kies de verzendgroep. Heb je er maar één, kies dan die.</li>
            <li>Ga verder en vul de prijs in euro in.</li>
          </ol>
        </div>

        {!isPickup && (
          <Form.Field
            control={form.control}
            name="price_type"
            render={({ field }) => {
              return (
                <Form.Item>
                  <Form.Label>
                    Prijstype
                  </Form.Label>
                  <Form.Control>
                    <RadioGroup
                      className="grid grid-cols-1 gap-4 md:grid-cols-2"
                      {...field}
                      onValueChange={field.onChange}
                    >
                      <RadioGroup.ChoiceBox
                        className="flex-1"
                        value={ShippingOptionPriceType.FlatRate}
                        label="Vaste prijs"
                        description="De klant betaalt altijd hetzelfde bedrag, bijvoorbeeld €6,95. Kies dit als je niet zeker bent."
                      />
                      <RadioGroup.ChoiceBox
                        className="flex-1"
                        value={ShippingOptionPriceType.Calculated}
                        label="Berekende prijs"
                        description="Een vervoerder berekent de prijs bij het afrekenen. Alleen kiezen als je een koppeling met een vervoerder hebt."
                      />
                    </RadioGroup>
                  </Form.Control>
                  <Form.ErrorMessage />
                </Form.Item>
              );
            }}
          />
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Field
            control={form.control}
            name="name"
            render={({ field }) => {
              return (
                <Form.Item>
                  <Form.Label>Naam van de verzendoptie</Form.Label>
                  <Form.Control>
                    <Input {...field} placeholder="Bijvoorbeeld: Pakket België en Nederland" />
                  </Form.Control>
                  <Form.Hint>Dit ziet je klant bij het afrekenen.</Form.Hint>
                  <Form.ErrorMessage />
                </Form.Item>
              );
            }}
          />
          <Form.Field
            control={form.control}
            name="shipping_profile_id"
            render={({ field }) => {
              return (
                <Form.Item>
                  <Form.Label>Verzendgroep</Form.Label>
                  <Form.Control>
                    <Combobox
                      {...field}
                      options={shippingProfiles.options}
                      searchValue={shippingProfiles.searchValue}
                      onSearchValueChange={shippingProfiles.onSearchValueChange}
                      disabled={shippingProfiles.disabled}
                    />
                  </Form.Control>
                  <Form.Hint>
                    Voor welke producten geldt deze optie? Kies de groep van die producten.
                  </Form.Hint>
                  <Form.ErrorMessage />
                </Form.Item>
              );
            }}
          />
        </div>

        {/* <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <Form.Field
            control={form.control}
            name='provider_id'
            render={({ field }) => {
              return (
                <Form.Item>
                  <Form.Label
                    tooltip={t(
                      'stockLocations.fulfillmentProviders.shippingOptionsTooltip'
                    )}
                  >
                    {t(
                      'stockLocations.shippingOptions.fields.provider'
                    )}
                  </Form.Label>
                  <Form.Control>
                    <Combobox
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        form.setValue(
                          'fulfillment_option_id',
                          ''
                        );
                      }}
                      options={fulfillmentProviders.options}
                      searchValue={
                        fulfillmentProviders.searchValue
                      }
                      onSearchValueChange={
                        fulfillmentProviders.onSearchValueChange
                      }
                      disabled={
                        fulfillmentProviders.disabled
                      }
                    />
                  </Form.Control>
                  <Form.ErrorMessage />
                </Form.Item>
              );
            }}
          />

          <Form.Field
            control={form.control}
            name='fulfillment_option_id'
            render={({ field }) => {
              return (
                <Form.Item>
                  <Form.Label>
                    {t(
                      'stockLocations.shippingOptions.fields.fulfillmentOption'
                    )}
                  </Form.Label>
                  <Form.Control>
                    <Select
                      {...field}
                      onValueChange={field.onChange}
                      disabled={!selectedProviderId}
                      key={selectedProviderId}
                    >
                      <Select.Trigger ref={field.ref}>
                        <Select.Value />
                      </Select.Trigger>

                      <Select.Content>
                        {fulfillmentProviderOptions
                          ?.filter(
                            (fo) =>
                              !!fo.is_return === isReturn
                          )
                          .map((option) => (
                            <Select.Item
                              value={option.id}
                              key={option.id}
                            >
                              {option.name || option.id}
                            </Select.Item>
                          ))}
                      </Select.Content>
                    </Select>
                  </Form.Control>
                  <Form.ErrorMessage />
                </Form.Item>
              );
            }}
          />
        </div> */}

        {/* <Divider />
        <SwitchBox
          control={form.control}
          name="enabled_in_store"
          label={t("stockLocations.shippingOptions.fields.enableInStore.label")}
          description={t(
            "stockLocations.shippingOptions.fields.enableInStore.hint"
          )}
        /> */}
      </div>
    </div>
  );
};
