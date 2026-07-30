// AUTO-GENERATED FILE - DO NOT EDIT

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

export interface ExtensionTab {
  target: string;
  id: string;
  label: string;
  component: React.ComponentType<any>;
}

import BuyerQualificationsTab from '@herobm/extension-ma/ui/actors/BuyerQualificationsTab';
import SellerQualificationsTab from '@herobm/extension-ma/ui/actors/SellerQualificationsTab';
import StrategicIntelligenceTab from '@herobm/extension-ma/ui/actors/StrategicIntelligenceTab';
import FeedbackTab from '@herobm/extension-ma/ui/projects/FeedbackTab';

export const extensionTabs: ExtensionTab[] = [
  {
    target: 'actors', // e.g. 'projects'
    id: 'ma-buyerqualificationstab',
    label: 'M&A: Buy',
    component: BuyerQualificationsTab
  },
  {
    target: 'actors', // e.g. 'projects'
    id: 'ma-sellerqualificationstab',
    label: 'M&A: Sell',
    component: SellerQualificationsTab
  },
  {
    target: 'actors', // e.g. 'projects'
    id: 'ma-strategicintelligencetab',
    label: 'M&A: Intel',
    component: StrategicIntelligenceTab
  },
  {
    target: 'projects', // e.g. 'projects'
    id: 'ma-feedbacktab',
    label: 'Feedback',
    component: FeedbackTab
  }
];
