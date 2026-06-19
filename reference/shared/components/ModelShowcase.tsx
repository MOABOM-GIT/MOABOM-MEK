"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Clone, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import type { Group } from "three";

function RotatingAsset() {
  const groupRef = useRef<Group>(null);
  const gltf = useGLTF("/app-assets/3d/2026.3.22.glb");

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.45;
  });

  return (
    <group ref={groupRef} position={[0, -0.2, 0]}>
      <Clone object={gltf.scene} scale={1.35} />
    </group>
  );
}

function LoadingMesh() {
  return (
    <mesh>
      <sphereGeometry args={[0.55, 32, 32]} />
      <meshStandardMaterial color="#89b4ff" metalness={0.25} roughness={0.35} />
    </mesh>
  );
}

export default function ModelShowcase() {
  return (
    <section className="rounded-3xl border border-white/20 bg-black/25 p-6 backdrop-blur-md">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.36em] text-zinc-400">3D Preview</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">`2026.3.22.glb` 회전 미리보기</h2>
        <p className="mt-2 text-sm text-zinc-300">
          자동으로 천천히 회전하며, 마우스로 드래그해서 원하는 각도로 확인할 수 있습니다.
        </p>
      </div>

      <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-white/15 bg-black/35">
        <Canvas camera={{ position: [0, 0.35, 4.8], fov: 37 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 4, 4]} intensity={1.4} />
          <directionalLight position={[-3, -1, -2]} intensity={0.7} color="#8ec8ff" />
          <Environment preset="city" />
          <Suspense fallback={<LoadingMesh />}>
            <RotatingAsset />
          </Suspense>
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            autoRotate
            autoRotateSpeed={0.9}
            minPolarAngle={Math.PI / 3.5}
            maxPolarAngle={Math.PI / 1.9}
          />
        </Canvas>
      </div>
    </section>
  );
}

useGLTF.preload("/app-assets/3d/2026.3.22.glb");
