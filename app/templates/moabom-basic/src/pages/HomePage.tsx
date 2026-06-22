import React from 'react';
import { MoabomUiI18nProvider } from '../i18n/MoabomUiI18nProvider';
import { HomePageInner } from './home/HomePageInner';

export type { HomePageProps } from '../shell/moaShellTypes';

export const HomePage: React.FC<import('../shell/moaShellTypes').HomePageProps> = props => (
  <MoabomUiI18nProvider>
    <HomePageInner {...props} />
  </MoabomUiI18nProvider>
);
