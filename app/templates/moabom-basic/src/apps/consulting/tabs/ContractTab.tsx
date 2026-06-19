import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/basic/Button';
import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
import { Span } from '../../../components/basic/Span';
import { SignaturePad, type SignaturePadHandle } from '../../_shared';
import {
  fetchContracts,
  storeContract,
  type ContractSummary,
} from '../consultingApi';
import {
  formatKrwManwon,
  runSimulation,
  toServerInput,
  type SimulationInput,
} from '../simulationModel';
import { APP_STACK_CLASS, APP_STACK_GRID_CLASS } from '../../appShellTypography';
import {
  CONSULTING_MINT_TEXT,
  CONSULTING_ORANGE_TEXT,
  CONSULTING_PANEL,
  CONSULTING_PRIMARY_CTA,
} from '../consultingTheme';

interface ContractTabProps {
  hospitalName: string;
  simInput: SimulationInput;
}

interface FormState {
  hospitalName: string;
  representativeName: string;
  contact: string;
  businessNumber: string;
  plan: string;
  signerName: string;
  memo: string;
}

const EMPTY_FORM: FormState = {
  hospitalName: '',
  representativeName: '',
  contact: '',
  businessNumber: '',
  plan: '스마트케어360 통합 렌탈',
  signerName: '',
  memo: '',
};

export function ContractTab({ hospitalName, simInput }: ContractTabProps) {
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    hospitalName: hospitalName.trim(),
  }));
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const padRef = useRef<SignaturePadHandle>(null);

  const result = runSimulation(simInput);
  const smartCum = result.smart.cumulativeEbit[result.smart.cumulativeEbit.length - 1] ?? 0;
  const selfCum = result.self.cumulativeEbit[result.self.cumulativeEbit.length - 1] ?? 0;

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchContracts();
      setContracts(items);
    } catch {
      // 미인증/네트워크 오류 시 목록은 비워둔다(데모 환경 허용).
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    if (hospitalName.trim() !== '') {
      setForm(prev => (prev.hospitalName.trim() !== '' ? prev : { ...prev, hospitalName: hospitalName.trim() }));
    }
  }, [hospitalName]);

  const submit = async () => {
    setMessage(null);
    if (!form.hospitalName.trim()) {
      setMessage({ type: 'err', text: '병원명을 입력해 주세요.' });
      return;
    }
    if (!hasSignature) {
      setMessage({ type: 'err', text: '서명 후 계약을 확정해 주세요.' });
      return;
    }
    setSaving(true);
    try {
      const signature = padRef.current?.toDataURL('image/png') ?? null;
      await storeContract({
        hospital_name: form.hospitalName.trim(),
        representative_name: form.representativeName.trim() || null,
        contact: form.contact.trim() || null,
        business_number: form.businessNumber.trim() || null,
        plan: form.plan.trim() || null,
        signer_name: form.signerName.trim() || null,
        memo: form.memo.trim() || null,
        simulation_input: toServerInput(simInput),
        signature,
      });
      setMessage({ type: 'ok', text: '전자계약이 저장되었습니다.' });
      setForm({ ...EMPTY_FORM, hospitalName: hospitalName.trim() });
      padRef.current?.clear();
      void loadContracts();
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof FormState, label: string, placeholder: string, required = false) => (
    <label className="flex flex-col gap-1">
      <Span className="text-xs font-bold text-muted">
        {label}{required && <Span className="ml-0.5 text-[#fe8540]">*</Span>}
      </Span>
      <input
        type="text"
        className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-primary outline-none focus:border-blue-400 dark:border-white/10 dark:bg-slate-800"
        value={form[key]}
        placeholder={placeholder}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <Div className={APP_STACK_CLASS}>
      <Div className={`${CONSULTING_PANEL} ${APP_STACK_CLASS}`}>
        <Div className="flex items-center gap-2 text-lg font-bold text-primary">
          <Icon name="file-signature" className="text-[#479ee2]" /> 스마트케어360 도입 계약
        </Div>
        <Div className="rounded-2xl border border-[#27bfc1]/25 bg-[#27bfc1]/8 p-4 text-sm dark:border-[#27bfc1]/25 dark:bg-[#27bfc1]/8">
          <Div className="font-bold text-primary">시뮬레이션 요약 ({simInput.years}년 누적)</Div>
          <Div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[#0f2d3a] dark:text-slate-200">
            <Span>직접 운영: <Span className={`font-bold ${CONSULTING_ORANGE_TEXT}`}>{formatKrwManwon(selfCum)}</Span></Span>
            <Span>스마트케어360: <Span className={`font-bold ${CONSULTING_MINT_TEXT}`}>{formatKrwManwon(smartCum)}</Span></Span>
          </Div>
        </Div>
      </Div>

      <Div className={`${CONSULTING_PANEL} ${APP_STACK_CLASS}`}>
        <Div className={`${APP_STACK_GRID_CLASS} grid grid-cols-1 @md:grid-cols-2`}>
          {field('hospitalName', '병원명', hospitalName || '병원명', true)}
          {field('representativeName', '대표자/원장명', '예) 홍길동')}
          {field('contact', '연락처', '예) 02-1234-5678')}
          {field('businessNumber', '사업자등록번호', '예) 123-45-67890')}
          {field('plan', '요금제/플랜', '스마트케어360 통합 렌탈')}
          {field('signerName', '서명자명', '서명하는 분의 성함')}
        </Div>
        <label className="flex flex-col gap-1">
          <Span className="text-xs font-bold text-muted">특이사항 메모</Span>
          <textarea
            className="min-h-[64px] resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-primary outline-none focus:border-blue-400 dark:border-white/10 dark:bg-slate-800"
            value={form.memo}
            placeholder="협의 내용, 특약 등"
            onChange={e => setForm(prev => ({ ...prev, memo: e.target.value }))}
          />
        </label>
      </Div>

      {/* 전자서명 패드 */}
      <Div className={`${CONSULTING_PANEL} ${APP_STACK_CLASS}`}>
        <Div className="flex items-center justify-between">
          <Div className="flex items-center gap-2 text-lg font-bold text-primary">
            <Icon name="signature" className="text-[#479ee2]" /> 전자서명
          </Div>
          <Button variant="secondary" size="sm" onClick={() => padRef.current?.clear()} className="!rounded-xl">
            <Icon name="eraser" size="sm" className="mr-1" /> 지우기
          </Button>
        </Div>
        <Div className="text-xs text-muted">태블릿 전용 펜 또는 손가락으로 아래 박스 내에 서명해 주십시오.</Div>
        <Div>
          <SignaturePad ref={padRef} onSignatureChange={setHasSignature} />
        </Div>
      </Div>

      {message && (
        <Div
          className={`rounded-2xl px-4 py-3 text-sm font-bold ${
            message.type === 'ok'
              ? 'bg-[#87c426]/12 text-[#4f7f12] dark:text-[#a7dd58]'
              : 'bg-[#fe8540]/10 text-[#8a3a13] dark:text-[#ffbf98]'
          }`}
        >
          <Icon name={message.type === 'ok' ? 'check-circle' : 'circle-exclamation'} size="sm" className="mr-1" />
          {message.text}
        </Div>
      )}

      <Button
        variant="primary"
        size="large"
        className={`w-full !rounded-2xl ${CONSULTING_PRIMARY_CTA}`}
        onClick={submit}
        disabled={saving}
      >
        <Icon name={saving ? 'spinner' : 'circle-check'} spin={saving} className="mr-2" />
        {saving ? '저장 중…' : '계약 확정'}
      </Button>

      {/* 저장된 계약 목록 */}
      <Div className={`${CONSULTING_PANEL} ${APP_STACK_CLASS}`}>
        <Div className="flex items-center justify-between">
          <Div className="text-lg font-bold text-primary">체결 계약 내역</Div>
          <Button variant="secondary" size="sm" onClick={() => void loadContracts()} className="!rounded-xl">
            <Icon name="rotate" size="sm" spin={loading} />
          </Button>
        </Div>
        {contracts.length === 0 ? (
          <Div className="rounded-2xl bg-black/5 px-4 py-6 text-center text-sm text-muted dark:bg-[#479ee2]/8">
            아직 체결된 계약이 없습니다.
          </Div>
        ) : (
          <Div className="flex flex-col gap-2">
            {contracts.map(c => (
              <Div key={c.id} className="flex items-center justify-between rounded-2xl bg-black/5 px-4 py-3 dark:bg-[#479ee2]/8">
                <Div>
                  <Div className="text-sm font-bold text-primary">{c.hospital_name}</Div>
                  <Div className="text-xs text-muted">
                    {c.plan ?? '-'} · {c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR') : ''}
                  </Div>
                </Div>
                <Span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    c.status === 'signed'
                      ? 'bg-[#87c426]/15 text-[#4f7f12] dark:text-[#a7dd58]'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {c.status === 'signed' ? '서명 완료' : '작성 중'}
                </Span>
              </Div>
            ))}
          </Div>
        )}
      </Div>
    </Div>
  );
}
