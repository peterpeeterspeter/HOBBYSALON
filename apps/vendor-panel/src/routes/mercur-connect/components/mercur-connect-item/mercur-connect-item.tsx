import { Avatar, Button, Container, Heading, StatusBadge, Text } from '@medusajs/ui';
import { Link } from 'react-router-dom';

import { IconAvatar } from '../../../../components/common/icon-avatar';
import type { MercurConnectItemConfig } from '../../const';

export const MercurConnectItem = ({
  item,
  testId = 'mercur-connect-item',
  onOpenPrompt
}: {
  item: MercurConnectItemConfig;
  testId?: string;
  onOpenPrompt?: (open: boolean) => void;
}) => {
  const fallback = item.name.charAt(0).toUpperCase();
  const isIconString = typeof item.icon === 'string';

  return (
    <Container className="flex h-full flex-col justify-between gap-4">
      <div className="flex flex-col gap-3">
        <div>
          {isIconString ? (
            <Avatar
              size="xlarge"
              src={item.icon as string}
              fallback={fallback}
              variant="squared"
              data-testid={`${testId}-avatar`}
            />
          ) : (
            <IconAvatar
              size="xlarge"
              data-testid={`${testId}-avatar`}
            >
              {item.icon}
            </IconAvatar>
          )}
        </div>
        <div>
          <Heading level="h2">{item.name}</Heading>
          <Text
            size="small"
            className="text-ui-fg-subtle"
          >
            {item.description}
          </Text>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {item.provider === 'more' ? (
          <Link
            to="https://www.mercurjs.com/connect"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="secondary"
              size="small"
              data-testid={`${testId}-contact-us-button`}
            >
              Contact us
            </Button>
          </Link>
        ) : item.enabled && item.href ? (
          <>
            <StatusBadge
              color="green"
              data-testid={`${testId}-enabled-badge`}
            >
              Enabled
            </StatusBadge>
            <Link to={item.href}>
              <Button
                variant="secondary"
                size="small"
                data-testid={`${testId}-open-button`}
              >
                {item.actionLabel ?? 'Open'}
              </Button>
            </Link>
          </>
        ) : item.enabled ? (
          <StatusBadge
            color="green"
            data-testid={`${testId}-enabled-badge`}
          >
            Enabled
          </StatusBadge>
        ) : (
          <Button
            variant="secondary"
            size="small"
            onClick={() => onOpenPrompt?.(true)}
            data-testid={`${testId}-enable-button`}
          >
            Enable
          </Button>
        )}
      </div>
    </Container>
  );
};
