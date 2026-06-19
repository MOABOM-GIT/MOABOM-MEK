"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function DistortionPlane() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} scale={[5, 5, 1]}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        transparent
        blending={THREE.AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv;
            float noise = sin(p.y * 10.0 + uTime * 0.5) * 0.02;
            vec3 color = vec3(0.05, 0.1, 0.2) * (0.5 + 0.5 * sin(uTime + p.x * 5.0));
            gl_FragColor = vec4(color, 0.15 + abs(noise)); 
          }
        `}
      />
    </mesh>
  );
}

export default function LiquidBackground() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <Canvas camera={{ position: [0, 0, 1] }}>
        <DistortionPlane />
      </Canvas>
    </div>
  );
}