/**
 * site_logo 슬롯(라이트/다크)별 폼 상태 병합.
 *
 * G7 저장 시 폼의 site_logo ID가 exists 검증을 받는데,
 * 서버가 동일 슬롯 교체 시 이전 ID를 삭제하면 stale ID로 422가 납니다.
 * 업로드 완료 시 슬롯 단위로 교체해 폼과 DB를 맞춥니다.
 */

type SiteLogoSlot = 'light' | 'dark';

type SiteLogoAttachmentLike = {
  id?: number;
  order?: number;
  source_identifier?: string;
  meta?: { variant?: string };
};

function resolveSiteLogoSlot(item: SiteLogoAttachmentLike): SiteLogoSlot {
  if (item.source_identifier === 'site_logo:dark') {
    return 'dark';
  }
  if (item.source_identifier === 'site_logo:light') {
    return 'light';
  }

  const variant = item.meta?.variant;
  if (variant === 'dark') {
    return 'dark';
  }
  if (variant === 'light') {
    return 'light';
  }

  if (Number(item.order) === 2) {
    return 'dark';
  }

  return 'light';
}

export async function mergeSiteLogoUploadHandler(action: {
  params?: { uploaded?: SiteLogoAttachmentLike[] };
}): Promise<void> {
  const uploaded = action?.params?.uploaded;
  if (!Array.isArray(uploaded) || uploaded.length === 0) {
    return;
  }

  const G7Core = (window as any).G7Core;
  const local = G7Core?.state?.getLocal?.() ?? {};
  const form = (local.form ?? {}) as Record<string, Record<string, unknown>>;
  const general = (form.general ?? {}) as { site_logo?: SiteLogoAttachmentLike[] };
  const current = Array.isArray(general.site_logo) ? [...general.site_logo] : [];

  for (const item of uploaded) {
    const slot = resolveSiteLogoSlot(item);
    const index = current.findIndex((entry) => resolveSiteLogoSlot(entry) === slot);
    if (index >= 0) {
      current[index] = item;
    } else {
      current.push(item);
    }
  }

  G7Core?.state?.setLocal?.({
    hasChanges: true,
    form: {
      ...form,
      general: {
        ...general,
        site_logo: current,
      },
    },
  });
}
