import { useState } from 'react';
import { AppTabsShell, type AppTab } from '../_shared';
import { IntroTab } from './tabs/IntroTab';
import { ServicesTab } from './tabs/ServicesTab';
import { SimulationTab } from './tabs/SimulationTab';
import { ContractTab } from './tabs/ContractTab';
import { SIMULATION_DEFAULTS, type SimulationInput } from './simulationModel';

type ConsultingTab = 'intro' | 'services' | 'simulation' | 'contract';

export function ConsultingApp() {
  const [activeTab, setActiveTab] = useState<ConsultingTab>('intro');
  // 시뮬레이션 입력값은 앱 레벨에서 보관 → 시뮬레이션 탭과 전자계약 탭이 공유.
  const [simInput, setSimInput] = useState<SimulationInput>({ ...SIMULATION_DEFAULTS });

  const tabs: AppTab[] = [
    { key: 'intro', no: '01', icon: 'building', label: '회사 & 비전소개', content: <IntroTab /> },
    { key: 'services', no: '02', icon: 'diagram-project', label: '360 서비스 소개', content: <ServicesTab /> },
    {
      key: 'simulation',
      no: '03',
      icon: 'chart-line',
      label: '맞춤형 수익성 시뮬레이션',
      content: (
        <SimulationTab
          input={simInput}
          onInputChange={setSimInput}
          onProceedToContract={() => setActiveTab('contract')}
        />
      ),
    },
    { key: 'contract', no: '04', icon: 'file-signature', label: '전자계약서', content: <ContractTab simInput={simInput} /> },
  ];

  return (
    <AppTabsShell
      title="smart care 360°"
      subtitle="영업용 컨설팅 — 병원 방문 실시간 의사결정 지원"
      icon="handshake"
      gradient="linear-gradient(135deg,#0ea5e9,#1d4ed8)"
      tabs={tabs}
      activeKey={activeTab}
      onActiveKeyChange={key => setActiveTab(key as ConsultingTab)}
    />
  );
}
