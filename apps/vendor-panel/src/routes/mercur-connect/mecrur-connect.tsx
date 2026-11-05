import { useState } from 'react';

import { RocketLaunch } from '@medusajs/icons';

import { MercurConnectItem } from './components/mercur-connect-item/mercur-connect-item';
import { MercurConnectModal } from './components/mercur-connect-modal/mercur-connect-modal';
import { mercurConnectItems } from './const';

export const MercurConnect = () => {
  const [openPrompt, setOpenPrompt] = useState(false);

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-3">
        {mercurConnectItems.map(item => (
          <MercurConnectItem
            key={item.name}
            item={item}
            onOpenPrompt={setOpenPrompt}
          />
        ))}
        <MercurConnectItem
          item={{
            name: 'Binnenkort meer',
            description:
              'We werken aan meer koppelingen. Vragen? Neem contact op.',
            enabled: false,
            icon: <RocketLaunch />,
            provider: 'more'
          }}
        />
      </div>
      <MercurConnectModal
        open={openPrompt}
        onOpenChange={setOpenPrompt}
        testId="mercur-connect-modal"
      />
    </>
  );
};
