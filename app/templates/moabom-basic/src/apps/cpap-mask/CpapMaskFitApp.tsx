import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useRef, useState } from 'react';
import { printCpapResultPdf } from './cpapResultPdf';
import {
  fetchLatestCpapMeasurement,
  storeCpapMeasurement,
  type CpapStoredMeasurement,
  type CpapUserProfile,
} from '../../api/moabomAppsApi';
import { useMoabomShellT } from 'moabom-shell-i18n';
import { Button } from '../../components/basic/Button';
import { Canvas } from '../../components/basic/Canvas';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { CPAP_ICON_TEXT_ROW_CLASS, CPAP_PANEL_CLASS } from './cpapSurveyStyles';
import {
  CpapCameraOverlayDock,
  CpapChoiceGroup,
  CpapEmptyLatest,
  CpapMaskTypeMultiSelect,
  CpapPrimaryCta,
  CpapProcessBadges,
  CpapResultHero,
  CpapStatusBanner,
} from './CpapSurveyUi';
import {
  drawLandmarks,
  estimateYaw,
  FaceMeasurementSession,
  initializeFaceLandmarker,
  performMeasurement,
  performProfileMeasurement,
  PoseValidator,
  recommendMask,
  type CpapMeasurementResult,
} from './cpapMeasurement';

type Step = 'survey' | 'idle' | 'guide-check' | 'countdown' | 'scanning-front' | 'guide-turn-side' | 'scanning-profile' | 'result';

const COUNTDOWN_SECONDS = 3;
const SCAN_FRAMES = 90;
const YAW_THRESHOLD_FRONT = 10;
const YAW_THRESHOLD_PROFILE = 35;
const visibleMeasurementKeys = ['faceWidth', 'faceLength', 'noseWidth', 'philtrumLength', 'mouthWidth', 'bridgeWidth'] as const;

const profileDefaults: CpapUserProfile = {
  gender: 'male',
  ageGroup: '30s',
  tossing: 'medium',
  mouthBreathing: false,
  pressure: 'medium',
  preferredTypes: [],
};

const levelOptions = ['low', 'medium', 'high'] as const;

function cpapStoredToResult(stored: CpapStoredMeasurement): CpapMeasurementResult {
  const m = stored.measurements;
  const pm = stored.profile_measurements ?? {};

  return {
    measurements: {
      ipdPixels: Number(m.ipdPixels) || 0,
      scaleFactor: Number(m.scaleFactor) || 0,
      faceWidth: Number(m.faceWidth) || 0,
      faceLength: Number(m.faceLength) || 0,
      noseWidth: Number(m.noseWidth) || 0,
      philtrumLength: Number(m.philtrumLength) || 0,
      mouthWidth: Number(m.mouthWidth) || 0,
      bridgeWidth: Number(m.bridgeWidth) || 0,
      confidence: Number(m.confidence) || stored.confidence || stored.recommendation.confidence || 0,
    },
    profileMeasurements: {
      noseHeight: Number(pm.noseHeight) || 0,
      jawProjection: Number(pm.jawProjection) || 0,
      chinLength: Number(pm.chinLength) || 0,
    },
    recommendation: stored.recommendation,
  };
}

export function CpapMaskFitApp() {
  const { t, language } = useMoabomShellT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef(0);
  const stableFramesRef = useRef(0);
  const stepRef = useRef<Step>('survey');
  const measurementSessionRef = useRef(new FaceMeasurementSession(SCAN_FRAMES));
  const recommendedMaskRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>('survey');
  const [profile, setProfile] = useState<CpapUserProfile>(profileDefaults);
  const [status, setStatus] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [result, setResult] = useState<CpapMeasurementResult | null>(null);
  const [latest, setLatest] = useState<CpapStoredMeasurement | null>(null);
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [scanProgress, setScanProgress] = useState(0);

  const setMeasurementStep = useCallback((nextStep: Step) => {
    stepRef.current = nextStep;
    setStep(nextStep);
  }, []);

  useEffect(() => {
    setStatus('');
    setSubStatus('');
    setError('');
    setInfoMessage('');
  }, [language]);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const attachStreamToVideo = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) {
      return;
    }
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    if (video.paused) {
      await video.play();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchLatestCpapMeasurement()
      .then((measurement) => {
        if (!cancelled) setLatest(measurement);
      })
      .catch(() => {
        if (!cancelled) setLatest(null);
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera, t]);

  useEffect(() => {
    if (step !== 'countdown') return;

    let count = COUNTDOWN_SECONDS;
    setCountdown(count);
    const timer = window.setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count === 0) {
        window.clearInterval(timer);
        setScanProgress(0);
        measurementSessionRef.current.reset();
        setMeasurementStep('scanning-front');
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [setMeasurementStep, step]);

  const finishMeasurement = useCallback(() => {
    const finalResults = measurementSessionRef.current.getFinalResults();
    if (!finalResults) {
      setError(t('moa_apps_cpap.measurement_data_error'));
      return;
    }

    const recommendation = recommendMask(finalResults.measurements, finalResults.profileMeasurements, profile);
    setResult({
      measurements: finalResults.measurements,
      profileMeasurements: finalResults.profileMeasurements,
      recommendation,
    });
    setStatus('');
    setSubStatus('');
    setMeasurementStep('result');
    stopCamera();
  }, [profile, setMeasurementStep, stopCamera, t]);

  const detectFace = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !faceLandmarker) return;

    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameRef.current = requestAnimationFrame(detectFace);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const timestampMs = Math.max(lastTimestampRef.current + 1, performance.now(), video.currentTime * 1000);
    lastTimestampRef.current = timestampMs;

    const results = faceLandmarker.detectForVideo(video, timestampMs);
    if (results.faceLandmarks?.length) {
      const landmarks = results.faceLandmarks[0];
      drawLandmarks(ctx, landmarks, canvas.width, canvas.height, true);

      const measurements = performMeasurement(results, canvas.width, canvas.height, profile.gender);
      const yaw = estimateYaw(landmarks);
      const currentStep = stepRef.current;

      if (measurements && currentStep === 'guide-check') {
        if (PoseValidator.isFrontFacing(yaw, YAW_THRESHOLD_FRONT)) {
          stableFramesRef.current += 1;
          setSubStatus(t('moa_apps_cpap.guide_front_checking', { count: Math.min(stableFramesRef.current, 20) }));
          if (stableFramesRef.current > 20) {
            setStatus(t('moa_apps_cpap.measurement_starting'));
            setSubStatus('');
            setMeasurementStep('countdown');
          }
        } else {
          stableFramesRef.current = 0;
          setSubStatus(t('moa_apps_cpap.guide_front'));
        }
      }

      if (currentStep === 'scanning-front') {
        measurementSessionRef.current.addFrontMeasurement(measurements ?? undefined);
        const progress = measurementSessionRef.current.getFrontProgress();
        setScanProgress(25 + Math.round(progress * 0.25));
        setStatus(t('moa_apps_cpap.scanning_front'));
        setSubStatus('');
        if (measurementSessionRef.current.isFrontComplete()) {
          measurementSessionRef.current.finalizeFrontMeasurement();
          stableFramesRef.current = 0;
          setScanProgress(50);
          setStatus(t('moa_apps_cpap.guide_turn_side'));
          setSubStatus(t('moa_apps_cpap.guide_turn_side_detail'));
          setMeasurementStep('guide-turn-side');
        }
      }

      if (currentStep === 'guide-turn-side') {
        if (PoseValidator.isProfileFacing(yaw, YAW_THRESHOLD_PROFILE)) {
          stableFramesRef.current += 1;
          if (stableFramesRef.current > 10) {
            setMeasurementStep('scanning-profile');
          }
        } else {
          stableFramesRef.current = 0;
        }
      }

      if (currentStep === 'scanning-profile') {
        const profileMeasurement = performProfileMeasurement(
          landmarks,
          measurementSessionRef.current.getFixedScaleFactor(),
          canvas.width,
          canvas.height,
        );
        measurementSessionRef.current.addProfileMeasurement(profileMeasurement);
        const progress = measurementSessionRef.current.getProfileProgress();
        setScanProgress(50 + Math.round(progress * 0.5));
        setStatus(t('moa_apps_cpap.scanning_profile'));
        setSubStatus('');
        if (measurementSessionRef.current.isProfileComplete()) {
          finishMeasurement();
          return;
        }
      }
    } else {
      drawLandmarks(ctx, [], canvas.width, canvas.height, false);
      stableFramesRef.current = 0;
      setSubStatus(t('moa_apps_cpap.face_not_detected'));
    }

    if (stepRef.current !== 'result' && stepRef.current !== 'survey' && stepRef.current !== 'idle') {
      animationFrameRef.current = requestAnimationFrame(detectFace);
    }
  }, [faceLandmarker, finishMeasurement, profile.gender, setMeasurementStep, t]);

  const cameraActive = !['survey', 'idle', 'result'].includes(step);

  useEffect(() => {
    if (!cameraActive || !streamRef.current) {
      return;
    }

    let cancelled = false;

    void attachStreamToVideo()
      .then(() => {
        if (cancelled) {
          return;
        }
        const current = stepRef.current;
        if (
          current !== 'result' &&
          current !== 'survey' &&
          current !== 'idle' &&
          animationFrameRef.current === null
        ) {
          animationFrameRef.current = requestAnimationFrame(detectFace);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('moa_apps_cpap.camera_error'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attachStreamToVideo, cameraActive, detectFace, t]);

  const startCamera = async () => {
    setError('');
    setInfoMessage('');
    setStatus(t('moa_apps_cpap.camera_starting'));
    setIsCameraStarting(true);

    let landmarker = faceLandmarker;
    try {
      if (!landmarker) {
        setIsModelLoading(true);
        landmarker = await initializeFaceLandmarker();
        setFaceLandmarker(landmarker);
        setIsModelLoading(false);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      stableFramesRef.current = 0;
      lastTimestampRef.current = 0;
      setMeasurementStep('guide-check');
      setStatus(t('moa_apps_cpap.guide_front'));
    } catch (err) {
      setIsModelLoading(false);
      const hadLandmarker = !!landmarker;
      setError(
        err instanceof Error
          ? err.message
          : hadLandmarker
            ? t('moa_apps_cpap.camera_error')
            : t('moa_apps_cpap.mediapipe_error'),
      );
      setStatus('');
    } finally {
      setIsCameraStarting(false);
      setIsModelLoading(false);
    }
  };

  const saveResult = async () => {
    if (!result) return;
    setError('');
    setInfoMessage('');
    setIsSaving(true);
    try {
      const saved = await storeCpapMeasurement({
        profile,
        measurements: { ...result.measurements },
        profile_measurements: { ...result.profileMeasurements },
        recommendation: result.recommendation,
        metadata: {
          source: 'moabom-shell',
          measuredAt: new Date().toISOString(),
        },
      });
      setLatest(saved);
      setInfoMessage(t('moa_apps_cpap.save_success'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('moa_apps_cpap.save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  const exportResultPdf = () => {
    if (!result) return;
    printCpapResultPdf(result, {
      title: t('moa_apps_cpap.pdf_title'),
      mask: t('moa_apps_cpap.result_recommendation'),
      confidence: t('moa_apps_cpap.result_confidence', { confidence: result.recommendation.confidence }),
      scanData: t('moa_apps_cpap.measurements_title'),
      reasons: t('moa_apps_cpap.reasons_title'),
      tips: t('moa_apps_cpap.result_tips'),
      scannedAt: t('moa_apps_cpap.latest_date'),
      measurementRows: visibleMeasurementKeys.map(key => ({
        label: t(`moa_apps_cpap.measurements.${key}`),
        value: `${result.measurements[key]} mm`,
      })),
    });
  };

  const scrollToRecommendedMask = () => {
    recommendedMaskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isScanningStep = step === 'scanning-front' || step === 'scanning-profile';

  const reset = () => {
    stopCamera();
    measurementSessionRef.current.reset();
    stableFramesRef.current = 0;
    lastTimestampRef.current = 0;
    setResult(null);
    setError('');
    setInfoMessage('');
    setStatus('');
    setSubStatus('');
    setScanProgress(0);
    setMeasurementStep('survey');
  };

  const openLatestResult = useCallback(() => {
    if (!latest) return;
    stopCamera();
    setProfile(latest.profile);
    setResult(cpapStoredToResult(latest));
    setError('');
    setInfoMessage('');
    setStatus('');
    setSubStatus('');
    setScanProgress(0);
    setMeasurementStep('result');
  }, [latest, setMeasurementStep, stopCamera]);

  const goToProcessStep = useCallback(
    (index: number) => {
      if (index === 0) {
        stopCamera();
        setError('');
        setInfoMessage('');
        setStatus('');
        setSubStatus('');
        setScanProgress(0);
        setMeasurementStep('survey');
        return;
      }

      if (index === 1) {
        if (cameraActive) return;
        void startCamera();
        return;
      }

      stopCamera();
      setStatus('');
      setSubStatus('');
      setScanProgress(0);
      setMeasurementStep('result');
    },
    [cameraActive, result, setMeasurementStep, startCamera, stopCamera],
  );

  const currentStepIndex = step === 'result' ? 2 : cameraActive ? 1 : 0;

  const processSteps = [
    { id: 'survey', label: t('moa_apps_cpap.steps.survey') },
    { id: 'camera', label: t('moa_apps_cpap.steps.camera') },
    { id: 'result', label: t('moa_apps_cpap.steps.result') },
  ];

  const levelChoiceOptions = levelOptions.map(value => ({
    value,
    label: t(`moa_apps_cpap.level.${value}`),
  }));

  const pressureChoiceOptions = levelOptions.map(value => ({
    value,
    label: t(`moa_apps_cpap.pressure_level.${value}`),
  }));

  const maskTypeOptions = (['nasal', 'pillow', 'full'] as const).map(value => ({
    value,
    label: t(`moa_apps_cpap.mask_type.${value}.title`),
    description: t(`moa_apps_cpap.mask_type.${value}.desc`),
  }));

  return (
    <Div className="moa-shell-app-window moa-cpap-fit-app">
      <Div className="moa-cpap-fit-stage">
        {step === 'survey' && (
          <Div className="moa-cpap-fit-scroll">
            {error ? <CpapStatusBanner variant="error" title={error} /> : null}
            {infoMessage ? <CpapStatusBanner variant="info" title={infoMessage} /> : null}
            <Div className="moa-cpap-fit-survey-grid grid gap-4 @lg:grid-cols-[minmax(0,1fr)_300px]">
              <Div className={`${CPAP_PANEL_CLASS} gap-5`}>
              <CpapChoiceGroup
                label={t('moa_apps_cpap.profile.gender')}
                labelIcon="fa-user"
                options={[
                  { value: 'male', label: t('moa_apps_cpap.profile.gender_male') },
                  { value: 'female', label: t('moa_apps_cpap.profile.gender_female') },
                ]}
                value={profile.gender}
                onChange={gender => setProfile(prev => ({ ...prev, gender }))}
              />

              <CpapChoiceGroup
                label={t('moa_apps_cpap.profile.age')}
                labelIcon="fa-calendar"
                singleRow
                optionsClassName="moa-cpap-choice-age"
                options={(['20s', '30s', '40s', '50s', '60s+'] as const).map(value => ({
                  value,
                  label: t(`moa_apps_cpap.profile.age_${value}`),
                }))}
                value={profile.ageGroup}
                onChange={ageGroup => setProfile(prev => ({ ...prev, ageGroup }))}
              />

              <CpapChoiceGroup
                label={t('moa_apps_cpap.profile.tossing')}
                labelIcon="fa-bed"
                singleRow
                options={levelChoiceOptions}
                value={profile.tossing}
                onChange={tossing => setProfile(prev => ({ ...prev, tossing }))}
              />

              <CpapChoiceGroup
                label={t('moa_apps_cpap.profile.pressure')}
                labelIcon="fa-lungs"
                singleRow
                options={pressureChoiceOptions}
                value={profile.pressure}
                onChange={pressure => setProfile(prev => ({ ...prev, pressure }))}
              />

              <CpapChoiceGroup
                label={t('moa_apps_cpap.profile.mouth_breathing')}
                labelIcon="fa-wind"
                columns={2}
                options={[
                  { value: 'yes', label: t('moa_apps_cpap.common.yes') },
                  { value: 'no', label: t('moa_apps_cpap.common.no') },
                ]}
                value={profile.mouthBreathing ? 'yes' : 'no'}
                onChange={value => setProfile(prev => ({ ...prev, mouthBreathing: value === 'yes' }))}
              />

              <CpapMaskTypeMultiSelect
                label={t('moa_apps_cpap.profile.preferred_types')}
                labelIcon="fa-masks-theater"
                options={maskTypeOptions}
                values={profile.preferredTypes}
                onChange={preferredTypes => setProfile(prev => ({ ...prev, preferredTypes }))}
              />

              <CpapPrimaryCta
                label={t('moa_apps_cpap.start_cta')}
                loadingLabel={t('moa_apps_cpap.camera_starting')}
                loading={isCameraStarting || isModelLoading}
                disabled={isCameraStarting || isModelLoading}
                onClick={startCamera}
              />
              </Div>
              <LatestMeasurementCard latest={latest} onSelect={openLatestResult} />
            </Div>
          </Div>
        )}

        {cameraActive && (
          <>
            <video ref={videoRef} className="moa-cpap-fit-video" autoPlay muted playsInline />
            <Canvas ref={canvasRef} className="moa-cpap-fit-canvas" />
            {step === 'countdown' && (
              <Div className="moa-cpap-fit-countdown">
                <Div className="text-7xl font-bold text-white drop-shadow-lg">{countdown}</Div>
                <Div className="rounded-full bg-white/20 px-4 py-1 text-sm text-white">{t('moa_apps_cpap.measurement_starting')}</Div>
              </Div>
            )}
            {step === 'guide-turn-side' && (
              <Div className="moa-cpap-fit-guide">
                <Icon name="fa-arrow-left" size="3x" className="text-white drop-shadow-lg" />
                <Div className="text-center text-lg font-bold text-white drop-shadow">{t('moa_apps_cpap.guide_turn_side_detail')}</Div>
              </Div>
            )}
          </>
        )}

        {step === 'result' && (
          <Div className="moa-cpap-fit-scroll">
            {error ? <CpapStatusBanner variant="error" title={error} /> : null}
            {!result ? (
              <Div className={`${CPAP_PANEL_CLASS} gap-4`}>
                <CpapStatusBanner
                  variant="info"
                  title={t('moa_apps_cpap.result_empty_title')}
                  detail={t('moa_apps_cpap.result_empty_detail')}
                />
                <CpapPrimaryCta
                  label={t('moa_apps_cpap.start_cta')}
                  loadingLabel={t('moa_apps_cpap.camera_starting')}
                  loading={isCameraStarting || isModelLoading}
                  disabled={isCameraStarting || isModelLoading}
                  onClick={startCamera}
                />
              </Div>
            ) : (
            <Div className="moa-cpap-fit-survey-grid grid gap-4 @lg:grid-cols-[minmax(0,1fr)_280px]">
              <Div className={CPAP_PANEL_CLASS}>
            <Div ref={recommendedMaskRef}>
              <CpapResultHero
                badge={t('moa_apps_cpap.result_badge')}
                maskName={result.recommendation.name}
                confidenceLabel={t('moa_apps_cpap.result_confidence', { confidence: result.recommendation.confidence })}
              />
            </Div>

            <Div>
              <Div className="mb-3 flex items-center gap-2">
                <Icon name="fa-ruler-combined" />
                {t('moa_apps_cpap.measurements_title')}
              </Div>
              <Div className="grid gap-2 @sm:grid-cols-2">
                {visibleMeasurementKeys.map((key) => (
                  <Div key={key} className="flex items-center gap-3 rounded-2xl px-4 py-3 glass-sm">
                    <Icon name="fa-ruler" className="text-muted" />
                    <Div>
                      <Div className="text-muted">{t(`moa_apps_cpap.measurements.${key}`)}</Div>
                      <Div>{result.measurements[key]} mm</Div>
                    </Div>
                  </Div>
                ))}
              </Div>
            </Div>

            {result.recommendation.reasons?.length ? (
              <Div>
                <Div className="mb-3 flex items-center gap-2">
                  <Icon name="fa-lightbulb" />
                  {t('moa_apps_cpap.reasons_title')}
                </Div>
                <Div className="flex flex-col gap-2">
                  {result.recommendation.reasons.map(reason => (
                    <Div key={reason} className={`${CPAP_ICON_TEXT_ROW_CLASS} rounded-2xl px-3 py-2 glass-sm text-muted`}>
                      <Icon name="fa-check" size="sm" className="shrink-0 text-[color:var(--moa-point-color)]" />
                      <span>{reason}</span>
                    </Div>
                  ))}
                </Div>
              </Div>
            ) : null}

            <Div className="moa-cpap-result-actions">
              <Button type="button" variant="primary" size="medium" onClick={saveResult} disabled={isSaving}>
                <Icon name={isSaving ? 'fa-spinner' : 'fa-floppy-disk'} spin={isSaving} />
                {isSaving ? t('moa_apps_cpap.saving') : t('moa_apps_cpap.save')}
              </Button>
              <Button type="button" variant="dark-outline" size="medium" onClick={exportResultPdf}>
                <Icon name="fa-file-pdf" />
                {t('moa_apps_cpap.export_pdf')}
              </Button>
              <Button type="button" variant="primary-outline" size="medium" onClick={scrollToRecommendedMask}>
                <Icon name="fa-mask" />
                {t('moa_apps_cpap.view_recommended_mask')}
              </Button>
              <Button type="button" variant="secondary" size="medium" className="moa-cpap-result-actions-retry" onClick={reset}>
                <Icon name="fa-rotate-right" />
                {t('moa_apps_cpap.retry')}
              </Button>
            </Div>
          </Div>

          <Div className={CPAP_PANEL_CLASS}>
            <Div className="mb-3 flex items-center gap-2">
              <Icon name="fa-circle-info" />
              {t('moa_apps_cpap.result_tips')}
            </Div>
            {result.recommendation.tips?.map(tip => (
              <Div key={tip} className={`${CPAP_ICON_TEXT_ROW_CLASS} rounded-2xl px-3 py-2 glass-sm text-muted`}>
                <Icon name="fa-star" size="sm" className="shrink-0 text-amber-500" />
                <span>{tip}</span>
              </Div>
            ))}
              </Div>
            </Div>
            )}
          </Div>
        )}
      </Div>

      <Div className={`moa-cpap-fit-overlay-top rounded-3xl p-4 ${cameraActive ? 'glass-sm' : 'glass-sm-blur'}`}>
        <CpapProcessBadges
          steps={processSteps}
          activeIndex={currentStepIndex}
          aiReady={!!faceLandmarker}
          cameraReadyLabel={t('moa_apps_cpap.camera_ready_badge')}
          cameraLoadingLabel={t('moa_apps_cpap.camera_loading_badge')}
          onStepClick={goToProcessStep}
        />
      </Div>

      {cameraActive && (
        <Div className="moa-cpap-fit-overlay-bottom">
          {error ? <CpapStatusBanner variant="error" title={error} /> : null}
          <CpapCameraOverlayDock
            status={status || t('moa_apps_cpap.camera_ready')}
            subStatus={subStatus}
            scanProgress={isScanningStep ? scanProgress : undefined}
          />
        </Div>
      )}
    </Div>
  );
}

function LatestMeasurementCard({
  latest,
  onSelect,
}: {
  latest: CpapStoredMeasurement | null;
  onSelect: () => void;
}) {
  const { t } = useMoabomShellT();

  if (!latest) {
    return (
      <Div className={CPAP_PANEL_CLASS}>
        <Div className="mb-3 flex items-center gap-2">
          <Icon name="fa-clock-rotate-left" />
          {t('moa_apps_cpap.latest_title')}
        </Div>
        <CpapEmptyLatest message={t('moa_apps_cpap.latest_empty_hint')} />
      </Div>
    );
  }

  return (
    <Div
      className={`${CPAP_PANEL_CLASS} moa-cpap-latest-card--clickable`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <Div className="mb-3 flex items-center gap-2">
        <Icon name="fa-clock-rotate-left" />
        {t('moa_apps_cpap.latest_title')}
      </Div>
      <Div className="text-xl font-bold">{latest.recommendation.name}</Div>
      <Div className="text-muted">
        {t('moa_apps_cpap.result_confidence', { confidence: latest.recommendation.confidence })}
      </Div>
      {latest.created_at ? (
        <Div className="flex items-center gap-2 text-muted">
          <Icon name="fa-calendar" size="sm" />
          <span>
            {t('moa_apps_cpap.latest_date')}: {latest.created_at}
          </span>
        </Div>
      ) : null}
    </Div>
  );
}
