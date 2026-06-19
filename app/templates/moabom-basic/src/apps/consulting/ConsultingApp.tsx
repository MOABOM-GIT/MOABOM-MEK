import { useState } from 'react';
import { AppTabsShell, type AppTab } from '../_shared';
import { useMoabomSiteDisplayName } from '../../utils/moabomSiteBranding';
import { CONSULTING_GRADIENT } from './consultingTheme';
import { IntroTab } from './tabs/IntroTab';
import { ServicesTab } from './tabs/ServicesTab';
import { SimulationTab } from './tabs/SimulationTab';
import { ContractTab } from './tabs/ContractTab';
import { SIMULATION_DEFAULTS, type SimulationInput } from './simulationModel';

type ConsultingTab = 'intro' | 'services' | 'simulation' | 'contract';

export function ConsultingApp() {
  const hospitalName = useMoabomSiteDisplayName();
  const [activeTab, setActiveTab] = useState<ConsultingTab>('intro');
  const [simInput, setSimInput] = useState<SimulationInput>({ ...SIMULATION_DEFAULTS });

  const tabs: AppTab[] = [
    { key: 'intro', no: '01', icon: 'building', label: '회사 & 비전', content: <IntroTab /> },
    { key: 'services', no: '02', icon: 'diagram-project', label: '360 서비스', content: <ServicesTab /> },
    {
      key: 'simulation',
      no: '03',
      icon: 'chart-line',
      label: '수익 시뮬레이션',
      content: (
        <SimulationTab
          hospitalName={hospitalName}
          input={simInput}
          onInputChange={setSimInput}
          onProceedToContract={() => setActiveTab('contract')}
        />
      ),
    },
    {
      key: 'contract',
      no: '04',
      icon: 'file-signature',
      label: '전자계약',
      content: <ContractTab hospitalName={hospitalName} simInput={simInput} />,
    },
  ];

  return (
    <AppTabsShell
      title="스마트컨설팅 360°"
      subtitle={`${hospitalName} — 번거로운 운영은 맡기고, 환자 케어와 수익에 집중하세요`}
      icon="handshake"
      gradient={CONSULTING_GRADIENT}
      tabs={tabs}
      activeKey={activeTab}
      onActiveKeyChange={key => setActiveTab(key as ConsultingTab)}
    />
  );
}
