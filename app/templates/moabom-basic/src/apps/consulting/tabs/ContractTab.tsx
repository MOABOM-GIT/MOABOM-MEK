import { useCallback, useEffect, useRef, useState } from 'react';
import { Div } from '../../../components/basic/Div';
import { Icon } from '../../../components/basic/Icon';
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
      // 미인증/네트워크 오류 시 목록은 비워둔다.
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
    <label className="moa-consult-field">
      <span className="moa-consult-field__label">
        {label}
        {required && ' *'}
      </span>
      <input
        type="text"
        className="moa-consult-input"
        value={form[key]}
        placeholder={placeholder}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <Div className="moa-consult-section">
      <section className="moa-consult-card">
        <Div className="moa-consult-card__head">
          <span className="moa-consult-card__head-icon">
            <Icon name="file-signature" />
          </span>
          스마트케어360 도입 계약
        </Div>
        <Div className="moa-consult-summary">
          <strong>시뮬레이션 요약 ({simInput.years}년 누적)</strong>
          <Div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            <span>
              직접 운영: <strong className="text-orange-600 dark:text-orange-300">{formatKrwManwon(selfCum)}</strong>
            </span>
            <span>
              스마트케어360: <strong className="text-teal-700 dark:text-teal-300">{formatKrwManwon(smartCum)}</strong>
            </span>
          </Div>
        </Div>
      </section>

      <section className="moa-consult-card">
        <Div className="moa-consult-card__head">
          <span className="moa-consult-card__head-icon">
            <Icon name="pen-to-square" />
          </span>
          계약 정보
        </Div>
        <Div className="moa-consult-form-grid">
          {field('hospitalName', '병원명', hospitalName || '병원명', true)}
          {field('representativeName', '대표자/원장명', '예) 홍길동')}
          {field('contact', '연락처', '예) 02-1234-5678')}
          {field('businessNumber', '사업자등록번호', '예) 123-45-67890')}
          {field('plan', '요금제/플랜', '스마트케어360 통합 렌탈')}
          {field('signerName', '서명자명', '서명하는 분의 성함')}
        </Div>
        <label className="moa-consult-field">
          <span className="moa-consult-field__label">특이사항 메모</span>
          <textarea
            className="moa-consult-input moa-consult-textarea"
            value={form.memo}
            placeholder="협의 내용, 특약 등"
            onChange={e => setForm(prev => ({ ...prev, memo: e.target.value }))}
          />
        </label>
      </section>

      <section className="moa-consult-card">
        <Div className="flex items-center justify-between gap-2">
          <Div className="moa-consult-card__head" style={{ marginBottom: 0 }}>
            <span className="moa-consult-card__head-icon">
              <Icon name="signature" />
            </span>
            전자서명
          </Div>
          <button type="button" className="moa-consult-btn" onClick={() => padRef.current?.clear()}>
            <Icon name="eraser" size="sm" /> 지우기
          </button>
        </Div>
        <p className="moa-consult-lead">태블릿 펜 또는 손가락으로 아래 영역에 서명해 주세요.</p>
        <SignaturePad ref={padRef} onSignatureChange={setHasSignature} />
      </section>

      {message && (
        <Div className={`moa-consult-alert moa-consult-alert--${message.type === 'ok' ? 'ok' : 'err'}`}>
          <Icon name={message.type === 'ok' ? 'check-circle' : 'circle-exclamation'} size="sm" className="mr-1" />
          {message.text}
        </Div>
      )}

      <button
        type="button"
        className="moa-consult-btn moa-consult-btn--primary moa-consult-btn--wide"
        onClick={submit}
        disabled={saving}
      >
        <Icon name={saving ? 'spinner' : 'circle-check'} spin={saving} />
        {saving ? '저장 중…' : '계약 확정'}
      </button>

      <section className="moa-consult-card">
        <Div className="flex items-center justify-between gap-2">
          <Div className="moa-consult-card__head" style={{ marginBottom: 0 }}>
            <span className="moa-consult-card__head-icon">
              <Icon name="folder-open" />
            </span>
            체결 계약 내역
          </Div>
          <button type="button" className="moa-consult-btn" onClick={() => void loadContracts()} disabled={loading}>
            <Icon name="rotate" size="sm" spin={loading} />
          </button>
        </Div>
        {contracts.length === 0 ? (
          <Div className="moa-consult-empty">아직 체결된 계약이 없습니다.</Div>
        ) : (
          <Div className="moa-consult-contract-list">
            {contracts.map(c => (
              <article key={c.id} className="moa-consult-contract-item">
                <Div>
                  <Div className="moa-consult-contract-item__name">{c.hospital_name}</Div>
                  <Div className="moa-consult-contract-item__meta">
                    {c.plan ?? '-'} · {c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR') : ''}
                  </Div>
                </Div>
                <span className={`moa-consult-badge ${c.status === 'signed' ? 'moa-consult-badge--ok' : 'moa-consult-badge--pending'}`}>
                  {c.status === 'signed' ? '서명 완료' : '작성 중'}
                </span>
              </article>
            ))}
          </Div>
        )}
      </section>
    </Div>
  );
}
