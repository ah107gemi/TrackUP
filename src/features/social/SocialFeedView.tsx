import React from 'react';
import { FriendsPage } from './FriendsPage';

interface SocialFeedViewProps {
  onSelectTitle?: (titleId: string) => void;
}

export const SocialFeedView: React.FC<SocialFeedViewProps> = ({ onSelectTitle }) => {
  return <FriendsPage onSelectTitle={onSelectTitle} />;
};

export { FriendsPage };
