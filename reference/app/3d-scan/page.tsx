"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Html,
  MeshReflectorMaterial,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";

type Vec3 = [number, number, number];

type Hotspot = {
  id: string;
  title: string;
  description: string;
  position: Vec3;
  target: Vec3;
};

type ProjectedPoint = {
  x: number;
  y: number;
  visible: boolean;
  occluded: boolean;
};

type ProjectionSnapshot = {
  width: number;
  height: number;
  points: Record<string, ProjectedPoint>;
};

const INITIAL_HOTSPOTS: Hotspot[] = [
  {
    id: "lid",
    title: "짜파게티 뚜껑",
    description: "상단 개폐 부위입니다.",
    position: [-0.0030816618022319166, 0.526012964797721, -0.020739963030393545],
    target: [-0.3742301787263569, 0.756919057357006, -0.6542351437489492],
  },
  {
    id: "body",
    title: "짜파게티 캐릭터",
    description: "짜파게티 컵라면",
    position: [0.14568089797756698, 0.16758714190887675, 0.2136999798712271],
    target: [0.3605230482971611, 0.4102557754029377, 0.7048760025153192],
  },
];

function InteractiveModel({
  hotspots,
  selectedId,
  onSelect,
  onUpdateHotspot,
  onDragStateChange,
  onEditTargetChange,
  isEditMode,
  onProjectionChange,
}: {
  hotspots: Hotspot[];
  selectedId: string;
  onSelect: (id: string) => void;
  onUpdateHotspot: (id: string, key: "position" | "target", next: Vec3) => void;
  onDragStateChange: (dragging: boolean) => void;
  onEditTargetChange: (key: "position" | "target") => void;
  isEditMode: boolean;
  onProjectionChange: (snapshot: ProjectionSnapshot) => void;
}) {
  const { scene } = useGLTF("/app-assets/3d/2026.3.22.glb");
  const { camera, size, gl } = useThree();
  const modelGroupRef = useRef<THREE.Group>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const dragStateRef = useRef<{
    id: string;
    key: "position" | "target";
    plane: THREE.Plane;
    offset: THREE.Vector3;
    pointerId: number;
  } | null>(null);

  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const maxAnisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), 16);

    clonedScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const material = mesh.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
      if (material) {
        material.envMapIntensity = 1.05;
        material.roughness = Math.max(material.roughness ?? 0.55, 0.2);
        material.metalness = Math.min(material.metalness ?? 0.35, 0.9);

        const materialMaps = material as unknown as Record<string, THREE.Texture | null | undefined>;
        const mapKeys = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"];
        mapKeys.forEach((key) => {
          const texture = materialMaps[key];
          if (!texture) return;
          texture.anisotropy = maxAnisotropy;
          texture.needsUpdate = true;
        });

        material.needsUpdate = true;
      }
    });
  }, [clonedScene, gl.capabilities]);

  useFrame((_, delta) => {
    if (!modelGroupRef.current) return;
    modelGroupRef.current.rotation.y += delta * 0.3;
    modelGroupRef.current.updateWorldMatrix(true, true);

    const points: Record<string, ProjectedPoint> = {};
    const cameraWorld = new THREE.Vector3();
    camera.getWorldPosition(cameraWorld);
    const world = new THREE.Vector3();
    const ndc = new THREE.Vector3();
    const dir = new THREE.Vector3();

    hotspots.forEach((hotspot) => {
      world.set(hotspot.position[0], hotspot.position[1], hotspot.position[2]);
      modelGroupRef.current?.localToWorld(world);
      ndc.copy(world).project(camera);

      // 카메라 -> 핫스팟 레이를 쏴서 모델이 먼저 맞으면 가려진 것으로 판단
      let occluded = false;
      const distanceToPoint = cameraWorld.distanceTo(world);
      if (distanceToPoint > 0.0001) {
        dir.copy(world).sub(cameraWorld).normalize();
        raycasterRef.current.set(cameraWorld, dir);
        const hits = raycasterRef.current.intersectObject(clonedScene, true);
        if (hits.length > 0 && hits[0].distance < distanceToPoint - 0.025) {
          occluded = true;
        }
      }

      points[hotspot.id] = {
        x: (ndc.x * 0.5 + 0.5) * size.width,
        y: (-ndc.y * 0.5 + 0.5) * size.height,
        visible: ndc.z > -1 && ndc.z < 1,
        occluded,
      };
    });

    onProjectionChange({
      width: size.width,
      height: size.height,
      points,
    });
  });

  const beginDrag = useCallback(
    (
      event: ThreeEvent<PointerEvent>,
      hotspotId: string,
      key: "position" | "target",
      localPoint: Vec3,
    ) => {
      if (!modelGroupRef.current || !isEditMode) return;
      event.stopPropagation();
      onSelect(hotspotId);
      onEditTargetChange(key);
      onDragStateChange(true);

      const worldPoint = modelGroupRef.current.localToWorld(new THREE.Vector3(...localPoint));
      const normal = new THREE.Vector3();
      event.camera.getWorldDirection(normal);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldPoint);
      const hit = new THREE.Vector3();
      event.ray.intersectPlane(plane, hit);
      const offset = worldPoint.clone().sub(hit);

      dragStateRef.current = {
        id: hotspotId,
        key,
        plane,
        offset,
        pointerId: event.pointerId,
      };

      const element = event.currentTarget as unknown as { setPointerCapture?: (id: number) => void };
      element.setPointerCapture?.(event.pointerId);
    },
    [isEditMode, onDragStateChange, onEditTargetChange, onSelect],
  );

  const moveDrag = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const drag = dragStateRef.current;
      if (!drag || !modelGroupRef.current) return;
      event.stopPropagation();

      const hit = new THREE.Vector3();
      if (!event.ray.intersectPlane(drag.plane, hit)) return;
      const worldPoint = hit.add(drag.offset);
      const localPoint = modelGroupRef.current.worldToLocal(worldPoint.clone());

      onUpdateHotspot(drag.id, drag.key, [localPoint.x, localPoint.y, localPoint.z]);
    },
    [onUpdateHotspot],
  );

  const endDrag = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      event.stopPropagation();
      if (event.pointerId === drag.pointerId) {
        const element = event.currentTarget as unknown as { releasePointerCapture?: (id: number) => void };
        element.releasePointerCapture?.(event.pointerId);
      }
      dragStateRef.current = null;
      onDragStateChange(false);
    },
    [onDragStateChange],
  );

  return (
    <group ref={modelGroupRef} position={[0, -0.45, 0]} rotation={[0, -0.3, 0]} scale={1.35}>
      <primitive object={clonedScene} />
      <HotspotLayer
        hotspots={hotspots}
        selectedId={selectedId}
        onSelect={onSelect}
        onPointerDownHandle={beginDrag}
        onPointerMoveHandle={moveDrag}
        onPointerUpHandle={endDrag}
        isEditMode={isEditMode}
      />
    </group>
  );
}

function HotspotLayer({
  hotspots,
  selectedId,
  onSelect,
  onPointerDownHandle,
  onPointerMoveHandle,
  onPointerUpHandle,
  isEditMode,
}: {
  hotspots: Hotspot[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPointerDownHandle: (
    event: ThreeEvent<PointerEvent>,
    hotspotId: string,
    key: "position" | "target",
    localPoint: Vec3,
  ) => void;
  onPointerMoveHandle: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUpHandle: (event: ThreeEvent<PointerEvent>) => void;
  isEditMode: boolean;
}) {
  return (
    <>
      {hotspots.map((hotspot) => {
        const isSelected = hotspot.id === selectedId;

        return (
          <group key={hotspot.id}>
            {isEditMode ? (
              <>
                <mesh
                  position={hotspot.position}
                  onClick={() => onSelect(hotspot.id)}
                  onPointerDown={(event) => onPointerDownHandle(event, hotspot.id, "position", hotspot.position)}
                  onPointerMove={onPointerMoveHandle}
                  onPointerUp={onPointerUpHandle}
                  onPointerMissed={() => onSelect(hotspot.id)}
                >
                  <sphereGeometry args={[0.032, 18, 18]} />
                  <meshStandardMaterial
                    color={isSelected ? "#22d3ee" : "#d8b4fe"}
                    emissive={isSelected ? "#22d3ee" : "#8b5cf6"}
                    emissiveIntensity={isSelected ? 1.2 : 0.65}
                  />
                </mesh>
              </>
            ) : null}
          </group>
        );
      })}
    </>
  );
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="rounded-full border border-white/30 bg-black/45 px-4 py-2 text-xs tracking-[0.2em] text-white">
        3D LOADING...
      </div>
    </Html>
  );
}

export default function SmartCare3DScanTestPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>(INITIAL_HOTSPOTS);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_HOTSPOTS[0].id);
  const [editTarget, setEditTarget] = useState<"position" | "target">("position");
  const [step, setStep] = useState<number>(0.02);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [touchCount, setTouchCount] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [projection, setProjection] = useState<ProjectionSnapshot>({
    width: 0,
    height: 0,
    points: {},
  });

  const selectedHotspot = hotspots.find((h) => h.id === selectedId) ?? hotspots[0];
  const isTwoFingerTouch = touchCount >= 2;
  const controlsEnabled = !isDragging && (touchCount === 0 || isTwoFingerTouch);
  const canvasDpr: [number, number] = isMobileViewport ? [1, 2] : [1, 2.5];
  const shadowMapSize = isMobileViewport ? 2048 : 4096;
  const reflectorResolution = isMobileViewport ? 1024 : 2048;

  const nudgeSelected = useCallback(
    (axis: 0 | 1 | 2, delta: number) => {
      setHotspots((prev) =>
        prev.map((spot) => {
          if (spot.id !== selectedId) return spot;

          const next = [...spot[editTarget]] as Vec3;
          next[axis] += delta;

          return {
            ...spot,
            [editTarget]: next,
          };
        }),
      );
    },
    [selectedId, editTarget],
  );

  const updateHotspotPoint = useCallback((id: string, key: "position" | "target", next: Vec3) => {
    setHotspots((prev) =>
      prev.map((spot) => {
        if (spot.id !== id) return spot;
        return { ...spot, [key]: next };
      }),
    );
  }, []);

  const copyHotspotsJson = useCallback(async () => {
    const json = JSON.stringify(hotspots, null, 2);
    await navigator.clipboard.writeText(json);
  }, [hotspots]);

  const getLabelLayout = useCallback(
    (id: string) => {
      const width = projection.width;
      const height = projection.height;
      if (!width || !height) return null;
      const boxWidth = 230;
      const boxHeight = 86;
      const gap = 16;

      if (id === "lid") {
        const x = gap;
        const y = gap;
        return {
          x,
          y,
          anchorX: x + boxWidth,
          anchorY: y + boxHeight * 0.5,
        };
      }

      const x = Math.max(gap, width - gap - boxWidth);
      const y = Math.max(gap, height - gap - boxHeight);
      return {
        x,
        y,
        anchorX: x,
        anchorY: y + boxHeight * 0.5,
      };
    },
    [projection.height, projection.width],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px), (pointer: coarse)");
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isEditMode) return;
      const activeElement = document.activeElement;
      const isTyping =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        (activeElement as HTMLElement | null)?.isContentEditable;
      if (isTyping) return;

      const factor = event.shiftKey ? step * 5 : step;
      const key = event.key.toLowerCase();

      if (key === "a" || event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeSelected(0, -factor);
      } else if (key === "d" || event.key === "ArrowRight") {
        event.preventDefault();
        nudgeSelected(0, factor);
      } else if (key === "w" || event.key === "ArrowUp") {
        event.preventDefault();
        nudgeSelected(1, factor);
      } else if (key === "s" || event.key === "ArrowDown") {
        event.preventDefault();
        nudgeSelected(1, -factor);
      } else if (key === "q") {
        event.preventDefault();
        nudgeSelected(2, -factor);
      } else if (key === "e") {
        event.preventDefault();
        nudgeSelected(2, factor);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditMode, nudgeSelected, step]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(69,107,255,0.25),transparent_48%),radial-gradient(circle_at_85%_90%,rgba(155,77,255,0.2),transparent_45%)]" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <header className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/85">SmartCare360 3D Demo</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            스마트케어360 양압기 3D 스캐닝 테스트
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-200 md:text-base">
            양압기 및 마스크 등 3D 구현 테스트
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1">회전: 드래그</span>
            <span className="rounded-full border border-violet-300/35 bg-violet-300/10 px-3 py-1">확대/축소: 휠/핀치</span>
            <span className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1">이동: 우클릭 드래그</span>
            <span className="rounded-full border border-sky-300/35 bg-sky-300/10 px-3 py-1">모바일: 두 손가락으로 3D 조작</span>
          </div>
        </header>

        <div
          className="relative h-[72vh] min-h-[500px] w-full overflow-hidden rounded-3xl border border-white/15 bg-black/35 shadow-[0_30px_70px_rgba(0,0,0,0.55)]"
          style={{ touchAction: isTwoFingerTouch ? "none" : "pan-y pinch-zoom" }}
          onTouchStart={(event) => {
            setTouchCount(event.touches.length);
            if (event.touches.length >= 2) event.preventDefault();
          }}
          onTouchMove={(event) => {
            setTouchCount(event.touches.length);
            if (event.touches.length >= 2) event.preventDefault();
          }}
          onTouchEnd={(event) => {
            setTouchCount(event.touches.length);
          }}
          onTouchCancel={() => {
            setTouchCount(0);
          }}
        >
          <Canvas
            shadows
            dpr={canvasDpr}
            camera={{ position: [0, 1.2, 5.2], fov: 33 }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            onCreated={({ gl: renderer }) => {
              renderer.outputColorSpace = THREE.SRGBColorSpace;
              renderer.toneMapping = THREE.ACESFilmicToneMapping;
              renderer.toneMappingExposure = 1.08;
              renderer.shadowMap.enabled = true;
              renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            }}
          >
            <color attach="background" args={["#070a14"]} />
            <fog attach="fog" args={["#070a14", 8, 18]} />

            <ambientLight intensity={0.35} />
            <hemisphereLight intensity={0.42} groundColor="#0f1728" color="#d5e5ff" />

            <directionalLight
              position={[4.2, 7.5, 4.2]}
              intensity={1.9}
              color="#e9f0ff"
              castShadow
              shadow-mapSize-width={shadowMapSize}
              shadow-mapSize-height={shadowMapSize}
              shadow-camera-near={0.5}
              shadow-camera-far={30}
              shadow-camera-left={-7}
              shadow-camera-right={7}
              shadow-camera-top={7}
              shadow-camera-bottom={-7}
            />
            <directionalLight position={[-4, 2, -4]} intensity={0.7} color="#84a9ff" />
            <pointLight position={[0, 1.5, 2.5]} intensity={0.6} color="#9b8bff" />

            <Suspense fallback={<LoadingFallback />}>
              <InteractiveModel
                hotspots={hotspots}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdateHotspot={updateHotspotPoint}
                onDragStateChange={setIsDragging}
                onEditTargetChange={setEditTarget}
                isEditMode={isEditMode}
                onProjectionChange={setProjection}
              />
            </Suspense>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]} receiveShadow>
              <planeGeometry args={[40, 40]} />
              <MeshReflectorMaterial
                blur={[350, 110]}
                resolution={reflectorResolution}
                mixBlur={1.2}
                mixStrength={1.45}
                roughness={0.22}
                depthScale={1}
                minDepthThreshold={0.35}
                maxDepthThreshold={1.15}
                color="#0f1628"
                metalness={0.62}
              />
            </mesh>

            <ContactShadows
              position={[0, -1.28, 0]}
              opacity={0.55}
              scale={8}
              blur={2.6}
              far={3.6}
              color="#000000"
            />

            <Environment preset="city" />
            <OrbitControls
              makeDefault
              enabled={controlsEnabled}
              enablePan
              enableZoom
              enableRotate
              rotateSpeed={0.7}
              zoomSpeed={0.9}
              panSpeed={0.75}
              dampingFactor={0.08}
              minDistance={2.1}
              maxDistance={9}
              minPolarAngle={Math.PI / 3.5}
              maxPolarAngle={Math.PI / 1.85}
            />
          </Canvas>

          <div className="pointer-events-none absolute inset-0 z-20">
            <svg className="absolute inset-0 h-full w-full">
              {hotspots.map((hotspot) => {
                const from = projection.points[hotspot.id];
                if (!from?.visible) return null;
                const layout = getLabelLayout(hotspot.id);
                if (!layout) return null;
                const alpha = from.occluded ? 0.2 : 1;

                return (
                  <line
                    key={`line-${hotspot.id}`}
                    x1={from.x}
                    y1={from.y}
                    x2={layout.anchorX}
                    y2={layout.anchorY}
                    stroke={hotspot.id === selectedId ? "#67e8f9" : "#c4b5fd"}
                    strokeWidth={hotspot.id === selectedId ? 1.8 : 1.2}
                    strokeOpacity={0.9 * alpha}
                  />
                );
              })}
            </svg>

            {hotspots.map((hotspot) => {
              const from = projection.points[hotspot.id];
              if (!from?.visible) return null;
              const layout = getLabelLayout(hotspot.id);
              if (!layout) return null;
              const isSelected = hotspot.id === selectedId;
              const alpha = from.occluded ? 0.2 : 1;

              return (
                <button
                  key={`label-${hotspot.id}`}
                  type="button"
                  onClick={() => setSelectedId(hotspot.id)}
                  className={`pointer-events-auto absolute w-[230px] rounded-xl border px-3.5 py-3 text-left transition ${
                    isSelected
                      ? "border-cyan-300/80 bg-slate-900/88 text-white"
                      : "border-violet-300/60 bg-slate-900/78 text-zinc-100"
                  }`}
                  style={{
                    left: `${layout.x}px`,
                    top: `${layout.y}px`,
                    opacity: alpha,
                  }}
                >
                  <p className="text-[15px] font-semibold leading-6 tracking-wide">{hotspot.title}</p>
                  <p className="mt-1.5 text-[13px] leading-5 opacity-90">{hotspot.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-300 backdrop-blur-md md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-2">
            <p>3D Asset: /public/app-assets/3d/2026.3.22.glb</p>
            <p>
              선택 부위: <span className="font-semibold text-cyan-300">{selectedHotspot?.title ?? "-"}</span>
            </p>
            <p>
              편집 대상:{" "}
              <span className="font-semibold text-violet-300">position (점)</span>
            </p>
            <p>
              편집 모드:{" "}
              <span className={`font-semibold ${isEditMode ? "text-emerald-300" : "text-zinc-400"}`}>
                {isEditMode ? "ON" : "OFF"}
              </span>
            </p>
            <p className="text-zinc-400">
              좌표:{" "}
              {selectedHotspot
                ? JSON.stringify(selectedHotspot[editTarget].map((n) => Number(n.toFixed(3))))
                : "[]"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setIsEditMode((prev) => !prev);
                setIsDragging(false);
              }}
              className={`col-span-3 rounded-lg border px-2 py-2 ${
                isEditMode
                  ? "border-emerald-300/70 bg-emerald-500/20 text-emerald-100"
                  : "border-white/25 bg-white/5 text-zinc-100 hover:bg-white/10"
              }`}
            >
              {isEditMode ? "편집 모드 종료" : "편집 모드 시작"}
            </button>
            <button
              type="button"
              onClick={() => setEditTarget("position")}
              disabled={!isEditMode}
              className={`rounded-lg border px-2 py-2 ${
                !isEditMode
                  ? "cursor-not-allowed border-white/10 bg-white/5 text-zinc-500"
                  : editTarget === "position"
                    ? "border-cyan-300/70 bg-cyan-500/20 text-white"
                    : "border-white/20 hover:bg-white/10"
              }`}
            >
              Position
            </button>
            <button
              type="button"
              onClick={copyHotspotsJson}
              className="rounded-lg border border-emerald-300/50 bg-emerald-500/20 px-2 py-2 text-emerald-100 hover:bg-emerald-500/30"
            >
              JSON 복사
            </button>

            <button
              type="button"
              disabled={!isEditMode}
              onClick={() => nudgeSelected(0, -step)}
              className={`rounded-lg border px-2 py-2 ${isEditMode ? "border-white/20 hover:bg-white/10" : "cursor-not-allowed border-white/10 bg-white/5 text-zinc-500"}`}
            >
              X-
            </button>
            <button
              type="button"
              disabled={!isEditMode}
              onClick={() => nudgeSelected(1, step)}
              className={`rounded-lg border px-2 py-2 ${isEditMode ? "border-white/20 hover:bg-white/10" : "cursor-not-allowed border-white/10 bg-white/5 text-zinc-500"}`}
            >
              Y+
            </button>
            <button
              type="button"
              disabled={!isEditMode}
              onClick={() => nudgeSelected(2, step)}
              className={`rounded-lg border px-2 py-2 ${isEditMode ? "border-white/20 hover:bg-white/10" : "cursor-not-allowed border-white/10 bg-white/5 text-zinc-500"}`}
            >
              Z+
            </button>
            <button
              type="button"
              disabled={!isEditMode}
              onClick={() => nudgeSelected(0, step)}
              className={`rounded-lg border px-2 py-2 ${isEditMode ? "border-white/20 hover:bg-white/10" : "cursor-not-allowed border-white/10 bg-white/5 text-zinc-500"}`}
            >
              X+
            </button>
            <button
              type="button"
              disabled={!isEditMode}
              onClick={() => nudgeSelected(1, -step)}
              className={`rounded-lg border px-2 py-2 ${isEditMode ? "border-white/20 hover:bg-white/10" : "cursor-not-allowed border-white/10 bg-white/5 text-zinc-500"}`}
            >
              Y-
            </button>
            <button
              type="button"
              disabled={!isEditMode}
              onClick={() => nudgeSelected(2, -step)}
              className={`rounded-lg border px-2 py-2 ${isEditMode ? "border-white/20 hover:bg-white/10" : "cursor-not-allowed border-white/10 bg-white/5 text-zinc-500"}`}
            >
              Z-
            </button>

            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="col-span-2 rounded-lg border border-white/20 bg-slate-900/60 px-2 py-2 text-zinc-100 outline-none"
            >
              {hotspots.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.title}
                </option>
              ))}
            </select>
            <select
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              disabled={!isEditMode}
              className={`rounded-lg border bg-slate-900/60 px-2 py-2 text-zinc-100 outline-none ${
                isEditMode ? "border-white/20" : "cursor-not-allowed border-white/10 text-zinc-500"
              }`}
            >
              <option value={0.005}>0.005</option>
              <option value={0.01}>0.01</option>
              <option value={0.02}>0.02</option>
              <option value={0.05}>0.05</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          테스트 페이지
        </div>
      </section>
    </main>
  );
}

useGLTF.preload("/app-assets/3d/2026.3.22.glb");
